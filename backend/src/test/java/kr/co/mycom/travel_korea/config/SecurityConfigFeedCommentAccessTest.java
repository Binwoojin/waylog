package kr.co.mycom.travel_korea.config;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
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
 * feed-comment-integration 설계 §4.4(D-5) 실제 검증 — SecurityConfig를 한 줄도 수정하지
 * 않고도 댓글 API의 인가 동작이 설계대로인지 실제 HTTP 요청으로 확인한다.
 *
 * SecurityConfigFeedProfileAccessTest와 동일하게 임베디드 서버(RANDOM_PORT)를 띄우고
 * JDK 내장 java.net.http.HttpClient로 실제 SecurityFilterChain을 통과시킨다(설계 §11
 * "새 의존성 금지"로 MockMvc 대신 이 방식을 그대로 재사용).
 *
 * 계획 §6.3, 설계 §4.4가 요구하는 검증 항목:
 *   1) 비로그인 GET .../comments → 200 (기존 "/api/v1/feed/posts/**" GET permitAll에 포함됨)
 *   2) 비로그인 POST .../comments → 401 (anyRequest().authenticated())
 *   3) 비로그인 DELETE .../comments/{id} → 401 (anyRequest().authenticated())
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class SecurityConfigFeedCommentAccessTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private FeedPost createPost() {
        UserEntity author = userRepository.save(
                new UserEntity("security-comment-check@test.com", passwordEncoder.encode("Passw0rd!1"), "보안댓글테스트유저", "user")
        );
        return feedPostRepository.save(new FeedPost(author, "보안 검증용 게시물", null, null, null, null, null, null, "PUBLIC"));
    }

    private HttpResponse<String> getWithoutAuth(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> postWithoutAuth(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"content\":\"비로그인 시도\"}"))
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> deleteWithoutAuth(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + path))
                .DELETE()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    // 댓글 목록 조회는 기존 GET permitAll 규칙에 이미 포함되어 비로그인도 200이어야 한다.
    @Test
    void listCommentsWithoutAuthReturns200() throws Exception {
        FeedPost post = createPost();

        HttpResponse<String> response = getWithoutAuth("/api/v1/feed/posts/" + post.getId() + "/comments");

        assertEquals(200, response.statusCode());
    }

    // 댓글 작성은 인증이 필요하므로 비로그인 요청은 401이어야 한다.
    @Test
    void createCommentWithoutAuthReturns401() throws Exception {
        FeedPost post = createPost();

        HttpResponse<String> response = postWithoutAuth("/api/v1/feed/posts/" + post.getId() + "/comments");

        assertEquals(401, response.statusCode());
    }

    // 댓글 삭제도 인증이 필요하므로 비로그인 요청은 401이어야 한다(댓글 존재 여부와 무관하게
    // 인가 단계에서 먼저 막혀야 한다).
    @Test
    void deleteCommentWithoutAuthReturns401() throws Exception {
        FeedPost post = createPost();

        HttpResponse<String> response = deleteWithoutAuth("/api/v1/feed/posts/" + post.getId() + "/comments/999999999");

        assertEquals(401, response.statusCode());
    }
}
