package kr.co.mycom.travel_korea.tour.dto.response;

/**
 * 메인 페이지 '이번 주 여행 소식'에서 사용하는 축제 응답입니다.
 */

public record TourFestivalResponse(
        String contentId,
        String title,
        String image,
        String address,
        String startDate,
        String endDate
) {
}
