import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAdminFeedDetail } from '../../hooks/useAdminFeedDetail'
import { deleteAdminFeedPost } from '../../api/adminFeedApi'
import FeedDeleteDialog from '../../components/admin/FeedDeleteDialog'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AdminToast from '../../components/admin/AdminToast'
import './AdminFeedDetailPage.css'

function formatDateTime(value) {
  if (!value) return ''
  return String(value).slice(0, 16).replace('T', ' ')
}

/**
 * 관리자 피드 상세 화면
 *
 * Design Ref: admin-dashboard.design.md §5.4, 계획 FR-F03, FR-F04, FR-F05
 *
 * GET /api/v1/admin/feed/posts/{id}로 URL의 id를 직접 조회한다(useAdminFeedDetail). 라우터 state에
 * 의존하지 않으므로 새로고침·URL 직접 진입에도 동일하게 동작한다(회원 상세와 같은 원칙).
 */
export default function AdminFeedDetailPage() {
  const { id } = useParams()
  const { status, post, retry, hasRetried } = useAdminFeedDetail(id)

  if (status === 'loading') {
    return <p className="admin-feed-detail__status">불러오는 중입니다...</p>
  }

  if (status === 'not-found') {
    return (
      <div className="admin-feed-detail__status">
        <p>게시물을 찾을 수 없습니다.</p>
        <Link className="admin-button admin-button--primary" to="/admin/feed">목록으로</Link>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="admin-feed-detail__status" role="alert">
        <p>게시물을 불러오지 못했습니다.</p>
        <button type="button" className="admin-button admin-button--primary" onClick={retry}>
          {hasRetried ? '다시 시도 중...' : '다시 시도'}
        </button>
      </div>
    )
  }

  // id가 바뀌면(다른 게시물 상세로 이동) 삭제 폼 상태를 완전히 새로 시작하도록 재마운트합니다.
  return <AdminFeedDetail key={post.id} post={post} onChanged={retry} />
}

function AdminFeedDetail({ post, onChanged }) {
  const navigate = useNavigate()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [pendingPolicyPayload, setPendingPolicyPayload] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState(null)

  function closeDeleteDialog() {
    setIsDeleteOpen(false)
    setPendingPolicyPayload(null)
  }

  async function submitDelete(payload) {
    setIsDeleting(true)
    try {
      await deleteAdminFeedPost(post.id, payload)

      if (payload.type === 'POLICY_VIOLATION') {
        /*
         * 정책위반(하드) 삭제는 게시물 자체가 사라진다. onChanged()(재조회)를 부르면
         * 이 컴포넌트가 곧바로 not-found 화면으로 대체되어, 방금 띄운 성공 토스트가
         * 사용자에게 보일 틈도 없이 사라진다. 대신 목록으로 돌아가 그곳에서 토스트를 보여준다
         * (AdminNoticeFormPage가 저장 후 목록으로 이동하며 토스트를 넘기는 것과 같은 패턴).
         */
        navigate('/admin/feed', { state: { toast: '게시물을 정책위반으로 삭제했습니다.' } })
        return
      }

      // 소프트 삭제는 게시물이 그대로 남아 있으므로, 이 화면에서 재조회해 상태만 갱신한다.
      setToast('게시물을 삭제했습니다.')
      closeDeleteDialog()
      onChanged()
    } catch (error) {
      console.error('게시물을 삭제하지 못했습니다.', error)
      window.alert(error?.body?.message || '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="admin-feed-detail">
      <button type="button" className="admin-button" onClick={() => navigate('/admin/feed')}>← 목록으로</button>

      <section className="admin-feed-detail__summary">
        <h1>{post.authorNickname}의 게시물</h1>
        <p className="admin-feed-detail__meta">
          작성일 {formatDateTime(post.createdAt)} · 좋아요 {post.likeCount} · 댓글 {post.commentCount}
        </p>
        {post.status === 'SOFT_DELETED' && (
          <p className="admin-status-badge admin-status-badge--alert">
            삭제됨 · {post.deleteReason || '(사유 없음)'}
          </p>
        )}
      </section>

      <section className="admin-feed-detail__card">
        <h2>내용</h2>
        <p className="admin-feed-detail__content">{post.content}</p>

        {(post.locationName || post.address) && (
          <p className="admin-feed-detail__location">
            {post.locationName}
            {post.locationName && post.address ? ' · ' : ''}
            {post.address}
          </p>
        )}

        {/*
          Design Ref: tour-course-feed-linking.design.md §7.2(D-6) — 읽기 전용 한 줄만
          추가한다. 관리자 코스 상세 화면 자체가 없으므로(Q-3 확정) 별도 링크는 만들지 않는다.
        */}
        {post.courseTag && (
          <p className="admin-feed-detail__course">
            참조한 여행코스: {post.courseTag.courseTitle}
            {post.courseTag.dayNumber != null ? ` · ${post.courseTag.dayNumber}일차` : ''}
            {post.courseTag.stopName ? ` · ${post.courseTag.stopName}` : ''}
          </p>
        )}

        {post.tags.length > 0 && (
          <ul className="admin-feed-detail__tags">
            {post.tags.map(tag => <li key={tag}>#{tag}</li>)}
          </ul>
        )}
      </section>

      {post.images.length > 0 && (
        <section className="admin-feed-detail__card">
          <h2>이미지 ({post.images.length})</h2>
          <div className="admin-feed-detail__images">
            {post.images.map((url, index) => (
              <img key={url} src={url} alt={`게시물 이미지 ${index + 1}`} />
            ))}
          </div>
        </section>
      )}

      <button type="button" className="admin-button admin-button--danger" onClick={() => setIsDeleteOpen(true)}>
        삭제
      </button>

      <FeedDeleteDialog
        open={isDeleteOpen && !pendingPolicyPayload}
        pending={isDeleting}
        onCancel={closeDeleteDialog}
        onSubmitNormal={submitDelete}
        onRequestPolicyViolationConfirm={setPendingPolicyPayload}
      />

      <ConfirmDialog
        open={Boolean(pendingPolicyPayload)}
        title="정책위반으로 삭제할까요?"
        description={(
          <>
            게시물과 이미지가 <strong>즉시 완전히 삭제되며 되돌릴 수 없습니다.</strong>
            {pendingPolicyPayload?.suspendAuthor
              ? ` 작성자는 ${pendingPolicyPayload.suspensionDays}일간 로그인이 차단됩니다.`
              : ''}
          </>
        )}
        confirmLabel="삭제 확정"
        pending={isDeleting}
        onConfirm={() => submitDelete(pendingPolicyPayload)}
        onCancel={() => setPendingPolicyPayload(null)}
      />

      <AdminToast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
