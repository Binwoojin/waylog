import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as authApi from '../api/authApi'
import logo from '../assets/figma/logo.png'
import loginBackground from '../assets/auth/login-background.png'
import mailIcon from '../assets/auth/mail.svg'
import lockIcon from '../assets/auth/lock.svg'
import eyeIcon from '../assets/auth/eye.svg'
import './LoginPage.css'

/**
 * 로그인 페이지 /login
 *
 * 로그인 흐름
 * 1. authApi.login()으로 POST /api/v1/auth/login을 호출합니다. (화면은 URL을 직접 다루지 않습니다)
 * 2. 서버는 refresh token을 HttpOnly 쿠키로, access token과 회원 정보를 응답 body로 내려줍니다.
 * 3. AuthContext.login(member, accessToken)이 access token을 메모리(client.js)에만 저장합니다.
 * 4. 성공 시 메인으로 이동하고, 401 응답은 폼 오류로 표시합니다.
 *
 * 성공 응답: { accessToken, member: { memberId, email, nickname, role } }
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberLogin, setRememberLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async event => {
    event.preventDefault()
    setIsLoading(true)
    setErrorMessage('') // 이전 오류 메시지를 초기화합니다.

    try {
      const response = await authApi.login({ email, password, rememberLogin })

      // Design Ref: §5.3 — 토큰과 회원 정보가 모두 있어야 로그인 상태가 성립합니다.
      // 하나라도 없으면 헤더에는 로그인으로 보이지만 보호 API가 실패하는 불일치가 생기므로 오류로 처리합니다.
      if (!response.accessToken || !response.member) {
        throw new Error('로그인 응답에 토큰 또는 회원 정보가 없습니다.')
      }

      login(response.member, response.accessToken)
      navigate('/')
    } catch (error) {
      // /api/v1/auth/** 요청은 client에서 재발급 대상이 아니므로 401이 그대로 전달됩니다.
      if (error.status === 401) {
        setErrorMessage('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else if (error.status === 423) {
        setErrorMessage('잠긴 계정입니다.')
      } else if (error.status === 404) {
        setErrorMessage('로그인 API 주소를 찾을 수 없습니다.')
      } else {
        setErrorMessage('서버 오류가 발생했습니다.')
        console.error(error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section
        className="login-page__visual"
        style={{ backgroundImage: `url(${loginBackground})` }}
        aria-label="산과 바다가 보이는 여행 풍경"
      >
        <div className="login-page__visual-overlay" />
        <Link className="login-page__brand" to="/" aria-label="WayLog 홈으로 이동">
          <img src={logo} alt="" />
          <strong>WayLog</strong>
        </Link>

        <div className="login-page__visual-copy">
          <h2>다시, 여행을 이어가볼까요?</h2>
          <p>당신의 모든 여행 기록이 새로운 이야기로 이어집니다.</p>
        </div>
      </section>

      <section className="login-page__form-panel">
        <Link className="login-page__home-link" to="/">홈으로 돌아가기 <span aria-hidden="true">→</span></Link>

        <div className="login-page__form-wrap">
          <img className="login-page__form-logo" src={logo} alt="WayLog" />
          <h1>WayLog에 로그인</h1>
          <p className="login-page__description">여행의 순간을 기록하고 함께 나눠보세요.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            {/* label의 htmlFor와 input id를 연결해 접근성과 클릭 영역을 확보합니다. */}
            <label htmlFor="login-email">이메일</label>
            <div className="login-form__field">
              <span className="login-form__field-icon" aria-hidden="true"><img src={mailIcon} alt="" /></span>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>

            <label htmlFor="login-password">비밀번호</label>
            <div className="login-form__field">
              <span className="login-form__field-icon" aria-hidden="true"><img src={lockIcon} alt="" /></span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
              <button
                className="login-form__password-toggle"
                type="button"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(current => !current)}
              >
                <img className={showPassword ? 'is-visible' : ''} src={eyeIcon} alt="" />
              </button>
            </div>

            <div className="login-form__options">
              {/* 로그인 유지 여부와 비밀번호 재설정 진입 링크입니다. */}
              <label className="login-form__remember">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={event => setRememberLogin(event.target.checked)}
                />
                <span>로그인 상태 유지</span>
              </label>
              <Link to="/forgot-password">비밀번호 찾기</Link>
            </div>

            {errorMessage && (
              <p className="login-form__error" role="alert">{errorMessage}</p>
            )}

            <button
              className="login-form__submit"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="login-page__divider"><span>또는</span></div>
          <button className="login-page__kakao" type="button">카카오로 시작하기</button>

          <p className="login-page__signup-copy">
            아직 WayLog 회원이 아니신가요? <Link to="/signup">회원가입</Link>
          </p>
        </div>

        <footer className="login-page__footer">
          <a href="#terms">이용약관</a>
          <a href="#privacy">개인정보처리방침</a>
          <a href="#support">고객센터</a>
          <span>ⓒ 2026 WayLog</span>
        </footer>
      </section>
    </main>
  )
}