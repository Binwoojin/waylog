import { Link } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import './TravelCourseDetailPage.css'

export default function TravelCourseDetailPage({ item }) {
  // TourAPI detailInfo2(contentTypeId=25)의 subnum, subname, subdetailoverview,
  // subdetailimg 값을 이 배열 형태로 가공하면 실제 코스 순서와 설명을 그대로 표시할 수 있습니다.
  const steps = item.stops.map((name, index) => ({
    order: index + 1,
    name,
    image: item.image,
    description: `${name}에서 지역의 분위기와 대표 풍경을 여유롭게 만나보세요.`,
    stay: index === 0 ? '약 60분' : '약 40분',
  }))
  const duration = item.meta === '당일치기' ? '약 7시간' : item.meta === '1박 2일' ? '1박 2일' : '2박 3일'
  const goBack = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.href = '/destinations/courses'
  }

  return <div className="course-detail-page"><main className="course-detail-main">
    <button className="course-detail-back" type="button" onClick={goBack}><span aria-hidden="true">←</span> 이전 페이지</button>
    <nav className="course-detail-crumb"><Link to="/">홈</Link><i>›</i><Link to="/destinations">여행지</Link><i>›</i><Link to="/destinations/courses">여행코스</Link><i>›</i><strong>{item.title}</strong></nav>
    <header className="course-detail-hero"><img src={item.image} alt={item.title}/><div className="course-detail-hero__shade"/><div className="course-detail-hero__copy"><span>{item.meta}</span><h1>{item.title}</h1><p><PlacePinIcon size={19}/>{item.address}</p><strong>{item.description}</strong></div></header>

    <section className="course-detail-stats"><div><small>여행 일정</small><strong>{duration}</strong></div><div><small>코스 지점</small><strong>{steps.length}곳</strong></div><div><small>추천 이동</small><strong>도보 · 대중교통</strong></div><div><small>코스 지역</small><strong>{item.tag}</strong></div></section>

    <section className="course-detail-overview"><div><small>COURSE OVERVIEW</small><h2>코스 한눈에 보기</h2><p>{item.description}. 각 장소를 순서대로 둘러보며 지역의 매력을 깊이 있게 경험할 수 있도록 구성한 추천 여행코스입니다.</p></div><aside><b>여행 전 확인</b><p>운영시간과 이동 소요시간은 현지 상황에 따라 달라질 수 있습니다.</p><a href="#course-route">코스 일정 보기 ↓</a></aside></section>

    <section className="course-detail-route" id="course-route"><header><small>ITINERARY</small><h2>순서대로 둘러보세요</h2><p>TourAPI에서 제공하는 코스 구성 지점 순서입니다.</p></header><div className="course-detail-route__line">{steps.map(step => <a href={`#course-stop-${step.order}`} key={step.name}><i>{step.order}</i><span>{step.name}</span></a>)}</div></section>

    <section className="course-detail-stops">{steps.map(step => <article id={`course-stop-${step.order}`} key={step.name}><img src={step.image} alt=""/><div><span>STOP {String(step.order).padStart(2,'0')}</span><h3>{step.name}</h3><p>{step.description}</p><dl><div><dt>권장 체류시간</dt><dd>{step.stay}</dd></div><div><dt>다음 장소 이동</dt><dd>{step.order === steps.length ? '코스 종료' : '약 20분'}</dd></div></dl><button type="button">장소 상세보기</button></div></article>)}</section>

    <section className="course-detail-map"><div><span><PlacePinIcon size={29}/></span><p>코스 지도 API 연동 영역</p></div><aside><small>전체 경로</small><h2>{item.title}</h2><ol>{steps.map(step => <li key={step.name}><i>{step.order}</i>{step.name}</li>)}</ol><button type="button">전체 경로로 길찾기</button></aside></section>
    <p className="course-detail-source"><b>TourAPI</b> 코스 기본정보는 공통·소개정보, 순서별 지점은 반복정보 조회 결과를 사용합니다.</p>
  </main></div>
}
