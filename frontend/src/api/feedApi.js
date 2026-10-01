import { apiClient } from './client'
import { getCourseDetailPath } from './courseApi'

/*
 * 피드(여행 SNS) 공개 API 모듈
 *
 * Design Ref: feed-integration.design.md §3.1~§3.2, §4.2, §4.4 — courseApi.js와 같은 원칙을 따른다.
 * 화면은 API 필드 이름을 모르고 view model(FeedPost, FeedTimelineResult, FeedProfile)만 쓴다.
 * fail-closed: 필수 필드가 없거나 형식이 다르면 성공으로 보지 않는다.
 *
 * 백엔드 필드명 주의사항(그대로 흡수하고 화면에는 정규화된 이름만 넘긴다):
 * - 응답의 위치 이름 필드는 `location`이다(요청 필드는 `locationName`이라 이름이 다르다).
 * - 응답의 콘텐츠 유형 필드는 `tourContetTypeId`로 철자가 틀려 있다(FeedPostResponse.java 원본 그대로).
 *   둘 다 이 파일에서만 흡수하고, 나머지 프론트 코드는 tourContentTypeId라는 정상 철자만 사용한다.
 *
 * Design Ref: tour-course-feed-linking.design.md §4.3, §5.3 — 응답의 `linkedCourse`는
 * courseId/dayNumber/stopName이 전부 있으면 "일자 또는 경유지 단위로 유효하게 참조 중",
 * 필드 자체가 null이면 "코스 미태그"다(설계 §5.2 — 참조 대상인 일자가 삭제되면 FK가
 * ON DELETE SET NULL로 linkedCourseDayId까지 null이 되고, 그러면 백엔드의
 * hasCourseLink()가 false가 되어 linkedCourse 전체가 내려오지 않는다). 경유지만 삭제된
 * 경우는 courseId/dayNumber는 남고 stopId/stopName만 null로 내려올 수 있다.
 */

const FEED_POSTS_PATH = '/api/v1/feed/posts'
const FEED_PROFILE_PATH = '/api/v1/feed/profile'

function toNonEmptyText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

function toNonNegativeInt(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0
}

/**
 * API 응답의 linkedCourse → courseTag view model (null이면 코스 미태그)
 *
 * Design Ref: tour-course-feed-linking.design.md §5.3 — courseId가 있으면 코스 상세로
 * 이동 가능한 링크(detailPath)를 함께 만든다. 방어적으로 courseId가 없는데 linkedCourse만
 * 있는(현재 백엔드 계약상 실제로는 발생하지 않는) 경우에도 courseTitle만으로 텍스트
 * 표시는 가능하도록 courseId만 null 처리한다(거짓 링크를 만들지 않기 위함).
 */
function toCourseTag(linkedCourse) {
  if (!linkedCourse || typeof linkedCourse !== 'object') return null

  const courseTitle = toNonEmptyText(linkedCourse.courseTitle)
  if (!courseTitle) return null

  const courseId = linkedCourse.courseId != null ? String(linkedCourse.courseId) : null

  return {
    courseId,
    courseTitle,
    dayNumber: Number.isInteger(linkedCourse.dayNumber) ? linkedCourse.dayNumber : null,
    stopName: toNonEmptyText(linkedCourse.stopName),
    detailPath: courseId ? getCourseDetailPath(courseId) : null,
  }
}

/**
 * API 응답(FeedPostResponse) → FeedPost view model
 *
 * fail-closed: id·author.id가 없으면 카드/상세를 만들지 않는다(작성자 없는 게시물은 의미가 없음).
 */
