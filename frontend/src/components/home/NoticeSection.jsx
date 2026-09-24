import { Link } from 'react-router-dom'
import './HomeSections.css'

// 공지사항 백엔드 연결 전 사용하는 최신 공지 미리보기 데이터입니다.
const notices = [
  { type: '중요', title: 'WayLog SNS 서비스 점검 안내', date: '2026.01.08' },
  { type: '안내', title: '여행 기록 챌린지 운영 안내', date: '2025.12.14' },
  { type: '정책', title: '개인정보처리방침 개정 안내', date: '2025.11.27' },
]

export default function NoticeSection() {
  // 공지 유형은 CSS modifier 클래스에 사용되어 배지 색상을 구분합니다.
  // Design Ref: §3.2 — 공지 상세·목록 페이지가 생기기 전까지 "전체 보기"와 각 항목은 /notices("준비 중")로 연결합니다.
  return (
    <section className="home-section notice-section">
      <div className="section-heading">
        <div><h2>공지사항</h2></div>
        <Link to="/notices">전체 보기 <span>→</span></Link>
      </div>
      <ul>
        {notices.map(item => (
          <li key={item.title}>
            <span className={`notice-badge notice-badge--${item.type}`}>{item.type}</span>
            <Link to="/notices">{item.title}</Link>
            <time>{item.date}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}
