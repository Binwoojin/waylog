import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiClient, setAccessToken, setUnauthorizedHandler } from '../api/client'

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

export function AuthProvider({ children }) {
  const [member, setMember] = useState(readStoredMember)

  const login = useCallback((memberData, accessToken) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memberData))
    } catch {
      // sessionStorage를 사용할 수 없는 환경(프라이빗 모드 등)에서도
      // 메모리 상의 로그인 상태는 유지되도록 무시합니다.
    }
    setAccessToken(accessToken)
    setMember(memberData)
  }, [])

  const clearAuth = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // no-op
    }
    setAccessToken(null)
    setMember(null)
  }, [])

  const logout = useCallback(() => {
    /*
     * Refresh Token 쿠키를 서버에서 정리해야 하므로 로그아웃 API를 호출합니다.
     * 이 요청이 실패해도 클라이언트 로그인 상태는 정리합니다.
     */
    apiClient.post('/api/v1/auth/logout', undefined, { credentials: 'include' }).catch(() => {
      // no-op: 서버 상태와 무관하게 클라이언트는 로그아웃 처리합니다.
    })
    clearAuth()
  }, [clearAuth])

  useEffect(() => {
    setUnauthorizedHandler(clearAuth)
  }, [clearAuth])

  useEffect(() => {
    /*
     * accessToken은 메모리에만 있어 새로고침하면 사라지므로,
     * 로그인 정보(member)가 남아있다면 refreshToken 쿠키로 재발급을 시도합니다.
     * 실패하면(쿠키 만료 등) 로그인 상태를 정리합니다.
     */
    if (!readStoredMember()) return

    apiClient
      .post('/api/v1/auth/refresh', undefined, { credentials: 'include' })
      .then(data => {
        if (data.accessToken) setAccessToken(data.accessToken)
        else clearAuth()
      })
      .catch(() => clearAuth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(() => ({ member, login, logout }), [member, login, logout])

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
