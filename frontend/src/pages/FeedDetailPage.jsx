import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import './FeedDetailPage.css'

export default function FeedDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()

  const [post, setPost] = useState(null)
  const [status, setStatus] = useState('loading')
  const [comments, setComments] = useState([])
  const [commentStatus, setCommentStatus] = useState('loading')
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingText, setEditingText] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadPost() {
      setStatus('loading')
      try {
        const data = await apiClient.get(`/api/v1/feed/posts/${id}`)
        if (cancelled) return
        setPost(data)
        setStatus('ready')
      } catch {
        if (cancelled) return
        setStatus('error')
      }
    }

    loadPost()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false

    async function loadComments() {
      setCommentStatus('loading')
      try {
        const data = await apiClient.get(`/api/v1/feed/posts/${id}/comments`)
        if (cancelled) return
        setComments(data)
        setCommentStatus('ready')
      } catch {
        if (cancelled) return
        setCommentStatus('error')
      }
    }

    loadComments()

    return () => {
      cancelled = true
    }
  }, [id])

  const requireLogin = () => {
    window.alert('로그인이 필요합니다.')
    navigate('/login')
  }

  const toggleLike = async () => {
    if (!member) return requireLogin()
    try {
      const response = await apiClient.post(`/api/v1/feed/posts/${id}/likes`)
      setPost(current => ({
        ...current,
        liked: response.active,
        likeCount: current.likeCount + (response.active ? 1 : -1),
      }))
    } catch (error) {
      window.alert(error.message || '좋아요 처리 중 문제가 발생했습니다.')
    }
  }

  const toggleBookmark = async () => {
    if (!member) return requireLogin()
    try {
      const response = await apiClient.post(`/api/v1/feed/posts/${id}/bookmarks`)
      setPost(current => ({ ...current, bookmarked: response.active }))
    } catch (error) {
      window.alert(error.message || '북마크 처리 중 문제가 발생했습니다.')
    }
  }

  const deletePost = async () => {
    if (!window.confirm('이 게시글을 삭제할까요?')) return
    try {
      await apiClient.delete(`/api/v1/feed/posts/${id}`)
      navigate('/feed')
    } catch (error) {
      window.alert(error.message || '게시글 삭제 중 문제가 발생했습니다.')
    }
  }

  const submitComment = async event => {
    event.preventDefault()
    if (!member) return requireLogin()
    if (!commentText.trim()) return

    setSubmittingComment(true)
    try {
      const response = await apiClient.post(`/api/v1/feed/posts/${id}/comments`, { content: commentText.trim() })
      setComments(current => [...current, response])
      setCommentText('')
      setPost(current => ({ ...current, commentCount: current.commentCount + 1 }))
    } catch (error) {
      window.alert(error.message || '댓글 등록 중 문제가 발생했습니다.')
    } finally {
      setSubmittingComment(false)
    }
  }

  const startEditComment = comment => {
    setEditingCommentId(comment.id)
    setEditingText(comment.content)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingText('')
  }

  const saveEditComment = async commentId => {
    if (!editingText.trim()) return
    try {
      const response = await apiClient.put(`/api/v1/feed/comments/${commentId}`, { content: editingText.trim() })
      setComments(current => current.map(comment => (comment.id === commentId ? response : comment)))
      cancelEditComment()
    } catch (error) {
      window.alert(error.message || '댓글 수정 중 문제가 발생했습니다.')
    }
  }

  const deleteComment = async commentId => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    try {
      await apiClient.delete(`/api/v1/feed/comments/${commentId}`)
      setComments(current => current.filter(comment => comment.id !== commentId))
      setPost(current => ({ ...current, commentCount: Math.max(0, current.commentCount - 1) }))
    } catch (error) {
      window.alert(error.message || '댓글 삭제 중 문제가 발생했습니다.')
    }
  }

  const canManageComment = comment => {
    if (!member) return false
    if (member.memberId === comment.author?.id) return true
    return (member.role || '').toUpperCase() === 'ADMIN'
  }

  if (status === 'loading') {
    return <main className="feed-detail-page"><p className="feed-detail-page__status">불러오는 중입니다.</p></main>
  }

  if (status === 'error' || !post) {
    return (
      <main className="feed-detail-page">
        <div className="feed-detail-page__notfound">
          <h1>게시글을 찾을 수 없습니다</h1>
          <p>삭제되었거나 비공개 게시글일 수 있습니다.</p>
          <Link to="/feed">피드로 이동</Link>
        </div>
      </main>
    )
  }

  const isOwner = member && member.memberId === post.author?.id

  return (
    <main className="feed-detail-page">
      <div className="feed-detail-page__inner">
        <Link className="feed-detail-page__back" to="/feed">← 피드로 돌아가기</Link>

        <article className="feed-detail-post">
          <header>
            <strong>{post.author?.nickname || '탈퇴한 회원'}</strong>
            {post.location && <span><PlacePinIcon size={14} />{post.location}</span>}
            {isOwner && <button type="button" className="feed-detail-post__delete" onClick={deletePost}>삭제</button>}
          </header>

          {post.images?.length > 0 && (
            <div className="feed-detail-post__images">
              {post.images.map(src => <img src={src} alt="" key={src} />)}
            </div>
          )}

          <p className="feed-detail-post__content">{post.content}</p>

          {post.tags?.length > 0 && (
            <div className="feed-detail-post__tags">
              {post.tags.map(tag => <span key={tag}>#{tag}</span>)}
            </div>
          )}

          <div className="feed-detail-post__actions">
            <button type="button" className={post.liked ? 'active' : ''} onClick={toggleLike}>♥ 좋아요 {post.likeCount}</button>
            <button type="button" className={post.bookmarked ? 'active' : ''} onClick={toggleBookmark}>🔖 {post.bookmarked ? '저장됨' : '저장'}</button>
          </div>
        </article>

        <section className="feed-comments">
          <h2>댓글 {post.commentCount}</h2>

          {commentStatus === 'loading' && <p className="feed-detail-page__status">댓글을 불러오는 중입니다.</p>}
          {commentStatus === 'error' && <p className="feed-detail-page__status">댓글을 불러오지 못했습니다.</p>}

          {commentStatus === 'ready' && (
            <ul className="feed-comments__list">
              {comments.map(comment => (
                <li key={comment.id}>
                  <strong>{comment.author?.nickname || '탈퇴한 회원'}</strong>
                  {editingCommentId === comment.id ? (
                    <div className="feed-comments__edit">
                      <textarea value={editingText} onChange={event => setEditingText(event.target.value)} maxLength={500} rows={2} />
                      <div>
                        <button type="button" onClick={() => saveEditComment(comment.id)}>저장</button>
                        <button type="button" onClick={cancelEditComment}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <p>{comment.content}</p>
                  )}
                  {canManageComment(comment) && editingCommentId !== comment.id && (
                    <div className="feed-comments__actions">
                      <button type="button" onClick={() => startEditComment(comment)}>수정</button>
                      <button type="button" onClick={() => deleteComment(comment.id)}>삭제</button>
                    </div>
                  )}
                </li>
              ))}
              {comments.length === 0 && <li className="feed-comments__empty">첫 댓글을 남겨보세요.</li>}
            </ul>
          )}

          <form className="feed-comments__form" onSubmit={submitComment}>
            <textarea
              rows={2}
              maxLength={500}
              value={commentText}
              onChange={event => setCommentText(event.target.value)}
              placeholder={member ? '댓글을 입력해 주세요.' : '로그인 후 댓글을 남길 수 있습니다.'}
            />
            <button type="submit" disabled={submittingComment}>등록</button>
          </form>
        </section>
      </div>
    </main>
  )
}
