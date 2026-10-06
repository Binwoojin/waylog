package kr.co.mycom.travel_korea.tour.bookmark;

import tools.jackson.databind.ObjectMapper;
import kr.co.mycom.travel_korea.config.JwtConfig;
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
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 투어 북마크 토글/목록 API의 HTTP 계약을 검증한다.
 *
 * 프론트 카드의 북마크 버튼은 토글 응답의 active 값으로 상태를 바꾸므로
 * 같은 요청을 두 번 보냈을 때 저장/해제가 번갈아 일어나는지, 비로그인 요청이 401로
 * 떨어지는지를 실제 HTTP로 고정한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class TourBookmarkHttpFlowTest {

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
    private ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private String createUserAndToken() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "http-bookmark-" + suffix + "@test.com";
        userRepository.save(new UserEntity(email, passwordEncoder.encode(RAW_PASSWORD), "b" + suffix, "user"));
        return jwtConfig.createAccessToken(email);
    }

    private HttpResponse<String> toggle(String accessToken, String contentId) throws Exception {
        Map<String, Object> body = Map.of(
                "contentId", contentId,
                "contentTypeId", 12,
                "title", "HTTP 북마크 테스트",
                "address", "서울특별시"
        );
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/v1/tour-bookmarks/toggle"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
        if (accessToken != null) {
            builder.header("Authorization", "Bearer " + accessToken);
        }
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    // 비로그인 토글은 401 (보호 API)
    @Test
    void toggleWithoutTokenReturns401() throws Exception {
        HttpResponse<String> response = toggle(null, "999000001");

        assertEquals(401, response.statusCode());
    }

    // 같은 콘텐츠를 두 번 토글하면 active가 true -> false로 바뀌어야 한다
    @Test
    void toggleTwiceSavesThenRemovesBookmark() throws Exception {
        String token = createUserAndToken();

        HttpResponse<String> first = toggle(token, "999000002");
        HttpResponse<String> second = toggle(token, "999000002");

        assertEquals(200, first.statusCode());
        assertEquals(200, second.statusCode());
        assertTrue(objectMapper.readTree(first.body()).get("active").asBoolean());
        assertFalse(objectMapper.readTree(second.body()).get("active").asBoolean());
    }

    // 잘못된 요청(contentId 누락)은 400 + { message }
    @Test
    void toggleWithoutContentIdReturns400WithMessage() throws Exception {
        String token = createUserAndToken();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/v1/tour-bookmarks/toggle"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString("{\"contentTypeId\":12,\"title\":\"x\"}"))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(400, response.statusCode());
        assertNotNull(objectMapper.readTree(response.body()).get("message"));
    }

    // 목록 조회: 로그인 사용자는 200 페이지 응답을 받는다
    @Test
    void listBookmarksForLoggedInUserReturnsPage() throws Exception {
        String token = createUserAndToken();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/v1/tour-bookmarks?group=DESTINATION&page=1&size=9"))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode());
        assertTrue(objectMapper.readTree(response.body()).has("content"));
    }
}
