import { SORT_OPTIONS } from '../../data/tourListConfigs'

/**
 * 목록 필터 바: 지역 · 시군구 · 정렬 select (표시 컴포넌트)
 *
 * Design Ref: §5.2 — 선택지(OptionList)와 현재 query를 props로 받습니다. 훅·API를 import하지 않습니다.
 * 카탈로그는 세 필드 모두, 검색 결과는 정렬만 씁니다(fields={['arrange']}).
 * 지역 목록 로딩·실패는 이 select에만 표시하고 목록 조회를 막지 않습니다(§6).
 *
 * @param onChange (patch) => void. 값이 ''이면 "전체"입니다. page·시군구 초기화 규칙은 applyQueryPatch가 적용합니다.
 */
export default function ListFilterBar({
  fields = ['region', 'district', 'arrange'],
  query,
  regions,
  districts,
  onChange,
}) {
  const regionCode = query?.lDongRegnCd ?? ''
  const districtCode = query?.lDongSignguCd ?? ''

  return (
    <div className="tour-list__filters">
      {fields.includes('region') && (
        <OptionSelect
          label="지역"
          value={regionCode}
          optionList={regions}
          allLabel="전국"
          errorLabel="지역을 불러오지 못했어요"
          onChange={value => onChange({ lDongRegnCd: value })}
        />
      )}
      {fields.includes('district') && (
        <OptionSelect
          label="시군구"
          value={districtCode}
          optionList={districts}
          allLabel="전체"
          errorLabel="시군구를 불러오지 못했어요"
          disabledLabel={regionCode ? null : '시·도를 먼저 선택'}
          onChange={value => onChange({ lDongSignguCd: value })}
        />
      )}
      {fields.includes('arrange') && (
        <label className="catalog-select">
          <span>정렬</span>
          <select value={query?.arrange ?? SORT_OPTIONS[0].value} onChange={event => onChange({ arrange: event.target.value })}>
            {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

/*
 * OptionList { status, options, onRetry } 하나를 select로 그립니다.
 * - loading: disabled + "불러오는 중"
 * - error: 안내 옵션 1개 + [다시 시도]
 * - ready: '전체' + 선택지. URL 값이 목록에 없으면(없는 지역 코드) "알 수 없는 지역"을 임시로 보여 줘
 *   표시와 URL이 어긋나지 않게 합니다(§3.2).
 * - disabledLabel이 있으면(시·도를 고르기 전의 시군구) 그 안내만 보여 주고 비활성입니다.
 */
function OptionSelect({ label, value, optionList, allLabel, errorLabel, disabledLabel = null, onChange }) {
  const { status, options, onRetry } = optionList
  const isKnownValue = value === '' || options.some(option => option.value === value)

  let content
  if (disabledLabel) content = <option value={value}>{disabledLabel}</option>
  else if (status === 'loading') content = <option value={value}>불러오는 중</option>
  else if (status === 'error') content = <option value={value}>{errorLabel}</option>
  else {
    content = (
      <>
        <option value="">{allLabel}</option>
        {!isKnownValue && <option value={value}>알 수 없는 {label}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </>
    )
  }

  return (
    <div className="tour-list__filter">
      <label className="catalog-select">
        <span>{label}</span>
        <select
          value={value}
          disabled={Boolean(disabledLabel) || status !== 'ready'}
          onChange={event => onChange(event.target.value)}
        >
          {content}
        </select>
      </label>
      {!disabledLabel && status === 'error' && onRetry && (
        <button className="tour-list__retry" type="button" aria-label={`${label} 목록 다시 불러오기`} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  )
}
