package kr.co.mycom.travel_korea.board.dto;

import java.time.LocalDateTime;
import java.util.List;

public record PostDetailResponse(
        Long id,
        String title,
        String content,
        String author,
        long viewCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<PostImageResponse> images
) {
}
