import { apiClient } from './client'
import { getTourDetailPath, isTourContentId } from '../data/tourContentTypes'
import { LIST_PAGE_SIZE, toTourApiParams } from '../lib/tourListQuery'
import { ENJOY_LIST_PAGE_SIZE, toEnjoyApiParams } from '../lib/enjoyListQuery'

/*
 * TourAPI 콘텐츠 API 모듈
 *
 * Design Ref: §9 — 화면은 상세 API URL을 직접 쓰지 않고 이 함수만 호출합니다.
 * 응답은 출처(목업/API)와 관계없이 상세 화면이 쓰는 view model(§3.1)로 바꿔 돌려줍니다.
 */

const EMPTY_ADDRESS = '주소 정보 없음'
const CONTACT_LABELS = ['문의 및 안내', '문의']

/**
 * 통합 상세 조회: GET /api/v1/tour/contents/{contentId}?contentTypeId=
 *
 * 성공: view model 반환
 * 실패: ApiError(404·400·502 등, client가 던짐) 또는 형식이 다른 응답이면 Error
 */
export async function fetchTourDetail(contentId, contentTypeId) {
  // Design Ref: §7 — contentId는 경로에 넣기 전에 인코딩하고, 쿼리는 URLSearchParams로 직렬화합니다.
  const query = new URLSearchParams({ contentTypeId: String(contentTypeId) })
  const data = await apiClient.get(`/api/v1/tour/contents/${encodeURIComponent(contentId)}?${query}`)
  return toTourDetail(data)
}

/**
 * API 응답(TourDetailResponse) → 상세 view model
 *
 * Design Ref: §1.2 fail-closed — client.js는 JSON이 아닌 200 응답을 {}로 돌려주므로,
 * 제목이 없는 응답은 성공으로 보지 않고 오류로 처리합니다(빈 상세 화면 방지).
 */
export function toTourDetail(data) {
  if (!data || typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('상세 응답 형식이 올바르지 않습니다.')
  }

  const infos = (Array.isArray(data.detailInfos) ? data.detailInfos : [])
    .map(info => ({ label: toPlainText(info?.label), value: toPlainText(info?.value) }))
    // Design Ref: §3.2 규칙 5 — 정리 후 값이 비는 항목은 표시하지 않습니다.
    .filter(info => info.label && info.value)

  const contactInfo = infos.find(info => CONTACT_LABELS.includes(info.label))

  return {
    source: 'api',
    id: String(data.contentId ?? ''),
    title: data.title.trim(),
    image: typeof data.image === 'string' && data.image.trim() ? data.image : null,
    address: typeof data.address === 'string' && data.address.trim() ? data.address.trim() : EMPTY_ADDRESS,
    typeLabel: typeof data.contentTypeName === 'string' ? data.contentTypeName : '',
    description: toPlainText(data.overview),
    infos,
    contact: contactInfo ? contactInfo.value : null,
    // Design Ref: bookmark-initial-state(백엔드 완료) — 컨트롤러가 캐시 결과에 요청자 개인화 값을
    // 덮어써서 내려주므로 프론트는 이 필드를 그대로 신뢰합니다. 비로그인이면 항상 false입니다.
    bookmarked: Boolean(data.bookmarked),
  }
}

/**
 * TourAPI 텍스트의 HTML을 줄바꿈이 있는 순수 텍스트로 바꿉니다.
 *
 * Design Ref: §3.2 — overview·detailInfos에는 <br>, &nbsp; 등이 섞여 옵니다.
 * DOMParser로 만든 문서는 스크립트를 실행하지 않고 이미지도 불러오지 않으므로
 * 태그 제거·엔티티 복원에 안전하게 쓸 수 있습니다. 결과는 텍스트로만 렌더링합니다(dangerouslySetInnerHTML 미사용).
 */
