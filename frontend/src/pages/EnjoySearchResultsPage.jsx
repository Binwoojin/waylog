import { useState } from 'react'
import EnjoyListView from '../components/tour-list/EnjoyListView'
import EnjoySearchModal from '../components/search/EnjoySearchModal'
import ListFilterBar from '../components/tour-list/ListFilterBar'
import ListStatus from '../components/tour-list/ListStatus'
import { useEnjoyListSearchParams } from '../hooks/useEnjoyListSearchParams'
import { getEnjoyTypeLabel } from '../lib/enjoyListQuery'
import '../pages/DestinationCatalogPage.css'
import './DestinationSearchResultsPage.css'
import './EnjoySearchResultsPage.css'

/**
 * 즐길거리 검색 결과
 *
 * Design Ref: DestinationSearchResultsPage.jsx와 같은 패턴입니다 — window.location.search를 직접
 * 읽지 않고 useEnjoyListSearchParams(URL이 유일한 조건 원천)를 쓰고, 카드·건수·페이지네이션은
 * EnjoyListView(TourListView와 같은 렌더 분기)가 실제 /api/v1/search 응답으로 그립니다.
 * URL에 유형(contentTypeId)이 없거나 허용값이 아니면 API를 호출하지 않고 조건 선택 안내만 보여
 * 줍니다(DestinationSearchResultsPage의 Q-6과 같은 원칙).
 *
 * 즐길거리 검색 모달(EnjoySearchModal)은 아직 지역·시군구·세부 항목에 실제 선택지가 없어("전체"
 * 하나뿐) 쿼리에 지역 조건을 두지 않습니다. 배너의 "지역" 칩은 그래서 항상 "전체"입니다 — 실제로
 * 걸리지 않는 조건을 거는 것처럼 보이지 않도록, 예전 화면에 있던 "상세" 칩(실제로는 아무것도
 * 거르지 않던 값)은 더 이상 표시하지 않습니다.
 */
export default function EnjoySearchResultsPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { query, updateQuery } = useEnjoyListSearchParams()

  const openSearch = () => setIsSearchOpen(true)
  const closeSearch = () => setIsSearchOpen(false)
  const handlePageChange = (page, options) => updateQuery({ page }, options)

  if (!query) {
    // 조건 없는 전체 조회를 막습니다. /api/v1/search를 호출하지 않습니다.
    return (
      <div className="search-results-page enjoy-results-page">
        <main className="search-results-main">
          <ListStatus
            variant="no-query"
            onAction={openSearch}
            title="찾으시는 즐길거리 조건을 선택해 주세요"
            description="즐길거리 유형을 고르면 맞는 여행정보를 찾아 드려요."
            actionLabel="조건 선택하기"
          />
        </main>
        <EnjoySearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      </div>
    )
  }

  const typeLabel = getEnjoyTypeLabel(query.contentTypeId)
  const conditionChips = ['지역 전체', `유형 ${typeLabel}`]

  return (
    <div className="search-results-page enjoy-results-page">
      <main className="search-results-main">
        <section className="search-results-banner">
          <div className="search-results-banner__summary">
            <strong>선택한 조건으로 여행 즐길거리를 찾았어요</strong>
            <p>{conditionChips.map(chip => <span key={chip}>{chip}</span>)}</p>
          </div>
          {/* Design Ref: DestinationSearchResultsPage.jsx — 기존 "조건 변경"·"다시 검색" 두 버튼은
              같은 동작(모달 열기)이라 하나로 합쳤습니다. */}
          <div className="search-results-banner__actions">
            <button type="button" onClick={openSearch}>조건 변경</button>
          </div>
        </section>

        <h1>{typeLabel} 검색 결과</h1>
        <p>선택한 조건에 맞는 한국관광공사 TourAPI 여행정보입니다.</p>

        <div className="catalog-toolbar">
          <ListFilterBar fields={['arrange']} query={query} onChange={updateQuery} />
        </div>

        <EnjoyListView query={query} onPageChange={handlePageChange} onRequestConditions={openSearch} />

        <p className="search-results-notice">운영시간, 행사 일정, 이용요금 등 일부 정보는 현지 사정에 따라 변경될 수 있습니다.</p>
      </main>
      <EnjoySearchModal isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
  )
}
