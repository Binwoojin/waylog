import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeedInfiniteList } from '../hooks/useFeedInfiniteList'
import { toggleFeedBookmark, toggleFeedLike } from '../api/feedApi'
import { runOptimisticToggle } from '../lib/optimisticToggle'
import FeedCard from '../components/feed/FeedCard'
import FeedComposer from '../components/feed/FeedComposer'
import FeedTimelineSentinel from '../components/feed/FeedTimelineSentinel'
import '../pages/StatusPage.css'
import './FeedPage.css'

/**
 * 여행 피드 타임라인 (`/feed`)
 *
 * Design Ref: feed-integration.design.md §7 — 무한 스크롤(IntersectionObserver + 누적형 리듀서).
 * 좋아요·북마크는 낙관적 업데이트 후 실패하면 롤백한다(계획 §3.2 비기능 요구사항).
 * 비로그인 사용자는 목록을 볼 수 있지만, 좋아요·북마크·작성을 시도하면 로그인 화면으로 유도한다(FR-10).
 */
export default function FeedPage() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const { items, status, hasNext, loadMore, retry, retryMore, addItem, updateItem } = useFeedInfiniteList(10)
  const [composerOpen, setComposerOpen] = useState(false)

  function requireLogin() {
    navigate('/login')
  }

  async function handleToggleLike(post) {
    if (!member) return requireLogin()

    await runOptimisticToggle({
      key: `${post.id}:like`,
      apply: patch => updateItem(post.id, patch),
      optimisticPatch: { liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) },
      revertPatch: { liked: post.liked, likeCount: post.likeCount },
      request: () => toggleFeedLike(post.id),
      reconcile: active => ({ liked: active }),
      onError: error => console.error('좋아요 처리에 실패했습니다.', error),
    })
  }

  async function handleToggleBookmark(post) {
    if (!member) return requireLogin()

    await runOptimisticToggle({
      key: `${post.id}:bookmark`,
      apply: patch => updateItem(post.id, patch),
      optimisticPatch: { bookmarked: !post.bookmarked },
      revertPatch: { bookmarked: post.bookmarked },
      request: () => toggleFeedBookmark(post.id),
      reconcile: active => ({ bookmarked: active }),
      onError: error => console.error('북마크 처리에 실패했습니다.', error),
    })
  }

  function handleOpenComposer() {
    if (!member) return requireLogin()
    setComposerOpen(true)
  }

  function handleCreated(post) {
    addItem(post)
    setComposerOpen(false)
  }

  return (
    <div className="feed-page">
      <main className="feed-page__main">
        <header className="feed-page__header">
          <div>
            <h1>여행 피드</h1>
            <p>다른 여행자들의 생생한 여행 이야기를 둘러보세요.</p>
          </div>
          <button type="button" className="feed-page__write-button" onClick={handleOpenComposer}>
            {member ? '새 글 작성' : '로그인하고 글쓰기'}
          </button>
        </header>

        {status === 'loading' && (
          <p className="feed-page__hint" role="status">피드를 불러오는 중입니다...</p>
        )}

        {status === 'error' && (
          <section className="status-page__card feed-page__status-card" role="alert">
            <p className="status-page__eyebrow status-page__eyebrow--error">오류</p>
            <h2 className="status-page__title">피드를 불러오지 못했습니다</h2>
            <p className="status-page__description">잠시 후 다시 시도해 주세요.</p>
            <div className="status-page__actions">
              <button type="button" className="status-page__button status-page__button--primary" onClick={retry}>
                다시 시도
              </button>
            </div>
          </section>
        )}

        {(status === 'success' || status === 'loading-more' || status === 'error-more') && items.length === 0 && (
          <section className="status-page__card feed-page__status-card">
            <h2 className="status-page__title">아직 등록된 여행 이야기가 없습니다</h2>
            <p className="status-page__description">첫 번째 여행 이야기를 남겨 보세요.</p>
          </section>
        )}

        {items.length > 0 && (
          <ul className="feed-page__list" aria-busy={status === 'loading-more' || undefined}>
            {items.map(post => (
              <li key={post.id}>
                <FeedCard post={post} onToggleLike={handleToggleLike} onToggleBookmark={handleToggleBookmark} />
              </li>
            ))}
          </ul>
        )}

        {status === 'loading-more' && <p className="feed-page__hint" role="status">더 불러오는 중입니다...</p>}

        {status === 'error-more' && (
          <div className="feed-page__more-error" role="alert">
            <p>다음 게시물을 불러오지 못했습니다.</p>
            <button type="button" onClick={retryMore}>다시 시도</button>
          </div>
        )}

        {items.length > 0 && (
          <FeedTimelineSentinel onIntersect={loadMore} disabled={!hasNext || status === 'loading-more' || status === 'error-more'} />
        )}
      </main>

      <FeedComposer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={handleCreated} />
    </div>
  )
}
