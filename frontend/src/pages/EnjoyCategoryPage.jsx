import { useCallback, useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import EnjoyListView from '../components/tour-list/EnjoyListView'
import ListFilterBar from '../components/tour-list/ListFilterBar'
import { enjoyCategories, enjoyConfigs } from '../data/enjoyCategoryConfig'
import { getEnjoyContentType } from '../data/tourContentTypes'
import { DEFAULT_ENJOY_ARRANGE, applyEnjoyQueryPatch, createEnjoyListQuery } from '../lib/enjoyListQuery'
import NotFoundPage from './NotFoundPage'
import './DestinationCatalogPage.css'
import './EnjoyCategoryPage.css'
import './EnjoyCategoryPageOverrides.css'

/**
 * 즐길거리 카테고리별 목록 (`/enjoy/:category`)
 *
 * Design Ref: EnjoySearchResultsPage.jsx·TourCatalogPage.jsx와 같은 패턴입니다 — 목록 조회와
 * 로딩·빈·오류 상태는 EnjoyListView(실제 /api/v1/search 응답)가 맡고, 이 페이지는 라우트 해석과
 * 화면 조립만 합니다. 카드 목록은 실제 TourAPI 데이터(/api/v1/search)에서 받습니다.
 * config.title·description·cover·enjoyCategories(탭 목록)는 data/enjoyCategoryConfig.js의 정적 화면 설정입니다.
 *
 * 유형(contentTypeId)은 검색 결과 화면과 달리 사용자가 바꿀 수 없고 :category 라우트가 고정값으로
 * 정합니다(TourCatalogPage가 config.contentTypeId로 "카탈로그 모드"를 쓰는 것과 같은 원칙). 하지만
 * lib/enjoyListQuery.js·useEnjoyListSearchParams는 "검색 결과 모드"만 구현되어 있어(유형이 항상
 * URL 쿼리에 있어야 하고, serializeEnjoyListQuery가 contentTypeId를 무조건 직렬화함) 그대로 쓰면
 * 깨끗한 /enjoy/leports 대신 /enjoy/leports?contentTypeId=28 같은 중복 URL이 생깁니다
 * (lib/tourListQuery.js의 includeContentType 옵션에 해당하는 카탈로그 모드가 아직 없음). 그 두
 * 모듈은 방금 새로 만들어진 공용 인프라라 수정하지 않고, 대신 이 모듈이 내보내는 순수 함수
 * (createEnjoyListQuery·applyEnjoyQueryPatch)만 가져다 arrange·page만 URL에 두는 조립을
 * 이 페이지 안에서 합니다(CourseListView가 useCourseList를 병렬로 둔 것과 같은 이유).
 *
 * 지역 필터는 두지 않습니다. 과거의 "지역" select는 임시 데이터의 location 문자열을 파싱해 만든 가짜 선택지였고,
 * EnjoySearchModal(§조사)도 같은 이유로 지역·시군구 조건을 두지 않습니다 — TourSearchRequest는
 * lDongRegnCd·lDongSignguCd를 실제로 받지만(TourController가 service.getTours에 그대로 전달),
 * 즐기기 쪽 쿼리 모델(enjoyListQuery.js)과 검색 모달에는 아직 실제 지역 선택지가 연결되어 있지
 * 않습니다. 동작하지 않는 필터 UI를 유지하는 대신 "정렬"만 남깁니다(EnjoySearchResultsPage와 동일).
 *
 * 카드 목록·북마크 버튼은 두지 않습니다. EnjoyListView는 TourListView·CourseListView와 같은
 * TourCard(components/tour-list/TourCard.jsx)를 그려서, 북마크 버튼 없는 공용 카드 UI를 씁니다
 * (TourCard의 기존 설계 — "저장되지 않는 버튼은 사용자를 속입니다"). EnjoySearchResultsPage를
 * 변환했을 때도 같은 이유로 카드에 북마크 버튼을 두지 않았습니다. 이 페이지만 다시 자체 그리드를
 * 만들어 북마크 버튼을 유지하면 방금 통합한 목록 렌더링(스켈레톤·페이지네이션·빈/오류 상태)이
 * 두 화면에서 다시 갈라지므로, 북마크는 이미 실제 동작하는 상세 페이지(EnjoyDetailPage)에서
 * 하도록 합니다.
 */
export default function EnjoyCategoryPage() {
  const { category } = useParams()
  // URL 값은 사용자가 마음대로 넣을 수 있습니다. enjoyConfigs['constructor']처럼 프로토타입에서 올라온 값이
  // 통과하면 config.items에서 TypeError가 나므로, 객체가 직접 가진 키인지 Object.hasOwn으로 판별합니다.
  const config = Object.hasOwn(enjoyConfigs, category) ? enjoyConfigs[category] : null
  const contentTypeId = getEnjoyContentType(category)

  // Design Ref: §6 — 없는 카테고리를 축제 목록으로 대신 보여 주면 사용자가 잘못된 주소임을 알 수 없으므로 404로 안내합니다.
  // Hook 호출 순서를 지키기 위해 판별은 이 컴포넌트에서 하고, 상태를 쓰는 본문은 아래 컴포넌트로 분리합니다.
  if (!config || contentTypeId == null) return <NotFoundPage />

  // Design Ref: TourCatalogPage.jsx와 같은 이유로 key={category}를 둡니다. React Router는 같은
  // 경로(/enjoy/:category)의 파라미터만 바뀐 것으로 보고 이 컴포넌트를 리마운트하지 않는데, 그러면
  // useEnjoyList의 이전 카테고리 상태가 남아 status가 'refreshing'이 되어 전 카테고리 카드가
  // is-busy로 흐려진 채 새 데이터가 올 때까지 남습니다. key를 category로 주면 카테고리가 바뀔 때마다
  // 완전히 리마운트되어 스켈레톤부터 다시 시작합니다.
  return <EnjoyCategoryContent key={category} category={category} config={config} contentTypeId={contentTypeId} />
}

// query → URL 쿼리. 유형은 라우트가 가지므로(카탈로그 모드) contentTypeId는 URL에 두지 않습니다.
// 기본값(arrange='Q', page=1)은 생략합니다 — lib/enjoyListQuery.js의 serializeEnjoyListQuery와 같은 규칙입니다.
function serializeCategoryQuery(query) {
  const params = new URLSearchParams()
  if (!query) return params
  if (query.arrange !== DEFAULT_ENJOY_ARRANGE) params.set('arrange', query.arrange)
  if (query.page > 1) params.set('page', String(query.page))
  return params
}

function EnjoyCategoryContent({ category, config, contentTypeId }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo(
    () => createEnjoyListQuery({ contentTypeId, arrange: searchParams.get('arrange'), page: searchParams.get('page') }),
    [contentTypeId, searchParams],
  )

  const currentSearch = searchParams.toString()
  const canonicalSearch = serializeCategoryQuery(query).toString()

  // Design Ref: useEnjoyListSearchParams.js와 같은 정규 URL 교체 — 잘못된 값·기본값이 남은 URL을 바꿉니다.
  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true })
    }
  }, [canonicalSearch, currentSearch, setSearchParams])

  const updateQuery = useCallback((patch, { replace = false } = {}) => {
    const next = applyEnjoyQueryPatch(query, patch)
    setSearchParams(serializeCategoryQuery(next), { replace })
  }, [query, setSearchParams])

  const handlePageChange = (page, options) => updateQuery({ page }, options)
  // 이 화면엔 조건 선택 모달이 없습니다("빈 결과"·"잘못된 조건" 안내의 주 버튼은 다른 즐길거리
  // 유형을 고를 수 있는 허브 화면으로 보냅니다. 탭도 같은 화면 위에 이미 있습니다).
  const goToEnjoyHub = () => navigate('/enjoy')

  return (
    <div className="enjoy-catalog-page">
      <main className="enjoy-catalog-main">
        <nav className="enjoy-catalog-crumb"><Link to="/">홈</Link><i>›</i><Link to="/enjoy">여행 즐기기</Link><i>›</i><strong>{config.title}</strong></nav>
        <header className="enjoy-catalog-hero"><div><h1>{config.title}</h1><p>{config.description}</p></div><img src={config.cover} alt="" /></header>
        <nav className="enjoy-catalog-tabs" aria-label={`${config.title} 분류`}>
          {enjoyCategories.map(entry => {
            const isActive = entry.slug === category
            return (
              <Link
                className={isActive ? 'active' : ''}
                to={`/enjoy/${entry.slug}`}
                key={entry.slug}
                aria-current={isActive ? 'true' : undefined}
              >
                {entry.title}
              </Link>
            )
          })}
        </nav>

        <div className="catalog-toolbar">
          <ListFilterBar fields={['arrange']} query={query} onChange={updateQuery} />
        </div>

        <EnjoyListView query={query} onPageChange={handlePageChange} onRequestConditions={goToEnjoyHub} />
      </main>
    </div>
  )
}
