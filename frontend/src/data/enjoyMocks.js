import festivalCover from '../assets/enjoy/category-festival.png'
import leportsCover from '../assets/enjoy/category-leports.png'
import foodCover from '../assets/enjoy/category-food.png'
import shoppingCover from '../assets/enjoy/category-shopping.png'
import stayCover from '../assets/enjoy/category-stay.png'
import newsBusan from '../assets/enjoy/news-busan.png'
import newsJeju from '../assets/enjoy/news-jeju.png'
import newsSeoul from '../assets/enjoy/news-seoul.png'
import hiking from '../assets/enjoy/leports-hiking.jpg'
import kayak from '../assets/enjoy/leports-kayak.jpg'
import horse from '../assets/enjoy/leports-horse.jpg'
import surf from '../assets/enjoy/leports-surf.jpg'
import bibimbap from '../assets/enjoy/food-bibimbap.jpg'
import foodMarket from '../assets/enjoy/food-market.jpg'
import koreanFood from '../assets/enjoy/food-korean.jpg'
import grill from '../assets/enjoy/food-grill.jpg'
import market from '../assets/enjoy/shopping-market.jpg'
import street from '../assets/enjoy/shopping-street.jpg'
import souvenir from '../assets/enjoy/shopping-souvenir.jpg'
import hotel from '../assets/enjoy/stay-hotel.jpg'
import room from '../assets/enjoy/stay-room.jpg'
import resort from '../assets/enjoy/stay-resort.jpg'
import hanok from '../assets/enjoy/stay-hanok.jpg'

export const enjoyConfigs = {
  festivals: { title: '축제 · 행사', icon: '🎉', cover: festivalCover, description: '계절마다 펼쳐지는 지역의 축제와 특별한 행사를 만나보세요.', items: [
    { id:'busan-sea', image:newsBusan, title:'부산 바다축제', location:'부산광역시 해운대구', description:'부산의 여름 바다에서 공연과 체험을 함께 즐기는 대표 축제', meta:'2025.05.10 ~ 05.18' },
    { id:'jeju-haenyeo', image:newsJeju, title:'제주 해녀축제', location:'제주특별자치도 제주시', description:'제주 해녀 문화의 가치와 이야기를 만나는 지역 문화축제', meta:'2025.05.15 ~ 05.18' },
    { id:'seoul-culture', image:newsSeoul, title:'서울 문화행사', location:'서울특별시 종로구', description:'도심의 역사 공간에서 공연과 전시를 즐기는 문화행사', meta:'2025.05.20 ~ 05.24' },
  ]},
  leports: { title:'레포츠', icon:'🚴', cover:leportsCover, description:'여행지의 자연을 온몸으로 경험하는 액티비티를 찾아보세요.', items: [
    { id:'seorak-hiking', image:hiking, title:'설악산 국립공원 트레킹', location:'강원특별자치도 속초시', description:'설악산의 아름다운 자연을 따라 걷는 트레킹 코스', meta:'초급 · 3시간' },
    { id:'hangang-kayak', image:kayak, title:'한강 카약 체험', location:'서울특별시 영등포구', description:'도심 속 한강에서 초보자도 즐길 수 있는 수상 체험', meta:'예약 권장' },
    { id:'jeju-horse', image:horse, title:'제주 승마 체험', location:'제주특별자치도 제주시', description:'제주의 넓은 초원과 자연 속에서 즐기는 승마 프로그램', meta:'약 60분' },
    { id:'yangyang-surf', image:surf, title:'양양 서핑 체험', location:'강원특별자치도 양양군', description:'동해의 시원한 파도와 함께하는 서핑 프로그램', meta:'초보 가능' },
  ]},
  food: { title:'음식점', icon:'🍽️', cover:foodCover, description:'지역의 재료와 이야기가 담긴 특별한 맛을 경험해 보세요.', items: [
    { id:'jeonju-bibimbap', image:bibimbap, title:'전주 비빔밥', location:'전북특별자치도 전주시', description:'알록달록한 제철 나물과 고추장이 어우러지는 전주의 대표 음식', meta:'한식' },
    { id:'gwangjang-food', image:foodMarket, title:'광장시장 먹거리 골목', location:'서울특별시 종로구', description:'빈대떡과 김밥 등 다양한 시장 먹거리를 만나는 곳', meta:'시장 먹거리' },
    { id:'tongyeong-kimbap', image:koreanFood, title:'통영 충무김밥', location:'경상남도 통영시', description:'담백한 김밥과 매콤한 오징어무침을 함께 즐기는 향토 음식', meta:'향토 음식' },
    { id:'jeju-pork', image:grill, title:'제주 흑돼지 거리', location:'제주특별자치도 제주시', description:'두툼하게 구운 제주 흑돼지의 풍미를 맛볼 수 있는 거리', meta:'구이' },
  ]},
  shopping: { title:'쇼핑', icon:'🛍️', cover:shoppingCover, description:'전통시장과 지역 특산품에서 여행의 기억을 담아보세요.', items: [
    { id:'busan-market', image:market, title:'부산 국제시장', location:'부산광역시 중구', description:'먹거리와 생활 잡화가 가득한 부산 대표 전통시장', meta:'전통시장' },
    { id:'insadong', image:street, title:'서울 인사동 문화거리', location:'서울특별시 종로구', description:'전통 공예품과 갤러리, 찻집을 함께 둘러보는 문화 거리', meta:'문화거리' },
    { id:'jeju-dongmun', image:souvenir, title:'제주 동문시장', location:'제주특별자치도 제주시', description:'감귤과 해산물, 제주 기념품을 한자리에서 만나는 시장', meta:'전통시장' },
  ]},
  stay: { title:'숙박', icon:'🛏️', cover:stayCover, description:'여행의 하루를 편안하게 마무리할 숙소를 확인해 보세요.', items: [
    { id:'gyeongju-hanok', image:hanok, title:'경주 한옥 스테이', location:'경상북도 경주시', description:'고즈넉한 한옥에서 전통의 정취와 여유를 느끼는 숙소', meta:'한옥' },
    { id:'jeju-resort', image:hotel, title:'제주 오션 리조트', location:'제주특별자치도 서귀포시', description:'제주의 바다와 휴식을 함께 누릴 수 있는 리조트', meta:'리조트' },
    { id:'seoul-boutique', image:room, title:'서울 도심 부티크 호텔', location:'서울특별시 중구', description:'주요 관광지와 가까워 편리하게 머물 수 있는 도심 숙소', meta:'호텔' },
    { id:'gangneung-hotel', image:resort, title:'강릉 바다 전망 호텔', location:'강원특별자치도 강릉시', description:'동해의 일출과 탁 트인 바다 전망을 감상할 수 있는 호텔', meta:'호텔' },
  ]},
}

export const enjoyCategories = Object.entries(enjoyConfigs).map(([slug, config]) => ({ slug, ...config }))
export function findEnjoyItem(category, id) { return enjoyConfigs[category]?.items.find(item => item.id === id) }
