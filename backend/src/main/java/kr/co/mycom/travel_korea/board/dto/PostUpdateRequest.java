package kr.co.mycom.travel_korea.board.dto;


import java.util.List;

public record PostUpdateRequest(
        String title,
         String content,
        String author,
        List<Long> removeImageIds
) {
    public List<Long> safeRemoveImageIds() {
        return removeImageIds == null ? List.of() : removeImageIds;
    }
}
