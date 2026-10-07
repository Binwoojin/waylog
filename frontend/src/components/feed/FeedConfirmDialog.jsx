import { useEffect, useId, useRef } from 'react'
import './FeedConfirmDialog.css'

/**
 * 되돌리기 어려운 동작(게시물 삭제)을 확인하는 공개 화면 전용 모달
 *
 * Design Ref: feed-integration.design.md §7.1 — 관리자 `ConfirmDialog.jsx`는 `admin-*` CSS
 * 클래스에 결합돼 있어 공개 화면에 그대로 쓰면 관리자 디자인이 새어 나온다. 같은 접근성 패턴
 * (열리면 확인 버튼에 포커스, Esc로 닫기, role="alertdialog")만 그대로 따르고 마크업·스타일은
 * 이 화면 전용으로 새로 작성한다.
 */
export default function FeedConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
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
    <div className="feed-confirm-dialog__overlay" onClick={onCancel}>
      <section
        className="feed-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={event => event.stopPropagation()}
      >
        <h2 id={titleId} className="feed-confirm-dialog__title">{title}</h2>
        {description && <p id={descriptionId} className="feed-confirm-dialog__description">{description}</p>}
        <div className="feed-confirm-dialog__actions">
          <button type="button" className="feed-confirm-dialog__button" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className="feed-confirm-dialog__button feed-confirm-dialog__button--danger"
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
