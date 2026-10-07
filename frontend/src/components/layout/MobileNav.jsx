import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { mainNavItems, memberMenuItems } from '../../data/navigation'

// 이 폭을 넘으면 데스크톱 메뉴가 보이므로 드로어를 닫습니다. (Header.css의 760px 규칙과 맞춤)
const DESKTOP_QUERY = '(min-width: 761px)'
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])'

/**
 * 760px 이하에서 헤더 메뉴를 대신하는 햄버거 버튼과 드로어입니다.
 *
 * Design Ref: §2.3 — useAuth를 직접 쓰지 않고 Header에서 member·isRestoring·onLogout을 받습니다.
 * 로그아웃 실패 알림(R-4) 상태를 Header 한 곳에서만 관리해 데스크톱·모바일이 같은 알림을 쓰게 하기 위해서입니다.
 *
 * member: 로그인한 회원 정보 (없으면 null)
 * isRestoring: 세션 복원 중 여부. member 없이 복원 중이면 로그인 영역을 비워 둡니다(R-3과 같은 규칙).
 * activePage: 현재 메뉴 key (navigation.js의 key와 비교)
 * onLogout: Header의 requestLogout. 실패하면 Header가 알림을 띄웁니다.
 */
export default function MobileNav({ member, isRestoring, activePage, onLogout }) {
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [openedPathname, setOpenedPathname] = useState(pathname)
  const drawerId = useId()
  const toggleButtonRef = useRef(null)
  const drawerRef = useRef(null)

  // Design Ref: §5.1 — 뒤로 가기 등 드로어 밖에서 경로가 바뀌어도 드로어를 닫습니다.
  // effect 안에서 setState를 호출하면 한 번 더 렌더되므로, 렌더 중에 이전 경로와 비교해 바로 조정합니다.
  if (openedPathname !== pathname) {
    setOpenedPathname(pathname)
    setIsOpen(false)
  }

  const closeDrawer = () => setIsOpen(false)

  useEffect(() => {
    if (!isOpen) return undefined

    const toggleButton = toggleButtonRef.current
    const drawer = drawerRef.current

    // 열린 동안 배경 스크롤을 잠급니다. 기존 값을 저장해 닫힐 때 그대로 되돌립니다. (SearchModal과 같은 방식)
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    // 드로어는 body로 포털되어 #root와 형제입니다. 열린 동안 #root(헤더·본문·푸터)를 inert로 만들어
    // 가려진 페이지가 Tab 순서·클릭·스크린리더 탐색에서 빠지게 합니다. (aria-modal만으로는 일부 스크린리더가 읽음)
    const appRoot = document.getElementById('root')
    appRoot?.setAttribute('inert', '')

    // 키보드·스크린리더 사용자가 바로 메뉴를 탐색할 수 있게 드로어 안으로 포커스를 옮깁니다.
    drawer?.querySelector(FOCUSABLE_SELECTOR)?.focus()

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        return
      }

      // aria-modal 드로어이므로 Tab 포커스가 드로어 밖(가려진 페이지)으로 나가지 않게 순환시킵니다.
      if (event.key !== 'Tab' || !drawer) return
      const focusables = drawer.querySelectorAll(FOCUSABLE_SELECTOR)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      // 패널의 빈 곳을 클릭하면 포커스가 body로 빠집니다. inert가 1차 방어지만,
      // 포커스가 드로어 밖에 있으면 방향에 맞춰 드로어의 처음·끝으로 되돌립니다.
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    // 드로어가 열린 채 창을 넓히면 드로어는 CSS로 숨겨지지만 스크롤 잠금은 남으므로 함께 닫습니다.
    const desktopMedia = window.matchMedia(DESKTOP_QUERY)
    const handleViewportChange = event => {
      if (event.matches) setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    desktopMedia.addEventListener('change', handleViewportChange)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      window.removeEventListener('keydown', handleKeyDown)
      desktopMedia.removeEventListener('change', handleViewportChange)
      // 닫힘·라우트 이동·언마운트 모두 이 cleanup을 거치므로 inert가 남지 않습니다.
      // 햄버거 버튼도 #root 안에 있어 inert 상태에서는 포커스를 받지 못하므로, 반드시 해제한 뒤 포커스를 돌립니다.
      appRoot?.removeAttribute('inert')
      // Design Ref: §5.3 — 닫히면 드로어를 연 햄버거 버튼으로 포커스를 돌려 키보드 위치를 잃지 않게 합니다.
      // (메뉴 이동으로 헤더 자체가 사라진 경우에는 연결이 끊긴 버튼이라 아무 일도 일어나지 않습니다.)
      toggleButton?.focus()
    }
  }, [isOpen])

  const handleLogout = () => {
    closeDrawer()
    onLogout()
  }

  const renderAccountArea = () => {
    if (member) {
      return (
        <>
          <p className="mobile-nav__member-name">
            <strong>{member.nickname || '사용자'}</strong>님
          </p>
          <ul className="mobile-nav__list mobile-nav__list--sub">
            {memberMenuItems.map(item => (
              <li key={item.to}>
                <Link to={item.to} onClick={closeDrawer}>{item.label}</Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={handleLogout}>로그아웃</button>
            </li>
          </ul>
        </>
      )
    }

    // Design Ref: §12 R-3 — 복원이 끝나기 전에는 로그인 여부를 모르므로 버튼을 보여 주지 않습니다.
    if (isRestoring) return <div className="mobile-nav__account-placeholder" aria-hidden="true" />

    return (
      <div className="mobile-nav__auth">
        <Link className="mobile-nav__auth-login" to="/login" onClick={closeDrawer}>로그인</Link>
        <Link className="mobile-nav__auth-signup" to="/signup" onClick={closeDrawer}>회원가입</Link>
      </div>
    )
  }

  return (
    <>
      <button
        ref={toggleButtonRef}
        className="site-header__menu-button"
        type="button"
        aria-label="전체 메뉴"
        aria-expanded={isOpen}
        // 닫힌 동안에는 드로어가 DOM에 없으므로 존재하지 않는 id를 가리키지 않게 합니다.
        aria-controls={isOpen ? drawerId : undefined}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className="site-header__menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {/*
        Design Ref: §5.1 — 헤더는 transform·backdrop-filter를 쓰므로 그 안의 position: fixed 요소는
        화면이 아니라 헤더 기준으로 배치됩니다. 드로어를 body로 포털해 화면 전체를 덮게 합니다.
      */}
      {isOpen && createPortal(
        <div className="mobile-nav">
          <div className="mobile-nav__backdrop" aria-hidden="true" onClick={closeDrawer} />
          <div className="mobile-nav__panel" id={drawerId} ref={drawerRef} role="dialog" aria-modal="true" aria-label="전체 메뉴">
            <div className="mobile-nav__top">
              <strong>메뉴</strong>
              <button className="mobile-nav__close" type="button" aria-label="메뉴 닫기" onClick={closeDrawer}>×</button>
            </div>

            <nav aria-label="주요 메뉴">
              <ul className="mobile-nav__list">
                {mainNavItems.map(item => (
                  <li key={item.key}>
                    <Link
                      className={activePage === item.key ? 'is-active' : undefined}
                      to={item.to}
                      aria-current={activePage === item.key ? 'page' : undefined}
                      onClick={closeDrawer}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <hr className="mobile-nav__divider" />

            <div className="mobile-nav__account">{renderAccountArea()}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
