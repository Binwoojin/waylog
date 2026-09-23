import { apiClient, refreshSession } from './client'

/*
 * 인증 API 모듈
 *
 * Design Ref: §9.2 — 화면·Context는 인증 URL을 직접 쓰지 않고 이 함수들만 호출합니다.
 * Refresh Token이 HttpOnly 쿠키로 오가는 요청은 credentials: 'include'로 보냅니다.
 */

// 성공 응답: { accessToken, member: { memberId, email, nickname, role } } + Set-Cookie refreshToken
export function login({ email, password, rememberLogin }) {
  return apiClient.post('/api/v1/auth/login', { email, password, rememberLogin }, { credentials: 'include' })
}

// Design Ref: §2.2 — 복원과 401 재시도가 같은 single-flight Promise를 쓰도록 client의 refreshSession에 위임합니다.
export function refresh() {
  return refreshSession()
}

// 서버가 Refresh 쿠키를 삭제(Max-Age=0)합니다.
export function logout() {
  return apiClient.post('/api/v1/auth/logout', undefined, { credentials: 'include' })
}
