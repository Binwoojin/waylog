import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { enjoyConfigs } from '../data/enjoyCategoryConfig'
import { getEnjoyContentType, isTourContentId } from '../data/tourContentTypes'
import { runOptimisticToggle } from '../lib/optimisticToggle'
import { sharePage } from '../lib/sharePage'
import NotFoundPage from './NotFoundPage'
import './EnjoyDetailPage.css'

const COVER_TEXT_LIMIT = 80

/**
 * 즐기기 상세 (`/enjoy/:category/:id`)
 *
 * Design Ref: §2.2 — id를 한 번만 해석합니다. 렌더링 중에 계산하는 파생값이라 state에 두지 않습니다.
 * 1. TourAPI contentId 형식(숫자) → 상세 API (유형은 카테고리로 결정)
 * 2. 그 외 → not-found (API 호출 없음)
 */
function resolveEnjoyDetail(category, id) {
  const contentTypeId = getEnjoyContentType(category)
  if (isTourContentId(id) && contentTypeId != null) return { kind: 'api', contentId: id, contentTypeId }
  return { kind: 'not-found' }
}

// Design Ref: §5.2 — 커버 위에는 소개의 첫 줄만, 최대 80자까지 보여 줍니다.
function toCoverText(description) {
  const firstLine = description.split('\n').find(line => line.trim())?.trim() ?? ''
  return firstLine.length > COVER_TEXT_LIMIT ? `${firstLine.slice(0, COVER_TEXT_LIMIT)}…` : firstLine
}

export default function EnjoyDetailPage() {
  const { category, id } = useParams()
  const { memberId } = useAuth()
  // '__proto__'·'constructor' 같은 프로토타입 키가 통과하지 않도록 Object.hasOwn으로 판별합니다.
  // Design Ref: §6 — 없는 카테고리에서는 404로 안내합니다.
  if (!Object.hasOwn(enjoyConfigs, category)) return <NotFoundPage />

  const config = enjoyConfigs[category]
  const backTo = `/enjoy/${category}`
  const resolved = resolveEnjoyDetail(category, id)

  if (resolved.kind === 'api') {
    return (
      <TourApiDetail
        // S1: bookmarked는 토큰 기반 개인화 값이라 로그인 상태가 바뀌면 상세를 다시 받아야 합니다.
        // memberId를 key에 넣어 상세 전체를 재마운트하면 재조회와 saved 초기값 재계산이 함께 일어납니다.
        key={`${resolved.contentId}:${resolved.contentTypeId}:${memberId ?? 'guest'}`}
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
  // TourApiDetail이 id·회원마다 key로 재마운트하므로(§2.3, S1) effect 없이 초기값만으로 충분합니다.
  // 한계(S2, 이번 범위 밖): 토큰 복원이 네트워크 오류로 실패하면 토큰 없이 요청되어 bookmarked가 조용히 false로 올 수 있습니다.
  const [saved, setSaved] = useState(Boolean(detail.bookmarked))
  // S3: 요청이 끝나기 전 중복 토글을 막습니다. ref는 같은 렌더 안의 연속 클릭도 즉시 막고, state는 버튼 disabled에 씁니다.
  const savingRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  // 북마크·공유 결과 안내 문구. 새 동작을 시작할 때마다 지우고, 결과가 실패일 때만 채웁니다.
  const [actionMessage, setActionMessage] = useState('')
  // Design Ref: §5.2 — 외부 이미지 URL이 깨지면 카테고리 커버로 한 번만 바꿉니다(무한 onError 방지).
  const [isImageBroken, setIsImageBroken] = useState(false)
  const coverImage = detail.image && !isImageBroken ? detail.image : config.cover
  const coverText = toCoverText(detail.description)
  const telHref = toTelHref(detail.contact)
  const goBack = () => window.history.length > 1 ? window.history.back() : navigate(`/enjoy/${category}`)

  // Design Ref: mypage-bookmarks.design.md §7.1 — 낙관적으로 먼저 바꾸고, 실패하면 되돌린다. contentTypeId는 카테고리 slug로 결정됩니다.
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
        key: `tour-bookmark:${getEnjoyContentType(category)}:${detail.id}`,
        apply: patch => setSaved(patch.saved),
        optimisticPatch: { saved: !saved },
        revertPatch: { saved },
        request: () => toggleTourBookmark({
          contentId: detail.id,
          contentTypeId: getEnjoyContentType(category),
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

  async function handleShare() {
    setActionMessage('')
    const result = await sharePage({ title: detail.title })
    if (result === 'copied') setActionMessage(DETAIL_SHARE_COPIED_MESSAGE)
    if (result === 'failed') setActionMessage(DETAIL_SHARE_FAILED_MESSAGE)
  }

  return <div className="enjoy-detail-page"><main className="enjoy-detail-main enjoy-detail-main--api">
    <button className="enjoy-detail-back" type="button" onClick={goBack}>← 이전 페이지</button>
    <nav className="enjoy-detail-crumb" aria-label="현재 위치"><Link to="/enjoy">여행 즐기기</Link><i>›</i><Link to={`/enjoy/${category}`}>{config.title}</Link><i>›</i><strong>{detail.title}</strong></nav>
    <header className="enjoy-detail-title"><div><span>{detail.typeLabel || config.title}</span><h1>{detail.title}</h1><p><PlacePinIcon size={19}/>{detail.address}</p></div><div className="enjoy-detail-action-group"><div className="enjoy-detail-actions"><button type="button" onClick={handleShare}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>공유</button><button type="button" className={saved?'active':''} aria-pressed={saved} disabled={isSaving} onClick={handleToggleSave}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.75L6 21V4.75Z"/></svg>{saved?'저장됨':'저장'}</button></div><DetailActionMessage message={actionMessage} /></div></header>
    <section className="enjoy-detail-cover">
      <img src={coverImage} alt={detail.title} onError={() => setIsImageBroken(true)}/>
      <div><small>TRAVEL EXPERIENCE</small>{coverText && <strong>{coverText}</strong>}</div>
    </section>
    <section className="enjoy-detail-content">
      <article>
        <small>ABOUT</small><h2>{detail.title} 소개</h2>
        <p className="lead">{detail.description || DETAIL_EMPTY_DESCRIPTION_MESSAGE}</p>
        <div className="enjoy-detail-guide">
          <h3>이용 안내</h3>
          {detail.infos.length > 0
            ? detail.infos.map((info, index) => <p key={`${info.label}-${index}`}><b>{info.label}</b><span>{info.value}</span></p>)
            : <p className="enjoy-detail-guide__empty">{DETAIL_EMPTY_INFOS_MESSAGE}</p>}
        </div>
      </article>
      <aside>
        <span>방문 전 확인</span><h2>최신 정보를 확인하세요</h2><p>운영시간, 요금, 예약 가능 여부는 현지 사정에 따라 변경될 수 있습니다.</p>
        {/* 실제 문의처가 있을 때만 표시합니다. */}
        {detail.contact && (
          <p className="enjoy-detail-contact">
            <b>문의</b>
            {telHref ? <a href={telHref}>{detail.contact}</a> : <span>{detail.contact}</span>}
          </p>
        )}
      </aside>
    </section>
  </main></div>
}
