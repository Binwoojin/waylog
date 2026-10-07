import { getPageWindow } from '../../lib/pagination'

/**
 * 윈도잉 페이지네이션 (표시 컴포넌트)
 *
 * Design Ref: §5.6 FR-09 — [처음] [이전] {현재 주변 5개} [다음] [끝]
 * 모든 페이지 버튼을 그리지 않아 페이지가 많아도 한 줄에 들어갑니다.
 * 좁은 화면(≤620px)에서는 처음·끝 버튼을 CSS로 숨겨 7개만 남깁니다(§5.7).
 * totalPages가 1 이하면 그리지 않습니다.
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (!Number.isInteger(totalPages) || totalPages <= 1) return null

  const pages = getPageWindow(page, totalPages)
  const isFirst = page <= 1
  const isLast = page >= totalPages

  const goTo = target => {
    if (target !== page) onPageChange(target)
  }

  return (
    <nav className="catalog-pagination tour-list__pagination" aria-label="페이지 이동">
      <button className="tour-list__page-step tour-list__page-edge" type="button" aria-label="첫 페이지" disabled={isFirst} onClick={() => goTo(1)}>
        «
      </button>
      <button className="tour-list__page-step" type="button" aria-label="이전 페이지" disabled={isFirst} onClick={() => goTo(page - 1)}>
        ‹
      </button>
      {pages.map(pageNumber => {
        const isCurrent = pageNumber === page
        return (
          <button
            key={pageNumber}
            type="button"
            className={isCurrent ? 'is-active' : undefined}
            aria-label={`${pageNumber}페이지`}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={() => goTo(pageNumber)}
          >
            {pageNumber}
          </button>
        )
      })}
      <button className="tour-list__page-step" type="button" aria-label="다음 페이지" disabled={isLast} onClick={() => goTo(page + 1)}>
        ›
      </button>
      <button className="tour-list__page-step tour-list__page-edge" type="button" aria-label="마지막 페이지" disabled={isLast} onClick={() => goTo(totalPages)}>
        »
      </button>
    </nav>
  )
}
