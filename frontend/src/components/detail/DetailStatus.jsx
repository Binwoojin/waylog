import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import '../../pages/StatusPage.css'
import './DetailStatus.css'

/**
 * 상세 API 조회 중·실패 화면입니다.
 *
 * Design Ref: §5.1 — NotFoundPage·ErrorBoundary와 같은 status-page 카드를 재사용합니다.
 * min-height가 있는 카드라 로딩 → 결과로 바뀔 때 푸터가 위로 튀어 오르지 않습니다.
 *
 * variant
 * - 'loading': role="status"로 스크린 리더에 진행 중임을 알립니다. 스피너는 두지 않습니다.
 * - 'error'  : role="alert". 서버 message는 노출하지 않고, 다시 시도(<button>)와 목록 이동을 제공합니다.
 *
 * focusOnMount (error 전용)
 * "다시 시도"를 누르면 버튼이 로딩 카드로 바뀌며 사라져 포커스가 body로 떨어집니다.
 * 재시도가 또 실패해 오류 카드가 다시 나타나면 제목으로 포커스를 옮겨 키보드 사용자가 바로 다시 조작할 수 있게 합니다.
 * 첫 진입 실패에는 옮기지 않습니다. 사용자가 누른 것이 없으므로 role="alert" 안내로 충분하고,
 * 페이지 로드 직후 포커스를 강제로 옮기면 스크린 리더가 문서 처음부터 읽는 흐름을 끊기 때문입니다.
 */
export default function DetailStatus({ variant, onRetry, backTo, focusOnMount = false }) {
  if (variant === 'loading') {
    return (
      <main className="status-page">
        <section className="status-page__card" role="status">
          <p className="status-page__description">상세 정보를 불러오는 중입니다.</p>
        </section>
      </main>
    )
  }

  return <DetailErrorCard onRetry={onRetry} backTo={backTo} focusOnMount={focusOnMount} />
}

function DetailErrorCard({ onRetry, backTo, focusOnMount }) {
  const titleRef = useRef(null)

  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus()
  }, [focusOnMount])

  return (
    <main className="status-page">
      <section className="status-page__card" role="alert" aria-labelledby="detail-error-title">
        <p className="status-page__eyebrow status-page__eyebrow--error">오류</p>
        <h1 className="status-page__title detail-status__title" id="detail-error-title" tabIndex={-1} ref={titleRef}>상세 정보를 불러오지 못했습니다</h1>
        <p className="status-page__description">잠시 후 다시 시도해 주세요.</p>
        <div className="status-page__actions">
          <button className="status-page__button status-page__button--primary" type="button" onClick={onRetry}>
            다시 시도
          </button>
          <Link className="status-page__button" to={backTo}>목록으로</Link>
        </div>
      </section>
    </main>
  )
}
