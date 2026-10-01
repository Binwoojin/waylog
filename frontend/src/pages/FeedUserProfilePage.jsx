import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFeedUserProfile } from '../hooks/useFeedUserProfile'
import { toggleFeedBookmark, toggleFeedLike } from '../api/feedApi'
import { runOptimisticToggle } from '../lib/optimisticToggle'
import FeedCard from '../components/feed/FeedCard'
import DetailStatus from '../components/detail/DetailStatus'
import NotFoundPage from './NotFoundPage'
import { DETAIL_NOT_FOUND_DESCRIPTION, DETAIL_NOT_FOUND_TITLE } from '../components/detail/detailMessages'
import defaultAvatar from '../assets/figma/destination-jeju.png'
import './StatusPage.css'
import './FeedUserProfilePage.css'

const FEED_LIST_PATH = '/feed'

/**
 * 타인 피드 프로필 (`/feed/users/:userId`)
 *
 * Design Ref: feed-integration.design.md §9 — URL의 userId로 직접 조회하고, 라우터 state에는
 * 의존하지 않는다(admin-dashboard 회원/피드 화면에서 새로고침 시 깨지던 문제를 반복하지 않기 위함).
 * "@피드아이디 수정" 같은 본인 전용 UI는 두지 않는다(항상 타인 프로필 조회 전용).
 */
export default function FeedUserProfilePage() {
  const { userId } = useParams()
  // key={userId}로 재마운트해 userId가 바뀔 때 useFeedUserProfile이 항상 loading부터 시작한다(useCourseDetail 패턴).
  return <FeedUserProfileContent key={userId} userId={userId} />
}

function FeedUserProfileContent({ userId }) {
  const { member } = useAuth()
  const navigate = useNavigate()
  // 코드 리뷰 Must Fix 1: 백엔드/훅은 이미 page를 받아 페이지별 게시물을 내려주므로,
  // 여기서 현재 페이지를 상태로 들고 useFeedUserProfile에 그대로 전달한다.
  // (userId가 바뀌면 부모가 key={userId}로 이 컴포넌트 자체를 재마운트하므로 page는 자동으로 1부터 시작한다.)
  const [page, setPage] = useState(1)
  const { status, profile, retry, hasRetried } = useFeedUserProfile(userId, page)
  // 렌더 중 파생 상태: profile.posts를 직접 변경하지 않고, 토글로 바뀐 부분만 id별로 겹쳐 그린다
  // (FeedPage/FeedDetailPage와 같은 낙관적 업데이트 원칙을 이 화면에서도 그대로 따른다).
  const [overrides, setOverrides] = useState({})

  if (status === 'loading') return <DetailStatus variant="loading" />
  if (status === 'error') {
    return <DetailStatus variant="error" onRetry={retry} backTo={FEED_LIST_PATH} focusOnMount={hasRetried} />
  }
  if (status === 'not-found') {
    return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
  }
  if (status === 'login-required') {
    return (
      <main className="status-page">
        <section className="status-page__card" role="alert">
          <p className="status-page__eyebrow status-page__eyebrow--error">로그인 필요</p>
          <h1 className="status-page__title">로그인 후 확인할 수 있습니다</h1>
          <p className="status-page__description">이 프로필을 보려면 로그인이 필요합니다.</p>
          <div className="status-page__actions">
            <button type="button" className="status-page__button status-page__button--primary" onClick={() => navigate('/login')}>
              로그인
            </button>
            <Link className="status-page__button" to={FEED_LIST_PATH}>피드로 돌아가기</Link>
          </div>
        </section>
      </main>
    )
  }

  const posts = profile.posts.map(post => (overrides[post.id] ? { ...post, ...overrides[post.id] } : post))

  // 요청한 page와 마지막으로 받은 profile.currentPage가 다르면 다음 페이지 응답을 기다리는 중이다.
  // (렌더 중 파생 상태 — 훅에 별도 'loading-more' 상태를 추가하지 않고 기존 필드만으로 계산한다.)
  const isPageChanging = profile.currentPage !== page

  function requireLogin() {
    navigate('/login')
  }

  function goToPreviousPage() {
    if (isPageChanging || profile.currentPage <= 1) return
    setPage(profile.currentPage - 1)
  }

  function goToNextPage() {
    if (isPageChanging || !profile.hasNext) return
    setPage(profile.currentPage + 1)
  }

  function setOverride(id, patch) {
    setOverrides(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }))
  }

  async function handleToggleLike(post) {
    if (!member) return requireLogin()
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

  async function handleToggleBookmark(post) {
    if (!member) return requireLogin()
    await runOptimisticToggle({
      key: `${post.id}:bookmark`,
      apply: patch => setOverride(post.id, patch),
      optimisticPatch: { bookmarked: !post.bookmarked },
      revertPatch: { bookmarked: post.bookmarked },
      request: () => toggleFeedBookmark(post.id),
      reconcile: active => ({ bookmarked: active }),
      onError: error => console.error('북마크 처리에 실패했습니다.', error),
    })
  }

  return (
    <div className="feed-user-profile-page">
      <main className="feed-user-profile-page__main">
        <p className="feed-user-profile-page__breadcrumb">
          <Link to="/">홈</Link><span>›</span><Link to={FEED_LIST_PATH}>여행 피드</Link>
        </p>

        <header className="feed-user-profile-page__header">
          <img className="feed-user-profile-page__avatar" src={profile.profileImageUrl ?? defaultAvatar} alt="" />
          <div className="feed-user-profile-page__info">
            <h1>{profile.nickname}</h1>
            {profile.feedHandle && <p className="feed-user-profile-page__handle">@{profile.feedHandle}</p>}
            <dl className="feed-user-profile-page__stats">
              <div>
                <dt>게시물</dt>
                <dd>{profile.postCount}</dd>
              </div>
              <div>
                <dt>받은 좋아요</dt>
                <dd>{profile.receiveLikeCount}</dd>
              </div>
            </dl>
          </div>
        </header>

        {posts.length === 0 ? (
          <section className="status-page__card feed-user-profile-page__empty">
            <h2 className="status-page__title">등록된 여행 이야기가 없습니다</h2>
            <p className="status-page__description">아직 공개된 게시물이 없습니다.</p>
          </section>
        ) : (
          <ul className="feed-user-profile-page__list">
            {posts.map(post => (
              <li key={post.id}>
                <FeedCard post={post} onToggleLike={handleToggleLike} onToggleBookmark={handleToggleBookmark} />
              </li>
            ))}
          </ul>
        )}

        {profile.totalPages > 1 && (
          <nav className="feed-user-profile-page__pagination" aria-label="게시물 페이지 이동">
            <button type="button" onClick={goToPreviousPage} disabled={isPageChanging || profile.currentPage <= 1}>
              이전
            </button>
            <span aria-live="polite">
              {isPageChanging ? '불러오는 중...' : `${profile.currentPage} / ${profile.totalPages}`}
            </span>
            <button type="button" onClick={goToNextPage} disabled={isPageChanging || !profile.hasNext}>
              다음
            </button>
          </nav>
        )}
      </main>
    </div>
  )
}
