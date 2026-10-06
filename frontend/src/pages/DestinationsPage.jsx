import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHero from '../components/common/PageHero'
import TravelSearchModal from '../components/search/TravelSearchModal'
import SectionStatus from '../components/common/SectionStatus'
import TourCardPreview, { PREVIEW_COUNT } from '../components/tour-list/TourCardPreview'
import TourCardSkeleton from '../components/tour-list/TourCardSkeleton'
import CourseCardGrid from '../components/tour-list/CourseCardGrid'
import { travelTypes } from '../data/travelTypes'
import { TOUR_LIST_CONFIGS } from '../data/tourListConfigs'
import { DESTINATION_CONTENT_TYPES } from '../data/tourContentTypes'
import { createTourListQuery } from '../lib/tourListQuery'
import { createCourseListQuery } from '../lib/courseListQuery'
import { useTourList } from '../hooks/useTourList'
import { useCourseList } from '../hooks/useCourseList'
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
import museum from '../assets/destinations/culture-museum.jpg'
import './DestinationsPage.css'

// 공통 여행 유형에 이 페이지에서만 사용하는 대표 이미지를 연결합니다.
const travelTypeImages = { attraction, culture: cultureType, course: courseType }
const travelTypeLinks = { attraction: '/destinations/attractions', culture: '/destinations/culture', course: '/destinations/courses' }

// Design Ref: §5.5 FR-14 — lDongRegnCd는 권역의 대표 시·도입니다(D-2: 권역 조회는 이번 범위 밖).
// 도착한 목록의 지역 select에서 사용자가 다른 시·도로 바꿀 수 있습니다.
// '12'(전라도 카드)는 regions.json에서 전남·광주가 통합된 코드입니다(§5.5 v0.2 실제 키 확인).
const regions = [
  { image: seoul, title: '서울', lDongRegnCd: '11' }, { image: gyeonggi, title: '경기·인천', lDongRegnCd: '41' },
  { image: gangwon, title: '강원', lDongRegnCd: '51' }, { image: chungcheong, title: '충청', lDongRegnCd: '44' },
  { image: jeolla, title: '전라도', lDongRegnCd: '12' }, { image: gyeongsang, title: '경상도', lDongRegnCd: '47' },
  { image: busan, title: '부산', lDongRegnCd: '26' }, { image: jeju, title: '제주', lDongRegnCd: '50' },
]

// 주제 카드의 이름과 분류 코드는 카탈로그(TOUR_LIST_CONFIGS)를 그대로 씁니다.
// 이 페이지는 분류별 이미지와 한 줄 설명만 붙입니다. 설정에 없는 분류는 카드를 만들지 않습니다.
const topicMeta = {
  NA: { image: nature, text: '산과 바다, 숲이 전하는 계절의 풍경을 만나보세요.' },
  HS: { image: history, text: '시간이 쌓인 장소에서 우리 문화의 이야기를 발견해 보세요.' },
  EX: { image: experience, text: '보고 듣는 것을 넘어 몸으로 기억하는 여행을 즐겨보세요.' },
  VE: { image: museum, text: '지역의 역사와 문화를 다양한 공간에서 만나보세요.' },
}
const attractionConfig = TOUR_LIST_CONFIGS.attraction
const topicCards = attractionConfig.categories
  .filter(category => topicMeta[category.code])
  .map(category => ({
    code: category.code,
    label: category.fullLabel,
    image: topicMeta[category.code].image,
    text: topicMeta[category.code].text,
    to: `${attractionConfig.path}?${attractionConfig.categoryParam}=${category.code}`,
  }))

// 쿼리 객체는 모듈 상수로 둬서 렌더마다 새로 만들지 않습니다(훅은 직렬화한 key로 재요청을 막습니다).
const CULTURE_QUERY = createTourListQuery({ contentTypeId: DESTINATION_CONTENT_TYPES.culture, arrange: 'Q', page: 1 })
const ATTRACTION_LATEST_QUERY = createTourListQuery({ contentTypeId: DESTINATION_CONTENT_TYPES.attraction, arrange: 'Q', page: 1 })
const COURSE_QUERY = createCourseListQuery({ page: 1 })

// moreTo: '더보기'가 이동할 라우트. 없으면 링크를 렌더하지 않습니다.
// moreLabel: 화면에는 '더보기'만 보이므로, 같은 문구의 링크가 여러 개일 때 스크린리더가 구분할 수 있게 붙이는 접근 가능한 이름입니다.
function SectionHeading({ title, description, moreTo, moreLabel }) {
  return <div className="destination-heading"><div><h2>{title}</h2><p>{description}</p></div>{moreTo && <Link to={moreTo} aria-label={moreLabel}>더보기 <span aria-hidden="true">→</span></Link>}</div>
}

