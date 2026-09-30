import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchAdminNoticeDetail } from '../api/adminNoticeApi'

/*
 * 관리자 공지 수정 화면의 상세 조회 훅
 *
 * Design Ref: admin-dashboard.design.md §3.1 — 상태 패턴은 useTourDetail과 동일합니다.
 * noticeId가 없으면(새 글 작성 화면) 조회하지 않고 즉시 success(빈 값)로 취급합니다.
 *
 * 전제: 호출하는 쪽이 key={noticeId ?? 'new'}로 재마운트합니다(useTourDetail과 같은 이유 —
 * id가 바뀔 때 state를 effect에서 초기화하지 않아도 항상 올바른 초기 상태부터 시작합니다).
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 */
function isNotFoundError(error) {
  // PostService.findPost가 없는 id에 IllegalArgumentException을 던지면
  // GlobalExceptionHandler가 400으로 응답합니다(404가 아님). useTourDetail도 같은 이유로 400을 not-found로 봅니다.
  return error instanceof ApiError && error.status === 400
}

export function useAdminNoticeDetail(noticeId) {
  const [state, setState] = useState(() => (
    noticeId ? { status: 'loading', notice: null } : { status: 'success', notice: null }
  ))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!noticeId) return undefined

    let isActive = true

    fetchAdminNoticeDetail(noticeId)
      .then(notice => {
        if (isActive) setState({ status: 'success', notice })
      })
      .catch(error => {
        if (!isActive) return
        const notFound = isNotFoundError(error)
        if (!notFound) console.error('공지사항을 불러오지 못했습니다.', error)
        setState({ status: notFound ? 'not-found' : 'error', notice: null })
      })

    return () => {
      isActive = false
    }
  }, [noticeId, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', notice: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
