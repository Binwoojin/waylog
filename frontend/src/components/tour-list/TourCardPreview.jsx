import SectionStatus from '../common/SectionStatus'
import TourCardGrid from './TourCardGrid'
import TourCardSkeleton from './TourCardSkeleton'

// 미리보기는 카탈로그 그리드(3열)에 맞춰 3건만 보여 줍니다.
export const PREVIEW_COUNT = 3

/**
 * 카드 미리보기 그리드(표시 컴포넌트)
 *
 * 훅은 호출부가 씁니다. useTourList와 useEnjoyList는 같은 모양({ status, data, retry })을 주므로
 * 여기서는 상태와 항목만 받아 로딩 → 오류(재시도) → 빈 결과 → 카드 순서로 나눕니다.
 * 훅까지 하나로 묶지 않은 이유는 조회 함수와 쿼리 모델이 목록마다 다르기 때문입니다.
 *
 * status 'refreshing'은 훅이 이전 결과(items)를 주므로 카드를 그대로 보여 줍니다.
 */
export default function TourCardPreview({ status, items, retry, errorMessage, emptyMessage }) {
  if (status === 'idle' || status === 'loading') return <TourCardSkeleton count={PREVIEW_COUNT} />
  if (status === 'error') return <SectionStatus variant="error" message={errorMessage} onRetry={retry} />

  const list = items ?? []
  if (list.length === 0) return <SectionStatus message={emptyMessage} />
  return <TourCardGrid cards={list.slice(0, PREVIEW_COUNT)} />
}
