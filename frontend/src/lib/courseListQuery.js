/*
 * 여행코스 목록 조건(query) ↔ URL 파싱·정규화·직렬화
 *
 * Design Ref: tour-course-list-integration.design.md §2.2, §3.1 — React와 네트워크를 모르는 순수 함수만 둡니다.
 * lib/tourListQuery.js와 파라미터 모델이 근본적으로 다릅니다(코스는 contentTypeId·지역·분류가 없고 keyword만 있음).
 * 그래서 합치지 않고 별도 모듈로 둡니다(설계 §2.2 "이유 있는 분리").
 *
 * CourseListQuery
 * { keyword: string, page: number }
 *
 * 관광지 목록과 달리 "조건 없음(null)" 상태가 없습니다. contentTypeId처럼 필수인 파라미터가 없어
 * URL이 비어 있어도 전체 코스 목록을 요청합니다(관리자·공지 목록과 같은 컨벤션).
 */

export const COURSE_LIST_PAGE_SIZE = 9

const COURSE_LIST_PATH = '/destinations/courses'
const MAX_KEYWORD_LENGTH = 255
// 1 ~ 9999. lib/tourListQuery.js의 PAGE_PATTERN과 같은 규칙(앞자리 0·부호·소수점 금지).
const PAGE_PATTERN = /^[1-9]\d{0,3}$/

function toText(value) {
  return value == null ? '' : String(value)
}

function normalizeKeyword(raw) {
  const trimmed = toText(raw).trim()
  return trimmed ? trimmed.slice(0, MAX_KEYWORD_LENGTH) : ''
}

function normalizePage(raw) {
  const text = toText(raw)
  return PAGE_PATTERN.test(text) ? Number(text) : 1
}

/**
 * 원시 값(문자열 혼합) → 정규화된 query. 항상 유효한 값을 반환합니다(null 없음).
 */
function normalizeQuery(raw) {
  return { keyword: normalizeKeyword(raw.keyword), page: normalizePage(raw.page) }
}

/**
 * 필드 객체 → 정규화된 query. 검색 모달처럼 URL이 아닌 선택값에서 query를 만들 때 씁니다.
 */
export function createCourseListQuery(fields = {}) {
  return normalizeQuery(fields)
}

/**
 * URL 쿼리 → 정규화된 query
 */
export function parseCourseListQuery(searchParams) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams ?? '')
  return normalizeQuery({ keyword: params.get('keyword'), page: params.get('page') })
}

/**
 * query → 정규 URL 쿼리. keyword가 없으면 생략하고 page=1도 생략합니다(기본값은 URL에 남기지 않음).
 */
export function serializeCourseListQuery(query) {
  const params = new URLSearchParams()
  if (!query) return params

  const normalized = normalizeQuery(query)
  if (normalized.keyword) params.set('keyword', normalized.keyword)
  if (normalized.page > 1) params.set('page', String(normalized.page))
  return params
}

/**
 * 조건 일부 변경 → 새 query
 *
 * Design Ref: 설계 §3.1 — keyword가 바뀌면 page를 1로 되돌립니다(다른 검색어의 3페이지는 의미가 없습니다).
 */
export function applyCourseQueryPatch(query, patch = {}) {
  const base = query ?? createCourseListQuery()
  const next = { ...base }

  if (Object.hasOwn(patch, 'keyword')) {
    const keyword = normalizeKeyword(patch.keyword)
    if (keyword !== base.keyword) next.page = 1
    next.keyword = keyword
  }

  if (Object.hasOwn(patch, 'page') && !Object.hasOwn(patch, 'keyword')) {
    next.page = patch.page
  }

  return normalizeQuery(next)
}

/**
 * query → '/destinations/courses?...' (검색 모달에서 사용, 설계 §9)
 * 입력을 다시 정규화하므로 선택값 객체를 그대로 넘겨도 됩니다.
 */
export function buildCourseListPath(query) {
  const search = serializeCourseListQuery(query ? normalizeQuery(query) : null).toString()
  return search ? `${COURSE_LIST_PATH}?${search}` : COURSE_LIST_PATH
}
