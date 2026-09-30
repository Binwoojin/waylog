import { useEffect, useEffectEvent, useId, useState } from 'react'
import { createTourListQuery } from '../../lib/tourListQuery'
import { fetchTourList } from '../../api/tourApi'
import { isAbortError } from '../../api/client'
import { TOUR_LIST_CONFIGS } from '../../data/tourListConfigs'
import { useRegions, useDistricts } from '../../hooks/useRegionOptions'
import AdminPagination from './AdminPagination'
import './TourReferencePicker.css'

/**
 * 여행코스 REFERENCE 경유지 선택 모달
 *
 * Design Ref: admin-dashboard.design.md §3.3.2, §5.3, 계획 5.4(FR-C05) — "기존 여행지
 * 카탈로그에서 검색해 참조" 입력 방식. destination-list-integration의 검색 모달(SearchModal)은
 * "조건을 고르고 /destinations/search로 이동"하는 화면 전환용이라 이 컴포넌트(한 항목을 골라
 * 폼에 반환)와 목적이 다르다. 그래서 모달 UI 자체는 새로 만들되, 실제 재사용 가능한 부분
 * — 여행지 조회 함수(fetchTourList)와 그 조건 만들기(createTourListQuery), 지역 선택지 훅
 * (useRegions/useDistricts), 유형·분류 정의(TOUR_LIST_CONFIGS) — 는 그대로 가져다 쓴다.
 * useTourList 자체(useSearchParams에 결합됨)는 모달이 URL을 갖지 않으므로 쓰지 않고,
 * 같은 fetchTourList 호출을 이 컴포넌트 전용의 간단한 effect로 감싼다. 페이지 크기(9)는
 * fetchTourList 내부의 LIST_PAGE_SIZE로 고정되어 있어 이 컴포넌트가 따로 정하지 않는다.
 */

export default function TourReferencePicker({ open, onCancel, onSelect }) {
  const [kind, setKind] = useState('attraction')
  const [category, setCategory] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [districtCode, setDistrictCode] = useState('')
  const [page, setPage] = useState(1)

  const titleId = useId()
  const config = TOUR_LIST_CONFIGS[kind]

  const regions = useRegions()
  const districts = useDistricts(regionCode || null)

  // 유형·분류·지역이 바뀌면 1페이지로 되돌린다(destination-list-integration의 updateQuery 규칙과 동일).
  function changeKind(nextKind) {
    setKind(nextKind)
    setCategory('')
    setPage(1)
  }
  function changeCategory(nextCategory) {
    setCategory(nextCategory)
    setPage(1)
  }
  function changeRegion(nextRegion) {
    setRegionCode(nextRegion)
    setDistrictCode('')
    setPage(1)
  }
  function changeDistrict(nextDistrict) {
    setDistrictCode(nextDistrict)
    setPage(1)
  }

  /*
   * Design Ref: useAdminCourseList.js와 같은 "렌더 중 파생" 패턴 — useEffect 안에서
   * setState를 동기로 부르면(react-hooks/set-state-in-effect) 캐스케이딩 렌더가 생긴다.
   * 대신 "마지막으로 끝난 요청"을 key와 함께 저장해 두고, 지금 필요한 조건의 key와
   * 비교해서 status를 그 자리에서 계산한다.
   */
  const requestKey = open ? `${kind}#${category}#${regionCode}#${districtCode}#${page}` : null
  const [settled, setSettled] = useState({ key: null, status: null, data: null })

  // useEffectEvent로 감싸면 effect의 의존성 배열에는 requestKey만 두면 되고(useTourList.js와 같은 패턴),
  // 이 함수 안에서는 항상 그 렌더의 최신 kind·category·region·district·page 값을 읽습니다.
  const requestSearch = useEffectEvent(signal => {
    const query = createTourListQuery({
      contentTypeId: config.contentTypeId,
      lDongRegnCd: regionCode || null,
      lDongSignguCd: districtCode || null,
      category: category || null,
      arrange: 'Q',
      page,
    })
    return fetchTourList(query, { signal })
  })

  useEffect(() => {
    if (requestKey == null) return undefined

    const controller = new AbortController()
    let isActive = true

    requestSearch(controller.signal)
      .then(data => {
        if (isActive) setSettled({ key: requestKey, status: 'success', data })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        console.error('여행지 검색에 실패했습니다.', error)
        setSettled({ key: requestKey, status: 'error', data: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [requestKey])

  if (!open) return null

  const previousData = settled.status === 'success' ? settled.data : null
  const status = requestKey == null
    ? 'idle'
    : settled.key === requestKey
      ? settled.status
      : (previousData ? 'refreshing' : 'loading')
  const result = settled.key === requestKey ? settled.data : previousData

  function handleSelect(item) {
    onSelect({
      tourContentId: item.id,
      tourContentTypeId: item.contentTypeId ?? config.contentTypeId,
      name: item.title,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    })
  }

  return (
    <div className="admin-confirm-dialog__overlay" onClick={onCancel}>
      <section
        className="admin-confirm-dialog admin-tour-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <h2 id={titleId} className="admin-confirm-dialog__title">여행지 검색</h2>

        <div className="admin-tour-picker__filters">
          <div className="admin-tour-picker__kind">
            {Object.entries(TOUR_LIST_CONFIGS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`admin-button${kind === key ? ' is-active' : ''}`}
                onClick={() => changeKind(key)}
              >
                {value.typeLabel}
              </button>
            ))}
          </div>

          <select value={category} onChange={event => changeCategory(event.target.value)}>
            <option value="">전체 분류</option>
            {config.categories.map(item => (
              <option key={item.code} value={item.code}>{item.fullLabel}</option>
            ))}
          </select>

          <select
            value={regionCode}
            onChange={event => changeRegion(event.target.value)}
            disabled={regions.status !== 'ready'}
          >
            <option value="">전국</option>
            {regions.options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={districtCode}
            onChange={event => changeDistrict(event.target.value)}
            disabled={!regionCode || districts.status !== 'ready'}
          >
            <option value="">전체 시군구</option>
            {districts.options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-tour-picker__results" aria-busy={status === 'refreshing' || undefined}>
          {status === 'loading' && <p className="admin-tour-picker__message">검색 중입니다...</p>}
          {status === 'error' && <p className="admin-tour-picker__message" role="alert">검색에 실패했습니다. 조건을 바꿔 다시 시도해 주세요.</p>}
          {(status === 'success' || status === 'refreshing') && result && result.items.length === 0 && (
            <p className="admin-tour-picker__message">조건에 맞는 여행지가 없습니다.</p>
          )}
          {(status === 'success' || status === 'refreshing') && result && result.items.length > 0 && (
            <ul className="admin-tour-picker__list">
              {result.items.map(item => (
                <li key={item.id} className="admin-tour-picker__item">
                  {item.image
                    ? <img src={item.image} alt="" />
                    : <span className="admin-tour-picker__item-placeholder" aria-hidden="true" />}
                  <div className="admin-tour-picker__item-body">
                    <p className="admin-tour-picker__item-title">{item.title}</p>
                    <p className="admin-tour-picker__item-address">{item.address}</p>
                  </div>
                  <button type="button" className="admin-button admin-button--primary" onClick={() => handleSelect(item)}>
                    선택
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {result && (
          <AdminPagination page={page} totalPages={result.totalPages} onPageChange={setPage} />
        )}

        <div className="admin-confirm-dialog__actions">
          <button type="button" className="admin-button" onClick={onCancel}>닫기</button>
        </div>
      </section>
    </div>
  )
}
