package kr.co.mycom.travel_korea.board.dto;


import java.time.LocalDateTime;

public record CommentResponse(
        Long id,
        Long postId,
        String author,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
