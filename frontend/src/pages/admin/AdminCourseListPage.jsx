import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AdminSearchBar from '../../components/admin/AdminSearchBar'
import AdminTable from '../../components/admin/AdminTable'
import AdminPagination from '../../components/admin/AdminPagination'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AdminToast from '../../components/admin/AdminToast'
import { useAdminCourseList } from '../../hooks/useAdminCourseList'
import { deleteAdminCourse } from '../../api/adminCourseApi'
import './AdminCourseListPage.css'

function formatDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const COLUMNS = [
  { key: 'coverImageUrl', header: '', width: '64px', render: course => (
    course.coverImageUrl
      ? <img className="admin-course-list__thumbnail" src={course.coverImageUrl} alt="" />
      : <span className="admin-course-list__thumbnail admin-course-list__thumbnail--empty" aria-hidden="true" />
  ) },
  { key: 'title', header: '코스명', render: course => (
    <Link to={`/admin/courses/${course.id}/edit`}>{course.title}</Link>
  ) },
  { key: 'theme', header: '테마', width: '160px', render: course => course.theme || '-' },
  { key: 'createdAt', header: '등록일', width: '120px', render: course => formatDate(course.createdAt) },
  { key: 'actions', header: '', width: '90px' },
]

/**
 * 관리자 여행코스 목록 화면
 *
 * Design Ref: admin-dashboard.design.md §5.3, 계획 FR-C04
 *
 * 목록 API에는 일자 수·경유지 수가 없다(adminCourseApi.js 주석 참고). 상세로 들어가야 구조를 볼 수 있다.
 */
export default function AdminCourseListPage() {
  const { keyword, page, data, status, retry, setKeyword, setPage } = useAdminCourseList()
  const location = useLocation()
  const navigate = useNavigate()

  const [deleteTarget, setDeleteTarget] = useState(null) // { id, title } | null
  const [isDeleting, setIsDeleting] = useState(false)
  // Design Ref: AdminCourseFormPage.jsx — 생성/수정 저장 후 이 목록으로 돌아올 때 넘겨주는 토스트
  // (AdminNoticeFormPage와 같은 패턴).
  const [toast, setToast] = useState(location.state?.toast ?? null)

  function clearToastState() {
    if (location.state?.toast) {
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }

  const rows = (data?.items ?? []).map(course => ({
    ...course,
    actions: (
      <button
        type="button"
        className="admin-button admin-button--danger"
        onClick={() => setDeleteTarget({ id: course.id, title: course.title })}
      >
        삭제
      </button>
    ),
  }))

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteAdminCourse(deleteTarget.id)
      setDeleteTarget(null)
      setToast('여행코스를 삭제했습니다.')
      retry()
    } catch (error) {
      console.error('여행코스를 삭제하지 못했습니다.', error)
      window.alert(error?.body?.message || '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="admin-course-list">
      <div className="admin-course-list__header">
        <h1>여행코스 관리</h1>
        <Link className="admin-button admin-button--primary" to="/admin/courses/new">새 코스 작성</Link>
      </div>

      <AdminSearchBar key={keyword} value={keyword} onSearch={setKeyword} placeholder="코스명·테마로 검색" />

      <AdminTable
        columns={COLUMNS}
        rows={rows}
        rowKey={row => row.id}
        status={status}
        onRetry={retry}
        emptyMessage={keyword ? '검색 결과가 없습니다.' : '등록된 여행코스가 없습니다.'}
      />

      <AdminPagination page={page} totalPages={data?.totalPages ?? 0} onPageChange={setPage} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="여행코스를 삭제할까요?"
        description={deleteTarget ? `"${deleteTarget.title}"과(와) 모든 일자·경유지·이미지가 삭제되며 되돌릴 수 없습니다.` : undefined}
        confirmLabel="삭제"
        pending={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
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