export function toFeedPost(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id == null) return null
  if (!item.author || item.author.id == null) return null

  return {
    id: String(item.id),
    author: {
      id: item.author.id,
      nickname: typeof item.author.nickname === 'string' ? item.author.nickname : '',
      profileImageUrl: toNonEmptyText(item.author.profileImageUrl),
    },
    content: typeof item.content === 'string' ? item.content : '',
    locationName: toNonEmptyText(item.location),
    address: toNonEmptyText(item.address),
    latitude: toFiniteNumber(item.latitude),
    longitude: toFiniteNumber(item.longitude),
    tourContentId: toNonEmptyText(item.tourContentId),
    // 응답 필드명 오타(tourContetTypeId)를 여기서만 흡수한다(위 모듈 설명 참고).
    tourContentTypeId: Number.isInteger(item.tourContetTypeId) ? item.tourContetTypeId : null,
    courseTag: toCourseTag(item.linkedCourse),
    images: Array.isArray(item.images) ? item.images.filter(url => typeof url === 'string') : [],
    tags: Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : [],
    likeCount: toNonNegativeInt(item.likeCount),
    commentCount: toNonNegativeInt(item.commentCount),
    liked: Boolean(item.liked),
    bookmarked: Boolean(item.bookmarked),
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : null,
    detailPath: `/feed/posts/${item.id}`,
  }
}

/**
 * API 응답(FeedTimelineResponse) → FeedTimelineResult
 *
 * { items: FeedPost[], nextCursor: string | null, hasNext: boolean }
 *
 * Design Ref: §3.2 — nextCursor는 의미를 해석하지 않고 다음 요청에 그대로 되돌려 보내는
 * opaque 값으로 다룬다(문자열로만 취급, 산술 연산 금지).
 */
