import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchAdminFeedDetail } from '../api/adminFeedApi'

/*
 * 관리자 피드 상세 조회 훅
 *
 * Design Ref: useAdminUserDetail.js와 같은 패턴입니다. 없는 id는 다른 관리자 조회 API와 같은
 * 컨벤션으로 400(IllegalArgumentException → GlobalExceptionHandler 계열)이 오므로,
 * 상세 화면은 이 400을 not-found로 취급합니다.
 *
 * 전제: 호출하는 쪽이 key={id}로 재마운트합니다. 삭제(하드 삭제) 성공 후 retry()를 부르면
 * 같은 id를 다시 조회하게 되고, 하드 삭제된 게시물은 그대로 not-found로 응답이 오므로
 * "삭제됨" 상태를 별도로 관리하지 않고 이 훅의 재조회만으로 최신 상태를 반영합니다.
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 */
function isNotFoundError(error) {
  return error instanceof ApiError && error.status === 400
}

export function useAdminFeedDetail(id) {
  const [state, setState] = useState({ status: 'loading', post: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true

    fetchAdminFeedDetail(id)
      .then(post => {
        if (isActive) setState({ status: 'success', post })
      })
      .catch(error => {
        if (!isActive) return
        const notFound = isNotFoundError(error)
        if (!notFound) console.error('피드 게시물을 불러오지 못했습니다.', error)
        setState({ status: notFound ? 'not-found' : 'error', post: null })
      })

    return () => {
      isActive = false
    }
  }, [id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', post: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
