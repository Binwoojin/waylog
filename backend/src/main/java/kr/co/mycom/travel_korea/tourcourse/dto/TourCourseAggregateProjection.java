package kr.co.mycom.travel_korea.tourcourse.dto;

/**
 * 공개 목록 집계 전용 프로젝션 (tour-course-list-integration 설계 §4.2).
 *
 * 코스 목록 화면의 카드에는 일자 수·경유지 수가 필요하지만, 관리자 목록 응답
 * (TourCourseListItemResponse)은 N+1 회피를 위해 이 값을 의도적으로 빼 두었다
 * (admin-dashboard report). 공개 목록에서는 검색 결과와 별개로 페이지당 집계 쿼리
 * 1개를 더 실행해 이 값을 채운다(§4.2 참고).
 */
public record TourCourseAggregateProjection(Long courseId, long dayCount, long stopCount) {
}
