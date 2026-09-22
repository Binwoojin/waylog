package kr.co.mycom.travel_korea.tour.bookmark.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 카드 또는 상세 페이지에서 북마크를 누를 때 전달하는 데이터입니다.
 *
 * 프론트는 현재 카드에 이미 표시된 값을 함께 전송합니다.
 * 따라서 북마크 등록 시 TourAPI를 추가 호출할 필요가 없습니다.
 */

public record TourBookmarkToggleRequest(
        @NotBlank(message = "contentId는 필수입니다.")
        String contentId,

        @NotNull(message = "contentTypeId는 필수입니다.")
        Integer contentTypeId,

        @NotBlank(message = "제목은 필수입니다.")
        String title,

        String imageUrl,

        String address,

        String categoryName
) {
}
