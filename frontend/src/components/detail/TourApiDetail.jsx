import { useTourDetail } from '../../hooks/useTourDetail'
import NotFoundPage from '../../pages/NotFoundPage'
import DetailStatus from './DetailStatus'
import { DETAIL_NOT_FOUND_DESCRIPTION, DETAIL_NOT_FOUND_TITLE } from './detailMessages'

/**
 * TourAPI 상세 조회 결과를 상태별 화면으로 나눕니다.
 *
 * Design Ref: §5.1 — 페이지는 성공했을 때의 화면(renderDetail)만 넘기고,
 * 로딩·오류·없음 화면은 두 상세 페이지가 이 컴포넌트를 함께 씁니다.
 *
 * 호출하는 쪽은 key={`${contentId}:${contentTypeId}`}를 줘야 합니다.
 * id가 바뀌면 이 컴포넌트와 그 아래 View가 함께 재마운트되어 이전 상태가 남지 않습니다.
 */
export default function TourApiDetail({ contentId, contentTypeId, backTo, renderDetail }) {
  const { status, detail, retry, hasRetried } = useTourDetail(contentId, contentTypeId)

  if (status === 'loading') return <DetailStatus variant="loading" />
  if (status === 'error') return <DetailStatus variant="error" onRetry={retry} backTo={backTo} focusOnMount={hasRetried} />
  if (status === 'not-found') {
    return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
  }
  return renderDetail(detail)
}
