package kr.co.mycom.travel_korea.tour.dto.response;

import java.util.List;

/**
 * 메인 페이지 추천 여행코스 카드 응답입니다.
 */

public record TourCourseResponse(
        String contentId,
        String contentTypeId,
        String image,
        String title,
        String region,
        String duration,
        String description,
        List<String> stops
) {
    public TourCourseResponse {
        stops = stops == null ? List.of() : List.copyOf(stops);
    }

    // TODO(팀원 A):
    // 여행코스 contentTypeId=25의 detailIntro2와 detailInfo2 결과에서
    // duration과 stops를 채울 수 있도록 실제 Client를 구현해 주세요.

}
