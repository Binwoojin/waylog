import { useEffect, useId, useRef } from 'react'
import { useTourList } from '../../hooks/useTourList'
import { LIST_PAGE_SIZE } from '../../lib/tourListQuery'
import ListStatus from './ListStatus'
import Pagination from './Pagination'
import TourCardGrid from './TourCardGrid'
import TourCardSkeleton from './TourCardSkeleton'
import { LIST_LOADING_MESSAGE, formatTotalCount } from './listMessages'
import './TourList.css'

/**
 * 여행지 목록 컨테이너
 *
 * Design Ref: §2.2, §5.1 — 페이지는 URL 해석과 화면 조립, 이 컴포넌트는 데이터 조회와 상태별 화면을 맡습니다.
 * 카탈로그와 검색 결과가 같은 컴포넌트를 씁니다(D-7).
 *
 * @param query TourListQuery | null (null = 조건 없음, 검색 결과 전용)
 * @param onPageChange (page, { replace }?) => void
 * @param onReset 빈 결과·잘못된 조건의 주 버튼
 * @param resetLabel 빈 결과 버튼 문구 ('조건 초기화' | '조건 변경')
 * @param onRequestConditions 조건 없음 상태의 버튼 (검색 결과 전용)
 * @param headingId 건수 영역 id. 없으면 자동으로 만듭니다
 */
export default function TourListView({ query, onPageChange, onReset, resetLabel, onRequestConditions, headingId }) {
  const generatedId = useId()
  const summaryId = headingId ?? generatedId
  const summaryRef = useRef(null)
  const { status, data, errorKind, retry, hasRetried } = useTourList(query)

  // Design Ref: §5.6 범위 초과 보정 — page 상한은 응답이 와야 알 수 있습니다.
  // 보정 중에는 "빈 결과"를 잠깐 보여 주지 않고 스켈레톤을 유지합니다.
  const correctedPage = getCorrectedPage(status, data, query)

  useEffect(() => {
    // URL 이동이라 set-state 규칙과 무관합니다. 잘못된 URL이 히스토리에 남지 않게 replace합니다.
    if (correctedPage != null) onPageChange(correctedPage, { replace: true })
  }, [correctedPage, onPageChange])

  if (!query) {
    return <ListStatus variant="no-query" onAction={onRequestConditions} />
  }

  // Design Ref: §5.6 — 페이지를 옮기면 목록 상단(건수 영역)으로 스크롤하고 포커스를 옮깁니다.
  // 키보드 사용자가 페이지 하단 버튼에서 다시 올라올 필요가 없습니다.
  // 같은 pathname에서 쿼리만 바뀌므로 ScrollToTop은 동작하지 않습니다.
  const handlePageChange = page => {
    onPageChange(page)
    const summary = summaryRef.current
    if (!summary) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    summary.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
    summary.focus({ preventScroll: true })
  }

  const isCorrecting = correctedPage != null

  // Design Ref: §5.6, §8.3(L2 `?page=99`) — 보정 페이지로 이동한 직후 한 프레임은 status가
  // success(범위 초과 응답)에서 refreshing(보정된 페이지 요청 중, 이전 데이터 유지)으로 바뀝니다.
  // 이때 "이전 데이터"는 바로 그 범위 초과 응답(totalCount>0인데 items가 빈 배열)이라
  // 그대로 두면 "총 N건" 문구와 함께 빈 그리드가 스켈레톤 없이 잠깐 노출됩니다.
  // 정상 응답은 totalCount>0이면 items가 비지 않으므로, 이 조합은 범위 초과 응답의 신호로만 씁니다.
  const isStaleOutOfRangeData = status === 'refreshing' && data.totalCount > 0 && data.items.length === 0

  const isInitialLoading = status === 'loading' || isCorrecting || isStaleOutOfRangeData
  const isBusy = isInitialLoading || status === 'refreshing'
  const hasResult = (status === 'success' || status === 'refreshing') && !isCorrecting && !isStaleOutOfRangeData

  let body
  if (isInitialLoading) {
    body = <TourCardSkeleton count={LIST_PAGE_SIZE} />
  } else if (status === 'error') {
    body = errorKind === 'invalid'
      ? <ListStatus variant="invalid" onAction={onReset} />
      : <ListStatus variant="error" onAction={retry} focusOnMount={hasRetried} />
  } else if (data.totalCount === 0) {
    body = <ListStatus variant="empty" onAction={onReset} actionLabel={resetLabel} />
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
      <p className="tour-list__summary" id={summaryId} ref={summaryRef} tabIndex={-1} role="status">
        {isInitialLoading && <span className="tour-list__sr-only">{LIST_LOADING_MESSAGE}</span>}
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
