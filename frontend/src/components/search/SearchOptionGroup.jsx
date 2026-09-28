/**
 * 선택지 버튼 그룹 (표시 컴포넌트)
 *
 * Design Ref: §3.5, §5.4 — `OptionList`({status, options, onRetry})만 받습니다.
 * 선택지가 API에서 왔는지(지역·시군구) 상수인지(유형·세부 항목) 모릅니다.
 *
 * - loading: 버튼 대신 "불러오는 중입니다" 한 줄(최소 높이 44px로 레이아웃이 흔들리지 않게)
 * - error: "선택지를 불러오지 못했어요" + [다시 시도]
 * - disabled(그룹 전체, 예: 시·도를 고르기 전의 시군구): disabledMessage 안내 한 줄
 * - ready: 버튼 목록. 각 버튼에 aria-pressed. 개별 옵션의 disabled + badge(예: '준비 중')는
 *   버튼을 숨기지 않고 비활성으로 보여 줍니다(선택할 수 없는 이유를 알 수 있게).
 * - 그룹 전체는 role="group" + aria-labelledby(단계 제목 id)
 */
export default function SearchOptionGroup({
  legendId,
  optionList,
  selectedValue,
  onSelect,
  disabled = false,
  disabledMessage,
  listClassName,
  buttonClassName,
  renderOption,
}) {
  const { status, options, onRetry } = optionList

  let content
  if (disabled) {
    content = <p className="search-option-group__hint">{disabledMessage}</p>
  } else if (status === 'loading') {
    content = <p className="search-option-group__hint">불러오는 중입니다</p>
  } else if (status === 'error') {
    content = (
      <p className="search-option-group__hint search-option-group__hint--error">
        선택지를 불러오지 못했어요
        {onRetry && (
          <button type="button" className="search-option-group__retry" onClick={onRetry}>
            다시 시도
          </button>
        )}
      </p>
    )
  } else {
    content = (
      <div className={listClassName}>
        {options.map(option => {
          const isSelected = selectedValue === option.value
          const className = [buttonClassName, isSelected ? 'is-selected' : ''].filter(Boolean).join(' ') || undefined
          return (
            <button
              key={option.value}
              type="button"
              className={className}
              aria-pressed={isSelected}
              disabled={option.disabled}
              onClick={() => onSelect(option.value)}
            >
              {renderOption ? renderOption(option, isSelected) : option.label}
              {option.badge && <span className="search-option-group__badge">{option.badge}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="group" aria-labelledby={legendId}>
      {content}
    </div>
  )
}
