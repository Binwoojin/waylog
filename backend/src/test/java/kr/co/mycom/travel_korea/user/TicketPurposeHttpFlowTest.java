package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.EmailVerificationPurpose;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/*
 * 인증 티켓의 용도(가입 SIGNUP vs 비밀번호 재설정 RESET_PASSWORD) 교차 사용을 거부하는지 확인합니다.
 *
 * 이전에는 용도가 없어서 가입용 인증번호로 얻은 티켓으로 비밀번호를 바꾸거나, 재설정용 티켓으로 가입할 수 있었습니다.
 * 용도를 연결한 뒤에는 발급받은 용도의 흐름에서만 티켓을 쓸 수 있어야 합니다.
 *
 * 인증번호는 메일로 보내지 않고 같은 용도 키로 캐시에 직접 넣습니다. 발급과 확인 경로는 실제 엔드포인트를 쓴다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class TicketPurposeHttpFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";
    private static final String NEW_PASSWORD = "NewPassw0rd!2";
    private static final int CODE = 123456;

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private Cache<String, Integer> emailVerificationCache;

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    // A. 가입용 인증번호로 얻은 티켓은 비밀번호 재설정에 쓸 수 없다
    @Test
    void signupTicketCannotChangePassword() throws Exception {
        String email = "purpose-a-" + UUID.randomUUID() + "@example.com";
        userRepository.save(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), CODE);
        String ticket = confirmCode(email, EmailVerificationPurpose.SIGNUP);

        HttpResponse<String> changed = send("PUT", "/api/v1/auth/password", Map.of(
                "email", email, "password", NEW_PASSWORD, "verificationToken", ticket));

        assertEquals(400, changed.statusCode(), changed.body());
        assertTrue(changed.body().contains("이메일 인증이 필요합니다."), changed.body());
        assertEquals(200, login(email, RAW_PASSWORD), "거부되면 기존 비밀번호가 그대로여야 함");
    }

    // B. 재설정용 인증번호로 얻은 티켓은 가입에 쓸 수 없다
    @Test
    void resetTicketCannotCompleteSignup() throws Exception {
        String email = "purpose-b-" + UUID.randomUUID() + "@example.com";
        emailVerificationCache.put(EmailVerificationPurpose.RESET_PASSWORD.keyOf(email), CODE);
        String ticket = confirmCode(email, EmailVerificationPurpose.RESET_PASSWORD);

        Map<String, Object> agreements = new HashMap<>();
        agreements.put("service", true);
        agreements.put("privacy", true);
        agreements.put("marketing", false);
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", RAW_PASSWORD);
        body.put("nickname", uniqueNickname());
        body.put("verificationToken", ticket);
        body.put("agreements", agreements);

        HttpResponse<String> signup = send("POST", "/api/v1/auth/signup", body);

        assertEquals(400, signup.statusCode(), signup.body());
        assertTrue(signup.body().contains("이메일 인증이 필요합니다."), signup.body());
        assertFalse(userRepository.findByEmail(email).isPresent(), "거부되면 계정이 만들어지면 안 됨");
    }

    // C. 티켓은 발급받은 이메일에서만 쓸 수 있다
    @Test
    void ticketIssuedForOneEmailIsRejectedForAnother() throws Exception {
        String issuedFor = "purpose-c1-" + UUID.randomUUID() + "@example.com";
        String otherEmail = "purpose-c2-" + UUID.randomUUID() + "@example.com";
        userRepository.save(new UserEntity(otherEmail, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));
        emailVerificationCache.put(EmailVerificationPurpose.RESET_PASSWORD.keyOf(issuedFor), CODE);
        String ticket = confirmCode(issuedFor, EmailVerificationPurpose.RESET_PASSWORD);

        HttpResponse<String> response = send("PUT", "/api/v1/auth/password", Map.of(
                "email", otherEmail, "password", NEW_PASSWORD, "verificationToken", ticket));

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("이메일 인증이 필요합니다."), response.body());
        assertEquals(200, login(otherEmail, RAW_PASSWORD), "다른 이메일의 비밀번호는 바뀌면 안 됨");
    }

    // 인증번호를 확인해 티켓을 받는다. 확인이 실패하면 테스트가 실패한다.
    private String confirmCode(String email, EmailVerificationPurpose purpose) throws Exception {
        HttpResponse<String> response = send("POST", "/api/v1/auth/email-verification/confirm", Map.of(
                "email", email, "authCode", CODE, "purpose", purpose.name()));
        assertEquals(200, response.statusCode(), response.body());
        return mapper.readTree(response.body()).get("verificationToken").asString();
    }

    private int login(String email, String password) throws Exception {
        return send("POST", "/api/v1/auth/login", Map.of("email", email, "password", password)).statusCode();
    }

    private String uniqueNickname() {
        return "t" + UUID.randomUUID().toString().substring(0, 8);
    }

    private HttpResponse<String> send(String method, String path, Map<String, ?> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
