// 데스크톱 헤더와 모바일 드로어가 공유하는 메뉴입니다.
// Design Ref: §3.1 — 두 곳이 같은 메뉴를 보여 줘야 하므로 데이터를 한 곳에 둡니다.
// 푸터는 구성(고객지원·약관)이 달라 이 데이터를 공유하지 않습니다.
// key는 Layout의 resolveActivePage 결과와 비교해 현재 메뉴를 표시하는 데 사용합니다.
export const mainNavItems = [
  { key: 'destinations', label: '여행지', to: '/destinations' },
  { key: 'enjoy', label: '여행 즐기기', to: '/enjoy' },
  { key: 'feed', label: '여행 피드', to: '/feed' },
]

// 로그인한 사용자에게만 보이는 회원 메뉴입니다. (로그아웃 버튼은 각 화면에서 따로 렌더링)
export const memberMenuItems = [
  { label: '북마크', to: '/bookmarks' },
  { label: '마이 페이지', to: '/mypage' },
]
