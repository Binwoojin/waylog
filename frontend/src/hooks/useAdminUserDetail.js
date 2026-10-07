import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchAdminUserDetail } from '../api/adminUserApi'

/*
 * 관리자 회원 상세 조회 훅
 *
 * Design Ref: useAdminNoticeDetail.js와 같은 패턴입니다. 없는 id는 다른 관리자 조회 API와 같은
 * 컨벤션으로 400(IllegalArgumentException → GlobalExceptionHandler)이 오므로, 상세 화면은
 * 이 400을 not-found로 취급합니다(useAdminNoticeDetail·useTourDetail과 같은 판단 기준).
 *
 * 전제: 호출하는 쪽이 key={id}로 재마운트합니다. 공지 상세와 달리 이 화면은 "새 회원 생성" 모드가
 * 없어 id가 항상 있다고 가정합니다(라우트가 /admin/users/:id로 고정).
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 */
function isNotFoundError(error) {
  return error instanceof ApiError && error.status === 400
}

export function useAdminUserDetail(id) {
  const [state, setState] = useState({ status: 'loading', user: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true

    fetchAdminUserDetail(id)
      .then(user => {
        if (isActive) setState({ status: 'success', user })
      })
      .catch(error => {
        if (!isActive) return
        const notFound = isNotFoundError(error)
        if (!notFound) console.error('회원 정보를 불러오지 못했습니다.', error)
        setState({ status: notFound ? 'not-found' : 'error', user: null })
      })

    return () => {
      isActive = false
    }
  }, [id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', user: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
