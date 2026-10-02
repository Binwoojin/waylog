package kr.co.mycom.travel_korea.tour.bookmark;

import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmark;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmarkGroup;
import kr.co.mycom.travel_korea.tour.bookmark.repository.TourBookmarkRepository;
import kr.co.mycom.travel_korea.tour.bookmark.service.TourBookmarkService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * mypage-bookmarks 후속 과제 — 여행지/여행 즐기기 상세·목록 화면이 진입 시점에 기존 북마크
 * 여부를 즉시 보여주기 위한 TourBookmarkService.isBookmarked/findBookmarkedKeys 회귀 테스트.
 *
 * FeedBookmarkServiceTest와 같은 스타일로 MockMvc 없이 서비스와 리포지토리를 직접 호출한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class TourBookmarkPersonalizationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private TourBookmarkRepository tourBookmarkRepository;
    @Autowired
    private TourBookmarkService tourBookmarkService;

    private UserEntity createUser(String email, String nickname) {
        return userRepository.save(new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user"));
    }

    private void bookmark(UserEntity user, String contentId, Integer contentTypeId) {
        tourBookmarkRepository.save(new TourBookmark(
                user, contentId, contentTypeId, "테스트 콘텐츠", null, null, null, TourBookmarkGroup.DESTINATION
        ));
    }

    // 상세 화면: 로그인 사용자가 북마크한 콘텐츠는 true여야 한다.
    @Test
    void isBookmarkedReturnsTrueForBookmarkedContent() {
        UserEntity user = createUser("detail-bookmarked@test.com", "상세북마크유저");
        bookmark(user, "126508", 12);

        assertTrue(tourBookmarkService.isBookmarked(user.getEmail(), "126508", 12));
    }

    // 상세 화면: 로그인 사용자라도 북마크하지 않은 콘텐츠는 false여야 한다.
    @Test
    void isBookmarkedReturnsFalseForNotBookmarkedContent() {
        UserEntity user = createUser("detail-not-bookmarked@test.com", "상세미북마크유저");

        assertFalse(tourBookmarkService.isBookmarked(user.getEmail(), "126508", 12));
    }

    // 상세 화면: 비로그인(이메일 없음)은 항상 false여야 한다. 상세 조회 자체는 인증 없이도 가능해야 한다.
    @Test
    void isBookmarkedReturnsFalseForAnonymous() {
        assertFalse(tourBookmarkService.isBookmarked(null, "126508", 12));
        assertFalse(tourBookmarkService.isBookmarked("", "126508", 12));
    }

    // 목록 화면: 여러 콘텐츠 중 북마크한 것만 키 집합에 포함되어야 한다(배치 조회, N+1 방지).
    @Test
    void findBookmarkedKeysReturnsOnlyBookmarkedContentIds() {
        UserEntity user = createUser("list-bookmarked@test.com", "목록북마크유저");
        bookmark(user, "126508", 12);
        bookmark(user, "125476", 12);
        // "126485"는 의도적으로 북마크하지 않는다.

        Set<String> keys = tourBookmarkService.findBookmarkedKeys(
                user.getEmail(), List.of("126508", "126485", "125476")
        );

        assertTrue(keys.contains(TourBookmarkService.bookmarkKey("126508", 12)));
        assertTrue(keys.contains(TourBookmarkService.bookmarkKey("125476", 12)));
        assertFalse(keys.contains(TourBookmarkService.bookmarkKey("126485", 12)));
    }

    // 목록 화면: 비로그인이거나 조회할 콘텐츠가 없으면 빈 집합을 돌려줘야 한다.
    @Test
    void findBookmarkedKeysReturnsEmptyForAnonymousOrEmptyInput() {
        UserEntity user = createUser("list-empty@test.com", "목록빈값유저");
        bookmark(user, "126508", 12);

        assertEquals(Set.of(), tourBookmarkService.findBookmarkedKeys(null, List.of("126508")));
        assertEquals(Set.of(), tourBookmarkService.findBookmarkedKeys(user.getEmail(), List.of()));
    }

    // 다른 사용자의 북마크가 섞여 있어도 내 북마크 여부만 반영되어야 한다(사용자 간 격리 확인).
    @Test
    void findBookmarkedKeysDoesNotLeakOtherUsersBookmarks() {
        UserEntity owner = createUser("list-owner@test.com", "목록소유자");
        UserEntity other = createUser("list-other@test.com", "목록타인");
        bookmark(owner, "126508", 12);

        Set<String> keysForOther = tourBookmarkService.findBookmarkedKeys(
                other.getEmail(), List.of("126508")
        );

        assertTrue(keysForOther.isEmpty());
    }
}
