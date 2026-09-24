/*
 * TourAPI 콘텐츠 유형(contentTypeId)과 WayLog 상세 라우트의 대응표입니다.
 *
 * Design Ref: §9 — 홈 카드, 상세 페이지의 id 해석, 상세 API 호출이 모두 이 파일의 규칙 하나를 따릅니다.
 * 목업 데이터는 import하지 않습니다. 목록 페이지가 API로 전환돼도 이 파일은 그대로 씁니다.
 */

// 여행지 상세(/destinations/detail/:id?type=)에서 다루는 유형
export const DESTINATION_CONTENT_TYPES = { attraction: 12, culture: 14 }

// 즐기기 상세(/enjoy/:category/:id)의 카테고리 slug별 유형
export const ENJOY_CONTENT_TYPES = { festivals: 15, leports: 28, food: 39, shopping: 38, stay: 32 }

// Design Ref: §2.2 — 목업 slug는 모두 숫자가 아니므로 이 형식과 겹치지 않습니다.
const TOUR_CONTENT_ID_PATTERN = /^\d{1,12}$/

export function isTourContentId(id) {
  return typeof id === 'string' && TOUR_CONTENT_ID_PATTERN.test(id)
}

export function isDestinationContentType(typeId) {
  return typeId === DESTINATION_CONTENT_TYPES.attraction || typeId === DESTINATION_CONTENT_TYPES.culture
}

// 즐기기 카테고리 slug → contentTypeId. 없는 카테고리('__proto__' 포함)는 null
export function getEnjoyContentType(category) {
  return Object.hasOwn(ENJOY_CONTENT_TYPES, category) ? ENJOY_CONTENT_TYPES[category] : null
}

/**
 * 홈 카드 등 실제 TourAPI 콘텐츠를 상세 화면 경로로 바꿉니다.
 *
 * Design Ref: §5.3 — 12·14는 여행지 상세, 15·28·39·38·32는 즐기기 상세로 보냅니다.
 * contentTypeId는 문자열("39")과 숫자를 모두 받습니다.
 * 경로를 정할 수 없으면 null을 반환하고, 호출하는 쪽이 목록 같은 대체 경로를 고릅니다.
 */
export function getTourDetailPath(contentId, contentTypeId) {
  const id = contentId == null ? '' : String(contentId)
  if (!isTourContentId(id)) return null

  const typeId = Number(contentTypeId)
  if (isDestinationContentType(typeId)) return `/destinations/detail/${id}?type=${typeId}`

  const category = Object.keys(ENJOY_CONTENT_TYPES).find(slug => ENJOY_CONTENT_TYPES[slug] === typeId)
  return category ? `/enjoy/${category}/${id}` : null
}
