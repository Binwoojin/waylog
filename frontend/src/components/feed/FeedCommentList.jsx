import { Link } from 'react-router-dom'
import FeedCommentForm from './FeedCommentForm'
import defaultAvatar from '../../assets/figma/destination-jeju.png'
import './FeedCommentList.css'

/**
 * 댓글+답글 목록 표시 컴포넌트
 *
 * Design Ref: feed-comment-integration.design.md §6.2 — 답글은 토글 없이 항상 펼쳐서
 * 보여준다(Q-3). 답글 행에는 onReply를 아예 전달하지 않아 [답글] 버튼 자체가 렌더링되지
 * 않는다 — 서버의 1단계 제한(parent.isReply() 검증)을 UI에서도 이중으로 차단한다.
 */
export default function FeedCommentList({
  comments,
  hasNext,
  loadMoreStatus,
  onLoadMore,
  currentUserId,
  replyTargetId,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onDelete,
  isLoggedIn,
  requireLogin,
}) {
  if (comments.length === 0) {
    return <p className="feed-comment-list__empty">아직 댓글이 없습니다. 첫 댓글을 남겨 보세요.</p>
  }

  return (
    <div className="feed-comment-list">
      <ul className="feed-comment-list__items" aria-label="댓글 목록">
        {comments.map(comment => (
          <li key={comment.id} className="feed-comment">
            <CommentRow
              comment={comment}
              isOwner={currentUserId != null && comment.author.id === currentUserId}
              onReply={() => onStartReply(comment.id)}
              onDelete={() => onDelete(comment, null)}
            />

            {replyTargetId === comment.id && (
              <div className="feed-comment__reply-form">
                <FeedCommentForm
                  placeholder={`${comment.author.nickname || '작성자'}님에게 답글 남기기`}
                  onSubmit={content => onSubmitReply(comment.id, content)}
                  isReply
                  onCancel={onCancelReply}
                  isLoggedIn={isLoggedIn}
                  requireLogin={requireLogin}
                />
              </div>
            )}

            {/* Q-3: 답글은 조건 없이 그대로 렌더링한다(접기/펼치기 토글 UI 없음). */}
            {comment.replies.length > 0 && (
              <ul className="feed-comment__replies" aria-label={`${comment.author.nickname || '작성자'}님 댓글의 답글`}>
                {comment.replies.map(reply => (
                  <li key={reply.id} className="feed-comment feed-comment--reply">
                    <CommentRow
                      comment={reply}
                      isOwner={currentUserId != null && reply.author.id === currentUserId}
                      onDelete={() => onDelete(reply, comment.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {hasNext && (
        <button
          type="button"
          className="feed-comment-list__more"
          onClick={onLoadMore}
          disabled={loadMoreStatus === 'loading'}
        >
          {loadMoreStatus === 'loading' ? '불러오는 중...' : '댓글 더 보기'}
        </button>
      )}

      {loadMoreStatus === 'error' && (
        <p className="feed-comment-list__more-error" role="alert">댓글을 더 불러오지 못했습니다. 다시 시도해 주세요.</p>
      )}
    </div>
  )
}

/**
 * 댓글/답글 한 줄 표시. onReply가 없으면(답글) [답글] 버튼을 렌더링하지 않는다.
 */
function CommentRow({ comment, isOwner, onReply, onDelete }) {
  return (
    <div className="feed-comment__row">
      <Link to={`/feed/users/${comment.author.id}`} className="feed-comment__author">
        <img className="feed-comment__avatar" src={comment.author.profileImageUrl ?? defaultAvatar} alt="" loading="lazy" />
        <span className="feed-comment__nickname">{comment.author.nickname || '알 수 없음'}</span>
      </Link>

      <p className="feed-comment__content">{comment.content}</p>

      <div className="feed-comment__meta">
        {comment.createdAt && (
          <time dateTime={comment.createdAt}>{comment.createdAt.slice(0, 16).replace('T', ' ')}</time>
        )}
        {onReply && (
          <button type="button" className="feed-comment__action" onClick={onReply}>
            답글
          </button>
        )}
        {isOwner && (
          <button type="button" className="feed-comment__action feed-comment__action--danger" onClick={onDelete}>
            삭제
          </button>
        )}
      </div>
    </div>
  )
}
