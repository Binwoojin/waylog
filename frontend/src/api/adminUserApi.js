import { apiClient } from './client'

/*
 * 관리자 회원 API 모듈
 *
 * Design Ref: admin-dashboard.design.md §3.2, §4.1 — adminNoticeApi.js와 같은 원칙(화면은 API 필드
 * 이름을 모르게 view model로 바꿔 받는다, page는 화면 기준 1-based ↔ 백엔드 0-based 변환).
 *
 * 상세 화면은 진입 시 GET /admin/users/{id}로 조회한다(새로고침·URL 직접 진입에도 동작).
 * 등급·정지 변경 API는 모두 변경된 UserAdminResponse 전체를 응답으로 돌려주므로,
 * 그 이후에는 화면이 응답으로 로컬 상태만 갱신하고 다시 조회하지 않는다(AdminUserDetailPage.jsx).
 */

const ADMIN_USER_PATH = '/api/v1/admin/users'

function toUserSummary(item) {
  return {
    id: item?.id,
    email: typeof item?.email === 'string' ? item.email : '',
    nickname: typeof item?.nickname === 'string' ? item.nickname : '',
    grade: typeof item?.grade === 'string' ? item.grade : '',
    createdAt: item?.createdAt ?? null,
    // Design Ref: §3.2.1 — suspended는 서버(UserEntity.isSuspended())가 계산해 내려준다.
    // 프론트가 suspendedUntil을 다시 비교하지 않고 이 값을 그대로 표시 기준으로 쓴다.
    suspended: Boolean(item?.suspended),
    suspendedUntil: item?.suspendedUntil ?? null,
    suspensionReason: typeof item?.suspensionReason === 'string' ? item.suspensionReason : '',
    suspendedAt: item?.suspendedAt ?? null,
  }
}

/**
 * 회원 단건 조회: GET /api/v1/admin/users/{id}
 *
 * 없는 id는 다른 관리자 조회 API(PostService.findPost 등)와 같은 컨벤션으로 400을 던진다
 * (UserAdminService의 회원 조회, `{"message": "해당 회원을 찾을 수 없습니다."}`). 상세 화면은 이
 * 400을 not-found로 취급한다(hooks/useAdminUserDetail.js, useAdminNoticeDetail.js와 동일한 판단 기준).
 */
export async function fetchAdminUserDetail(id) {
  const data = await apiClient.get(`${ADMIN_USER_PATH}/${encodeURIComponent(id)}`)
  return toUserSummary(data)
}

/**
 * 회원 목록 조회: GET /api/v1/admin/users?keyword=&page=&size=
 *
 * keyword는 닉네임·이메일 부분 일치(UserRepository.search)다. page는 화면 기준(1부터)이고,
 * 백엔드(AdminUserController.list)는 0부터 시작하는 페이지 번호를 쓰므로 요청 시 변환한다.
 */
export async function fetchAdminUserList({ keyword, page = 1, size = 10 } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  if (keyword) params.set('keyword', keyword)
  params.set('page', String(Math.max(0, page - 1)))
  params.set('size', String(size))

  const data = await apiClient.get(`${ADMIN_USER_PATH}?${params}`, { signal })

  if (!data || !Array.isArray(data.content) || !Number.isInteger(data.totalElements)) {
    throw new Error('회원 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    items: data.content.map(toUserSummary),
    page,
    totalPages: Number.isInteger(data.totalPages) ? data.totalPages : 0,
    totalElements: data.totalElements,
  }
}

/**
 * 등급 변경: PATCH /api/v1/admin/users/{id}/grade
 *
 * 자기 자신을 대상으로 하면 403(AccessDeniedException, SecurityConfig의 고정 메시지)이 온다.
 * 화면은 상태 코드로만 판단하고 구체적인 안내 문구는 화면에서 직접 준다(client.js가 주는
 * body.message는 "접근 권한이 없습니다."로 고정돼 있어 원인을 구분하지 못한다).
 */
export async function updateAdminUserGrade(id, grade) {
  const data = await apiClient.patch(`${ADMIN_USER_PATH}/${encodeURIComponent(id)}/grade`, { grade })
  return toUserSummary(data)
}

/**
 * 활동 정지 적용: PATCH /api/v1/admin/users/{id}/suspension
 *
 * days는 관리자가 그때 정하는 값이다(고정 프리셋 아님, UserSuspensionRequest). 서버가 1~365 범위를
 * 검증하므로(UserSuspensionService), 화면의 범위 검사는 사용자 피드백용이고 최종 방어는 서버가 한다.
 */
export async function suspendAdminUser(id, { days, reason }) {
  const data = await apiClient.patch(`${ADMIN_USER_PATH}/${encodeURIComponent(id)}/suspension`, { days, reason })
  return toUserSummary(data)
}

/**
 * 활동 정지 조기 해제: DELETE /api/v1/admin/users/{id}/suspension
 */
export async function liftAdminUserSuspension(id) {
  const data = await apiClient.delete(`${ADMIN_USER_PATH}/${encodeURIComponent(id)}/suspension`)
  return toUserSummary(data)
}
