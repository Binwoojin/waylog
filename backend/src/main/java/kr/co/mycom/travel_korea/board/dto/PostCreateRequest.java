package kr.co.mycom.travel_korea.board.dto;

public record PostCreateRequest(
        String title,
        String content,
        String author
) {
}
