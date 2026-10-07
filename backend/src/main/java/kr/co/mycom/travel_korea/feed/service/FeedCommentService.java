package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.common.exception.ForbiddenException;
import kr.co.mycom.travel_korea.feed.domain.FeedComment;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedCommentResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedCommentRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * feed-comment-integration 설계 §4.2 — 댓글·답글 목록/작성/삭제.
 *
 * FeedService와 동일한 findUser/findVisiblePost 패턴을 그대로 복제한다(사이클 1 관례 유지).
 * 알림 발행 로직은 이번 범위에 포함하지 않는다(계획 Q-1).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedCommentService {

    private final FeedCommentRepository feedCommentRepository;
    private final FeedPostRepository feedPostRepository;
    private final UserRepository userRepository;

    public FeedCommentPageResponse list(Long postId, int page, int size) {
        // findVisiblePost로 존재 여부를 먼저 검증해, 삭제되었거나 없는 게시물의 댓글을 조회하지 않는다.
        findVisiblePost(postId);

        int pageIndex = Math.max(page - 1, 0);
        int pageSize = Math.min(Math.max(size, 1), 30);
        Pageable pageable = PageRequest.of(pageIndex, pageSize);

        Page<FeedComment> result = feedCommentRepository
                .findByFeedPost_IdAndParentIsNullOrderByCreatedAtAsc(postId, pageable);

        // Must Fix 1: replies를 fetch join하지 않고, 조회된 최상위 댓글 id로 별도 IN 쿼리 한 번만 더 실행한다.
        List<Long> parentIds = result.getContent().stream().map(FeedComment::getId).toList();
        Map<Long, List<FeedComment>> repliesByParentId = parentIds.isEmpty()
                ? Map.of()
                : feedCommentRepository.findByParent_IdInOrderByCreatedAtAsc(parentIds).stream()
                        .collect(Collectors.groupingBy(reply -> reply.getParent().getId()));

        List<FeedCommentResponse> responses = result.getContent().stream()
                .map(comment -> FeedCommentResponse.from(comment, repliesByParentId.getOrDefault(comment.getId(), List.of())))
                .toList();

        return FeedCommentPageResponse.from(result, responses);
    }

    @Transactional
    public FeedCommentResponse create(Long postId, String loginEmail, FeedCommentCreateRequest request) {
        UserEntity author = findUser(loginEmail);
        FeedPost post = findVisiblePost(postId);

        FeedComment parent = null;
        if (request.parentCommentId() != null) {
            parent = feedCommentRepository.findById(request.parentCommentId())
                    .orElseThrow(() -> new IllegalArgumentException("답글을 달 댓글을 찾을 수 없습니다."));

            // 답글의 답글 금지 — 1단계 제한(설계 원칙 1.2).
            if (parent.isReply()) {
                throw new IllegalArgumentException("답글에는 답글을 달 수 없습니다.");
            }
            if (!parent.getFeedPost().getId().equals(postId)) {
                throw new IllegalArgumentException("잘못된 댓글 요청입니다.");
            }
        }

        FeedComment comment = new FeedComment(post, author, parent, request.content().trim());
        FeedComment saved = feedCommentRepository.save(comment);

        // Must Fix 2: 필드 증감 대신 원자적 UPDATE로 처리해 동시 작성/삭제 시 lost update를 막는다.
        feedPostRepository.adjustCommentCount(post.getId(), 1);

        return FeedCommentResponse.from(saved);
    }

    /**
     * @return 실제로 삭제된 댓글 수(최상위 댓글 삭제 시 1 + 답글 수, 답글만 삭제 시 1).
     *         Should Improve — 컨트롤러가 이 값을 응답 본문에 담아 프론트가 로컬 state로
     *         감소량을 추정하지 않아도 되게 한다.
     */
    @Transactional
    public long delete(Long postId, Long commentId, String loginEmail) {
        FeedComment comment = feedCommentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("댓글을 찾을 수 없습니다."));

        if (!comment.getFeedPost().getId().equals(postId)) {
            throw new IllegalArgumentException("잘못된 댓글 요청입니다.");
        }
        if (!comment.getAuthor().getEmail().equals(loginEmail)) {
            throw new ForbiddenException("본인 댓글만 삭제할 수 있습니다.");
        }

        // 최상위 댓글을 지우면 replies도 orphanRemoval로 함께 삭제되므로, 감소량은 1 + 답글 수.
        long removedCount = 1 + comment.getReplies().size();

        feedCommentRepository.delete(comment);
        // Must Fix 2: 필드 증감 대신 원자적 UPDATE로 처리해 동시 작성/삭제 시 lost update를 막는다.
        feedPostRepository.adjustCommentCount(comment.getFeedPost().getId(), -removedCount);

        return removedCount;
    }

    private UserEntity findUser(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("회원 정보를 찾을 수 없습니다."));
    }

    /*
     * FeedService.findVisiblePost와 동일 로직(소프트 삭제·존재하지 않는 게시물 제외).
     * PRIVATE 게시물 접근 제한(FeedService.validateVisibility)까지는 복제하지 않는다 —
     * 댓글 API는 설계 §4.4에서 다루지 않은 범위이며, 계획 문서에도 PRIVATE 댓글 접근
     * 제한이 요구사항으로 명시되어 있지 않다. 게시물 자체의 노출 여부(소프트 삭제/미존재)만
     * 판별해 fail-closed 원칙을 지킨다.
     */
    private FeedPost findVisiblePost(Long postId) {
        return feedPostRepository.findWithDetailsByIdAndDeletedAtIsNull(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
    }
}