export function toPlainText(value) {
  if (value == null) return ''

  // <br> 바로 뒤에 원문 개행이 이어지면(<br>\n) 줄바꿈이 두 번 생기므로 뒤따르는 개행까지 함께 치환합니다.
  const withLineBreaks = String(value).replace(/<br\s*\/?>[ \t]*(?:\r?\n)?/gi, '\n')
  const text = new DOMParser().parseFromString(withLineBreaks, 'text/html').body.textContent ?? ''

  return text
    // &nbsp;는 DOMParser가 U+00A0으로 복원하므로 일반 공백으로 바꿉니다.
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/*
 * 전화번호 패턴: 한국 전화번호 형태만 번호로 인정합니다.
 * - 0으로 시작하는 지역번호·휴대폰·050x 번호. 지역번호 괄호 허용: "(064)710-7912", "02)2133-5555"
 * - 국제 형식 +82. 지역번호 앞 0은 생략 가능: "+82-2-1234-5678"
 * - 15xx ~ 19xx 대표번호: "1588-1234"
 * 구분자는 하이픈·점만 허용하고, 공백은 지역번호 뒤에서만 허용합니다.
 * 공백·괄호를 번호 안쪽 문자로 허용하면 "02-123-4567 (2)"의 뒤 숫자까지 한 번호로 합쳐지기 때문입니다.
 * 앞뒤에 숫자가 붙어 있으면 번호의 일부만 잡은 것이므로 매치하지 않습니다(lookbehind/lookahead).
 */
const PHONE_NUMBER_PATTERN = /(?<!\d)(?:(?:\+82[-. ]?\(?0?\d{1,3}\)?|\(?0\d{1,3}\)?)[-. ]?\d{3,4}[-.]?\d{4}|1[5-9]\d{2}[-.]?\d{4})(?!\d)/g
// 번호 밖에 이만큼 이어진 숫자가 남아 있으면 인식하지 못한 다른 번호일 수 있습니다("1330 1588-1234").
// "09:00~18:00"의 시각, "내선 23"은 2자리라 해당하지 않습니다.
const LEFTOVER_NUMBER_PATTERN = /\d{4,}/
const PHONE_MIN_DIGITS = 7
const PHONE_MAX_DIGITS = 12

/**
 * 문의처 문자열 → tel: 링크. 전화번호 하나로 확정할 수 없으면 null(텍스트로만 표시)
 *
 * Design Ref: §3.2 연락처 링크, §7 — 외부 문자열을 href에 그대로 넣지 않고,
 * 번호가 여러 개인 문의처를 이어 붙여 엉뚱한 번호로 전화 거는 일을 막습니다.
 * 잘못된 번호로 전화가 걸리는 것보다 링크가 없는 편이 안전하므로, 확신할 수 없으면 null입니다.
 * 1. 한국 전화번호 형태(PHONE_NUMBER_PATTERN)가 정확히 1개가 아니면 null
 * 2. 번호를 뺀 나머지에 4자리 이상 숫자가 남아 있으면 null (다른 번호일 수 있음)
 * 3. "02-3700-3900~1"처럼 ~로 이어진 범위 번호면 null
 * 4. 숫자가 7~12자리가 아니면 null (국가번호 +는 유지)
 * 두 상세 화면이 함께 씁니다.
 */
export function toTelHref(contact) {
  if (typeof contact !== 'string') return null

  const numbers = [...contact.matchAll(PHONE_NUMBER_PATTERN)]
  if (numbers.length !== 1) return null

  const [match] = numbers
  const before = contact.slice(0, match.index)
  const after = contact.slice(match.index + match[0].length)
  if (LEFTOVER_NUMBER_PATTERN.test(before) || LEFTOVER_NUMBER_PATTERN.test(after)) return null
  if (/~\s*$/.test(before) || /^\s*~/.test(after)) return null

  const digits = match[0].replace(/\D/g, '')
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) return null

  return `tel:${match[0].startsWith('+') ? '+' : ''}${digits}`
}

/*
 * 목록 조회 (destination-list-integration)
 *
 * Design Ref: §3.3, §4.2 — 목록 화면은 API 필드 이름을 모르고 TourCard view model만 씁니다.
 */

function toNonEmptyText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * 목록 조회: GET /api/v1/search
 *
 * 성공: TourListResult { items: TourCard[], totalCount, page, totalPages }
 * 실패: ApiError(400·502 등), 형식이 다른 응답이면 Error, 취소되면 AbortError(DOMException)
 */
export async function fetchTourList(query, { signal } = {}) {
  // Design Ref: §7 — 쿼리 문자열은 URLSearchParams로만 만듭니다(화이트리스트를 통과한 값만 들어감).
  const params = toTourApiParams(query)
  const data = await apiClient.get(`/api/v1/search?${params}`, { signal })
  return toTourList(data, { size: LIST_PAGE_SIZE, page: query.page, contentTypeId: query.contentTypeId })
}

