import { apiClient } from './client'
import { COURSE_LIST_PAGE_SIZE } from '../lib/courseListQuery'

/*
 * 여행코스 공개 조회 API 모듈
 *
 * Design Ref: tour-course-list-integration.design.md §3.2, §4 — 화면은 API 필드 이름을 모르고
 * view model(CourseCard, CourseDetail)만 씁니다. 관리자 모듈(adminCourseApi.js)과 응답 모양은
 * 비슷하지만, 인증이 필요 없는 화면이 인증이 필요한 관리자 모듈에 의존하는 모양을 피하려고
 * 이 파일에 독립적으로 변환 로직을 둡니다(설계 §3.2 "이유 있는 분리").
 */

const COURSE_PATH = '/api/v1/courses'

function toNonEmptyText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toNonNegativeInt(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0
}

// 코스 상세 라우트(설계 §6.1 Q-5). tourContentTypes.js의 getTourDetailPath와는 다른 ID 네임스페이스라 분리합니다.
export function getCourseDetailPath(id) {
  return `/destinations/courses/${encodeURIComponent(String(id))}`
}

// Design Ref: §12 O-3 — 목업은 "당일치기"/"1박 2일"/"2박 이상" 세 문구뿐이었지만,
// 실제 dayCount는 임의 정수라 "N박 (N+1)일" 일반식으로 확장합니다. CourseCard·TourCourseDetailPage가 공유합니다.
export function formatCourseDuration(dayCount) {
  if (!Number.isInteger(dayCount) || dayCount <= 0) return '일정 미정'
  if (dayCount === 1) return '당일치기'
  return `${dayCount - 1}박 ${dayCount}일`
}

/**
 * 코스 목록 항목(TourCoursePublicListItemResponse) → CourseCard | null
 *
 * Design Ref: §3.2 — id·title이 없으면 카드를 버립니다(fail-closed, 빈 제목·링크 없는 카드 방지).
 */
export function toCourseCard(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id == null) return null

  const title = toNonEmptyText(item.title)
  if (!title) return null

  return {
    id: String(item.id),
    title,
    theme: toNonEmptyText(item.theme),
    image: toNonEmptyText(item.coverImageUrl),
    dayCount: toNonNegativeInt(item.dayCount),
    stopCount: toNonNegativeInt(item.stopCount),
    representativeAddress: toNonEmptyText(item.representativeAddress),
    detailPath: getCourseDetailPath(item.id),
  }
}

/**
 * API 응답(PageResponse<TourCoursePublicListItemResponse>) → CourseListResult
 *
 * Design Ref: §3.2 — 백엔드는 0-based page/content/totalElements(project 공용 PageResponse)를 쓰지만,
 * 화면은 다른 목록(TourListView 계열)과 같은 1-based page/totalCount 모양으로 받습니다.
 * fail-closed: content가 배열이 아니거나 totalElements가 0 이상 정수가 아니면 성공으로 보지 않습니다.
 */
export function toCourseList(data, requestedPage) {
  if (!data || !Array.isArray(data.content) || !Number.isInteger(data.totalElements) || data.totalElements < 0) {
    throw new Error('여행코스 목록 응답 형식이 올바르지 않습니다.')
  }

  const seenIds = new Set()
  const items = []
  for (const item of data.content) {
    const card = toCourseCard(item)
    if (!card || seenIds.has(card.id)) continue
    seenIds.add(card.id)
    items.push(card)
  }

  return {
    items,
    totalCount: data.totalElements,
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    totalPages: Number.isInteger(data.totalPages) ? data.totalPages : 0,
  }
}

/**
 * 코스 목록 조회: GET /api/v1/courses?keyword=&page=&size=
 *
 * 성공: CourseListResult { items: CourseCard[], totalCount, page, totalPages }
 * 실패: ApiError, 형식이 다른 응답이면 Error, 취소되면 AbortError(DOMException)
 */
export async function fetchCourseList(query, { signal } = {}) {
  const params = new URLSearchParams()
  if (query?.keyword) params.set('keyword', query.keyword)
  // 백엔드는 0-based page를 받습니다(admin 코스 API와 같은 컨벤션, 설계 §3.2).
  params.set('page', String(Math.max(0, (query?.page ?? 1) - 1)))
  params.set('size', String(COURSE_LIST_PAGE_SIZE))

  const data = await apiClient.get(`${COURSE_PATH}?${params}`, { signal })
  return toCourseList(data, query?.page ?? 1)
}

function toStopImage(image) {
  return { id: image?.id ?? null, url: toNonEmptyText(image?.url), sortOrder: toNonNegativeInt(image?.sortOrder) }
}

function toStop(stop) {
  return {
    id: stop?.id ?? null,
    sortOrder: toNonNegativeInt(stop?.sortOrder),
    stopType: stop?.stopType === 'CUSTOM' ? 'CUSTOM' : 'REFERENCE',
    tourContentId: toNonEmptyText(stop?.tourContentId),
    tourContentTypeId: Number.isInteger(stop?.tourContentTypeId) ? stop.tourContentTypeId : null,
    name: toNonEmptyText(stop?.name) ?? '',
    address: toNonEmptyText(stop?.address),
    latitude: typeof stop?.latitude === 'number' ? stop.latitude : null,
    longitude: typeof stop?.longitude === 'number' ? stop.longitude : null,
    images: Array.isArray(stop?.images) ? stop.images.map(toStopImage) : [],
  }
}

function toDay(day) {
  return {
    id: day?.id ?? null,
    dayNumber: Number.isInteger(day?.dayNumber) ? day.dayNumber : 1,
    stops: Array.isArray(day?.stops) ? day.stops.map(toStop) : [],
  }
}

/**
 * API 응답(TourCourseResponse) → CourseDetail
 *
 * Design Ref: §3.2 — 관리자 상세와 같은 모양(코스-일자-경유지-이미지)을 그대로 받습니다.
 * fail-closed: title이 없거나 days가 배열이 아니면 성공으로 보지 않습니다.
 */
export function toCourseDetail(data) {
  if (!data || typeof data.title !== 'string' || !data.title.trim() || !Array.isArray(data.days)) {
    throw new Error('여행코스 상세 응답 형식이 올바르지 않습니다.')
  }

  return {
    id: data.id,
    title: data.title.trim(),
    theme: toNonEmptyText(data.theme),
    coverImageUrl: toNonEmptyText(data.coverImageUrl),
    days: data.days.map(toDay).sort((a, b) => a.dayNumber - b.dayNumber),
  }
}

/**
 * 코스 상세 조회: GET /api/v1/courses/{id}
 *
 * 없는 id는 관리자 상세와 같은 컨벤션으로 400을 던집니다(useCourseDetail이 not-found로 취급).
 */
export async function fetchCourseDetail(id) {
  const data = await apiClient.get(`${COURSE_PATH}/${encodeURIComponent(id)}`)
  return toCourseDetail(data)
}
