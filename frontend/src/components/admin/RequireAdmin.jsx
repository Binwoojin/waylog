import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminAccessDenied from './AdminAccessDenied'

/*
 * "/admin" 하위 라우트 가드
 *
 * Design Ref: admin-dashboard.design.md §2.1, 계획 5.1 — 이 가드는 UX 보조일 뿐입니다.
 * 실제 방어는 백엔드 SecurityConfig의 hasAuthority("ROLE_ADMIN")이고, 이 가드가 뚫려도
 * 관리자 API 자체가 403을 돌려줍니다.
 */
const ADMIN_ROLE = 'ADMIN'

function isAdminRole(role) {
  // AuthService.toMemberResponse는 DB GRADE 값을 대소문자 변환 없이 그대로 내려줍니다.
  // (JwtAuthenticationFilter가 "ROLE_" + grade.toUpperCase()로 바꾸는 것은 백엔드 인가 전용이라
  // 이 응답에는 반영되지 않습니다.) 등록 시 대소문자가 섞여도 안전하게 판정합니다.
  return typeof role === 'string' && role.toUpperCase() === ADMIN_ROLE
}

export default function RequireAdmin({ children }) {
  const { member, isRestoring } = useAuth()

  // Design Ref: §2.1 — 복원 중에는 판단을 보류합니다. 새로고침 직후 잠깐 비로그인으로 보이는 것을 막습니다.
  if (isRestoring) {
    return (
      <div className="admin-guard-loading" role="status">
        관리자 정보를 확인하는 중입니다...
      </div>
    )
  }

  if (!member) {
    return <Navigate to="/login" replace />
  }

  if (!isAdminRole(member.role)) {
    return <AdminAccessDenied />
  }

  return children
}
