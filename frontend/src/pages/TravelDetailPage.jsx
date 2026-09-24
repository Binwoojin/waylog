import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import TourApiDetail from '../components/detail/TourApiDetail'
import {
  DETAIL_EMPTY_DESCRIPTION_MESSAGE,
  DETAIL_EMPTY_INFOS_MESSAGE,
  DETAIL_NOT_FOUND_DESCRIPTION,
  DETAIL_NOT_FOUND_TITLE,
} from '../components/detail/detailMessages'
import { toTelHref } from '../api/tourApi'
import { allDestinationMocks, destinationItems } from '../data/destinationMocks'
import { DESTINATION_CONTENT_TYPES, isTourContentId } from '../data/tourContentTypes'
import defaultDestinationImage from '../assets/figma/destination-jeju.png'
import TravelCourseDetailPage from './TravelCourseDetailPage'
import NotFoundPage from './NotFoundPage'
import './TravelDetailPage.css'

const guideLabels = ['이용 시간', '휴무일', '입장 안내', '주차', '반려동물', '유모차 대여']

/**
 * Design Ref: §2.2 — id를 한 번만 해석합니다. 렌더링 중에 계산하는 파생값이라 state에 두지 않습니다.
 * 1. 목업에 있는 slug → 목업 (코스 목업 포함)
 * 2. TourAPI contentId 형식(숫자)이고 type이 12·14(없으면 12) → 상세 API
 * 3. 그 외 → not-found (API 호출 없음). 예전처럼 첫 번째 목업으로 대체하지 않습니다.
 * 목록 페이지가 API로 전환되면 1번 분기만 지웁니다.
 */
function resolveDestinationDetail(id, typeParam) {
  const item = allDestinationMocks.find(entry => entry.id === id)
  if (item) return { kind: 'mock', item }
  // Design Ref: §2.2 D-4 — ?type=이 없으면 관광지(12). 문자열 '12'·'14'만 허용합니다.
  // Number()로 바꾸면 '0xc'·'12.0'·' 12'도 12가 되어 한 콘텐츠에 URL이 여러 개 생기므로 문자열 그대로 비교합니다.
  const contentTypeId = typeParam == null ? DESTINATION_CONTENT_TYPES.attraction : toDestinationTypeId(typeParam)
  if (isTourContentId(id) && contentTypeId != null) return { kind: 'api', contentId: id, contentTypeId }
  return { kind: 'not-found' }
}

// '12' → 12, '14' → 14, 그 외 문자열(빈 문자열 포함) → null
function toDestinationTypeId(typeParam) {
  return Object.values(DESTINATION_CONTENT_TYPES).find(typeId => String(typeId) === typeParam) ?? null
}

// Design Ref: §3.1 — 목업 → 상세 view model. meta는 목업 화면의 "휴무일" 표시에만 씁니다.
function toDestinationMockDetail(item) {
  return {
    source: 'mock',
    id: item.id,
    title: item.title,
    image: item.image,
    address: item.address,
    typeLabel: item.tag,
    description: `${item.description}.`,
    infos: [],
    contact: null,
    meta: item.meta,
  }
}

// Design Ref: §5.1 — 기록이 없을 때(공유 링크로 바로 진입) 돌아갈 목록
function getMockBackTo(item) {
  return destinationItems.some(entry => entry.id === item.id) ? '/destinations/attractions' : '/destinations/culture'
}

export default function TravelDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const resolved = resolveDestinationDetail(id, searchParams.get('type'))

  // Design Ref: §2.3 — key로 재마운트해 주변 카드로 이동할 때 저장·사진 위치 state가 이전 항목에서 넘어오지 않게 합니다.
  if (resolved.kind === 'mock') {
    const { item } = resolved
    if (item.stops) return <TravelCourseDetailPage key={id} item={item} />
    return <TravelDetailView key={id} detail={toDestinationMockDetail(item)} backTo={getMockBackTo(item)} />
  }

  if (resolved.kind === 'api') {
    const backTo = resolved.contentTypeId === DESTINATION_CONTENT_TYPES.culture ? '/destinations/culture' : '/destinations/attractions'
    return (
      <TourApiDetail
        key={`${resolved.contentId}:${resolved.contentTypeId}`}
        contentId={resolved.contentId}
        contentTypeId={resolved.contentTypeId}
        backTo={backTo}
        renderDetail={detail => <TravelDetailView detail={detail} backTo={backTo} />}
      />
    )
  }

  return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
}

