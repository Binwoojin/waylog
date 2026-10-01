import { useEffect, useEffectEvent, useId, useState } from 'react'
import { createCourseListQuery } from '../../lib/courseListQuery'
import { fetchCourseList, fetchCourseDetail } from '../../api/courseApi'
import { isAbortError, ApiError } from '../../api/client'
import AdminPagination from '../admin/AdminPagination'
import './CourseReferencePicker.css'

/**
 * 여행코스 일자·경유지 선택 모달 (피드 작성 폼 전용)
 *
 * Design Ref: tour-course-feed-linking.design.md §6.1(D-5) — `TourReferencePicker`(TourAPI
 * 콘텐츠 전용)와 완전히 독립된 컴포넌트다. 계획 §7.1 위험표가 지적한 대로, 두 데이터
 * 소스(외부 TourAPI vs 내부 TourCourse)를 한 컴포넌트에 억지로 묶으면 복잡도만 커지고,
 * Q-1 확정(일자 필수 + 경유지 선택)으로 이 선택 흐름은 TourAPI 피커보다 한 단계 더
 * 깊어(코스 검색 → 일자·경유지 선택) `TourReferencePicker`의 "검색해서 바로 고른다"는
 * 흐름과 구조 자체가 다르다. `TourReferencePicker.jsx`는 이 작업으로 한 글자도 수정하지 않는다.
 *
 * 2단계 모달:
 *  1) 코스 검색(courseApi.fetchCourseList 재사용, AdminPagination 재사용 — TourReferencePicker와 같은 패턴)
 *  2) 선택한 코스의 상세(courseApi.fetchCourseDetail 재사용)에서 일자 또는 경유지를 선택
 *
 * onSelect({ courseId, courseTitle, dayId, dayNumber, stopId, stopName })를 호출한다.
 * stopId/stopName은 "일자 단위"로 선택하면 null이다(설계 §3.2 "경유지 없이 일자만"도
 * 유효한 참조 상태).
 */