/**
 * 즐길거리 목록 조회: GET /api/v1/search (contentTypeId만 다를 뿐 같은 엔드포인트·응답 모양)
 *
 * EnjoySearchResultsPage 전용입니다. lib/enjoyListQuery.js의 EnjoyListQuery({ contentTypeId, arrange, page })를
 * 받아 같은 TourListResponse 모양을 돌려주므로 toTourList·toTourCard(위)를 그대로 재사용합니다.
 * 목록 조건 모델은 lib/tourListQuery.js(TOUR_LIST_CONFIGS 전제)와 분리되어 있지만, 응답 파싱 로직까지
 * 따로 둘 이유는 없습니다(§9 "같은 응답은 같은 변환 함수를 씁니다").
 */
export async function fetchEnjoyList(query, { signal } = {}) {
  const params = toEnjoyApiParams(query)
  const data = await apiClient.get(`/api/v1/search?${params}`, { signal })
  return toTourList(data, { size: ENJOY_LIST_PAGE_SIZE, page: query.page, contentTypeId: query.contentTypeId })
}

/**
 * API 응답(TourListResponse) → TourListResult
 *
 * Design Ref: §3.3 FR-02
 * - totalPages는 요청한 size로 계산합니다. 응답의 size는 마지막 페이지에서 남은 건수로 줄어듭니다.
 * - fail-closed: items가 배열이 아니거나 totalCount가 0 이상의 정수가 아니면 성공으로 보지 않습니다
 *   (client.js는 JSON이 아닌 200 응답을 {}로 돌려줍니다).
 * - 버린 카드가 있어도 totalCount는 서버 값을 그대로 씁니다.
 *
 * @param options.size 요청한 페이지 크기
 * @param options.page 요청한 페이지. 화면의 기준은 URL이므로 응답의 page보다 우선합니다
 * @param options.contentTypeId 항목에 contentTypeId가 없을 때 상세 경로에 쓸 요청 유형
 */
export function toTourList(data, { size = LIST_PAGE_SIZE, page, contentTypeId } = {}) {
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.totalCount) || data.totalCount < 0) {
    throw new Error('목록 응답 형식이 올바르지 않습니다.')
  }

  const seenIds = new Set()
  const items = []
  for (const item of data.items) {
    const card = toTourCard(item, contentTypeId)
    // 같은 contentId가 두 번 오면 React key가 겹치므로 첫 항목만 씁니다.
    if (!card || seenIds.has(card.id)) continue
    seenIds.add(card.id)
    items.push(card)
  }

  const totalCount = data.totalCount
  const resolvedPage = Number.isInteger(page) && page > 0
    ? page
    : (Number.isInteger(data.page) && data.page > 0 ? data.page : 1)

  return {
    items,
    totalCount,
    page: resolvedPage,
    totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / size),
  }
}

/**
 * 목록 항목(TourSummaryResponse) → TourCard | null
 *
 * Design Ref: §3.3 FR-03 — 상세로 연결할 수 없거나 제목이 없는 카드는 버립니다(fail-closed).
 * 빈 제목 카드, 링크 없는 카드를 만들지 않습니다.
 *
 * @param fallbackContentTypeId 항목에 contentTypeId가 없을 때 쓸 요청 유형
 */
export function toTourCard(item, fallbackContentTypeId) {
  if (!item || typeof item !== 'object') return null

  const id = item.contentId == null ? '' : String(item.contentId)
  if (!isTourContentId(id)) return null

  const title = toNonEmptyText(item.title)
  if (!title) return null

  const detailPath = getTourDetailPath(id, item.contentTypeId ?? fallbackContentTypeId)
  if (!detailPath) return null

  return {
    id,
    title,
    address: toNonEmptyText(item.address) ?? EMPTY_ADDRESS,
    // 빈 문자열은 없는 이미지로 봅니다. 둘 다 없으면 카드가 기본 이미지를 씁니다.
    image: toNonEmptyText(item.image) ?? toNonEmptyText(item.thumbnail),
    // 중분류 이름이 더 구체적입니다. 둘 다 없으면 배지를 표시하지 않습니다.
    category: toNonEmptyText(item.lclsSystm2Nm) ?? toNonEmptyText(item.lclsSystm1Nm),
    detailPath,
    // Design Ref: admin-dashboard.design.md §3.3.2 — 여행코스 REFERENCE 경유지(TourReferencePicker)가
    // 선택 시점의 스냅샷(contentTypeId, 좌표)을 저장해야 해서 추가했습니다. 기존 카드 UI는 이 필드들을
    // 쓰지 않으므로 하위 호환에 영향이 없습니다. TourSummaryResponse에는 이미 있던 필드입니다.
    contentTypeId: item.contentTypeId ?? fallbackContentTypeId ?? null,
    latitude: typeof item.latitude === 'number' ? item.latitude : null,
    longitude: typeof item.longitude === 'number' ? item.longitude : null,
  }
}

