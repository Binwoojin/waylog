import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchTourList } from '../api/tourApi'
import { toTourApiParams } from '../lib/tourListQuery'

/*
 * 여행지 목록 조회 상태 훅
 *
 * Design Ref: §2.4 — useTourList(query) → { status, data, errorKind, retry, hasRetried }
 * status: 'idle' | 'loading' | 'refreshing' | 'success' | 'error'
 * data: TourListResult | null (refreshing 중에는 이전 성공 결과)
 * errorKind: 'invalid'(400) | 'failed'(그 외) | null
 *
 * 진행 상태를 state에 쓰지 않고 렌더 중에 파생합니다.
 * "마지막으로 끝난 요청의 key"와 "지금 필요한 요청의 key"가 다르면 아직 응답이 없는 것입니다.
 * - effect에서 setState({ status: 'loading' })를 부르면 set-state-in-effect 규칙에 걸리고,
 *   조건이 바뀐 첫 렌더에 "새 조건 + 이전 결과(success)"가 한 프레임 보입니다.
 * - 상세(useTourDetail)처럼 key로 재마운트하면 refreshing 중 이전 결과를 유지할 수 없습니다.
 */

const IDLE_STATE = { status: 'idle', data: null, errorKind: null }

// options.size: 미리보기처럼 건수를 줄일 때만 씁니다. 생략하면 목록 페이지 크기입니다.
export function useTourList(query, { size } = {}) {
  // Design Ref: §2.4 — query 객체가 아니라 직렬화한 문자열에 의존합니다. 객체는 렌더마다 새로 만들어질 수 있습니다.
  // 설계 초안의 serializeTourListQuery 대신 실제 요청 파라미터를 key로 씁니다.
  // 카탈로그 URL에는 contentTypeId가 없어 관광지·문화시설의 기본 조건이 같은 문자열이 되기 때문입니다.
  // size도 실제 요청 파라미터에 들어가므로 key에 포함됩니다(미리보기와 목록의 캐시 key가 섞이지 않습니다).
  const queryKey = query ? toTourApiParams(query, { size }).toString() : null

  // 재시도 횟수는 조건별로 셉니다. 다른 조건으로 바뀌면 0부터 다시 셉니다(hasRetried가 새 조건의 첫 실패에 남지 않게).
  const [retryState, setRetryState] = useState({ key: null, count: 0 })
  const attempt = retryState.key === queryKey ? retryState.count : 0
  const requestKey = queryKey == null ? null : `${queryKey}#${attempt}`

  // 마지막으로 끝난 요청의 결과
  const [settled, setSettled] = useState({ key: null, status: null, data: null, errorKind: null })

  // effect는 requestKey가 바뀔 때만 다시 실행하고, 요청에는 그 렌더의 최신 query를 씁니다.
  // URL 정규화(replace)로 query 객체만 새로 만들어져도 같은 조건이면 다시 요청하지 않습니다.
  const requestList = useEffectEvent(signal => fetchTourList(query, { signal, size }))

  useEffect(() => {
    if (requestKey == null) return undefined

    // Design Ref: §2.4 경쟁 조건(D-8) — 두 겹으로 막습니다.
    // 1. abort: 이전 요청을 실제로 취소합니다.
    // 2. isActive: abort 직전에 응답이 이미 도착해 then이 예약된 경우를 막습니다. abort만으로는 막지 못합니다.
    const controller = new AbortController()
    let isActive = true

    requestList(controller.signal)
      .then(data => {
        if (isActive) setSettled({ key: requestKey, status: 'success', data, errorKind: null })
      })
      .catch(error => {
        // FR-01 — 취소는 오류가 아닙니다. 다음 요청의 상태가 곧 반영됩니다.
        if (!isActive || isAbortError(error)) return

        // Design Ref: §4.2 — 상태 코드로만 나눕니다. 서버 message는 화면에 노출하지 않습니다.
        const errorKind = error instanceof ApiError && error.status === 400 ? 'invalid' : 'failed'
        if (errorKind === 'failed') {
          console.error('여행지 목록을 불러오지 못했습니다.', error)
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

  // 재시도는 attempt만 올립니다. requestKey가 바뀌어 같은 조건으로 다시 요청하고, 이전 결과가 error라 loading이 됩니다.
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

  // 아직 이 key의 응답이 없습니다. 이전 성공 결과가 있으면 그 결과를 유지(refreshing), 없으면 loading입니다.
  // 이전이 오류였다면 다른 조건의 오류를 계속 보여 주지 않고 loading부터 시작합니다.
  const previous = settled.status === 'success' ? settled.data : null
  return { status: previous ? 'refreshing' : 'loading', data: previous, errorKind: null, retry, hasRetried }
}
