import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FESTIVAL_PREVIEW_SIZE } from '../api/tourApi'
import { useEnjoyList } from '../hooks/useEnjoyList'
import { useFestivalPreview } from '../hooks/useFestivalPreview'
import { createEnjoyListQuery } from '../lib/enjoyListQuery'
import { ENJOY_CONTENT_TYPES } from '../data/tourContentTypes'
import PageHero from '../components/common/PageHero'
import SectionStatus from '../components/common/SectionStatus'
import PlacePinIcon from '../components/icons/PlacePinIcon'
import TourCardPreview, { PREVIEW_COUNT } from '../components/tour-list/TourCardPreview'
import TourCardSkeleton from '../components/tour-list/TourCardSkeleton'
import EnjoySearchModal from '../components/search/EnjoySearchModal'
import festival from '../assets/enjoy/category-festival.png'
import leports from '../assets/enjoy/category-leports.png'
import food from '../assets/enjoy/category-food.png'
import shopping from '../assets/enjoy/category-shopping.png'
import stay from '../assets/enjoy/category-stay.png'
import fallbackImage from '../assets/figma/destination-jeju.png'
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

// 축제 기간 필터의 값은 백엔드 FestivalStatus(GET /api/v1/festivals의 status)와 같습니다.
const FESTIVAL_FILTERS = [
  { status: 'ALL', label: '전체' },
  { status: 'ONGOING', label: '진행 중' },
  { status: 'STARTS_THIS_WEEK', label: '이번 주 시작' },
  { status: 'UPCOMING', label: '곧 시작' },
]

// 카테고리 미리보기 쿼리는 모듈 상수로 둬서 렌더마다 새로 만들지 않습니다.
const CATEGORY_QUERIES = {
  leports: createEnjoyListQuery({ contentTypeId: ENJOY_CONTENT_TYPES.leports, arrange: 'Q', page: 1 }),
  food: createEnjoyListQuery({ contentTypeId: ENJOY_CONTENT_TYPES.food, arrange: 'Q', page: 1 }),
  shopping: createEnjoyListQuery({ contentTypeId: ENJOY_CONTENT_TYPES.shopping, arrange: 'Q', page: 1 }),
  stay: createEnjoyListQuery({ contentTypeId: ENJOY_CONTENT_TYPES.stay, arrange: 'Q', page: 1 }),
}

