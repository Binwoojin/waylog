/*
 * 여행지 목록 문구
 *
 * Design Ref: §2.2, §5.1 — 카탈로그와 검색 결과가 같은 문구를 씁니다.
 * 컴포넌트 파일에서 상수를 함께 export하면 react-refresh/only-export-components 경고가 나므로 분리했습니다.
 */

export const LIST_LOADING_MESSAGE = '여행지를 불러오는 중입니다'

// variant별 안내. actionLabel은 기본값이며, 화면이 resetLabel로 바꿀 수 있습니다(검색 결과는 '조건 변경').
export const LIST_STATUS_MESSAGES = {
  'no-query': {
    title: '검색 조건을 선택해 주세요',
    description: '지역과 여행지 유형을 고르면 맞는 여행지를 찾아 드려요.',
    actionLabel: '조건 선택하기',
  },
  empty: {
    title: '조건에 맞는 여행지가 없어요',
    description: '지역이나 분류를 바꿔 보세요.',
    actionLabel: '조건 초기화',
  },
  invalid: {
    eyebrow: '오류',
    title: '검색 조건이 올바르지 않아요',
    description: '주소의 조건을 확인하거나 조건을 초기화해 주세요.',
    actionLabel: '조건 초기화',
  },
  error: {
    eyebrow: '오류',
    title: '여행지 목록을 불러오지 못했어요',
    description: '잠시 후 다시 시도해 주세요.',
    actionLabel: '다시 시도',
  },
}

export function formatTotalCount(totalCount) {
  return totalCount.toLocaleString('ko-KR')
}
