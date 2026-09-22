import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import TravelCourseDetailPage from './TravelCourseDetailPage'
import { allDestinationMocks, destinationItems } from '../data/destinationMocks'
import './TravelDetailPage.css'

const guideLabels = ['이용 시간', '휴무일', '입장 안내', '주차', '반려동물', '유모차 대여']

export default function TravelDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const item = allDestinationMocks.find(entry => entry.id === id) || allDestinationMocks[0]
  const [saved, setSaved] = useState(false)
  const [nearbyBookmarks, setNearbyBookmarks] = useState(() => new Set())
  const [photoIndex, setPhotoIndex] = useState(0)
  const [slideMotion, setSlideMotion] = useState({ direction: 'next', key: 0 })
  const additionalPhotos = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, src: item.image }))
  const visiblePhotos = Array.from({ length: 3 }, (_, offset) => additionalPhotos[(photoIndex + offset) % additionalPhotos.length])
  const movePhotos = direction => {
    setPhotoIndex(index => direction === 'next' ? (index + 1) % additionalPhotos.length : (index - 1 + additionalPhotos.length) % additionalPhotos.length)
    setSlideMotion(current => ({ direction, key: current.key + 1 }))
  }

  if (item.stops) return <TravelCourseDetailPage item={item} />

  const goBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate(destinationItems.some(entry => entry.id === item.id) ? '/destinations/attractions' : '/destinations/culture')
  }
  const highlights = [['🕘', '이용시간', '09:00 - 18:00'], ['📅', '휴무일', item.meta], ['☎️', '문의 및 안내', '064-710-7912'], ['🅿️', '주차', '가능'], ['🌐', '홈페이지', '바로가기']]
  const share = async () => navigator.share ? navigator.share({ title: item.title, url: location.href }) : navigator.clipboard?.writeText(location.href)

  return <div className="travel-detail-page"><main className="travel-detail-main">
    <button className="detail-back" type="button" onClick={goBack}><span aria-hidden="true">←</span> 이전 페이지</button>
    <nav className="detail-crumb" aria-label="현재 위치"><Link to="/">홈</Link><i>›</i><Link to="/destinations">여행지</Link><i>›</i><strong>{item.title}</strong></nav>
    <header className="detail-hero"><div><span className="detail-tag">{item.tag}</span><h1>{item.title}</h1><p><PlacePinIcon size={19} />{item.address}</p></div><div className="detail-actions"><button onClick={share}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>공유</button><button className={saved ? 'active' : ''} aria-pressed={saved} onClick={() => setSaved(v => !v)}><svg className="detail-actions__bookmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg>{saved ? '저장됨' : '저장'}</button></div></header>
    <section className="detail-gallery" aria-label={`${item.title} 사진`}><img src={item.image} alt={item.title} />{[1,2,3,4].map(n => <img src={item.image} alt="" key={n} />)}<button>사진 전체보기 <b>5</b></button></section>
    <section className="detail-facts">{highlights.map(([icon,label,value]) => <div key={label}><em aria-hidden="true">{icon}</em><dl><dt>{label}</dt><dd>{value}</dd></dl></div>)}</section>
    <p className="detail-notice"><i>i</i> 운영 정보는 현지 사정에 따라 변경될 수 있습니다. 방문 전 최신 정보를 확인해 주세요.</p>
    <section className="detail-content"><article><small>ABOUT THE PLACE</small><h2>{item.title} 소개</h2><p className="detail-lead">{item.description}.</p><p>여행지의 자연과 문화, 그곳만의 특별한 이야기를 천천히 만나보세요. 잠시 속도를 늦추고 주변의 풍경과 계절의 변화를 바라보면 더욱 깊이 있는 여행을 즐길 수 있습니다.</p><div className="detail-guide"><h3>이용 안내</h3><dl>{guideLabels.map(label => <div key={label}><dt>{label}</dt><dd>{label === '휴무일' ? item.meta : '현장 상황에 따라 달라질 수 있습니다'}</dd></div>)}</dl></div></article><aside className="detail-check"><small>방문 안내</small><h2>방문 전 확인하세요</h2><p>문의 전화</p><a href="tel:0647107912">064-710-7912</a><hr/><p>운영시간과 휴무일은 현지 사정에 따라 변경될 수 있습니다.</p><button>정보 오류 제보</button></aside></section>
    <DetailHeading eyebrow="LOCATION" title="위치 안내" /><section className="detail-map"><div><span><PlacePinIcon size={28}/></span><p>지도 API 연동 영역</p></div><aside><span className="detail-tag">{item.tag}</span><h3>{item.title}</h3><p><PlacePinIcon />{item.address}</p><button>지도 크게 보기</button><button>길찾기</button></aside></section>
    <DetailHeading eyebrow="GALLERY" title="추가 사진" /><section className="detail-extra-slider" aria-label="추가 사진 슬라이더">
      <div className="detail-extra-slider__viewport"><div className={`detail-extra-slider__track is-moving-${slideMotion.direction}`} key={slideMotion.key}>{visiblePhotos.map((photo, slot) => <img src={photo.src} alt={`${item.title} 추가 사진 ${photo.id}`} key={`${photo.id}-${slot}`}/>)}</div></div>
      <div className="detail-extra-slider__controls"><button type="button" aria-label="이전 사진" onClick={() => movePhotos('prev')}>‹</button><button type="button" aria-label="다음 사진" onClick={() => movePhotos('next')}>›</button></div>
    </section>
    <DetailHeading eyebrow="NEARBY" title="주변에서 함께 둘러볼 곳" link /><section className="detail-nearby">{destinationItems.slice(0,3).map(near => {
      const isNearSaved = nearbyBookmarks.has(near.id)
      return <article key={near.id}><Link to={`/destinations/detail/${near.id}`}><img src={near.image} alt=""/><span className="detail-nearby__tag">{near.tag}</span><div><h3>{near.title}</h3><p><PlacePinIcon size={15}/>{near.address}</p></div></Link><button className={isNearSaved ? 'active' : ''} type="button" aria-label={`${near.title} 북마크 ${isNearSaved ? '해제' : '등록'}`} aria-pressed={isNearSaved} onClick={() => setNearbyBookmarks(current => { const next = new Set(current); next.has(near.id) ? next.delete(near.id) : next.add(near.id); return next })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg></button></article>
    })}</section>
    <p className="detail-source"><b>TourAPI</b> 이 관광정보는 한국관광공사 TourAPI를 통해 제공됩니다.</p>
  </main></div>
}

function DetailHeading({ eyebrow, title, link }) { return <header className="detail-section-head"><div><small>{eyebrow}</small><h2>{title}</h2></div>{link && <Link to="/destinations/attractions">전체 보기 →</Link>}</header> }
