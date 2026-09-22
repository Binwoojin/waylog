package kr.co.mycom.travel_korea.tour.dto.response;

/**
 * 상세페이지에서 제목과 값 형태로 출력할 정보입니다.
 * 예: "영업시간" - "11:00 ~ 21:00"
 */

public record TourDetailInfoResponse(
        String label,
        String value
) {
}