// 여행지 목록 미리보기입니다. 훅 결과를 공용 TourCardPreview에 넘깁니다(로딩 → 오류 → 빈 결과 → 카드).
function TourPreview({ query, emptyText }) {
  const { status, data, retry } = useTourList(query, { size: PREVIEW_COUNT })

  return (
    <TourCardPreview
      status={status}
      items={data?.items}
      retry={retry}
      errorMessage="여행지를 불러오지 못했어요."
      emptyMessage={emptyText}
    />
  )
}

// 여행코스 미리보기입니다. 카드 모양이 달라(CourseCardGrid) TourCardPreview 대신 같은 상태 순서를 직접 씁니다.
function CoursePreview() {
  const { status, data, retry } = useCourseList(COURSE_QUERY)

  if (status === 'loading') return <TourCardSkeleton count={PREVIEW_COUNT} />
  // 실패해도 페이지 전체는 그대로 두고, 이 섹션에서만 재시도를 제공합니다.
  if (status === 'error') return <SectionStatus variant="error" message="여행코스를 불러오지 못했어요." onRetry={retry} />

  const items = data?.items ?? []
  if (items.length === 0) return <SectionStatus message="표시할 여행코스가 아직 없어요." />
  return <CourseCardGrid cards={items.slice(0, PREVIEW_COUNT)} />
}

export default function DestinationsPage() {
  // Hero의 검색 버튼으로 공용 여행 검색 모달을 열고 닫습니다.
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  return <div className="destinations-page">
    <PageHero
      className="page-hero--destinations"
      eyebrow="WAYLOG DESTINATION"
      title="어디로 떠나볼까요?"
      description="지역과 취향에 맞는 국내 여행지를 발견해 보세요."
      searchLabel="여행지 검색하기"
      searchHint="지역 · 여행 유형 · 여행 조건을 선택해 검색할 수 있어요."
      onSearch={() => setIsSearchOpen(true)}
      visual={<img className="destination-hero__image" src={hero} alt="국내 여행지 사진 일러스트" />}
    />

    <main className="destination-main">
      <section><SectionHeading title="어떤 여행지를 찾고 있나요?" description="관광지부터 문화시설, 여행코스까지 원하는 방식으로 둘러보세요." /><div className="destination-type-grid">{travelTypes.map(item => <Link to={travelTypeLinks[item.id]} key={item.id}><article><img src={travelTypeImages[item.id]} alt="" /><span aria-hidden="true">{item.icon}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></article></Link>)}</div></section>

      <section><SectionHeading title="지역별로 둘러보기" description="가고 싶은 지역을 선택해 여행지를 확인해 보세요." /><div className="region-grid">{regions.map(item => <Link to={`/destinations/attractions?lDongRegnCd=${item.lDongRegnCd}`} key={item.title} aria-label={`${item.title} 관광지 보기`}><article><img src={item.image} alt={`${item.title} 여행 풍경`} /><h3>{item.title}</h3></article></Link>)}</div></section>

      <section><SectionHeading title="주제별로 둘러보기" description="관광 분류별로 여행지를 골라 볼 수 있어요." moreTo={attractionConfig.path} moreLabel="관광지 더보기" /><div className="destination-info-grid destination-info-grid--four">{topicCards.map(item => <Link to={item.to} key={item.code}><article className="destination-info-card"><img src={item.image} alt="" /><div><h3>{item.label}</h3><p>{item.text}</p></div></article></Link>)}</div></section>

      <section><SectionHeading title="문화와 역사를 만나는 곳" description="박물관, 미술관, 전시관에서 다양한 이야기를 만나보세요." moreTo="/destinations/culture" moreLabel="문화시설 더보기" /><TourPreview query={CULTURE_QUERY} emptyText="표시할 문화시설이 아직 없어요." /></section>

      <section><SectionHeading title="코스를 따라 떠나는 여행" description="여러 장소를 순서대로 둘러볼 수 있도록 구성한 여행코스입니다." moreTo="/destinations/courses" moreLabel="여행코스 더보기" /><CoursePreview /></section>

      <section><SectionHeading title="새롭게 만나는 여행지" description="최신순으로 정렬한 관광지예요." moreTo={attractionConfig.path} moreLabel="여행지 더보기" /><TourPreview query={ATTRACTION_LATEST_QUERY} emptyText="표시할 여행지가 아직 없어요." /></section>
    </main>
    <TravelSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
  </div>
}
