import { useEffect, useRef } from 'react'

/**
 * 무한 스크롤 트리거 지점 (표시 컴포넌트)
 *
 * Design Ref: feed-integration.design.md §7.2 — 화면에 닿기 200px 전에 미리 다음 페이지를
 * 요청해 스크롤이 끊기지 않게 한다. disabled(더 불러올 항목이 없거나 이미 에러 상태)면
 * IntersectionObserver 자체를 만들지 않아 불필요한 요청을 막는다.
 */
export default function FeedTimelineSentinel({ onIntersect, disabled = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (disabled || !ref.current) return undefined

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onIntersect()
      },
      { rootMargin: '200px' },
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onIntersect, disabled])

  return <div ref={ref} className="feed-sentinel" aria-hidden="true" />
}
