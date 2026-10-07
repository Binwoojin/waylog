import { useEffect, useId, useRef } from 'react'

/**
 * 되돌리기 어려운 동작(삭제 등)을 확인하는 모달 (표시 컴포넌트)
 *
 * Design Ref: admin-dashboard.design.md §2.2 — 삭제 4곳(공지, 이후 코스·회원·피드)이 공유합니다.
 * 열리면 확인 버튼에 포커스를 옮기고, Esc로 닫을 수 있게 최소한의 접근성만 지킵니다
 * (전체 페이지를 가리는 드로어가 아니라 좁은 확인 모달이라 app-safety-net의 MobileNav만큼
 * 전체 Tab 트랩을 만들 필요는 없다고 판단했습니다 — 과도한 추상화 방지).
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  danger = true,
  pending = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined

    confirmRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="admin-confirm-dialog__overlay" onClick={onCancel}>
      <section
        className="admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={event => event.stopPropagation()}
      >
        <h2 id={titleId} className="admin-confirm-dialog__title">{title}</h2>
        {description && <p id={descriptionId} className="admin-confirm-dialog__description">{description}</p>}
        <div className="admin-confirm-dialog__actions">
          <button type="button" className="admin-button" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`admin-button ${danger ? 'admin-button--danger' : 'admin-button--primary'}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