export function toFeedTimelineResult(data) {
  if (!data || !Array.isArray(data.posts)) {
    throw new Error('피드 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    items: data.posts.map(toFeedPost).filter(Boolean),
    nextCursor: data.nextCursor == null ? null : String(data.nextCursor),
    hasNext: Boolean(data.hasNext),
  }
}

/**
 * 피드 타임라인 조회: GET /api/v1/feed/posts?cursor=&size=&linkedCourseId=
 *
 * cursor가 없으면 최신 게시물부터(첫 페이지), 있으면 그 id보다 오래된 게시물만 반환한다.
 * 비로그인 사용자도 호출 가능(공개 게시물만 반환).
 *
 * Design Ref: tour-course-feed-linking.design.md §4.4(D-4) — linkedCourseId를 지정하면
 * 그 코스를 참조한(일자·경유지 단위 무관) 게시물만 커서 페이지네이션으로 반환한다.
 * 신규 엔드포인트가 아니라 기존 타임라인 API에 선택 파라미터만 추가된 것이라, 이 함수
 * 하나로 메인 피드(파라미터 없음)와 코스 상세의 참조 피드 목록(파라미터 있음)을 모두 처리한다.
 */
export async function fetchFeedTimeline({ cursor, size = 10, linkedCourseId } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  if (cursor != null) params.set('cursor', String(cursor))
  params.set('size', String(size))
  if (linkedCourseId != null) params.set('linkedCourseId', String(linkedCourseId))

  const data = await apiClient.get(`${FEED_POSTS_PATH}?${params}`, { signal })
  return toFeedTimelineResult(data)
}

/**
 * 게시물 단건 조회: GET /api/v1/feed/posts/{id}
 *
 * 없는 글·소프트 삭제된 글·권한 없는 PRIVATE 글은 400으로 응답한다(백엔드 컨벤션).
 * useFeedDetail이 400/404를 not-found로 취급한다.
 */
export async function fetchFeedDetail(id, { signal } = {}) {
  const data = await apiClient.get(`${FEED_POSTS_PATH}/${encodeURIComponent(id)}`, { signal })
  const post = toFeedPost(data)
  if (!post) throw new Error('게시물 응답 형식이 올바르지 않습니다.')
  return post
}

/**
 * 게시물 작성: POST /api/v1/feed/posts (multipart/form-data)
 *
 * Design Ref: §6 — `post` 파트에 JSON(Blob)을, `images` 파트에 실제 순서대로 파일을 담는다.
 * 백엔드는 images 파트의 도착 순서를 그대로 sortOrder로 쓰므로(FeedService.create),
 * images 배열의 현재 순서가 곧 최종 사진 순서가 된다.
 *
 * @param values.images [{ file: File }] 순서대로 최대 5장
 */
export async function createFeedPost({
  content,
  locationName,
  address,
  latitude,
  longitude,
  tourContentId,
  tourContentTypeId,
  linkedCourseDayId,
  linkedCourseStopId,
  visibility,
  tags,
  images,
}) {
  const payload = {
    content,
    locationName: locationName || null,
    address: address || null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    tourContentId: tourContentId || null,
    tourContentTypeId: tourContentTypeId ?? null,
    // Design Ref: tour-course-feed-linking.design.md §4.1/D-2 — courseId와 스냅샷(코스명 등)은
    // 보내지 않는다. 서버(CourseLinkResolver)가 dayId→코스 체인을 따라가 직접 채운다.
    linkedCourseDayId: linkedCourseDayId ?? null,
    linkedCourseStopId: linkedCourseStopId ?? null,
    visibility: visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    tags: Array.isArray(tags) ? tags : [],
  }

  const formData = new FormData()
  // 서버가 "post" 파트를 JSON으로 파싱하므로 application/json 타입의 Blob으로 감싼다
  // (다른 관리자 멀티파트 API와 동일한 관례, client.js는 FormData 바디를 그대로 전달한다).
  formData.append('post', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  ;(images ?? []).forEach(image => formData.append('images', image.file))

  const data = await apiClient.post(FEED_POSTS_PATH, formData)
  const post = toFeedPost(data)
  if (!post) throw new Error('게시물 작성 응답 형식이 올바르지 않습니다.')
  return post
}

/**
 * 게시물 삭제(작성자 본인만): DELETE /api/v1/feed/posts/{id}
 */
export function deleteFeedPost(id) {
  return apiClient.delete(`${FEED_POSTS_PATH}/${encodeURIComponent(id)}`)
}

/**
 * 좋아요 토글: POST /api/v1/feed/posts/{id}/likes → { active: boolean }
 */
export async function toggleFeedLike(id) {
  const data = await apiClient.post(`${FEED_POSTS_PATH}/${encodeURIComponent(id)}/likes`)
  return Boolean(data?.active)
}

/**
 * 북마크 토글: POST /api/v1/feed/posts/{id}/bookmarks → { active: boolean }
 */
export async function toggleFeedBookmark(id) {
  const data = await apiClient.post(`${FEED_POSTS_PATH}/${encodeURIComponent(id)}/bookmarks`)
  return Boolean(data?.active)
}

/**
 * API 응답(FeedProfileResponse) → FeedProfile view model
 */
function toFeedProfile(data) {
  if (!data || typeof data.nickname !== 'string' || !Array.isArray(data.posts)) {
    throw new Error('프로필 응답 형식이 올바르지 않습니다.')
  }

  return {
    nickname: data.nickname,
    feedHandle: typeof data.feedHandle === 'string' ? data.feedHandle : '',
    profileImageUrl: toNonEmptyText(data.profileImageUrl),
    postCount: toNonNegativeInt(data.postCount),
    receiveLikeCount: toNonNegativeInt(data.receiveLikeCount),
    posts: data.posts.map(toFeedPost).filter(Boolean),
    currentPage: Number.isInteger(data.currentPage) && data.currentPage > 0 ? data.currentPage : 1,
    totalPages: toNonNegativeInt(data.totalPages),
    hasNext: Boolean(data.hasNext),
  }
}

/**
 * 타인 프로필 조회: GET /api/v1/feed/profile/{userId}?page=&size=
 *
 * Design Ref: §4.4(P-6) — 해당 사용자의 PUBLIC 게시물만 내려온다. liked/bookmarked는 항상 false.
 * 설계상 비로그인도 조회 가능한 공개 API다(백엔드 SecurityConfig에 permitAll 규칙이 아직 없다면
 * 401이 내려올 수 있다 — useFeedUserProfile이 이를 별도 상태로 구분해 처리한다).
 *
 * fetchFeedTimeline과 같은 모양으로 signal을 별도 세 번째 인자로 받는다(useFeedDetail/
 * useFeedInfiniteList와 동일하게 언마운트·페이지 전환 시 진행 중인 요청을 실제로 취소한다).
 */
export async function fetchFeedUserProfile(userId, { page = 1, size = 12 } = {}, { signal } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))

  const data = await apiClient.get(`${FEED_PROFILE_PATH}/${encodeURIComponent(userId)}?${params}`, { signal })
  return toFeedProfile(data)
}
