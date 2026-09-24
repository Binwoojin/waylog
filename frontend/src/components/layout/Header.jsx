import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { mainNavItems, memberMenuItems } from '../../data/navigation'
import MobileNav from './MobileNav'
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
        {/* Design Ref: §3.1 — 모바일 드로어와 같은 메뉴 데이터를 사용합니다. 미구현 피드는 "준비 중" 페이지(/feed)로 연결됩니다. */}
        <ul className="site-header__nav-list">
          {mainNavItems.map(item => (
            <li key={item.key}>
              <Link
                className={activePage === item.key ? 'is-active' : ''}
                to={item.to}
                aria-current={activePage === item.key ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
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
                {memberMenuItems.map(item => (
                  <Link key={item.to} to={item.to} role="menuitem" onClick={() => setIsMemberMenuOpen(false)}>{item.label}</Link>
                ))}
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

        {/*
          Design Ref: §2.3 — 760px 이하에서만 보이는 햄버거 메뉴입니다.
          로그인 상태와 로그아웃 요청은 여기서 내려 주어, 드로어에서 로그아웃이 실패해도 아래의 같은 알림이 뜹니다.
        */}
        <MobileNav member={currentMember} isRestoring={isRestoring} activePage={activePage} onLogout={requestLogout} />

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
