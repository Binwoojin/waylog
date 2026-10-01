import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchTourBookmarks, toggleTourBookmark } from '../api/tourBookmarkApi'

/*
 * 여행지/여행 즐기기 북마크 탭 상태 훅 (/bookmarks)
 *
 * Design Ref: mypage-bookmarks.design.md §2.2, §6.2 — group별('DESTINATION' | 'ENJOY')로
 * 독립된 인스턴스를 만들어 쓴다(탭마다 완전히 분리된 하위 컴포넌트+훅, 상태 공유 없음).
 * 해제는 Q-8 결정대로 즉시 제거(Undo 없음) + 실패 시 롤백한다.
 *
 * status: 'loading' | 'success' | 'login-required' | 'error'
 */
export function useTourBookmarks(group, page = 1) {
  const [state, setState] = useState({ status: 'loading', items: [], currentPage: 1, totalPages: 0, hasNext: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    fetchTourBookmarks(group, { page }, { signal: controller.signal })
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

        console.error('여행지/여행 즐기기 북마크 목록을 불러오지 못했습니다.', error)
        setState(current => ({ ...current, status: 'error', items: [] }))
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [group, page, attempt])

  const retry = useCallback(() => {
    setState(current => ({ ...current, status: 'loading' }))
    setAttempt(value => value + 1)
  }, [])

  /*
   * 북마크 해제: 낙관적으로 목록에서 즉시 제거하고, 실패하면 원래 위치로 되돌린다(Q-8).
   * toggleTourBookmark은 토글 API라 이미 저장된 항목에 호출하면 해제가 된다.
   */
  const removeBookmark = useCallback(async item => {
    let removedIndex = -1

    setState(current => {
      const index = current.items.findIndex(entry => entry.bookmarkId === item.bookmarkId)
      if (index === -1) return current
      removedIndex = index
      return { ...current, items: current.items.filter(entry => entry.bookmarkId !== item.bookmarkId) }
    })

    if (removedIndex === -1) return

    try {
      await toggleTourBookmark(item)
    } catch (error) {
      console.error('북마크 해제에 실패했습니다.', error)
      setState(current => {
        const items = [...current.items]
        items.splice(removedIndex, 0, item)
        return { ...current, items }
      })
    }
  }, [])

  return { ...state, retry, removeBookmark }
}
