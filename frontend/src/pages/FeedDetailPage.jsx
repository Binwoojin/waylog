import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeedDetail } from '../hooks/useFeedDetail'
import { deleteFeedPost, toggleFeedBookmark, toggleFeedLike } from '../api/feedApi'
import { getTourDetailPath } from '../data/tourContentTypes'
import { buildKakaoMapLink } from '../lib/mapLink'
import HeartIcon from '../components/icons/HeartIcon'
import BookmarkIcon from '../components/icons/BookmarkIcon'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import FeedConfirmDialog from '../components/feed/FeedConfirmDialog'
import DetailStatus from '../components/detail/DetailStatus'
import NotFoundPage from './NotFoundPage'
import { DETAIL_NOT_FOUND_DESCRIPTION, DETAIL_NOT_FOUND_TITLE } from '../components/detail/detailMessages'
import defaultAvatar from '../assets/figma/destination-jeju.png'
import './FeedDetailPage.css'

const FEED_LIST_PATH = '/feed'

/**
 * 피드 게시물 상세 (`/feed/posts/:id`)
 *
 * Design Ref: feed-integration.design.md — 삭제는 작성자 본인 게시물에서만 노출되고,
 * 항상 확인 모달을 거친다(계획 §2.1, 프로젝트 전체 삭제 원칙). 댓글 UI는 이번 사이클
 * 범위 밖이라 포함하지 않는다(설계 §13 "연결 지점").
 */
export default function FeedDetailPage() {
  const { id } = useParams()
  // key={id}로 재마운트해 id가 바뀔 때 useFeedDetail이 항상 loading부터 시작한다(useCourseDetail과 동일 패턴).
  return <FeedDetailContent key={id} id={id} />
}

function FeedDetailContent({ id }) {
  const { member } = useAuth()
  const navigate = useNavigate()
  const { status, post, retry, hasRetried, applyLocalUpdate } = useFeedDetail(id)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  if (status === 'loading') return <DetailStatus variant="loading" />
  if (status === 'error') {
    return <DetailStatus variant="error" onRetry={retry} backTo={FEED_LIST_PATH} focusOnMount={hasRetried} />
  }
  if (status === 'not-found') {
    return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
  }

  const isOwner = Boolean(member) && member.memberId === post.author.id
  const referencePath = post.tourContentId ? getTourDetailPath(post.tourContentId, post.tourContentTypeId) : null
  const mapLink = !referencePath ? buildKakaoMapLink({ name: post.locationName, latitude: post.latitude, longitude: post.longitude }) : null

  function requireLogin() {
    navigate('/login')
  }

  async function handleToggleLike() {
    if (!member) return requireLogin()
    const previousLiked = post.liked
    const previousCount = post.likeCount
    applyLocalUpdate({ liked: !previousLiked, likeCount: Math.max(0, previousCount + (previousLiked ? -1 : 1)) })
    try {
      const active = await toggleFeedLike(post.id)
      applyLocalUpdate({ liked: active })
    } catch (error) {
      console.error('좋아요 처리에 실패했습니다.', error)
      applyLocalUpdate({ liked: previousLiked, likeCount: previousCount })
    }
  }

  async function handleToggleBookmark() {
    if (!member) return requireLogin()
    const previousBookmarked = post.bookmarked
    applyLocalUpdate({ bookmarked: !previousBookmarked })
    try {
      const active = await toggleFeedBookmark(post.id)
      applyLocalUpdate({ bookmarked: active })
    } catch (error) {
      console.error('북마크 처리에 실패했습니다.', error)
      applyLocalUpdate({ bookmarked: previousBookmarked })
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteFeedPost(post.id)
      navigate(FEED_LIST_PATH)
    } catch (error) {
      console.error('게시물 삭제에 실패했습니다.', error)
      setDeleteError('게시물을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setDeleting(false)
    }
  }

  return (
    <div className="feed-detail-page">
      <main className="feed-detail-main">
        <p className="feed-detail-breadcrumb">
          <Link to="/">홈</Link><span>›</span><Link to={FEED_LIST_PATH}>여행 피드</Link>
        </p>

        <article className="feed-detail-card">
          <header className="feed-detail-author">
            <Link to={`/feed/users/${post.author.id}`} className="feed-detail-author__link">
              <img className="feed-detail-author__avatar" src={post.author.profileImageUrl ?? defaultAvatar} alt="" />
              <span>{post.author.nickname || '알 수 없음'}</span>
            </Link>
            {post.createdAt && <time dateTime={post.createdAt}>{post.createdAt.slice(0, 16).replace('T', ' ')}</time>}

            {isOwner && (
              <button type="button" className="feed-detail-delete" onClick={() => setConfirmOpen(true)}>
                삭제
              </button>
            )}
          </header>

          {post.images.length > 0 && (
            <div className="feed-detail-gallery">
              {post.images.map((url, index) => (
                <img key={url} src={url} alt="" loading={index === 0 ? 'eager' : 'lazy'} />
              ))}
            </div>
          )}

          <p className="feed-detail-content">{post.content}</p>

          {post.locationName && (
            <div className="feed-detail-location">
              <PlacePinIcon size={16} />
              <span>{post.locationName}{post.address ? ` · ${post.address}` : ''}</span>
              {referencePath && <Link to={referencePath}>여행지 상세 보기</Link>}
              {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer">지도에서 보기</a>}
            </div>
          )}

          {post.tags.length > 0 && (
            <ul className="feed-detail-tags">
              {post.tags.map(tag => <li key={tag}>#{tag}</li>)}
            </ul>
          )}

          <footer className="feed-detail-actions">
            <button
              type="button"
              className={`feed-detail-action${post.liked ? ' is-active' : ''}`}
              aria-pressed={post.liked}
              onClick={handleToggleLike}
            >
              <HeartIcon size={20} filled={post.liked} />
              <span>좋아요 {post.likeCount}</span>
            </button>

            {/* 댓글 UI는 이번 사이클 범위 밖이다(설계 §13). 숫자만 표시하고 링크는 만들지 않는다. */}
            <span className="feed-detail-action feed-detail-action--comment" aria-label={`댓글 ${post.commentCount}개`}>
              <span aria-hidden="true">💬</span>
              <span>댓글 {post.commentCount}</span>
            </span>

            <button
              type="button"
              className={`feed-detail-action feed-detail-action--bookmark${post.bookmarked ? ' is-active' : ''}`}
              aria-pressed={post.bookmarked}
              onClick={handleToggleBookmark}
            >
              <BookmarkIcon size={20} filled={post.bookmarked} />
              <span>{post.bookmarked ? '북마크됨' : '북마크'}</span>
            </button>
          </footer>

          {deleteError && <p className="feed-detail-error" role="alert">{deleteError}</p>}
        </article>
      </main>

      <FeedConfirmDialog
        open={confirmOpen}
        title="게시물을 삭제할까요?"
        description="삭제한 게시물은 되돌릴 수 없습니다."
        pending={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
