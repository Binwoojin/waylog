import { DESTINATION_CONTENT_TYPES } from './tourContentTypes'

/*
 * 여행지 목록 종류별 설정
 *
 * Design Ref: §3.4, 계획 대비 변경 P-3 — 카탈로그 탭, 검색 모달의 세부 항목, URL 검증(lib/tourListQuery)이
 * 모두 이 정의 하나를 읽습니다. /classifications API는 호출하지 않습니다.
 * URL 정규화는 첫 렌더에서 동기로 끝나야 하므로, 응답을 기다려야 하는 API 목록은 화이트리스트로 쓸 수 없습니다.
 *
 * 코드와 이름은 backend의 classification-codes.json, TourClassificationService(12: NA/HS/EX/VE, 14: VE06 ~ VE09)와 같습니다.
 * 즐기기 목록을 전환할 때 festivals: { contentTypeId: 15, ... }처럼 항목만 추가합니다.
 */
export const TOUR_LIST_CONFIGS = {
  attraction: {
    contentTypeId: DESTINATION_CONTENT_TYPES.attraction,
    // 관광지는 대분류로 거릅니다(D-3).
    categoryParam: 'lclsSystm1',
    // 순서 = 탭 순서. '전체'는 화면이 앞에 붙입니다.
    // label은 탭(짧게), fullLabel은 모달 세부 항목과 검색 결과 배너(API 분류명과 같게)에 씁니다.
    categories: [
      { code: 'NA', label: '자연', fullLabel: '자연관광' },
      { code: 'HS', label: '역사', fullLabel: '역사관광' },
      { code: 'EX', label: '체험', fullLabel: '체험관광' },
      { code: 'VE', label: '문화', fullLabel: '문화관광' },
    ],
    typeLabel: '관광지',
    breadcrumb: '관광지',
    title: '테마별 관광지',
    description: '관심 있는 테마를 선택하고 원하는 관광지를 둘러보세요.',
    path: '/destinations/attractions',
  },
  culture: {
    contentTypeId: DESTINATION_CONTENT_TYPES.culture,
    // 문화시설은 대분류가 모두 VE라 중분류로 거릅니다(D-3). 요청 시 대분류도 함께 보냅니다(§4.2).
    categoryParam: 'lclsSystm2',
    categories: [
      { code: 'VE06', label: '공연', fullLabel: '공연시설' },
      { code: 'VE07', label: '전시', fullLabel: '전시시설' },
      { code: 'VE08', label: '행사', fullLabel: '행사시설' },
      { code: 'VE09', label: '교육', fullLabel: '교육시설' },
    ],
    typeLabel: '문화시설',
    breadcrumb: '문화시설',
    title: '문화와 역사를 만나는 곳',
    description: '지역의 역사와 문화를 다양한 공간에서 만나보세요.',
    path: '/destinations/culture',
  },
}

// Design Ref: 계획 FR-07, Q-2 — 둘 다 "대표 이미지가 있는 항목만" 반환해 정렬을 바꿔도 totalCount가 같습니다.
// '지역순'은 실제로 적용되지 않는 정렬이라 제공하지 않습니다.
export const SORT_OPTIONS = [
  { value: 'Q', label: '최신순' },
  { value: 'O', label: '이름순' },
]

// 목록 종류 이름(attraction·culture) → 설정. 없는 이름('__proto__' 포함)은 null
export function getListConfig(kind) {
  return Object.hasOwn(TOUR_LIST_CONFIGS, kind) ? TOUR_LIST_CONFIGS[kind] : null
}

// contentTypeId(숫자 12·14 또는 문자열 '12'·'14') → 설정. 없으면 null
// Design Ref: §3.2 규칙 2 — Number()로 바꾸지 않고 문자열로 비교합니다('0xc', '12.0'이 12로 인정되지 않게).
export function getListConfigByContentType(contentTypeId) {
  if (contentTypeId == null) return null
  const typeId = String(contentTypeId)
  return Object.values(TOUR_LIST_CONFIGS).find(config => String(config.contentTypeId) === typeId) ?? null
}

// 설정의 분류 코드 → 분류 항목(label·fullLabel). 없으면 null
export function findListCategory(config, code) {
  if (!config || code == null) return null
  return config.categories.find(category => category.code === code) ?? null
}
