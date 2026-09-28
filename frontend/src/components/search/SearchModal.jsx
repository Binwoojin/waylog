import { useId } from 'react'
import SearchModalFrame from './SearchModalFrame'
import SearchOptionGroup from './SearchOptionGroup'
import './SearchModal.css'
import './EnjoySearchModal.css'

/**
 * 검색 모달 (재작성, 제어 컴포넌트)
 *
 * Design Ref: §5.4 — 여행지 모달과 즐기기 모달이 이 화면 구조 하나를 공유합니다.
 * 선택지가 API에서 왔는지 상수인지, 제출 시 어디로 이동하는지는 모릅니다(TravelSearchModal·EnjoySearchModal이 결정).
 * 기존 클래스(`travel-search-modal__*`, `enjoy-search-modal__*`)를 그대로 써서 두 모달의 모양이 바뀌지 않게 합니다.
 */
export default function SearchModal({
  frame,
  onClose,
  steps: { step1Title, step2Title, detailHeading, detailHint = '선택한 유형에 따라 항목이 달라져요.' },
  selection,
  actions,
  regionOptions,
  districtOptions,
  typeOptions,
  detailOptions,
  typeGridClassName,
  typeIconClassName,
  showTypeDescription = false,
  regionGroupClassName,
  summaryItems,
  canSubmit,
  submitHint,
  onSubmit,
}) {
  const baseId = useId()
  const regionLabelId = `${baseId}-region`
  const districtLabelId = `${baseId}-district`
  const typeLabelId = `${baseId}-type`
  const detailLabelId = `${baseId}-detail`

  const regionListClassName = regionGroupClassName
    ? `travel-search-modal__option-list ${regionGroupClassName}`
    : 'travel-search-modal__option-list'

  // Design Ref: §3.5 — 여행지 모달은 selection.region이 코드(lDongRegnCd)라 화면에 그대로 쓸 수 없습니다.
  // regionOptions(OptionList)에서 이름을 찾습니다(즐기기는 값 자체가 라벨이라 못 찾으면 그대로 씁니다).
  const selectedRegionLabel = selection.region
    ? regionOptions.options.find(option => option.value === selection.region)?.label ?? selection.region
    : null

  return (
    <SearchModalFrame
      titleId={frame.titleId}
      title={frame.title}
      description={frame.description}
      closeLabel={frame.closeLabel}
      variant={frame.variant}
      onClose={onClose}
      footer={
        <footer className="travel-search-modal__actions">
          <button type="button" onClick={actions.reset}>선택 초기화</button>
          <p>{submitHint}</p>
          <button type="button" disabled={!canSubmit} onClick={onSubmit}>선택한 조건으로 검색</button>
        </footer>
      }
    >
      <div className="travel-search-modal__section">
        <h3>{step1Title}</h3>
        <div className="travel-search-modal__region-box">
          <strong id={regionLabelId}>시 · 도 선택</strong>
          <p>먼저 여행할 지역을 선택해 주세요.</p>
          <SearchOptionGroup
            legendId={regionLabelId}
            optionList={regionOptions}
            selectedValue={selection.region}
            onSelect={actions.selectRegion}
            listClassName={regionListClassName}
          />
        </div>
        <div className="travel-search-modal__region-box">
          <strong id={districtLabelId}>시 · 군 · 구 선택</strong>
          <p>{selectedRegionLabel ? `${selectedRegionLabel}의 세부 지역을 선택해 주세요.` : '먼저 시 · 도를 선택해 주세요.'}</p>
          <SearchOptionGroup
            legendId={districtLabelId}
            optionList={districtOptions}
            selectedValue={selection.district}
            onSelect={actions.selectDistrict}
            disabled={!selection.region}
            disabledMessage="먼저 시 · 도를 선택해 주세요."
            listClassName="travel-search-modal__option-list travel-search-modal__district-list"
          />
        </div>
      </div>

      <div className="travel-search-modal__section">
        <h3 id={typeLabelId}>{step2Title}</h3>
        <SearchOptionGroup
          legendId={typeLabelId}
          optionList={typeOptions}
          selectedValue={selection.type}
          onSelect={actions.selectType}
          listClassName={typeGridClassName}
          renderOption={option => (
            <>
              {option.icon && <span className={typeIconClassName} aria-hidden="true">{option.icon}</span>}
              <strong>{option.label}</strong>
              {showTypeDescription && option.description && <small>{option.description}</small>}
            </>
          )}
        />
      </div>

      <div className="travel-search-modal__section">
        <div className="travel-search-modal__detail-title">
          <h3 id={detailLabelId}>3. {detailHeading}</h3>
          <span>{detailHint}</span>
        </div>
        <SearchOptionGroup
          legendId={detailLabelId}
          optionList={detailOptions}
          selectedValue={selection.detail}
          onSelect={actions.selectDetail}
          disabled={!selection.type}
          disabledMessage="먼저 유형을 선택해 주세요."
          listClassName="travel-search-modal__detail-options"
          buttonClassName="travel-search-modal__detail-button"
        />
      </div>

      <div className="travel-search-modal__summary">
        <h3>선택한 조건</h3>
        <div>
          {summaryItems.map(item => (
            <span key={item.label}>{item.label} <strong>{item.value}</strong></span>
          ))}
        </div>
      </div>
    </SearchModalFrame>
  )
}
