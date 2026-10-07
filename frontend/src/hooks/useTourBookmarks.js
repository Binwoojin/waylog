import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbortError } from '../api/client'
import { fetchTourBookmarks, toggleTourBookmark } from '../api/tourBookmarkApi'
import { useAuth } from '../context/AuthContext'

/*
 * 여행지/여행 즐기기 북마크 탭 상태 훅 (/bookmarks)
 *
 * Design Ref: mypage-bookmarks.design.md §2.2, §6.2 — group별('DESTINATION' | 'ENJOY')로
 * 독립된 인스턴스를 만들어 쓴다(탭마다 완전히 분리된 하위 컴포넌트+훅, 상태 공유 없음).
 * 해제는 Q-8 결정대로 즉시 제거(Undo 없음) + 실패 시 롤백한다.
 *
 * status: 'loading' | 'success' | 'login-required' | 'error'
 */
const LOADING_VIEW = { status: 'loading', items: [], currentPage: 1, totalPages: 0, hasNext: false }

export function useTourBookmarks(group, page = 1) {
  // ownerId: 이 목록을 받아 온 회원(memberId, 비로그인은 null). 현재 회원과 다르면 이전 사용자의 목록이므로 버리고 로딩으로 보입니다.
  const [state, setState] = useState({ ownerId: undefined, ...LOADING_VIEW })
  const [attempt, setAttempt] = useState(0)

  const { isRestoring, memberId } = useAuth()
  const view = state.ownerId === memberId ? state : LOADING_VIEW

  useEffect(() => {
    // 인증 복원(AuthContext.isRestoring)이 끝나기 전에 보내면 Authorization 없이 나가 401을 받습니다.
    // 복원이 끝난 뒤에만 요청해 토큰이 실린 요청 한 번으로 결과를 받습니다.
    if (isRestoring) return undefined

    let isActive = true
    const controller = new AbortController()

    fetchTourBookmarks(group, { page }, { signal: controller.signal })
      .then(result => {
        if (isActive) setState({ ownerId: memberId, status: 'success', ...result })
      })
      .catch(error => {
        if (!isActive) return
        if (isAbortError(error)) return

        if (error instanceof ApiError && error.status === 401) {
          setState(current => ({ ...current, ownerId: memberId, status: 'login-required', items: [] }))
          return
        }

        console.error('여행지/여행 즐기기 북마크 목록을 불러오지 못했습니다.', error)
        setState(current => ({ ...current, ownerId: memberId, status: 'error', items: [] }))
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [group, page, attempt, isRestoring, memberId])

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

  return { ...view, retry, removeBookmark }
}
