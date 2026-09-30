import { useEffect, useId, useRef } from 'react'
import { useCourseList } from '../../hooks/useCourseList'
import { COURSE_LIST_PAGE_SIZE } from '../../lib/courseListQuery'
import ListStatus from './ListStatus'
import Pagination from './Pagination'
import CourseCardGrid from './CourseCardGrid'
import TourCardSkeleton from './TourCardSkeleton'
import { formatTotalCount } from './listMessages'
import './TourList.css'

const COURSE_LOADING_MESSAGE = '여행코스를 불러오는 중입니다'

/**
 * 여행코스 목록 컨테이너
 *
 * Design Ref: tour-course-list-integration.design.md §7.2 — TourListView와 같은 렌더 분기
 * (스켈레톤 → 그리드/빈 상태/오류 → 페이지네이션)를 쓰되 useCourseList/CourseCardGrid를 씁니다.
 * TourListView는 useTourList를 하드코딩 import하고 있어(§2.2), 이미 출시된 그 컴포넌트를
 * 일반화하는 대신 병렬 컴포넌트로 복제합니다(회귀 위험 최소화).
 *
 * @param query CourseListQuery (null 없음 — 코스는 "조건 없음" 상태가 없습니다)
 * @param onPageChange (page, { replace }?) => void
 * @param onReset 빈 결과의 주 버튼 (보통 검색어 지우기)
 * @param resetLabel 빈 결과 버튼 문구
 */
export default function CourseListView({ query, onPageChange, onReset, resetLabel }) {
  const generatedId = useId()
  const summaryRef = useRef(null)
  const { status, data, retry, hasRetried } = useCourseList(query)

  // Design Ref: 설계 §7.2(§5.6과 동일 원리) — page 상한은 응답이 와야 알 수 있습니다.
  const correctedPage = getCorrectedPage(status, data, query)

  useEffect(() => {
    if (correctedPage != null) onPageChange(correctedPage, { replace: true })
  }, [correctedPage, onPageChange])

  const handlePageChange = page => {
    onPageChange(page)
    const summary = summaryRef.current
    if (!summary) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    summary.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
    summary.focus({ preventScroll: true })
  }

  const isCorrecting = correctedPage != null
  const isStaleOutOfRangeData = status === 'refreshing' && data.totalCount > 0 && data.items.length === 0
  const isInitialLoading = status === 'loading' || isCorrecting || isStaleOutOfRangeData
  const isBusy = isInitialLoading || status === 'refreshing'
  const hasResult = (status === 'success' || status === 'refreshing') && !isCorrecting && !isStaleOutOfRangeData

  let body
  if (isInitialLoading) {
    body = <TourCardSkeleton count={COURSE_LIST_PAGE_SIZE} />
  } else if (status === 'error') {
    body = (
      <ListStatus
        variant="error"
        onAction={retry}
        focusOnMount={hasRetried}
        title="여행코스를 불러오지 못했어요"
        description="잠시 후 다시 시도해 주세요."
      />
    )
  } else if (data.totalCount === 0) {
    body = (
      <ListStatus
        variant="empty"
        onAction={onReset}
        actionLabel={resetLabel}
        title="조건에 맞는 여행코스가 없어요"
        description="다른 검색어로 찾아보세요."
      />
    )
  } else {
    body = (
      <>
        <CourseCardGrid cards={data.items} busy={status === 'refreshing'} />
        <Pagination page={query.page} totalPages={data.totalPages} onPageChange={handlePageChange} />
      </>
    )
  }

  return (
    <div className="tour-list" aria-busy={isBusy}>
      <p className="tour-list__summary" id={generatedId} ref={summaryRef} tabIndex={-1} role="status">
        {isInitialLoading && <span className="tour-list__sr-only">{COURSE_LOADING_MESSAGE}</span>}
        {hasResult && <>총 <b>{formatTotalCount(data.totalCount)}</b>건</>}
      </p>
      {body}
    </div>
  )
}

function getCorrectedPage(status, data, query) {
  if (status !== 'success' || !data) return null
  if (data.totalCount === 0) return query.page > 1 ? 1 : null
  return query.page > data.totalPages ? data.totalPages : null
}
