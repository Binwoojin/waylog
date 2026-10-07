import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ErrorBoundary from '../common/ErrorBoundary'

function resolveActivePage(pathname) {
  if (pathname.startsWith('/destinations')) return 'destinations'
  if (pathname.startsWith('/enjoy')) return 'enjoy'
  if (pathname.startsWith('/feed')) return 'feed'
  return ''
}

export default function Layout() {
  const location = useLocation()
  const activePage = resolveActivePage(location.pathname)

  return (
    <>
      <Header forceLight activePage={activePage} />
      {/*
        Design Ref: §2.1 — 페이지 영역 오류 경계입니다. 본문(Outlet)만 감싸므로
        페이지가 렌더 중 오류를 내도 헤더·푸터는 남아 다른 메뉴로 이동할 수 있고,
        이동이 일어나면(resetKey) 오류 상태가 초기화되어 새 페이지가 정상 표시됩니다.
        location.key는 이동마다 새로 만들어지므로 pathname과 달리 쿼리만 바뀌는 이동이나
        같은 링크를 다시 누르는 경우에도 초기화됩니다.
      */}
      <ErrorBoundary variant="page" resetKey={location.key}>
        <Outlet />
      </ErrorBoundary>
      <Footer />
    </>
  )
}
