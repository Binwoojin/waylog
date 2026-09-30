import { Link } from 'react-router-dom'
import AdminSearchBar from '../../components/admin/AdminSearchBar'
import AdminTable from '../../components/admin/AdminTable'
import AdminPagination from '../../components/admin/AdminPagination'
import { useAdminUserList } from '../../hooks/useAdminUserList'
import './AdminUserListPage.css'

function formatDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return ''
  return String(value).slice(0, 16).replace('T', ' ')
}

function SuspensionBadge({ user }) {
  // Design Ref: admin-dashboard.design.md §3.2.1 — suspended는 서버(UserEntity.isSuspended())가
  // 계산해 내려준다. 프론트가 suspendedUntil을 다시 비교하지 않고 이 값을 그대로 표시 기준으로 쓴다.
  if (!user.suspended) {
    return <span className="admin-status-badge admin-status-badge--normal">정상</span>
  }
  return (
    <span className="admin-status-badge admin-status-badge--alert">
      정지 중 (해제: {formatDateTime(user.suspendedUntil)})
    </span>
  )
}

const COLUMNS = [
  { key: 'nickname', header: '닉네임', width: '160px' },
  { key: 'email', header: '이메일' },
  { key: 'grade', header: '등급', width: '100px' },
  { key: 'status', header: '상태', width: '220px', render: user => <SuspensionBadge user={user} /> },
  { key: 'createdAt', header: '가입일', width: '120px', render: user => formatDate(user.createdAt) },
  { key: 'actions', header: '', width: '90px' },
]

/**
 * 관리자 회원 목록 화면
 *
 * Design Ref: admin-dashboard.design.md §5.2, 계획 FR-U02, FR-U05
 *
 * 상세 화면은 자체적으로 GET /api/v1/admin/users/{id}를 조회하므로(useAdminUserDetail),
 * 이 목록은 id만 링크로 넘기면 된다.
 */
export default function AdminUserListPage() {
  const { keyword, page, data, status, retry, setKeyword, setPage } = useAdminUserList()

  const rows = (data?.items ?? []).map(user => ({
    ...user,
    actions: (
      <Link className="admin-button" to={`/admin/users/${user.id}`}>관리</Link>
    ),
  }))

  return (
    <div className="admin-user-list">
      <div className="admin-user-list__header">
        <h1>회원 관리</h1>
      </div>

      <AdminSearchBar key={keyword} value={keyword} onSearch={setKeyword} placeholder="닉네임·이메일로 검색" />

      <AdminTable
        columns={COLUMNS}
        rows={rows}
        rowKey={row => row.id}
        status={status}
        onRetry={retry}
        emptyMessage={keyword ? '검색 결과가 없습니다.' : '등록된 회원이 없습니다.'}
      />

      <AdminPagination page={page} totalPages={data?.totalPages ?? 0} onPageChange={setPage} />
    </div>
  )
}
