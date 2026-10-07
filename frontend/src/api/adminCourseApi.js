import { apiClient } from './client'

/*
 * 관리자 여행코스 API 모듈
 *
 * Design Ref: admin-dashboard.design.md §3.3, §3.3.4, §4.1 — 다른 admin API 모듈과 같은 원칙
 * (화면은 API 필드 이름을 모르게 view model로 바꿔 받는다).
 *
 * 목록 페이지 번호는 공지·회원과 같은 관례(0-based, TourCourseAdminController.list
 * defaultValue "0")를 따른다. 응답도 board.dto.PageResponse 모양(content/totalPages 등)이다.
 *
 * 구조(코스-일자-경유지) 저장과 이미지 첨부는 완전히 다른 요청 형식(JSON vs multipart)이라
 * 함수를 분리한다(설계 §3.3.4 2단계 흐름): saveAdminCourse류는 구조만, *StopImages·CoverImage는
 * 이미지만 다룬다. client.js가 FormData 바디를 이미 지원한다(admin-dashboard.design.md §3.3.4,
 * PUT /admin/notices/{id}에서 먼저 검증됨).
 */

const ADMIN_COURSE_PATH = '/api/v1/admin/courses'

function toCourseSummary(item) {
  return {
    id: item?.id,
    title: typeof item?.title === 'string' ? item.title : '',
    theme: typeof item?.theme === 'string' ? item.theme : '',
    coverImageUrl: item?.coverImageUrl ?? null,
    createdAt: item?.createdAt ?? null,
    updatedAt: item?.updatedAt ?? null,
  }
}

/**
 * 여행코스 목록 조회: GET /api/v1/admin/courses?keyword=&page=&size=
 *
 * 목록 응답(TourCourseListItemResponse)에는 일자·경유지 개수가 없다(백엔드가 N+1을 피하려고
 * 목록에서 컬렉션을 로드하지 않기로 결정함, TourCourseRepository.search 주석). 화면은 이 값을
 * 억지로 계산해 보여주지 않는다 — 상세를 보려면 상세 화면으로 들어가면 된다.
 */
