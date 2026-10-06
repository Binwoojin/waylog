import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import logo from '../assets/figma/logo.png'
import background from '../assets/auth/login-background.png'
import mailIcon from '../assets/auth/mail.svg'
import lockIcon from '../assets/auth/lock.svg'
import eyeIcon from '../assets/auth/eye.svg'
import './ForgotPasswordPage.css'

/**
 * 비밀번호 찾기 페이지 /forgot-password
 * 1) 가입 이메일로 인증번호 요청 → 2) 인증번호 확인(verificationToken 발급) → 3) 새 비밀번호 저장 순서로 진행합니다.
 *
 * 백엔드 API
 * - POST /api/v1/auth/password-reset-requests      { email } → 응답 본문 없음(200이면 발송 성공)
 *   이 API는 가입 여부를 확인하지 않고 그냥 인증코드를 발송합니다. 존재하지 않는 이메일이어도 200이 오며,
 *   최종 비밀번호 변경 단계(PUT /password)에서야 "해당 이메일의 회원을 찾을 수 없습니다" 오류가 납니다.
 * - POST /api/v1/auth/email-verification/confirm   { email, authCode } → 성공 시 { verificationToken }, 실패 시 401
 * - PUT  /api/v1/auth/password                     { email, password, verificationToken } → 성공 시 200(본문 없음)
 *   verificationToken이 없거나 틀렸거나 이미 소모됐으면 "이메일 인증이 필요합니다" 오류가 납니다.
 */

