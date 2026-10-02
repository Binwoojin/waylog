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
import java.util.stream.StreamSupport;

import static org.junit.jupiter.api.Assertions.*;

/**
 * mypage-bookmarks 후속 과제 — 목록 조회(GET /api/v1/search)의 각 항목에 bookmarked 필드가
 * 배치 조회로 채워지는지, 그리고 TourService.getTours()의 캐시를 거쳐도 사용자 간에 섞이지
 * 않는지 실제 HTTP 요청으로 확인한다.
 *
 * EnjoyCategoryPage.jsx는 현재 목업 데이터만 사용하고 실제 목록 API를 호출하지 않는다(조사
 * 결과). 그래서 이 테스트는 실제로 TourSummaryResponse를 쓰는 /api/v1/search(관광지·문화시설
 * 목록, DestinationSearchResultsPage.jsx 등이 사용)를 검증 대상으로 삼는다.
 *
 * local-mock 프로필의 contentTypeId=12(관광지) 목록에는 126508(경복궁)이 포함된다
 * (MockTourApiClient.ATTRACTION_ITEMS 맨 앞 3건 중 하나).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "local-mock"})
class TourSearchBookmarkedFieldTest {

    private static final String BOOKMARKED_CONTENT_ID = "126508";
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

    private JsonNode search(String bearerToken) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                // size=23: local-mock의 관광지(12) 23건을 한 페이지에 모두 받아
                // 126508이 결과에 포함된다고 가정하지 않고 직접 확인할 수 있게 한다.
                .uri(URI.create("http://localhost:" + port
                        + "/api/v1/search?contentTypeId=" + CONTENT_TYPE_ID + "&page=1&size=23"))
                .GET();

        if (bearerToken != null) {
            builder.header("Authorization", "Bearer " + bearerToken);
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, response.statusCode(), response.body());

        return objectMapper.readTree(response.body());
    }

    private boolean bookmarkedFlagFor(JsonNode searchResponse, String contentId) {
        JsonNode items = searchResponse.get("items");
        return StreamSupport.stream(items.spliterator(), false)
                .filter(item -> contentId.equals(item.get("contentId").asText()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("목록에서 contentId=" + contentId + "를 찾지 못했습니다."))
                .get("bookmarked")
                .asBoolean();
    }

    // 비로그인 사용자는 모든 항목이 bookmarked=false여야 한다.
    @Test
    void anonymousUserSeesAllItemsNotBookmarked() throws Exception {
        JsonNode response = search(null);

        boolean anyBookmarked = StreamSupport.stream(response.get("items").spliterator(), false)
                .anyMatch(item -> item.get("bookmarked").asBoolean());

        assertFalse(anyBookmarked);
    }

    // 로그인 사용자가 북마크한 항목만 true, 나머지는 false여야 한다(배치 조회 정확성).
    @Test
    void loggedInUserSeesOnlyOwnBookmarkedItemAsTrue() throws Exception {
        UserEntity user = createUser("search-http-bookmarked@test.com", "목록HTTP북마크");
        bookmark(user, BOOKMARKED_CONTENT_ID, CONTENT_TYPE_ID);
        String token = jwtConfig.createAccessToken(user.getEmail());

        JsonNode response = search(token);

        assertTrue(bookmarkedFlagFor(response, BOOKMARKED_CONTENT_ID));

        // 목업 목록의 다른 두 기존 항목(125476, 126485)은 북마크하지 않았으므로 false여야 한다.
        assertFalse(bookmarkedFlagFor(response, "125476"));
        assertFalse(bookmarkedFlagFor(response, "126485"));
    }

    // 핵심 회귀: TourService.getTours()는 @Cacheable(tourLists)로 캐시되므로, 먼저 조회한
    // 사용자의 북마크 여부가 캐시를 통해 이후 조회하는 다른 사용자·비로그인 사용자에게
    // 새어 나가면 안 된다.
    @Test
    void bookmarkedFlagDoesNotLeakAcrossUsersViaCache() throws Exception {
        UserEntity owner = createUser("search-cache-owner@test.com", "목록캐시소유자");
        bookmark(owner, BOOKMARKED_CONTENT_ID, CONTENT_TYPE_ID);
        String ownerToken = jwtConfig.createAccessToken(owner.getEmail());

        // 1. 북마크한 사용자가 먼저 조회해 캐시를 채운다.
        JsonNode ownerView = search(ownerToken);
        assertTrue(bookmarkedFlagFor(ownerView, BOOKMARKED_CONTENT_ID));

        // 2. 비로그인으로 다시 조회하면 false여야 한다.
        JsonNode anonymousView = search(null);
        assertFalse(bookmarkedFlagFor(anonymousView, BOOKMARKED_CONTENT_ID));

        // 3. 북마크하지 않은 다른 로그인 사용자가 조회해도 false여야 한다.
        UserEntity other = createUser("search-cache-other@test.com", "목록캐시타인");
        String otherToken = jwtConfig.createAccessToken(other.getEmail());
        JsonNode otherView = search(otherToken);
        assertFalse(bookmarkedFlagFor(otherView, BOOKMARKED_CONTENT_ID));
    }
}
