import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AdminTable from '../../components/admin/AdminTable'
import AdminPagination from '../../components/admin/AdminPagination'
import FeedDeleteDialog from '../../components/admin/FeedDeleteDialog'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AdminToast from '../../components/admin/AdminToast'
import { useAdminFeedList } from '../../hooks/useAdminFeedList'
import { deleteAdminFeedPost } from '../../api/adminFeedApi'
import './AdminFeedListPage.css'

function formatDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function FeedStatusBadge({ post }) {
  // Design Ref: admin-dashboard.design.md §3.4.4 — status는 서버(FeedPost.isDeleted())가 계산해 내려준다.
  if (post.status !== 'SOFT_DELETED') {
    return <span className="admin-status-badge admin-status-badge--normal">정상</span>
  }
  return (
    <span className="admin-status-badge admin-status-badge--alert">
      삭제됨 · {post.deleteReason || '(사유 없음)'}
    </span>
  )
}

const COLUMNS = [
  { key: 'authorNickname', header: '작성자', width: '120px' },
  { key: 'contentPreview', header: '내용', render: post => (
    <Link to={`/admin/feed/${post.id}`}>{post.contentPreview || '(내용 없음)'}</Link>
  ) },
  { key: 'imageCount', header: '이미지', width: '70px' },
  { key: 'engagement', header: '좋아요·댓글', width: '110px', render: post => `${post.likeCount} · ${post.commentCount}` },
  { key: 'createdAt', header: '작성일', width: '110px', render: post => formatDate(post.createdAt) },
  { key: 'status', header: '상태', width: '220px', render: post => <FeedStatusBadge post={post} /> },
  { key: 'actions', header: '', width: '90px' },
]

/**
 * 관리자 피드 목록 화면
 *
 * Design Ref: admin-dashboard.design.md §5.4, 계획 FR-F01, FR-F03, FR-F05
 *
 * 백엔드 목록 API에는 검색 파라미터가 없어 AdminSearchBar는 쓰지 않는다(useAdminFeedList.js).
 */
export default function AdminFeedListPage() {
  const { page, data, status, retry, setPage } = useAdminFeedList()
  const location = useLocation()
  const navigate = useNavigate()

  const [deleteTarget, setDeleteTarget] = useState(null) // { id, authorNickname } | null
  const [pendingPolicyPayload, setPendingPolicyPayload] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Design Ref: AdminFeedDetailPage.jsx — 정책위반(하드) 삭제 후 상세에서 이 목록으로 돌아올 때
  // 넘겨주는 성공 토스트를 받는다(AdminNoticeFormPage가 저장 후 목록에 토스트를 넘기는 것과 같은 패턴).
  const [toast, setToast] = useState(location.state?.toast ?? null)

  function clearToastState() {
    if (location.state?.toast) {
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }

  function closeDeleteDialog() {
    setDeleteTarget(null)
    setPendingPolicyPayload(null)
  }

  async function submitDelete(payload) {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteAdminFeedPost(deleteTarget.id, payload)
      setToast(payload.type === 'POLICY_VIOLATION' ? '게시물을 정책위반으로 삭제했습니다.' : '게시물을 삭제했습니다.')
      closeDeleteDialog()
      retry()
    } catch (error) {
      console.error('게시물을 삭제하지 못했습니다.', error)
      window.alert(error?.body?.message || '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  const rows = (data?.items ?? []).map(post => ({
    ...post,
    actions: (
      <button type="button" className="admin-button admin-button--danger" onClick={() => setDeleteTarget(post)}>
        삭제
      </button>
    ),
  }))

  return (
    <div className="admin-feed-list">
      <div className="admin-feed-list__header">
        <h1>피드 관리</h1>
      </div>

      <AdminTable
        columns={COLUMNS}
        rows={rows}
        rowKey={row => row.id}
        status={status}
        onRetry={retry}
        emptyMessage="등록된 게시물이 없습니다."
      />

      <AdminPagination page={page} totalPages={data?.totalPages ?? 0} onPageChange={setPage} />

      <FeedDeleteDialog
        key={deleteTarget?.id ?? 'none'}
        open={Boolean(deleteTarget) && !pendingPolicyPayload}
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

      <AdminToast
        message={toast}
        onDismiss={() => {
          setToast(null)
          clearToastState()
        }}
      />
    </div>
  )
}
