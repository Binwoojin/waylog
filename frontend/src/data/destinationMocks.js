import nature from '../assets/destinations/theme-nature.jpg'
import history from '../assets/destinations/theme-history.jpg'
import experience from '../assets/destinations/theme-experience.jpg'
import healing from '../assets/destinations/theme-healing.jpg'
import museum from '../assets/destinations/culture-museum.jpg'
import art from '../assets/destinations/culture-art.jpg'
import exhibition from '../assets/destinations/culture-exhibition.jpg'

// TourAPI 연동 전 화면 구성을 확인하기 위한 데이터입니다. API 응답을 같은 형태로 가공하면 UI를 그대로 사용할 수 있습니다.
export const destinationItems = [
  { id: 'bijarim', image: nature, title: '비자림', address: '제주특별자치도 제주시 구좌읍 비자숲길 55', description: '천년의 숲을 걸으며 다양한 식물과 새들을 관찰할 수 있는 천연기념물 숲', tag: '자연', meta: '연중무휴' },
  { id: 'gyeongbokgung', image: history, title: '경복궁', address: '서울특별시 종로구 사직로 161', description: '우리 역사와 건축의 아름다움을 만나는 조선 왕조의 대표 궁궐', tag: '역사', meta: '화요일 휴무' },
  { id: 'experience', image: experience, title: '한강 카약 체험', address: '서울특별시 영등포구 여의동로', description: '도심 속 강에서 즐기는 특별한 수상 체험', tag: '체험', meta: '예약 권장' },
  { id: 'healing', image: healing, title: '사려니숲길', address: '제주특별자치도 제주시 조천읍', description: '삼나무 숲이 이어지는 여유로운 치유 산책길', tag: '휴양', meta: '상시 개방' },
]

export const cultureItems = [
  { id: 'national-museum', image: museum, title: '국립중앙박물관', address: '서울특별시 용산구 서빙고로 137', description: '한국의 역사와 문화를 시대별로 만나는 대표 박물관', tag: '박물관', meta: '월요일 휴관' },
  { id: 'mmca', image: art, title: '국립현대미술관 서울', address: '서울특별시 종로구 삼청로 30', description: '다양한 현대미술 전시와 문화 프로그램을 만나는 공간', tag: '미술관', meta: '운영 중' },
  { id: 'film-museum', image: exhibition, title: '부산영화체험박물관', address: '부산광역시 중구 대청로126번길 12', description: '영화의 역사와 제작 과정을 직접 경험하는 전시 공간', tag: '전시관', meta: '월요일 휴관' },
]

// Design Ref: tour-course-list-integration.design.md §6.2 — 여행코스 목업(courseItems)은 실제 공개 API로
// 전환되어 제거했습니다. /destinations/courses는 이제 TourCourseCatalogPage(실제 API)를 씁니다.
export const allDestinationMocks = [...destinationItems, ...cultureItems]
