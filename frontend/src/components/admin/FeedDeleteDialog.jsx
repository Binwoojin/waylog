import { useEffect, useId, useRef, useState } from 'react'
import './FeedDeleteDialog.css'

const SUSPENSION_PRESETS = [3, 7, 30]

/**
 * 피드 삭제 폼 (ConfirmDialog의 오버레이·카드 스타일을 재사용하는 전용 다이얼로그)
 *
 * Design Ref: admin-dashboard.design.md §5.4, 계획 FR-F03, FR-F04
 *
 * 유형(일반/정책위반) → 사유(필수) → 정책위반일 때만 작성자 활동 정지 옵션을 입력받는다.
 * 제출 시:
 *  - 일반 삭제: 검증만 통과하면 바로 onSubmitNormal(payload)를 호출한다(소프트 삭제, 되돌릴 여지가 있다고 봄).
 *  - 정책위반 삭제: API를 바로 부르지 않고 onRequestPolicyViolationConfirm(payload)만 호출해
 *    부모가 별도의 ConfirmDialog(되돌릴 수 없음을 굵게 강조)를 한 번 더 띄우게 한다
 *    (회원 활동 정지 code review Must Fix와 같은 원칙 — 되돌리기 어려운 동작은 확인 단계를 하나 더 둔다).
 */
export default function FeedDeleteDialog({ open, pending, onCancel, onSubmitNormal, onRequestPolicyViolationConfirm }) {
  const [type, setType] = useState('NORMAL')
  const [reason, setReason] = useState('')
  const [suspendAuthor, setSuspendAuthor] = useState(false)
  const [days, setDays] = useState(7)
  const [error, setError] = useState(null)

  const titleId = useId()
  const firstFieldRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    firstFieldRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  function handleSubmit(event) {
    event.preventDefault()

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('삭제 사유를 입력해 주세요.')
      return
    }
    if (type === 'POLICY_VIOLATION' && suspendAuthor && (!Number.isInteger(days) || days < 1 || days > 365)) {
      setError('정지 기간은 1일에서 365일 사이로 입력해 주세요.')
      return
    }

    setError(null)

    const payload = { type, reason: trimmedReason }
    if (type === 'POLICY_VIOLATION' && suspendAuthor) {
      payload.suspendAuthor = true
      payload.suspensionDays = days
    }

    if (type === 'POLICY_VIOLATION') {
      onRequestPolicyViolationConfirm(payload)
    } else {
      onSubmitNormal(payload)
    }
  }

  return (
    <div className="admin-confirm-dialog__overlay" onClick={onCancel}>
      <section
        className="admin-confirm-dialog admin-feed-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <h2 id={titleId} className="admin-confirm-dialog__title">게시물 삭제</h2>

        <form onSubmit={handleSubmit} className="admin-feed-delete-dialog__form">
          <fieldset className="admin-feed-delete-dialog__type">
            <legend>삭제 유형</legend>
            <label>
              <input
                ref={firstFieldRef}
                type="radio"
                name="feed-delete-type"
                value="NORMAL"
                checked={type === 'NORMAL'}
                onChange={() => setType('NORMAL')}
              />
              일반 삭제 (숨김 처리, 사유를 기록만 합니다)
            </label>
            <label>
              <input
                type="radio"
                name="feed-delete-type"
                value="POLICY_VIOLATION"
                checked={type === 'POLICY_VIOLATION'}
                onChange={() => setType('POLICY_VIOLATION')}
              />
              정책위반 삭제 (완전 삭제, <strong>되돌릴 수 없음</strong>)
            </label>
          </fieldset>

          <label className="admin-feed-delete-dialog__reason-label" htmlFor="feed-delete-reason">삭제 사유 (필수)</label>
          <textarea
            id="feed-delete-reason"
            rows={3}
            value={reason}
            onChange={event => setReason(event.target.value)}
            required
          />

          {type === 'POLICY_VIOLATION' && (
            <div className="admin-feed-delete-dialog__suspend">
              <label>
                <input
                  type="checkbox"
                  checked={suspendAuthor}
                  onChange={event => setSuspendAuthor(event.target.checked)}
                />
                작성자 활동 정지도 함께 적용
              </label>

              {suspendAuthor && (
                <div className="admin-feed-delete-dialog__presets">
                  {SUSPENSION_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className={`admin-button${days === preset ? ' is-active' : ''}`}
                      onClick={() => setDays(preset)}
                    >
                      {preset}일
                    </button>
                  ))}
                  <label className="admin-feed-delete-dialog__custom-days">
                    직접 입력
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={days}
                      onChange={event => setDays(Number(event.target.value))}
                    />
                    일
                  </label>
                </div>
              )}
            </div>
          )}

          {error && <p className="admin-feed-delete-dialog__error" role="alert">{error}</p>}

          <div className="admin-confirm-dialog__actions">
            <button type="button" className="admin-button" onClick={onCancel} disabled={pending}>취소</button>
            <button type="submit" className="admin-button admin-button--danger" disabled={pending}>
              {pending ? '처리 중...' : '삭제'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
