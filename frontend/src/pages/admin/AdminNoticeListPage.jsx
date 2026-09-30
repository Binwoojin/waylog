import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AdminSearchBar from '../../components/admin/AdminSearchBar'
import AdminTable from '../../components/admin/AdminTable'
import AdminPagination from '../../components/admin/AdminPagination'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AdminToast from '../../components/admin/AdminToast'
import { useAdminNoticeList } from '../../hooks/useAdminNoticeList'
import { deleteAdminNotice } from '../../api/adminNoticeApi'
import './AdminNoticeListPage.css'

const COLUMNS = [
  { key: 'title', header: '제목', render: notice => (
    <Link to={`/admin/notices/${notice.id}/edit`}>{notice.title}</Link>
  ) },
  { key: 'author', header: '작성자', width: '140px' },
  { key: 'viewCount', header: '조회수', width: '90px' },
  { key: 'createdAt', header: '작성일', width: '140px', render: notice => formatDate(notice.createdAt) },
  { key: 'actions', header: '', width: '160px' },
]

function formatDate(value) {
  if (!value) return ''
  // Design Ref: admin-dashboard.design.md — 관리자 화면은 서버가 준 ISO 문자열의 날짜 부분만 보여줍니다.
  return String(value).slice(0, 10)
}

/**
 * 관리자 공지사항 목록 화면
 *
 * Design Ref: admin-dashboard.design.md §5.1, 계획 FR-N01, FR-N04
 */
export default function AdminNoticeListPage() {
  const { keyword, page, data, status, retry, setKeyword, setPage } = useAdminNoticeList()
  const navigate = useNavigate()
  const location = useLocation()

  const [toast, setToast] = useState(location.state?.toast ?? null)
  const [pendingDelete, setPendingDelete] = useState(null) // { id, title } | null
  const [isDeleting, setIsDeleting] = useState(false)

  // 토스트를 한 번만 보여주고, 뒤로 가기로 같은 화면에 돌아와도 다시 뜨지 않게 location.state를 비웁니다.
  function clearToastState() {
    if (location.state?.toast) {
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }

  const rows = (data?.items ?? []).map(notice => ({
    ...notice,
    actions: (
      <div className="admin-notice-list__row-actions">
        <Link className="admin-button" to={`/admin/notices/${notice.id}/edit`}>수정</Link>
        <button
          type="button"
          className="admin-button admin-button--danger"
          onClick={() => setPendingDelete({ id: notice.id, title: notice.title })}
        >
          삭제
        </button>
      </div>
    ),
  }))

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteAdminNotice(pendingDelete.id)
      setPendingDelete(null)
      setToast('공지사항을 삭제했습니다.')
      retry()
    } catch (error) {
      console.error('공지사항을 삭제하지 못했습니다.', error)
      window.alert('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="admin-notice-list">
      <div className="admin-notice-list__header">
        <h1>공지사항 관리</h1>
        <Link className="admin-button admin-button--primary" to="/admin/notices/new">새 공지 작성</Link>
      </div>

      {/* Design Ref: AdminSearchBar 주석 — keyword가 외부 요인(뒤로 가기 등)으로 바뀌면 key로 재마운트해 입력창을 맞춥니다. */}
      <AdminSearchBar key={keyword} value={keyword} onSearch={setKeyword} placeholder="제목·작성자로 검색" />

      <AdminTable
        columns={COLUMNS}
        rows={rows}
        rowKey={row => row.id}
        status={status}
        onRetry={retry}
        emptyMessage={keyword ? '검색 결과가 없습니다.' : '등록된 공지사항이 없습니다.'}
      />

      <AdminPagination page={page} totalPages={data?.totalPages ?? 0} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="공지사항을 삭제할까요?"
        description={pendingDelete ? `"${pendingDelete.title}"을(를) 삭제하면 되돌릴 수 없습니다.` : undefined}
        confirmLabel="삭제"
        pending={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
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
