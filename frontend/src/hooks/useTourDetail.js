import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchTourDetail } from '../api/tourApi'

/*
 * TourAPI 상세 조회 상태 훅
 *
 * Design Ref: §2.4 — isLoading·error·data 세 값을 조합하지 않고 status 하나로 표현합니다.
 * "로딩 중이면서 오류" 같은 불가능한 조합이 생기지 않습니다.
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 *
 * 전제: 호출하는 쪽(TourApiDetail)이 key={`${contentId}:${contentTypeId}`}로 재마운트합니다.
 * 그래서 id가 바뀔 때 state를 effect에서 초기화하지 않아도 항상 'loading'부터 시작합니다.
 */

// Design Ref: §2.4, §4.2 — 상태 코드로만 판정합니다. 오류 code 문자열(TOUR_CONTENT_NOT_FOUND)은 로그 확인용입니다.
// 400도 URL에서 만든 잘못된 요청이므로 "찾을 수 없음"으로 안내합니다.
function isNotFoundError(error) {
  return error instanceof ApiError && (error.status === 404 || error.status === 400)
}

export function useTourDetail(contentId, contentTypeId) {
  const [state, setState] = useState({ status: 'loading', detail: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Design Ref: §2.4 경쟁 조건 — cleanup 이후 도착한 응답(이전 id, 이전 재시도)은 무시합니다.
    // client.js가 AbortSignal을 받지 않아 요청 자체는 취소하지 않습니다(후속 과제).
    let isActive = true

    fetchTourDetail(contentId, contentTypeId)
      .then(detail => {
        if (isActive) setState({ status: 'success', detail })
      })
      .catch(error => {
        if (!isActive) return
        const isNotFound = isNotFoundError(error)
        if (!isNotFound) console.error('상세 정보를 불러오지 못했습니다.', error)
        // Design Ref: §4.2 — 400은 화면에서는 not-found로 안내하지만, 프론트가 만든 요청을 서버가 거절했다는 뜻이라
        // 파라미터 계약(contentId 형식·contentTypeId 허용값)이 어긋났을 가능성을 개발자가 알 수 있게 남깁니다.
        if (error instanceof ApiError && error.status === 400) {
          console.warn('상세 요청이 400으로 거절되었습니다. 프론트·백엔드 파라미터 계약이 어긋났는지 확인하세요.', { contentId, contentTypeId, body: error.body })
        }
        setState({ status: isNotFound ? 'not-found' : 'error', detail: null })
      })

    return () => {
      isActive = false
    }
  }, [contentId, contentTypeId, attempt])

  // 로딩 상태 전환은 effect가 아니라 이벤트 핸들러에서 합니다(react-hooks set-state-in-effect 규칙).
  const retry = useCallback(() => {
    setState({ status: 'loading', detail: null })
    setAttempt(value => value + 1)
  }, [])

  // hasRetried: 사용자가 "다시 시도"를 누른 뒤의 결과인지. 오류 카드가 이때만 포커스를 옮깁니다(§5.1).
  return { ...state, retry, hasRetried: attempt > 0 }
}
