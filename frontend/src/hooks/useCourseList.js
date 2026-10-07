import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchCourseList } from '../api/courseApi'
import { serializeCourseListQuery } from '../lib/courseListQuery'

/*
 * 여행코스 목록 조회 상태 훅
 *
 * Design Ref: tour-course-list-integration.design.md §7.2 — useTourList와 같은 상태 머신 패턴
 * (렌더 중 파생, AbortController + isActive)을 쓰되, 코스 쿼리는 항상 유효해 'idle' 분기가 없습니다.
 * 관광지 쿼리 모델(§2.2)을 몰라도 되게 별도 파일로 둡니다.
 *
 * status: 'loading' | 'refreshing' | 'success' | 'error'
 * data: { items: CourseCard[], totalCount, page, totalPages } | null (refreshing 중에는 이전 결과)
 */
export function useCourseList(query) {
  const queryKey = serializeCourseListQuery(query).toString()
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${queryKey}#${attempt}`
  const [settled, setSettled] = useState({ key: null, status: null, data: null })

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    fetchCourseList(query, { signal: controller.signal })
      .then(data => {
        if (isActive) setSettled({ key: requestKey, status: 'success', data })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        if (!(error instanceof ApiError) || error.status !== 400) console.error('여행코스 목록을 불러오지 못했습니다.', error)
        setSettled({ key: requestKey, status: 'error', data: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query가 아니라 직렬화한 requestKey에 의존합니다(§7.2).
  }, [requestKey])

  const retry = useCallback(() => setAttempt(value => value + 1), [])

  if (settled.key === requestKey) return { ...settled, retry, hasRetried: attempt > 0 }

  const previous = settled.status === 'success' ? settled.data : null
  return { status: previous ? 'refreshing' : 'loading', data: previous, retry, hasRetried: attempt > 0 }
}
