import { Link } from 'react-router-dom'
import './StatusPage.css'

/**
 * 메뉴는 있지만 아직 구현되지 않은 기능(피드, 북마크, 마이 페이지, 공지사항)을 안내하는 화면입니다.
 *
 * Design Ref: §3.2 — 메뉴를 숨기지 않고 "준비 중" 화면으로 연결해 메뉴 구조를 유지합니다.
 * 기능이 완성되면 App.jsx의 해당 라우트 element만 실제 페이지로 바꾸면 됩니다.
 * 로그인 여부와 무관하게 같은 화면을 보여 줍니다.
 */
export default function ComingSoonPage({ title }) {
  return (
    <main className="status-page">
      <section className="status-page__card" aria-labelledby="coming-soon-title">
        <p className="status-page__eyebrow">준비 중</p>
        <h1 className="status-page__title" id="coming-soon-title">{title} 기능을 준비하고 있습니다</h1>
        <p className="status-page__description">더 나은 여행 경험을 위해 열심히 만들고 있어요. 조금만 기다려 주세요.</p>
        <div className="status-page__actions">
          <Link className="status-page__button status-page__button--primary" to="/">홈으로</Link>
        </div>
      </section>
    </main>
  )
}
