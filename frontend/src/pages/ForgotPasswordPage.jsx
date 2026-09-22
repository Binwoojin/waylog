import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logo from '../assets/figma/logo.png'
import background from '../assets/auth/login-background.png'
import mailIcon from '../assets/auth/mail.svg'
import lockIcon from '../assets/auth/lock.svg'
import eyeIcon from '../assets/auth/eye.svg'
import './ForgotPasswordPage.css'

/**
 * 비밀번호 찾기 페이지 /forgot-password
 * 1) 가입 이메일 확인 → 2) 이메일 인증 → 3) 새 비밀번호 저장 순서로 진행합니다.
 *
 * 백엔드 API 예시
 * - POST /api/v1/auth/password-reset/requests { email }
 * - POST /api/v1/auth/password-reset/verify   { email, code }
 * - PATCH /api/v1/auth/password               { resetToken, newPassword }
 *
 * 보안을 위해 실제 서비스에서는 가입 여부를 노출하지 않고 동일한 안내를 반환하는 방식도
 * 고려할 수 있습니다. 현재 화면은 기획 요구에 따라 미가입 이메일 오류를 구분합니다.
 */
const DEMO_REGISTERED_EMAILS = ['waylog_admin@test.co.kr', 'test@test.com']

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  // DEMO_REGISTERED_EMAILS와 임의의 숫자 6자리는 API 연결 전 UI 테스트용입니다.
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const passwordRules = {
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    length: password.length >= 8 && password.length <= 20,
  }
  const passwordValid = Object.values(passwordRules).every(Boolean)
  const passwordMatches = password.length > 0 && password === passwordConfirm

  const passwordRuleState = valid => {
    if (valid) return 'is-valid'
    if (password.length > 0) return 'is-invalid'
    return ''
  }

  const checkRegisteredEmail = event => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

    if (!emailValid) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.')
      return
    }

    /*
     * password-reset/requests 호출 성공 시 바로 step=2로 이동합니다.
     * 서버는 인증번호 원문을 저장하지 말고 해시 및 짧은 만료시간과 시도 횟수를 관리해야 합니다.
     */
    if (!DEMO_REGISTERED_EMAILS.includes(normalizedEmail)) {
      setEmailError('회원가입이 되지 않은 계정입니다.')
      return
    }

    setEmail(normalizedEmail)
    setEmailError('')
    setStep(2)
  }

  const verifyCode = () => {
    if (!/^\d{6}$/.test(verificationCode)) {
      window.alert('인증번호 6자리를 입력해 주세요.')
      return
    }

    // verify 성공 응답의 일회용 resetToken을 state에 보관하고 최종 PATCH 요청에 사용합니다.
    setVerified(true)
  }

  const moveToPasswordReset = event => {
    event.preventDefault()
    if (!verified) {
      window.alert('이메일 인증을 완료해 주세요.')
      return
    }
    setStep(3)
  }

  const completePasswordReset = event => {
    event.preventDefault()
    if (!passwordValid) {
      window.alert('비밀번호 조건을 모두 충족해 주세요.')
      return
    }
    if (!passwordMatches) {
      window.alert('비밀번호가 일치하지 않습니다.')
      return
    }

    /*
     * PATCH 요청에는 비밀번호 원문 두 개가 아니라 newPassword와 resetToken만 전송합니다.
     * 서버가 비밀번호 정책을 재검증하고 성공하면 resetToken을 즉시 폐기해야 합니다.
     * 성공 후 기존 refresh token/로그인 세션을 모두 만료시키는 것도 권장합니다.
     */
    window.alert('비밀번호가 완료되었습니다.')
    navigate('/login')
  }

  const moveBack = () => {
    // 현재 단계에 따라 한 단계 이전 화면으로 돌아가며 필요한 인증 상태를 초기화합니다.
    if (step === 3) {
      setStep(2)
      return
    }
    setVerified(false)
    setVerificationCode('')
    setStep(1)
  }

  return (
    <main className="forgot-page">
      <section className="forgot-page__visual" style={{ backgroundImage: `url(${background})` }}>
        <div className="forgot-page__overlay" />
        <Link className="forgot-page__brand" to="/"><img src={logo} alt="" /><strong>WayLog</strong></Link>
        <div className="forgot-page__visual-content">
          <h2>여행의 기억을 다시 이어가세요</h2>
          <p>본인 인증 후 새로운 비밀번호를 재설정할 수 있어요</p>
          <ol className="forgot-steps" aria-label="비밀번호 찾기 진행 단계">
            {['아이디 확인', '본인 인증', '비밀번호 재설정'].map((label, index) => {
              const number = index + 1
              const complete = step > number
              return <li key={label} className={step === number ? 'is-active' : complete ? 'is-complete' : ''}><span>{complete ? '✓' : number}</span><strong>{label}</strong></li>
            })}
          </ol>
        </div>
      </section>

      <section className="forgot-page__panel">
        <Link className="forgot-page__login-link" to="/login">로그인으로 돌아가기 <span>→</span></Link>
        <div className="forgot-page__content">
          <img className="forgot-page__logo" src={logo} alt="WayLog" />
          <h1>비밀번호 찾기</h1>
          <p className="forgot-page__description">{step === 3 ? '새로운 비밀번호를 설정해주세요.' : '등록된 이메일 주소로 본인 인증을 진행해주세요.'}</p>

          {step === 1 && (
            <form className="forgot-form" onSubmit={checkRegisteredEmail}>
              <h2>이메일 확인</h2>
              <label htmlFor="forgot-email">이메일</label>
              <div className={`forgot-field ${emailError ? 'is-error' : ''}`}><img src={mailIcon} alt="" /><input id="forgot-email" type="email" value={email} onChange={event => { setEmail(event.target.value); setEmailError('') }} placeholder="이메일 주소를 입력하세요..." autoComplete="email" /></div>
              <small className={emailError ? 'forgot-message--error' : ''}>{emailError || '회원가입 시 등록한 이메일 주소를 입력해주세요.'}</small>
              <button className="forgot-button" type="submit">다음</button>
              <div className="forgot-support"><span>이메일이 기억나지 않으시나요?</span><a href="#support">고객센터 문의</a></div>
              <Link className="forgot-back-link" to="/login">로그인 화면으로 돌아가기</Link>
            </form>
          )}

          {step > 1 && (
            <div className="forgot-account"><span className="forgot-account__icon" aria-hidden="true" /><span><small>확인된 이메일 계정</small><strong>{email}</strong></span><button type="button" onClick={() => { setStep(1); setVerified(false); setVerificationCode('') }}>변경</button></div>
          )}

          {step === 2 && (
            <form className="forgot-form forgot-form--verification" onSubmit={moveToPasswordReset}>
              <label htmlFor="forgot-code">인증번호</label>
              <div className="forgot-code-row"><div className="forgot-field"><input id="forgot-code" inputMode="numeric" maxLength="6" value={verificationCode} onChange={event => { setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setVerified(false) }} placeholder="인증번호 6자리" />{!verified && <span>02:58</span>}</div><button type="button" onClick={verifyCode}>인증 확인</button></div>
              <div className="forgot-verification-meta"><button type="button">인증번호 재발송</button>{verified && <strong>이메일 인증이 완료되었습니다.</strong>}</div>
              <button className="forgot-button" type="submit">다음</button>
              <button className="forgot-back-link" type="button" onClick={moveBack}>이전 단계로 돌아가기</button>
            </form>
          )}

          {step === 3 && (
            <form className="forgot-form forgot-form--password" onSubmit={completePasswordReset}>
              <h2>새 비밀번호 설정</h2>
              <label htmlFor="new-password">새 비밀번호</label>
              <div className="forgot-field"><img src={lockIcon} alt="" /><input id="new-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" /><button className="forgot-eye" type="button" onClick={() => setShowPassword(value => !value)}><img src={eyeIcon} alt="" /></button></div>
              <div className="forgot-rules">
                {Object.entries({ letter: '영문', number: '숫자', special: '특수문자', length: '8~20자' }).map(([key, label]) => <span key={key} className={passwordRuleState(passwordRules[key])}><i>{password && !passwordRules[key] ? '×' : '✓'}</i>{label}</span>)}
              </div>
              {password && !passwordValid && <small className="forgot-message--error">비밀번호 조건을 모두 충족해 주세요.</small>}

              <label htmlFor="new-password-confirm">새 비밀번호 확인</label>
              <div className="forgot-field"><img src={lockIcon} alt="" /><input id="new-password-confirm" type={showPasswordConfirm ? 'text' : 'password'} value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} autoComplete="new-password" /><button className="forgot-eye" type="button" onClick={() => setShowPasswordConfirm(value => !value)}><img src={eyeIcon} alt="" /></button></div>
              {passwordConfirm && <small className={passwordMatches ? 'forgot-message--success' : 'forgot-message--error'}>{passwordMatches ? '✓ 비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}</small>}
              <button className="forgot-button" type="submit">비밀번호 변경 완료</button>
              <button className="forgot-back-link" type="button" onClick={moveBack}>이전 단계로 돌아가기</button>
            </form>
          )}
        </div>
        <footer className="forgot-page__footer"><a href="#terms">이용약관</a><a href="#privacy">개인정보처리방침</a><a href="#support">고객센터</a><span>ⓒ 2026 WayLog</span></footer>
      </section>
    </main>
  )
}
