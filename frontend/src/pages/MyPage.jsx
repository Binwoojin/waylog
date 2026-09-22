import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import './MyPage.css'

export default function MyPage() {
  const { member, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [editingHandle, setEditingHandle] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [savingHandle, setSavingHandle] = useState(false)

  useEffect(() => {
    if (!member) return undefined

    let cancelled = false

    async function loadProfile() {
      setStatus('loading')
      try {
        const data = await apiClient.get('/api/v1/feed/profile?page=1&size=12')
        if (cancelled) return
        setProfile(data)
        setHandleInput(data.feedHandle)
        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [member])

  if (!member) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const saveHandle = async event => {
    event.preventDefault()
    setSavingHandle(true)
    try {
      const response = await apiClient.patch('/api/v1/feed/profile', { feedHandle: handleInput })
      setProfile(current => ({ ...current, feedHandle: response.feedHandle }))
      setEditingHandle(false)
    } catch (error) {
      window.alert(error.message || '피드 아이디 변경 중 문제가 발생했습니다.')
    } finally {
      setSavingHandle(false)
    }
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
            {profile && !editingHandle && (
              <p className="mypage__handle">
                @{profile.feedHandle}
                <button type="button" onClick={() => setEditingHandle(true)}>수정</button>
              </p>
            )}
            {editingHandle && (
              <form className="mypage__handle-form" onSubmit={saveHandle}>
                <input value={handleInput} onChange={event => setHandleInput(event.target.value)} maxLength={20} />
                <button type="submit" disabled={savingHandle}>저장</button>
                <button type="button" onClick={() => { setEditingHandle(false); setHandleInput(profile.feedHandle) }}>취소</button>
              </form>
            )}
          </div>
        </section>

        <nav className="mypage__menu" aria-label="마이 페이지 메뉴">
          <Link to="/bookmarks">내 북마크</Link>
          <button type="button" onClick={handleLogout}>로그아웃</button>
        </nav>

        <section className="mypage__feed">
          <div className="mypage__feed-stats">
            <div><strong>{profile?.postCount ?? 0}</strong><span>여행 기록</span></div>
            <div><strong>{profile?.receiveLikeCount ?? 0}</strong><span>받은 좋아요</span></div>
          </div>

          {status === 'loading' && <p className="mypage__status">불러오는 중입니다.</p>}
          {status === 'error' && <p className="mypage__status">여행 기록을 불러오지 못했습니다.</p>}
          {status === 'ready' && profile?.posts.length === 0 && (
            <p className="mypage__status">아직 등록한 여행 기록이 없습니다.</p>
          )}

          {status === 'ready' && profile?.posts.length > 0 && (
            <div className="mypage__feed-grid">
              {profile.posts.map(post => (
                <Link key={post.id} to={`/feed/${post.id}`} className="mypage__feed-card">
                  {post.images?.[0] ? <img src={post.images[0]} alt="" /> : <div className="mypage__feed-card__placeholder" />}
                  <p>{post.content}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
