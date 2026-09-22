package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.feed.domain.FeedComment;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedCommentRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedCommentService {

    private final FeedCommentRepository feedCommentRepository;
    private final FeedPostRepository feedPostRepository;
    private final UserRepository userRepository;

    public List<FeedCommentResponse> list(Long postId, String loginEmail) {
        FeedPost post = findPost(postId);
        validateVisibility(post, loginEmail);

        return feedCommentRepository.findByFeedPost_IdOrderByCreatedAtAsc(postId).stream()
                .map(FeedCommentResponse::from)
                .toList();
    }

    @Transactional
    public FeedCommentResponse create(Long postId, String loginEmail, FeedCommentRequest request) {
        FeedPost post = findPost(postId);
        validateVisibility(post, loginEmail);

        UserEntity author = findUser(loginEmail);
        FeedComment comment = feedCommentRepository.save(new FeedComment(post, author, request.content().trim()));
        post.increaseCommentCount();

        return FeedCommentResponse.from(comment);
    }

    @Transactional
    public FeedCommentResponse update(Long commentId, String loginEmail, FeedCommentRequest request) {
        FeedComment comment = findComment(commentId);
        validateOwner(comment, loginEmail);

        comment.updateContent(request.content().trim());
        return FeedCommentResponse.from(comment);
    }

    @Transactional
    public void delete(Long commentId, String loginEmail) {
        FeedComment comment = findComment(commentId);
        validateOwner(comment, loginEmail);

        FeedPost post = comment.getFeedPost();
        feedCommentRepository.delete(comment);
        post.decreaseCommentCount();
    }

    private FeedPost findPost(Long postId) {
        return feedPostRepository.findWithDetailsById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
    }

    private FeedComment findComment(Long commentId) {
        return feedCommentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("댓글을 찾을 수 없습니다."));
    }

    private UserEntity findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("회원 정보를 찾을 수 없습니다."));
    }

    /**
     * PRIVATE 게시글의 댓글은 게시글 본문과 동일하게
     * 작성자 본인만 조회·작성할 수 있습니다.
     */
    private void validateVisibility(FeedPost post, String loginEmail) {
        boolean isPrivate = "PRIVATE".equalsIgnoreCase(post.getVisibility());
        boolean isAuthor = loginEmail != null && post.getAuthor().getEmail().equals(loginEmail);

        if (isPrivate && !isAuthor) {
            throw new IllegalArgumentException("비공개 게시글에 접근할 수 없습니다.");
        }
    }

    /**
     * 댓글 수정/삭제는 작성자 본인 또는 관리자만 허용합니다.
     */
    private void validateOwner(FeedComment comment, String loginEmail) {
        if (comment.getAuthor().getEmail().equals(loginEmail)) {
            return;
        }

        UserEntity requester = findUser(loginEmail);
        if ("ADMIN".equalsIgnoreCase(requester.getGrade())) {
            return;
        }

        throw new IllegalArgumentException("댓글 작성자만 수정하거나 삭제할 수 있습니다.");
    }
}
