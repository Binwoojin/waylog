import { apiClient } from './client'

/*
 * 공개 공지사항 API 모듈
 *
 * 홈 공지 미리보기처럼 인증이 필요 없는 화면이 쓰는 목록 조회만 둡니다. 관리자 모듈(adminNoticeApi.js)은
 * 생성·수정·삭제까지 가진 인증 화면용이라, 공개 화면이 그 모듈에 의존하지 않도록 따로 둡니다(courseApi.js와 같은 원칙).
 * 변환 규칙은 관리자 모듈과 같지만, 공개 화면이 쓰는 필드만 담습니다.
 */

const NOTICE_LIST_PATH = '/api/v1/notices'

function toNoticeItem(item) {
  return {
    id: item?.id ?? null,
    title: typeof item?.title === 'string' ? item.title : '',
    createdAt: item?.createdAt ?? null,
  }
}

/**
 * 공지 목록 조회: GET /api/v1/notices?page=&size=
 *
 * page는 화면 기준(1부터 시작)입니다. 백엔드는 0부터 시작하는 page를 받으므로 요청할 때만 1을 뺍니다.
 *
 * 성공: { items: NoticeItem[], page, totalPages, totalElements }
 * 실패: ApiError, 형식이 다른 응답이면 Error, 취소되면 AbortError(DOMException)
 */
export async function fetchNoticeList({ page = 1, size = 10 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(Math.max(0, page - 1)), size: String(size) })
  const data = await apiClient.get(`${NOTICE_LIST_PATH}?${params}`, { signal })

  // client.js는 JSON이 아닌 200 응답을 {}로 돌려주므로, 형식이 맞지 않으면 성공으로 보지 않습니다(fail-closed).
  if (!data || !Array.isArray(data.content) || !Number.isInteger(data.totalElements)) {
    throw new Error('공지 목록 응답 형식이 올바르지 않습니다.')
  }

  return {
    // id가 없는 항목은 목록 key와 이동 경로를 만들 수 없으므로 버립니다.
    items: data.content.map(toNoticeItem).filter(item => item.id != null),
    // 응답의 page(0-based)가 아니라 요청한 화면 기준 page를 돌려줍니다.
    page,
    totalPages: Number.isInteger(data.totalPages) ? data.totalPages : 0,
    totalElements: data.totalElements,
  }
}
