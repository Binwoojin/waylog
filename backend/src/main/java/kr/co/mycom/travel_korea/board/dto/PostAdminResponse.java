package kr.co.mycom.travel_korea.board.dto;

import java.time.LocalDateTime;

public record PostAdminResponse (
        Long id,
        String title,
        String content,
        String author,
        Long viewCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
){
}
