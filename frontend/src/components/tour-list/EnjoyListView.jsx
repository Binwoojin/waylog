import { useEffect, useId, useRef } from 'react'
import { useEnjoyList } from '../../hooks/useEnjoyList'
import { ENJOY_LIST_PAGE_SIZE } from '../../lib/enjoyListQuery'
import ListStatus from './ListStatus'
import Pagination from './Pagination'
import TourCardGrid from './TourCardGrid'
import TourCardSkeleton from './TourCardSkeleton'
import { formatTotalCount } from './listMessages'
import './TourList.css'

const ENJOY_LOADING_MESSAGE = '여행 즐길거리를 불러오는 중입니다'

/**
 * 즐길거리 목록 컨테이너
 *
 * TourListView·CourseListView와 같은 렌더 분기(스켈레톤 → 그리드/빈 상태/오류 → 페이지네이션)를
 * 쓰되 useEnjoyList(lib/enjoyListQuery.js 기반)를 씁니다. TourListView는 useTourList를
 * 하드코딩 import하고 있어(TOUR_LIST_CONFIGS 전제) 이미 출시된 그 컴포넌트를 일반화하는 대신
 * 병렬 컴포넌트로 복제합니다(CourseListView와 같은 선례, 회귀 위험 최소화).
 *
 * 카드(TourCardGrid·TourCard)는 TourCard view model(id·title·address·image·detailPath)만
 * 받으므로 여행지·즐길거리 구분 없이 그대로 재사용합니다.
 *
 * @param query EnjoyListQuery | null (null = 조건 없음)
 * @param onPageChange (page, { replace }?) => void
 * @param onRequestConditions 조건 없음·빈 결과·잘못된 조건의 주 버튼(검색 모달 열기)
 */
export default function EnjoyListView({ query, onPageChange, onRequestConditions }) {
  const generatedId = useId()
  const summaryRef = useRef(null)
  const { status, data, errorKind, retry, hasRetried } = useEnjoyList(query)

  // Design Ref: TourListView §5.6과 같은 범위 초과 보정 — 응답이 와야 총 페이지를 알 수 있습니다.
  const correctedPage = getCorrectedPage(status, data, query)

  useEffect(() => {
    if (correctedPage != null) onPageChange(correctedPage, { replace: true })
  }, [correctedPage, onPageChange])

  if (!query) {
    return (
      <ListStatus
        variant="no-query"
        onAction={onRequestConditions}
        title="찾으시는 즐길거리 조건을 선택해 주세요"
        description="즐길거리 유형을 고르면 맞는 여행정보를 찾아 드려요."
        actionLabel="조건 선택하기"
      />
    )
  }

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
    body = <TourCardSkeleton count={ENJOY_LIST_PAGE_SIZE} />
  } else if (status === 'error') {
    body = errorKind === 'invalid'
      ? (
        <ListStatus
          variant="invalid"
          onAction={onRequestConditions}
          actionLabel="조건 변경"
          title="검색 조건이 올바르지 않아요"
          description="조건을 다시 선택해 주세요."
        />
      )
      : (
        <ListStatus
          variant="error"
          onAction={retry}
          focusOnMount={hasRetried}
          title="즐길거리 목록을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
        />
      )
  } else if (data.totalCount === 0) {
    body = (
      <ListStatus
        variant="empty"
        onAction={onRequestConditions}
        actionLabel="조건 변경"
        title="조건에 맞는 즐길거리가 없어요"
        description="다른 유형으로 찾아보세요."
      />
    )
  } else {
    body = (
      <>
        <TourCardGrid cards={data.items} busy={status === 'refreshing'} />
        <Pagination page={query.page} totalPages={data.totalPages} onPageChange={handlePageChange} />
      </>
    )
  }

  return (
    <div className="tour-list" aria-busy={isBusy}>
      {/* 건수 영역은 항상 렌더해 두어야 내용이 바뀔 때 스크린 리더가 알립니다(live region). */}
      <p className="tour-list__summary" id={generatedId} ref={summaryRef} tabIndex={-1} role="status">
        {isInitialLoading && <span className="tour-list__sr-only">{ENJOY_LOADING_MESSAGE}</span>}
        {hasResult && <>총 <b>{formatTotalCount(data.totalCount)}</b>건</>}
      </p>
      {body}
    </div>
  )
}

// 응답의 총 페이지보다 큰 page면 옮길 페이지, 아니면 null
function getCorrectedPage(status, data, query) {
  if (status !== 'success' || !query || !data) return null
  if (data.totalCount === 0) return query.page > 1 ? 1 : null
  return query.page > data.totalPages ? data.totalPages : null
}
