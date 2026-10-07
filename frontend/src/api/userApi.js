import { apiClient } from './client'

/*
 * 계정 설정(비밀번호 변경·회원 탈퇴) API 모듈
 *
 * Design Ref: mypage-bookmarks.design.md §4.3, §4.4 — 신규 엔드포인트가 아니라
 * 기존 이메일 인증 체인(`/auth/email-verification`, `.../confirm`, `PUT /auth/password`)을
 * 마이페이지가 처음으로 실제 연동한다. `ForgotPasswordPage.jsx`는 이 API들을 호출한 적이
 * 없는 완전히 정적인 화면이었다(설계 문서 "계획 대비 변경" 참고).
 *
 * 탈퇴만 신규 API(`DELETE /api/v1/users/me`)다.
 */

/**
 * 이메일 인증번호 발송(비밀번호 재설정 용도): POST /api/v1/auth/password-reset-requests
 *
 * 로그인된 사용자의 본인 이메일만 쓴다(ForgotPasswordPage처럼 임의 이메일을 입력받지 않음).
 * 성공 응답 본문은 없다.
 */
export function sendMyEmailCode(email) {
  return apiClient.post('/api/v1/auth/password-reset-requests', { email })
}

/**
 * 인증번호 확인: POST /api/v1/auth/email-verification/confirm
 *
 * 성공: { verificationToken } — changePassword에 그대로 전달하는 1회용 티켓.
 * 실패(불일치·만료): ApiError(401)
 */
export async function confirmMyEmailCode(email, authCode) {
  const data = await apiClient.post('/api/v1/auth/email-verification/confirm', { email, authCode, purpose: 'RESET_PASSWORD' })
  if (!data || typeof data.verificationToken !== 'string' || !data.verificationToken) {
    throw new Error('인증 응답 형식이 올바르지 않습니다.')
  }
  return data.verificationToken
}

/**
 * 비밀번호 변경: PUT /api/v1/auth/password
 *
 * verificationToken은 confirmMyEmailCode가 돌려준 1회용 티켓이다(서버가 소모 후 즉시 무효화).
 */
export function changeMyPassword({ email, password, verificationToken }) {
  return apiClient.put('/api/v1/auth/password', { email, password, verificationToken })
}

/**
 * 회원 탈퇴: DELETE /api/v1/users/me
 *
 * Design Ref: §4.4(Q-1) — 비밀번호 재확인 필수. 성공하면 서버가 리프레시 쿠키를 즉시 만료시킨다.
 * credentials: 'include'가 있어야 그 Set-Cookie 응답을 브라우저가 반영한다(client.js의
 * refreshSession·login과 같은 이유 — 프론트·백엔드가 다른 포트로 떠 있는 개발 환경 기준).
 */
export function withdrawMyAccount(password) {
  return apiClient.delete('/api/v1/users/me', { body: { password }, credentials: 'include' })
}
