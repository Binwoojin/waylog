import { useCallback, useEffect, useReducer, useRef } from 'react'
import { isAbortError } from '../api/client'
import { fetchFeedTimeline } from '../api/feedApi'

/*
 * 피드 타임라인 무한 스크롤 상태 훅
 *
 * Design Ref: feed-integration.design.md §7.1 — useTourList/useCourseList류(조건이 바뀌면
 * "교체"하는 렌더 중 파생 상태 머신)와 근본적으로 다르다. 이 훅은 "누적(append)" 모델이라
 * 별도 파일로 새로 설계했다.
 *
 * 경쟁 조건 방어: useTourList류는 "요청 key 비교로 늦게 온 응답을 무시"하지만, 이 훅은
 * loadingRef(동기 플래그)로 진행 중인 요청이 있으면 다음 트리거 자체를 시작하지 않는
 * "선제적 차단" 방식을 쓴다. 누적형 상태에서는 두 요청이 동시에 items를 append하면
 * 순서가 꼬일 수 있어,애초에 동시 요청을 허용하지 않는 편이 더 단순하고 안전하다.
 *
 * status: 'loading'(최초) | 'success' | 'error'(최초 실패) | 'loading-more' | 'error-more'(추가 실패, 기존 items 유지)
 */

const INITIAL_STATE = { items: [], nextCursor: null, hasNext: true, status: 'loading' }

function reducer(state, action) {
  switch (action.type) {
    case 'INIT_START':
      return { ...INITIAL_STATE, status: 'loading' }
    case 'INIT_SUCCESS':
      return { items: action.result.items, nextCursor: action.result.nextCursor, hasNext: action.result.hasNext, status: 'success' }
    case 'INIT_ERROR':
      return { ...INITIAL_STATE, status: 'error' }
    case 'MORE_START':
      return { ...state, status: 'loading-more' }
    case 'MORE_SUCCESS':
      return {
        items: [...state.items, ...action.result.items],
        nextCursor: action.result.nextCursor,
        hasNext: action.result.hasNext,
        status: 'success',
      }
    case 'MORE_ERROR':
      // 기존 items는 그대로 유지하고, 하단에 재시도만 보여준다(전체 화면 오류로 덮지 않는다).
      return { ...state, status: 'error-more' }
    case 'ADD_ITEM':
      // 방금 작성한 글을 맨 앞에 끼워 넣는다(재조회 없이 즉시 반영).
      return { ...state, items: [action.item, ...state.items] }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(item => item.id !== action.id) }
    case 'UPDATE_ITEM':
      return { ...state, items: state.items.map(item => (item.id === action.id ? { ...item, ...action.patch } : item)) }
    default:
      return state
  }
}

/**
 * linkedCourseId: 지정하면 그 코스를 참조한 게시물만 가져온다(tour-course-feed-linking
 * 설계 §4.4/D-4, §6.4 — 코스 상세의 "참조 피드" 섹션이 useCourseFeedPosts를 통해 이 훅을
 * 재사용한다). 생략하면 기존과 완전히 동일하게 전체 공개 타임라인을 가져온다 — 기존
 * 호출부(FeedPage)는 수정 없이 그대로 동작한다.
 */
export function useFeedInfiniteList(size = 10, { linkedCourseId } = {}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const loadingRef = useRef(false)
  const controllerRef = useRef(null)
  const cursorRef = useRef(null)

  const load = useCallback((cursor, isInitial) => {
    if (loadingRef.current) return
    loadingRef.current = true
    dispatch({ type: isInitial ? 'INIT_START' : 'MORE_START' })

    const controller = new AbortController()
    controllerRef.current = controller

    fetchFeedTimeline({ cursor, size, linkedCourseId }, { signal: controller.signal })
      .then(result => {
        // 취소된 구 요청의 성공 결과가 새 요청 상태(items/cursor)에 섞이지 않도록 가드합니다.
        if (controller.signal.aborted) return
        cursorRef.current = result.nextCursor
        dispatch({ type: isInitial ? 'INIT_SUCCESS' : 'MORE_SUCCESS', result })
      })
      .catch(error => {
        // 취소된 요청은 재발급 단계의 401 등 다른 ApiError로 실패할 수 있으므로, 에러 종류와 무관하게 취소 여부로 먼저 거릅니다.
        if (controller.signal.aborted || isAbortError(error)) return
        console.error('피드 타임라인을 불러오지 못했습니다.', error)
        dispatch({ type: isInitial ? 'INIT_ERROR' : 'MORE_ERROR' })
      })
      .finally(() => {
        // 취소된 이전 요청이 뒤늦게 끝나도 현재 요청의 진행 상태를 지우지 않도록 같은 요청일 때만 해제합니다.
        if (controllerRef.current === controller) loadingRef.current = false
      })
  }, [size, linkedCourseId])

  useEffect(() => {
    load(null, true)
    return () => {
      // StrictMode의 mount → cleanup → mount 중 두 번째 최초 로드가 취소된 첫 요청의 가드에 막히지 않도록 해제합니다.
      controllerRef.current?.abort()
      loadingRef.current = false
    }
    // 최초 1회만 실행합니다 — size와 linkedCourseId 모두 마운트 후에는 바뀌지 않는다는 전제입니다.
    // 바뀌는 사용례가 생기면 이 훅을 재마운트하는 호출부(FeedDetailPage의 key={id} 패턴 등)에서 처리해야 합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMore = useCallback(() => {
    if (!state.hasNext || loadingRef.current) return
    load(cursorRef.current, false)
  }, [load, state.hasNext])

  const retry = useCallback(() => load(null, true), [load])
  const retryMore = useCallback(() => load(cursorRef.current, false), [load])

  const addItem = useCallback(item => dispatch({ type: 'ADD_ITEM', item }), [])
  const removeItem = useCallback(id => dispatch({ type: 'REMOVE_ITEM', id }), [])
  const updateItem = useCallback((id, patch) => dispatch({ type: 'UPDATE_ITEM', id, patch }), [])

  return { ...state, loadMore, retry, retryMore, addItem, removeItem, updateItem }
}
