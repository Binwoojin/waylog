import { useEffect, useEffectEvent, useRef } from 'react'

/**
 * 검색 모달 공통 틀: 오버레이 · Esc · 스크롤 잠금 · 포커스 관리 · 헤더 · 푸터
 *
 * Design Ref: §5.4 — aria-modal="true"는 "이 창 밖으로 포커스가 나가지 않는다"는 약속입니다.
 * 기존 모달은 이 약속을 지키지 않았습니다. 여행지·즐기기 두 모달이 이 틀 하나를 써서
 * 한 곳에서 고치면 둘 다 맞아집니다.
 *
 * 초기 포커스는 dialog 자체(tabIndex={-1})에 둡니다. 첫 버튼(시·도 "전국")에 두면
 * 스크린 리더 사용자가 Enter 한 번으로 의도치 않은 선택을 할 수 있습니다.
 *
 * 포커스 트랩(Tab 순환)은 설계 §5.4의 여유 범위라 이번에는 구현하지 않았습니다(후속 과제, §13.1).
 * 배경 스크롤이 잠겨 있고 오버레이가 화면 전체를 덮어 마우스 사용자는 영향이 없고,
 * 키보드 사용자만 Tab으로 배경 요소에 도달할 수 있습니다.
 */
export default function SearchModalFrame({ titleId, title, description, closeLabel, onClose, variant, footer, children }) {
  const dialogRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

  // Design Ref: §5.4 — onClose는 useEffectEvent로 감싸 부모가 매 렌더 새 함수를 넘겨도
  // Esc 리스너를 다시 등록하지 않으면서 항상 최신 onClose를 호출합니다(useTourList.js와 같은 방식).
  const handleClose = useEffectEvent(() => onClose())

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement
    dialogRef.current?.focus()

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const handleKeyDown = event => {
      if (event.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      window.removeEventListener('keydown', handleKeyDown)

      // 검색 제출로 페이지가 바뀌어 이전 포커스 대상이 사라졌으면 복원하지 않습니다.
      const previouslyFocused = previouslyFocusedRef.current
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
    // Design Ref: §5.4 — 마운트 동안 한 번만 실행합니다(모달은 열릴 때 마운트되는 컴포넌트입니다).
    // handleClose는 useEffectEvent라 의존성 배열에 넣지 않습니다.
  }, [])

  return (
    <div
      className={`travel-search-modal${variant === 'enjoy' ? ' enjoy-search-modal' : ''}`}
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        className="travel-search-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <button className="travel-search-modal__close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
        <header>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </header>
        {children}
        {footer}
      </section>
    </div>
  )
}
