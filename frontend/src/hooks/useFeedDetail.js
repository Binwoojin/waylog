import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { fetchFeedDetail } from '../api/feedApi'

/*
 * 피드 게시물 상세 조회 상태 훅
 *
 * Design Ref: feed-integration.design.md — useCourseDetail/useTourDetail과 동일한 패턴입니다.
 * 호출하는 쪽(FeedDetailPage)이 key={id}로 재마운트해, id가 바뀔 때 항상 loading부터 시작합니다.
 *
 * status: 'loading' | 'success' | 'not-found' | 'error'
 */
export function useFeedDetail(id) {
  const [state, setState] = useState({ status: 'loading', post: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    fetchFeedDetail(id, { signal: controller.signal })
      .then(post => {
        if (isActive) setState({ status: 'success', post })
      })
      .catch(error => {
        if (!isActive) return
        const isNotFound = error instanceof ApiError && (error.status === 404 || error.status === 400)
        if (!isNotFound) console.error('게시물 정보를 불러오지 못했습니다.', error)
        setState({ status: isNotFound ? 'not-found' : 'error', post: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [id, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', post: null })
    setAttempt(value => value + 1)
  }, [])

  /**
   * 좋아요·북마크 토글이 성공한 뒤 서버를 다시 조회하지 않고 화면 상태만 즉시 갱신한다.
   */
  const applyLocalUpdate = useCallback(patch => {
    setState(previous => (previous.post ? { ...previous, post: { ...previous.post, ...patch } } : previous))
  }, [])

  return { ...state, retry, hasRetried: attempt > 0, applyLocalUpdate }
}
