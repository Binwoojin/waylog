package kr.co.mycom.travel_korea.config;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
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

import static org.junit.jupiter.api.Assertions.*;

/**
 * feed-integration 설계 §4.4(P-6) 후속 — SecurityConfig 인가 설정 회귀 테스트.
 *
 * GET /api/v1/feed/profile/{userId}(타인 프로필 조회)는 비로그인도 접근 가능한 공개 API여야
 * 하는데, SecurityConfig에 permitAll 규칙이 빠져 있어 401이 나는 문제가 있었다. 이 규칙은
 * MockMvc 없이는(설계 §11 "새 의존성 금지") 검증할 수 없는, 실제 SecurityFilterChain을
 * 통과해야만 확인되는 동작이라 임베디드 서버를 띄우고 JDK 내장 java.net.http.HttpClient로
 * 실제 HTTP 요청을 보내 검증한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class SecurityConfigFeedProfileAccessTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private HttpResponse<String> getWithoutAuth(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    // 회귀 확인: 내 프로필 조회는 여전히 비로그인 접근 시 401이어야 한다
    @Test
    void myProfileWithoutAuthReturns401() throws Exception {
        HttpResponse<String> response = getWithoutAuth("/api/v1/feed/profile");

        assertEquals(401, response.statusCode());
    }

    // 수정 확인: 타인 프로필 조회는 비로그인 접근이 허용되어 401이 아니어야 한다
    @Test
    void otherUserProfileWithoutAuthIsNotUnauthorized() throws Exception {
        UserEntity user = userRepository.save(
                new UserEntity("security-profile-check@test.com", passwordEncoder.encode("Passw0rd!1"), "보안테스트유저", "user")
        );

        HttpResponse<String> response = getWithoutAuth("/api/v1/feed/profile/" + user.getId());

        assertNotEquals(401, response.statusCode());
        assertEquals(200, response.statusCode());
    }

    // 존재하지 않는 userId라도 인가 단계는 통과해(401이 아니어야) 컨트롤러까지 도달해야 한다
    @Test
    void nonExistentUserProfileWithoutAuthIsNotUnauthorized() throws Exception {
        HttpResponse<String> response = getWithoutAuth("/api/v1/feed/profile/999999999");

        assertNotEquals(401, response.statusCode());
    }
}
