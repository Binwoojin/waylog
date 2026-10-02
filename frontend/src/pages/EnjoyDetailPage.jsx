import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import TourApiDetail from '../components/detail/TourApiDetail'
import {
  DETAIL_EMPTY_DESCRIPTION_MESSAGE,
  DETAIL_EMPTY_INFOS_MESSAGE,
  DETAIL_NOT_FOUND_DESCRIPTION,
  DETAIL_NOT_FOUND_TITLE,
} from '../components/detail/detailMessages'
import { toTelHref } from '../api/tourApi'
import { toggleTourBookmark } from '../api/tourBookmarkApi'
import { useAuth } from '../context/AuthContext'
import { enjoyConfigs, findEnjoyItem } from '../data/enjoyMocks'
import { getEnjoyContentType, isTourContentId } from '../data/tourContentTypes'
import NotFoundPage from './NotFoundPage'
import './EnjoyDetailPage.css'

const categoryFacts = {
  festivals:[['행사 기간','일정 확인'],['이용 요금','프로그램별 상이'],['문의','관광안내소']],
  leports:[['이용 시간','09:00 - 18:00'],['체험 난이도','초보 가능'],['예약','사전 예약 권장']],
  food:[['영업 시간','11:00 - 21:00'],['대표 메뉴','현장 메뉴판 확인'],['주차','인근 주차장 이용']],
  shopping:[['운영 시간','10:00 - 20:00'],['휴무일','점포별 상이'],['결제','점포별 확인']],
  stay:[['체크인','15:00'],['체크아웃','11:00'],['예약','숙소 문의']],
}

const COVER_TEXT_LIMIT = 80

/**
 * Design Ref: §2.2 — id를 한 번만 해석합니다. 렌더링 중에 계산하는 파생값이라 state에 두지 않습니다.
 * 1. 목업에 있는 slug → 목업
 * 2. TourAPI contentId 형식(숫자) → 상세 API (유형은 카테고리로 결정)
 * 3. 그 외 → not-found (API 호출 없음). 예전처럼 첫 번째 목업으로 대체하지 않습니다.
 * 목록 페이지가 API로 전환되면 1번 분기만 지웁니다.
 */
function resolveEnjoyDetail(category, id) {
  const item = findEnjoyItem(category, id)
  if (item) return { kind: 'mock', item }
  const contentTypeId = getEnjoyContentType(category)
  if (isTourContentId(id) && contentTypeId != null) return { kind: 'api', contentId: id, contentTypeId }
  return { kind: 'not-found' }
}

// Design Ref: §3.1 — 목업 → 상세 view model. meta는 목업 화면의 "행사 기간" 표시에만 씁니다.
function toEnjoyMockDetail(item, config) {
  return {
    source: 'mock',
    id: item.id,
    title: item.title,
    image: item.image,
    address: item.location,
    typeLabel: config.title,
    description: item.description,
    infos: [],
    contact: null,
    meta: item.meta,
    // 목업은 TourDetailResponse를 호출하지 않아 서버의 bookmarked 값이 없습니다. 항상 false로 시작합니다.
    bookmarked: false,
  }
}

// Design Ref: §5.2 — 커버 위에는 소개의 첫 줄만, 최대 80자까지 보여 줍니다.
function toCoverText(description) {
  const firstLine = description.split('\n').find(line => line.trim())?.trim() ?? ''
  return firstLine.length > COVER_TEXT_LIMIT ? `${firstLine.slice(0, COVER_TEXT_LIMIT)}…` : firstLine
}

export default function EnjoyDetailPage() {
  const { category, id } = useParams()
  // '__proto__'·'constructor' 같은 프로토타입 키가 통과하지 않도록 두 객체 모두 Object.hasOwn으로 판별합니다.
  const isKnownCategory = Object.hasOwn(enjoyConfigs, category) && Object.hasOwn(categoryFacts, category)

  // Design Ref: §6 — 없는 카테고리에서는 categoryFacts[category].map이 크래시했으므로 404로 안내합니다.
  if (!isKnownCategory) return <NotFoundPage />
  const config = enjoyConfigs[category]
  const backTo = `/enjoy/${category}`
  const resolved = resolveEnjoyDetail(category, id)

  // Design Ref: §2.3 — key로 재마운트해 추천 카드로 이동할 때 저장 상태가 이전 항목에서 넘어오지 않게 합니다.
  if (resolved.kind === 'mock') {
    return <EnjoyDetailContent key={id} category={category} config={config} detail={toEnjoyMockDetail(resolved.item, config)} />
  }

  if (resolved.kind === 'api') {
    return (
      <TourApiDetail
        key={`${resolved.contentId}:${resolved.contentTypeId}`}
        contentId={resolved.contentId}
        contentTypeId={resolved.contentTypeId}
        backTo={backTo}
        renderDetail={detail => <EnjoyDetailContent category={category} config={config} detail={detail} />}
      />
    )
  }

  return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
}

