package kr.co.mycom.travel_korea.tour.dto.response;

/**
 * 메인 페이지 '여행을 더 즐겁게' 카드 응답입니다.
 */

public record TourEnjoyResponse(
        String contentId,
        String contentTypeId,
        String category,
        String image,
        String title,
        String location
) {
}
