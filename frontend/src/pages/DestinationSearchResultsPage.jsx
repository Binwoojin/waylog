import { useState } from 'react'
import TravelSearchModal from '../components/search/TravelSearchModal'
import ListFilterBar from '../components/tour-list/ListFilterBar'
import ListStatus from '../components/tour-list/ListStatus'
import TourListView from '../components/tour-list/TourListView'
import { findListCategory, getListConfigByContentType } from '../data/tourListConfigs'
import { useListSearchParams } from '../hooks/useListSearchParams'
import { useDistricts, useRegions } from '../hooks/useRegionOptions'
import '../pages/DestinationCatalogPage.css'
import './DestinationSearchResultsPage.css'

/**
 * 여행지 검색 결과 (FR-11)
 *
 * Design Ref: §5.3 — window.location.search를 직접 읽지 않고 useListSearchParams(검색 모드)를 씁니다.
 * URL의 contentTypeId가 없거나 허용값이 아니면(Q-6) API를 호출하지 않고 조건 선택 안내만 보여 줍니다.
 * 카드·건수·페이지네이션은 카탈로그와 같은 TourListView를 씁니다(D-7). 카드 마크업도 catalog-card로 같습니다.
 */
export default function DestinationSearchResultsPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // 검색 모드: contentTypeId 옵션을 주지 않아 parseTourListQuery가 URL에서 직접 읽습니다(카탈로그와 반대).
  // Design Ref: §5.1 — 검색 결과의 empty·invalid 주 버튼은 조건을 초기화하지 않고 모달을 엽니다(카탈로그와 다름).
  const { query, updateQuery } = useListSearchParams({ contentTypeId: undefined })
  const regions = useRegions()
  const districts = useDistricts(query?.lDongRegnCd ?? null)

  const openSearch = () => setIsSearchOpen(true)
  const closeSearch = () => setIsSearchOpen(false)
  const handlePageChange = (page, options) => updateQuery({ page }, options)

  if (!query) {
    // Design Ref: Q-6 — 조건 없는 전국 조회를 막습니다. /api/v1/search를 호출하지 않습니다.
    return (
      <div className="search-results-page">
        <main className="search-results-main">
          <ListStatus variant="no-query" onAction={openSearch} />
        </main>
        <TravelSearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      </div>
    )
  }

  const config = getListConfigByContentType(query.contentTypeId)
  const regionName = getRegionDisplayName(query, regions, districts)
  const detailLabel = findListCategory(config, query.category)?.fullLabel ?? null

  const conditionChips = [
    `지역 ${regionName}`,
    `유형 ${config.typeLabel}`,
    detailLabel && `상세 ${detailLabel}`,
  ].filter(Boolean)

  return (
    <div className="search-results-page">
      <main className="search-results-main">
        <section className="search-results-banner">
          <div className="search-results-banner__summary">
            <strong>선택한 조건으로 여행지를 찾았어요</strong>
            <p>{conditionChips.map(chip => <span key={chip}>{chip}</span>)}</p>
          </div>
          {/* Design Ref: §5.3 — 기존 "조건 변경"·"다시 검색" 두 버튼은 같은 동작이라 하나로 합쳤습니다. */}
          <div className="search-results-banner__actions">
            <button type="button" onClick={openSearch}>조건 변경</button>
          </div>
        </section>

        <h1>{regionName} {config.typeLabel} 검색 결과</h1>
        <p>선택한 조건에 맞는 한국관광공사 TourAPI 관광정보입니다.</p>

        <div className="catalog-toolbar">
          <ListFilterBar fields={['arrange']} query={query} onChange={updateQuery} />
        </div>

        <TourListView
          query={query}
          onPageChange={handlePageChange}
          onReset={openSearch}
          resetLabel="조건 변경"
          onRequestConditions={openSearch}
        />

        <p className="search-results-notice">ⓘ 운영시간, 휴무일 등 일부 정보는 제공되지 않을 수 있습니다.</p>
      </main>
      <TravelSearchModal isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
  )
}

// Design Ref: §5.3 — 코드 → 이름(useRegions·useDistricts). 로딩 중에는 "선택한 지역", 지역 조건이 없으면 "전국"
function getRegionDisplayName(query, regions, districts) {
  if (!query.lDongRegnCd) return '전국'
  if (regions.status !== 'ready') return '선택한 지역'

  const regionLabel = regions.options.find(option => option.value === query.lDongRegnCd)?.label
  if (!regionLabel) return '선택한 지역'
  if (!query.lDongSignguCd) return regionLabel

  if (districts.status !== 'ready') return regionLabel
  const districtLabel = districts.options.find(option => option.value === query.lDongSignguCd)?.label
  return districtLabel ? `${regionLabel} ${districtLabel}` : regionLabel
}
