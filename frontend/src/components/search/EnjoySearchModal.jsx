import { useNavigate, useSearchParams } from 'react-router-dom'
import SearchModal from './SearchModal'
import { useSearchSelection } from '../../hooks/useSearchSelection'
import { getEnjoyContentType } from '../../data/tourContentTypes'
import { buildEnjoySearchPath, parseEnjoyListQuery } from '../../lib/enjoyListQuery'

/*
 * 즐기기 검색 모달 — 공용 SearchModal에 즐길거리 목록 query 모델(lib/enjoyListQuery.js)을 연결합니다.
 *
 * Design Ref: EnjoySearchResultsPage.jsx가 useEnjoyListSearchParams(URL이 유일한 조건 원천)로
 * 전환되면서, 이 모달도 TravelSearchModal과 같은 방식(navigate() 이동, 라벨이 아닌 코드 값 쿼리)으로
 * 맞춥니다. 예전에는 EnjoySearchResultsPage가 렌더 중 window.location.search를 직접 읽어서
 * window.location.href(전체 새로고침)로만 이동할 수 있었지만, 이제는 다른 검색 모달과 같은 SPA
 * 이동을 씁니다.
 *
 * 지역·시군구·세부 항목은 실제 선택지가 없고 "전체" 하나뿐이라(현재 즐길거리 검색은 유형만 실제로
 * 동작) 쿼리에 포함하지 않습니다. 화면의 세 단계 구성 자체는 바꾸지 않았습니다.
 */

const ALL_OPTION = { value: '전체', label: '전체' }

// value = 카테고리 slug(festivals 등). tourContentTypes.js의 ENJOY_CONTENT_TYPES 키와 같아서
// getEnjoyContentType으로 바로 contentTypeId를 구할 수 있습니다.
const enjoyTypes = [
  { id: 'festivals', icon: '🎉', title: '축제 · 행사' },
  { id: 'leports', icon: '🚴', title: '레포츠' },
  { id: 'food', icon: '🍽️', title: '음식점' },
  { id: 'shopping', icon: '🛍️', title: '쇼핑' },
  { id: 'stay', icon: '🛏️', title: '숙박' },
]

const TYPE_OPTIONS = {
  status: 'ready',
  options: enjoyTypes.map(item => ({ value: item.id, label: item.title, icon: item.icon })),
}

function findLabel(optionList, value) {
  return optionList.options.find(option => option.value === value)?.label ?? null
}

// 모달이 열릴 때 URL(검색 결과 쿼리)에서 초기 유형을 읽습니다. 지역·시군구·세부 항목은 실제
// 선택지가 없어 항상 빈 값입니다.
function readEnjoySelection(searchParams) {
  const query = parseEnjoyListQuery(searchParams)
  const type = query
    ? TYPE_OPTIONS.options.find(option => getEnjoyContentType(option.value) === query.contentTypeId)?.value ?? ''
    : ''
  return { region: '', district: '', type, detail: '' }
}

export default function EnjoySearchModal({ isOpen, onClose }) {
  // Design Ref: §5.4 — 모달 내용은 열릴 때 마운트됩니다. 그래야 그 시점 URL로 초기 선택값을 채웁니다.
  if (!isOpen) return null
  return <EnjoySearchDialog onClose={onClose} />
}

function EnjoySearchDialog({ onClose }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selection, actions] = useSearchSelection(readEnjoySelection(searchParams))

  const regionOptions = { status: 'ready', options: [ALL_OPTION] }
  const districtOptions = { status: 'ready', options: [ALL_OPTION] }
  const detailOptions = { status: 'ready', options: [ALL_OPTION] }

  const typeLabel = selection.type ? findLabel(TYPE_OPTIONS, selection.type) : null

  const summaryItems = [
    selection.region && selection.district ? { label: '지역', value: `${selection.region} ${selection.district}` } : null,
    typeLabel ? { label: '즐길거리 유형', value: typeLabel } : null,
    selection.detail ? { label: '상세 항목', value: selection.detail } : null,
  ].filter(Boolean)

  // Design Ref: TravelSearchModal.jsx와 같은 규칙 — 유형을 고르기 전에는 제출할 수 없습니다.
  const canSubmit = Boolean(selection.type)

  const handleSubmit = () => {
    if (!canSubmit) return
    navigate(buildEnjoySearchPath({ contentTypeId: getEnjoyContentType(selection.type) }))
    // Design Ref: §5.3 — 같은 라우트에서 쿼리만 바뀌면 ScrollToTop이 동작하지 않으므로 직접 맨 위로 올립니다.
    window.scrollTo({ top: 0 })
    onClose()
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
        detailHeading: typeLabel ? `어떤 ${typeLabel} 항목을 찾고 있나요?` : '어떤 세부 항목을 찾고 있나요?',
      }}
      selection={selection}
      actions={actions}
      regionOptions={regionOptions}
      districtOptions={districtOptions}
      typeOptions={TYPE_OPTIONS}
      detailOptions={detailOptions}
      typeGridClassName="enjoy-search-modal__type-grid"
      regionGroupClassName="enjoy-search-modal__region-options"
      summaryItems={summaryItems}
      canSubmit={canSubmit}
      submitHint={canSubmit ? '조건에 맞는 여행 정보를 확인해 보세요.' : '즐길거리 유형을 선택해 주세요.'}
      onSubmit={handleSubmit}
    />
  )
}
