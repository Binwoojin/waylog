package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.feed.domain.FeedComment;

import java.time.LocalDateTime;
import java.util.List;

/**
 * feed-comment-integration 설계 §3.3 — 댓글/답글 응답.
 * 답글은 답글을 가질 수 없으므로(1단계 제한) replies는 항상 빈 리스트로 고정된다.
 */
public record FeedCommentResponse(
        Long id,
        AuthorResponse author,
        String content,
        LocalDateTime createdAt,
        List<FeedCommentResponse> replies
) {
    public record AuthorResponse(Long id, String nickname, String profileImageUrl) {
    }

    public static FeedCommentResponse from(FeedComment comment) {
        return from(comment, comment.getReplies());
    }

    /*
     * code-review Must Fix 1 — 목록 조회(FeedCommentService.list)는 replies를 comment.getReplies()로
     * lazy 로딩하지 않고 별도 쿼리로 미리 가져와 이 오버로드에 명시적으로 전달한다.
     * comment.getReplies()를 여기서 호출하면 댓글마다 추가 SELECT가 발생해(N+1) 2단계 쿼리로
     * 나눈 의미가 없어진다.
     */
    public static FeedCommentResponse from(FeedComment comment, List<FeedComment> replies) {
        return new FeedCommentResponse(
                comment.getId(),
                new AuthorResponse(
                        comment.getAuthor().getId(),
                        comment.getAuthor().getNickname(),
                        comment.getAuthor().getProfileImageUrl()
                ),
                comment.getContent(),
                comment.getCreatedAt(),
                replies.stream().map(FeedCommentResponse::fromLeaf).toList()
        );
    }

    // 답글은 답글을 가질 수 없으므로(1단계 제한) replies를 항상 빈 리스트로 고정합니다.
    private static FeedCommentResponse fromLeaf(FeedComment reply) {
        return new FeedCommentResponse(
                reply.getId(),
                new AuthorResponse(
                        reply.getAuthor().getId(),
                        reply.getAuthor().getNickname(),
                        reply.getAuthor().getProfileImageUrl()
                ),
                reply.getContent(),
                reply.getCreatedAt(),
                List.of()
        );
    }
}
