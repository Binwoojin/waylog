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
  const { member: currentMember, logout } = useAuth()
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

  const handleLogout = () => {
    // 백엔드 연결 시 로그아웃 API 호출 후 동일하게 회원 상태를 비웁니다.
    logout()
    setIsMemberMenuOpen(false)
  }

  return (
    <header className={`site-header${isScrolled || forceLight ? ' site-header--scrolled' : ''}`}>
      <Link className="site-header__logo" to="/" aria-label="WayLog 홈">
        <img src={logo} alt="WayLog" />
      </Link>

      <nav className="site-header__nav" aria-label="주요 메뉴">
        <ul className="site-header__nav-list">
          <li>
            <Link className={activePage === 'destinations' ? 'is-active' : ''} to="/destinations">여행지</Link>
          </li>
          <li>
            <Link className={activePage === 'enjoy' ? 'is-active' : ''} to="/enjoy">여행 즐기기</Link>
          </li>
          <li>
            <Link className={activePage === 'feed' ? 'is-active' : ''} to="/feed">여행 피드</Link>
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
        ) : (
          <>
            <Link className="site-header__login" to="/login">로그인</Link>
            <Link className="site-header__signup" to="/signup">회원가입</Link>
          </>
        )}
      </div>
    </header>
  )
}

export default Header
