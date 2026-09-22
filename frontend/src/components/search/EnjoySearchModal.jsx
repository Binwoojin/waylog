import SearchModal from './SearchModal'

const regions = ['전체']

const enjoyTypes = [
  { id: 'festival', icon: '🎉', title: '축제 · 행사' },
  { id: 'leports', icon: '🚴', title: '레포츠' },
  { id: 'food', icon: '🍽️', title: '음식점' },
  { id: 'shopping', icon: '🛍️', title: '쇼핑' },
  { id: 'stay', icon: '🛏️', title: '숙박' },
]

export default function EnjoySearchModal({ isOpen, onClose }) {
  return (
    <SearchModal
      isOpen={isOpen}
      onClose={onClose}
      variant="enjoy"
      titleId="enjoy-search-title"
      closeLabel="여행 즐길거리 검색 닫기"
      title="여행 즐길거리 찾기"
      description="지역과 유형을 선택하면 원하는 여행정보를 찾아드려요."
      step1Title="1. 어디에서 즐길까요?"
      regions={regions}
      regionGroupClassName="enjoy-search-modal__region-options"
      step2Title="2. 무엇을 찾고 있나요?"
      types={enjoyTypes}
      typeGridClassName="enjoy-search-modal__type-grid"
      buildDetailHeading={type => (type ? `어떤 ${type} 항목을 찾고 있나요?` : '어떤 세부 항목을 찾고 있나요?')}
      summaryTypeLabel="즐길거리 유형"
      searchPath="/enjoy/search"
    />
  )
}
