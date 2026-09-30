import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAbortError } from '../api/client'
import { fetchAdminNoticeList } from '../api/adminNoticeApi'

/*
 * 관리자 공지 목록 조회 훅
 *
 * Design Ref: admin-dashboard.design.md §2.3 — 검색어·페이지는 useSearchParams(URL)가 유일한 원천이고,
 * 서버 상태는 useTourList와 같은 "렌더 중 파생" 패턴을 따릅니다(계획 5.3 일관성 유지).
 *
 * 여행지 목록(useListSearchParams + useTourList)과 달리 조건이 keyword·page 두 개뿐이라
 * URL 파싱과 서버 조회를 훅 하나로 합쳤습니다. lib/tourListQuery처럼 여러 화면이 공유할 만큼
 * 복잡한 파싱 규칙이 없어, 분리해도 재사용·테스트 이점이 없기 때문입니다(과도한 추상화 방지).
 *
 * status: 'loading' | 'refreshing' | 'success' | 'error'
 * data: { items, page, totalPages, totalElements } | null (refreshing 중에는 이전 성공 결과)
 */
const PAGE_SIZE = 10

export function useAdminNoticeList() {
  const [searchParams, setSearchParams] = useSearchParams()

  const keyword = searchParams.get('keyword') ?? ''
  const rawPage = Number(searchParams.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  // 검색어가 바뀌면 1페이지로 되돌립니다(destination-list-integration의 updateQuery 규칙과 동일).
  const setKeyword = useCallback(next => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('keyword', next)
    else params.delete('keyword')
    params.delete('page')
    setSearchParams(params)
  }, [searchParams, setSearchParams])

  const setPage = useCallback(next => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }, [searchParams, setSearchParams])

  // queryKey는 검색어·페이지만으로 정해지는 "조건의 정체성"입니다.
  // requestKey는 그 조건에 attempt(재시도 횟수)를 더해, retry()를 눌러도 값이 바뀌어
  // effect가 다시 실행되게 합니다(Must Fix — useTourList.js:74-93과 같은 패턴).
  const queryKey = `${keyword}#${page}`

  const [retryState, setRetryState] = useState({ key: null, count: 0 })
  const attempt = retryState.key === queryKey ? retryState.count : 0
  const requestKey = `${queryKey}#${attempt}`

  const [settled, setSettled] = useState({ key: null, status: null, data: null })

  // requestKey가 바뀔 때만 effect를 다시 실행하고, 요청에는 그 렌더의 최신 keyword·page를 씁니다.
  const requestList = useEffectEvent(signal => fetchAdminNoticeList({ keyword, page, size: PAGE_SIZE }, { signal }))

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    requestList(controller.signal)
      .then(data => {
        if (isActive) setSettled({ key: requestKey, status: 'success', data })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        console.error('공지 목록을 불러오지 못했습니다.', error)
        setSettled({ key: requestKey, status: 'error', data: null })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [requestKey])

  const retry = useCallback(() => {
    setRetryState(previous => ({ key: queryKey, count: previous.key === queryKey ? previous.count + 1 : 1 }))
  }, [queryKey])

  const hasRetried = attempt > 0

  if (settled.key === requestKey) {
    return { keyword, page, size: PAGE_SIZE, setKeyword, setPage, status: settled.status, data: settled.data, retry, hasRetried }
  }

  // 아직 이 key의 응답이 없습니다. 이전 성공 결과가 있으면 유지(refreshing), 없으면 loading입니다.
  const previous = settled.status === 'success' ? settled.data : null
  return {
    keyword,
    page,
    size: PAGE_SIZE,
    setKeyword,
    setPage,
    status: previous ? 'refreshing' : 'loading',
    data: previous,
    retry,
    hasRetried,
  }
}
