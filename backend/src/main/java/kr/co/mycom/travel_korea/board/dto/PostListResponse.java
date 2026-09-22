package kr.co.mycom.travel_korea.board.dto;

import java.time.LocalDateTime;

public record PostListResponse(
        Long id,
        String title,
        String author,
        long viewCount,
        long commentCount,
        LocalDateTime createdAt,
        boolean hasImages
) {
}
