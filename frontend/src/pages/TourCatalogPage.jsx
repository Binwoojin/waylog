import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import ListFilterBar from '../components/tour-list/ListFilterBar'
import TourListView from '../components/tour-list/TourListView'
import { getListConfig } from '../data/tourListConfigs'
import { useListSearchParams } from '../hooks/useListSearchParams'
import { useDistricts, useRegions } from '../hooks/useRegionOptions'
import { applyQueryPatch, serializeTourListQuery } from '../lib/tourListQuery'
import './DestinationCatalogPage.css'

/**
 * 관광지(12)·문화시설(14) 카탈로그
 *
 * Design Ref: §5.2 FR-05 ~ FR-10 — 목록 조건(탭·지역·시군구·정렬·페이지)은 URL에만 둡니다.
 * 이 페이지는 URL 해석과 화면 조립만 맡고, 조회와 상태별 화면은 TourListView가 맡습니다.
 * 여행코스(목업)는 훅 구성이 달라 DestinationCatalogPage에 남깁니다. 한 컴포넌트에서 분기하면
 * 코스에서도 목록 훅이 실행됩니다(§2.2).
 *
 * App.jsx가 key={kind}로 렌더합니다. 관광지 ↔ 문화시설 이동 시 다른 유형의 카드가
 * refreshing으로 잠시 보이지 않고 스켈레톤부터 시작합니다(§5.2).
 */
export default function TourCatalogPage({ kind }) {
  const config = getListConfig(kind)
  if (!config) return null
  return <TourCatalogContent config={config} />
}

const CATALOG_TAB_ALL = { code: null, label: '전체' }

function TourCatalogContent({ config }) {
  const { query, updateQuery, resetQuery } = useListSearchParams({ contentTypeId: config.contentTypeId })
  const regions = useRegions()
  const districts = useDistricts(query?.lDongRegnCd ?? null)

  const handlePageChange = useCallback((page, options) => updateQuery({ page }, options), [updateQuery])

  // Design Ref: §5.2 — 탭은 버튼이 아니라 링크입니다. 새 탭으로 열 수 있고, 뒤로 가기가 자연스럽습니다.
  // 탭을 바꾸면 applyQueryPatch가 page를 1로 돌리고, 지역·정렬은 유지합니다.
  const getTabPath = category => {
    const search = serializeTourListQuery(applyQueryPatch(query, { category }), { includeContentType: false }).toString()
    return search ? `${config.path}?${search}` : config.path
  }

  const tabs = [CATALOG_TAB_ALL, ...config.categories]

  return (
    <div className="catalog-page">
      <main className="catalog-main">
        <p className="catalog-breadcrumb">
          <Link to="/">홈</Link><span>›</span><Link to="/destinations">여행지</Link><span>›</span>{config.breadcrumb}
        </p>
        <div className="catalog-title">
          <div>
            <h1>{config.title}</h1>
            <p>{config.description}</p>
          </div>
        </div>

        <nav className="catalog-tabs" aria-label={`${config.breadcrumb} 분류`}>
          {tabs.map(tab => {
            const isActive = (query?.category ?? null) === tab.code
            return (
              <Link
                key={tab.label}
                className={`tour-list__tab${isActive ? ' is-active' : ''}`}
                to={getTabPath(tab.code ?? '')}
                aria-current={isActive ? 'true' : undefined}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>

        <div className="catalog-toolbar">
          <ListFilterBar query={query} regions={regions} districts={districts} onChange={updateQuery} />
        </div>

        <TourListView
          query={query}
          onPageChange={handlePageChange}
          onReset={resetQuery}
          resetLabel="조건 초기화"
        />
      </main>
    </div>
  )
}