export default function CourseReferencePicker({ open, onCancel, onSelect }) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCourseId, setSelectedCourseId] = useState(null)

  const titleId = useId()

  // ---- 1단계: 코스 검색 (TourReferencePicker와 동일한 "렌더 중 파생" 상태 패턴) ----
  const searchKey = open && !selectedCourseId ? `${keyword}#${page}` : null
  const [settled, setSettled] = useState({ key: null, status: null, data: null })

  const requestSearch = useEffectEvent(signal => {
    const query = createCourseListQuery({ keyword, page })
    return fetchCourseList(query, { signal })
  })

  useEffect(() => {
    if (searchKey == null) return undefined

    const controller = new AbortController()
    let isActive = true

    requestSearch(controller.signal)
      .then(data => {
        if (isActive) setSettled({ key: searchKey, status: 'success', data })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        console.error('여행코스 검색에 실패했습니다.', error)
        setSettled({ key: searchKey, status: 'error', data: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [searchKey])

  // ---- 2단계: 선택한 코스 상세(일자·경유지 트리) ----
  // 1단계 검색과 같은 "렌더 중 파생" 패턴 — effect 안에서 setState를 동기로 두 번(로딩 시작 +
  // 완료) 부르면 react-hooks/set-state-in-effect(cascading render) 경고가 발생하므로,
  // "마지막으로 끝난 요청" 하나만 저장해 두고 status는 selectedCourseId와 비교해 그 자리에서 계산한다.
  const [detailSettled, setDetailSettled] = useState({ key: null, status: null, detail: null })

  useEffect(() => {
    if (!selectedCourseId) return undefined

    let isActive = true

    fetchCourseDetail(selectedCourseId)
      .then(detail => {
        if (isActive) setDetailSettled({ key: selectedCourseId, status: 'success', detail })
      })
      .catch(error => {
        if (!isActive) return
        if (!(error instanceof ApiError)) console.error('여행코스 상세 정보를 불러오지 못했습니다.', error)
        setDetailSettled({ key: selectedCourseId, status: 'error', detail: null })
      })

    return () => {
      isActive = false
    }
  }, [selectedCourseId])

  if (!open) return null

  const detailStatus = !selectedCourseId
    ? 'idle'
    : (detailSettled.key === selectedCourseId ? detailSettled.status : 'loading')
  const detail = detailSettled.key === selectedCourseId ? detailSettled.detail : null

  const previousSearchData = settled.status === 'success' ? settled.data : null
  const searchStatus = searchKey == null
    ? 'idle'
    : settled.key === searchKey
      ? settled.status
      : (previousSearchData ? 'refreshing' : 'loading')
  const searchResult = settled.key === searchKey ? settled.data : previousSearchData

  function changeKeyword(value) {
    setKeyword(value)
    setPage(1)
  }

  function selectCourse(course) {
    setSelectedCourseId(course.id)
  }

  function backToSearch() {
    setSelectedCourseId(null)
  }

  function handlePick(day, stop) {
    onSelect({
      courseId: detail.id,
      courseTitle: detail.title,
      dayId: day.id,
      dayNumber: day.dayNumber,
      stopId: stop ? stop.id : null,
      stopName: stop ? stop.name : null,
    })
  }

  return (
    <div className="admin-confirm-dialog__overlay" onClick={onCancel}>
      <section
        className="admin-confirm-dialog course-reference-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <h2 id={titleId} className="admin-confirm-dialog__title">여행코스 태그</h2>

        {!selectedCourseId && (
          <>
            <div className="course-reference-picker__search">
              <input
                type="text"
                placeholder="코스 이름으로 검색"
                value={keyword}
                onChange={event => changeKeyword(event.target.value)}
              />
            </div>

            <div className="course-reference-picker__results" aria-busy={searchStatus === 'refreshing' || undefined}>
              {searchStatus === 'loading' && <p className="course-reference-picker__message">검색 중입니다...</p>}
              {searchStatus === 'error' && (
                <p className="course-reference-picker__message" role="alert">검색에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>
              )}
              {(searchStatus === 'success' || searchStatus === 'refreshing') && searchResult && searchResult.items.length === 0 && (
                <p className="course-reference-picker__message">조건에 맞는 여행코스가 없습니다.</p>
              )}
              {(searchStatus === 'success' || searchStatus === 'refreshing') && searchResult && searchResult.items.length > 0 && (
                <ul className="course-reference-picker__list">
                  {searchResult.items.map(course => (
                    <li key={course.id} className="course-reference-picker__item">
                      {course.image
                        ? <img src={course.image} alt="" />
                        : <span className="course-reference-picker__item-placeholder" aria-hidden="true" />}
                      <div className="course-reference-picker__item-body">
                        <p className="course-reference-picker__item-title">{course.title}</p>
                        <p className="course-reference-picker__item-meta">
                          {course.theme ? `${course.theme} · ` : ''}{course.dayCount}일 코스
                        </p>
                      </div>
                      <button type="button" className="admin-button admin-button--primary" onClick={() => selectCourse(course)}>
                        선택
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {searchResult && (
              <AdminPagination page={page} totalPages={searchResult.totalPages} onPageChange={setPage} />
            )}
          </>
        )}

        {selectedCourseId && (
          <div className="course-reference-picker__detail">
            <button type="button" className="admin-button course-reference-picker__back" onClick={backToSearch}>
              ← 코스 다시 검색
            </button>

            {detailStatus === 'loading' && <p className="course-reference-picker__message">불러오는 중입니다...</p>}
            {detailStatus === 'error' && (
              <p className="course-reference-picker__message" role="alert">여행코스 정보를 불러오지 못했습니다.</p>
            )}

            {detailStatus === 'success' && (
              <>
                <h3 className="course-reference-picker__course-title">{detail.title}</h3>
                <p className="course-reference-picker__hint">일자 전체를 태그하거나, 특정 경유지를 골라 태그할 수 있습니다.</p>

                <div className="course-reference-picker__days">
                  {detail.days.map(day => (
                    <section key={day.id ?? day.dayNumber} className="course-reference-picker__day">
                      <header className="course-reference-picker__day-header">
                        <span>{day.dayNumber}일차</span>
                        <button type="button" className="admin-button admin-button--primary" onClick={() => handlePick(day, null)}>
                          이 일자로 태그
                        </button>
                      </header>

                      {day.stops.length > 0 && (
                        <ul className="course-reference-picker__stops">
                          {day.stops.map(stop => (
                            <li key={stop.id ?? stop.sortOrder} className="course-reference-picker__stop">
                              <span>{stop.name}</span>
                              <button type="button" className="admin-button" onClick={() => handlePick(day, stop)}>
                                이 경유지로 태그
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="admin-confirm-dialog__actions">
          <button type="button" className="admin-button" onClick={onCancel}>닫기</button>
        </div>
      </section>
    </div>
  )
}
