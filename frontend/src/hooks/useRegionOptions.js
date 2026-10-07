import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { fetchDistricts, fetchRegions, getCachedDistricts, getCachedRegions } from '../api/tourApi'

/*
 * 지역·시군구 선택지 훅
 *
 * Design Ref: §2.2, §4.2 — 목록 필터 바, 검색 모달, 검색 결과 배너(코드 → 이름) 세 곳이 씁니다.
 * 반환값은 OptionList { status: 'loading' | 'error' | 'ready', options: Option[], onRetry? } 입니다(§3.5).
 * 화면은 선택지가 API에서 왔는지 상수인지 모릅니다.
 *
 * 캐시는 tourApi 모듈이 가집니다(FR-13). 이 훅은 캐시를 읽고, 없으면 요청해 결과를 state에 둡니다.
 * 진행 상태는 useTourList와 같이 state에 쓰지 않고 key 비교로 파생합니다.
 */

const EMPTY_OPTIONS = Object.freeze([])
const READY_EMPTY = Object.freeze({ status: 'ready', options: EMPTY_OPTIONS })

// cacheKey가 null이면 요청하지 않고 빈 ready를 돌려줍니다(예: 시·도를 고르기 전의 시군구).
function useOptionList(cacheKey, load, readCache) {
  const [retryState, setRetryState] = useState({ key: null, count: 0 })
  const attempt = retryState.key === cacheKey ? retryState.count : 0
  const requestKey = cacheKey == null ? null : `${cacheKey}#${attempt}`
  const [settled, setSettled] = useState({ key: null, status: null, options: EMPTY_OPTIONS })

  // Design Ref: §4.2 — 이미 끝난 캐시는 렌더 중에 동기로 읽어 첫 렌더부터 ready로 보여 줍니다.
  // 모달을 두 번째 열 때 "불러오는 중"이 깜빡이지 않습니다.
  const cachedOptions = cacheKey == null ? null : readCache()

  const loadOptions = useEffectEvent(() => load())
  const hasCache = useEffectEvent(() => readCache() != null)

  useEffect(() => {
    if (requestKey == null || hasCache()) return undefined

    // 캐시된 Promise는 여러 컴포넌트가 공유하므로 취소하지 않고, 언마운트 뒤 도착한 결과만 무시합니다.
    let isActive = true
    loadOptions().then(
      options => {
        if (isActive) setSettled({ key: requestKey, status: 'ready', options })
      },
      error => {
        if (!isActive) return
        console.error('지역 선택지를 불러오지 못했습니다.', error)
        setSettled({ key: requestKey, status: 'error', options: EMPTY_OPTIONS })
      },
    )

    return () => {
      isActive = false
    }
  }, [requestKey])

  // 실패한 Promise는 tourApi가 캐시에서 지웠으므로, key만 바꾸면 새로 요청합니다.
  const onRetry = useCallback(() => {
    setRetryState(previous => ({
      key: cacheKey,
      count: previous.key === cacheKey ? previous.count + 1 : 1,
    }))
  }, [cacheKey])

  if (cacheKey == null) return READY_EMPTY
  if (cachedOptions) return { status: 'ready', options: cachedOptions }
  if (settled.key === requestKey) {
    return settled.status === 'error'
      ? { status: 'error', options: EMPTY_OPTIONS, onRetry }
      : { status: 'ready', options: settled.options }
  }
  return { status: 'loading', options: EMPTY_OPTIONS }
}

// 시·도 목록 → OptionList ({ value: lDongRegnCd, label: 이름 })
export function useRegions() {
  return useOptionList('regions', fetchRegions, getCachedRegions)
}

// 시군구 목록 → OptionList ({ value: lDongSignguCd, label: 이름 }). lDongRegnCd가 없으면 빈 ready
export function useDistricts(lDongRegnCd) {
  const code = lDongRegnCd ? String(lDongRegnCd) : null
  const load = useCallback(() => fetchDistricts(code), [code])
  const readCache = useCallback(() => getCachedDistricts(code), [code])
  return useOptionList(code == null ? null : `districts:${code}`, load, readCache)
}
