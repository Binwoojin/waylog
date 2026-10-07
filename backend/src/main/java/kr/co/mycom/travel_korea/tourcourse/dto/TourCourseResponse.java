package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;
import kr.co.mycom.travel_korea.tourcourse.domain.TourCourseDay;

import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/**
 * 여행코스 상세 응답 (admin-dashboard 설계 §3.3.5). 구조(코스/일자/경유지/이미지)를
 * 한 번에 내려준다. 목록 응답(TourCourseListItemResponse)과 다르게 days까지 포함한다.
 */
public record TourCourseResponse(
        Long id,
        String title,
        String theme,
        String coverImageUrl,
        List<TourCourseDayResponse> days
) {
    public static TourCourseResponse from(TourCourse course, Function<String, String> urlResolver) {
        return new TourCourseResponse(
                course.getId(),
                course.getTitle(),
                course.getTheme(),
                resolveNullable(course.getCoverImageObjectKey(), urlResolver),
                /*
                 * @OrderBy("dayNumber ASC")는 DB에서 새로 조회할 때만 적용된다. 생성/수정
                 * 직후에는 응답을 같은 트랜잭션의 관리 대상 컬렉션에서 바로 만들기 때문에
                 * (재조회하지 않음) 여기서 명시적으로 다시 정렬해 순서를 보장한다.
                 */
                course.getDays().stream()
                        .sorted(Comparator.comparingInt(TourCourseDay::getDayNumber))
                        .map(day -> TourCourseDayResponse.from(day, urlResolver))
                        .toList()
        );
    }

    private static String resolveNullable(String objectKey, Function<String, String> urlResolver) {
        if (objectKey == null || objectKey.isBlank()) {
            return null;
        }

        return urlResolver.apply(objectKey);
    }
}
