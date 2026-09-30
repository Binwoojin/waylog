import { apiClient } from './client'

/*
 * 관리자 공지사항 API 모듈
 *
 * Design Ref: admin-dashboard.design.md §3.1, §4 — 이번 리소스는 스키마·엔드포인트 변경이 없다.
 * 이미 있는 4개 API(GET /notices, GET·PATCH·PUT·DELETE /admin/notices/{id}, POST /admin/notices)를
 * 그대로 쓰고, 화면은 API 필드 이름을 모르게 view model로 바꿔 돌려준다(tourApi.js와 같은 원칙).
 *
 * 이미지 관리는 이번 범위에서 제외한다(계획 D-6). PUT은 백엔드가 멀티파트만 받으므로
 * "post" 파트에 JSON을 실어 보내되 images 파트는 붙이지 않는다.
 */

const NOTICE_LIST_PATH = '/api/v1/notices'
const ADMIN_NOTICE_PATH = '/api/v1/admin/notices'

function toNoticeSummary(item) {
  return {
    id: item?.id,
    title: typeof item?.title === 'string' ? item.title : '',
    author: typeof item?.author === 'string' ? item.author : '',
    viewCount: Number.isInteger(item?.viewCount) ? item.viewCount : 0,
    commentCount: Number.isInteger(item?.commentCount) ? item.commentCount : 0,
    createdAt: item?.createdAt ?? null,
  }
}

/**
 * 공지 목록 조회: GET /api/v1/notices?keyword=&page=&size=
 *
 * Design Ref: §5.1 — page는 화면 기준(1부터 시작)입니다. 백엔드(PostController.list)는
 * Spring Data 관례대로 0부터 시작하는 페이지 번호를 쓰므로 요청 시에만 1을 빼서 변환합니다.
 * 나머지 화면(destination-list-integration)과 URL 표기를 통일하기 위한 경계입니다.
 *
 * 실패 시 ApiError(요청 오류) 또는 형식이 다른 응답이면 Error를 던집니다.
 */
export async function fetchAdminNoticeList({ keyword, page = 1, size = 10 } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  if (keyword) params.set('keyword', keyword)
  params.set('page', String(Math.max(0, page - 1)))
  params.set('size', String(size))

  const data = await apiClient.get(`${NOTICE_LIST_PATH}?${params}`, { signal })

  // Design Ref: §1.2 fail-closed — client.js는 JSON이 아닌 200 응답을 {}로 돌려줍니다.
  if (!data || !Array.isArray(data.content) || !Number.isInteger(data.totalElements)) {
    throw new Error('공지 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    items: data.content.map(toNoticeSummary),
    // 응답의 page(0-based)가 아니라 요청한 화면 기준 page를 그대로 돌려줍니다. URL이 기준이기 때문입니다.
    page,
    totalPages: Number.isInteger(data.totalPages) ? data.totalPages : 0,
    totalElements: data.totalElements,
  }
}

function toNoticeDetail(data) {
  if (!data || typeof data.title !== 'string') {
    throw new Error('공지 상세 응답 형식이 올바르지 않습니다.')
  }

  return {
    id: data.id,
    title: data.title,
    content: typeof data.content === 'string' ? data.content : '',
    author: typeof data.author === 'string' ? data.author : '',
    viewCount: data.viewCount,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/**
 * 관리자 수정 화면용 상세 조회: PATCH /api/v1/admin/notices/{id}
 *
 * PostController.getForEdit이 "조회수를 늘리지 않는 조회"를 PATCH로 구현해 두었으므로
 * 몸통 없이 그대로 호출합니다. 없는 id는 400(findPost의 IllegalArgumentException, GlobalExceptionHandler)로
 * 오므로, 상세 화면에서는 이 400을 not-found로 취급합니다(useTourDetail과 같은 판단 기준, hooks/useAdminNoticeDetail.js).
 */
export async function fetchAdminNoticeDetail(id) {
  const data = await apiClient.patch(`${ADMIN_NOTICE_PATH}/${encodeURIComponent(id)}`)
  return toNoticeDetail(data)
}

/**
 * 공지 생성: POST /api/v1/admin/notices (JSON, 이미지 미지원 — 백엔드 계약)
 */
export async function createAdminNotice({ title, content, author }) {
  const data = await apiClient.post(ADMIN_NOTICE_PATH, { title, content, author })
  return toNoticeDetail(data)
}

/**
 * 공지 수정: PUT /api/v1/admin/notices/{id} (멀티파트)
 *
 * 컨트롤러가 이 경로를 멀티파트로만 받는다(PostController.update, consumes MULTIPART_FORM_DATA_VALUE).
 * "post" 파트에 PostUpdateRequest와 같은 모양의 JSON을 Blob으로 담아 보낸다.
 * images 파트는 선택(@RequestPart required=false)이라 이번 범위(이미지 미지원, D-6)에서는 붙이지 않는다.
 */
export async function updateAdminNotice(id, { title, content, author }) {
  const formData = new FormData()
  formData.append(
    'post',
    new Blob([JSON.stringify({ title, content, author, removeImageIds: [] })], { type: 'application/json' }),
  )

  const data = await apiClient.put(`${ADMIN_NOTICE_PATH}/${encodeURIComponent(id)}`, formData)
  return toNoticeDetail(data)
}

/**
 * 공지 삭제: DELETE /api/v1/admin/notices/{id} (204 No Content)
 */
export function deleteAdminNotice(id) {
  return apiClient.delete(`${ADMIN_NOTICE_PATH}/${encodeURIComponent(id)}`)
}
