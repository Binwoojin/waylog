package kr.co.mycom.travel_korea.tourcourse.dto;

import kr.co.mycom.travel_korea.tourcourse.domain.TourCourse;

import java.time.LocalDateTime;
import java.util.function.Function;

/**
 * 여행코스 관리자 목록 행 (admin-dashboard 설계 §4.1 "목록(검색·페이지)").
 *
 * 일자/경유지 구조는 상세 조회(GET /{id})에서만 내려준다. 목록에서 day/stop 개수까지
 * 함께 보여주려면 컬렉션을 추가로 로드해야 해 N+1 위험이 생기므로(TourCourseRepository의
 * days.stops EntityGraph 주석 참고), 이번 범위에서는 목록에 포함하지 않는다.
 */
public record TourCourseListItemResponse(
        Long id,
        String title,
        String theme,
        String coverImageUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static TourCourseListItemResponse from(TourCourse course, Function<String, String> urlResolver) {
        String objectKey = course.getCoverImageObjectKey();

        return new TourCourseListItemResponse(
                course.getId(),
                course.getTitle(),
                course.getTheme(),
                (objectKey == null || objectKey.isBlank()) ? null : urlResolver.apply(objectKey),
                course.getCreatedAt(),
                course.getUpdatedAt()
        );
    }
}
