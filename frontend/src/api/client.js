const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/*
 * accessToken은 XSS 노출 위험이 있는 localStorage/sessionStorage 대신
 * 모듈 스코프의 메모리 변수로만 보관합니다. 새로고침 시 사라지므로
 * AuthContext가 refreshToken 쿠키로 재발급을 시도합니다.
 */
let accessToken = null
let onUnauthorized = null

export function setAccessToken(token) {
  accessToken = token ?? null
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

async function refreshAccessToken() {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) return false

    const data = await response.json().catch(() => ({}))
    if (!data.accessToken) return false

    accessToken = data.accessToken
    return true
  } catch {
    return false
  }
}

async function request(path, { method = 'GET', body, credentials, headers, retryOn401 = true } = {}) {
  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  const contentHeaders = body !== undefined ? { 'Content-Type': 'application/json' } : {}

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials,
    headers: { ...contentHeaders, ...authHeaders, ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && accessToken && retryOn401) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        return request(path, { method, body, credentials, headers, retryOn401: false })
      }
      onUnauthorized?.()
    }

    const error = new ApiError(data.message || `요청에 실패했습니다. (HTTP ${response.status})`, response.status, data)
    throw error
  }

  return data
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
}
