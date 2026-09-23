import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/figma/logo.png'
import './Header.css'

/**
 * 모든 일반 콘텐츠 페이지에서 공유하는 상단 헤더입니다.
 * forceLight: Hero 이미지가 없는 페이지에서도 흰 배경 헤더를 강제로 사용합니다.
 * activePage: 현재 메뉴에 활성화 밑줄을 표시하기 위한 페이지 식별자입니다.
 */
function Header({ forceLight = false, activePage = '' }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(false)
  const [logoutNotice, setLogoutNotice] = useState('')
  const [isRetryingLogout, setIsRetryingLogout] = useState(false)
  const { member: currentMember, isRestoring, logout } = useAuth()
  const memberMenuRef = useRef(null)

  useEffect(() => {
    // 40px 이상 스크롤하면 배경과 글자색이 읽기 쉬운 고정형 헤더 스타일로 전환됩니다.
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!isMemberMenuOpen) return undefined

    const closeMemberMenu = event => {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !memberMenuRef.current?.contains(event.target))) {
        setIsMemberMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeMemberMenu)
    window.addEventListener('keydown', closeMemberMenu)
    return () => {
      document.removeEventListener('mousedown', closeMemberMenu)
      window.removeEventListener('keydown', closeMemberMenu)
    }
  }, [isMemberMenuOpen])

  // Design Ref: §5.2 — logout()은 회원 상태를 즉시 비운 뒤 /auth/logout으로 Refresh 쿠키를 삭제합니다.
  // 화면은 호출 즉시 비로그인으로 바뀌고, 여기서는 서버 결과만 기다려 실패를 알립니다.
  const requestLogout = async () => {
    setLogoutNotice('')
    const isLoggedOut = await logout()
    // Design Ref: §12 R-4 — 쿠키가 남으면 새로고침 시 다시 로그인되므로 사용자가 알 수 있게 합니다.
    if (!isLoggedOut) setLogoutNotice('로그아웃이 완료되지 않았을 수 있습니다. 다시 시도해 주세요.')
  }

  const handleLogout = () => {
    setIsMemberMenuOpen(false)
    requestLogout()
  }

  const handleRetryLogout = async () => {
    setIsRetryingLogout(true)
    await requestLogout()
    setIsRetryingLogout(false)
  }

  return (
    <header className={`site-header${isScrolled || forceLight ? ' site-header--scrolled' : ''}`}>
      <Link className="site-header__logo" to="/" aria-label="WayLog 홈">
        <img src={logo} alt="WayLog" />
      </Link>

      <nav className="site-header__nav" aria-label="주요 메뉴">
        {/* 실제 하위 페이지가 구현된 메뉴는 경로로, 미구현 SNS는 임시 앵커로 연결합니다. */}
        <ul className="site-header__nav-list">
          <li>
            <Link className={activePage === 'destinations' ? 'is-active' : ''} to="/destinations">여행지</Link>
          </li>
          <li>
            <Link className={activePage === 'enjoy' ? 'is-active' : ''} to="/enjoy">여행 즐기기</Link>
          </li>
          <li>
            <a href="/#feed">여행 피드</a>
          </li>
        </ul>
      </nav>

      <div className="site-header__actions">
        {currentMember ? (
          <div className="site-header__member" ref={memberMenuRef}>
            <button className="site-header__member-button" type="button" aria-haspopup="menu" aria-expanded={isMemberMenuOpen} onClick={() => setIsMemberMenuOpen(isOpen => !isOpen)}>
              <span>{currentMember.nickname || '사용자'}</span>
              <span className={`site-header__member-chevron${isMemberMenuOpen ? ' is-open' : ''}`} aria-hidden="true">∨</span>
            </button>
            {isMemberMenuOpen && (
              <div className="site-header__member-menu" role="menu">
                <Link to="/bookmarks" role="menuitem">북마크</Link>
                <Link to="/mypage" role="menuitem">마이 페이지</Link>
                <button type="button" role="menuitem" onClick={handleLogout}>로그아웃</button>
              </div>
            )}
          </div>
        ) : isRestoring ? (
          // Design Ref: §12 R-3 — 새 탭에서 세션 복원이 끝나기 전에는 로그인 여부를 모르므로
          // 버튼 대신 같은 크기의 빈 자리만 두어 "로그인 → 닉네임" 깜빡임과 레이아웃 흔들림을 막습니다.
          <>
            <span className="site-header__login site-header__placeholder" aria-hidden="true" />
            <span className="site-header__signup site-header__placeholder" aria-hidden="true" />
          </>
        ) : (
          <>
            <Link className="site-header__login" to="/login">로그인</Link>
            <Link className="site-header__signup" to="/signup">회원가입</Link>
          </>
        )}

        {logoutNotice && (
          <div className="site-header__notice" role="alert">
            <p>{logoutNotice}</p>
            <div className="site-header__notice-actions">
              <button type="button" onClick={handleRetryLogout} disabled={isRetryingLogout}>
                {isRetryingLogout ? '처리 중...' : '다시 시도'}
              </button>
              <button type="button" onClick={() => setLogoutNotice('')}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
