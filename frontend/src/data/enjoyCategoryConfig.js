import festivalCover from '../assets/enjoy/category-festival.png'
import leportsCover from '../assets/enjoy/category-leports.png'
import foodCover from '../assets/enjoy/category-food.png'
import shoppingCover from '../assets/enjoy/category-shopping.png'
import stayCover from '../assets/enjoy/category-stay.png'

/*
 * 즐기기 카테고리별 정적 화면 설정입니다.
 * 카테고리 목록(/enjoy/:category)의 제목·소개 문구·커버 이미지와 탭 목록에만 씁니다.
 * 카드 목록과 상세 내용은 TourAPI 실데이터에서 받으므로 여기에 콘텐츠를 두지 않습니다.
 */
export const enjoyConfigs = {
  festivals: { title: '축제 · 행사', icon: '🎉', cover: festivalCover, description: '계절마다 펼쳐지는 지역의 축제와 특별한 행사를 만나보세요.' },
  leports: { title: '레포츠', icon: '🚴', cover: leportsCover, description: '여행지의 자연을 온몸으로 경험하는 액티비티를 찾아보세요.' },
  food: { title: '음식점', icon: '🍽️', cover: foodCover, description: '지역의 재료와 이야기가 담긴 특별한 맛을 경험해 보세요.' },
  shopping: { title: '쇼핑', icon: '🛍️', cover: shoppingCover, description: '전통시장과 지역 특산품에서 여행의 기억을 담아보세요.' },
  stay: { title: '숙박', icon: '🛏️', cover: stayCover, description: '여행의 하루를 편안하게 마무리할 숙소를 확인해 보세요.' },
}

export const enjoyCategories = Object.entries(enjoyConfigs).map(([slug, config]) => ({ slug, ...config }))
