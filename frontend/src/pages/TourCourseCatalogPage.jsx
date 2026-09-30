import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import CourseListView from '../components/tour-list/CourseListView'
import { useCourseListSearchParams } from '../hooks/useCourseListSearchParams'
import './DestinationCatalogPage.css'
import './TourCourseCatalogPage.css'

/**
 * 여행코스 카탈로그 (`/destinations/courses`)
 *
 * Design Ref: tour-course-list-integration.design.md §7.1 — DestinationCatalogPage의 course 목업 분기를
 * 대체합니다. 관광지·문화시설이 이미 TourCatalogPage로 분리돼 있는 것과 대칭입니다.
 * 코스는 탭(테마별)이 없습니다. TourCourse.theme이 자유 텍스트라 정형 탭을 만들 근거 데이터가
 * 없기 때문입니다(계획 §7.1 위험 분석). 대신 키워드 검색창 하나로 제목·테마를 함께 검색합니다.
 */
export default function TourCourseCatalogPage() {
  const { query, updateQuery, resetQuery } = useCourseListSearchParams()
  const [keywordInput, setKeywordInput] = useState(query.keyword)
  // 렌더 중 파생(react-hooks/set-state-in-effect 회피, useTourList·useCourseList와 같은 원칙):
  // 마지막으로 맞춰 둔 keyword를 함께 기억해 두고, URL의 keyword가 그 값과 달라졌을 때만
  // (뒤로 가기·검색 모달에서 이동 등 외부 요인) 렌더 중에 입력창을 다시 맞춥니다.
  // 사용자가 타이핑 중(아직 제출 전)인 값은 query.keyword 자체가 그대로라 덮어쓰지 않습니다.
  const [syncedKeyword, setSyncedKeyword] = useState(query.keyword)
  if (query.keyword !== syncedKeyword) {
    setSyncedKeyword(query.keyword)
    setKeywordInput(query.keyword)
  }

  const handlePageChange = useCallback((page, options) => updateQuery({ page }, options), [updateQuery])

  const handleSubmit = event => {
    event.preventDefault()
    updateQuery({ keyword: keywordInput })
  }

  const handleReset = () => {
    setKeywordInput('')
    resetQuery()
  }

  return (
    <div className="catalog-page">
      <main className="catalog-main">
        <p className="catalog-breadcrumb">
          <Link to="/">홈</Link><span>›</span><Link to="/destinations">여행지</Link><span>›</span>여행코스
        </p>
        <div className="catalog-title">
          <div>
            <h1>코스를 따라 떠나는 여행</h1>
            <p>여러 장소를 순서대로 둘러보는 추천 코스를 확인해 보세요.</p>
          </div>
        </div>

        <form className="course-catalog__search" role="search" onSubmit={handleSubmit}>
          <label className="course-catalog__search-label" htmlFor="course-keyword">
            코스명이나 테마로 검색
          </label>
          <div className="course-catalog__search-box">
            <input
              id="course-keyword"
              type="text"
              value={keywordInput}
              onChange={event => setKeywordInput(event.target.value)}
              placeholder="예) 제주, 빵집 투어"
            />
            <button type="submit">검색</button>
          </div>
        </form>

        <CourseListView
          query={query}
          onPageChange={handlePageChange}
          onReset={handleReset}
          resetLabel="검색어 지우기"
        />
      </main>
    </div>
  )
}
