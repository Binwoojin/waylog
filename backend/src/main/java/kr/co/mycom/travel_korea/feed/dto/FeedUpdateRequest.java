package kr.co.mycom.travel_korea.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record FeedUpdateRequest (
        @NotBlank
        @Size(max = 2000)
        String content,

        @Size(max = 150)
        String locationName,

        @Size(max = 255)
        String address,

        BigDecimal latitude,
        BigDecimal longitude,
        String tourContentId,
        Integer tourContentTypeId,
        String visibility,

        @Size(max = 10)
        List<String> tags,

        @Size(max = 5)
        List<String> imageUrls
){
}
