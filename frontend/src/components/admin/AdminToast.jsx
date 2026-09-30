import { useEffect } from 'react'

/**
 * 저장·삭제 후 짧은 성공 피드백 (표시 컴포넌트)
 *
 * Design Ref: admin-dashboard.design.md §2.2 — message가 있을 때만 보이고, duration 후 자동으로 사라집니다.
 */
export default function AdminToast({ message, onDismiss, duration = 3000 }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!message) return null

  return (
    <div className="admin-toast" role="status">{message}</div>
  )
}
