import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import './FeedPage.css'

export default function FeedPage() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [posts, setPosts] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false

    async function loadFeed() {
      setStatus('loading')

      try {
        const data = await apiClient.get(`/api/v1/feed/posts?page=${page}&size=10`)
        if (cancelled) return
        setPosts(data.posts || [])
        setTotalPages(data.totalPages || 0)
        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    loadFeed()

    return () => {
      cancelled = true
    }
  }, [page])

  const requireLogin = () => {
    window.alert('로그인이 필요합니다.')
    navigate('/login')
  }

  const toggleLike = async post => {
    if (!member) {
      requireLogin()
      return
    }

    try {
      const response = await apiClient.post(`/api/v1/feed/posts/${post.id}/likes`)
      setPosts(current => current.map(item => (
        item.id === post.id
          ? { ...item, liked: response.active, likeCount: item.likeCount + (response.active ? 1 : -1) }
          : item
      )))
    } catch (error) {
      window.alert(error.message || '좋아요 처리 중 문제가 발생했습니다.')
    }
  }

  const toggleBookmark = async post => {
    if (!member) {
      requireLogin()
      return
    }

    try {
      const response = await apiClient.post(`/api/v1/feed/posts/${post.id}/bookmarks`)
      setPosts(current => current.map(item => (
        item.id === post.id ? { ...item, bookmarked: response.active } : item
      )))
    } catch (error) {
      window.alert(error.message || '북마크 처리 중 문제가 발생했습니다.')
    }
  }

  return (
    <main className="feed-page">
      <div className="feed-page__inner">
        <header className="feed-page__header">
          <h1>여행 피드</h1>
          <Link
            className="feed-page__write"
            to={member ? '/feed/new' : '/login'}
            onClick={event => {
              if (!member) {
                event.preventDefault()
                requireLogin()
              }
            }}
          >
            여행 기록 남기기
          </Link>
        </header>

        {status === 'loading' && <p className="feed-page__status">불러오는 중입니다.</p>}
        {status === 'error' && <p className="feed-page__status">피드를 불러오지 못했습니다.</p>}
        {status === 'ready' && posts.length === 0 && (
          <p className="feed-page__status">아직 등록된 여행 기록이 없습니다.</p>
        )}

        {status === 'ready' && posts.length > 0 && (
          <div className="feed-page__list">
            {posts.map(post => (
              <article key={post.id} className="feed-card">
                <Link className="feed-card__link" to={`/feed/${post.id}`}>
                  {post.images?.[0] && <img src={post.images[0]} alt="" className="feed-card__image" />}
                  <div className="feed-card__body">
                    <div className="feed-card__author">
                      <strong>{post.author?.nickname || '탈퇴한 회원'}</strong>
                      {post.location && (
                        <span><PlacePinIcon size={13} />{post.location}</span>
                      )}
                    </div>
                    <p className="feed-card__content">{post.content}</p>
                    {post.tags?.length > 0 && (
                      <div className="feed-card__tags">
                        {post.tags.map(tag => <span key={tag}>#{tag}</span>)}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="feed-card__actions">
                  <button type="button" className={post.liked ? 'active' : ''} onClick={() => toggleLike(post)}>
                    ♥ {post.likeCount}
                  </button>
                  <Link to={`/feed/${post.id}`}>💬 {post.commentCount}</Link>
                  <button type="button" className={post.bookmarked ? 'active' : ''} onClick={() => toggleBookmark(post)}>
                    🔖 {post.bookmarked ? '저장됨' : '저장'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="feed-page__pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>이전</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)}>다음</button>
          </div>
        )}
      </div>
    </main>
  )
}
