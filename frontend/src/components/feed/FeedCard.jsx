import { Link } from 'react-router-dom'
import HeartIcon from '../icons/HeartIcon'
import BookmarkIcon from '../icons/BookmarkIcon'
import PlacePinIcon from '../icons/PlacePinIcon'
import defaultAvatar from '../../assets/figma/destination-jeju.png'
import './FeedCard.css'

const CONTENT_PREVIEW_LENGTH = 160

function toPreview(content) {
  if (content.length <= CONTENT_PREVIEW_LENGTH) return content
  return `${content.slice(0, CONTENT_PREVIEW_LENGTH).trimEnd()}…`
}

/**
 * 피드 타임라인 카드 (표시 컴포넌트)
 *
 * Design Ref: feed-integration.design.md §3.1, §7 — 화면은 view model(FeedPost)만 알고
 * API 필드 이름을 모른다. 삭제 버튼은 카드에 두지 않는다(상세 화면 전용, 계획 §2.1).
 *
 * onToggleLike/onToggleBookmark: 낙관적 업데이트는 부모(FeedPage)가 처리한다.
 * 이 컴포넌트는 순수 표시 + 콜백 호출만 담당한다.
 */
export default function FeedCard({ post, onToggleLike, onToggleBookmark }) {
  const [firstImage] = post.images
  const previewText = toPreview(post.content)

  return (
    <article className="feed-card">
      <header className="feed-card__author">
        <Link to={`/feed/users/${post.author.id}`} className="feed-card__author-link">
          <img
            className="feed-card__avatar"
            src={post.author.profileImageUrl ?? defaultAvatar}
            alt=""
            loading="lazy"
          />
          <span className="feed-card__nickname">{post.author.nickname || '알 수 없음'}</span>
        </Link>
        {post.createdAt && (
          <time className="feed-card__time" dateTime={post.createdAt}>
            {post.createdAt.slice(0, 10)}
          </time>
        )}
      </header>

      <Link to={post.detailPath} className="feed-card__body">
        {firstImage && (
          <div className="feed-card__image-wrap">
            <img className="feed-card__image" src={firstImage} alt="" loading="lazy" />
            {post.images.length > 1 && (
              <span className="feed-card__image-count">+{post.images.length - 1}</span>
            )}
          </div>
        )}

        <p className="feed-card__content">{previewText}</p>

        {post.locationName && (
          <p className="feed-card__location">
            <PlacePinIcon size={14} />
            <span>{post.locationName}</span>
          </p>
        )}

        {post.tags.length > 0 && (
          <ul className="feed-card__tags">
            {post.tags.map(tag => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        )}
      </Link>

      <footer className="feed-card__actions">
        <button
          type="button"
          className={`feed-card__action${post.liked ? ' is-active' : ''}`}
          aria-pressed={post.liked}
          onClick={() => onToggleLike(post)}
        >
          <HeartIcon size={18} filled={post.liked} />
          <span>{post.likeCount}</span>
        </button>

        {/*
          Design Ref: feed-integration.design.md §13 "연결 지점" — 댓글 UI는 이번 사이클(feed-integration)
          범위 밖이라(후속 feed-comment-integration) 숫자만 표시하고 클릭 가능한 링크로 만들지 않는다
          (거짓 UI 금지 원칙). commentCount는 항상 0이다(백엔드에 댓글 작성 경로가 아직 없음).
        */}
        <span className="feed-card__action feed-card__action--comment" aria-label={`댓글 ${post.commentCount}개`}>
          <span aria-hidden="true">💬</span>
          <span>{post.commentCount}</span>
        </span>

        <button
          type="button"
          className={`feed-card__action feed-card__action--bookmark${post.bookmarked ? ' is-active' : ''}`}
          aria-pressed={post.bookmarked}
          aria-label={post.bookmarked ? '북마크 해제' : '북마크'}
          onClick={() => onToggleBookmark(post)}
        >
          <BookmarkIcon size={18} filled={post.bookmarked} />
        </button>
      </footer>
    </article>
  )
}
