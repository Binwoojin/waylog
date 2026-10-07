import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/client'
import { liftAdminUserSuspension, suspendAdminUser, updateAdminUserGrade } from '../../api/adminUserApi'
import { useAdminUserDetail } from '../../hooks/useAdminUserDetail'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import AdminToast from '../../components/admin/AdminToast'
import './AdminUserDetailPage.css'

const GRADE_OPTIONS = [
  { value: 'user', label: '일반 회원' },
  { value: 'ADMIN', label: '관리자' },
]

const SUSPENSION_PRESETS = [3, 7, 30]

function formatDateTime(value) {
  if (!value) return ''
  return String(value).slice(0, 16).replace('T', ' ')
}

/**
 * 등급·정지 API의 403을 사람이 읽을 문구로 바꾼다.
 *
 * Design Ref: adminUserApi.js — 이 엔드포인트의 403은 SecurityConfig의 고정 메시지
 * ("접근 권한이 없습니다.")로 오지만, /admin/** 인가를 이미 통과한 관리자만 호출할 수 있으므로
 * 실질적으로 자기 자신을 대상으로 했을 때만 발생한다(UserAdminService.ensureNotSelf).
 */
function toErrorMessage(error) {
  if (error instanceof ApiError && error.status === 403) {
    return '본인 계정은 대상으로 지정할 수 없습니다.'
  }
  return error?.body?.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

/**
 * 관리자 회원 상세 화면
 *
 * Design Ref: admin-dashboard.design.md §5.2, 계획 FR-U03, FR-U04, FR-U05, FR-U06
 *
 * GET /api/v1/admin/users/{id}로 URL의 id를 직접 조회한다(useAdminUserDetail). 라우터 state에
 * 의존하지 않으므로 새로고침·URL 직접 진입에도 동일하게 동작한다.
 */
export default function AdminUserDetailPage() {
  const { id } = useParams()
  const { status, user, retry, hasRetried } = useAdminUserDetail(id)

  if (status === 'loading') {
    return <p className="admin-user-detail__empty">불러오는 중입니다...</p>
  }

  if (status === 'not-found') {
    return (
      <div className="admin-user-detail__empty">
        <p>회원을 찾을 수 없습니다.</p>
        <Link className="admin-button admin-button--primary" to="/admin/users">목록으로</Link>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="admin-user-detail__empty" role="alert">
        <p>회원 정보를 불러오지 못했습니다.</p>
        <button type="button" className="admin-button admin-button--primary" onClick={retry}>
          {hasRetried ? '다시 시도 중...' : '다시 시도'}
        </button>
      </div>
    )
  }

  // id가 바뀌면(다른 회원 상세로 이동) 폼 상태를 완전히 새로 시작하도록 재마운트합니다.
  return <AdminUserDetail key={user.id} initialUser={user} />
}

function AdminUserDetail({ initialUser }) {
  const { member } = useAuth()
  const navigate = useNavigate()

  const [user, setUser] = useState(initialUser)
  const [toast, setToast] = useState(null)

  const [grade, setGrade] = useState(initialUser.grade)
  const [isSavingGrade, setIsSavingGrade] = useState(false)
  const [gradeError, setGradeError] = useState(null)

  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('')
  const [isSuspending, setIsSuspending] = useState(false)
  const [suspendError, setSuspendError] = useState(null)

  const [isLifting, setIsLifting] = useState(false)
  const [liftError, setLiftError] = useState(null)
  const [confirmLift, setConfirmLift] = useState(false)
  const [confirmSuspend, setConfirmSuspend] = useState(false)

  // Design Ref: 계획 FR-U06 — 자기 자신의 등급·정지 컨트롤은 화면에서부터 막는다(백엔드도 403으로 한 번 더 막음).
  const isSelf = Boolean(member) && String(member.memberId) === String(user.id)

  async function handleGradeSubmit(event) {
    event.preventDefault()
    setGradeError(null)
    setIsSavingGrade(true)
    try {
      const updated = await updateAdminUserGrade(user.id, grade)
      setUser(updated)
      setToast('등급을 변경했습니다.')
    } catch (error) {
      console.error('등급을 변경하지 못했습니다.', error)
      setGradeError(toErrorMessage(error))
    } finally {
      setIsSavingGrade(false)
    }
  }

  /*
   * Must Fix(코드 리뷰) — 정지 적용은 즉시 로그인을 차단하는 동작이라 정지 해제와 마찬가지로
   * ConfirmDialog를 거쳐야 한다(설계 §2.2 FR-D04, §5.1). 이 핸들러는 검증만 하고 실제 API 호출은
   * handleSuspendConfirm이 한다.
   */
  function handleSuspendSubmit(event) {
    event.preventDefault()

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setSuspendError('정지 사유를 입력해 주세요.')
      return
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setSuspendError('정지 기간은 1일에서 365일 사이로 입력해 주세요.')
      return
    }

    setSuspendError(null)
    setConfirmSuspend(true)
  }

  async function handleSuspendConfirm() {
    const trimmedReason = reason.trim()
    setSuspendError(null)
    setIsSuspending(true)
    try {
      const updated = await suspendAdminUser(user.id, { days, reason: trimmedReason })
      setUser(updated)
      setReason('')
      setConfirmSuspend(false)
      setToast('활동 정지를 적용했습니다.')
    } catch (error) {
      console.error('활동 정지를 적용하지 못했습니다.', error)
      setSuspendError(toErrorMessage(error))
      setConfirmSuspend(false)
    } finally {
      setIsSuspending(false)
    }
  }

  async function handleLiftConfirm() {
    setLiftError(null)
    setIsLifting(true)
    try {
      const updated = await liftAdminUserSuspension(user.id)
      setUser(updated)
      setConfirmLift(false)
      setToast('활동 정지를 해제했습니다.')
    } catch (error) {
      console.error('활동 정지를 해제하지 못했습니다.', error)
      setLiftError(toErrorMessage(error))
      setConfirmLift(false)
    } finally {
      setIsLifting(false)
    }
  }

  return (
    <div className="admin-user-detail">
      <button type="button" className="admin-button" onClick={() => navigate('/admin/users')}>← 목록으로</button>

      <section className="admin-user-detail__summary">
        <h1>{user.nickname}</h1>
        <p>{user.email}</p>
        <p className="admin-user-detail__meta">가입일 {formatDateTime(user.createdAt)}</p>
      </section>

      {isSelf && (
        <p className="admin-user-detail__self-notice" role="status">
          본인 계정은 여기서 변경할 수 없습니다.
        </p>
      )}

      <section className="admin-user-detail__card">
        <h2>등급</h2>
        <form onSubmit={handleGradeSubmit} className="admin-user-detail__inline-form">
          <select value={grade} onChange={event => setGrade(event.target.value)} disabled={isSelf}>
            {GRADE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="admin-button admin-button--primary"
            disabled={isSelf || isSavingGrade || grade === user.grade}
          >
            {isSavingGrade ? '저장 중...' : '등급 저장'}
          </button>
        </form>
        {gradeError && <p className="admin-user-detail__error" role="alert">{gradeError}</p>}
      </section>

      <section className="admin-user-detail__card">
        <h2>활동 정지</h2>

        {user.suspended ? (
          <>
            <p>사유: {user.suspensionReason || '(사유 없음)'}</p>
            <p>정지 시작: {formatDateTime(user.suspendedAt)}</p>
            <p>해제 예정: {formatDateTime(user.suspendedUntil)}</p>
            <button
              type="button"
              className="admin-button admin-button--danger"
              disabled={isSelf}
              onClick={() => setConfirmLift(true)}
            >
              정지 해제
            </button>
            {liftError && <p className="admin-user-detail__error" role="alert">{liftError}</p>}
          </>
        ) : (
          <form onSubmit={handleSuspendSubmit} className="admin-user-detail__suspend-form">
            <div className="admin-user-detail__presets">
              {SUSPENSION_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  className={`admin-button${days === preset ? ' is-active' : ''}`}
                  disabled={isSelf}
                  onClick={() => setDays(preset)}
                >
                  {preset}일
                </button>
              ))}
              <label className="admin-user-detail__custom-days">
                직접 입력
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  disabled={isSelf}
                  onChange={event => setDays(Number(event.target.value))}
                />
                일
              </label>
            </div>

            <label className="admin-user-detail__reason-label" htmlFor="suspend-reason">정지 사유 (필수)</label>
            <textarea
              id="suspend-reason"
              rows={3}
              value={reason}
              disabled={isSelf}
              onChange={event => setReason(event.target.value)}
              required
            />

            {suspendError && <p className="admin-user-detail__error" role="alert">{suspendError}</p>}

            <button type="submit" className="admin-button admin-button--danger" disabled={isSelf || isSuspending}>
              {isSuspending ? '적용 중...' : '활동 정지 적용'}
            </button>
          </form>
        )}
      </section>

      <ConfirmDialog
        open={confirmSuspend}
        title="활동 정지를 적용할까요?"
        description={`"${user.nickname}" 회원의 로그인을 ${days}일간 차단합니다. 계속하시겠습니까?`}
        confirmLabel="정지 적용"
        pending={isSuspending}
        onConfirm={handleSuspendConfirm}
        onCancel={() => setConfirmSuspend(false)}
      />

      <ConfirmDialog
        open={confirmLift}
        title="활동 정지를 해제할까요?"
        description={`"${user.nickname}" 회원의 로그인 차단이 즉시 풀립니다.`}
        confirmLabel="해제"
        danger={false}
        pending={isLifting}
        onConfirm={handleLiftConfirm}
        onCancel={() => setConfirmLift(false)}
      />

      <AdminToast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
