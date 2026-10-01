import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeedDetail } from '../hooks/useFeedDetail'
import { useFeedComments } from '../hooks/useFeedComments'
import { deleteFeedPost, toggleFeedBookmark, toggleFeedLike } from '../api/feedApi'
import { createFeedComment, deleteFeedComment } from '../api/feedCommentApi'
import { getTourDetailPath } from '../data/tourContentTypes'
import { buildKakaoMapLink } from '../lib/mapLink'
import HeartIcon from '../components/icons/HeartIcon'
import BookmarkIcon from '../components/icons/BookmarkIcon'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import CourseRouteIcon from '../components/icons/CourseRouteIcon'
import FeedConfirmDialog from '../components/feed/FeedConfirmDialog'
import FeedCommentList from '../components/feed/FeedCommentList'
import FeedCommentForm from '../components/feed/FeedCommentForm'
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
 * 항상 확인 모달을 거친다(계획 §2.1, 프로젝트 전체 삭제 원칙).
 *
 * Design Ref: feed-comment-integration.design.md §6.1 — 댓글 섹션(CommentSection)을 기존
 * "댓글 N개" 표시 지점 아래 인라인으로 연결한다. 댓글 작성·삭제가 성공하면 새 상태를 만들지
 * 않고 useFeedDetail의 applyLocalUpdate를 재사용해 post.commentCount를 갱신한다.
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

          {/*
            Design Ref: tour-course-feed-linking.design.md §5.3 — courseTag.detailPath는
            courseId가 있을 때만 만들어진다(courseApi.getCourseDetailPath). 참조 대상(코스)이
            이후 삭제돼 courseId가 없어지는 경우에도 courseTitle 스냅샷은 남을 수 있으므로,
            링크 없이 텍스트만 보여준다(거짓 링크를 만들지 않는다).
          */}
          {post.courseTag && (
            <div className="feed-detail-course">
              <CourseRouteIcon size={16} />
              <span>
                {post.courseTag.courseTitle}
                {post.courseTag.dayNumber != null ? ` · ${post.courseTag.dayNumber}일차` : ''}
                {post.courseTag.stopName ? ` · ${post.courseTag.stopName}` : ''}
              </span>
              {post.courseTag.detailPath && <Link to={post.courseTag.detailPath}>여행코스 상세 보기</Link>}
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

            {/* 실제 댓글 목록·입력은 아래 CommentSection에 있다. 이 액션 바의 숫자는 요약 표시용이다. */}
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

          <CommentSection
            postId={post.id}
            currentUserId={member?.memberId ?? null}
            isLoggedIn={Boolean(member)}
            requireLogin={requireLogin}
            commentCount={post.commentCount}
            onCommentCountChange={delta => applyLocalUpdate({ commentCount: Math.max(0, post.commentCount + delta) })}
          />
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

/**
 * 댓글 섹션 (게시물 상세에 인라인으로 통합)
 *
 * Design Ref: feed-comment-integration.design.md §6.1, §7 — useFeedComments(페이지 기반 누적,
 * "더 보기" 버튼)를 감싸는 얇은 컨테이너. Q-4(낙관적 업데이트 미적용): 작성·삭제 모두
 * API 요청이 await로 끝난 뒤에만 useFeedComments의 addComment/removeComment를 호출하고,
 * 그때만 onCommentCountChange로 post.commentCount를 갱신한다.
 */
function CommentSection({ postId, currentUserId, isLoggedIn, requireLogin, commentCount, onCommentCountChange }) {
  const { comments, status, hasNext, loadMoreStatus, loadMore, retry, addComment, removeComment } = useFeedComments(postId)
  const [replyTargetId, setReplyTargetId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // { comment, parentId } | null
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleSubmitTopLevel(content) {
    const saved = await createFeedComment(postId, { content, parentCommentId: null })
    addComment(saved, null)
    onCommentCountChange(1)
  }

  async function handleSubmitReply(parentId, content) {
    const saved = await createFeedComment(postId, { content, parentCommentId: parentId })
    addComment(saved, parentId)
    onCommentCountChange(1)
    setReplyTargetId(null)
  }

  function handleStartReply(commentId) {
    if (!isLoggedIn) return requireLogin()
    // 답글 입력창은 한 번에 하나만 연다. 같은 댓글을 다시 누르면 닫는다.
    setReplyTargetId(current => (current === commentId ? null : commentId))
  }

  function handleRequestDelete(comment, parentId) {
    setDeleteTarget({ comment, parentId })
    setDeleteError('')
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')

    const { comment, parentId } = deleteTarget

    try {
      const result = await deleteFeedComment(postId, comment.id)
      // 서버가 실제로 삭제한 개수를 응답으로 내려준다(모달이 열려 있는 동안 다른 사용자가
      // 답글을 추가했어도 정확함). 응답이 예상과 다른 형식이면 로컬 추정치로 폴백한다(fail-closed).
      const removedCount = Number.isInteger(result?.removedCount) && result.removedCount > 0
        ? result.removedCount
        : 1 + comment.replies.length
      removeComment(comment.id, parentId)
      onCommentCountChange(-removedCount)
      setDeleteTarget(null)
    } catch (error) {
      console.error('댓글 삭제에 실패했습니다.', error)
      setDeleteError('댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="feed-comment-section" aria-label="댓글">
      <h2 className="feed-comment-section__title">댓글 {commentCount}</h2>

      {status === 'loading' && (
        <p className="feed-comment-section__hint" role="status">댓글을 불러오는 중입니다...</p>
      )}

      {status === 'error' && (
        <div className="feed-comment-section__error" role="alert">
          <p>댓글을 불러오지 못했습니다.</p>
          <button type="button" onClick={retry}>다시 시도</button>
        </div>
      )}

      {status === 'success' && (
        <FeedCommentList
          comments={comments}
          hasNext={hasNext}
          loadMoreStatus={loadMoreStatus}
          onLoadMore={loadMore}
          currentUserId={currentUserId}
          replyTargetId={replyTargetId}
          onStartReply={handleStartReply}
          onCancelReply={() => setReplyTargetId(null)}
          onSubmitReply={handleSubmitReply}
          onDelete={handleRequestDelete}
          isLoggedIn={isLoggedIn}
          requireLogin={requireLogin}
        />
      )}

      <div className="feed-comment-section__form">
        <FeedCommentForm
          placeholder="댓글을 남겨보세요"
          onSubmit={handleSubmitTopLevel}
          isLoggedIn={isLoggedIn}
          requireLogin={requireLogin}
        />
      </div>

      {deleteError && <p className="feed-comment-section__delete-error" role="alert">{deleteError}</p>}

      <FeedConfirmDialog
        open={Boolean(deleteTarget)}
        title="댓글을 삭제할까요?"
        description={
          deleteTarget?.comment.replies.length > 0
            ? '답글이 있는 댓글을 삭제하면 답글도 함께 삭제됩니다. 삭제한 댓글은 되돌릴 수 없습니다.'
            : '삭제한 댓글은 되돌릴 수 없습니다.'
        }
        pending={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  )
}
