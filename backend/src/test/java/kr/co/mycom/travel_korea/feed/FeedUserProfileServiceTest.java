package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedProfileService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * feed-integration 설계 §4.4(P-6) — 타인 프로필 조회 회귀 테스트.
 *
 * FeedAdminServiceTest와 같은 스타일로 MockMvc 없이 서비스와 리포지토리를 직접 호출한다.
 * 매 테스트마다 새 사용자를 생성해 다른 테스트가 만든 게시물과 섞이지 않게 한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedUserProfileServiceTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedProfileService feedProfileService;

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user");
        return userRepository.save(user);
    }

    private FeedPost createPost(UserEntity author, String content, String visibility) {
        FeedPost post = new FeedPost(author, content, null, null, null, null, null, null, visibility);
        return feedPostRepository.save(post);
    }

    // 타인 프로필은 그 사용자의 PUBLIC 게시물만 노출하고, PRIVATE 게시물은 숨긴다.
    @Test
    void onlyPublicPostsAreExposedInUserProfile() {
        UserEntity target = createUser("feed-profile-target1@test.com", "대상회원1");
        FeedPost publicPost = createPost(target, "공개 게시물", "PUBLIC");
        FeedPost privatePost = createPost(target, "비공개 게시물", "PRIVATE");

        FeedProfileResponse response = feedProfileService.getUserProfile(target.getId(), 1, 50);

        assertTrue(response.posts().stream().anyMatch(p -> p.id().equals(publicPost.getId())));
        assertTrue(response.posts().stream().noneMatch(p -> p.id().equals(privatePost.getId())));
        // 이 사용자는 이번 테스트에서 새로 만들어졌으므로 PUBLIC 게시물 수가 정확히 1건이어야 한다.
        assertEquals(1L, response.postCount());
    }

    // liked/bookmarked는 조회자와 무관하게 항상 false로 고정된다(설계 §4.4 노출 범위 결정).
    @Test
    void likedAndBookmarkedAreAlwaysFalse() {
        UserEntity target = createUser("feed-profile-target2@test.com", "대상회원2");
        createPost(target, "좋아요 여부 확인용 글", "PUBLIC");

        FeedProfileResponse response = feedProfileService.getUserProfile(target.getId(), 1, 50);

        assertFalse(response.posts().isEmpty());
        response.posts().forEach(post -> {
            assertFalse(post.liked());
            assertFalse(post.bookmarked());
        });
    }

    // 아직 SNS 프로필(FeedProfile)이 없는 회원이라도 최초 조회 시 자동 생성되어야 한다(기존 getMyProfile과 동일한 동작).
    @Test
    void createsFeedProfileOnFirstViewIfMissing() {
        UserEntity target = createUser("feed-profile-target3@test.com", "대상회원3");

        FeedProfileResponse response = feedProfileService.getUserProfile(target.getId(), 1, 50);

        assertNotNull(response.feedHandle());
        assertTrue(response.feedHandle().startsWith("travel_"));
        assertEquals(0L, response.postCount());
    }

    // 존재하지 않는 회원 id를 조회하면 400(IllegalArgumentException)으로 막혀야 한다.
    @Test
    void unknownUserIdThrows() {
        assertThrows(IllegalArgumentException.class, () -> feedProfileService.getUserProfile(Long.MAX_VALUE, 1, 50));
    }
}
