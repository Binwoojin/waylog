import { useSearchParams } from 'react-router-dom'
import SearchModal from './SearchModal'
import { useSearchSelection } from '../../hooks/useSearchSelection'

/*
 * 즐기기 검색 모달 — 공용 SearchModal에 "라벨 쿼리" 어댑터를 연결합니다.
 *
 * Design Ref: §3.6 — EnjoySearchResultsPage.jsx는 수정하지 않습니다. 이 어댑터가 만드는
 * 쿼리 문자열·이동 방식(location.href, 전체 새로고침)·키 순서·빈 값 유지가 기존과 바이트 단위로
 * 같아야 결과 페이지가 그대로 동작합니다. 어댑터 함수는 이 파일 안의 모듈 함수로만 두고
 * export하지 않습니다(react-refresh/only-export-components).
 */

const ENJOY_SEARCH_PATH = '/enjoy/search'

// 시·도·시군구·세부 항목은 실제 선택지가 없고 "전체" 하나뿐입니다(기존 SearchModal과 같음).
const ALL_OPTION = { value: '전체', label: '전체' }

const enjoyTypes = [
  { id: 'festival', icon: '🎉', title: '축제 · 행사' },
  { id: 'leports', icon: '🚴', title: '레포츠' },
  { id: 'food', icon: '🍽️', title: '음식점' },
  { id: 'shopping', icon: '🛍️', title: '쇼핑' },
  { id: 'stay', icon: '🛏️', title: '숙박' },
]

// title(라벨) 목록 → Option 목록. value = label(기존 SearchModal의 "선택값 = title" 규칙과 같음)
function toLabelOptions(items) {
  return items.map(item => ({ value: item.title, label: item.title, icon: item.icon }))
}

// 기존과 같은 코드로 쿼리 문자열을 만듭니다: 키 순서 region·district·type·detail 고정, 빈 값도 키를 남깁니다.
function buildEnjoySearchUrl(selection) {
  const params = new URLSearchParams({
    region: selection.region,
    district: selection.district,
    type: selection.type,
    detail: selection.detail,
  })
  return `${ENJOY_SEARCH_PATH}?${params.toString()}`
}

// 모달이 열릴 때 URL에서 초기 선택값을 읽습니다(기존은 페이지 마운트 시 window.location.search를 읽었습니다).
function readEnjoySelection(searchParams) {
  return {
    region: searchParams.get('region') || '',
    district: searchParams.get('district') || '',
    type: searchParams.get('type') || '',
    detail: searchParams.get('detail') || '',
  }
}

export default function EnjoySearchModal({ isOpen, onClose }) {
  // Design Ref: §5.4 — 모달 내용은 열릴 때 마운트됩니다. 그래야 그 시점 URL로 초기 선택값을 채웁니다.
  if (!isOpen) return null
  return <EnjoySearchDialog onClose={onClose} />
}

function EnjoySearchDialog({ onClose }) {
  const [searchParams] = useSearchParams()
  const [selection, actions] = useSearchSelection(readEnjoySelection(searchParams))

  const regionOptions = { status: 'ready', options: [ALL_OPTION] }
  const districtOptions = { status: 'ready', options: [ALL_OPTION] }
  const typeOptions = { status: 'ready', options: toLabelOptions(enjoyTypes) }
  const detailOptions = { status: 'ready', options: [ALL_OPTION] }

  // Design Ref: §3.6 — 지역은 시·도와 시군구가 둘 다 있을 때만 표시(기존과 같음).
  const summaryItems = [
    selection.region && selection.district ? { label: '지역', value: `${selection.region} ${selection.district}` } : null,
    selection.type ? { label: '즐길거리 유형', value: selection.type } : null,
    selection.detail ? { label: '상세 항목', value: selection.detail } : null,
  ].filter(Boolean)

  const handleSubmit = () => {
    // Design Ref: §3.6 — EnjoySearchResultsPage는 렌더 중 window.location.search를 직접 읽으므로
    // navigate()로 바꾸지 않고 전체 새로고침(location.href)을 그대로 유지합니다.
    window.location.href = buildEnjoySearchUrl(selection)
  }

  return (
    <SearchModal
      frame={{
        titleId: 'enjoy-search-title',
        title: '여행 즐길거리 찾기',
        description: '지역과 유형을 선택하면 원하는 여행정보를 찾아드려요.',
        closeLabel: '여행 즐길거리 검색 닫기',
        variant: 'enjoy',
      }}
      onClose={onClose}
      steps={{
        step1Title: '1. 어디에서 즐길까요?',
        step2Title: '2. 무엇을 찾고 있나요?',
        detailHeading: selection.type ? `어떤 ${selection.type} 항목을 찾고 있나요?` : '어떤 세부 항목을 찾고 있나요?',
      }}
      selection={selection}
      actions={actions}
      regionOptions={regionOptions}
      districtOptions={districtOptions}
      typeOptions={typeOptions}
      detailOptions={detailOptions}
      typeGridClassName="enjoy-search-modal__type-grid"
      regionGroupClassName="enjoy-search-modal__region-options"
      summaryItems={summaryItems}
      canSubmit
      submitHint="조건에 맞는 여행 정보를 확인해 보세요."
      onSubmit={handleSubmit}
    />
  )
}
