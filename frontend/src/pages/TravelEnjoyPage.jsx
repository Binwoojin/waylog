import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import EnjoySearchModal from '../components/search/EnjoySearchModal'
import festival from '../assets/enjoy/category-festival.png'
import leports from '../assets/enjoy/category-leports.png'
import food from '../assets/enjoy/category-food.png'
import shopping from '../assets/enjoy/category-shopping.png'
import stay from '../assets/enjoy/category-stay.png'
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
import record from '../assets/enjoy/record.png'
import './TravelEnjoyPage.css'

// TourAPI 콘텐츠 유형을 사용자가 이해하기 쉬운 즐길거리 분류로 표현한 데이터입니다.
const categories = [
  { slug:'festivals', image: festival, icon: '🎉', title: '축제 · 행사', text: '지금 열리는 다양한 지역 행사' },
  { slug:'leports', image: leports, icon: '🚴', title: '레포츠', text: '몸으로 즐기는 체험과 액티비티' },
  { slug:'food', image: food, icon: '🍽️', title: '음식점', text: '여행지에서 만나는 지역의 맛' },
  { slug:'shopping', image: shopping, icon: '🛍️', title: '쇼핑', text: '전통시장과 지역 특산품' },
  { slug:'stay', image: stay, icon: '🛏️', title: '숙박', text: '편안하게 머물 수 있는 공간' },
]

const weeklyNews = [
  { image: newsBusan, title: '부산 바다축제', date: '2025.05.10(토) ~ 2025.05.18(일)', location: '부산광역시 해운대구 해운대해수욕장' },
  { image: newsJeju, title: '제주 해녀축제', date: '2025.05.15(목) ~ 2025.05.18(일)', location: '제주특별자치도 제주시 구좌읍' },
  { image: newsSeoul, title: '서울 문화행사', date: '2025.05.20(화) ~ 2025.05.24(토)', location: '서울특별시 종로구 경복궁' },
]

const activityCards = [
  { image: hiking, title: '설악산 국립공원 트레킹', location: '강원특별자치도 속초시', description: '설악산의 아름다운 자연을 따라 걷는 트레킹 코스' },
  { image: kayak, title: '한강 카약 체험', location: '서울특별시 영등포구', description: '도심 속 한강에서 초보자도 즐길 수 있는 수상 체험' },
  { image: horse, title: '제주 승마 체험', location: '제주특별자치도 제주시', description: '제주의 넓은 초원과 자연 속에서 즐기는 승마 프로그램' },
  { image: surf, title: '양양 서핑 체험', location: '강원특별자치도 양양군', description: '동해의 시원한 파도와 함께하는 서핑 프로그램' },
]

const foodCards = [
  { image: bibimbap, title: '전주 비빔밥', location: '전북특별자치도 전주시', description: '알록달록한 제철 나물과 고추장이 어우러지는 전주의 대표 음식' },
  { image: foodMarket, title: '광장시장 먹거리 골목', location: '서울특별시 종로구', description: '빈대떡과 마약김밥 등 다양한 시장 먹거리를 만나는 곳' },
  { image: koreanFood, title: '통영 충무김밥', location: '경상남도 통영시', description: '담백한 김밥과 매콤한 오징어무침을 함께 즐기는 향토 음식' },
  { image: grill, title: '제주 흑돼지 거리', location: '제주특별자치도 제주시', description: '두툼하게 구운 제주 흑돼지의 풍미를 맛볼 수 있는 거리' },
]

const shoppingCards = [
  { image: market, title: '부산 국제시장', location: '부산광역시 중구', description: '먹거리와 생활 잡화가 가득한 부산 대표 전통시장' },
  { image: street, title: '서울 인사동 문화거리', location: '서울특별시 종로구', description: '전통 공예품과 갤러리, 찻집을 함께 둘러보는 문화 거리' },
  { image: souvenir, title: '제주 동문시장', location: '제주특별자치도 제주시', description: '감귤과 해산물, 제주 기념품을 한자리에서 만나는 시장' },
]

const stayCards = [
  { image: hanok, title: '경주 한옥 스테이', location: '경상북도 경주시', description: '고즈넉한 한옥에서 전통의 정취와 여유를 느끼는 숙소' },
  { image: hotel, title: '제주 오션 리조트', location: '제주특별자치도 서귀포시', description: '제주의 바다와 휴식을 함께 누릴 수 있는 리조트' },
  { image: room, title: '서울 도심 부티크 호텔', location: '서울특별시 중구', description: '주요 관광지와 가까워 편리하게 머물 수 있는 도심 숙소' },
  { image: resort, title: '강릉 바다 전망 호텔', location: '강원특별자치도 강릉시', description: '동해의 일출과 탁 트인 바다 전망을 감상할 수 있는 호텔' },
]

function SectionHeading({ title, description, link = '전체 보기', href = '#more' }) {
  // 페이지 내 모든 상세 링크 문구를 '더보기 →' 형태로 통일합니다.
  return <div className="enjoy-heading"><div><h2>{title}</h2><p>{description}</p></div>{link && (href.startsWith('#') ? <a href={href}>더보기 <span>→</span></a> : <Link to={href}>더보기 <span>→</span></Link>)}</div>
}

