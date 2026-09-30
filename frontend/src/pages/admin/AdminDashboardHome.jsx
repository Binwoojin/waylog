import { Link } from 'react-router-dom'
import './AdminDashboardHome.css'

/*
 * 관리자 대시보드 홈: 리소스 진입 카드
 *
 * Design Ref: admin-dashboard.design.md §2.1(FR-D05) — 통계 수치는 이번 범위에서 제외하고
 * 리소스 진입 카드만 둡니다. 공지·회원·피드·여행코스 4개 리소스가 모두 구현되었습니다.
 */
const RESOURCE_CARDS = [
  { to: '/admin/notices', title: '공지사항', description: '공지 목록을 조회하고 새 공지를 등록·수정·삭제합니다.' },
  { to: '/admin/courses', title: '여행코스', description: '여행코스를 등록하고 일자·경유지·이미지를 관리합니다.' },
  { to: '/admin/users', title: '회원', description: '회원 등급과 활동 정지를 관리합니다.' },
  { to: '/admin/feed', title: '피드', description: '사용자 게시물을 모니터링하고 관리합니다.' },
]

export default function AdminDashboardHome() {
  return (
    <div className="admin-dashboard-home">
      <h1>관리자 대시보드</h1>
      <p>리소스를 선택해 관리 화면으로 이동하세요.</p>
      <div className="admin-dashboard-home__grid">
        {RESOURCE_CARDS.map(card => (
          <Link key={card.to} to={card.to} className="admin-dashboard-home__card">
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
