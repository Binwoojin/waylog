package kr.co.mycom.travel_korea.board.storage;

public record StoredObject(
        String objectKey,
        String originalFilename,
        String contentType,
        long size
) {
}
