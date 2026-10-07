import { LIST_PAGE_SIZE } from '../../lib/tourListQuery'

/**
 * 첫 로딩 자리 표시 (표시 컴포넌트)
 *
 * Design Ref: §5.1 loading, NFR 레이아웃 안정성 — 카드와 같은 그리드·같은 이미지 비율·같은 본문 높이를 써서
 * 결과가 도착해도 그리드 높이가 급변하지 않게 합니다. 스크린 리더에는 숨기고,
 * 진행 중 안내는 건수 영역(role="status")이 맡습니다.
 *
 * count 기본값은 한 페이지 크기(LIST_PAGE_SIZE)입니다. 호출부가 명시적으로 넘기지 않으면
 * 실제 목록과 같은 개수의 자리 표시를 그려 레이아웃이 흔들리지 않습니다.
 */
export default function TourCardSkeleton({ count = LIST_PAGE_SIZE }) {
  return (
    <div className="catalog-grid tour-list__grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="catalog-card tour-list__skeleton-card" key={index}>
          <div className="tour-list__skeleton-image" />
          <div className="tour-list__card-body">
            <span className="tour-list__skeleton-line tour-list__skeleton-line--title" />
            <span className="tour-list__skeleton-line tour-list__skeleton-line--address" />
          </div>
        </div>
      ))}
    </div>
  )
}
