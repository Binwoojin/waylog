package kr.co.mycom.travel_korea.board.dto;

public record PostImageResponse(
        Long id,
        String objectKey,
        String originalFilename,
        String contentType,
        long size,
        String url
) {
}
