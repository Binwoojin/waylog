import { useState } from 'react'
import { usePasswordChangeFlow } from '../../hooks/usePasswordChangeFlow'
import './PasswordChangeForm.css'

const PASSWORD_PATTERN = {
  letter: /[A-Za-z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9]/,
}

function toTimeText(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * 비밀번호 변경 폼 — 이메일 인증 코드 발송 → 확인 → 새 비밀번호 입력 2회 → 제출
 *
 * Design Ref: mypage-bookmarks.design.md §4.3, §5.3 — 이미 로그인한 사용자이므로 이메일은
 * 고정값(member.email)이고 입력받지 않는다(usePasswordChangeFlow가 이 값을 고정으로 쓴다).
 * 지금까지 어떤 화면도 호출한 적 없는 이메일 인증 체인을 이 폼이 최초로 실제 연동한다.
 */
export default function PasswordChangeForm({ email }) {
  const flow = usePasswordChangeFlow(email)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const passwordRules = {
    letter: PASSWORD_PATTERN.letter.test(password),
    number: PASSWORD_PATTERN.number.test(password),
    special: PASSWORD_PATTERN.special.test(password),
    length: password.length >= 8 && password.length <= 20,
  }
  const passwordValid = Object.values(passwordRules).every(Boolean)
  const passwordMatches = password.length > 0 && password === passwordConfirm

  async function handleSubmit(event) {
    event.preventDefault()
    if (!passwordValid || !passwordMatches) return
    await flow.submitPassword(password)
  }

  if (flow.stage === 'done') {
    return (
      <div className="password-change-form">
        <p className="password-change-form__done" role="status">비밀번호가 변경되었습니다.</p>
        <button type="button" onClick={() => { flow.reset(); setCode(''); setPassword(''); setPasswordConfirm('') }}>
          다시 변경하기
        </button>
      </div>
    )
  }

  return (
    <div className="password-change-form">
      {flow.stage === 'idle' && (
        <button type="button" className="password-change-form__send-button" onClick={flow.sendCode} disabled={flow.isSending}>
          {flow.isSending ? '발송 중...' : `${email}로 인증번호 받기`}
        </button>
      )}

      {flow.stage === 'code-sent' && (
        <div className="password-change-form__row">
          <div className="password-change-form__code-field">
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="인증번호 6자리"
            />
            <span>{toTimeText(flow.secondsLeft)}</span>
          </div>
          <button type="button" onClick={() => flow.verifyCode(code)} disabled={flow.isVerifying}>
            {flow.isVerifying ? '확인 중...' : '인증 확인'}
          </button>
          <button type="button" className="password-change-form__resend" onClick={flow.sendCode} disabled={flow.isSending}>
            재발송
          </button>
        </div>
      )}

      {flow.stage === 'verified' && (
        <form className="password-change-form__password-form" onSubmit={handleSubmit}>
          <p className="password-change-form__verified">이메일 인증이 완료되었습니다.</p>

          <label>
            <span>새 비밀번호</span>
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" />
          </label>
          <div className="password-change-form__rules">
            {Object.entries({ letter: '영문', number: '숫자', special: '특수문자', length: '8~20자' }).map(([key, label]) => (
              <span key={key} className={passwordRules[key] ? 'is-valid' : password ? 'is-invalid' : ''}>
                {password && !passwordRules[key] ? '×' : '✓'} {label}
              </span>
            ))}
          </div>

          <label>
            <span>새 비밀번호 확인</span>
            <input type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} autoComplete="new-password" />
          </label>
          {passwordConfirm && !passwordMatches && <small className="password-change-form__error">비밀번호가 일치하지 않습니다.</small>}

          <button type="submit" disabled={!passwordValid || !passwordMatches || flow.isSubmitting}>
            {flow.isSubmitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      )}

      {flow.error && <p className="password-change-form__error" role="alert">{flow.error}</p>}
    </div>
  )
}
