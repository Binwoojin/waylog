package kr.co.mycom.travel_korea.user;

import com.github.benmanes.caffeine.cache.Cache;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
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
 * 인증 티켓의 용도(가입 vs 비밀번호 재설정) 정책을 현재 코드 기준으로 고정하는 테스트입니다.
 *
 * 확인된 사실 (AuthController·AuthService):
 * - POST /auth/email-verification 과 POST /auth/password-reset-requests 는 둘 다 sendCodeToEmail(email)을 호출합니다.
 *   발급되는 인증번호는 용도 없이 emailVerificationCache(email → 코드)에 저장됩니다.
 * - POST /auth/email-verification/confirm 은 용도 없이 emailVerificationTicketCache(email → 티켓)에 저장합니다.
 * - signup 과 PUT /auth/password 는 둘 다 같은 티켓을 consumeVerificationTicket 으로 소모합니다. 용도를 확인하지 않습니다.
 * - 가입 흐름은 계정 존재 여부를 발급 단계에서 확인하지 않고, 재설정 흐름은 계정 존재 여부를 최종 변경 단계에서 확인합니다.
 *
 * 따라서 테스트는 "현재 정책이 무엇을 허용하는가"를 기록합니다.
 * 용도 분리(purpose binding)를 구현하면 아래 A·B 테스트는 실패하도록 바뀌며, 그때 기대값을 거부로 고쳐야 합니다.
 *
 * 인증번호는 테스트에서 메일 발송 대신 emailVerificationCache에 직접 넣습니다. 두 발급 엔드포인트가 같은 캐시를 쓰므로 같은 상태가 됩니다.
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
    @Autowired
    private Cache<String, String> emailVerificationTicketCache;

    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    // A. 가입 흐름으로 발급된 인증번호로 기존 계정의 비밀번호를 바꿀 수 있는가 (현재 정책: 가능)
    @Test
    void signupIssuedCodeCanChangePasswordOfExistingAccount() throws Exception {
        String email = "purpose-a-" + UUID.randomUUID() + "@example.com";
        userRepository.save(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));

        // /email-verification 으로 발급된 코드를 흉내 낸다(같은 sendCodeToEmail 경로)
        emailVerificationCache.put(email, CODE);
        String ticket = confirmCode(email);

        HttpResponse<String> changed = send("PUT", "/api/v1/auth/password", Map.of(
                "email", email, "password", NEW_PASSWORD, "verificationToken", ticket));

        assertEquals(200, changed.statusCode(), "현재 정책: 가입용 티켓이 비밀번호 변경에 쓰일 수 있음. " + changed.body());
        assertTrue(login(email, NEW_PASSWORD) == 200, "변경된 비밀번호로 로그인되어야 함");
    }

    // B. 재설정 흐름으로 발급된 인증번호로 가입을 완료할 수 있는가 (현재 정책: 가능, 계정이 없을 때)
    @Test
    void resetIssuedCodeCanCompleteSignupForUnregisteredEmail() throws Exception {
        String email = "purpose-b-" + UUID.randomUUID() + "@example.com";

        // /password-reset-requests 로 발급된 코드를 흉내 낸다(같은 sendCodeToEmail 경로)
        emailVerificationCache.put(email, CODE);
        String ticket = confirmCode(email);

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

        assertEquals(200, signup.statusCode(), "현재 정책: 재설정용 티켓이 가입에 쓰일 수 있음. " + signup.body());
        assertTrue(userRepository.findByEmail(email).isPresent());
    }

    // C. 티켓은 발급받은 이메일에서만 쓸 수 있다 (현재 정책: 이메일 불일치는 거부)
    @Test
    void ticketIssuedForOneEmailIsRejectedForAnother() throws Exception {
        String issuedFor = "purpose-c1-" + UUID.randomUUID() + "@example.com";
        String otherEmail = "purpose-c2-" + UUID.randomUUID() + "@example.com";
        userRepository.save(new UserEntity(otherEmail, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));

        emailVerificationCache.put(issuedFor, CODE);
        String ticket = confirmCode(issuedFor);

        HttpResponse<String> response = send("PUT", "/api/v1/auth/password", Map.of(
                "email", otherEmail, "password", NEW_PASSWORD, "verificationToken", ticket));

        assertEquals(400, response.statusCode(), response.body());
        assertTrue(response.body().contains("이메일 인증이 필요합니다."), response.body());
        assertEquals(200, login(otherEmail, RAW_PASSWORD), "다른 이메일의 비밀번호는 바뀌면 안 됨");
    }

    // 인증번호 확인 후 티켓을 돌려받는다. 확인이 실패하면 테스트가 실패한다.
    private String confirmCode(String email) throws Exception {
        HttpResponse<String> response = send("POST", "/api/v1/auth/email-verification/confirm", Map.of(
                "email", email, "authCode", CODE));
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
