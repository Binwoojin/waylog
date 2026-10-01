import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMyFeedProfile } from '../hooks/useMyFeedProfile'
import { toggleFeedBookmark, toggleFeedLike } from '../api/feedApi'
import { runOptimisticToggle } from '../lib/optimisticToggle'
import ProfileSection from '../components/mypage/ProfileSection'
import AccountSettingsSection from '../components/mypage/AccountSettingsSection'
import FeedCard from '../components/feed/FeedCard'
import DetailStatus from '../components/detail/DetailStatus'
import './StatusPage.css'
import './FeedUserProfilePage.css'
import './MyPage.css'

/**
 * 마이페이지 (`/mypage`)
 *
 * Design Ref: mypage-bookmarks.design.md §5.1, §5.2, §5.3 — 프로필 섹션(조회/수정) + 내가 쓴 글
 * 목록 + 계정 설정(비밀번호 변경·탈퇴)을 한 화면에 조합한다. 레이아웃·낙관적 토글·페이지네이션은
 * FeedUserProfilePage.jsx와 같은 원칙을 재사용하되, 인증이 필수이고 PATCH를 쓴다는 점이 다르다
 * (그래서 useFeedUserProfile이 아니라 useMyFeedProfile을 쓴다, 설계 §2.2).
 */
export default function MyPage() {
  const { member } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const { status, profile, retry, isSaving, saveError, saveProfile } = useMyFeedProfile(page)
  // 렌더 중 파생 상태: profile.posts를 직접 변경하지 않고, 토글로 바뀐 부분만 id별로 겹쳐 그린다
  // (FeedUserProfilePage와 동일한 낙관적 업데이트 원칙).
  const [overrides, setOverrides] = useState({})

  if (status === 'loading') return <DetailStatus variant="loading" />
  // useMyFeedProfile은 useFeedUserProfile과 달리 hasRetried를 추적하지 않는다(재시도 포커스 이동은
  // 이 화면 범위 밖) — focusOnMount는 기본값(false)을 그대로 쓴다.
  if (status === 'error') {
    return <DetailStatus variant="error" onRetry={retry} backTo="/" />
  }
  if (status === 'login-required') {
    return (
      <main className="status-page">
        <section className="status-page__card" role="alert">
          <p className="status-page__eyebrow status-page__eyebrow--error">로그인 필요</p>
          <h1 className="status-page__title">로그인 후 이용할 수 있습니다</h1>
          <p className="status-page__description">마이페이지는 로그인한 사용자만 볼 수 있습니다.</p>
          <div className="status-page__actions">
            <button type="button" className="status-page__button status-page__button--primary" onClick={() => navigate('/login')}>
              로그인
            </button>
            <Link className="status-page__button" to="/">홈으로</Link>
          </div>
        </section>
      </main>
    )
  }

  const posts = profile.posts.map(post => (overrides[post.id] ? { ...post, ...overrides[post.id] } : post))

  // 요청한 page와 마지막으로 받은 profile.currentPage가 다르면 다음 페이지 응답을 기다리는 중이다.
  const isPageChanging = profile.currentPage !== page

  function setOverride(id, patch) {
    setOverrides(previous => ({ ...previous, [id]: { ...previous[id], ...patch } }))
  }

  function goToPreviousPage() {
    if (isPageChanging || profile.currentPage <= 1) return
    setPage(profile.currentPage - 1)
  }

  function goToNextPage() {
    if (isPageChanging || !profile.hasNext) return
    setPage(profile.currentPage + 1)
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

  async function handleToggleBookmark(post) {
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
    <div className="my-page">
      <main className="my-page__main">
        <ProfileSection profile={profile} isSaving={isSaving} saveError={saveError} onSave={saveProfile} />

        <section className="my-page__section" aria-label="내가 쓴 글">
          <h2 className="my-page__section-title">내가 쓴 글</h2>

          {posts.length === 0 ? (
            <p className="my-page__empty">아직 작성한 게시물이 없습니다.</p>
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
        </section>

        <div className="my-page__section">
          <AccountSettingsSection email={member?.email ?? ''} />
        </div>
      </main>
    </div>
  )
}
