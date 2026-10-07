import { getPageWindow } from '../../lib/pagination'

/**
 * 관리자 목록 화면이 공유하는 윈도잉 페이지네이션 (표시 컴포넌트)
 *
 * Design Ref: admin-dashboard.design.md §2.2 — 계산 로직(lib/pagination.js의 getPageWindow)은
 * 여행지 목록과 공유하지만, 관리자 화면 톤에 맞춘 별도 마크업·스타일을 씁니다
 * (components/tour-list/Pagination.jsx는 그대로 두고 도메인을 섞지 않습니다).
 */
export default function AdminPagination({ page, totalPages, onPageChange }) {
  if (!Number.isInteger(totalPages) || totalPages <= 1) return null

  const pages = getPageWindow(page, totalPages)
  const isFirst = page <= 1
  const isLast = page >= totalPages

  const goTo = target => {
    if (target !== page) onPageChange(target)
  }

  return (
    <nav className="admin-pagination" aria-label="페이지 이동">
      <button type="button" aria-label="이전 페이지" disabled={isFirst} onClick={() => goTo(page - 1)}>‹</button>
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
      <button type="button" aria-label="다음 페이지" disabled={isLast} onClick={() => goTo(page + 1)}>›</button>
    </nav>
  )
}
