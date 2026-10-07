import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { applyEnjoyQueryPatch, parseEnjoyListQuery, serializeEnjoyListQuery } from '../lib/enjoyListQuery'

/*
 * 즐길거리 목록 조건을 URL로 읽고 쓰는 훅
 *
 * hooks/useListSearchParams.js와 같은 원칙(URL이 조건의 유일한 원천, query를 useState에 복사하지
 * 않음, 정규 URL이 아니면 replace로 교정)을 즐길거리 쿼리 모델에 맞게 다시 만듭니다.
 * EnjoySearchResultsPage는 검색 결과 전용 화면이라 useListSearchParams의 카탈로그 모드
 * (contentTypeId를 라우트가 정하는 경우)는 필요 없습니다.
 *
 * @returns { query, updateQuery(patch, { replace }) }
 *   query: EnjoyListQuery | null (유형이 없으면 null = 조건 없음)
 */
export function useEnjoyListSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const query = useMemo(() => parseEnjoyListQuery(searchParams), [searchParams])

  const currentSearch = searchParams.toString()
  const canonicalSearch = serializeEnjoyListQuery(query).toString()

  // Design Ref: useListSearchParams.js와 같은 정규 URL 교체 — 잘못된 값·기본값이 남은 URL을 바꿉니다.
  useEffect(() => {
    if (canonicalSearch !== currentSearch) {
      setSearchParams(new URLSearchParams(canonicalSearch), { replace: true })
    }
  }, [canonicalSearch, currentSearch, setSearchParams])

  const updateQuery = useCallback((patch, { replace = false } = {}) => {
    if (!query) return
    const next = applyEnjoyQueryPatch(query, patch)
    setSearchParams(serializeEnjoyListQuery(next), { replace })
  }, [query, setSearchParams])

  return { query, updateQuery }
}
