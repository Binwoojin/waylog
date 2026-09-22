import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

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
      <Outlet />
      <Footer />
    </>
  )
}
