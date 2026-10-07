import { SORT_OPTIONS } from '../data/tourListConfigs'
import { ENJOY_CONTENT_TYPES } from '../data/tourContentTypes'

/*
 * 즐길거리 목록 조건(query) ↔ URL 파싱·정규화·직렬화
 *
 * lib/tourListQuery.js와 같은 원칙(§3.2류 정규화 규칙, 기본값은 URL에 남기지 않음)을 즐길거리
 * 쿼리 모델에 맞게 다시 만듭니다. tourListQuery.js는 TOUR_LIST_CONFIGS(관광지·문화시설, 분류
 * 코드 lclsSystm)에 묶여 있고, 그 설정은 TourReferencePicker(여행코스 경유지 선택 모달)도 함께
 * 순회합니다. 그 맵에 즐길거리 유형(축제·레포츠·음식점·쇼핑·숙박)을 추가하면 관련 없는 그 화면에도
 * 새 탭이 끼어들게 되므로, 공용 모듈을 확장하지 않고 CourseListQuery(lib/courseListQuery.js, "이유
 * 있는 분리")와 같은 방식으로 병렬 모듈을 둡니다.
 *
 * EnjoyListQuery
 * { contentTypeId: 15|28|39|38|32, arrange: 'Q'|'O', page: number }
 * 즐기기 검색 모달은 지역·시군구·세부 항목에 실제 선택지가 없고 "전체" 하나뿐이라(EnjoySearchModal.jsx)
 * 쿼리에 두지 않습니다. 유형이 없거나 허용값이 아니면(검색 조건 없음) null입니다.
 */

export const ENJOY_LIST_PAGE_SIZE = 9
export const DEFAULT_ENJOY_ARRANGE = 'Q'

const ENJOY_SEARCH_PATH = '/enjoy/search'

// 1 ~ 9999. lib/tourListQuery.js의 PAGE_PATTERN과 같은 규칙(앞자리 0·부호·소수점 금지).
const PAGE_PATTERN = /^[1-9]\d{0,3}$/

// 문자열로 비교합니다(Number() 변환 금지). '0x0f'나 '15.0'이 15로 인정되지 않게 하며, lib/tourListQuery.js와 같은 규칙입니다.
const ENJOY_CONTENT_TYPE_ID_TEXTS = new Set(Object.values(ENJOY_CONTENT_TYPES).map(String))

// 결과 배너·제목에 쓰는 유형 이름. 화면 설정 모듈(data/enjoyCategoryConfig.js)을 import하지 않습니다.
// 이 파일이 화면 설정에 의존하지 않도록 하기 위해서입니다(tourListConfigs.js와 같은 원칙).
const ENJOY_TYPE_LABELS = {
  [ENJOY_CONTENT_TYPES.festivals]: '축제 · 행사',
  [ENJOY_CONTENT_TYPES.leports]: '레포츠',
  [ENJOY_CONTENT_TYPES.food]: '음식점',
  [ENJOY_CONTENT_TYPES.shopping]: '쇼핑',
  [ENJOY_CONTENT_TYPES.stay]: '숙박',
}

function toText(value) {
  return value == null ? '' : String(value)
}

// 원시 값(문자열·숫자 혼합) → 정규화된 query. 유형이 허용값이 아니면 null
function normalizeQuery(raw) {
  const typeText = toText(raw.contentTypeId)
  if (!ENJOY_CONTENT_TYPE_ID_TEXTS.has(typeText)) return null
  const typeId = Number(typeText)

  const arrangeText = toText(raw.arrange)
  const arrange = SORT_OPTIONS.some(option => option.value === arrangeText) ? arrangeText : DEFAULT_ENJOY_ARRANGE

  const pageText = toText(raw.page)
  const page = PAGE_PATTERN.test(pageText) ? Number(pageText) : 1

  return { contentTypeId: typeId, arrange, page }
}

/**
 * 필드 객체 → 정규화된 query | null. 검색 모달처럼 URL이 아닌 선택값에서 query를 만들 때 씁니다.
 */
export function createEnjoyListQuery(fields = {}) {
  return normalizeQuery(fields)
}

/**
 * URL 쿼리 → 정규화된 query | null
 */
export function parseEnjoyListQuery(searchParams) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams ?? '')
  return normalizeQuery({
    contentTypeId: params.get('contentTypeId'),
    arrange: params.get('arrange'),
    page: params.get('page'),
  })
}

/**
 * query → 정규 URL 쿼리. 기본값(arrange='Q', page=1)은 생략합니다.
 */
export function serializeEnjoyListQuery(query) {
  const params = new URLSearchParams()
  if (!query) return params

  const normalized = normalizeQuery(query)
  if (!normalized) return params

  params.set('contentTypeId', String(normalized.contentTypeId))
  if (normalized.arrange !== DEFAULT_ENJOY_ARRANGE) params.set('arrange', normalized.arrange)
  if (normalized.page > 1) params.set('page', String(normalized.page))
  return params
}

/**
 * 조건 일부 변경 → 새 query. 유형·정렬이 바뀌면 page는 1로 되돌립니다(다른 조건의 3페이지는 의미가 없습니다).
 */
export function applyEnjoyQueryPatch(query, patch = {}) {
  if (!query) return null

  const next = { ...query }
  let filtersChanged = false

  for (const key of ['contentTypeId', 'arrange']) {
    if (!Object.hasOwn(patch, key)) continue
    const value = patch[key] === '' || patch[key] === undefined ? null : patch[key]
    if (toText(value) !== toText(query[key])) filtersChanged = true
    next[key] = value
  }

  if (filtersChanged) next.page = 1
  else if (Object.hasOwn(patch, 'page')) next.page = patch.page

  return normalizeQuery(next)
}

/**
 * query → '/enjoy/search?...' (검색 모달에서 사용). 입력을 다시 정규화하므로 선택값 객체를 그대로
 * 넘겨도 됩니다. 유형이 없으면 조건 없는 검색 결과 경로입니다.
 */
export function buildEnjoySearchPath(query) {
  const search = serializeEnjoyListQuery(query ? normalizeQuery(query) : null).toString()
  return search ? `${ENJOY_SEARCH_PATH}?${search}` : ENJOY_SEARCH_PATH
}

/**
 * query → /api/v1/search 요청 파라미터
 * options.size는 미리보기처럼 건수를 줄일 때만 씁니다(기본 ENJOY_LIST_PAGE_SIZE).
 */
export function toEnjoyApiParams(query, { size = ENJOY_LIST_PAGE_SIZE } = {}) {
  if (!query) throw new Error('즐길거리 목록 조건이 올바르지 않습니다.')

  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('size', String(size))
  params.set('contentTypeId', String(query.contentTypeId))
  params.set('arrange', query.arrange || DEFAULT_ENJOY_ARRANGE)
  return params
}

// contentTypeId → 결과 배너·제목에 쓰는 유형 이름. 모르는 유형이면 일반 명칭으로 대체합니다.
export function getEnjoyTypeLabel(contentTypeId) {
  return ENJOY_TYPE_LABELS[Number(contentTypeId)] ?? '즐길거리'
}
