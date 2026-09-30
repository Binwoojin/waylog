package kr.co.mycom.travel_korea.feed.dto;

import kr.co.mycom.travel_korea.feed.domain.FeedComment;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * feed-comment-integration 설계 §3.3 — 최상위 댓글 페이지네이션 응답("더 보기" 방식).
 */
public record FeedCommentPageResponse(
        List<FeedCommentResponse> comments,
        int currentPage,
        int pageSize,
        int totalPages,
        long totalElements,
        boolean hasNext
) {
    public static FeedCommentPageResponse from(Page<FeedComment> page, List<FeedCommentResponse> comments) {
        return new FeedCommentPageResponse(
                comments,
                page.getNumber() + 1,
                page.getSize(),
                page.getTotalPages(),
                page.getTotalElements(),
                page.hasNext()
        );
    }
}
