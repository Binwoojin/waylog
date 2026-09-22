package kr.co.mycom.travel_korea.tour.dto.response;

import java.util.List;

/**
 * WayLog 메인 페이지에서 사용하는 TourAPI 통합 응답입니다.
 *
 * <p>프론트엔드는 메인 페이지가 열릴 때 GET /api/home을 한 번 호출하고
 * 각 목록을 해당 섹션에 나누어 표시합니다.</p>
 */


public record HomeTourResponse(
        List<TourSummaryResponse> recommendedDestinations,
        List<TourCourseResponse> recommendedCourses,
        List<TourEnjoyResponse> enjoyItems,
        List<TourFestivalResponse> festivals
) {
    public HomeTourResponse {
        recommendedDestinations = safeList(recommendedDestinations);
        recommendedCourses = safeList(recommendedCourses);
        enjoyItems = safeList(enjoyItems);
        festivals = safeList(festivals);
    }

    private static <T> List<T> safeList(List<T> items) {
        return items == null ? List.of() : List.copyOf(items);
    }
}
