package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.feed.domain.FeedBookMark;
import kr.co.mycom.travel_korea.feed.domain.FeedLike;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedBookmarkPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedPostResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedBookMarkRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedLikeRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * mypage-bookmarks 설계 §4.5(Q-5, Q-7) — 내 피드 북마크 목록 조회(getMyBookmarks) 회귀 테스트.
 *
 * FeedCommentServiceTest와 같은 스타일로 MockMvc 없이 서비스와 리포지토리를 직접 호출한다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedBookmarkServiceTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedBookMarkRepository feedBookMarkRepository;
    @Autowired
    private FeedLikeRepository feedLikeRepository;
    @Autowired
    private FeedService feedService;

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user");
        return userRepository.save(user);
    }

    private FeedPost createPost(UserEntity author, String content) {
        FeedPost post = new FeedPost(author, content, null, null, null, null, null, null, "PUBLIC");
        return feedPostRepository.save(post);
    }

    private void bookmark(FeedPost post, UserEntity user) {
        feedBookMarkRepository.save(new FeedBookMark(post, user));
    }

    // 북마크한 게시물만 북마크한 시각(createdAt) 내림차순으로 조회되어야 한다(Q-7).
    @Test
    void returnsBookmarkedPostsNewestFirst() throws InterruptedException {
        UserEntity author = createUser("bookmark-author1@test.com", "북마크작성자1");
        UserEntity viewer = createUser("bookmark-viewer1@test.com", "북마크뷰어1");

        FeedPost firstPost = createPost(author, "첫 번째로 북마크한 글");
        bookmark(firstPost, viewer);

        // H2 TIMESTAMP 해상도 차이로 생성 시각이 같아지는 것을 피하기 위한 최소 지연.
        Thread.sleep(10);

        FeedPost secondPost = createPost(author, "두 번째로 북마크한 글");
        bookmark(secondPost, viewer);

        FeedPost notBookmarkedPost = createPost(author, "북마크하지 않은 글");

        FeedBookmarkPageResponse response = feedService.getMyBookmarks(viewer.getEmail(), 1, 12);

        List<Long> postIds = response.posts().stream().map(FeedPostResponse::id).toList();

        assertEquals(List.of(secondPost.getId(), firstPost.getId()), postIds);
        assertFalse(postIds.contains(notBookmarkedPost.getId()));
    }

    // 북마크 목록의 게시물은 항상 bookmarked=true로 응답되어야 한다.
    @Test
    void bookmarkedFlagIsAlwaysTrue() {
        UserEntity author = createUser("bookmark-author2@test.com", "북마크작성자2");
        UserEntity viewer = createUser("bookmark-viewer2@test.com", "북마크뷰어2");

        FeedPost post = createPost(author, "북마크 플래그 확인용 글");
        bookmark(post, viewer);

        FeedBookmarkPageResponse response = feedService.getMyBookmarks(viewer.getEmail(), 1, 12);

        assertFalse(response.posts().isEmpty());
        response.posts().forEach(p -> assertTrue(p.bookmarked()));
    }

    // 북마크한 게시물에 좋아요도 눌렀다면 liked=true로 반영되어야 한다(배치 조회 원칙, N+1 방지).
    @Test
    void likedReflectsActualLikeState() {
        UserEntity author = createUser("bookmark-author3@test.com", "북마크작성자3");
        UserEntity viewer = createUser("bookmark-viewer3@test.com", "북마크뷰어3");

        FeedPost likedAndBookmarked = createPost(author, "좋아요와 북마크 모두 누른 글");
        bookmark(likedAndBookmarked, viewer);
        feedLikeRepository.save(new FeedLike(likedAndBookmarked, viewer));

        FeedPost onlyBookmarked = createPost(author, "북마크만 누른 글");
        bookmark(onlyBookmarked, viewer);

        FeedBookmarkPageResponse response = feedService.getMyBookmarks(viewer.getEmail(), 1, 12);

        boolean likedFlagForFirst = response.posts().stream()
                .filter(p -> p.id().equals(likedAndBookmarked.getId())).findFirst().orElseThrow().liked();
        boolean likedFlagForSecond = response.posts().stream()
                .filter(p -> p.id().equals(onlyBookmarked.getId())).findFirst().orElseThrow().liked();

        assertTrue(likedFlagForFirst);
        assertFalse(likedFlagForSecond);
    }

    // 원글이 소프트 삭제된 북마크는 목록에서 제외되어야 한다.
    @Test
    void excludesBookmarksOfSoftDeletedPosts() {
        UserEntity author = createUser("bookmark-author4@test.com", "북마크작성자4");
        UserEntity viewer = createUser("bookmark-viewer4@test.com", "북마크뷰어4");

        FeedPost deletedPost = createPost(author, "나중에 삭제될 글");
        bookmark(deletedPost, viewer);
        deletedPost.softDelete("테스트 소프트 삭제");
        feedPostRepository.save(deletedPost);

        FeedPost normalPost = createPost(author, "정상적으로 남아있는 글");
        bookmark(normalPost, viewer);

        FeedBookmarkPageResponse response = feedService.getMyBookmarks(viewer.getEmail(), 1, 12);

        List<Long> postIds = response.posts().stream().map(FeedPostResponse::id).toList();
        assertTrue(postIds.contains(normalPost.getId()));
        assertFalse(postIds.contains(deletedPost.getId()));
    }
}
