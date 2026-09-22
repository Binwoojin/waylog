import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './MyPage.css'

export default function MyPage() {
  const { member, logout } = useAuth()
  const navigate = useNavigate()

  if (!member) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <main className="mypage">
      <div className="mypage__inner">
        <h1>마이 페이지</h1>

        <section className="mypage__profile">
          <span className="mypage__avatar" aria-hidden="true">{(member.nickname || '?').charAt(0)}</span>
          <div>
            <strong>{member.nickname || '사용자'}</strong>
            <p>{member.email}</p>
          </div>
        </section>

        <nav className="mypage__menu" aria-label="마이 페이지 메뉴">
          <Link to="/bookmarks">내 북마크</Link>
          <button type="button" onClick={handleLogout}>로그아웃</button>
        </nav>
      </div>
    </main>
  )
}
