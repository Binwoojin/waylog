import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchAdminCourseDetail } from '../api/adminCourseApi'

/*
 * 관리자 여행코스 상세 조회 훅
 *
 * Design Ref: useAdminNoticeDetail.js와 같은 패턴. courseId가 없으면(새 코스 작성 화면)
 * 조회하지 않고 즉시 success(빈 값)로 취급한다. 없는 id는 다른 관리자 조회 API와 같은
 * 컨벤션으로 400이 오므로(TourCourseAdminService.findCourse), not-found로 취급한다.
 *
 * 전제: 호출하는 쪽이 key={courseId ?? 'new'}로 재마운트한다(useAdminNoticeDetail과 같은 이유).
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 */
function isNotFoundError(error) {
  return error instanceof ApiError && error.status === 400
}

export function useAdminCourseDetail(courseId) {
  const [state, setState] = useState(() => (
    courseId ? { status: 'loading', course: null } : { status: 'success', course: null }
  ))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!courseId) return undefined

    let isActive = true

    fetchAdminCourseDetail(courseId)
      .then(course => {
        if (isActive) setState({ status: 'success', course })
      })
      .catch(error => {
        if (!isActive) return
        const notFound = isNotFoundError(error)
        if (!notFound) console.error('여행코스를 불러오지 못했습니다.', error)
        setState({ status: notFound ? 'not-found' : 'error', course: null })
      })

    return () => {
      isActive = false
    }
  }, [courseId, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', course: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
