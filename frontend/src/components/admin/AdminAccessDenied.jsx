import { Link } from 'react-router-dom'
import '../../pages/StatusPage.css'

/**
 * 로그인은 했지만 관리자가 아닌 회원이 "/admin"에 접근했을 때 보여주는 화면입니다.
 *
 * Design Ref: admin-dashboard.design.md §2.1 — NotFoundPage·ComingSoonPage와 같은
 * status-page 카드 스타일을 재사용해 별도 스타일 없이도 일관된 안내 화면을 만듭니다.
 */
export default function AdminAccessDenied() {
  return (
    <main className="status-page">
      <section className="status-page__card" aria-labelledby="admin-access-denied-title">
        <p className="status-page__eyebrow status-page__eyebrow--error">403</p>
        <h1 className="status-page__title" id="admin-access-denied-title">관리자만 접근할 수 있습니다</h1>
        <p className="status-page__description">이 페이지는 관리자 계정으로 로그인해야 볼 수 있습니다.</p>
        <div className="status-page__actions">
          <Link className="status-page__button status-page__button--primary" to="/">홈으로</Link>
        </div>
      </section>
    </main>
  )
}
