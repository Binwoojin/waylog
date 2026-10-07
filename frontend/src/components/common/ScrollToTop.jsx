import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * 경로(pathname)가 바뀌면 창 스크롤을 맨 위로 되돌립니다.
 *
 * Design Ref: §5.4 — SPA에서는 문서가 새로 로드되지 않아, 홈 카드처럼 페이지 중간의 Link를 누르면
 * 상세 화면이 이전 스크롤 위치에서 열립니다.
 *
 * - useLayoutEffect: 새 화면을 그리기 전에 스크롤해 이전 위치가 한 프레임 보였다 튀는 현상을 막습니다.
 * - pathname만 의존합니다. 같은 화면에서 ?type=·검색 조건처럼 쿼리만 바뀌는 이동은 위치를 유지합니다.
 * - POP(뒤로·앞으로 가기, 첫 로드)은 제외합니다. 브라우저의 스크롤 복원을 덮어쓰면
 *   목록으로 돌아왔을 때 보던 위치를 잃기 때문입니다.
 *
 * 앱 전체 라우트(Layout 밖의 홈·로그인 포함)에 적용하려고 BrowserRouter 바로 아래에 둡니다.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  // 직전 pathname. navigationType만 바뀌는 경우(POP 뒤 같은 화면에서 쿼리만 PUSH)를 걸러 냅니다.
  const previousPathnameRef = useRef(pathname)

  useLayoutEffect(() => {
    if (previousPathnameRef.current === pathname) return
    previousPathnameRef.current = pathname
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])

  return null
}
