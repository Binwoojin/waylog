import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import SearchModal from './SearchModal'
import { useSearchSelection } from '../../hooks/useSearchSelection'
import { useDistricts, useRegions } from '../../hooks/useRegionOptions'
import { getListConfigByContentType } from '../../data/tourListConfigs'
import { DEFAULT_ARRANGE, buildSearchResultsPath, parseTourListQuery } from '../../lib/tourListQuery'
import { buildCourseListPath } from '../../lib/courseListQuery'
import { travelTypes } from '../../data/travelTypes'

/*
 * 여행지 검색 모달 — 공용 SearchModal에 목록 query 모델(코드 값)을 연결합니다.
 *
 * Design Ref: §3.5, §5.4 — 모달 내용은 열릴 때 마운트됩니다. 그 시점 URL을 검색 모드로 파싱해
 * 초기 선택값을 채웁니다(검색 결과 페이지가 아니면 해당 파라미터가 없어 빈 선택이 됩니다).
 * 제출 시 navigate(buildSearchResultsPath(...)) 후 onClose()만 합니다.
 * HeroSection · DestinationsPage · DestinationSearchResultsPage의 사용 방식(isOpen, onClose)은 바뀌지 않습니다.
 *
 * 여행코스 유형 (tour-course-list-integration.design.md §9.3, D-4)
 * 지역 필터가 없으므로(D-3) 지역·세부 항목 대신 키워드 입력 하나로 동작하고, 제출하면 코스 전용
 * 검색 결과 화면 없이 카탈로그(`/destinations/courses?keyword=`)로 바로 이동합니다. 이 분기 덕분에
 * DestinationSearchResultsPage.jsx·lib/tourListQuery.js·data/tourListConfigs.js는 수정하지 않습니다.
 */

// 유형 선택값은 목록 query의 contentTypeId 문자열과 같게 둡니다(§3.5).
const TRAVEL_TYPE_VALUES = { attraction: '12', culture: '14', course: '25' }
const DETAIL_HEADING_BY_TYPE = { 12: '관광지를', 14: '문화시설을' }
const COURSE_TYPE_VALUE = TRAVEL_TYPE_VALUES.course

const TYPE_OPTIONS = {
  status: 'ready',
  options: travelTypes.map(item => ({
    value: TRAVEL_TYPE_VALUES[item.id],
    label: item.title,
    icon: item.icon,
    description: item.description,
  })),
}

// ready 상태의 OptionList 맨 앞에 "전국"/"전체" 항목을 붙입니다.
function withAllOption(optionList, allOption) {
  return { ...optionList, options: [allOption, ...optionList.options] }
}

function findLabel(optionList, value) {
  return optionList.options.find(option => option.value === value)?.label ?? null
}

export default function TravelSearchModal({ isOpen, onClose }) {
  // Design Ref: §5.4 — 모달 내용은 열릴 때 마운트됩니다(그 시점 URL로 초기화).
  if (!isOpen) return null
  return <TravelSearchDialog onClose={onClose} />
}

