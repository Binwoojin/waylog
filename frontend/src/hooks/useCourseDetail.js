import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchCourseDetail } from '../api/courseApi'

/*
 * 여행코스 상세 조회 상태 훅
 *
 * Design Ref: tour-course-list-integration.design.md §8.1 — useTourDetail과 동일한 패턴입니다.
 * 호출하는 쪽(TourCourseDetailPage)이 key={id}로 재마운트해, id가 바뀔 때 항상 loading부터 시작합니다.
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 */
export function useCourseDetail(id) {
  const [state, setState] = useState({ status: 'loading', detail: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true

    fetchCourseDetail(id)
      .then(detail => {
        if (isActive) setState({ status: 'success', detail })
      })
      .catch(error => {
        if (!isActive) return
        const isNotFound = error instanceof ApiError && (error.status === 404 || error.status === 400)
        if (!isNotFound) console.error('여행코스 상세 정보를 불러오지 못했습니다.', error)
        // Design Ref: useTourDetail.js와 동일 원칙 — 400은 화면에서는 not-found로 안내하지만,
        // 프론트가 만든 요청을 서버가 거절했다는 뜻이라 파라미터 계약(id 형식 등)이 어긋났을
        // 가능성을 개발자가 알 수 있게 남긴다.
        if (error instanceof ApiError && error.status === 400) {
          console.warn('여행코스 상세 요청이 400으로 거절되었습니다. 프론트·백엔드 파라미터 계약이 어긋났는지 확인하세요.', { id, body: error.body })
        }
        setState({ status: isNotFound ? 'not-found' : 'error', detail: null })
      })

    return () => {
      isActive = false
    }
  }, [id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', detail: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
