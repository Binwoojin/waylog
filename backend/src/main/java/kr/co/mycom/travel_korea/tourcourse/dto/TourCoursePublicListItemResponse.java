package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;

import java.util.function.Function;

/**
 * 공개 여행코스 목록 행 (tour-course-list-integration 설계 §4.2, §3.2).
 *
 * 관리자 목록 응답(TourCourseListItemResponse)과 달리 일자 수·경유지 수·1일차
 * 대표 주소를 포함한다. 이 값들은 관리자 목록이 N+1 회피를 위해 의도적으로 뺐던
 * 정보로, 공개 목록 전용 집계 쿼리(TourCourseRepository.aggregateCounts,
 * findFirstDayStopsOrderedByCourse)로 채운다. 관리자 목록 응답은 그대로 둔다.
 */
public record TourCoursePublicListItemResponse(
        Long id,
        String title,
        String theme,
        String coverImageUrl,
        long dayCount,
        long stopCount,
        String representativeAddress
) {
    public static TourCoursePublicListItemResponse from(
            TourCourse course,
            long dayCount,
            long stopCount,
            String representativeAddress,
            Function<String, String> urlResolver
    ) {
        String objectKey = course.getCoverImageObjectKey();

        return new TourCoursePublicListItemResponse(
                course.getId(),
                course.getTitle(),
                course.getTheme(),
                (objectKey == null || objectKey.isBlank()) ? null : urlResolver.apply(objectKey),
                dayCount,
                stopCount,
                representativeAddress
        );
    }
}
