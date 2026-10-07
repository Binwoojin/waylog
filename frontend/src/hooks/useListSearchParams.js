import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { applyQueryPatch, createTourListQuery, parseTourListQuery, serializeTourListQuery } from '../lib/tourListQuery'

/*
 * 목록 조건을 URL로 읽고 쓰는 훅
 *
 * Design Ref: §1.2, §2.3 — URL이 목록 조건의 유일한 원천입니다. query를 useState에 복사하지 않고
 * 매 렌더 URL에서 파생하므로 URL과 화면이 어긋날 수 없습니다.
 * 히스토리 정책(push/replace)을 이 훅 한 곳에서 정합니다.
 *
 * @param options.contentTypeId 있으면 카탈로그 모드(라우트가 유형 결정), 없으면 검색 결과 모드
 * @returns { query, updateQuery(patch, { replace }), resetQuery() }
 *   query: TourListQuery | null (검색 결과 모드에서 유형이 없으면 null = 조건 없음)
 */
export function useListSearchParams({ contentTypeId } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const includeContentType = contentTypeId == null

  // searchParams는 location.search가 같으면 같은 객체라, 같은 URL에서는 query도 같은 객체입니다.
  const query = useMemo(
    () => parseTourListQuery(searchParams, { contentTypeId }),
    [searchParams, contentTypeId],
  )

  const currentSearch = searchParams.toString()
  const canonicalSearch = serializeTourListQuery(query, { includeContentType }).toString()

  // Design Ref: §3.2 정규 URL 교체 — 잘못된 값·예전 형식 파라미터·기본값이 남은 URL을 정규 형식으로 바꿉니다.
  // replace를 쓰는 이유: 잘못된 URL이 히스토리에 남으면 뒤로 가기가 다시 정규화되는 루프가 생깁니다.
  // 첫 렌더부터 정규화된 query로 요청하므로, 교체 후에도 요청 key가 같아 요청이 한 번 더 나가지 않습니다.
  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true })
    }
  }, [canonicalSearch, currentSearch, setSearchParams])

  // Design Ref: §2.3 히스토리 정책 — 탭·지역·시군구·정렬·페이지 변경은 push(뒤로 가기로 직전 조건 복원).
  // 페이지 초과 보정처럼 사용자가 만든 이동이 아니면 { replace: true }로 호출합니다.
  const updateQuery = useCallback((patch, { replace = false } = {}) => {
    if (!query) return
    const next = applyQueryPatch(query, patch)
    setSearchParams(serializeTourListQuery(next, { includeContentType }), { replace })
  }, [query, includeContentType, setSearchParams])

  // Design Ref: §3.2 resetQuery — 카탈로그는 모든 파라미터를 지우고(유형은 라우트에 남음),
  // 검색 결과는 유형(contentTypeId)만 남깁니다. 사용자 동작이라 push입니다.
  const resetQuery = useCallback(() => {
    const base = query ? createTourListQuery({ contentTypeId: query.contentTypeId }) : null
    setSearchParams(serializeTourListQuery(base, { includeContentType }))
  }, [query, includeContentType, setSearchParams])

  return { query, updateQuery, resetQuery }
}
