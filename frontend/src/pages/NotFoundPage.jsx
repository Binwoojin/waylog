import { Link } from 'react-router-dom'
import './StatusPage.css'

/**
 * 존재하지 않는 경로나 콘텐츠를 안내하는 화면입니다.
 * Layout 안에서 본문만 렌더링하므로 헤더·푸터는 그대로 남습니다.
 *
 * Design Ref: §5.1 — title·description을 props로 받아
 * MF-4(상세 페이지 not-found)에서 "콘텐츠를 찾을 수 없습니다"로 재사용할 수 있게 합니다.
 */
export default function NotFoundPage({
  title = '페이지를 찾을 수 없습니다',
  description = '주소가 잘못 입력되었거나, 페이지가 이동 또는 삭제되었을 수 있습니다.',
}) {
  return (
    <main className="status-page">
      <section className="status-page__card" aria-labelledby="not-found-title">
        <p className="status-page__eyebrow">404</p>
        <h1 className="status-page__title" id="not-found-title">{title}</h1>
        <p className="status-page__description">{description}</p>
        <div className="status-page__actions">
          <Link className="status-page__button status-page__button--primary" to="/">홈으로</Link>
          <Link className="status-page__button" to="/destinations">여행지 보기</Link>
          <Link className="status-page__button" to="/enjoy">여행 즐기기</Link>
        </div>
      </section>
    </main>
  )
}
