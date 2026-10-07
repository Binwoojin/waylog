import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { applyCourseQueryPatch, createCourseListQuery, parseCourseListQuery, serializeCourseListQuery } from '../lib/courseListQuery'

/*
 * 여행코스 목록 조건을 URL로 읽고 쓰는 훅
 *
 * Design Ref: tour-course-list-integration.design.md §2.3, §3.1 — useListSearchParams와 같은 원칙
 * (URL이 유일한 상태 원천, 정규 URL이 아니면 replace로 교정)을 코스 쿼리 모델에 맞게 다시 만듭니다.
 * 코스는 "조건 없음" 상태가 없으므로 query는 항상 유효한 객체입니다(null 없음).
 */
export function useCourseListSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo(() => parseCourseListQuery(searchParams), [searchParams])

  const currentSearch = searchParams.toString()
  const canonicalSearch = serializeCourseListQuery(query).toString()

  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true })
    }
  }, [canonicalSearch, currentSearch, setSearchParams])

  const updateQuery = useCallback((patch, { replace = false } = {}) => {
    const next = applyCourseQueryPatch(query, patch)
    setSearchParams(serializeCourseListQuery(next), { replace })
  }, [query, setSearchParams])

  const resetQuery = useCallback(() => {
    setSearchParams(serializeCourseListQuery(createCourseListQuery()))
  }, [setSearchParams])

  return { query, updateQuery, resetQuery }
}
