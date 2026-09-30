import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchFeedUserProfile } from '../api/feedApi'

/*
 * 타인 피드 프로필 조회 상태 훅
 *
 * Design Ref: feed-integration.design.md §9 — useCourseDetail과 같은 패턴(loading/success/not-found/error,
 * key={userId}로 재마운트).
 *
 * 401 처리: GET /api/v1/feed/profile/{userId}는 설계상 비로그인도 조회 가능한 공개 API이지만,
 * 백엔드 SecurityConfig에 아직 permitAll 규칙이 없다면 비로그인 요청이 401로 거절될 수 있다.
 * 이 경우를 'error'와 구분되는 'login-required' 상태로 따로 두어, 백엔드가 나중에 permitAll을
 * 추가하면 프론트 변경 없이 바로 정상 동작하도록 대비한다.
 *
 * status: 'loading' | 'success' | 'not-found' | 'login-required' | 'error'
 */
export function useFeedUserProfile(userId, page = 1) {
  const [state, setState] = useState({ status: 'loading', profile: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    fetchFeedUserProfile(userId, { page }, { signal: controller.signal })
      .then(profile => {
        if (isActive) setState({ status: 'success', profile })
      })
      .catch(error => {
        if (!isActive) return
        if (isAbortError(error)) return

        if (error instanceof ApiError && error.status === 401) {
          setState({ status: 'login-required', profile: null })
          return
        }

        const isNotFound = error instanceof ApiError && (error.status === 404 || error.status === 400)
        if (!isNotFound) console.error('프로필 정보를 불러오지 못했습니다.', error)
        setState({ status: isNotFound ? 'not-found' : 'error', profile: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [userId, page, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', profile: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
