import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import TravelSearchModal from '../components/search/TravelSearchModal'
import { travelTypes } from '../data/travelTypes'
import hero from '../assets/destinations/hero-illustration.png'
import seoul from '../assets/destinations/region-seoul.png'
import gyeonggi from '../assets/destinations/region-gyeonggi.png'
import gangwon from '../assets/destinations/region-gangwon.png'
import chungcheong from '../assets/destinations/region-chungcheong.png'
import jeolla from '../assets/destinations/region-jeolla.png'
import gyeongsang from '../assets/destinations/region-gyeongsang.png'
import busan from '../assets/destinations/region-busan.png'
import jeju from '../assets/destinations/region-jeju.png'
import attraction from '../assets/destinations/type-attraction.jpg'
import cultureType from '../assets/destinations/type-culture.jpg'
import courseType from '../assets/destinations/type-course.jpg'
import nature from '../assets/destinations/theme-nature.jpg'
import history from '../assets/destinations/theme-history.jpg'
import experience from '../assets/destinations/theme-experience.jpg'
import healing from '../assets/destinations/theme-healing.jpg'
import museum from '../assets/destinations/culture-museum.jpg'
import art from '../assets/destinations/culture-art.jpg'
import exhibition from '../assets/destinations/culture-exhibition.jpg'
import courseDaejeon from '../assets/destinations/course-daejeon.png'
import courseBusan from '../assets/destinations/course-busan.png'
import courseJeju from '../assets/destinations/course-jeju.png'
import route from '../assets/destinations/route.svg'
import danyang from '../assets/destinations/new-danyang.jpg'
import daegu from '../assets/destinations/new-daegu.jpg'
import ulleung from '../assets/destinations/new-ulleung.jpg'
import woljeongsa from '../assets/destinations/new-woljeongsa.jpg'
import './DestinationsPage.css'

// 공통 여행 유형에 이 페이지에서만 사용하는 대표 이미지를 연결합니다.
const travelTypeImages = { attraction, culture: cultureType, course: courseType }
const travelTypeLinks = { attraction: '/destinations/attractions', culture: '/destinations/culture', course: '/destinations/courses' }

// 지역 코드는 백엔드 TourAPI areaCode 응답과 연결할 예정입니다.
const regions = [
  { image: seoul, title: '서울' }, { image: gyeonggi, title: '경기·인천' },
  { image: gangwon, title: '강원' }, { image: chungcheong, title: '충청' },
  { image: jeolla, title: '전라도' }, { image: gyeongsang, title: '경상도' },
  { image: busan, title: '부산' }, { image: jeju, title: '제주' },
]

const themes = [
  { image: nature, tag: '자연관광지', title: '자연 속 여행', location: '국립공원 · 해변 · 숲길', text: '산과 바다, 숲이 전하는 계절의 풍경을 만나보세요.' },
  { image: history, tag: '역사관광지', title: '역사를 걷는 여행', location: '궁궐 · 사찰 · 유적지', text: '시간이 쌓인 장소에서 우리 문화의 이야기를 발견해 보세요.' },
  { image: experience, tag: '체험관광지', title: '직접 즐기는 여행', location: '수상레포츠 · 농촌체험', text: '보고 듣는 것을 넘어 몸으로 기억하는 여행을 즐겨보세요.' },
  { image: healing, tag: '휴양관광지', title: '쉼이 있는 여행', location: '수목원 · 휴양림 · 산책로', text: '일상의 속도를 잠시 늦추고 자연 속에서 쉬어가세요.' },
]

const culturePlaces = [
  { image: museum, title: '국립중앙박물관', location: '서울특별시 용산구', text: '한국의 역사와 문화를 시대별로 살펴볼 수 있는 대표 박물관입니다.' },
  { image: art, title: '국립현대미술관 서울', location: '서울특별시 종로구', text: '다양한 현대미술 전시와 문화 프로그램을 만날 수 있습니다.' },
  { image: exhibition, title: '부산영화체험박물관', location: '부산광역시 중구', text: '영화의 역사와 제작 과정을 직접 체험할 수 있는 박물관입니다.' },
]

const courses = [
  { image: courseDaejeon, region: '대전', duration: '당일치기', title: '대전 인기 빵집 코스', text: '성심당부터 구움 과자 맛집까지 이어지는 달콤한 빵집 투어', stops: ['성심당 본점', '정동문화사', '몽심', '하레하레'] },
  { image: courseBusan, region: '부산', duration: '1박 2일', title: '부산 바다 & 야경 코스', text: '낮에는 해운대 바다를 걷고 밤에는 광안대교의 야경을 만나요.', stops: ['해운대', '동백섬', '민락더마켓', '광안리'] },
  { image: courseJeju, region: '제주', duration: '2박 3일', title: '제주 자연 힐링 코스', text: '제주의 깊은 숲과 오름, 푸른 해안을 천천히 만나는 여행', stops: ['비자림', '성산일출봉', '섭지코지', '사려니숲길'] },
]