function InfoCards({ items, badge, category, columns = 4 }) {
  // 쇼핑 섹션만 columns=3을 전달하고 나머지는 기본 4열 레이아웃을 사용합니다.
  return <div className={`enjoy-info-grid${columns === 3 ? ' enjoy-info-grid--three' : ''}`}>{items.map((item,index) => <Link to={`/enjoy/${category}/${['seorak-hiking','hangang-kayak','jeju-horse','yangyang-surf','jeonju-bibimbap','gwangjang-food','tongyeong-kimbap','jeju-pork','busan-market','insadong','jeju-dongmun','gyeongju-hanok','jeju-resort','seoul-boutique','gangneung-hotel'][index + ({leports:0,food:4,shopping:8,stay:11}[category]||0)]}`} key={item.title}><article className="enjoy-info-card"><img src={item.image} alt={item.title} /><div><span className="enjoy-info-card__badge">{badge}</span><h3>{item.title}</h3><p className="enjoy-info-card__location"><PlacePinIcon />{item.location}</p><p>{item.description}</p></div></article></Link>)}</div>
}

export default function TravelEnjoyPage() {
  // 각 배열은 추후 백엔드 TourAPI 응답으로 대체하되 카드 마크업은 그대로 재사용할 수 있습니다.
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return <div className="travel-enjoy-page">
    <section className="enjoy-hero">
      <div className="enjoy-hero__inner">
        <div className="enjoy-hero__copy">
          <p className="enjoy-hero__eyebrow">WAYLOG EXPERIENCE</p>
          <h1>여행을 더 즐겁게</h1>
          <p>축제부터 맛집, 숙소까지 여행에 필요한 정보를 둘러보세요.</p>
          <button type="button" onClick={() => setIsSearchOpen(true)}>여행 즐길거리 검색</button>
          <small>지역과 콘텐츠 유형을 선택해 검색할 수 있어요.</small>
        </div>

        {/* 여행의 여러 순간을 사진 엽서처럼 겹쳐 표현한 Hero 콜라주입니다. */}
        <div className="enjoy-hero__collage" aria-label="축제, 레포츠, 음식, 쇼핑과 숙박 여행 이미지">
          <img className="enjoy-collage__photo enjoy-collage__photo--festival" src={festival} alt="야간 불꽃 축제" />
          <img className="enjoy-collage__photo enjoy-collage__photo--leports" src={leports} alt="바다에서 즐기는 레포츠" />
          <img className="enjoy-collage__photo enjoy-collage__photo--shopping" src={shopping} alt="여행지의 쇼핑 거리" />
          <img className="enjoy-collage__photo enjoy-collage__photo--stay" src={stay} alt="바다 전망 숙소" />
          <img className="enjoy-collage__photo enjoy-collage__photo--food" src={food} alt="여행지의 지역 음식" />
          <span className="enjoy-collage__icon enjoy-collage__icon--pin" aria-hidden="true">●</span>
          <span className="enjoy-collage__icon enjoy-collage__icon--camera" aria-hidden="true">▣</span>
          <span className="enjoy-collage__icon enjoy-collage__icon--ticket" aria-hidden="true">✦</span>
          <span className="enjoy-collage__route" aria-hidden="true" />
        </div>
      </div>
    </section>

    <main className="enjoy-main">
      <section><SectionHeading title="무엇을 즐기고 싶나요?" description="여행 중 필요한 정보를 카테고리별로 빠르게 확인해 보세요." link="" /><div className="enjoy-category-grid">{categories.map(item => <Link to={`/enjoy/${item.slug}`} key={item.title}><article><img src={item.image} alt="" /><div><h3>{item.title}</h3><p>{item.text}</p></div></article></Link>)}</div></section>

      <section><SectionHeading title="이번 주 여행 소식" description="현재 진행 중이거나 곧 시작하는 축제와 행사입니다." href="/enjoy/festivals" /><div className="enjoy-filter-row"><button className="is-active">전체</button><button>진행 중</button><button>이번 주 시작</button><button>곧 시작</button></div><div className="enjoy-news-grid">{weeklyNews.map((item,index) => <Link to={`/enjoy/festivals/${['busan-sea','jeju-haenyeo','seoul-culture'][index]}`} key={item.title}><article><img src={item.image} alt={item.title} /><div><h3>{item.title}</h3><p>◷ {item.date}</p><p className="location-with-pin"><PlacePinIcon />{item.location}</p></div></article></Link>)}</div><p className="enjoy-disclaimer">행사 일정은 현지 사정에 따라 변경될 수 있습니다.</p></section>

      <section className="enjoy-detail-section enjoy-detail-section--activity"><SectionHeading title="신나는 체험과 레포츠" description="몸으로 직접 즐기는 다양한 체험과 액티비티를 만나보세요." href="/enjoy/leports" /><InfoCards items={activityCards} badge="레포츠" category="leports" /></section>
      <section className="enjoy-detail-section enjoy-detail-section--food"><SectionHeading title="여행지에서 만나는 맛있는 순간" description="지역의 재료와 이야기가 담긴 특별한 맛을 경험해 보세요." href="/enjoy/food" /><InfoCards items={foodCards} badge="음식점" category="food" /></section>
      <section className="enjoy-detail-section"><SectionHeading title="여행지에서 즐기는 쇼핑" description="전통시장부터 지역 특산품까지 여행의 즐거움을 담아보세요." href="/enjoy/shopping" /><InfoCards items={shoppingCards} badge="쇼핑" category="shopping" columns={3} /></section>
      <section className="enjoy-detail-section enjoy-detail-section--stay"><SectionHeading title="여행의 하루를 마무리할 곳" description="지역별 숙박시설의 기본정보를 확인해 보세요." href="/enjoy/stay" /><InfoCards items={stayCards} badge="숙박" category="stay" /><p className="enjoy-disclaimer">실시간 객실 가격과 예약 가능 여부는 제공하지 않습니다.</p></section>

      <section className="enjoy-record"><img src={record} alt="여행 기록 일러스트" /><h2>여행의 순간을 기록하고, 함께 나눠요</h2><button type="button">여행 기록하기</button></section>
    </main>
    <EnjoySearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
  </div>
}