function TravelSearchDialog({ onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // 검색 모드(옵션 없음)로 파싱합니다. 검색 결과 페이지가 아니면 필수값(contentTypeId)이 없어 null입니다.
  const initialQuery = useMemo(() => parseTourListQuery(searchParams), [searchParams])
  // Design Ref: §9.3 — /destinations/courses는 contentTypeId를 쿼리가 아니라 라우트로 가지므로
  // initialQuery로는 잡히지 않습니다. 경로로 직접 판정해 유형·키워드 초기값을 채웁니다.
  const isOnCoursePath = location.pathname.startsWith('/destinations/courses')

  const [selection, actions] = useSearchSelection({
    region: initialQuery?.lDongRegnCd ?? '',
    district: initialQuery?.lDongSignguCd ?? '',
    type: initialQuery ? String(initialQuery.contentTypeId) : (isOnCoursePath ? COURSE_TYPE_VALUE : ''),
    detail: initialQuery?.category ?? '',
    keyword: isOnCoursePath ? (searchParams.get('keyword') ?? '') : '',
  })

  const isCourseType = selection.type === COURSE_TYPE_VALUE

  const regions = useRegions()
  const districts = useDistricts(selection.region || null)
  const regionOptions = withAllOption(regions, { value: '', label: '전국' })
  const districtOptions = withAllOption(districts, { value: '', label: '전체' })

  const selectedTypeConfig = selection.type ? getListConfigByContentType(selection.type) : null
  const detailOptions = withAllOption(
    {
      status: 'ready',
      options: selectedTypeConfig ? selectedTypeConfig.categories.map(category => ({ value: category.code, label: category.fullLabel })) : [],
    },
    { value: '', label: '전체' },
  )

  const regionLabel = selection.region ? findLabel(regionOptions, selection.region) : null
  const districtLabel = selection.district ? findLabel(districtOptions, selection.district) : null
  const typeLabel = selection.type ? findLabel(TYPE_OPTIONS, selection.type) : null
  const detailLabel = selection.detail ? findLabel(detailOptions, selection.detail) : null

  // Design Ref: §3.5, 기존 SearchModal 동작 — 지역은 시·도와 시군구가 둘 다 있을 때만 한 항목으로 보여 줍니다.
  // 여행코스는 지역이 없으므로 키워드를 대신 보여줍니다(§9.3).
  const summaryItems = isCourseType
    ? [
        { label: '여행 유형', value: typeLabel },
        selection.keyword ? { label: '검색어', value: selection.keyword } : null,
      ].filter(Boolean)
    : [
        regionLabel && districtLabel ? { label: '지역', value: `${regionLabel} ${districtLabel}` } : null,
        typeLabel ? { label: '여행 유형', value: typeLabel } : null,
        detailLabel ? { label: '상세 항목', value: detailLabel } : null,
      ].filter(Boolean)

  const canSubmit = Boolean(selection.type)

  const handleSubmit = () => {
    if (!canSubmit) return
    // Design Ref: §9.3 — 여행코스는 검색 결과 전용 화면 없이 카탈로그로 바로 이동합니다(D-4).
    const path = isCourseType
      ? buildCourseListPath({ keyword: selection.keyword, page: 1 })
      : buildSearchResultsPath({
          contentTypeId: selection.type,
          lDongRegnCd: selection.region || null,
          lDongSignguCd: selection.district || null,
          category: selection.detail || null,
          arrange: DEFAULT_ARRANGE,
          page: 1,
        })
    navigate(path)
    // Design Ref: §5.3 — 같은 라우트에서 쿼리만 바뀌면 ScrollToTop이 동작하지 않으므로 직접 맨 위로 올립니다.
    window.scrollTo({ top: 0 })
    onClose()
  }

  const detailHeading = DETAIL_HEADING_BY_TYPE[selection.type]

  return (
    <SearchModal
      frame={{
        titleId: 'travel-search-title',
        title: '여행지 찾기',
        description: '세 가지 조건을 선택하면 원하는 여행지를 찾아드려요.',
        closeLabel: '여행지 검색 닫기',
        variant: 'travel',
      }}
      onClose={onClose}
      steps={{
        step1Title: isCourseType ? '1. 어떤 코스를 찾고 있나요?' : '1. 어디로 떠나시나요?',
        step2Title: '2. 어떤 여행지를 찾고 있나요?',
        detailHeading: detailHeading ? `어떤 ${detailHeading} 찾고 있나요?` : '어떤 세부 항목을 찾고 있나요?',
      }}
      selection={selection}
      actions={actions}
      regionOptions={regionOptions}
      districtOptions={districtOptions}
      typeOptions={TYPE_OPTIONS}
      detailOptions={detailOptions}
      keywordStep={isCourseType ? {
        title: '코스명이나 테마로 검색해 보세요.',
        placeholder: '예) 제주, 빵집 투어',
        value: selection.keyword,
        onChange: actions.selectKeyword,
      } : undefined}
      typeGridClassName="travel-search-modal__type-grid"
      typeIconClassName="travel-search-modal__type-icon"
      showTypeDescription
      summaryItems={summaryItems}
      canSubmit={canSubmit}
      submitHint={canSubmit ? '조건에 맞는 여행 정보를 확인해 보세요.' : '여행지 유형을 선택해 주세요.'}
      onSubmit={handleSubmit}
    />
  )
}
