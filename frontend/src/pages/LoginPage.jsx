import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import logo from '../assets/figma/logo.png'
import loginBackground from '../assets/auth/login-background.png'
import mailIcon from '../assets/auth/mail.svg'
import lockIcon from '../assets/auth/lock.svg'
import eyeIcon from '../assets/auth/eye.svg'
import './LoginPage.css'

/**
 * 로그인 페이지 /login
 *
 * 백엔드 연결 권장 흐름
 * 1. 별도 src/api/authApi.js에 login({ email, password }) 함수를 작성합니다.
 * 2. POST /api/v1/auth/login 요청 body로 { email, password }를 전송합니다.
 * 3. 서버가 HttpOnly/Secure 쿠키로 refresh token을 내려주도록 구성하는 것이 안전합니다.
 * 4. access token을 응답 body로 받는 구조라면 메모리 상태에 저장하고,
 *    localStorage에 장기 보관하는 방식은 XSS 노출 위험 때문에 피하는 것을 권장합니다.
 * 5. 성공 시 메인 또는 로그인 전 접근 페이지로 이동하고, 401 응답은 폼 오류로 표시합니다.
 *
 * 예상 성공 응답 예시
 * { member: { memberId, email, nickname, role }, accessToken, expiresIn }
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

  const handleSubmit =  async event => {
    event.preventDefault()
     setIsLoading(true)
     setErrorMessage('') // 이전 오류 메시지를 초기화합니다.

     try {
       const response = await apiClient.post('/api/v1/auth/login', { email, password, rememberLogin }, { credentials: 'include' })


       if (!response.accessToken ) {
        console.log(response);
        throw new Error('응답에 회원 정보가 없습니다.')
       }

       login(response.member, response.accessToken)

       navigate('/')

     } catch (error) {
        if (error.status === 401) {
          setErrorMessage('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (error.status === 423) {
          setErrorMessage('잠긴 계정입니다.')
        } else if (error.status === 404) {
          setErrorMessage('로그인 API 주소를 찾을 수 없습니다.')
        } else {
          setErrorMessage('서버 오류가 발생했습니다.')
          console.error(error);
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