// 'yyyyMMdd'(TourAPI 날짜 형식) → 'yyyy.MM.dd'. 형식이 다르면 null입니다.
function formatCompactDate(value) {
  return typeof value === 'string' && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`
    : null
}

// 기간 표시입니다. 시작일이나 종료일 중 하나만 있으면 "시작 2026.10.01"처럼 어느 쪽 날짜인지 붙여 보여 줍니다.
function formatFestivalPeriod(startDate, endDate) {
  const start = formatCompactDate(startDate)
  const end = formatCompactDate(endDate)
  if (start && end) return `${start} ~ ${end}`
  if (start) return `시작 ${start}`
  if (end) return `종료 ${end}`
  return '일정 정보 없음'
}

// showMore가 true일 때만 href로 가는 '더보기 →' 링크를 붙입니다. 링크가 없는 섹션은 showMore를 생략합니다.
// moreLabel: 화면에는 '더보기'만 보이므로, 섹션마다 같은 문구의 링크를 스크린리더가 구분할 수 있게 붙이는 접근 가능한 이름입니다.
function SectionHeading({ title, description, href, moreLabel, showMore = false }) {
  return <div className="enjoy-heading"><div><h2>{title}</h2><p>{description}</p></div>{showMore && <Link to={href} aria-label={moreLabel}>더보기 <span aria-hidden="true">→</span></Link>}</div>
}

// 카테고리 미리보기입니다. 훅 결과를 공용 TourCardPreview에 넘깁니다. 카드 링크는 toTourCard가 만든 /enjoy/:category/:id 경로를 씁니다.
function EnjoyCategoryPreview({ query, emptyText }) {
  const { status, data, retry } = useEnjoyList(query, { size: PREVIEW_COUNT })

  return (
    <TourCardPreview
      status={status}
      items={data?.items}
      retry={retry}
      errorMessage="목록을 불러오지 못했어요."
      emptyMessage={emptyText}
    />
  )
}

function FestivalSection() {
  const [filter, setFilter] = useState('ALL')
  const preview = useFestivalPreview(filter)
  // 필터 버튼이 조작하는 결과 영역의 id입니다. useId를 써서 같은 페이지에 여러 번 렌더돼도 id가 겹치지 않습니다.
  const resultsId = useId()

  return (
    <section>
      <SectionHeading title="축제 · 행사 소식" description="기간에 따라 축제와 행사를 골라 볼 수 있어요." href="/enjoy/festivals" moreLabel="축제 · 행사 소식 더보기" showMore />

      <div className="enjoy-filter-row" role="group" aria-label="축제 기간 필터">
        {FESTIVAL_FILTERS.map(item => (
          <button
            key={item.status}
            type="button"
            className={item.status === filter ? 'is-active' : undefined}
            aria-pressed={item.status === filter}
            aria-controls={resultsId}
            onClick={() => setFilter(item.status)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id={resultsId}>
        {/* 로딩은 카드 자리 표시(TourCardSkeleton)로 보여 줘서, 결과가 도착해도 섹션 높이가 크게 바뀌지 않게 합니다. */}
        {preview.status === 'loading' && (
          <>
            <span className="enjoy-sr-only" role="status">축제와 행사를 불러오는 중입니다.</span>
            <TourCardSkeleton count={FESTIVAL_PREVIEW_SIZE} />
          </>
        )}
        {preview.status === 'error' && <SectionStatus variant="error" message="축제와 행사를 불러오지 못했어요." onRetry={preview.retry} />}
        {preview.status === 'success' && preview.items.length === 0 && (
          <SectionStatus message="선택한 기간에 해당하는 축제와 행사가 없어요." />
        )}
        {preview.status === 'success' && preview.items.length > 0 && (
          <div className="enjoy-news-grid">
            {preview.items.map(item => (
              <Link to={item.detailPath} key={item.id}>
                <article>
                  {/* 제목은 바로 아래 h3에 있으므로 이미지 alt는 비웁니다(스크린리더 중복 낭독 방지). */}
                  <img
                    src={item.image ?? fallbackImage}
                    alt=""
                    onError={event => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = fallbackImage
                    }}
                  />
                  <div>
                    <h3>{item.title}</h3>
                    {/* 장식 문자는 스크린리더가 읽지 않게 가리고, 기간 텍스트만 남깁니다. */}
                    <p><span aria-hidden="true">◷</span> {formatFestivalPeriod(item.startDate, item.endDate)}</p>
                    <p className="location-with-pin"><PlacePinIcon />{item.address}</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="enjoy-disclaimer">행사 일정은 현지 사정에 따라 변경될 수 있습니다.</p>
    </section>
  )
}

export default function TravelEnjoyPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { member } = useAuth()
  const navigate = useNavigate()

  // 피드의 글쓰기 버튼과 동일한 로그인 유도 패턴: 비로그인 상태면 로그인 화면으로, 로그인 상태면 피드로 이동합니다.
  function handleGoToRecord() {
    navigate(member ? '/feed' : '/login')
  }

  return <div className="travel-enjoy-page">
    <PageHero
      className="page-hero--enjoy"
      eyebrow="WAYLOG EXPERIENCE"
      title="여행을 더 즐겁게"
      description="축제부터 맛집, 숙소까지 여행에 필요한 정보를 둘러보세요."
      searchLabel="여행 즐길거리 검색"
      searchHint="지역과 콘텐츠 유형을 선택해 검색할 수 있어요."
      onSearch={() => setIsSearchOpen(true)}
      visual={
        // 여행의 여러 순간을 사진 엽서처럼 겹쳐 표현한 Hero 콜라주입니다.
        // aria-label은 이름을 가질 수 있는 역할(group)에만 유효하므로 role을 함께 지정합니다.
        <div className="enjoy-hero__collage" role="group" aria-label="축제, 레포츠, 음식, 쇼핑과 숙박 여행 이미지">
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
      }
    />

    <main className="enjoy-main">
      <section><SectionHeading title="무엇을 즐기고 싶나요?" description="여행 중 필요한 정보를 카테고리별로 빠르게 확인해 보세요." /><div className="enjoy-category-grid">{categories.map(item => <Link to={`/enjoy/${item.slug}`} key={item.title}><article><img src={item.image} alt="" /><div><h3>{item.title}</h3><p>{item.text}</p></div></article></Link>)}</div></section>

      <FestivalSection />

      <section className="enjoy-detail-section enjoy-detail-section--activity"><SectionHeading title="신나는 체험과 레포츠" description="몸으로 직접 즐기는 다양한 체험과 액티비티를 만나보세요." href="/enjoy/leports" moreLabel="신나는 체험과 레포츠 더보기" showMore /><EnjoyCategoryPreview query={CATEGORY_QUERIES.leports} emptyText="표시할 레포츠 정보가 아직 없어요." /></section>
      <section className="enjoy-detail-section enjoy-detail-section--food"><SectionHeading title="여행지에서 만나는 맛있는 순간" description="지역의 재료와 이야기가 담긴 특별한 맛을 경험해 보세요." href="/enjoy/food" moreLabel="여행지에서 만나는 맛있는 순간 더보기" showMore /><EnjoyCategoryPreview query={CATEGORY_QUERIES.food} emptyText="표시할 음식점 정보가 아직 없어요." /></section>
      <section className="enjoy-detail-section"><SectionHeading title="여행지에서 즐기는 쇼핑" description="전통시장부터 지역 특산품까지 여행의 즐거움을 담아보세요." href="/enjoy/shopping" moreLabel="여행지에서 즐기는 쇼핑 더보기" showMore /><EnjoyCategoryPreview query={CATEGORY_QUERIES.shopping} emptyText="표시할 쇼핑 정보가 아직 없어요." /></section>
      <section className="enjoy-detail-section enjoy-detail-section--stay"><SectionHeading title="여행의 하루를 마무리할 곳" description="지역별 숙박시설의 기본정보를 확인해 보세요." href="/enjoy/stay" moreLabel="여행의 하루를 마무리할 곳 더보기" showMore /><EnjoyCategoryPreview query={CATEGORY_QUERIES.stay} emptyText="표시할 숙박 정보가 아직 없어요." /><p className="enjoy-disclaimer">실시간 객실 가격과 예약 가능 여부는 제공하지 않습니다.</p></section>

      <section className="enjoy-record"><img src={record} alt="여행 기록 일러스트" /><h2>여행의 순간을 기록하고, 함께 나눠요</h2><button type="button" onClick={handleGoToRecord}>여행 기록하기</button></section>
    </main>
    <EnjoySearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
  </div>
}
