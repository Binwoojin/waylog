package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.common.exception.ForbiddenException;
import kr.co.mycom.travel_korea.feed.domain.FeedComment;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedCommentRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.service.FeedCommentService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * feed-comment-integration 설계 §10 회귀 체크리스트 — 댓글·답글 작성/삭제/cascade 검증.
 *
 * FeedTimelineCursorTest/FeedAdminServiceTest와 같은 스타일로 MockMvc 없이
 * 서비스와 리포지토리를 직접 호출한다(설계 §2.2 "새 의존성 금지").
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedCommentServiceTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedPostRepository feedPostRepository;
    @Autowired
    private FeedCommentRepository feedCommentRepository;
    @Autowired
    private FeedCommentService feedCommentService;

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user");
        return userRepository.save(user);
    }

    private FeedPost createPost(UserEntity author, String content) {
        FeedPost post = new FeedPost(author, content, null, null, null, null, null, null, "PUBLIC");
        return feedPostRepository.save(post);
    }

    // 최상위 댓글 작성 시 commentCount가 1 증가해야 한다.
    @Test
    void createTopLevelCommentIncreasesCommentCount() {
        UserEntity author = createUser("comment-create-author@test.com", "댓글작성자1");
        UserEntity commenter = createUser("comment-create-commenter@test.com", "댓글러1");
        FeedPost post = createPost(author, "댓글 테스트 게시물1");

        FeedCommentResponse response = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("첫 댓글입니다.", null));

        assertNotNull(response.id());
        assertEquals("첫 댓글입니다.", response.content());
        assertTrue(response.replies().isEmpty());

        FeedPost reloaded = feedPostRepository.findById(post.getId()).orElseThrow();
        assertEquals(1, reloaded.getCommentCount());
    }

    // 최상위 댓글에 답글을 달면 commentCount가 추가로 1 증가하고, 응답의 replies에 반영된다.
    @Test
    void createReplyIncreasesCommentCountAndAttachesToParent() {
        UserEntity author = createUser("comment-reply-author@test.com", "댓글작성자2");
        UserEntity commenter = createUser("comment-reply-commenter@test.com", "댓글러2");
        UserEntity replier = createUser("comment-reply-replier@test.com", "답글러2");
        FeedPost post = createPost(author, "댓글 테스트 게시물2");

        FeedCommentResponse parent = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("부모 댓글", null));

        FeedCommentResponse reply = feedCommentService.create(
                post.getId(), replier.getEmail(), new FeedCommentCreateRequest("답글입니다.", parent.id()));

        assertTrue(reply.replies().isEmpty(), "답글 자신은 답글을 가질 수 없으므로 항상 빈 리스트여야 한다");

        FeedPost reloaded = feedPostRepository.findById(post.getId()).orElseThrow();
        assertEquals(2, reloaded.getCommentCount());

        FeedCommentPageResponse page = feedCommentService.list(post.getId(), 1, 20);
        assertEquals(1, page.comments().size(), "답글은 최상위 목록에 별도 항목으로 나타나면 안 된다");
        assertEquals(1, page.comments().get(0).replies().size());
        assertEquals(reply.id(), page.comments().get(0).replies().get(0).id());
    }

    // 답글에 다시 답글을 다는 것은 서버가 거부해야 한다(1단계 제한).
    @Test
    void replyToReplyIsRejected() {
        UserEntity author = createUser("comment-nested-author@test.com", "댓글작성자3");
        UserEntity commenter = createUser("comment-nested-commenter@test.com", "댓글러3");
        FeedPost post = createPost(author, "댓글 테스트 게시물3");

        FeedCommentResponse parent = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("최상위 댓글", null));
        FeedCommentResponse reply = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("답글", parent.id()));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                feedCommentService.create(post.getId(), commenter.getEmail(),
                        new FeedCommentCreateRequest("답글의 답글(거부되어야 함)", reply.id())));

        assertEquals("답글에는 답글을 달 수 없습니다.", exception.getMessage());
    }

    // 최상위 댓글을 삭제하면 답글도 함께 삭제되고, commentCount는 (1 + 답글 수)만큼 감소해야 한다.
    @Test
    void deletingTopLevelCommentCascadesRepliesAndDecreasesCount() {
        UserEntity author = createUser("comment-delete-author@test.com", "댓글작성자4");
        UserEntity commenter = createUser("comment-delete-commenter@test.com", "댓글러4");
        FeedPost post = createPost(author, "댓글 테스트 게시물4");

        FeedCommentResponse parent = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("삭제될 부모 댓글", null));
        FeedCommentResponse reply1 = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("답글1", parent.id()));
        FeedCommentResponse reply2 = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("답글2", parent.id()));

        FeedPost beforeDelete = feedPostRepository.findById(post.getId()).orElseThrow();
        assertEquals(3, beforeDelete.getCommentCount());

        feedCommentService.delete(post.getId(), parent.id(), commenter.getEmail());

        assertTrue(feedCommentRepository.findById(parent.id()).isEmpty(), "부모 댓글은 하드 삭제되어야 한다");
        assertTrue(feedCommentRepository.findById(reply1.id()).isEmpty(), "답글도 cascade로 함께 삭제되어야 한다");
        assertTrue(feedCommentRepository.findById(reply2.id()).isEmpty(), "답글도 cascade로 함께 삭제되어야 한다");

        FeedPost afterDelete = feedPostRepository.findById(post.getId()).orElseThrow();
        assertEquals(0, afterDelete.getCommentCount(), "commentCount는 1(부모) + 2(답글)만큼 감소해야 한다");
    }

    // 답글(리프)만 삭제하면 commentCount는 1만 감소해야 한다.
    @Test
    void deletingLeafReplyDecreasesCountByOne() {
        UserEntity author = createUser("comment-leaf-author@test.com", "댓글작성자5");
        UserEntity commenter = createUser("comment-leaf-commenter@test.com", "댓글러5");
        FeedPost post = createPost(author, "댓글 테스트 게시물5");

        FeedCommentResponse parent = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("부모 댓글", null));
        FeedCommentResponse reply = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("답글", parent.id()));

        feedCommentService.delete(post.getId(), reply.id(), commenter.getEmail());

        assertTrue(feedCommentRepository.findById(reply.id()).isEmpty());
        assertTrue(feedCommentRepository.findById(parent.id()).isPresent(), "부모 댓글은 그대로 남아 있어야 한다");

        FeedPost reloaded = feedPostRepository.findById(post.getId()).orElseThrow();
        assertEquals(1, reloaded.getCommentCount());
    }

    // 본인 댓글이 아니면 삭제할 수 없다.
    @Test
    void deletingOthersCommentIsRejected() {
        UserEntity author = createUser("comment-others-author@test.com", "댓글작성자6");
        UserEntity commenter = createUser("comment-others-commenter@test.com", "댓글러6");
        UserEntity stranger = createUser("comment-others-stranger@test.com", "타인6");
        FeedPost post = createPost(author, "댓글 테스트 게시물6");

        FeedCommentResponse comment = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("내 댓글", null));

        ForbiddenException exception = assertThrows(ForbiddenException.class, () ->
                feedCommentService.delete(post.getId(), comment.id(), stranger.getEmail()));

        assertEquals("본인 댓글만 삭제할 수 있습니다.", exception.getMessage());
        assertTrue(feedCommentRepository.findById(comment.id()).isPresent(), "삭제가 거부되면 댓글은 그대로 남아 있어야 한다");
    }

    // 게시물을 하드 삭제하면 댓글·답글도 고아 레코드 없이 함께 삭제되어야 한다(cascade, 설계 §10 필수 검증 항목).
    @Test
    void deletingPostCascadesComments() {
        UserEntity author = createUser("comment-post-delete-author@test.com", "댓글작성자7");
        UserEntity commenter = createUser("comment-post-delete-commenter@test.com", "댓글러7");
        FeedPost post = createPost(author, "댓글 테스트 게시물7");

        FeedCommentResponse parent = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("게시물과 함께 삭제될 댓글", null));
        FeedCommentResponse reply = feedCommentService.create(
                post.getId(), commenter.getEmail(), new FeedCommentCreateRequest("게시물과 함께 삭제될 답글", parent.id()));

        FeedPost toDelete = feedPostRepository.findById(post.getId()).orElseThrow();
        feedPostRepository.delete(toDelete);
        feedPostRepository.flush();

        assertTrue(feedCommentRepository.findById(parent.id()).isEmpty(), "게시물 삭제 시 최상위 댓글도 cascade로 삭제되어야 한다");
        assertTrue(feedCommentRepository.findById(reply.id()).isEmpty(), "게시물 삭제 시 답글도 cascade로 삭제되어야 한다");
    }

    // 존재하지 않거나 삭제된 게시물에는 댓글을 작성할 수 없다(fail-closed).
    @Test
    void creatingCommentOnMissingPostIsRejected() {
        UserEntity commenter = createUser("comment-missing-post-commenter@test.com", "댓글러8");

        assertThrows(IllegalArgumentException.class, () ->
                feedCommentService.create(Long.MAX_VALUE, commenter.getEmail(),
                        new FeedCommentCreateRequest("존재하지 않는 게시물", null)));
    }
}
