import { SORT_OPTIONS, findListCategory, getListConfigByContentType } from '../data/tourListConfigs'

/*
 * 여행지 목록 조건(query) ↔ URL 파싱·정규화·직렬화
 *
 * Design Ref: §1.2, §9.1 — React와 네트워크를 모르는 순수 함수만 둡니다.
 * 카탈로그·검색 결과·검색 모달이 같은 규칙으로 URL을 읽고 씁니다.
 *
 * TourListQuery
 * { contentTypeId: 12 | 14, lDongRegnCd: string | null, lDongSignguCd: string | null,
 *   category: string | null, arrange: 'Q' | 'O', page: number }
 * category는 유형의 분류 파라미터(12 → lclsSystm1, 14 → lclsSystm2) 값입니다.
 * 이름을 하나로 두어 화면 코드가 유형별 파라미터 이름을 몰라도 되게 합니다.
 *
 * 두 가지 모드
 * - 카탈로그: 라우트가 유형을 정합니다. URL에 contentTypeId를 두지 않습니다(includeContentType: false).
 * - 검색 결과: URL의 contentTypeId가 필수입니다. 없거나 허용값이 아니면 조건 없음(null)입니다.
 */

export const DEFAULT_ARRANGE = 'Q'
export const LIST_PAGE_SIZE = 9

const SEARCH_RESULTS_PATH = '/destinations/search'

// Design Ref: §3.1 — 세종(36110)이 5자리라 시·도 코드는 2 ~ 5자리를 허용합니다.
const REGION_CODE_PATTERN = /^\d{2,5}$/
const DISTRICT_CODE_PATTERN = /^\d{1,5}$/
// 1 ~ 9999. 앞자리 0('01'), 부호, 소수점, 지수 표기를 받지 않아 한 목록에 URL이 여러 개 생기지 않습니다.
const PAGE_PATTERN = /^[1-9]\d{0,3}$/

function toText(value) {
  if (value == null) return ''
  return String(value)
}

/**
 * 원시 값(문자열·숫자·null 혼합) → 정규화된 query. 유형을 정할 수 없으면 null
 *
 * Design Ref: §3.2 — 파싱과 applyQueryPatch가 같은 규칙을 쓰도록 한 곳에 둡니다.
 * 허용값이 아닌 값은 버리고 기본값을 씁니다. 모든 비교는 문자열로 합니다(Number() 변환 금지).
 */
function normalizeQuery(raw) {
  // 규칙 1: 유형이 허용값이 아니면 나머지를 보지 않습니다.
  const config = getListConfigByContentType(raw.contentTypeId)
  if (!config) return null

  const regionText = toText(raw.lDongRegnCd)
  const lDongRegnCd = REGION_CODE_PATTERN.test(regionText) ? regionText : null

  // 규칙 3: 시·도 없이 시군구만 있는 조합은 백엔드가 400으로 거절하므로 버립니다.
  const districtText = toText(raw.lDongSignguCd)
  const lDongSignguCd = lDongRegnCd && DISTRICT_CODE_PATTERN.test(districtText) ? districtText : null

  // 규칙 4: 유형에 없는 분류 코드(관광지에 VE07, 문화시설에 NA)는 버립니다.
  const categoryText = toText(raw.category)
  const category = findListCategory(config, categoryText) ? categoryText : null

  const arrangeText = toText(raw.arrange)
  const arrange = SORT_OPTIONS.some(option => option.value === arrangeText) ? arrangeText : DEFAULT_ARRANGE

  // 규칙 6: 총 페이지 상한은 응답이 와야 알 수 있으므로 여기서는 형식만 봅니다(초과 보정은 TourListView).
  const pageText = toText(raw.page)
  const page = PAGE_PATTERN.test(pageText) ? Number(pageText) : 1

  return { contentTypeId: config.contentTypeId, lDongRegnCd, lDongSignguCd, category, arrange, page }
}

/**
 * 필드 객체 → 정규화된 query. 유형이 없거나 허용값이 아니면 null
 * 검색 모달처럼 URL이 아닌 선택값에서 query를 만들 때 씁니다. 빈 문자열('')은 "선택 안 함"입니다.
 */
export function createTourListQuery(fields = {}) {
  return normalizeQuery(fields)
}

/**
 * URL 쿼리 → 정규화된 query | null
 *
 * @param searchParams URLSearchParams 또는 쿼리 문자열
 * @param options.contentTypeId 있으면 카탈로그 모드(라우트가 유형 결정), 없으면 검색 모드(URL에서 읽음)
 */
export function parseTourListQuery(searchParams, { contentTypeId } = {}) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams ?? '')
  const isCatalog = contentTypeId != null

  const config = getListConfigByContentType(isCatalog ? contentTypeId : params.get('contentTypeId'))
  if (!config) return null

  // 규칙 5: 알 수 없는 파라미터(예전 형식 region·type 포함)는 읽지 않으므로 직렬화할 때 사라집니다.
  // 같은 키가 여러 번 있으면 첫 값만 씁니다(URLSearchParams.get).
  return normalizeQuery({
    contentTypeId: config.contentTypeId,
    lDongRegnCd: params.get('lDongRegnCd'),
    lDongSignguCd: params.get('lDongSignguCd'),
    category: params.get(config.categoryParam),
    arrange: params.get('arrange'),
    page: params.get('page'),
  })
}

