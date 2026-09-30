/*
 * 외부 지도 딥링크
 *
 * Design Ref: tour-course-list-integration.design.md §5.2 — CUSTOM 경유지는 지도 SDK 없이
 * 좌표만으로 만들 수 있는 카카오맵 웹 링크로 "지도에서 보기"를 제공합니다(D-1).
 * 이 프로젝트 최초의 지도 딥링크입니다(기존 코드는 전부 "지도 API 연동 영역" 플레이스홀더였습니다).
 */

/**
 * @returns 좌표가 없으면 null(거짓 UI 금지 — 버튼 자체를 렌더링하지 않게 합니다)
 */
export function buildKakaoMapLink({ name, latitude, longitude } = {}) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  const label = name && name.trim() ? name.trim() : '경유지'
  return `https://map.kakao.com/link/map/${encodeURIComponent(label)},${latitude},${longitude}`
}
