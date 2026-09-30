package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * feed-comment-integration 설계 §3.3 — 댓글/답글 작성 요청.
 * parentCommentId가 null이면 최상위 댓글, 값이 있으면 그 댓글의 답글로 등록한다.
 */
public record FeedCommentCreateRequest(
        @NotBlank(message = "댓글 내용을 입력해 주세요.")
        @Size(max = 500, message = "댓글은 500자 이내로 입력해 주세요.")
        String content,

        Long parentCommentId
) {
}