function EnjoyDetailContent({ category, config, detail }) {
  const navigate = useNavigate()
  const { member } = useAuth()
  // Design Ref: bookmark-initial-state(백엔드 완료) — 상세 응답의 detail.bookmarked를 초기값으로 씁니다.
  // 이 컴포넌트는 id가 바뀔 때 key로 재마운트되므로(§2.3) effect 없이 초기값만으로 충분합니다.
  const [saved,setSaved]=useState(Boolean(detail.bookmarked))
  const isMock = detail.source === 'mock'
  // Design Ref: §5.2 — 외부 이미지 URL이 깨지면 카테고리 커버로 한 번만 바꿉니다(무한 onError 방지).
  const [isImageBroken, setIsImageBroken] = useState(false)
  const coverImage = detail.image && !isImageBroken ? detail.image : config.cover
  const coverText = isMock ? detail.description : toCoverText(detail.description)
  const telHref = toTelHref(detail.contact)
  const goBack=()=>window.history.length>1?window.history.back():navigate(`/enjoy/${category}`)

  // Design Ref: mypage-bookmarks.design.md §7.1 — "저장되지 않는 가짜 버튼" 제거. contentTypeId는
  // 카테고리 slug로 결정되므로(resolveEnjoyDetail과 같은 기준) 목업·API 콘텐츠 모두 동일하게 구한다.
  async function handleToggleSave() {
    if (!member) {
      navigate('/login')
      return
    }

    const previous = saved
    setSaved(!previous)

    try {
      const nextSaved = await toggleTourBookmark({
        contentId: detail.id,
        contentTypeId: getEnjoyContentType(category),
        title: detail.title,
        imageUrl: detail.image ?? null,
        address: detail.address ?? null,
        categoryName: detail.typeLabel || config.title,
      })
      setSaved(nextSaved)
    } catch (error) {
      console.error('북마크 처리에 실패했습니다.', error)
      setSaved(previous)
    }
  }

  return <div className="enjoy-detail-page"><main className={isMock ? 'enjoy-detail-main' : 'enjoy-detail-main enjoy-detail-main--api'}>
    <button className="enjoy-detail-back" onClick={goBack}>← 이전 페이지</button>
    <nav className="enjoy-detail-crumb"><Link to="/enjoy">여행 즐기기</Link><i>›</i><Link to={`/enjoy/${category}`}>{config.title}</Link><i>›</i><strong>{detail.title}</strong></nav>
    <header className="enjoy-detail-title"><div><span>{detail.typeLabel || config.title}</span><h1>{detail.title}</h1><p><PlacePinIcon size={19}/>{detail.address}</p></div><button className={saved?'active':''} aria-pressed={saved} onClick={handleToggleSave}><svg viewBox="0 0 24 24"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg>{saved?'저장됨':'저장'}</button></header>
    <section className="enjoy-detail-cover">
      <img src={coverImage} alt={detail.title} onError={() => setIsImageBroken(true)}/>
      <div><small>TRAVEL EXPERIENCE</small>{coverText && <strong>{coverText}</strong>}</div>
    </section>
    {/* Design Ref: §5.2 — 목업용 요약값은 API 콘텐츠에 붙이지 않습니다(거짓 정보 금지). */}
    {isMock && <section className="enjoy-detail-facts">{categoryFacts[category].map(([label,value])=><dl key={label}><dt>{label}</dt><dd>{label.includes('기간')?detail.meta:value}</dd></dl>)}</section>}
    <section className="enjoy-detail-content">
      <article>
        <small>ABOUT</small><h2>{detail.title} 소개</h2>
        {isMock
          ? <><p className="lead">{detail.description}.</p><p>방문 전 운영 정보와 이용 조건을 확인하고, 현지의 안내 사항을 따라 안전하고 즐거운 여행을 준비해 보세요. TourAPI 연동 후에는 최신 소개정보와 상세 이용정보가 이 영역에 표시됩니다.</p></>
          : <p className="lead">{detail.description || DETAIL_EMPTY_DESCRIPTION_MESSAGE}</p>}
        <div className="enjoy-detail-guide">
          <h3>이용 안내</h3>
          {isMock
            ? categoryFacts[category].map(([label,value])=><p key={label}><b>{label}</b><span>{label.includes('기간')?detail.meta:value}</span></p>)
            : detail.infos.length > 0
              ? detail.infos.map((info, index) => <p key={`${info.label}-${index}`}><b>{info.label}</b><span>{info.value}</span></p>)
              : <p className="enjoy-detail-guide__empty">{DETAIL_EMPTY_INFOS_MESSAGE}</p>}
        </div>
      </article>
      <aside>
        <span>방문 전 확인</span><h2>최신 정보를 확인하세요</h2><p>운영시간, 요금, 예약 가능 여부는 현지 사정에 따라 변경될 수 있습니다.</p>
        {isMock && <button>전화 문의</button>}
        {/* API 콘텐츠는 실제 문의처가 있을 때만 표시합니다. */}
        {!isMock && detail.contact && (
          <p className="enjoy-detail-contact">
            <b>문의</b>
            {telHref ? <a href={telHref}>{detail.contact}</a> : <span>{detail.contact}</span>}
          </p>
        )}
        <button>정보 오류 제보</button>
      </aside>
    </section>
    <section className="enjoy-detail-map"><div><PlacePinIcon size={30}/><p>지도 API 연동 영역</p></div><aside><span>{config.title}</span><h3>{detail.title}</h3><p>{detail.address}</p><button>길찾기</button></aside></section>
    {/* 같은 카테고리의 목업 추천입니다. 위치를 주장하지 않으므로 API 콘텐츠에도 유지합니다(§5.2). */}
    <section className="enjoy-detail-nearby"><header><small>MORE {config.title.toUpperCase()}</small><h2>함께 살펴볼 정보</h2></header><div>{config.items.filter(entry=>entry.id!==detail.id).slice(0,3).map(entry=><Link to={`/enjoy/${category}/${entry.id}`} key={entry.id}><img src={entry.image} alt=""/><h3>{entry.title}</h3><p><PlacePinIcon size={15}/>{entry.location}</p></Link>)}</div></section>
  </main></div>
}