/**
 * query → 정규 URL 쿼리
 *
 * Design Ref: §3.1, §3.2 — 파라미터 순서는 URL 스키마 표 순서로 고정하고 기본값은 생략합니다.
 * 같은 조건이면 항상 같은 문자열이 나오므로, 현재 URL과 비교해 정규화 여부를 판단할 수 있습니다.
 *
 * @param options.includeContentType 검색 결과는 true(기본), 카탈로그는 false(유형은 라우트가 가짐)
 */
export function serializeTourListQuery(query, { includeContentType = true } = {}) {
  const params = new URLSearchParams()
  if (!query) return params

  const config = getListConfigByContentType(query.contentTypeId)
  if (!config) return params

  if (includeContentType) params.set('contentTypeId', String(config.contentTypeId))
  if (query.lDongRegnCd) params.set('lDongRegnCd', query.lDongRegnCd)
  if (query.lDongRegnCd && query.lDongSignguCd) params.set('lDongSignguCd', query.lDongSignguCd)
  if (query.category) params.set(config.categoryParam, query.category)
  if (query.arrange && query.arrange !== DEFAULT_ARRANGE) params.set('arrange', query.arrange)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

/**
 * 조건 일부 변경 → 새 query
 *
 * Design Ref: §3.2 updateQuery 규칙
 * - page 외의 값이 바뀌면 page는 1로 돌아갑니다(FR-05). 다른 조건의 3페이지는 의미가 없습니다.
 * - 시·도가 바뀌면 시군구를 지웁니다. 같은 patch에 시군구가 함께 있으면 그 값을 씁니다.
 * - 유형이 바뀌면 새 유형에 없는 분류는 정규화에서 버려집니다.
 * 결과는 다시 정규화하므로 잘못된 patch 값이 URL로 새어 나가지 않습니다.
 */
export function applyQueryPatch(query, patch = {}) {
  if (!query) return null

  const next = { ...query }
  let filtersChanged = false

  for (const key of ['contentTypeId', 'lDongRegnCd', 'lDongSignguCd', 'category', 'arrange']) {
    if (!Object.hasOwn(patch, key)) continue
    const value = patch[key] === '' || patch[key] === undefined ? null : patch[key]
    if (toText(value) !== toText(query[key])) filtersChanged = true
    next[key] = value
  }

  if (Object.hasOwn(patch, 'lDongRegnCd') && !Object.hasOwn(patch, 'lDongSignguCd')
    && toText(next.lDongRegnCd) !== toText(query.lDongRegnCd)) {
    next.lDongSignguCd = null
  }

  if (filtersChanged) next.page = 1
  else if (Object.hasOwn(patch, 'page')) next.page = patch.page

  return normalizeQuery(next)
}

/**
 * query → /api/v1/search 요청 파라미터
 *
 * Design Ref: §4.2 — size는 URL에 두지 않는 화면 설정입니다. 기본은 목록 페이지 크기(9)이고,
 * 미리보기처럼 적은 건수만 필요한 화면은 options.size로 줄입니다(URL 조건이 아니므로 query 모델에는 넣지 않습니다).
 * 문화시설(중분류)은 분류 코드의 앞 2자리를 lclsSystm1로 함께 보냅니다.
 * 백엔드 보정(BE-1)이 없어도 원본 조회가 대분류 범위로 좁혀지고, 서버 캐시 키가 요청 경로와 관계없이 같아집니다.
 */
export function toTourApiParams(query, { size = LIST_PAGE_SIZE } = {}) {
  const config = query ? getListConfigByContentType(query.contentTypeId) : null
  if (!config) throw new Error('목록 조건의 여행지 유형이 올바르지 않습니다.')

  const params = new URLSearchParams()
  params.set('page', String(query.page))
  params.set('size', String(size))
  params.set('contentTypeId', String(config.contentTypeId))
  if (query.lDongRegnCd) params.set('lDongRegnCd', query.lDongRegnCd)
  if (query.lDongRegnCd && query.lDongSignguCd) params.set('lDongSignguCd', query.lDongSignguCd)
  if (query.category) {
    if (config.categoryParam === 'lclsSystm2') params.set('lclsSystm1', query.category.slice(0, 2))
    params.set(config.categoryParam, query.category)
  }
  params.set('arrange', query.arrange || DEFAULT_ARRANGE)
  return params
}

/**
 * query → '/destinations/search?...' (검색 모달, 랜딩에서 사용)
 * 입력을 다시 정규화하므로 선택값 객체를 그대로 넘겨도 됩니다. 유형이 없으면 조건 없는 검색 결과 경로입니다.
 */
export function buildSearchResultsPath(query) {
  const search = serializeTourListQuery(query ? normalizeQuery(query) : null).toString()
  return search ? `${SEARCH_RESULTS_PATH}?${search}` : SEARCH_RESULTS_PATH
}
