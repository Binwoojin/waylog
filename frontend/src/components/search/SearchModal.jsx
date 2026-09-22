import { useEffect, useState } from 'react'
import './SearchModal.css'
import './EnjoySearchModal.css'

export default function SearchModal({
  isOpen,
  onClose,
  variant,
  titleId,
  closeLabel,
  title,
  description,
  step1Title,
  regions = ['전체'],
  regionGroupClassName,
  step2Title,
  types,
  typeGridClassName,
  typeIconClassName,
  showTypeDescription = false,
  buildDetailHeading,
  summaryTypeLabel,
  searchPath,
}) {
  const query = new URLSearchParams(window.location.search)
  const [region, setRegion] = useState(() => query.get('region') || '')
  const [district, setDistrict] = useState(() => query.get('district') || '')
  const [type, setType] = useState(() => query.get('type') || '')
  const [detail, setDetail] = useState(() => query.get('detail') || '')

  useEffect(() => {
    if (!isOpen) return undefined

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const resetSelections = () => {
    setRegion('')
    setDistrict('')
    setType('')
    setDetail('')
  }

  const searchWithSelections = () => {
    const params = new URLSearchParams({ region, district, type, detail })
    window.location.href = `${searchPath}?${params.toString()}`
  }

  const regionButtons = regions.map(item => (
    <button key={item} className={region === item ? 'is-selected' : ''} type="button" onClick={() => { setRegion(item); setDistrict('') }}>{item}</button>
  ))

  return (
    <div className={`travel-search-modal${variant === 'enjoy' ? ' enjoy-search-modal' : ''}`} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="travel-search-modal__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="travel-search-modal__close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
        <header>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </header>

        <div className="travel-search-modal__section">
          <h3>{step1Title}</h3>
          <div className="travel-search-modal__region-box">
            <strong>시 · 도 선택</strong>
            <p>먼저 여행할 지역을 선택해 주세요.</p>
            {regionGroupClassName ? <div className={regionGroupClassName}>{regionButtons}</div> : regionButtons}
          </div>
          <div className="travel-search-modal__region-box">
            <strong>시 · 군 · 구 선택</strong>
            <p>{region ? `${region}의 세부 지역을 선택해 주세요.` : '먼저 시 · 도를 선택해 주세요.'}</p>
            <button className={district === '전체' ? 'is-selected' : ''} type="button" disabled={!region} onClick={() => setDistrict('전체')}>전체</button>
          </div>
        </div>

        <div className="travel-search-modal__section">
          <h3>{step2Title}</h3>
          <div className={typeGridClassName}>
            {types.map(item => (
              <button key={item.id} className={type === item.title ? 'is-selected' : ''} type="button" onClick={() => { setType(item.title); setDetail('') }}>
                <span className={typeIconClassName} aria-hidden="true">{item.icon}</span>
                <strong>{item.title}</strong>
                {showTypeDescription && <small>{item.description}</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="travel-search-modal__section">
          <div className="travel-search-modal__detail-title"><h3>3. {buildDetailHeading(type)}</h3><span>선택한 유형에 따라 항목이 달라져요.</span></div>
          <button className={`travel-search-modal__detail-button ${detail === '전체' ? 'is-selected' : ''}`} type="button" disabled={!type} onClick={() => setDetail('전체')}>전체</button>
        </div>

        <div className="travel-search-modal__summary">
          <h3>선택한 조건</h3>
          <div>{region && district && <span>지역 <strong>{region} {district}</strong></span>}{type && <span>{summaryTypeLabel} <strong>{type}</strong></span>}{detail && <span>상세 항목 <strong>{detail}</strong></span>}</div>
        </div>

        <footer className="travel-search-modal__actions">
          <button type="button" onClick={resetSelections}>선택 초기화</button>
          <p>조건에 맞는 여행 정보를 확인해 보세요.</p>
          <button type="button" onClick={searchWithSelections}>선택한 조건으로 검색</button>
        </footer>
      </section>
    </div>
  )
}
