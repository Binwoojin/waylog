package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseDay;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseStop;

import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/**
 * 여행코스 일자 응답 (admin-dashboard 설계 §3.3.5).
 */
public record TourCourseDayResponse(Long id, int dayNumber, List<TourCourseStopResponse> stops) {

    public static TourCourseDayResponse from(TourCourseDay day, Function<String, String> urlResolver) {
        return new TourCourseDayResponse(
                day.getId(),
                day.getDayNumber(),
                // TourCourseResponse.from과 같은 이유로 sortOrder 기준 정렬을 명시적으로 다시 적용한다.
                day.getStops().stream()
                        .sorted(Comparator.comparingInt(TourCourseStop::getSortOrder))
                        .map(stop -> TourCourseStopResponse.from(stop, urlResolver))
                        .toList()
        );
    }
}
