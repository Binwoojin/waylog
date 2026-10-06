package kr.co.mycom.travel_korea.user;

import tools.jackson.databind.ObjectMapper;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.service.UserService;
import kr.co.mycom.travel_korea.user.service.UserSuspensionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 인증·계정 흐름을 실제 SecurityFilterChain과 임베디드 서버를 통해 HTTP로 검증한다.
 *
 * 기존 UserSuspensionLoginFlowTest / UserWithdrawalFlowTest는 AuthService를 직접 호출하므로
 * 상태 코드, 응답 본문 형식, Set-Cookie, 필터 차단을 프론트가 보는 그대로 확인하지 못한다.
 * 이 테스트는 프론트가 의존하는 HTTP 계약(상태 코드 + { message } / { code } 형식 + 쿠키)을 고정한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class AuthAccountHttpFlowTest {

    private static final String RAW_PASSWORD = "Passw0rd!1";

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JwtConfig jwtConfig;
    @Autowired
    private UserService userService;
    @Autowired
    private UserSuspensionService suspensionService;
    @Autowired
    private ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private String uniqueEmail() {
        return "http-auth-" + UUID.randomUUID().toString().substring(0, 8) + "@test.com";
    }

    private UserEntity createUser(String email) {
        String nickname = "h" + UUID.randomUUID().toString().substring(0, 8);
        return userRepository.save(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), nickname, "user"));
    }

    private HttpResponse<String> postJson(String path, Object body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> postWithHeaders(String path, Map<String, String> headers) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .POST(HttpRequest.BodyPublishers.noBody());
        headers.forEach(builder::header);
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> getWithBearer(String path, String accessToken) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private Map<String, Object> json(HttpResponse<String> response) throws Exception {
        return objectMapper.readValue(response.body(), Map.class);
    }

    private Map<String, String> loginBody(String email, String password) {
        return Map.of("email", email, "password", password);
    }

    // 회귀: 정상 로그인은 200, accessToken 본문, refreshToken HttpOnly 쿠키를 내려준다
    @Test
    void loginSuccessReturnsAccessTokenAndRefreshCookie() throws Exception {
        String email = uniqueEmail();
        createUser(email);

        HttpResponse<String> response = postJson("/api/v1/auth/login", loginBody(email, RAW_PASSWORD));

        assertEquals(200, response.statusCode());
        assertNotNull(json(response).get("accessToken"));
        String setCookie = response.headers().firstValue("Set-Cookie").orElse("");
        assertTrue(setCookie.startsWith("refreshToken="), "refreshToken 쿠키가 있어야 합니다: " + setCookie);
    }

    // 프론트 에러 매핑: 비밀번호 오류는 401 + { message }
    @Test
    void loginWithWrongPasswordReturns401WithMessage() throws Exception {
        String email = uniqueEmail();
        createUser(email);

        HttpResponse<String> response = postJson("/api/v1/auth/login", loginBody(email, "WrongPassword!1"));

        assertEquals(401, response.statusCode());
        assertNotNull(json(response).get("message"));
    }

    // 정지 회원: 403 + code=ACCOUNT_SUSPENDED (프론트가 정지 안내 화면으로 분기)
    @Test
    void suspendedUserLoginReturns403WithAccountSuspendedCode() throws Exception {
        String email = uniqueEmail();
        UserEntity user = createUser(email);
        suspensionService.suspend(user.getId(), 3, "HTTP 테스트 정지");

        HttpResponse<String> response = postJson("/api/v1/auth/login", loginBody(email, RAW_PASSWORD));

        assertEquals(403, response.statusCode());
        Map<String, Object> body = json(response);
        assertEquals("ACCOUNT_SUSPENDED", body.get("code"));
        assertNull(body.get("accessToken"));
    }

    // 탈퇴 회원: 계정 존재를 드러내지 않도록 비밀번호 오류와 같은 401 + 같은 메시지
    @Test
    void withdrawnUserLoginReturnsSameAsWrongPassword() throws Exception {
        String email = uniqueEmail();
        createUser(email);
        userService.withdraw(email, RAW_PASSWORD);

        HttpResponse<String> withdrawn = postJson("/api/v1/auth/login", loginBody(email, RAW_PASSWORD));
        HttpResponse<String> wrongPassword = postJson("/api/v1/auth/login", loginBody(email, "WrongPassword!1"));

        assertEquals(401, withdrawn.statusCode());
        assertEquals(wrongPassword.statusCode(), withdrawn.statusCode());
        assertEquals(json(wrongPassword).get("message"), json(withdrawn).get("message"));
        assertNull(json(withdrawn).get("accessToken"));
    }

    // 회원가입 입력 검증: 빈 본문은 400 + { message } (Spring 기본 오류 형식이 아니어야 함)
    @Test
    void signupWithEmptyBodyReturns400WithMessage() throws Exception {
        HttpResponse<String> response = postJson("/api/v1/auth/signup", Map.of());

        assertEquals(400, response.statusCode());
        Map<String, Object> body = json(response);
        assertNotNull(body.get("message"));
        assertFalse(body.containsKey("timestamp"), "Spring 기본 오류 형식이 노출되면 안 됩니다");
    }

    // refresh: 쿠키가 없으면 401 (프론트가 로그인 화면으로 이동)
    @Test
    void refreshWithoutCookieReturns401() throws Exception {
        HttpResponse<String> response = postWithHeaders("/api/v1/auth/refresh", Map.of());

        assertEquals(401, response.statusCode());
    }

    // refresh: 정상 refresh 쿠키는 200으로 새 accessToken을 받는다
    @Test
    void refreshWithValidCookieReturnsAccessToken() throws Exception {
        String email = uniqueEmail();
        createUser(email);
        JwtConfig.TokenResponse tokens = jwtConfig.createTokenPair(email);

        HttpResponse<String> response = postWithHeaders("/api/v1/auth/refresh",
                Map.of("Cookie", "refreshToken=" + tokens.refreshToken()));

        assertEquals(200, response.statusCode());
        assertNotNull(json(response).get("accessToken"));
    }

    // refresh: 정지 중인 회원은 유효한 refresh 쿠키여도 401
    @Test
    void suspendedUserRefreshWithCookieReturns401() throws Exception {
        String email = uniqueEmail();
        UserEntity user = createUser(email);
        JwtConfig.TokenResponse tokens = jwtConfig.createTokenPair(email);
        suspensionService.suspend(user.getId(), 3, "HTTP 테스트 정지");

        HttpResponse<String> response = postWithHeaders("/api/v1/auth/refresh",
                Map.of("Cookie", "refreshToken=" + tokens.refreshToken()));

        assertEquals(401, response.statusCode());
    }

    // 탈퇴 적용 이전에 발급된 Access Token은 보호 API에서 401 (필터 차단이 실제 HTTP에서도 동작)
    @Test
    void withdrawnUserAccessTokenIsRejectedOnProtectedApi() throws Exception {
        String email = uniqueEmail();
        createUser(email);
        String accessToken = jwtConfig.createAccessToken(email);
        userService.withdraw(email, RAW_PASSWORD);

        HttpResponse<String> response = getWithBearer("/api/v1/feed/bookmarks", accessToken);

        assertEquals(401, response.statusCode());
    }

    // 정지 적용 이전에 발급된 Access Token도 보호 API에서 401
    @Test
    void suspendedUserAccessTokenIsRejectedOnProtectedApi() throws Exception {
        String email = uniqueEmail();
        UserEntity user = createUser(email);
        String accessToken = jwtConfig.createAccessToken(email);
        suspensionService.suspend(user.getId(), 3, "HTTP 테스트 정지");

        HttpResponse<String> response = getWithBearer("/api/v1/feed/bookmarks", accessToken);

        assertEquals(401, response.statusCode());
    }
}
