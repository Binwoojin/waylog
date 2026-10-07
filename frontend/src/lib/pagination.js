/*
 * 페이지네이션 창 계산
 *
 * Design Ref: §5.6, FR-09 — 모든 페이지 버튼을 그리지 않고 현재 페이지 주변만 보여 줍니다.
 * 상태가 없는 계산이라 훅이 아닌 순수 함수로 둡니다(§2.0 B안 위험 대응: usePaginationRange 훅 → 함수).
 */

/**
 * @returns {number[]} 보여 줄 페이지 번호. totalPages가 0 이하면 []
 * - totalPages ≤ windowSize: 1 ~ totalPages
 * - 앞쪽: 1 ~ windowSize / 뒤쪽: totalPages − windowSize + 1 ~ totalPages
 * - 가운데: 현재 페이지를 가운데에 둡니다
 */
export function getPageWindow(page, totalPages, windowSize = 5) {
  if (!Number.isInteger(totalPages) || totalPages <= 0) return []

  const size = Math.max(1, Math.min(windowSize, totalPages))
  // 범위를 벗어난 page(보정 전 URL 값)가 와도 창이 비지 않게 1 ~ totalPages로 맞춥니다.
  const current = Math.min(Math.max(Number.isInteger(page) ? page : 1, 1), totalPages)
  const start = Math.min(Math.max(current - Math.floor(size / 2), 1), totalPages - size + 1)

  return Array.from({ length: size }, (_, index) => start + index)
}
