import { apiClient } from './client'
import { getTourDetailPath } from '../data/tourContentTypes'

/*
 * 여행지/여행 즐기기 북마크 API 모듈
 *
 * Design Ref: mypage-bookmarks.design.md §4.6(Q-5, Q-6) — 백엔드(`tour.bookmark` 패키지)는
 * 이미 완성돼 있었고 이번 사이클에서 프론트가 처음으로 연결한다. feedApi.js와 같은 원칙
 * (view model만 노출, 백엔드 필드명 차이는 이 파일이 흡수)을 따른다.
 *
 * GET /api/v1/tour-bookmarks는 Spring Data Page<T> 직렬화(content/totalPages/last 등)를
 * 그대로 내려준다 — 다른 피드 API들의 커스텀 레코드 응답과 필드명이 다르므로 여기서만 흡수한다.
 */

const TOUR_BOOKMARKS_PATH = '/api/v1/tour-bookmarks'

function toNonEmptyText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * API 응답(TourBookmarkResponse) → 북마크 view model
 *
 * fail-closed: bookmarkId·contentId가 없으면 카드를 만들지 않는다(해제 버튼이 식별할 대상이 없음).
 */
function toTourBookmark(item) {
  if (!item || item.bookmarkId == null || item.contentId == null) return null

  const contentId = String(item.contentId)
  const contentTypeId = Number.isInteger(item.contentTypeId) ? item.contentTypeId : null

  return {
    bookmarkId: String(item.bookmarkId),
    contentId,
    contentTypeId,
    title: toNonEmptyText(item.title) ?? '',
    imageUrl: toNonEmptyText(item.imageUrl),
    address: toNonEmptyText(item.address),
    categoryName: toNonEmptyText(item.categoryName),
    categoryGroup: item.categoryGroup === 'DESTINATION' || item.categoryGroup === 'ENJOY' ? item.categoryGroup : null,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : null,
    detailPath: contentTypeId != null ? getTourDetailPath(contentId, contentTypeId) : null,
  }
}

/**
 * 내 여행지/여행 즐기기 북마크 목록 조회: GET /api/v1/tour-bookmarks?group=&page=&size=
 *
 * @param group 'DESTINATION' | 'ENJOY'
 */
export async function fetchTourBookmarks(group, { page = 1, size = 9 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ group, page: String(page), size: String(size) })
  const data = await apiClient.get(`${TOUR_BOOKMARKS_PATH}?${params}`, { signal })

  if (!data || !Array.isArray(data.content)) {
    throw new Error('북마크 응답 형식이 올바르지 않습니다.')
  }

  return {
    items: data.content.map(toTourBookmark).filter(Boolean),
    currentPage: page,
    totalPages: Number.isInteger(data.totalPages) && data.totalPages >= 0 ? data.totalPages : 0,
    hasNext: !data.last,
  }
}

/**
 * 북마크 토글(저장/해제 공용): POST /api/v1/tour-bookmarks/toggle → { active: boolean, bookmarkId }
 *
 * Design Ref: §7.1 — 상세·목록 화면의 "저장" 버튼과 북마크 화면의 "해제" 버튼이 모두 이 함수 하나를 쓴다
 * (토글 API라 "해제"도 같은 호출이다).
 *
 * 주의: 백엔드 TourBookmarkToggleResponse는 `active` 필드로 토글 결과를 내려준다(`saved`가 아님).
 * feedApi.js의 toggleFeedLike/toggleFeedBookmark와 동일한 응답 형태이니 필드명을 반드시 맞출 것.
 */
export async function toggleTourBookmark({ contentId, contentTypeId, title, imageUrl, address, categoryName }) {
  const data = await apiClient.post(`${TOUR_BOOKMARKS_PATH}/toggle`, {
    contentId: String(contentId),
    contentTypeId,
    title,
    imageUrl: imageUrl || null,
    address: address || null,
    categoryName: categoryName || null,
  })
  return Boolean(data?.active)
}