/*
 * 지역·시군구 선택지 (FR-13)
 *
 * Design Ref: §4.2 — 로컬 JSON API라 앱 수명 동안 변하지 않으므로 모듈 메모리에 캐시합니다.
 * - 값이 아니라 Promise를 저장해, 같은 키를 동시에 요청해도 네트워크 요청은 1회입니다.
 * - 실패하면 캐시에서 지워 다음 호출(다시 시도)이 새로 요청합니다.
 * - signal을 받지 않습니다. 여러 컴포넌트가 같은 Promise를 공유하므로
 *   한 컴포넌트의 언마운트가 다른 컴포넌트의 요청까지 취소하면 안 됩니다(client.js refreshSession과 같은 이유).
 * 목록 결과는 캐시하지 않습니다. 서버 캐시(tourLists)가 TourAPI 호출을 막고, 무효화할 수 없는 캐시를 늘리지 않습니다(§2.4).
 */
const optionCache = new Map()

function loadOptions(cacheKey, path, valueField) {
  const cached = optionCache.get(cacheKey)
  if (cached) return cached.promise

  const entry = { promise: null, options: null }
  // 변환(toOptions) 실패도 캐시에서 지워야 하므로 then의 두 번째 인자가 아니라 catch로 받습니다.
  // then(onFulfilled, onRejected)는 onFulfilled 안에서 던진 오류를 onRejected로 보내지 않습니다.
  entry.promise = apiClient.get(path)
    .then(data => {
      const options = toOptions(data, valueField)
      entry.options = options
      return options
    })
    .catch(error => {
      if (optionCache.get(cacheKey) === entry) optionCache.delete(cacheKey)
      throw error
    })
  optionCache.set(cacheKey, entry)
  return entry.promise
}

// 화면이 API 필드 이름을 모르게 { value, label } option으로 바꿉니다(§3.5 Option 모델).
function toOptions(data, valueField) {
  if (!Array.isArray(data)) throw new Error('지역 응답 형식이 올바르지 않습니다.')

  const options = data
    .map(item => ({ value: toNonEmptyText(item?.[valueField]), label: toNonEmptyText(item?.name) }))
    .filter(option => option.value && option.label)
  // 여러 화면이 같은 배열을 공유하므로 한 곳에서 바꾸지 못하게 합니다.
  return Object.freeze(options.map(option => Object.freeze(option)))
}

function districtsCacheKey(lDongRegnCd) {
  return `districts:${lDongRegnCd}`
}

// 시·도 목록: GET /api/v1/regions → Option[] ({ value: lDongRegnCd, label: name })
export function fetchRegions() {
  return loadOptions('regions', '/api/v1/regions', 'lDongRegnCd')
}

// 시군구 목록: GET /api/v1/regions/districts?lDongRegnCd= → Option[] ({ value: lDongSignguCd, label: name })
export function fetchDistricts(lDongRegnCd) {
  const params = new URLSearchParams({ lDongRegnCd: String(lDongRegnCd) })
  return loadOptions(districtsCacheKey(lDongRegnCd), `/api/v1/regions/districts?${params}`, 'lDongSignguCd')
}

// 이미 받아 둔 시·도 목록(동기). 아직 없거나 진행 중이면 null
// Design Ref: §4.2 — 모달을 두 번째 열 때 첫 렌더부터 ready로 보여 줘 깜빡이지 않게 합니다.
export function getCachedRegions() {
  return optionCache.get('regions')?.options ?? null
}

// 이미 받아 둔 시군구 목록(동기). 아직 없거나 진행 중이면 null
export function getCachedDistricts(lDongRegnCd) {
  return optionCache.get(districtsCacheKey(lDongRegnCd))?.options ?? null
}
