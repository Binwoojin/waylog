package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FeedCommentRequest(
        @NotBlank(message = "댓글 내용을 입력해 주세요.")
        @Size(max = 500, message = "댓글은 500자 이내로 입력해 주세요.")
        String content
) {
}
