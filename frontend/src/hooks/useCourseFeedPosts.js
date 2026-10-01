import { useFeedInfiniteList } from './useFeedInfiniteList'

/**
 * 코스 상세의 "참조 피드" 목록 상태 훅
 *
 * Design Ref: tour-course-feed-linking.design.md §6.4, §7.4 — 신규 fetch 함수나 페이지네이션
 * 로직을 새로 만들지 않고, 기존 `useFeedInfiniteList`(피드 타임라인 무한 스크롤 훅)가
 * `linkedCourseId` 필터를 지원하도록 일반화된 것을 그대로 감싼 얇은 래퍼다. 호출하는 쪽
 * (TourCourseDetailPage)이 courseId별로 새 컴포넌트 트리를 마운트하므로(useCourseDetail과
 * 같은 key={id} 재마운트 패턴), courseId가 바뀌는 동안의 재구독은 고려하지 않아도 된다.
 *
 * status: 'loading' | 'success' | 'error' | 'loading-more' | 'error-more'
 */
export function useCourseFeedPosts(courseId, size = 9) {
  return useFeedInfiniteList(size, { linkedCourseId: courseId })
}