const newPlaces = [
  { image: danyang, tag: '자연관광지', title: '단양 만천하스카이워크', location: '충청북도 단양군' },
  { image: daegu, tag: '문화시설', title: '국립대구과학관', location: '대구광역시 달성군' },
  { image: ulleung, tag: '자연관광지', title: '울릉도 · 독도', location: '경상북도 울릉군' },
  { image: woljeongsa, tag: '역사관광지', title: '월정사', location: '강원특별자치도 평창군' },
]

function SectionHeading({ title, description, link }) {
  // link 값이 있는 섹션에만 공통 '더보기 →' 링크를 노출합니다.
  return <div className="destination-heading"><div><h2>{title}</h2><p>{description}</p></div>{link && <a href="#more">더보기 <span>→</span></a>}</div>
}

export default function DestinationsPage() {
  // Hero의 검색 버튼으로 공용 여행 검색 모달을 열고 닫습니다.
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return <div className="destinations-page">
    <section className="destination-hero"><div className="destination-hero__inner"><div><p className="destination-hero__eyebrow">WAYLOG DESTINATION</p><h1>어디로 떠나볼까요?</h1><p>지역과 취향에 맞는 국내 여행지를 발견해 보세요.</p><button type="button" onClick={() => setIsSearchOpen(true)}>여행지 검색하기</button><small>지역 · 여행 유형 · 여행 조건을 선택해 검색할 수 있어요.</small></div><img src={hero} alt="국내 여행지 사진 일러스트" /></div></section>

    <main className="destination-main">
      <section><SectionHeading title="어떤 여행지를 찾고 있나요?" description="관광지부터 문화시설, 여행코스까지 원하는 방식으로 둘러보세요." /><div className="destination-type-grid">{travelTypes.map(item => <Link to={travelTypeLinks[item.id]} key={item.id}><article><img src={travelTypeImages[item.id]} alt="" /><span aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></article></Link>)}</div></section>

      <section><SectionHeading title="지역별로 둘러보기" description="가고 싶은 지역을 선택해 여행지를 확인해 보세요." /><div className="region-grid">{regions.map(item => <article key={item.title}><img src={item.image} alt={`${item.title} 여행 풍경`} /><h3>{item.title}</h3></article>)}</div></section>

      <section><SectionHeading title="주제별로 둘러보기" description="TourAPI 관광 분류를 기준으로 다양한 여행지를 만나보세요." link="관광지 더보기" /><div className="destination-info-grid destination-info-grid--four">{themes.map(item => <article className="destination-info-card" key={item.title}><img src={item.image} alt={item.title} /><div><span>{item.tag}</span><h3>{item.title}</h3><p className="destination-card-location"><PlacePinIcon />{item.location}</p><p>{item.text}</p></div></article>)}</div></section>

      <section><SectionHeading title="문화와 역사를 만나는 곳" description="박물관, 미술관, 전시관에서 다양한 이야기를 만나보세요." link="문화시설 더보기" /><div className="destination-info-grid destination-info-grid--three">{culturePlaces.map(item => <article className="destination-info-card" key={item.title}><img src={item.image} alt={item.title} /><div><span>문화시설</span><h3>{item.title}</h3><p className="destination-card-location"><PlacePinIcon />{item.location}</p><p>{item.text}</p></div></article>)}</div></section>

      <section><SectionHeading title="코스를 따라 떠나는 여행" description="여러 장소를 순서대로 둘러보는 TourAPI 여행코스입니다." link="여행코스 더보기" /><div className="destination-course-grid">{courses.map(item => <article key={item.title}><img className="destination-course-card__photo" src={item.image} alt="" /><div><div className="destination-course-meta"><span>{item.region}</span><small>{item.duration}</small></div><h3>{item.title}</h3><p>{item.text}</p><div className="destination-course-route"><img src={route} alt="" />{item.stops.map(stop => <small key={stop}>{stop}</small>)}</div></div></article>)}</div></section>

      <section><SectionHeading title="새롭게 만나는 여행지" description="최근 업데이트된 국내 관광정보를 확인해 보세요." link="여행지 더보기" /><div className="destination-new-grid">{newPlaces.map(item => <article key={item.title}><img src={item.image} alt={item.title} /><div><span>{item.tag}</span><h3>{item.title}</h3><p className="location-with-pin"><PlacePinIcon />{item.location}</p></div></article>)}</div></section>
    </main>
    <TravelSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
  </div>
}
