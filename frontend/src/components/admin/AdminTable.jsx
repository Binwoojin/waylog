/**
 * 관리자 목록 화면이 공유하는 테이블 (표시 컴포넌트)
 *
 * Design Ref: admin-dashboard.design.md §2.2 FR-D04 — 공지·여행코스·회원·피드 목록 4곳이
 * 같은 로딩·빈 상태·오류 규칙을 쓰도록 훅·API를 모르는 표시 컴포넌트로 만듭니다.
 *
 * @param columns   [{ key, header, width?, render?(row) }]
 * @param rows      row 배열 (status가 'loading'일 때는 무시하고 스켈레톤을 그림)
 * @param rowKey    row => React key
 * @param status    'loading' | 'refreshing' | 'success' | 'error'
 * @param onRetry   status === 'error'일 때 "다시 시도" 동작
 * @param emptyMessage  성공했지만 rows가 비었을 때 안내 문구
 */
export default function AdminTable({ columns, rows, rowKey, status, onRetry, emptyMessage = '등록된 항목이 없습니다.' }) {
  if (status === 'error') {
    return (
      <div className="admin-table__status" role="alert">
        <p>목록을 불러오지 못했습니다.</p>
        <button type="button" className="admin-button admin-button--primary" onClick={onRetry}>다시 시도</button>
      </div>
    )
  }

  const isLoading = status === 'loading'
  const isRefreshing = status === 'refreshing'

  return (
    <table className="admin-table" aria-busy={isRefreshing || undefined}>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={column.key} style={column.width ? { width: column.width } : undefined}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <tr key={index} className="admin-table__skeleton-row">
              {columns.map(column => (
                <td key={column.key}>&nbsp;</td>
              ))}
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="admin-table__empty">{emptyMessage}</td>
          </tr>
        ) : (
          rows.map(row => (
            <tr key={rowKey(row)} className={isRefreshing ? 'admin-table__row--refreshing' : undefined}>
              {columns.map(column => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
