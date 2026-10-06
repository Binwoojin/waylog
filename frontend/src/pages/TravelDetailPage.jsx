import { useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import TourApiDetail from '../components/detail/TourApiDetail'
import DetailActionMessage from '../components/detail/DetailActionMessage'
import {
  DETAIL_BOOKMARK_FAILED_MESSAGE,
  DETAIL_EMPTY_DESCRIPTION_MESSAGE,
  DETAIL_EMPTY_INFOS_MESSAGE,
  DETAIL_NOT_FOUND_DESCRIPTION,
  DETAIL_NOT_FOUND_TITLE,
  DETAIL_SHARE_COPIED_MESSAGE,
  DETAIL_SHARE_FAILED_MESSAGE,
} from '../components/detail/detailMessages'
import { toTelHref } from '../api/tourApi'
import { toggleTourBookmark } from '../api/tourBookmarkApi'
import { useAuth } from '../context/AuthContext'
import { DESTINATION_CONTENT_TYPES, isTourContentId } from '../data/tourContentTypes'
import { runOptimisticToggle } from '../lib/optimisticToggle'
import { sharePage } from '../lib/sharePage'
import defaultDestinationImage from '../assets/figma/destination-jeju.png'
import NotFoundPage from './NotFoundPage'
import './TravelDetailPage.css'

/**
 * 여행지 상세 (`/destinations/detail/:id?type=`)
 *
 * Design Ref: §2.2 — id를 한 번만 해석합니다. 렌더링 중에 계산하는 파생값이라 state에 두지 않습니다.
 * 1. TourAPI contentId 형식(숫자)이고 type이 12·14(없으면 12) → 상세 API
 * 2. 그 외 → not-found (API 호출 없음)
 *
 * 여행코스는 별도 라우트(/destinations/courses/:id, TourCourseDetailPage)로 분리돼 있어
 * 이 파일은 관광지·문화시설만 다룹니다(tour-course-list-integration.design.md §6, D-5).
 */
function resolveDestinationDetail(id, typeParam) {
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

export default function TravelDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { memberId } = useAuth()
  const resolved = resolveDestinationDetail(id, searchParams.get('type'))

  if (resolved.kind === 'api') {
    const backTo = resolved.contentTypeId === DESTINATION_CONTENT_TYPES.culture ? '/destinations/culture' : '/destinations/attractions'
    return (
      <TourApiDetail
        // S1: bookmarked는 토큰 기반 개인화 값이라 로그인 상태가 바뀌면 상세를 다시 받아야 합니다.
        // memberId를 key에 넣어 상세 전체를 재마운트하면 재조회와 saved 초기값 재계산이 함께 일어납니다.
        key={`${resolved.contentId}:${resolved.contentTypeId}:${memberId ?? 'guest'}`}
        contentId={resolved.contentId}
        contentTypeId={resolved.contentTypeId}
        backTo={backTo}
        renderDetail={detail => <TravelDetailView detail={detail} backTo={backTo} contentTypeId={resolved.contentTypeId} />}
      />
    )
  }

  return <NotFoundPage title={DETAIL_NOT_FOUND_TITLE} description={DETAIL_NOT_FOUND_DESCRIPTION} />
}

/**
 * 여행지 상세 표시 컴포넌트. TourAPI 상세 view model(detail)만 받습니다.
 */
function TravelDetailView({ detail, backTo, contentTypeId }) {
  const navigate = useNavigate()
  const { member } = useAuth()
  // Design Ref: §5.2 — 외부 이미지 URL이 깨지면 기본 이미지로 한 번만 바꿉니다.
  // 기본 이미지까지 실패해도 값이 그대로라 다시 렌더링·요청이 반복되지 않습니다.
  const [isImageBroken, setIsImageBroken] = useState(false)
  const image = detail.image && !isImageBroken ? detail.image : defaultDestinationImage
  const telHref = toTelHref(detail.contact)
  // Design Ref: bookmark-initial-state(백엔드 완료) — 상세 응답의 detail.bookmarked를 초기값으로 씁니다.
  // TourApiDetail이 id·회원마다 key로 재마운트하므로(§2.3, S1) effect 없이 초기값만으로 충분합니다.
  // 한계(S2, 이번 범위 밖): 토큰 복원이 네트워크 오류로 실패하면 토큰 없이 요청되어 bookmarked가 조용히 false로 올 수 있습니다.
  const [saved, setSaved] = useState(Boolean(detail.bookmarked))
  // S3: 요청이 끝나기 전 중복 토글을 막습니다. ref는 같은 렌더 안의 연속 클릭도 즉시 막고, state는 버튼 disabled에 씁니다.
  const savingRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  // 북마크·공유 결과 안내 문구. 새 동작을 시작할 때마다 지우고, 결과가 실패일 때만 채웁니다.
  const [actionMessage, setActionMessage] = useState('')

  // Design Ref: mypage-bookmarks.design.md §7.1 — 낙관적으로 먼저 바꾸고, 실패하면 되돌린다.
  // S3: 요청 중에는 토글을 무시합니다(ref 가드 + optimisticToggle의 key 가드). 그래서 previous가 항상 서버 응답 기준 값입니다.
  async function handleToggleSave() {
    if (!member) {
      navigate('/login')
      return
    }
    if (savingRef.current) return

    savingRef.current = true
    setIsSaving(true)
    setActionMessage('')

    try {
      await runOptimisticToggle({
        key: `tour-bookmark:${contentTypeId}:${detail.id}`,
        apply: patch => setSaved(patch.saved),
        optimisticPatch: { saved: !saved },
        revertPatch: { saved },
        request: () => toggleTourBookmark({
          contentId: detail.id,
          contentTypeId,
          title: detail.title,
          imageUrl: detail.image ?? null,
          address: detail.address ?? null,
          categoryName: detail.typeLabel || null,
        }),
        reconcile: nextSaved => ({ saved: nextSaved }),
        onError: error => {
          console.error('북마크 처리에 실패했습니다.', error)
          setActionMessage(DETAIL_BOOKMARK_FAILED_MESSAGE)
        },
      })
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const goBack = () => {
    if (window.history.length > 1) window.history.back()
    else navigate(backTo)
  }

  async function handleShare() {
    setActionMessage('')
    const result = await sharePage({ title: detail.title })
    if (result === 'copied') setActionMessage(DETAIL_SHARE_COPIED_MESSAGE)
    if (result === 'failed') setActionMessage(DETAIL_SHARE_FAILED_MESSAGE)
  }

  return <div className="travel-detail-page"><main className="travel-detail-main travel-detail-main--api">
    <button className="detail-back" type="button" onClick={goBack}><span aria-hidden="true">←</span> 이전 페이지</button>
    <nav className="detail-crumb" aria-label="현재 위치"><Link to="/">홈</Link><i>›</i><Link to="/destinations">여행지</Link><i>›</i><strong>{detail.title}</strong></nav>
    <header className="detail-hero"><div>{detail.typeLabel && <span className="detail-tag">{detail.typeLabel}</span>}<h1>{detail.title}</h1><p><PlacePinIcon size={19} />{detail.address}</p></div><div className="detail-action-group"><div className="detail-actions"><button type="button" onClick={handleShare}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>공유</button><button type="button" className={saved ? 'active' : ''} aria-pressed={saved} disabled={isSaving} onClick={handleToggleSave}><svg className="detail-actions__bookmark" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg>{saved ? '저장됨' : '저장'}</button></div><DetailActionMessage message={actionMessage} /></div></header>
    <section className="detail-gallery detail-gallery--single" aria-label={`${detail.title} 사진`}>
      <img src={image} alt={detail.title} onError={() => setIsImageBroken(true)} />
    </section>
    <p className="detail-notice"><i>i</i> 운영 정보는 현지 사정에 따라 변경될 수 있습니다. 방문 전 최신 정보를 확인해 주세요.</p>
    <section className="detail-content">
      <article>
        <small>ABOUT THE PLACE</small><h2>{detail.title} 소개</h2>
        <p className="detail-lead">{detail.description || DETAIL_EMPTY_DESCRIPTION_MESSAGE}</p>
        <div className="detail-guide">
          <h3>이용 안내</h3>
          {detail.infos.length > 0
            ? <dl>{detail.infos.map((info, index) => <div key={`${info.label}-${index}`}><dt>{info.label}</dt><dd>{info.value}</dd></div>)}</dl>
            : <p className="detail-guide__empty">{DETAIL_EMPTY_INFOS_MESSAGE}</p>}
        </div>
      </article>
      <aside className="detail-check">
        <small>방문 안내</small><h2>방문 전 확인하세요</h2>
        {/* 실제 문의처가 있을 때만 표시합니다. 전화번호로 볼 수 없으면 텍스트로만 둡니다. */}
        {detail.contact && (
          <>
            <p>{telHref ? '문의 전화' : '문의'}</p>
            {telHref
              ? <a href={telHref}>{detail.contact}</a>
              : <p className="detail-check__contact">{detail.contact}</p>}
            <hr/>
          </>
        )}
        <p>운영시간과 휴무일은 현지 사정에 따라 변경될 수 있습니다.</p>
      </aside>
    </section>
    <p className="detail-source"><b>TourAPI</b> 이 관광정보는 한국관광공사 TourAPI를 통해 제공됩니다.</p>
  </main></div>
}
