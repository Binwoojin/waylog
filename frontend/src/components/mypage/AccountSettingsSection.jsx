import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWithdrawal } from '../../hooks/useWithdrawal'
import PasswordChangeForm from './PasswordChangeForm'
import WithdrawalDialog from './WithdrawalDialog'
import './AccountSettingsSection.css'

/**
 * 계정 설정 섹션 — 비밀번호 변경 + 회원 탈퇴
 *
 * Design Ref: mypage-bookmarks.design.md §5.3 — 탈퇴는 항상 확인 다이얼로그(비밀번호 재확인)를
 * 거친다(되돌릴 수 없는 동작 원칙). 성공하면 로컬 인증 상태를 정리하고 로그인 화면으로 이동한다.
 */
export default function AccountSettingsSection({ email }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { isPending, error, withdraw, resetError } = useWithdrawal()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  // 열 때마다 1씩 늘려 WithdrawalDialog에 key로 넘긴다 — 새 key를 받으면 React가 그 컴포넌트를
  // 다시 마운트해 비밀번호 입력 같은 민감한 폼 state를 초기값으로 되돌린다(WithdrawalDialog 참고).
  const [dialogSession, setDialogSession] = useState(0)

  function openDialog() {
    resetError()
    setDialogSession(session => session + 1)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    if (isPending) return
    setIsDialogOpen(false)
  }

  async function handleConfirmWithdrawal(password) {
    const succeeded = await withdraw(password)
    if (!succeeded) return

    setIsDialogOpen(false)
    // 서버가 이미 리프레시 쿠키를 만료시켰다(§4.4). 로컬 인증 상태도 함께 정리하고 로그인 화면으로 보낸다.
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <section className="account-settings-section" aria-label="계정 설정">
      <h2>계정 설정</h2>

      <div className="account-settings-section__block">
        <h3>비밀번호 변경</h3>
        <PasswordChangeForm email={email} />
      </div>

      <div className="account-settings-section__block account-settings-section__block--danger">
        <h3>회원 탈퇴</h3>
        <p>탈퇴하면 다시 로그인할 수 없습니다. 작성한 게시물은 삭제되지 않고 그대로 남습니다.</p>
        <button type="button" className="account-settings-section__withdraw-button" onClick={openDialog}>
          탈퇴하기
        </button>
      </div>

      <WithdrawalDialog
        key={dialogSession}
        open={isDialogOpen}
        pending={isPending}
        error={error}
        onConfirm={handleConfirmWithdrawal}
        onCancel={closeDialog}
      />
    </section>
  )
}
