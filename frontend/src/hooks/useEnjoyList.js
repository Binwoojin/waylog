import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchEnjoyList } from '../api/tourApi'
import { serializeEnjoyListQuery } from '../lib/enjoyListQuery'

/*
 * 즐길거리 목록 조회 상태 훅
 *
 * hooks/useTourList.js와 같은 상태 머신(렌더 중 파생, "마지막으로 끝난 요청의 key" vs
 * "지금 필요한 요청의 key" 비교, AbortController + isActive 이중 가드, 조건별 재시도 횟수)을
 * 즐길거리 쿼리 모델(lib/enjoyListQuery.js)에 맞게 다시 만듭니다. useTourList는 query가
 * TOUR_LIST_CONFIGS로 유형을 찾을 수 있다고 전제해(toTourApiParams) 그대로 재사용할 수 없으므로,
 * CourseListView가 useCourseList를 쓰는 것과 같은 이유로 병렬 훅을 둡니다.
 *
 * status: 'idle' | 'loading' | 'refreshing' | 'success' | 'error'
 * data: EnjoyListResult | null (refreshing 중에는 이전 성공 결과)
 * errorKind: 'invalid'(400) | 'failed'(그 외) | null
 */

const IDLE_STATE = { status: 'idle', data: null, errorKind: null }

export function useEnjoyList(query) {
  const queryKey = query ? serializeEnjoyListQuery(query).toString() : null

  // 재시도 횟수는 조건별로 셉니다. 다른 조건으로 바뀌면 0부터 다시 셉니다.
  const [retryState, setRetryState] = useState({ key: null, count: 0 })
  const attempt = retryState.key === queryKey ? retryState.count : 0
  const requestKey = queryKey == null ? null : `${queryKey}#${attempt}`

  const [settled, setSettled] = useState({ key: null, status: null, data: null, errorKind: null })

  const requestList = useEffectEvent(signal => fetchEnjoyList(query, { signal }))

  useEffect(() => {
    if (requestKey == null) return undefined

    const controller = new AbortController()
    let isActive = true

    requestList(controller.signal)
      .then(data => {
        if (isActive) setSettled({ key: requestKey, status: 'success', data, errorKind: null })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return

        const errorKind = error instanceof ApiError && error.status === 400 ? 'invalid' : 'failed'
        if (errorKind === 'failed') {
          console.error('즐길거리 목록을 불러오지 못했습니다.', error)
        } else {
          console.warn('목록 요청이 400으로 거절되었습니다. URL 정규화와 백엔드 검증이 어긋났는지 확인하세요.', { params: requestKey, body: error.body })
        }
        setSettled({ key: requestKey, status: 'error', data: null, errorKind })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [requestKey])

  const retry = useCallback(() => {
    setRetryState(previous => ({
      key: queryKey,
      count: previous.key === queryKey ? previous.count + 1 : 1,
    }))
  }, [queryKey])

  const hasRetried = attempt > 0

  if (requestKey == null) return { ...IDLE_STATE, retry, hasRetried: false }
  if (settled.key === requestKey) {
    return { status: settled.status, data: settled.data, errorKind: settled.errorKind, retry, hasRetried }
  }

  const previous = settled.status === 'success' ? settled.data : null
  return { status: previous ? 'refreshing' : 'loading', data: previous, errorKind: null, retry, hasRetried }
}
