import SearchModal from './SearchModal'
import { travelTypes } from '../../data/travelTypes'

const detailHeadingByType = {
  관광지: '관광지를',
  문화시설: '문화시설을',
  여행코스: '여행코스를',
}

export default function TravelSearchModal({ isOpen, onClose }) {
  return (
    <SearchModal
      isOpen={isOpen}
      onClose={onClose}
      variant="travel"
      titleId="travel-search-title"
      closeLabel="여행지 검색 닫기"
      title="여행지 찾기"
      description="세 가지 조건을 선택하면 원하는 여행지를 찾아드려요."
      step1Title="1. 어디로 떠나시나요?"
      step2Title="2. 어떤 여행지를 찾고 있나요?"
      types={travelTypes}
      typeGridClassName="travel-search-modal__type-grid"
      typeIconClassName="travel-search-modal__type-icon"
      showTypeDescription
      buildDetailHeading={type => {
        const label = detailHeadingByType[type]
        return label ? `어떤 ${label} 찾고 있나요?` : '어떤 세부 항목을 찾고 있나요?'
      }}
      summaryTypeLabel="여행 유형"
      searchPath="/destinations/search"
    />
  )
}
