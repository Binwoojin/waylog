import { Link } from 'react-router-dom'
import './NotFoundPage.css'

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-page__content">
        <strong>404</strong>
        <h1>페이지를 찾을 수 없습니다</h1>
        <p>주소가 정확한지 확인해 주세요.</p>
        <Link to="/">홈으로 이동</Link>
      </div>
    </main>
  )
}
