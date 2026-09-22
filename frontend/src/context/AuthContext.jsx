import { createContext, useCallback, useContext, useMemo, useState } from 'react'

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

  const login = useCallback(memberData => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memberData))
    } catch {
      // sessionStorage를 사용할 수 없는 환경(프라이빗 모드 등)에서도
      // 메모리 상의 로그인 상태는 유지되도록 무시합니다.
    }
    setMember(memberData)
  }, [])

  const logout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // no-op
    }
    setMember(null)
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
