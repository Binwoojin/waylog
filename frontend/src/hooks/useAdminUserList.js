import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAbortError } from '../api/client'
import { fetchAdminUserList } from '../api/adminUserApi'

/*
 * 관리자 회원 목록 조회 훅
 *
 * Design Ref: admin-dashboard.design.md §2.3, useAdminNoticeList.js와 같은 패턴.
 *
 * queryKey(검색어·페이지로 정해지는 조건의 정체성)와 requestKey(queryKey + attempt)를 분리한다.
 * 이 분리가 빠지면 retry()를 호출해도 requestKey가 바뀌지 않아 effect가 재실행되지 않는다
 * (공지 목록 훅 code review Must Fix, useAdminNoticeList.js 참고).
 *
 * status: 'loading' | 'refreshing' | 'success' | 'error'
 * data: { items, page, totalPages, totalElements } | null (refreshing 중에는 이전 성공 결과)
 */
const PAGE_SIZE = 10

export function useAdminUserList() {
  const [searchParams, setSearchParams] = useSearchParams()

  const keyword = searchParams.get('keyword') ?? ''
  const rawPage = Number(searchParams.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

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

  const queryKey = `${keyword}#${page}`

  const [retryState, setRetryState] = useState({ key: null, count: 0 })
  const attempt = retryState.key === queryKey ? retryState.count : 0
  const requestKey = `${queryKey}#${attempt}`

  const [settled, setSettled] = useState({ key: null, status: null, data: null })

  const requestList = useEffectEvent(signal => fetchAdminUserList({ keyword, page, size: PAGE_SIZE }, { signal }))

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    requestList(controller.signal)
      .then(data => {
        if (isActive) setSettled({ key: requestKey, status: 'success', data })
      })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        console.error('회원 목록을 불러오지 못했습니다.', error)
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
