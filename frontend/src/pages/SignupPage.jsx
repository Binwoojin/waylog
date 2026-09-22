import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import logo from '../assets/figma/logo.png'
import signupBackground from '../assets/auth/login-background.png'
import mailIcon from '../assets/auth/mail.svg'
import lockIcon from '../assets/auth/lock.svg'
import eyeIcon from '../assets/auth/eye.svg'
import './SignupPage.css'

/**
 * 회원가입 페이지 /signup
 * 1단계에서 계정 정보를 검증하고 2단계에서 약관 동의를 받은 뒤 회원가입을 요청합니다.
 *
 * 백엔드 API 연결 권장 순서
 * - GET  /api/v1/members/check-email?email=...       이메일 중복 확인
 * - POST /api/v1/auth/email-verifications             인증번호 발송 { email, purpose: 'SIGNUP' }
 * - POST /api/v1/auth/email-verifications/confirm     인증번호 확인 { email, code, purpose: 'SIGNUP' }
 * - GET  /api/v1/members/check-nickname?nickname=...  닉네임 중복 확인
 * - POST /api/v1/members                              최종 회원가입
 *
 * 프론트의 중복확인 boolean만 신뢰하지 말고 최종 POST 시 서버가 이메일·닉네임 중복,
 * 인증 완료 여부, 비밀번호 정책, 필수 약관 동의를 반드시 다시 검사해야 합니다.
 */
const initialForm = {
  email: '',
  verificationCode: '',
  password: '',
  passwordConfirm: '',
  phonePrefix: '010',
  phone: '',
  nickname: '',
}

const initialTerms = {
  service: false,
  privacy: false,
  marketing: false,
}