/**
 * 여행지 상세 표시 컴포넌트. 출처(목업/API)와 관계없이 view model(detail)만 받습니다.
 *
 * Design Ref: §5.2 — 목업 전용 하드코딩 값(요약, 전화번호, 추가 사진, 주변 목업)은
 * detail.source === 'mock'일 때만 표시합니다. API 콘텐츠에 거짓 정보를 붙이지 않기 위해서입니다.
 */
function TravelDetailView({ detail, backTo }) {
  const navigate = useNavigate()
  const isMock = detail.source === 'mock'
  // Design Ref: §5.2 — 외부 이미지 URL이 깨지면 기본 이미지로 한 번만 바꿉니다.
  // 기본 이미지까지 실패해도 값이 그대로라 다시 렌더링·요청이 반복되지 않습니다.
  const [isImageBroken, setIsImageBroken] = useState(false)
  const image = detail.image && !isImageBroken ? detail.image : defaultDestinationImage
  const telHref = toTelHref(detail.contact)
  const [saved, setSaved] = useState(false)
  const [nearbyBookmarks, setNearbyBookmarks] = useState(() => new Set())
  const [photoIndex, setPhotoIndex] = useState(0)
  const [slideMotion, setSlideMotion] = useState({ direction: 'next', key: 0 })
  const additionalPhotos = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, src: image }))
  const visiblePhotos = Array.from({ length: 3 }, (_, offset) => additionalPhotos[(photoIndex + offset) % additionalPhotos.length])
  const movePhotos = direction => {
    setPhotoIndex(index => direction === 'next' ? (index + 1) % additionalPhotos.length : (index - 1 + additionalPhotos.length) % additionalPhotos.length)
    setSlideMotion(current => ({ direction, key: current.key + 1 }))
  }

  const goBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate(backTo)
  }
  const highlights = [['🕘', '이용시간', '09:00 - 18:00'], ['📅', '휴무일', detail.meta], ['☎️', '문의 및 안내', '064-710-7912'], ['🅿️', '주차', '가능'], ['🌐', '홈페이지', '바로가기']]
  const share = async () => navigator.share ? navigator.share({ title: detail.title, url: location.href }) : navigator.clipboard?.writeText(location.href)

  return <div className="travel-detail-page"><main className={isMock ? 'travel-detail-main' : 'travel-detail-main travel-detail-main--api'}>
    <button className="detail-back" type="button" onClick={goBack}><span aria-hidden="true">←</span> 이전 페이지</button>
    <nav className="detail-crumb" aria-label="현재 위치"><Link to="/">홈</Link><i>›</i><Link to="/destinations">여행지</Link><i>›</i><strong>{detail.title}</strong></nav>
    <header className="detail-hero"><div>{detail.typeLabel && <span className="detail-tag">{detail.typeLabel}</span>}<h1>{detail.title}</h1><p><PlacePinIcon size={19} />{detail.address}</p></div><div className="detail-actions"><button onClick={share}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>공유</button><button className={saved ? 'active' : ''} aria-pressed={saved} onClick={() => setSaved(v => !v)}><svg className="detail-actions__bookmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg>{saved ? '저장됨' : '저장'}</button></div></header>
    {/* Design Ref: §5.2 — API는 대표 이미지 1장뿐이라 같은 사진을 반복하지 않고 1열로 보여 줍니다. */}
    {isMock
      ? <section className="detail-gallery" aria-label={`${detail.title} 사진`}><img src={image} alt={detail.title} />{[1,2,3,4].map(n => <img src={image} alt="" key={n} />)}<button>사진 전체보기 <b>5</b></button></section>
      : (
        <section className="detail-gallery detail-gallery--single" aria-label={`${detail.title} 사진`}>
          <img src={image} alt={detail.title} onError={() => setIsImageBroken(true)} />
        </section>
      )}
    {/* Design Ref: §5.2 — 요약 5개는 목업 하드코딩 값이라 API 콘텐츠에서는 숨깁니다(이용 안내와도 중복). */}
    {isMock && <section className="detail-facts">{highlights.map(([icon,label,value]) => <div key={label}><em aria-hidden="true">{icon}</em><dl><dt>{label}</dt><dd>{value}</dd></dl></div>)}</section>}
    <p className="detail-notice"><i>i</i> 운영 정보는 현지 사정에 따라 변경될 수 있습니다. 방문 전 최신 정보를 확인해 주세요.</p>
    <section className="detail-content">
      <article>
        <small>ABOUT THE PLACE</small><h2>{detail.title} 소개</h2>
        {isMock
          ? <><p className="detail-lead">{detail.description}</p><p>여행지의 자연과 문화, 그곳만의 특별한 이야기를 천천히 만나보세요. 잠시 속도를 늦추고 주변의 풍경과 계절의 변화를 바라보면 더욱 깊이 있는 여행을 즐길 수 있습니다.</p></>
          : <p className="detail-lead">{detail.description || DETAIL_EMPTY_DESCRIPTION_MESSAGE}</p>}
        <div className="detail-guide">
          <h3>이용 안내</h3>
          {isMock
            ? <dl>{guideLabels.map(label => <div key={label}><dt>{label}</dt><dd>{label === '휴무일' ? detail.meta : '현장 상황에 따라 달라질 수 있습니다'}</dd></div>)}</dl>
            : detail.infos.length > 0
              ? <dl>{detail.infos.map((info, index) => <div key={`${info.label}-${index}`}><dt>{info.label}</dt><dd>{info.value}</dd></div>)}</dl>
              : <p className="detail-guide__empty">{DETAIL_EMPTY_INFOS_MESSAGE}</p>}
        </div>
      </article>
      <aside className="detail-check">
        <small>방문 안내</small><h2>방문 전 확인하세요</h2>
        {isMock && <><p>문의 전화</p><a href="tel:0647107912">064-710-7912</a><hr/></>}
        {/* Design Ref: §5.2 — API 콘텐츠는 실제 문의처가 있을 때만 표시합니다. 전화번호로 볼 수 없으면 텍스트로만 둡니다. */}
        {!isMock && detail.contact && (
          <>
            <p>{telHref ? '문의 전화' : '문의'}</p>
            {telHref
              ? <a href={telHref}>{detail.contact}</a>
              : <p className="detail-check__contact">{detail.contact}</p>}
            <hr/>
          </>
        )}
        <p>운영시간과 휴무일은 현지 사정에 따라 변경될 수 있습니다.</p><button>정보 오류 제보</button>
      </aside>
    </section>
    <DetailHeading eyebrow="LOCATION" title="위치 안내" /><section className="detail-map"><div><span><PlacePinIcon size={28}/></span><p>지도 API 연동 영역</p></div><aside>{detail.typeLabel && <span className="detail-tag">{detail.typeLabel}</span>}<h3>{detail.title}</h3><p><PlacePinIcon />{detail.address}</p><button>지도 크게 보기</button><button>길찾기</button></aside></section>
    {/* Design Ref: §5.2 D-5 — 추가 사진·주변 여행지는 목업 데이터라 API 콘텐츠의 실제 위치와 무관합니다. 숨깁니다. */}
    {isMock && <>
    <DetailHeading eyebrow="GALLERY" title="추가 사진" /><section className="detail-extra-slider" aria-label="추가 사진 슬라이더">
      <div className="detail-extra-slider__viewport"><div className={`detail-extra-slider__track is-moving-${slideMotion.direction}`} key={slideMotion.key}>{visiblePhotos.map((photo, slot) => <img src={photo.src} alt={`${detail.title} 추가 사진 ${photo.id}`} key={`${photo.id}-${slot}`}/>)}</div></div>
      <div className="detail-extra-slider__controls"><button type="button" aria-label="이전 사진" onClick={() => movePhotos('prev')}>‹</button><button type="button" aria-label="다음 사진" onClick={() => movePhotos('next')}>›</button></div>
    </section>
    <DetailHeading eyebrow="NEARBY" title="주변에서 함께 둘러볼 곳" link /><section className="detail-nearby">{destinationItems.slice(0,3).map(near => {
      const isNearSaved = nearbyBookmarks.has(near.id)
      return <article key={near.id}><Link to={`/destinations/detail/${near.id}`}><img src={near.image} alt=""/><span className="detail-nearby__tag">{near.tag}</span><div><h3>{near.title}</h3><p><PlacePinIcon size={15}/>{near.address}</p></div></Link><button className={isNearSaved ? 'active' : ''} type="button" aria-label={`${near.title} 북마크 ${isNearSaved ? '해제' : '등록'}`} aria-pressed={isNearSaved} onClick={() => setNearbyBookmarks(current => { const next = new Set(current); next.has(near.id) ? next.delete(near.id) : next.add(near.id); return next })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg></button></article>
    })}</section>
    </>}
    <p className="detail-source"><b>TourAPI</b> 이 관광정보는 한국관광공사 TourAPI를 통해 제공됩니다.</p>
  </main></div>
}

function DetailHeading({ eyebrow, title, link }) { return <header className="detail-section-head"><div><small>{eyebrow}</small><h2>{title}</h2></div>{link && <Link to="/destinations/attractions">전체 보기 →</Link>}</header> }
