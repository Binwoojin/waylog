import { apiClient } from './client'

/*
 * 피드 댓글·답글 API 모듈
 *
 * Design Ref: feed-comment-integration.design.md §3.2~§3.3, §4.2 — feedApi.js와 같은 원칙
 * (fail-closed, view model 변환)을 따르되, 댓글은 게시물과 독립적으로 다뤄지는 리소스라
 * 별도 파일로 분리한다(설계 §2.2).
 */

function commentsPath(postId) {
  return `/api/v1/feed/posts/${encodeURIComponent(postId)}/comments`
}

/**
 * API 응답(FeedCommentResponse, 답글 포함) → FeedCommentThread view model
 *
 * fail-closed: id·author.id가 없는 댓글은 통째로 버린다(작성자 없는 댓글은 화면에 의미가 없음).
 * 답글은 서버가 항상 replies: []로 내려준다(1단계 제한, FeedCommentResponse.fromLeaf).
 */
export function toFeedComment(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id == null) return null
  if (!item.author || item.author.id == null) return null

  return {
    id: String(item.id),
    author: {
      id: item.author.id,
      nickname: typeof item.author.nickname === 'string' ? item.author.nickname : '',
      profileImageUrl:
        typeof item.author.profileImageUrl === 'string' && item.author.profileImageUrl.trim()
          ? item.author.profileImageUrl
          : null,
    },
    content: typeof item.content === 'string' ? item.content : '',
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : null,
    replies: Array.isArray(item.replies) ? item.replies.map(toFeedComment).filter(Boolean) : [],
  }
}

/**
 * API 응답(FeedCommentPageResponse) → FeedCommentPageResult
 *
 * { comments: FeedCommentThread[], currentPage: number, totalPages: number, hasNext: boolean }
 */
function toFeedCommentPageResult(data) {
  if (!data || !Array.isArray(data.comments)) {
    throw new Error('댓글 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    comments: data.comments.map(toFeedComment).filter(Boolean),
    currentPage: Number.isInteger(data.currentPage) && data.currentPage > 0 ? data.currentPage : 1,
    totalPages: Number.isInteger(data.totalPages) && data.totalPages >= 0 ? data.totalPages : 0,
    hasNext: Boolean(data.hasNext),
  }
}

/**
 * 최상위 댓글 페이지 조회(답글 포함): GET /api/v1/feed/posts/{postId}/comments?page=&size=
 *
 * 비로그인 사용자도 호출 가능(공개 게시물의 댓글은 누구나 조회할 수 있다, 설계 §4.4).
 */
export async function fetchFeedComments(postId, { page = 1, size = 20 } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))

  const data = await apiClient.get(`${commentsPath(postId)}?${params}`, { signal })
  return toFeedCommentPageResult(data)
}

/**
 * 댓글/답글 작성: POST /api/v1/feed/posts/{postId}/comments
 *
 * parentCommentId가 없으면 최상위 댓글, 있으면 그 댓글의 답글로 등록된다.
 * 답글의 답글을 시도하면 서버가 400(IllegalArgumentException → {message})으로 거부한다.
 */
export async function createFeedComment(postId, { content, parentCommentId } = {}) {
  const payload = { content, parentCommentId: parentCommentId ?? null }
  const data = await apiClient.post(commentsPath(postId), payload)
  const comment = toFeedComment(data)
  if (!comment) throw new Error('댓글 작성 응답 형식이 올바르지 않습니다.')
  return comment
}

/**
 * 댓글(또는 답글) 삭제(작성자 본인만, 하드 삭제): DELETE /api/v1/feed/posts/{postId}/comments/{commentId}
 *
 * 최상위 댓글을 삭제하면 그 답글도 서버에서 cascade로 함께 삭제된다(응답 본문 없음, 204).
 */
export function deleteFeedComment(postId, commentId) {
  return apiClient.delete(`${commentsPath(postId)}/${encodeURIComponent(commentId)}`)
}
