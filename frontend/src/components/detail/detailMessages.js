// Design Ref: §5.1 — 해석 단계 not-found와 API 404가 같은 문구를 쓰도록 한곳에 둡니다.
// 컴포넌트 파일에서 상수를 함께 export하면 react-refresh/only-export-components 경고가 나므로 분리했습니다.
export const DETAIL_NOT_FOUND_TITLE = '콘텐츠를 찾을 수 없습니다'
export const DETAIL_NOT_FOUND_DESCRIPTION = '요청한 여행 정보가 없거나 삭제되었을 수 있습니다. 주소를 다시 확인해 주세요.'

// Design Ref: §5.2 — API 콘텐츠의 이용 안내(detailInfos)가 비었을 때 두 상세 화면이 함께 쓰는 문구입니다.
export const DETAIL_EMPTY_INFOS_MESSAGE = '상세 이용 정보가 없습니다. 방문 전 현지에 확인해 주세요.'

// Design Ref: §5.2 — API 콘텐츠의 소개(overview)가 비었을 때 두 상세 화면이 함께 쓰는 문구입니다.
export const DETAIL_EMPTY_DESCRIPTION_MESSAGE = '등록된 소개 정보가 없습니다.'

// 북마크 저장·해제 실패 안내. 롤백 후 버튼 근처에 짧게 보여 주고, 다음 토글 시작 시 지웁니다.
export const DETAIL_BOOKMARK_FAILED_MESSAGE = '북마크를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'

// 공유 결과 안내(링크 복사 성공·실패). 공유 시트를 닫은 취소에는 문구를 두지 않습니다.
export const DETAIL_SHARE_COPIED_MESSAGE = '링크를 복사했습니다.'
export const DETAIL_SHARE_FAILED_MESSAGE = '링크를 복사하지 못했습니다. 주소창의 주소를 직접 복사해 주세요.'
