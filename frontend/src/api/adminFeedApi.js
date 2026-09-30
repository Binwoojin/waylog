import { apiClient } from './client'

/*
 * 관리자 피드 API 모듈
 *
 * Design Ref: admin-dashboard.design.md §3.4, §4.1 — 다른 admin API 모듈과 같은 원칙(화면은 API
 * 필드 이름을 모르게 view model로 바꿔 받는다).
 *
 * 목록 페이지 번호는 공지·회원과 달리 이미 1부터 시작한다(FeedAdminController.list,
 * FeedController.getFeed와 같은 관례). 0-based 변환이 필요 없다.
 * 목록 응답도 board.dto.PageResponse가 아니라 { items, page, size, totalCount } 모양이라
 * totalPages를 직접 계산한다(fetchTourList의 toTourList와 같은 방식).
 */

const ADMIN_FEED_PATH = '/api/v1/admin/feed/posts'

function toFeedSummary(item) {
  return {
    id: item?.id,
    authorId: item?.authorId,
    authorNickname: typeof item?.authorNickname === 'string' ? item.authorNickname : '',
    contentPreview: typeof item?.contentPreview === 'string' ? item.contentPreview : '',
    imageCount: Number.isInteger(item?.imageCount) ? item.imageCount : 0,
    likeCount: Number.isInteger(item?.likeCount) ? item.likeCount : 0,
    commentCount: Number.isInteger(item?.commentCount) ? item.commentCount : 0,
    createdAt: item?.createdAt ?? null,
    // Design Ref: §3.4.4 — status는 deletedAt 유무로 서버가 계산해 내려준다(UserAdminResponse.suspended와 같은 원칙).
    status: item?.status === 'SOFT_DELETED' ? 'SOFT_DELETED' : 'ACTIVE',
    deletedAt: item?.deletedAt ?? null,
    deleteReason: typeof item?.deleteReason === 'string' ? item.deleteReason : '',
  }
}

/**
 * 관리자 피드 목록 조회: GET /api/v1/admin/feed/posts?page=&size=
 *
 * 삭제된 게시물도 포함해서 내려온다(공개 목록과 달리 deletedAt 필터가 없음, FeedAdminService.list).
 */
export async function fetchAdminFeedList({ page = 1, size = 20 } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))

  const data = await apiClient.get(`${ADMIN_FEED_PATH}?${params}`, { signal })

  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.totalCount)) {
    throw new Error('피드 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    items: data.items.map(toFeedSummary),
    page,
    totalPages: data.totalCount === 0 ? 0 : Math.ceil(data.totalCount / size),
    totalCount: data.totalCount,
  }
}

function toFeedDetail(data) {
  if (!data || typeof data.content !== 'string') {
    throw new Error('피드 상세 응답 형식이 올바르지 않습니다.')
  }

  return {
    id: data.id,
    authorId: data.authorId,
    authorNickname: typeof data.authorNickname === 'string' ? data.authorNickname : '',
    content: data.content,
    locationName: typeof data.locationName === 'string' ? data.locationName : '',
    address: typeof data.address === 'string' ? data.address : '',
    images: Array.isArray(data.images) ? data.images.filter(url => typeof url === 'string') : [],
    tags: Array.isArray(data.tags) ? data.tags.filter(tag => typeof tag === 'string') : [],
    likeCount: data.likeCount,
    commentCount: data.commentCount,
    status: data.status === 'SOFT_DELETED' ? 'SOFT_DELETED' : 'ACTIVE',
    deletedAt: data.deletedAt ?? null,
    deleteReason: typeof data.deleteReason === 'string' ? data.deleteReason : '',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/**
 * 관리자 피드 상세 조회: GET /api/v1/admin/feed/posts/{id}
 *
 * 없는 id는 다른 관리자 조회 API와 같은 컨벤션으로 400을 던진다(FeedAdminService.findAnyPost).
 * 상세 화면은 이 400을 not-found로 취급한다(hooks/useAdminFeedDetail.js).
 */
export async function fetchAdminFeedDetail(id) {
  const data = await apiClient.get(`${ADMIN_FEED_PATH}/${encodeURIComponent(id)}`)
  return toFeedDetail(data)
}

/**
 * 관리자 삭제: DELETE /api/v1/admin/feed/posts/{id}
 *
 * type: 'NORMAL'(소프트 삭제) | 'POLICY_VIOLATION'(하드 삭제, suspendAuthor 옵션으로 회원 정지 연동).
 * 204 No Content로 응답한다(client.js가 빈 객체로 처리).
 */
export function deleteAdminFeedPost(id, { type, reason, suspendAuthor, suspensionDays }) {
  const body = { type, reason }
  if (suspendAuthor) {
    body.suspendAuthor = true
    body.suspensionDays = suspensionDays
  }
  return apiClient.delete(`${ADMIN_FEED_PATH}/${encodeURIComponent(id)}`, { body })
}
