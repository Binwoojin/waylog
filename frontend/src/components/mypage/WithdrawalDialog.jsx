import { useEffect, useId, useRef, useState } from 'react'
import './WithdrawalDialog.css'

/**
 * 회원 탈퇴 확인 다이얼로그
 *
 * Design Ref: mypage-bookmarks.design.md §5.3 — 되돌릴 수 없는 동작이므로 비밀번호 재확인과
 * "이 작업은 되돌릴 수 없습니다" 동의 체크박스를 모두 거쳐야 제출 버튼이 활성화된다.
 * FeedConfirmDialog와 같은 접근성 패턴(열리면 포커스 이동, Esc로 닫기, alertdialog)을 따르되
 * 비밀번호 입력 폼이 필요해 전용 컴포넌트로 새로 만든다.
 *
 * 이전 입력 지우기: 호출하는 쪽(AccountSettingsSection)이 다이얼로그를 열 때마다 바뀌는 `key`를
 * 넘긴다. open이 바뀔 때 setState로 직접 초기화하는 대신(effect 안에서 setState를 바로 호출하면
 * 불필요한 리렌더가 한 번 더 생긴다), key가 바뀌면 React가 이 컴포넌트를 통째로 다시 마운트해
 * password/agreed가 useState 초기값으로 되돌아간다 — 민감 정보(비밀번호)가 다음 번 열람까지
 * 남아있지 않다.
 */
export default function WithdrawalDialog({ open, pending, error, onConfirm, onCancel }) {
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const passwordRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined

    passwordRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  function handleSubmit(event) {
    event.preventDefault()
    if (!agreed || !password || pending) return
    onConfirm(password)
  }

  return (
    <div className="withdrawal-dialog__overlay" onClick={onCancel}>
      <section
        className="withdrawal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={event => event.stopPropagation()}
      >
        <h2 id={titleId} className="withdrawal-dialog__title">정말 탈퇴하시겠어요?</h2>
        <p id={descriptionId} className="withdrawal-dialog__description">
          탈퇴하면 다시 로그인할 수 없습니다. 이 작업은 되돌릴 수 없습니다.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="withdrawal-dialog__field">
            <span>비밀번호</span>
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={pending}
              required
            />
          </label>

          <label className="withdrawal-dialog__agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={event => setAgreed(event.target.checked)}
              disabled={pending}
            />
            <span>이 작업은 되돌릴 수 없다는 것에 동의합니다.</span>
          </label>

          {error && <p className="withdrawal-dialog__error" role="alert">{error}</p>}

          <div className="withdrawal-dialog__actions">
            <button type="button" onClick={onCancel} disabled={pending}>취소</button>
            <button type="submit" className="withdrawal-dialog__confirm" disabled={!agreed || !password || pending}>
              {pending ? '처리 중...' : '탈퇴하기'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
