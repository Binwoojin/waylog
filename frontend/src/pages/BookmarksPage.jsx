import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useFeedBookmarks } from '../hooks/useFeedBookmarks'
import { useTourBookmarks } from '../hooks/useTourBookmarks'
import { toggleFeedLike } from '../api/feedApi'
import { runOptimisticToggle } from '../lib/optimisticToggle'
import FeedCard from '../components/feed/FeedCard'
import BookmarkIcon from '../components/icons/BookmarkIcon'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import DetailStatus from '../components/detail/DetailStatus'
import defaultTourImage from '../assets/figma/destination-jeju.png'
import './StatusPage.css'
import './BookmarksPage.css'

const TABS = [
  { key: 'feed', label: '피드' },
  { key: 'destination', label: '여행지' },
  { key: 'enjoy', label: '즐길거리' },
]

function isValidTab(value) {
  return TABS.some(tab => tab.key === value)
}

/**
 * 북마크 (`/bookmarks`)
 *
 * Design Ref: mypage-bookmarks.design.md §6 — 피드/여행지/즐길거리 3탭 통합 화면. 탭 전환은
 * URL 쿼리 파라미터(`?tab=`)가 유일한 원천이다(새로고침·공유 링크로도 같은 탭이 열린다. URL
 * 기반 직접 조회 원칙 — 라우터 state 의존 금지).
 *
 * 탭마다 완전히 독립된 하위 컴포넌트(FeedBookmarkTab/TourBookmarkTab)로 마운트되며 상태를
 * 공유하지 않는다(설계 §2.2, Plan §7.2) — key로 탭이 바뀔 때마다 새로 마운트해 이전 탭의
 * 로딩/에러 상태가 남지 않게 한다.
 */