export default function SignupPage() {
  const navigate = useNavigate()
  // step 1은 계정 정보, step 2는 약관 동의 화면입니다.
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [terms, setTerms] = useState(initialTerms)
  const [emailChecked, setEmailChecked] = useState(false) // 이메일 중복확인 완료 여부
  const [verificationSent, setVerificationSent] = useState(false) // 인증번호 발송 상태 추가
  const [emailVerified, setEmailVerified] = useState(false) // 인증번호 확인 완료 여부
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState(0) // 인증번호 남은 시간 (초)
  // const [emailVerificationToken, setEmailVerificationToken] = useState('') // 서버에서 발급한 이메일 인증 토큰 (백엔드 API 연결 시 사용해야함)
  const [nicknameChecked, setNicknameChecked] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)


  // 인증번호 타이머 추가
  useEffect(() => {
    if (!verificationSent || emailVerified) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setVerificationSecondsLeft(current =>
        Math.max(current - 1, 0)
      )
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [verificationSent, emailVerified])

  const verificationMinutes = Math.floor(verificationSecondsLeft / 60)
  const verificationSeconds = verificationSecondsLeft % 60
  const verificationTimeText = `${verificationMinutes.toString().padStart(2, '0')}:${verificationSeconds.toString().padStart(2, '0')}`


  const passwordRules = {
    // 서버의 비밀번호 정책과 반드시 같은 정규식/조건을 사용해야 합니다.
    letter: /[A-Za-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
    length: form.password.length >= 8 && form.password.length <= 20,
  }
  const passwordValid = Object.values(passwordRules).every(Boolean)
  const passwordMatches = form.password.length > 0 && form.password === form.passwordConfirm
  const allTermsChecked = Object.values(terms).every(Boolean)
  const getPasswordRuleState = isValid => {
    if (isValid) return 'is-valid'
    if (form.password.length > 0) return 'is-invalid'
    return ''
  }

  const updateForm = event => {
    // 이메일이나 닉네임이 수정되면 이전 중복확인 결과를 무효화합니다.
    const { name, value } = event.target

    if (name === 'email') {
      setForm(current => ({ ...current, email: value, verificationCode: '', }))

      setEmailChecked(false)
      setVerificationSent(false)
      setEmailVerified(false)
      return
    }

    setForm(current => ({
      ...current,
      [name]: value,
    }))

    if (name === 'nickname') setNicknameChecked(false)
  }

  const checkEmail = async () => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    if (!emailValid) {
      window.alert('올바른 이메일 주소를 입력해 주세요.')
      return
    }

    try {
      const data = await apiClient.get(
        `/api/v1/users/check-email?email=${encodeURIComponent(form.email)}`
      )

      if (data.email!==null) {
        window.alert('이미 사용 중인 이메일입니다.')
        return
      }
     
      setEmailChecked(true) // 이메일 중복확인 완료 상태 설정
      setVerificationSent(false) // 인증번호 발송 상태 초기화
      setEmailVerified(false) // 인증번호 확인 상태 초기화

      window.alert('사용 가능한 이메일입니다.');
    } catch (error) {
      window.alert(error.message || '이메일 중복확인 중 문제가 발생했습니다.')
    }
   
  }

  // 인증번호 발송 함수 추가
  const sendVerificationCode = async () => {
    if (!emailChecked) {
      window.alert('먼저 이메일 중복 확인을 진행해 주세요.')
      return
    }

    try {
      /*
     * 실제 백엔드 연결 예시
      */

     await apiClient.post(
       '/api/v1/auth/email-verification',
       { email: form.email, purpose: 'SIGNUP' },
       { credentials: 'include' }
     )

      setVerificationSent(true) // 인증번호 발송 상태 설정
      setEmailVerified(false) // 인증번호 확인 상태 초기화
      // setEmailVerificationToken('') // 인증 토큰 초기화
      
      // 3분 설정
      setVerificationSecondsLeft(180)

             /*
        * 서버에서 유효시간을 내려준다면 다음처럼 사용합니다.
        *
        * setVerificationSecondsLeft(data.expiresIn)
     */

      setForm(current => ({
        ...current,
        verificationCode: '', // 인증번호 입력 필드 초기화
      }))
      window.alert('인증번호를 발송했습니다.')
       window.alert("emailChecked : " + emailChecked)
      window.alert("emailVerified : " + emailVerified)
    } catch (error) {
      window.alert(error.message || '인증번호 발송 중 문제가 발생했습니다.')
    }
  }

  const verifyEmail = async() => {
    // if (!emailChecked || !emailVerified || !emailVerificationToken) {
    // if (emailChecked || emailVerified) {
    //   window.alert('이메일 중복 확인과 인증을 완료해 주세요.')
    //   window.alert(emailChecked)
    //   window.alert(emailVerified)
    //   return
    // }
    if (!emailChecked) {
      window.alert("먼저 이메일 중복확인을 진행해야합니다")
      return}
    // 인증번호 발송 여부를 모두 검사하도록 변경
    if (!verificationSent) {
      window.alert('먼저 인증번호를 받아 주세요.')
      return
    }

    if (verificationSecondsLeft <= 0) {
      window.alert('인증번호가 만료되었습니다. 다시 받아 주세요.')
      return
    }

    if (!/^\d{6}$/.test(form.verificationCode)) {
      window.alert('인증번호 6자리를 입력해 주세요.')
      return
    }

    try {
      /*
      * 실제 백엔드 연결 예시
      */

     await apiClient.post(
       '/api/v1/auth/email-verification/confirm',
       {
         email: form.email,
         authCode: form.verificationCode,
         purpose: 'SIGNUP',
       }
     )

      setEmailVerified(true) // 인증번호 확인 완료 상태 설정
      console.log("emailVerified : "+emailVerified)
      setVerificationSecondsLeft(0) // 인증번호 남은 시간 초기화
      window.alert('이메일 인증이 완료되었습니다.')
    } catch (error) {
      setEmailVerified(false) // 인증번호 확인 실패 시 상태 초기화
      // setEmailVerificationToken('') // 인증 토큰 초기화

      window.alert(error.message || '인증번호 확인에 실패했습니다.')
    }
  }

  const checkNickname = () => {
    if (form.nickname.trim().length < 2) {
      window.alert('닉네임은 2자 이상 입력해 주세요.')
      return
    }

    // check-nickname 응답의 available 값이 true일 때만 nicknameChecked를 true로 설정합니다.
    setNicknameChecked(true)
  }

  const moveToTerms = event => {
    // 1단계의 모든 클라이언트 검증을 통과해야 약관 동의 화면으로 이동합니다.
    event.preventDefault()
    const phoneValid = /^\d{7,8}$/.test(form.phone.replace(/\D/g, ''))

    if (!emailChecked || !emailVerified) {
      window.alert('이메일 중복 확인과 인증을 완료해 주세요.')
      return
    }
    if (!passwordValid) {
      window.alert('비밀번호 조건을 모두 충족해 주세요.')
      return
    }
    if (!passwordMatches) {
      window.alert('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!phoneValid) {
      window.alert('휴대전화 번호를 올바르게 입력해 주세요.')
      return
    }
    if (!nicknameChecked) {
      window.alert('닉네임 중복 확인을 완료해 주세요.')
      return
    }

    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleAllTerms = checked => {
    // 전체 동의는 필수 2개와 선택 1개를 같은 값으로 한 번에 갱신합니다.
    setTerms({ service: checked, privacy: checked, marketing: checked })
  }

  const toggleTerm = event => {
    const { name, checked } = event.target
    setTerms(current => ({ ...current, [name]: checked }))
  }

  const completeSignup = async() => {
    if (!terms.service || !terms.privacy) {
      window.alert('필수 약관에 모두 동의해야 회원가입을 완료할 수 있습니다.')
      return
    }

    // if (!emailVerificationToken) {
    //   window.alert('이메일 인증 정보가 없습니다.')
    //   setStep(1)
    //   return
    // }

    
    const requestBody = {
    email: form.email,
    // emailVerificationToken,
    password: form.password,
    // phoneNumber: `${form.phonePrefix}${form.phone}`,
    nickname: form.nickname,
    agreements: {
      service: terms.service,
      privacy: terms.privacy,
      marketing: terms.marketing,
    },
  }

  await apiClient.post('/api/v1/auth/signup', requestBody)

    window.alert('회원가입이 완료되었습니다. 로그인해 주세요.')
    navigate('/login')
  }

  return (
    <main className="signup-page">
      <section
        className="signup-page__visual"
        style={{ backgroundImage: `url(${signupBackground})` }}
        aria-label="산길을 걷는 여행자"
      >
        <div className="signup-page__visual-overlay" />
        <Link className="signup-page__brand" to="/" aria-label="WayLog 홈으로 이동">
          <img src={logo} alt="" />
          <strong>WayLog</strong>
        </Link>

        <div className="signup-page__visual-content">
          <h2>여행의 시작을 함께해요</h2>
          <p>나만의 여행을 기록하고<br />새로운 여행자들과 연결해보세요.</p>

          <ol className="signup-steps" aria-label="회원가입 단계">
            <li className={step === 1 ? 'is-active' : 'is-complete'}>
              <span>{step === 1 ? '1' : '✓'}</span><strong>계정 정보</strong>
            </li>
            <li className={step === 2 ? 'is-active' : ''}>
              <span>2</span><strong>약관 동의</strong>
            </li>
          </ol>
        </div>
      </section>

      <section className={`signup-page__panel signup-page__panel--step-${step}`}>
        <Link className="signup-page__home-link" to="/">홈으로 돌아가기 <span aria-hidden="true">→</span></Link>

        <div className="signup-page__heading">
          <img src={logo} alt="WayLog" />
          <h1>WayLog 회원가입</h1>
          <p>간단한 정보 입력으로 여행 기록을 시작해보세요.</p>
        </div>

        {step === 1 ? (
          <form className="signup-card signup-form" onSubmit={moveToTerms}>
            <fieldset>
              <legend>이메일</legend>
              <div className="signup-form__action-row">
                <div className="signup-form__field">
                  <img src={mailIcon} alt="" aria-hidden="true" />
                  <input name="email" type="email" value={form.email} onChange={updateForm} placeholder="이메일 주소를 입력하세요..." autoComplete="email" required />
                </div>
                <button type="button" onClick={checkEmail}>중복 확인</button>
              </div>
              <small>로그인 시 사용할 이메일 주소입니다.</small>
            </fieldset>

            {/* 인증번호 영역 버튼 변경 */}
            <fieldset>
              <legend>인증번호</legend>
                <div className="signup-form__action-row">
                  <div className="signup-form__field signup-form__verification-field">
                    <input
                      name="verificationCode"
                      inputMode="numeric"
                      maxLength="6"
                      value={form.verificationCode}
                      onChange={updateForm}
                      placeholder={
                        emailChecked
                          ? '인증번호 6자리'
                          : '이메일 중복 확인을 먼저 진행해 주세요'
                      }
                      disabled={!verificationSent || emailVerified}
                    />

                    {verificationSent && !emailVerified && (
                      <span>{verificationTimeText}</span>
                    )}
                  </div>

                  {!verificationSent && !emailVerified && (
                    <button
                      type="button"
                      onClick={sendVerificationCode}
                      disabled={!emailChecked}
                    >
                      인증번호 받기
                    </button>
                  )}

                  {verificationSent && !emailVerified && (
                    <button
                      type="button"
                      onClick={verifyEmail}
                    >
                      인증 확인
                    </button>
                  )}

                  {emailVerified && (
                    <button
                      type="button"
                      disabled
                      className="is-complete"
                    >
                      인증 완료
                    </button>
                  )}
                </div>

                {verificationSent && !emailVerified && (
                  <div className="signup-form__verification-meta">
                    <button
                      type="button"
                      onClick={sendVerificationCode}
                    >
                      인증번호 재발송
                    </button>

                    <small>이메일로 전송된 인증번호를 입력해 주세요.</small>
                  </div>
                )}

                {emailVerified && (
                  <div className="signup-form__verification-meta">
                    <strong>이메일 인증이 완료되었습니다.</strong>
                  </div>
                )}
              </fieldset>

            <fieldset>
              <legend>비밀번호</legend>
              <div className="signup-form__field">
                <img src={lockIcon} alt="" aria-hidden="true" />
                <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={updateForm} autoComplete="new-password" required />
                <button className="signup-form__eye" type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}><img src={eyeIcon} alt="" /></button>
              </div>
              <div className="signup-form__password-rules">
                <span className={getPasswordRuleState(passwordRules.letter)}><i aria-hidden="true">{form.password && !passwordRules.letter ? '×' : '✓'}</i>영문</span>
                <span className={getPasswordRuleState(passwordRules.number)}><i aria-hidden="true">{form.password && !passwordRules.number ? '×' : '✓'}</i>숫자</span>
                <span className={getPasswordRuleState(passwordRules.special)}><i aria-hidden="true">{form.password && !passwordRules.special ? '×' : '✓'}</i>특수문자</span>
                <span className={getPasswordRuleState(passwordRules.length)}><i aria-hidden="true">{form.password && !passwordRules.length ? '×' : '✓'}</i>8~20자</span>
              </div>
              {!passwordValid && form.password && <small className="is-error">비밀번호를 8~20자로 설정해 주세요.</small>}
            </fieldset>

            <fieldset>
              <legend>비밀번호 확인</legend>
              <div className="signup-form__field">
                <img src={lockIcon} alt="" aria-hidden="true" />
                <input name="passwordConfirm" type={showPasswordConfirm ? 'text' : 'password'} value={form.passwordConfirm} onChange={updateForm} autoComplete="new-password" required />
                <button className="signup-form__eye" type="button" onClick={() => setShowPasswordConfirm(current => !current)} aria-label={showPasswordConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}><img src={eyeIcon} alt="" /></button>
              </div>
              {form.passwordConfirm && !passwordMatches && <small className="is-error">비밀번호가 일치하지 않습니다.</small>}
            </fieldset>

            <fieldset>
              <legend>휴대전화 번호</legend>
              <div className="signup-form__phone-row">
                <select name="phonePrefix" value={form.phonePrefix} onChange={updateForm} aria-label="휴대전화 앞자리">
                  <option value="010">010</option><option value="011">011</option><option value="016">016</option><option value="017">017</option><option value="018">018</option><option value="019">019</option>
                </select>
                <input name="phone" inputMode="numeric" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 8) }))} placeholder="휴대전화 번호 입력" required />
              </div>
            </fieldset>

            <fieldset>
              <legend>닉네임</legend>
              <div className="signup-form__action-row">
                <div className="signup-form__field"><span className="signup-form__user-icon" aria-hidden="true" /><input name="nickname" value={form.nickname} onChange={updateForm} placeholder="WayLog에서 사용할 닉네임" required /></div>
                <button type="button" onClick={checkNickname}>중복 확인</button>
              </div>
              {nicknameChecked && <small className="is-success">사용 가능한 닉네임입니다.</small>}
            </fieldset>

            <button className="signup-form__next" type="submit">다음 단계로 이동</button>
          </form>
        ) : (
          <div className="signup-card signup-terms">
            <label className="signup-terms__all">
              <input type="checkbox" checked={allTermsChecked} onChange={event => toggleAllTerms(event.target.checked)} />
              <span><strong>전체 약관에 동의합니다.</strong><small>선택 항목을 포함한 모든 약관에 동의합니다.</small></span>
            </label>

            <div className="signup-terms__list">
              <label><input name="service" type="checkbox" checked={terms.service} onChange={toggleTerm} /><span>[필수] 서비스 이용약관 동의</span><a href="#service-terms">보기 <b>›</b></a></label>
              <label><input name="privacy" type="checkbox" checked={terms.privacy} onChange={toggleTerm} /><span>[필수] 개인정보 수집 및 이용 동의</span><a href="#privacy-terms">보기 <b>›</b></a></label>
              <label><input name="marketing" type="checkbox" checked={terms.marketing} onChange={toggleTerm} /><span>[선택] 여행 소식 및 이벤트 알림 수신</span><a href="#marketing-terms">보기 <b>›</b></a></label>
            </div>

            <button className="signup-terms__complete" type="button" onClick={completeSignup}>회원가입 완료</button>
          </div>
        )}

        <p className="signup-page__login-copy">이미 WayLog 계정이 있으신가요? <Link to="/login">로그인</Link></p>
        <footer className="signup-page__footer"><a href="#terms">이용약관</a><a href="#privacy">개인정보처리방침</a><a href="#support">고객센터</a><span>ⓒ 2026 WayLog</span></footer>
      </section>
    </main>
  )
}