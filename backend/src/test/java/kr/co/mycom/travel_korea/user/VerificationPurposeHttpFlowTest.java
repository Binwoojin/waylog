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
 * 같은 용도의 정상 흐름, 용도별 캐시 분리, 재사용 거부, 확인 실패 제한을 확인합니다.
 * 인증번호는 메일로 보내지 않고 용도 키로 캐시에 직접 넣습니다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class VerificationPurposeHttpFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";
    private static final String NEW_PASSWORD = "NewPassw0rd!2";

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

    @Test
    void sameEmailSamePurposeResetFlowChangesPassword() throws Exception {
        String email = uniqueEmail("reset-ok");
        userRepository.save(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));
        emailVerificationCache.put(EmailVerificationPurpose.RESET_PASSWORD.keyOf(email), 654321);
        String ticket = confirm(email, 654321, EmailVerificationPurpose.RESET_PASSWORD);

        HttpResponse<String> changed = send("PUT", "/api/v1/auth/password", Map.of(
                "email", email, "password", NEW_PASSWORD, "verificationToken", ticket));

        assertEquals(200, changed.statusCode(), changed.body());
        assertEquals(200, login(email, NEW_PASSWORD));
    }

    @Test
    void sameEmailSamePurposeSignupFlowCreatesAccount() throws Exception {
        String email = uniqueEmail("signup-ok");
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), 111222);
        String ticket = confirm(email, 111222, EmailVerificationPurpose.SIGNUP);

        HttpResponse<String> signup = send("POST", "/api/v1/auth/signup", signupBody(email, ticket));

        assertEquals(200, signup.statusCode(), signup.body());
        assertTrue(userRepository.findByEmail(email).isPresent());
    }

    @Test
    void issuingOneFlowDoesNotOverwriteTheOther() throws Exception {
        String email = uniqueEmail("no-overwrite");
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), 100001);
        emailVerificationCache.put(EmailVerificationPurpose.RESET_PASSWORD.keyOf(email), 200002);

        // 재설정 코드를 나중에 발급해도 가입 코드는 그대로 확인되어야 한다
        assertNotNull(confirm(email, 100001, EmailVerificationPurpose.SIGNUP));
        assertNotNull(confirm(email, 200002, EmailVerificationPurpose.RESET_PASSWORD));
    }

    @Test
    void ticketCannotBeReusedAfterSuccess() throws Exception {
        String email = uniqueEmail("reuse");
        userRepository.save(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), uniqueNickname(), "user"));
        emailVerificationCache.put(EmailVerificationPurpose.RESET_PASSWORD.keyOf(email), 333444);
        String ticket = confirm(email, 333444, EmailVerificationPurpose.RESET_PASSWORD);
        assertEquals(200, send("PUT", "/api/v1/auth/password", Map.of(
                "email", email, "password", NEW_PASSWORD, "verificationToken", ticket)).statusCode());

        HttpResponse<String> second = send("PUT", "/api/v1/auth/password", Map.of(
                "email", email, "password", "Another1!Pass", "verificationToken", ticket));

        assertEquals(400, second.statusCode(), second.body());
        assertTrue(second.body().contains("이메일 인증이 필요합니다."), second.body());
    }

    @Test
    void purposeIsRequiredAndMustBeKnown() throws Exception {
        String email = uniqueEmail("purpose-missing");
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), 555666);

        HttpResponse<String> missing = send("POST", "/api/v1/auth/email-verification/confirm",
                Map.of("email", email, "authCode", 555666));
        assertEquals(400, missing.statusCode(), missing.body());
        assertTrue(missing.body().contains("인증 용도를 확인해 주세요."), missing.body());

        HttpResponse<String> unknown = send("POST", "/api/v1/auth/email-verification/confirm",
                Map.of("email", email, "authCode", 555666, "purpose", "OTHER"));
        assertEquals(400, unknown.statusCode(), unknown.body());
        assertTrue(unknown.body().contains("인증 용도를 확인해 주세요."), unknown.body());
    }

    @Test
    void wrongCodeIsUnauthorizedAndFifthFailureBlocksEvenTheRightCode() throws Exception {
        String email = uniqueEmail("attempts");
        emailVerificationCache.put(EmailVerificationPurpose.SIGNUP.keyOf(email), 777888);

        for (int i = 0; i < 5; i++) {
            HttpResponse<String> wrong = send("POST", "/api/v1/auth/email-verification/confirm",
                    Map.of("email", email, "authCode", 100000, "purpose", "SIGNUP"));
            assertEquals(401, wrong.statusCode(), "틀린 인증번호 " + (i + 1) + "회차");
        }

        HttpResponse<String> blocked = send("POST", "/api/v1/auth/email-verification/confirm",
                Map.of("email", email, "authCode", 777888, "purpose", "SIGNUP"));
        assertEquals(429, blocked.statusCode(), blocked.body());
        assertTrue(blocked.body().contains("인증 시도 횟수를 초과했습니다."), blocked.body());
    }

    private String confirm(String email, int code, EmailVerificationPurpose purpose) throws Exception {
        HttpResponse<String> response = send("POST", "/api/v1/auth/email-verification/confirm",
                Map.of("email", email, "authCode", code, "purpose", purpose.name()));
        assertEquals(200, response.statusCode(), response.body());
        return mapper.readTree(response.body()).get("verificationToken").asString();
    }

    private Map<String, Object> signupBody(String email, String ticket) {
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
        return body;
    }

    private int login(String email, String password) throws Exception {
        return send("POST", "/api/v1/auth/login", Map.of("email", email, "password", password)).statusCode();
    }

    private String uniqueEmail(String tag) {
        return "vp-" + tag + "-" + UUID.randomUUID() + "@example.com";
    }

    private String uniqueNickname() {
        return "v" + UUID.randomUUID().toString().substring(0, 8);
    }

    private HttpResponse<String> send(String method, String path, Map<String, ?> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