export default function BookmarksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = isValidTab(rawTab) ? rawTab : 'feed'

  // 없는 값·오타 쿼리는 기본 탭으로 정규화한다(잘못된 URL이 히스토리에 남지 않도록 replace).
  useEffect(() => {
    if (rawTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true })
    }
  }, [rawTab, activeTab, setSearchParams])

  function selectTab(tabKey) {
    if (tabKey === activeTab) return
    setSearchParams({ tab: tabKey })
  }

  return (
    <div className="bookmarks-page">
      <main className="bookmarks-page__main">
        <h1 className="bookmarks-page__title">북마크</h1>

        <div role="tablist" aria-label="북마크 탭" className="bookmarks-page__tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`bookmarks-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`bookmarks-panel-${tab.key}`}
              className={activeTab === tab.key ? 'is-active' : ''}
              onClick={() => selectTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`bookmarks-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`bookmarks-tab-${activeTab}`}
          className="bookmarks-page__panel"
        >
          {activeTab === 'feed' && <FeedBookmarkTab key="feed" />}
          {activeTab === 'destination' && (
            <TourBookmarkTab key="destination" group="DESTINATION" emptyLabel="여행지" browseTo="/destinations" />
          )}
          {activeTab === 'enjoy' && (
            <TourBookmarkTab key="enjoy" group="ENJOY" emptyLabel="즐길거리" browseTo="/enjoy" />
          )}
        </div>
      </main>
    </div>
  )
}

function LoginRequiredCard() {
  const navigate = useNavigate()
  return (
    <section className="status-page__card" role="alert">
      <p className="status-page__eyebrow status-page__eyebrow--error">로그인 필요</p>
      <h1 className="status-page__title">로그인 후 확인할 수 있습니다</h1>
      <p className="status-page__description">북마크는 로그인한 사용자만 볼 수 있습니다.</p>
      <div className="status-page__actions">
        <button type="button" className="status-page__button status-page__button--primary" onClick={() => navigate('/login')}>
          로그인
        </button>
        <Link className="status-page__button" to="/">홈으로</Link>
      </div>
    </section>
  )
}

function EmptyBookmarks({ message, browseTo, browseLabel }) {
  return (
    <section className="status-page__card bookmarks-page__empty">
      <h2 className="status-page__title">{message}</h2>
      <div className="status-page__actions">
        <Link className="status-page__button status-page__button--primary" to={browseTo}>{browseLabel}</Link>
      </div>
    </section>
  )
}

/**
 * 피드 북마크 탭 — useFeedBookmarks + FeedCard 재사용.
 *
 * Design Ref: §6.2(Q-8) — 해제는 즉시 목록에서 제거(Undo 없음), 좋아요는 FeedUserProfilePage와
 * 같은 overrides 패턴으로 낙관적 업데이트한다(이 목록 자체는 항상 bookmarked=true이므로
 * onToggleBookmark은 "해제"로만 동작한다).
 */
function FeedBookmarkTab() {
  const [page, setPage] = useState(1)
  const { status, items, currentPage, totalPages, hasNext, retry, removeBookmark } = useFeedBookmarks(page)
  const [overrides, setOverrides] = useState({})

  if (status === 'loading') return <DetailStatus variant="loading" />
  if (status === 'error') return <DetailStatus variant="error" onRetry={retry} backTo="/bookmarks" />
  if (status === 'login-required') return <LoginRequiredCard />

  const posts = items.map(post => (overrides[post.id] ? { ...post, ...overrides[post.id] } : post))
  const isPageChanging = currentPage !== page

  function setOverride(id, patch) {
    setOverrides(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }))
  }

  async function handleToggleLike(post) {
    await runOptimisticToggle({
      key: `${post.id}:like`,
      apply: patch => setOverride(post.id, patch),
      optimisticPatch: { liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) },
      revertPatch: { liked: post.liked, likeCount: post.likeCount },
      request: () => toggleFeedLike(post.id),
      reconcile: active => ({ liked: active }),
      onError: error => console.error('좋아요 처리에 실패했습니다.', error),
    })
  }

  if (posts.length === 0) {
    return <EmptyBookmarks message="아직 북마크한 피드 게시물이 없습니다." browseTo="/feed" browseLabel="피드 둘러보기" />
  }

  return (
    <>
      <ul className="bookmarks-page__feed-list">
        {posts.map(post => (
          <li key={post.id}>
            <FeedCard post={post} onToggleLike={handleToggleLike} onToggleBookmark={removedPost => removeBookmark(removedPost.id)} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="bookmarks-page__pagination" aria-label="피드 북마크 페이지 이동">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={isPageChanging || currentPage <= 1}>
            이전
          </button>
          <span aria-live="polite">{isPageChanging ? '불러오는 중...' : `${currentPage} / ${totalPages}`}</span>
          <button type="button" onClick={() => setPage(p => p + 1)} disabled={isPageChanging || !hasNext}>
            다음
          </button>
        </nav>
      )}
    </>
  )
}

/**
 * 여행지/즐길거리 북마크 탭 — useTourBookmarks 공용, group으로만 구분.
 */
function TourBookmarkTab({ group, emptyLabel, browseTo }) {
  const [page, setPage] = useState(1)
  const { status, items, currentPage, totalPages, hasNext, retry, removeBookmark } = useTourBookmarks(group, page)

  if (status === 'loading') return <DetailStatus variant="loading" />
  if (status === 'error') return <DetailStatus variant="error" onRetry={retry} backTo="/bookmarks" />
  if (status === 'login-required') return <LoginRequiredCard />

  const isPageChanging = currentPage !== page

  if (items.length === 0) {
    return <EmptyBookmarks message={`아직 ${emptyLabel} 북마크가 없습니다.`} browseTo={browseTo} browseLabel={`${emptyLabel} 둘러보기`} />
  }

  return (
    <>
      <ul className="bookmarks-page__tour-grid">
        {items.map(item => (
          <li key={item.bookmarkId}>
            <TourBookmarkCard item={item} onRemove={() => removeBookmark(item)} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="bookmarks-page__pagination" aria-label={`${emptyLabel} 북마크 페이지 이동`}>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={isPageChanging || currentPage <= 1}>
            이전
          </button>
          <span aria-live="polite">{isPageChanging ? '불러오는 중...' : `${currentPage} / ${totalPages}`}</span>
          <button type="button" onClick={() => setPage(p => p + 1)} disabled={isPageChanging || !hasNext}>
            다음
          </button>
        </nav>
      )}
    </>
  )
}

function TourBookmarkCard({ item, onRemove }) {
  const body = (
    <>
      <img className="bookmarks-page__tour-image" src={item.imageUrl ?? defaultTourImage} alt="" loading="lazy" />
      <div className="bookmarks-page__tour-info">
        {item.categoryName && <span className="bookmarks-page__tour-tag">{item.categoryName}</span>}
        <h3>{item.title}</h3>
        {item.address && (
          <p className="bookmarks-page__tour-address">
            <PlacePinIcon size={14} />
            <span>{item.address}</span>
          </p>
        )}
      </div>
    </>
  )

  return (
    <article className="bookmarks-page__tour-card">
      {/* Design Ref: §3.5 — contentTypeId를 WayLog 라우트로 바꿀 수 없으면 detailPath가 null이다.
          그 경우 상세로 이동하는 링크 없이 카드 정보만 보여 준다(존재하지 않는 경로로 보내지 않음). */}
      {item.detailPath ? (
        <Link to={item.detailPath} className="bookmarks-page__tour-link">{body}</Link>
      ) : (
        <div className="bookmarks-page__tour-link bookmarks-page__tour-link--static">{body}</div>
      )}
      <button
        type="button"
        className="bookmarks-page__tour-remove"
        aria-label={`${item.title} 북마크 해제`}
        onClick={onRemove}
      >
        <BookmarkIcon size={18} filled />
      </button>
    </article>
  )
}