export async function fetchAdminCourseList({ keyword, page = 1, size = 10 } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  if (keyword) params.set('keyword', keyword)
  params.set('page', String(Math.max(0, page - 1)))
  params.set('size', String(size))

  const data = await apiClient.get(`${ADMIN_COURSE_PATH}?${params}`, { signal })

  if (!data || !Array.isArray(data.content) || !Number.isInteger(data.totalElements)) {
    throw new Error('여행코스 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    items: data.content.map(toCourseSummary),
    page,
    totalPages: Number.isInteger(data.totalPages) ? data.totalPages : 0,
    totalElements: data.totalElements,
  }
}

function toStopImage(image) {
  return { id: image?.id, url: image?.url ?? null, sortOrder: image?.sortOrder ?? 0 }
}

function toStop(stop) {
  return {
    id: stop?.id ?? null,
    sortOrder: stop?.sortOrder ?? 0,
    stopType: stop?.stopType === 'CUSTOM' ? 'CUSTOM' : 'REFERENCE',
    tourContentId: stop?.tourContentId ?? null,
    tourContentTypeId: stop?.tourContentTypeId ?? null,
    name: typeof stop?.name === 'string' ? stop.name : '',
    address: typeof stop?.address === 'string' ? stop.address : '',
    latitude: typeof stop?.latitude === 'number' ? stop.latitude : null,
    longitude: typeof stop?.longitude === 'number' ? stop.longitude : null,
    images: Array.isArray(stop?.images) ? stop.images.map(toStopImage) : [],
  }
}

function toDay(day) {
  return {
    id: day?.id ?? null,
    dayNumber: day?.dayNumber ?? 1,
    stops: Array.isArray(day?.stops) ? day.stops.map(toStop) : [],
  }
}

function toCourseDetail(data) {
  if (!data || typeof data.title !== 'string' || !Array.isArray(data.days)) {
    throw new Error('여행코스 상세 응답 형식이 올바르지 않습니다.')
  }

  return {
    id: data.id,
    title: data.title,
    theme: typeof data.theme === 'string' ? data.theme : '',
    coverImageUrl: data.coverImageUrl ?? null,
    days: data.days.map(toDay),
  }
}

/**
 * 여행코스 상세 조회: GET /api/v1/admin/courses/{id}
 *
 * 없는 id는 다른 관리자 조회 API와 같은 컨벤션으로 400을 던진다(TourCourseAdminService.findCourse).
 * 상세 화면은 이 400을 not-found로 취급한다(hooks/useAdminCourseDetail.js).
 */
export async function fetchAdminCourseDetail(id) {
  const data = await apiClient.get(`${ADMIN_COURSE_PATH}/${encodeURIComponent(id)}`)
  return toCourseDetail(data)
}

/**
 * 구조 저장 요청 변환: 폼 상태(days[].stops[]) → TourCourseSaveRequest 모양.
 *
 * dayNumber·sortOrder는 폼이 따로 들고 있지 않고 배열 순서에서 그대로 계산한다
 * (설계 §3.3.3 "dayNumber는 1부터 연속 정수", "sortOrder는 같은 일자 내 유일" —
 * 배열 인덱스를 그대로 쓰면 이 두 규칙이 항상 성립해 잘못된 값을 만들 수 없다).
 */
function toSaveRequest(course) {
  return {
    title: course.title.trim(),
    theme: course.theme.trim() ? course.theme.trim() : null,
    days: course.days.map((day, dayIndex) => ({
      id: day.id ?? null,
      dayNumber: dayIndex + 1,
      stops: day.stops.map((stop, stopIndex) => ({
        id: stop.id ?? null,
        sortOrder: stopIndex,
        stopType: stop.stopType,
        tourContentId: stop.stopType === 'REFERENCE' ? stop.tourContentId : null,
        tourContentTypeId: stop.stopType === 'REFERENCE' ? stop.tourContentTypeId : null,
        name: stop.name.trim(),
        address: stop.address?.trim() ? stop.address.trim() : null,
        latitude: stop.latitude === '' || stop.latitude == null ? null : Number(stop.latitude),
        longitude: stop.longitude === '' || stop.longitude == null ? null : Number(stop.longitude),
      })),
    })),
  }
}

/**
 * 여행코스 생성(구조만): POST /api/v1/admin/courses
 */
export async function createAdminCourse(course) {
  const data = await apiClient.post(ADMIN_COURSE_PATH, toSaveRequest(course))
  return toCourseDetail(data)
}

/**
 * 여행코스 수정(구조 전체 교체): PUT /api/v1/admin/courses/{id}
 *
 * 요청에 없는 기존 일자·경유지는 서버가 삭제한다(이미지도 함께). id를 그대로 돌려보낸
 * 일자·경유지만 기존 이미지가 보존된다(설계 §4.1).
 */
export async function updateAdminCourse(id, course) {
  const data = await apiClient.put(`${ADMIN_COURSE_PATH}/${encodeURIComponent(id)}`, toSaveRequest(course))
  return toCourseDetail(data)
}

/**
 * 여행코스 삭제: DELETE /api/v1/admin/courses/{id}
 */
export function deleteAdminCourse(id) {
  return apiClient.delete(`${ADMIN_COURSE_PATH}/${encodeURIComponent(id)}`)
}

/**
 * 경유지 이미지 추가: POST /api/v1/admin/courses/{id}/stops/{stopId}/images (멀티파트, 필드명 images)
 *
 * 같은 일자의 이미지 합계가 10장을 넘으면 400(TourCourseImagePolicy.ensureWithinDayLimit).
 * 응답은 코스 전체(TourCourseResponse)이므로 폼은 이 응답으로 로컬 상태를 통째로 갱신하면 된다.
 */
export async function addAdminCourseStopImages(courseId, stopId, files) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('images', file)
  }

  const data = await apiClient.post(
    `${ADMIN_COURSE_PATH}/${encodeURIComponent(courseId)}/stops/${encodeURIComponent(stopId)}/images`,
    formData,
  )
  return toCourseDetail(data)
}

/**
 * 경유지 이미지 삭제: DELETE /api/v1/admin/courses/{id}/stops/{stopId}/images/{imageId}
 *
 * 204가 아니라 갱신된 코스 전체(TourCourseResponse)를 응답으로 준다(공지·회원 삭제와 다름).
 */
export async function deleteAdminCourseStopImage(courseId, stopId, imageId) {
  const data = await apiClient.delete(
    `${ADMIN_COURSE_PATH}/${encodeURIComponent(courseId)}/stops/${encodeURIComponent(stopId)}/images/${encodeURIComponent(imageId)}`,
  )
  return toCourseDetail(data)
}

/**
 * 코스 대표 이미지 교체: PUT /api/v1/admin/courses/{id}/cover-image (멀티파트, 필드명 image, 단일 파일)
 *
 * 일자당 10장 제한과 무관한 별도 슬롯이다(설계 §3.3.4-4).
 */
export async function replaceAdminCourseCoverImage(courseId, file) {
  const formData = new FormData()
  formData.append('image', file)

  const data = await apiClient.put(`${ADMIN_COURSE_PATH}/${encodeURIComponent(courseId)}/cover-image`, formData)
  return toCourseDetail(data)
}
