import { useCallback, useEffect, useReducer, useRef } from 'react'
import { isAbortError } from '../api/client'
import { fetchFeedComments } from '../api/feedCommentApi'

/*
 * 게시물 상세 댓글 목록 상태 훅
 *
 * Design Ref: feed-comment-integration.design.md §5 — useFeedInfiniteList(IntersectionObserver
 * 자동 트리거, 커서 누적)도 useFeedDetail(단일 객체 교체)도 아닌 세 번째 상태 모양이다:
 * 페이지 번호 기반으로 누적하되, 트리거는 "더 보기" 버튼 클릭이다(무한 스크롤 아님, P-11).
 *
 * Q-4(낙관적 업데이트 미적용): addComment/removeComment는 호출하는 쪽(CommentSection)이
 * 작성·삭제 API 요청이 성공적으로 끝난 뒤에만 호출한다. 이 훅 자체는 실패 시 롤백 로직을
 * 갖지 않는다 — 애초에 성공하기 전에는 상태를 바꾸지 않기 때문이다.
 *
 * status: 'loading'(최초) | 'success' | 'error'(최초 실패)
 * loadMoreStatus: 'idle' | 'loading' | 'error'
 */

const INITIAL_STATE = {
  comments: [],
  currentPage: 0,
  totalPages: 0,
  hasNext: false,
  status: 'loading',
  loadMoreStatus: 'idle',
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT_START':
      return { ...INITIAL_STATE, status: 'loading' }
    case 'INIT_SUCCESS':
      return {
        ...state,
        comments: action.result.comments,
        currentPage: action.result.currentPage,
        totalPages: action.result.totalPages,
        hasNext: action.result.hasNext,
        status: 'success',
        loadMoreStatus: 'idle',
      }
    case 'INIT_ERROR':
      return { ...INITIAL_STATE, status: 'error' }
    case 'MORE_START':
      return { ...state, loadMoreStatus: 'loading' }
    case 'MORE_SUCCESS':
      // 정렬이 createdAt ASC라 다음 페이지를 그대로 뒤에 이어붙이면 순서가 유지된다.
      return {
        ...state,
        comments: [...state.comments, ...action.result.comments],
        currentPage: action.result.currentPage,
        totalPages: action.result.totalPages,
        hasNext: action.result.hasNext,
        loadMoreStatus: 'idle',
      }
    case 'MORE_ERROR':
      // 기존 comments는 그대로 유지하고, "더 보기" 버튼 아래 재시도만 보여준다(전체를 오류로 덮지 않는다).
      return { ...state, loadMoreStatus: 'error' }
    case 'ADD_COMMENT':
      if (action.parentId == null) {
        // 최상위 댓글: 방금 작성한 댓글은 항상 전체에서 가장 최근이므로, 아직 안 불러온
        // 다음 페이지가 있어도 이미 불러온 목록의 맨 끝에 붙이면 항상 올바른 위치가 된다.
        return { ...state, comments: [...state.comments, action.comment] }
      }
      // 답글: 해당 최상위 댓글을 찾아 그 replies 끝에 추가한다.
      return {
        ...state,
        comments: state.comments.map(comment =>
          comment.id === action.parentId ? { ...comment, replies: [...comment.replies, action.comment] } : comment
        ),
      }
    case 'REMOVE_COMMENT':
      if (action.parentId == null) {
        // 최상위 댓글 삭제: 서버가 답글도 cascade로 함께 지웠으므로 통째로 제거한다.
        return { ...state, comments: state.comments.filter(comment => comment.id !== action.commentId) }
      }
      return {
        ...state,
        comments: state.comments.map(comment =>
          comment.id === action.parentId
            ? { ...comment, replies: comment.replies.filter(reply => reply.id !== action.commentId) }
            : comment
        ),
      }
    default:
      return state
  }
}

export function useFeedComments(postId, size = 20) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const loadingRef = useRef(false)
  const controllerRef = useRef(null)
  const pageRef = useRef(0)

  const load = useCallback((page, isInitial) => {
    if (loadingRef.current) return
    loadingRef.current = true
    dispatch({ type: isInitial ? 'INIT_START' : 'MORE_START' })

    const controller = new AbortController()
    controllerRef.current = controller

    fetchFeedComments(postId, { page, size }, { signal: controller.signal })
      .then(result => {
        // 취소된 구 요청의 성공 결과가 새 요청 상태(comments/page)에 섞이지 않도록 가드합니다.
        if (controller.signal.aborted) return
        pageRef.current = result.currentPage
        dispatch({ type: isInitial ? 'INIT_SUCCESS' : 'MORE_SUCCESS', result })
      })
      .catch(error => {
        // 취소된 요청은 재발급 단계의 401 등 다른 ApiError로 실패할 수 있으므로, 에러 종류와 무관하게 취소 여부로 먼저 거릅니다.
        if (controller.signal.aborted || isAbortError(error)) return
        console.error('댓글을 불러오지 못했습니다.', error)
        dispatch({ type: isInitial ? 'INIT_ERROR' : 'MORE_ERROR' })
      })
      .finally(() => {
        // 취소된 이전 요청이 뒤늦게 끝나도 현재 요청의 진행 상태를 지우지 않도록 같은 요청일 때만 해제합니다.
        if (controllerRef.current === controller) loadingRef.current = false
      })
  }, [postId, size])

  useEffect(() => {
    load(1, true)
    return () => {
      // StrictMode는 effect를 mount → cleanup → mount로 한 번 더 실행합니다. 취소된 첫 요청의 finally는
      // 두 번째 mount보다 늦게 실행되므로, 여기서 가드를 풀지 않으면 두 번째 최초 로드가 막혀 "불러오는 중"이 남습니다.
      controllerRef.current?.abort()
      loadingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- postId가 바뀌면 부모가 key로 재마운트한다(useFeedDetail과 동일 관례).
  }, [])

  const loadMore = useCallback(() => {
    if (!state.hasNext || loadingRef.current) return
    load(pageRef.current + 1, false)
  }, [load, state.hasNext])

  const retry = useCallback(() => load(1, true), [load])
  const retryMore = useCallback(() => load(pageRef.current + 1, false), [load])

  const addComment = useCallback((comment, parentId = null) => {
    dispatch({ type: 'ADD_COMMENT', comment, parentId })
  }, [])

  const removeComment = useCallback((commentId, parentId = null) => {
    dispatch({ type: 'REMOVE_COMMENT', commentId, parentId })
  }, [])

  return { ...state, loadMore, retry, retryMore, addComment, removeComment }
}
