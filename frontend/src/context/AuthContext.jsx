import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as authApi from '../api/authApi'
import { setAccessToken, setSessionExpiredHandler } from '../api/client'

const STORAGE_KEY = 'waylogMember'
const AuthContext = createContext(null)

function readStoredMember() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/*
 * 회원 표시 정보(닉네임 등)만 sessionStorage에 둡니다.
 * Design Ref: §7 — Access Token은 저장하지 않습니다. 새로고침 직후 헤더가 비로그인으로
 * 깜빡이지 않도록 표시 정보만 먼저 보여주고, 실제 로그인 여부는 복원(/auth/refresh)으로 확정합니다.
 */
function writeStoredMember(memberData) {
  try {
    if (memberData) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memberData))
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage를 사용할 수 없는 환경(프라이빗 모드 등)에서도
    // 메모리 상의 로그인 상태는 유지되도록 무시합니다.
  }
}

export function AuthProvider({ children }) {
  const [member, setMember] = useState(readStoredMember)
  const [isRestoring, setIsRestoring] = useState(true)

  /*
   * 인증 상태가 바뀔 때마다(로그인·로그아웃·세션 만료) 증가하는 번호입니다.
   * Design Ref: §11.2-6 — 복원 요청이 진행 중일 때 로그인·로그아웃이 일어나면,
   * 늦게 도착한 복원 결과가 새 상태를 덮어쓰지 않도록 요청 시작 시점의 번호와 비교합니다.
   */
  const authVersionRef = useRef(0)

  const applyMember = useCallback(memberData => {
    writeStoredMember(memberData)
    setMember(memberData)
  }, [])

  const login = useCallback((memberData, accessToken) => {
    authVersionRef.current += 1
    setAccessToken(accessToken)
    applyMember(memberData)
  }, [applyMember])

  // Design Ref: §2.2 — 화면 상태를 먼저 비워 즉시 비로그인으로 보이게 한 뒤, 쿠키 삭제 API를 호출합니다.
  // Design Ref: §12 R-4 — 서버 호출 성공 여부를 반환합니다. 실패하면 Refresh 쿠키가 남아
  // 새로고침 시 다시 로그인될 수 있으므로, 호출한 화면이 사용자에게 알릴 수 있게 합니다.
  const logout = useCallback(async () => {
    authVersionRef.current += 1
    setAccessToken(null)
    applyMember(null)

    try {
      await authApi.logout()
      return true
    } catch {
      return false
    }
  }, [applyMember])

  // Design Ref: §2.2 — 보호 API 재발급이 실패하면 client가 이 콜백으로 알려 member를 해제합니다.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      authVersionRef.current += 1
      applyMember(null)
    })
    return () => setSessionExpiredHandler(null)
  }, [applyMember])

  // Design Ref: §2.2 — 앱 시작 시 Refresh 쿠키로 세션을 복원합니다.
  useEffect(() => {
    // StrictMode는 mount → cleanup → mount로 effect를 두 번 실행합니다.
    // 재발급 Promise는 client에서 공유되므로 네트워크 요청은 1회이고,
    // 첫 번째 실행의 결과는 isActive=false로 무시해 상태 적용도 한 번만 일어납니다.
    let isActive = true
    const startVersion = authVersionRef.current

    authApi.refresh()
      .then(data => {
        if (!isActive || startVersion !== authVersionRef.current) return
        if (data.member) applyMember(data.member)
      })
      .catch(error => {
        if (!isActive || startVersion !== authVersionRef.current) return
        // Design Ref: §6.1 — 401은 "로그인 세션 없음"이므로 비로그인으로 전환하고,
        // 네트워크·서버 오류는 판단할 수 없으므로 기존 표시를 유지합니다.
        if (error.status === 401) applyMember(null)
      })
      .finally(() => {
        if (isActive) setIsRestoring(false)
      })

    return () => {
      isActive = false
    }
  }, [applyMember])

  const value = useMemo(
    () => ({ member, isRestoring, login, logout }),
    [member, isRestoring, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- 컨텍스트와 훅을 한 파일에서 함께 제공하는 표준 패턴입니다.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  }
  return context
}