// 서버가 인증번호 유효시간을 내려주지 않으므로, 회원가입 화면과 동일하게 3분으로 가정합니다.
const VERIFICATION_SECONDS = 180

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isRequestingCode, setIsRequestingCode] = useState(false)

  const [verificationCode, setVerificationCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [codeError, setCodeError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [hasSentCode, setHasSentCode] = useState(false)
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState(0)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const verified = Boolean(verificationToken)

  // 인증번호 발송 후 남은 시간을 1초 단위로 줄입니다(회원가입 화면과 동일한 패턴).
  useEffect(() => {
    if (!hasSentCode || verified) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setVerificationSecondsLeft(current => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [hasSentCode, verified])

  const verificationMinutes = Math.floor(verificationSecondsLeft / 60)
  const verificationSeconds = verificationSecondsLeft % 60
  const verificationTimeText = `${verificationMinutes.toString().padStart(2, '0')}:${verificationSeconds.toString().padStart(2, '0')}`

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

  // 1단계와 2단계(재발송)에서 공용으로 쓰는 인증번호 발송 요청입니다.
  async function requestVerificationCode(targetEmail) {
    await apiClient.post('/api/v1/auth/password-reset-requests', { email: targetEmail })

    setVerificationCode('')
    setVerificationToken('')
    setVerificationSecondsLeft(VERIFICATION_SECONDS)
    setHasSentCode(true)
  }

  const checkRegisteredEmail = async event => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

    if (!emailValid) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.')
      return
    }

    setIsRequestingCode(true)
    try {
      await requestVerificationCode(normalizedEmail)
      setEmail(normalizedEmail)
      setEmailError('')
      setStep(2)
    } catch (error) {
      setEmailError(error.message || '인증번호 발송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsRequestingCode(false)
    }
  }

  const resendCode = async () => {
    setIsRequestingCode(true)
    try {
      await requestVerificationCode(email)
      setCodeError('')
    } catch (error) {
      setCodeError(error.message || '인증번호 재발송 중 문제가 발생했습니다.')
    } finally {
      setIsRequestingCode(false)
    }
  }

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(verificationCode)) {
      setCodeError('인증번호 6자리를 입력해 주세요.')
      return
    }

    if (verificationSecondsLeft <= 0) {
      setCodeError('인증번호가 만료되었습니다. 다시 받아 주세요.')
      return
    }

    setIsVerifying(true)
    try {
      const data = await apiClient.post('/api/v1/auth/email-verification/confirm', {
        email,
        authCode: Number(verificationCode),
      })

      setVerificationToken(data.verificationToken)
      setVerificationSecondsLeft(0)
      setCodeError('')
    } catch (error) {
      setVerificationToken('')
      setCodeError(error.message || '인증번호 확인에 실패했습니다.')
    } finally {
      setIsVerifying(false)
    }
  }

  const moveToPasswordReset = event => {
    event.preventDefault()
    if (!verified) {
      setCodeError('이메일 인증을 완료해 주세요.')
      return
    }
    setStep(3)
  }

  const completePasswordReset = async event => {
    event.preventDefault()
    if (!passwordValid) {
      setPasswordError('비밀번호 조건을 모두 충족해 주세요.')
      return
    }
    if (!passwordMatches) {
      setPasswordError('비밀번호가 일치하지 않습니다.')
      return
    }

    setIsSubmittingPassword(true)
    try {
      await apiClient.put('/api/v1/auth/password', {
        email,
        password,
        verificationToken,
      })

      setPasswordError('')
      setSuccessMessage('비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다.')
      window.setTimeout(() => navigate('/login'), 1500)
    } catch (error) {
      // verificationToken이 만료되었거나 이미 소모된 경우를 포함하므로, 처음부터 다시 인증하도록 되돌립니다.
      setVerificationToken('')
      setHasSentCode(false)
      setVerificationCode('')
      setPassword('')
      setPasswordConfirm('')
      setEmailError(error.message || '비밀번호 변경에 실패했습니다. 이메일 인증을 다시 진행해 주세요.')
      setStep(1)
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const moveBack = () => {
    // 현재 단계에 따라 한 단계 이전 화면으로 돌아가며 필요한 인증 상태를 초기화합니다.
    if (step === 3) {
      setStep(2)
      return
    }
    setVerificationToken('')
    setVerificationCode('')
    setHasSentCode(false)
    setCodeError('')
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
              <button className="forgot-button" type="submit" disabled={isRequestingCode}>{isRequestingCode ? '처리 중...' : '다음'}</button>
              <Link className="forgot-back-link" to="/login">로그인 화면으로 돌아가기</Link>
            </form>
          )}

          {step > 1 && (
            <div className="forgot-account"><span className="forgot-account__icon" aria-hidden="true" /><span><small>확인된 이메일 계정</small><strong>{email}</strong></span><button type="button" onClick={() => { setStep(1); setVerificationToken(''); setVerificationCode(''); setHasSentCode(false) }}>변경</button></div>
          )}

          {step === 2 && (
            <form className="forgot-form forgot-form--verification" onSubmit={moveToPasswordReset}>
              <label htmlFor="forgot-code">인증번호</label>
              <div className="forgot-code-row">
                <div className={`forgot-field ${codeError ? 'is-error' : ''}`}>
                  <input
                    id="forgot-code"
                    inputMode="numeric"
                    maxLength="6"
                    value={verificationCode}
                    onChange={event => { setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setVerificationToken('') }}
                    placeholder="인증번호 6자리"
                    disabled={!hasSentCode || verified}
                  />
                  {hasSentCode && !verified && <span>{verificationTimeText}</span>}
                </div>
                <button type="button" onClick={verifyCode} disabled={isVerifying || verified}>{isVerifying ? '확인 중...' : verified ? '인증 완료' : '인증 확인'}</button>
              </div>
              <div className="forgot-verification-meta">
                <button type="button" onClick={resendCode} disabled={isRequestingCode}>{isRequestingCode ? '발송 중...' : '인증번호 재발송'}</button>
                {verified && <strong>이메일 인증이 완료되었습니다.</strong>}
              </div>
              {codeError && <small className="forgot-message--error">{codeError}</small>}
              <button className="forgot-button" type="submit" disabled={!verified}>다음</button>
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
              {passwordError && <small className="forgot-message--error">{passwordError}</small>}
              {successMessage && <small className="forgot-message--success">{successMessage}</small>}
              <button className="forgot-button" type="submit" disabled={isSubmittingPassword || Boolean(successMessage)}>{isSubmittingPassword ? '변경 중...' : '비밀번호 변경 완료'}</button>
              <button className="forgot-back-link" type="button" onClick={moveBack}>이전 단계로 돌아가기</button>
            </form>
          )}
        </div>
        <footer className="forgot-page__footer"><span>ⓒ 2026 WayLog</span></footer>
      </section>
    </main>
  )
}
