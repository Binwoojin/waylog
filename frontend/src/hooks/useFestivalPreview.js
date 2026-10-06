import { useCallback, useEffect, useState } from 'react'
import { isAbortError } from '../api/client'
import { fetchFestivalPreview } from '../api/tourApi'

/*
 * 축제 미리보기 조회 상태 훅
 *
 * 필터(status)가 바뀌면 이전 결과를 지우고 로딩을 보입니다. 결과는 요청한 필터와 재시도 횟수가 모두 맞을 때만 씁니다.
 * 그래서 이전 필터의 카드가 새 필터 자리에 잠깐 남지 않습니다.
 * 진행 상태는 state에 쓰지 않고 렌더 중에 파생합니다(useTourList와 같은 이유).
 *
 * status: 'loading' | 'success' | 'error'
 * items: FestivalPreviewItem[] (success일 때)
 */
export function useFestivalPreview(status) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState({ status: null, attempt: null, items: [], failed: false })

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    fetchFestivalPreview(status, { signal: controller.signal })
      .then(items => {
        if (isActive) setSettled({ status, attempt, items, failed: false })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        console.error('축제 목록을 불러오지 못했습니다.', error)
        setSettled({ status, attempt, items: [], failed: true })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [status, attempt])

  const retry = useCallback(() => setAttempt(value => value + 1), [])
  const isCurrent = settled.status === status && settled.attempt === attempt

  if (!isCurrent) return { status: 'loading', items: [], retry }
  return { status: settled.failed ? 'error' : 'success', items: settled.items, retry }
}
