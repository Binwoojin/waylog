const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const AUTH_PATH_PREFIX = '/api/v1/auth/'
const REFRESH_PATH = '/api/v1/auth/refresh'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/*
 * 인증 상태 (모듈 메모리)
 *
 * Design Ref: §7 — Access Token은 XSS로 읽힐 수 있는 Web Storage가 아니라 모듈 변수에만 둡니다.
 * 새로고침하면 사라지지만, 앱 시작 시 Refresh 쿠키로 다시 발급받습니다(AuthContext 복원).
 *
 * authGeneration은 "누가 마지막으로 토큰을 정했는가"를 나타내는 번호입니다.
 * 로그인·로그아웃(setAccessToken)마다 증가하며, 재발급 요청이 끝났을 때 번호가 바뀌어 있으면
 * 그 사이에 더 새로운 인증 상태가 생긴 것이므로 늦게 도착한 재발급 결과를 적용하지 않습니다.
 */
let accessToken = null
let authGeneration = 0
let refreshPromise = null
let sessionExpiredHandler = null

export function setAccessToken(token) {
  accessToken = token || null
  authGeneration += 1
}

// Design Ref: §2.3 — client는 AuthContext를 import하지 않고 콜백 등록으로만 세션 만료를 알립니다(순환 의존 방지).
export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = typeof handler === 'function' ? handler : null
}

function isAuthPath(path) {
  return path.startsWith(AUTH_PATH_PREFIX)
}

async function request(path, { method = 'GET', body, credentials, headers } = {}, isRetry = false) {
  // Design Ref: §12 R-2 — 요청을 보낸 시점의 인증 세대를 기억합니다.
  // 401을 받은 시점에 읽으면, 그 사이 로그아웃했더라도 재발급이 성공해
  // "로그아웃된 화면 + 유효한 토큰" 상태가 될 수 있습니다.
  const sentGeneration = authGeneration
  const requestHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    // Design Ref: §2.2 — 토큰이 있으면 모든 요청에 Bearer 헤더를 붙입니다. 호출부가 직접 지정한 헤더가 우선합니다.
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new ApiError(data.message || `요청에 실패했습니다. (HTTP ${response.status})`, response.status, data)

    // Design Ref: §6.1 — 401만 "다시 인증하면 해결됨"으로 보고 재발급합니다.
    // 403(권한 부족)은 재발급해도 결과가 같으므로 그대로 던집니다.
    // /api/v1/auth/** 는 401이 "비밀번호 불일치·재발급 실패" 등 화면이 처리할 의미이므로 제외하고,
    // 재시도는 1회로 제한해 무한 루프를 막습니다.
    if (response.status === 401 && !isRetry && !isAuthPath(path)) {
      return retryAfterRefresh(path, { method, body, credentials, headers }, error, sentGeneration)
    }

    throw error
  }

  return data
}

async function retryAfterRefresh(path, options, originalError, sentGeneration) {
  // Design Ref: §12 R-2 — 요청을 보낸 뒤 로그인·로그아웃이 일어났다면 이 401은 지난 세대의 결과입니다.
  // 재발급하지 않고, 새 세대에 토큰이 있으면 그 토큰으로만 1회 재시도합니다.
  if (sentGeneration !== authGeneration) return retryWithCurrentToken(path, options, originalError)

  try {
    await refreshSession()
  } catch (refreshError) {
    // Design Ref: §6.1 — 네트워크 오류 등은 로그인 상태를 유지한 채 그대로 전달합니다.
    if (refreshError.status !== 401) throw refreshError

    // 재발급 도중 로그인·로그아웃이 일어났다면 이 실패는 이미 지난 상태에 대한 것이므로
    // 새 상태를 만료 처리하지 않습니다.
    if (sentGeneration === authGeneration) sessionExpiredHandler?.()
    throw originalError
  }

  // 재발급 도중 세대가 바뀌었다면 refreshSession은 토큰을 저장하지 않았으므로 같은 규칙을 따릅니다.
  if (sentGeneration !== authGeneration) return retryWithCurrentToken(path, options, originalError)

  return request(path, options, true)
}

function retryWithCurrentToken(path, options, originalError) {
  // 로그아웃으로 토큰이 없으면 재시도해도 401이므로 원래 오류를 그대로 전달합니다.
  if (!accessToken) return Promise.reject(originalError)
  return request(path, options, true)
}

/**
 * Refresh 쿠키로 Access Token을 재발급합니다.
 *
 * Design Ref: §2.2 — 여러 요청이 동시에 401을 받거나, StrictMode로 복원 effect가 두 번 실행돼도
 * 진행 중인 재발급 Promise 하나를 공유해 /auth/refresh 요청은 1회만 보냅니다(single-flight).
 *
 * 성공: { accessToken, member } 반환, 토큰 저장
 * 실패: ApiError(401 등) 또는 네트워크 오류를 그대로 던짐. 401이면 토큰도 제거
 */
export function refreshSession() {
  if (refreshPromise) return refreshPromise

  const generation = authGeneration

  const promise = request(REFRESH_PATH, { method: 'POST', credentials: 'include' })
    .then(data => {
      // 재발급 도중 로그인·로그아웃으로 토큰이 바뀌었다면 늦게 도착한 토큰으로 덮어쓰지 않습니다.
      if (generation === authGeneration && data.accessToken) {
        accessToken = data.accessToken
      }
      return data
    }, error => {
      // 서버가 "재발급 불가(401)"라고 답한 경우에만 토큰을 비웁니다. 네트워크 오류는 상태를 유지합니다.
      if (error.status === 401 && generation === authGeneration) {
        accessToken = null
      }
      throw error
    })
    .finally(() => {
      if (refreshPromise === promise) refreshPromise = null
    })

  refreshPromise = promise
  return promise
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
}
