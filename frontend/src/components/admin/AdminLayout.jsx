import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from '../common/ErrorBoundary'
import './admin-common.css'
import './AdminLayout.css'

/*
 * 관리자 전용 레이아웃 (사이드바 + 콘텐츠 영역)
 *
 * Design Ref: admin-dashboard.design.md §2.1, §5.1 — 기존 사용자용 Layout(헤더·푸터)과는
 * 완전히 분리된 트리입니다. 사이드바 메뉴 4개는 계획 문서 범위와 고정으로 맞춥니다.
 *
 * 공지사항·회원·피드·여행코스 4개 리소스가 모두 구현되어 계획 9장 구현 순서가 끝났습니다.
 */
const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/notices', label: '공지사항' },
  { to: '/admin/courses', label: '여행코스' },
  { to: '/admin/users', label: '회원' },
  { to: '/admin/feed', label: '피드' },
]

export default function AdminLayout() {
  const location = useLocation()

  return (
    <div className="admin-layout">
      <aside className="admin-layout__sidebar">
        <Link to="/" className="admin-layout__brand">WayLog 관리자</Link>
        <nav className="admin-layout__nav" aria-label="관리자 메뉴">
          {ADMIN_NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-layout__nav-link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-layout__content">
        {/* Design Ref: §2.1 — Layout.jsx와 같은 이유로 콘텐츠 영역만 오류 경계를 둡니다. 사이드바는 남습니다. */}
        <ErrorBoundary variant="page" resetKey={location.key}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}
