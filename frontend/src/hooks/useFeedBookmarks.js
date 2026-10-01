import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchFeedBookmarks, toggleFeedBookmark } from '../api/feedApi'

/*
 * 피드 북마크 탭 상태 훅 (/bookmarks)
 *
 * Design Ref: mypage-bookmarks.design.md §2.2, §6.2 — 투어 북마크 탭(useTourBookmarks)과
 * 완전히 독립된 상태를 가진다(탭 전환 시 상태 공유 없음, Plan §7.2). 해제는 Q-8 결정대로
 * 즉시 제거(Undo 없음) + 실패 시 롤백한다.
 *
 * status: 'loading' | 'success' | 'login-required' | 'error'
 */
export function useFeedBookmarks(page = 1) {
  const [state, setState] = useState({ status: 'loading', items: [], currentPage: 1, totalPages: 0, hasNext: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    fetchFeedBookmarks({ page }, { signal: controller.signal })
      .then(result => {
        if (isActive) setState({ status: 'success', ...result })
      })
      .catch(error => {
        if (!isActive) return
        if (isAbortError(error)) return

        if (error instanceof ApiError && error.status === 401) {
          setState(current => ({ ...current, status: 'login-required', items: [] }))
          return
        }

        console.error('피드 북마크 목록을 불러오지 못했습니다.', error)
        setState(current => ({ ...current, status: 'error', items: [] }))
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [page, attempt])

  const retry = useCallback(() => {
    setState(current => ({ ...current, status: 'loading' }))
    setAttempt(value => value + 1)
  }, [])

  /*
   * 북마크 해제: 낙관적으로 목록에서 즉시 제거하고, 실패하면 원래 위치로 되돌린다(Q-8).
   * toggleFeedBookmark은 토글 API라 이미 북마크된 게시물에 호출하면 해제가 된다.
   */
  const removeBookmark = useCallback(async postId => {
    let removedIndex = -1
    let removedItem = null

    setState(current => {
      const index = current.items.findIndex(post => post.id === postId)
      if (index === -1) return current
      removedIndex = index
      removedItem = current.items[index]
      return { ...current, items: current.items.filter(post => post.id !== postId) }
    })

    if (!removedItem) return

    try {
      await toggleFeedBookmark(postId)
    } catch (error) {
      console.error('북마크 해제에 실패했습니다.', error)
      setState(current => {
        const items = [...current.items]
        items.splice(removedIndex, 0, removedItem)
        return { ...current, items }
      })
    }
  }, [])

  return { ...state, retry, removeBookmark }
}
