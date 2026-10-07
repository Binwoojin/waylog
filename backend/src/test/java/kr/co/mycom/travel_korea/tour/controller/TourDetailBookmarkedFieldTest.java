package kr.co.mycom.travel_korea.tour.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmark;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmarkGroup;
import kr.co.mycom.travel_korea.tour.bookmark.repository.TourBookmarkRepository;
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
 * mypage-bookmarks 후속 과제 — 여행지 상세 조회(GET /api/v1/tour/contents/{contentId})가
 * 응답에 bookmarked 필드를 내려주는지 실제 HTTP 요청으로 확인한다.
 *
 * SecurityConfigFeedProfileAccessTest와 같은 방식(임베디드 서버 + JDK 내장 HttpClient)을
 * 그대로 재사용한다(설계 원칙 "새 의존성 금지"로 MockMvc 대신 이 방식을 쓴다).
 *
 * local-mock 프로필의 contentId=126508(contentTypeId=12, 경복궁)을 사용한다.
 *
 * 핵심 회귀 포인트: TourDetailService.getDetail()은 @Cacheable(tourLists)로 사용자 구분 없이
 * 캐시되므로, 같은 콘텐츠를 여러 사용자가 연이어 조회해도 서로의 북마크 여부가 섞이면 안 된다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class TourDetailBookmarkedFieldTest {

    private static final String CONTENT_ID = "126508";
    private static final int CONTENT_TYPE_ID = 12;

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private TourBookmarkRepository tourBookmarkRepository;
    @Autowired
    private JwtConfig jwtConfig;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private UserEntity createUser(String email, String nickname) {
        return userRepository.save(new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user"));
    }

    private void bookmark(UserEntity user, String contentId, Integer contentTypeId) {
        tourBookmarkRepository.save(new TourBookmark(
                user, contentId, contentTypeId, "경복궁", null, null, null, TourBookmarkGroup.DESTINATION
        ));
    }

    private JsonNode getDetail(String bearerToken) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port
                        + "/api/v1/tour/contents/" + CONTENT_ID + "?contentTypeId=" + CONTENT_TYPE_ID))
                .GET();

        if (bearerToken != null) {
            builder.header("Authorization", "Bearer " + bearerToken);
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(), response.body());

        return objectMapper.readTree(response.body());
    }

    // 비로그인 사용자는 bookmarked=false로 응답받아야 한다.
    @Test
    void anonymousUserSeesBookmarkedFalse() throws Exception {
        JsonNode detail = getDetail(null);

        assertFalse(detail.get("bookmarked").asBoolean());
    }

    // 북마크하지 않은 로그인 사용자도 bookmarked=false여야 한다.
    @Test
    void loggedInUserWithoutBookmarkSeesFalse() throws Exception {
        UserEntity user = createUser("detail-http-no-bookmark@test.com", "상세HTTP미북마크");
        String token = jwtConfig.createAccessToken(user.getEmail());

        JsonNode detail = getDetail(token);

        assertFalse(detail.get("bookmarked").asBoolean());
    }

    // 이 콘텐츠를 북마크한 로그인 사용자는 bookmarked=true여야 한다.
    @Test
    void loggedInUserWithBookmarkSeesTrue() throws Exception {
        UserEntity user = createUser("detail-http-bookmarked@test.com", "상세HTTP북마크");
        bookmark(user, CONTENT_ID, CONTENT_TYPE_ID);
        String token = jwtConfig.createAccessToken(user.getEmail());

        JsonNode detail = getDetail(token);

        assertTrue(detail.get("bookmarked").asBoolean());
    }

    // 핵심 회귀: 같은 콘텐츠의 상세 응답은 캐시되므로(tourLists), 북마크한 사용자가 먼저 조회해도
    // 그 뒤에 조회하는 다른 사용자·비로그인 사용자에게 bookmarked=true가 새어 나가면 안 된다.
    @Test
    void bookmarkedFlagDoesNotLeakAcrossUsersViaCache() throws Exception {
        UserEntity owner = createUser("detail-cache-owner@test.com", "상세캐시소유자");
        bookmark(owner, CONTENT_ID, CONTENT_TYPE_ID);
        String ownerToken = jwtConfig.createAccessToken(owner.getEmail());

        // 1. 북마크한 사용자가 먼저 조회해 캐시를 채운다.
        JsonNode ownerView = getDetail(ownerToken);
        assertTrue(ownerView.get("bookmarked").asBoolean());

        // 2. 같은 콘텐츠를 비로그인으로 다시 조회해도 false여야 한다(캐시 공유로 인한 정보 유출 금지).
        JsonNode anonymousView = getDetail(null);
        assertFalse(anonymousView.get("bookmarked").asBoolean());

        // 3. 북마크하지 않은 다른 로그인 사용자가 조회해도 false여야 한다.
        UserEntity other = createUser("detail-cache-other@test.com", "상세캐시타인");
        String otherToken = jwtConfig.createAccessToken(other.getEmail());
        JsonNode otherView = getDetail(otherToken);
        assertFalse(otherView.get("bookmarked").asBoolean());
    }
}
