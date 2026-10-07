# auth-token-flow 설계 문서

> **요약**: 설계안 C(실용 균형). 백엔드는 401/403 JSON 응답과 재발급 401·member 반환, 프론트는 client.js의 메모리 토큰·재발급·재시도와 새 authApi.js로 인증 흐름을 완성한다.
>
> **프로젝트**: WayLog
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-23
> **상태**: Draft
> **계획 문서**: `docs/01-plan/features/auth-token-flow.plan.md`

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 로그인해도 토큰이 없어 보호 API 호출이 불가능하고, 401/403이 구분되지 않아 재발급 로직을 만들 수 없다 |
| **WHO** | 로그인한 WayLog 사용자 (이후 피드·댓글·북마크 화면을 구현할 개발자 포함) |
| **RISK** | 재발급 무한 루프, 동시 401 시 중복 재발급, 새로고침 시 로그인 상태 깜빡임, 기존 공개 API 동작 변경 |
| **SUCCESS** | 보호 API가 로그인 시 200, 비로그인 시 401 / 새로고침 후 세션 복원 / 만료 시 1회 재발급 후 재시도 / 로그아웃 시 쿠키 삭제 |
| **SCOPE** | 백엔드 SecurityConfig·AuthService 재발급 → 프론트 api/client.js·authApi.js·AuthContext·LoginPage·Header |

---

## 1. 개요

### 1.1 설계 목표

- 보호 API 호출에 필요한 토큰 흐름(저장 → 전송 → 재발급 → 해제)을 끊김 없이 연결한다.
- 401은 "다시 인증하면 해결됨", 403은 "권한 부족"으로 의미를 고정해 프론트가 분기할 수 있게 한다.
- 화면 컴포넌트는 인증 API URL과 토큰을 직접 다루지 않는다.

### 1.2 설계 원칙

- **최소 변경**: 기존 fetch 래퍼와 AuthContext를 확장한다. 라이브러리를 추가하지 않는다.
- **설명 가능성**: 각 결정의 이유를 코드 주석과 이 문서로 설명할 수 있어야 한다 (포트폴리오 목적).
- **fail-safe**: 재발급 실패는 로그인 상태 해제로 끝나며, 재시도는 최대 1회다.

---

## 2. 설계안

### 2.0 설계안 비교

| 기준 | A. 최소 변경 | B. 클린 아키텍처 | C. 실용 균형 |
|------|:---:|:---:|:---:|
| 신규 파일 | 0 | 약 5 | 1 |
| 수정 파일 | 6 | 6 | 6 |
| 복잡도 | 낮음 | 높음 | 중간 |
| 유지보수성 | 중간 (URL 분산) | 높음 | 높음 |
| 작업량 | 적음 | 많음 | 적음~중간 |
| 위험 | 낮음 | 중간 | 낮음 |

**선택: C. 실용 균형** (사용자 선택, 2026-09-23)
**근거**: 화면이 인증 URL을 모르게 하면서도 파일 수를 최소로 유지한다. `LoginPage.jsx` 상단 주석이 이미 권장한 `src/api/authApi.js` 구조와 일치한다. 백엔드 핸들러 클래스 분리(B)는 현재 규모에 비해 과하다.

### 2.1 구성도

```
┌─────────────┐   authApi.login() ┌──────────────────┐              ┌──────────────┐
│ LoginPage   │ ────────────────▶ │ api/authApi.js   │ ─────────────▶ │ api/client.js│
│ Header      │                   │ (인증 API 함수)   │ (authGeneration)│ (세대 번호)  │
└──────┬──────┘   logout()         └────────┬─────────┘              └──────┬────────┘
       │                                    │                               │
       │                                    ▼                               ▼
       │          AuthContext.login/logout ┌──────────────┐  sessionExpired
       └────────────────────────────────▶ │ AuthContext  │ ◀──────────────┘
                                          │ (member,     │
                                          │ isRestoring, │
                                          │ authVersionRef)
                                          └──────────────┘
                                                 ▲
                                                 │ member
                                          ┌─────────────┐
                                          │   Header    │
                                          └─────────────┘

┌─────────────┐  get/post/put                                        
│ 기타 화면    │ ─────────────────────────────────────────────────▶ api/client.js
└─────────────┘                                                  (Bearer 헤더, 401 재시도)
                                                                      │
                                                                      ▼
                                               Spring Security (JwtAuthenticationFilter
                                               → authorize → 401/403 JSON 핸들러)
```

### 2.2 데이터 흐름

**로그인**
```
LoginPage → authApi.login() → POST /auth/login
         → { accessToken, member } + Set-Cookie refreshToken
         → AuthContext.login(member, accessToken) → client.setAccessToken, member 저장
```

**보호 API 호출과 재발급**
```
apiClient.get(path) → 요청 시점 sentGeneration 캡처 → Authorization: Bearer <token>
  ├ 2xx → 반환
  ├ 403 → ApiError 그대로 던짐 (재발급 안 함)
  └ 401 (인증 API 제외)
       → sentGeneration과 현재 authGeneration 비교
       → 바뀌었으면 (로그인/로그아웃 중) retryWithCurrentToken: 현재 토큰이 있으면 그것으로만 1회 재시도, 없으면 원 401 던짐
       → 같으면 refreshSession() (진행 중이면 같은 Promise 공유)
          ├ 성공 → 토큰 직접 저장 (세대는 안 올림) → 재발급 전후 세대 다시 비교
          │       → 일치: 새 토큰으로 1회 재시도 (member는 AuthContext가 처리)
          │       → 불일치: retryWithCurrentToken (세대가 바뀐 동안 로그인/로그아웃)
          └ 실패(401) → sentGeneration과 현재 authGeneration이 같을 때만 토큰 제거 + sessionExpiredHandler 호출 (세대는 안 올림)
             → 불일치이면 상태 유지
             실패(그 외) → 상태 유지, 오류 전파
```

**앱 시작 시 복원**
```
AuthProvider mount → authApi.refresh() (= refreshSession)
  ├ 성공 → member 갱신, 토큰 저장
  ├ 401 → member 해제 (비로그인)
  └ 네트워크 오류 → 기존 표시 유지
  → isRestoring = false
```

**로그아웃**
```
Header → AuthContext.logout() → 토큰·member 즉시 해제 → authApi.logout() (POST /auth/logout, 쿠키 삭제)
```

### 2.3 의존성

| 컴포넌트 | 의존 대상 | 목적 |
|----------|-----------|------|
| AuthContext | authApi, client(`setAccessToken`, `setSessionExpiredHandler`) | 인증 상태 관리 |
| authApi | client(`apiClient`, `refreshSession`) | 인증 API 호출 |
| LoginPage | AuthContext, authApi | 로그인 |
| Header | AuthContext | 표시·로그아웃 |
| client | 없음 (fetch) | HTTP, 토큰 |

순환 의존 방지: `client.js`는 AuthContext를 import하지 않고, 콜백 등록(`setSessionExpiredHandler`)으로만 알린다.

---

## 3. 데이터 모델

DB 변경 없음. 응답 객체만 정의한다.

```js
// member (login, refresh 공통)
{ memberId: number, email: string, nickname: string, role: string }

// role: GRADE가 null이면 "user" 기본값으로 반환한다.
```

---

## 4. API 명세

### 4.1 엔드포인트

| 메서드 | 경로 | 설명 | 인증 | 변경 |
|--------|------|------|------|------|
| POST | `/api/v1/auth/login` | 로그인 | 불필요 | **요청 `rememberLogin` Boolean, 성공 시 쿠키 유형 결정** |
| POST | `/api/v1/auth/refresh` | Access Token 재발급 | Refresh 쿠키 | **실패 400→401(검증), 성공 시 member 추가, 500일 때 쿠키 유지** |
| POST | `/api/v1/auth/logout` | Refresh 쿠키 삭제 | 불필요 | 없음 (프론트 연결만) |
| (전체) | `anyRequest().authenticated()` 대상 | 보호 API | Bearer | **미인증 403→401** |
| (전체) | `/api/v1/admin/**` | 관리자 API | Bearer + ROLE_ADMIN | **권한 부족 403 JSON** |

### 4.2 상세

#### `POST /api/v1/auth/login`

**요청**:
```json
{ "email": "user@example.com", "password": "***", "rememberLogin": false }
```

`rememberLogin`은 Boolean. `false`면 브라우저 종료 시 삭제되는 세션 쿠키, `true` 또는 값 없음(하위 호환)이면 7일 쿠키로 발급한다. Access Token은 항상 30분.

**성공 (200)**
```json
{ "accessToken": "eyJ...", "member": { "memberId": 1, "email": "a@b.com", "nickname": "여행자", "role": "user" } }
```

Refresh 쿠키도 함께 발급:
```
Set-Cookie: refreshToken=<jwt>; Path=/; Secure; HttpOnly; SameSite=Strict
  - rememberLogin=false: Max-Age·Expires 없음 (세션 쿠키, 브라우저 종료 시 삭제)
  - rememberLogin=true 또는 생략: Max-Age=604800 (7일)
```

#### `POST /api/v1/auth/refresh`

**요청**: body 없음, 쿠키 `refreshToken`. 프론트는 `credentials: 'include'`로 보낸다.

**성공 (200)**
```json
{ "accessToken": "eyJ...", "member": { "memberId": 1, "email": "a@b.com", "nickname": "여행자", "role": "user" } }
```

**실패 (401)**: 토큰·회원 검증 실패 (쿠키 없음, `IllegalArgumentException`, `ParseException`, `JOSEException`, 회원 없음)
```
Set-Cookie: refreshToken=; Max-Age=0; ...
```
```json
{ "message": "로그인이 만료되었습니다. 다시 로그인해 주세요." }
```

**실패 (500)**: 그 외 예외 (DB 오류, RuntimeException, checked Exception, 토큰 발급 단계의 JOSEException)
```
(쿠키 유지, 삭제 Set-Cookie 없음)
```
```json
Spring 기본 오류 응답 (message 필드 없음, 예외 메시지 미노출)
```

참고: 
- 401 대상인 검증 단계(`:149-151`)의 JOSEException은 토큰 형식/서명 문제로 봐서 401.
- 500 대상인 발급 단계(`:182-184`)의 JOSEException은 서버 설정 문제로 봐서 500으로 감싸짐.
- 기타 RuntimeException·checked Exception도 500으로 전파되며, 컨테이너의 ERROR 로그에 남는다.

#### 보호 API 공통 오류

| 상황 | 상태 | body |
|------|------|------|
| Authorization 헤더 없음 / 토큰 만료·위조 / 회원 없음 | 401 | `{ "message": "로그인이 필요합니다." }` |
| 인증됐지만 권한 부족 | 403 | `{ "message": "접근 권한이 없습니다." }` |

`Content-Type: application/json;charset=UTF-8`.
기존 `JwtAuthenticationFilter`는 잘못된 토큰이면 SecurityContext를 비우고 통과시키므로, permitAll API는 토큰 상태와 관계없이 기존처럼 200이다.

---

## 5. UI/UX

화면 레이아웃 변경 없음.

### 5.1 사용자 흐름

```
로그인 → 홈 (헤더에 닉네임) → 새로고침 → 헤더 유지 (복원) → 30분 후 보호 API → 자동 재발급 (사용자 인지 없음)
→ 7일 후 또는 쿠키 삭제 → 보호 API 401 → 헤더가 비로그인 상태로 전환 → 로그아웃 클릭 → 즉시 비로그인
```

### 5.2 변경 컴포넌트

| 컴포넌트 | 위치 | 변경 |
|----------|------|------|
| LoginPage | `src/pages/LoginPage.jsx` | `authApi.login` 사용, `login(member, accessToken)`, 응답 검증 강화, `console.log` 제거 |
| Header | `src/components/layout/Header.jsx` | `logout()` 호출 (비동기, 결과 대기 불필요), 주석 정정 |

### 5.3 Page UI Checklist

#### LoginPage
- [x] 로그인 성공 시 홈 이동, 헤더에 닉네임 표시
- [x] 401 시 "이메일 또는 비밀번호가 올바르지 않습니다." 표시 (재발급 시도 없음)
- [x] 응답에 accessToken 또는 member가 없으면 오류 메시지 표시 (DV-6: "서버 오류가 발생했습니다.")

#### Header
- [x] 로그아웃 클릭 시 즉시 비로그인 표시, 메뉴 닫힘
- [x] 로그아웃 API 실패 시 "로그아웃이 완료되지 않았을 수 있습니다. 다시 시도해 주세요." 알림 표시 ("다시 시도", "닫기" 버튼) (DV-A4, R-4)
- [x] 세션 만료(재발급 실패) 시 자동으로 비로그인 표시
- [x] 새 탭 복원 중 로그인/회원가입 버튼 대신 같은 폭의 placeholder 표시 (DV-A5, R-3)

---

## 6. 오류 처리

### 6.1 오류 코드

| 코드 | 의미 | 원인 | 프론트 처리 |
|------|------|------|-------------|
| 401 (보호 API) | 인증 필요 | 토큰 없음·만료·위조 | 재발급 1회 → 재시도, 실패 시 로그인 상태 해제 후 오류 전달 |
| 401 (인증 API) | 인증 실패 | 비밀번호 틀림, 인증코드 불일치, 재발급 실패 | 재발급 없이 호출한 화면이 처리 |
| 403 | 권한 부족 | 일반 회원의 관리자 API | 재발급 없이 오류 전달 |
| 네트워크 오류 | 연결 실패 | 서버 다운 | 그대로 전달, 로그인 상태 유지 |

### 6.2 오류 응답 형식

모든 인증·인가 오류는 `GlobalExceptionHandler`와 같은 형식이다.
```json
{ "message": "사용자에게 보여줄 수 있는 한국어 메시지" }
```

서버 오류(5xx) 응답 body는 형식을 보장하지 않는다. 프론트는 `status` 코드만 사용해 처리한다 (예: 401이면 토큰 제거, 500이면 상태 유지).

---

## 7. 보안

- [x] Access Token은 모듈 메모리에만 보관 (Web Storage 미사용)
- [x] Refresh Token은 기존대로 HttpOnly·Secure·SameSite=Strict 쿠키
- [x] 재발급 실패 시 서버가 쿠키 삭제 (401일 때만, DV-10: 500일 때는 삭제 Set-Cookie 없음 → 후속 과제)
- [x] 재발급 실패 메시지에 내부 예외 메시지를 노출하지 않음
- [x] 회원 표시 정보(닉네임)는 sessionStorage `waylogMember`에만 저장 (DV-3, 새로고침 시 UI 깜빡임 방지용, 토큰은 메모리만)
- [ ] (후속 N-4) 세션 쿠키는 브라우저의 "이전 세션 계속" 설정에서 복원될 수 있음. 근본 대책은 비유지 로그인 시 짧은 토큰 만료
- [ ] (후속) Refresh Token 회전, 서버 측 폐기
- [ ] (후속) 교차 출처 배포 시 Spring Security CORS 통합 (현재 개발 환경은 Vite 프록시로 동일 출처)

---

## 8. 테스트 계획

### 8.1 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| L1 API | 401/403/refresh | curl (test 프로필, H2) | Check |
| L2 UI | 로그인·로그아웃·새로고침 | 수동 브라우저 확인 | Check |
| 정적 | build, lint, 컴파일 | npm, mvnw | Do |

### 8.2 L1 API 시나리오

| # | 요청 | 기대 상태 | 기대 응답 |
|---|------|:---:|------|
| 1 | 보호 API (예: `GET /api/v1/tour-bookmarks`) 토큰 없음 | 401 | `.message` 존재 |
| 2 | 같은 API + 잘못된 Bearer | 401 | `.message` 존재 |
| 3 | 같은 API + 정상 Bearer | 200 | - |
| 4 | `/api/v1/admin/notices` 일반 회원 토큰 | 403 | `.message` 존재 |
| 5 | `POST /auth/refresh` 쿠키 없음 | 401 | `.message`, 삭제 Set-Cookie |
| 6 | `POST /auth/refresh` 잘못된 쿠키 | 401 | `.message` |
| 7 | `POST /auth/refresh` 정상 쿠키 | 200 | `.accessToken`, `.member.email` |
| 8 | `GET /api/v1/home` + 잘못된 Bearer | 200 | 공개 API 회귀 없음 |
| 9 | `GET /api/v1/users/check-email` 토큰 없음 | 200 | 회귀 없음 |
| 10 | `POST /auth/login` 틀린 비밀번호 | 401 | 기존 메시지 |

### 8.3 L2 UI 시나리오

| # | 동작 | 기대 결과 |
|---|------|-----------|
| 1 | 로그인 | 홈 이동, 헤더 닉네임 |
| 2 | 로그인 후 새로고침 | `/auth/refresh` 1회 호출, 헤더 유지 |
| 3 | 새 탭에서 열기 | 복원되어 헤더 닉네임 |
| 4 | 로그아웃 | 즉시 비로그인, `/auth/logout` 호출, 새로고침 후에도 비로그인 |
| 5 | 비로그인 상태 새로고침 | `/auth/refresh` 401, 화면 오류 없음 |

---

## 9. 구조

### 9.1 계층 배치

| 구성요소 | 계층 | 위치 |
|----------|------|------|
| LoginPage, Header | 화면 | `src/pages/`, `src/components/layout/` |
| AuthContext | 상태 | `src/context/` |
| authApi | API 도메인 모듈 | `src/api/authApi.js` (신규) |
| apiClient, refreshSession | HTTP 인프라 | `src/api/client.js` |

### 9.2 의존 규칙

화면 → Context → authApi → client. 화면은 인증 URL을 직접 쓰지 않는다. client는 상위 계층을 import하지 않는다.

---

## 10. 코딩 규칙

- 기존 파일 스타일 유지: 프론트는 세미콜론 없음, 작은따옴표, 한국어 주석. 백엔드는 기존 한국어 블록 주석 스타일.
- 주요 결정 지점에 `// Design Ref: §N — 이유` 주석을 단다.
- 새 의존성 추가 금지.

---

## 11. 구현 가이드

### 11.1 파일 구조

```
backend/src/main/java/kr/co/mycom/travel_korea/
├── config/SecurityConfig.java        (수정) exceptionHandling 401/403 JSON
└── user/service/AuthService.java     (수정) refreshToken 401 + member, member 응답 헬퍼
frontend/src/
├── api/client.js                     (수정) 토큰, Bearer, refreshSession, 401 재시도
├── api/authApi.js                    (신규) login, refresh, logout
├── context/AuthContext.jsx           (수정) login(member, token), 복원, 로그아웃 API, 만료 처리
├── pages/LoginPage.jsx               (수정) authApi.login, 토큰 전달
└── components/layout/Header.jsx      (수정) logout 연결
```

### 11.2 구현 순서

1. [ ] (백엔드) `SecurityConfig`: `exceptionHandling`에 401 entryPoint, 403 accessDeniedHandler. `{ message }` JSON 작성 헬퍼
2. [ ] (백엔드) `AuthService`: login·refresh 공통 member 헬퍼, refresh 실패 401 + 고정 메시지, 성공 시 member 포함
3. [ ] (백엔드) 컴파일 + 8.2 L1 시나리오 curl 검증 (test 프로필, JDK 25)
4. [ ] (프론트) `client.js`: `setAccessToken`, `setSessionExpiredHandler`, `refreshSession`(single-flight), 401 재시도(인증 API 제외, 1회)
5. [ ] (프론트) `authApi.js`: `login({ email, password, rememberLogin })`, `refresh()`, `logout()` — 쿠키가 필요한 요청은 `credentials: 'include'`
6. [ ] (프론트) `AuthContext`: `login(member, token)`, 마운트 시 복원 + `isRestoring`, `logout()` 비동기, 만료 핸들러 등록. 복원 중 로그인·로그아웃이 일어나면 늦게 도착한 복원 결과가 새 상태를 덮어쓰지 않게 처리
7. [ ] (프론트) `LoginPage`, `Header` 연결
8. [ ] (프론트) `npm run build`, `npx eslint .`

### 11.3 세션 가이드

#### 모듈 맵

| 모듈 | 범위 키 | 담당 | 파일 | 선행 |
|------|---------|------|------|------|
| 백엔드 인증 응답 | `module-backend` | frontend-support-backend | SecurityConfig, AuthService | 없음 |
| 프론트 토큰 흐름 | `module-frontend` | frontend-lead | client.js, authApi.js, AuthContext, LoginPage, Header | API 계약(4장) |

#### 권장 진행

두 모듈은 파일이 겹치지 않고 API 계약이 4장에 확정되어 있으므로 병렬 진행이 가능하다. 단, 프론트 L2 확인은 백엔드 완료 후 수행한다.

---

## 12. Act-1 변경 설계 (Check 결과 반영)

근거: `docs/03-analysis/auth-token-flow.analysis.md` 6장 코드 리뷰. 사용자 결정으로 R-1~R-5, R-12를 수정한다.

| ID | 변경 | 담당 | 설계 |
|----|------|------|------|
| R-1 | "로그인 상태 유지" 동작 (FR-12) | frontend-support-backend | `POST /auth/login` 요청의 `rememberLogin`(Boolean)을 받는다. `false`면 Refresh 쿠키에 `Max-Age`를 넣지 않아 브라우저 종료 시 삭제되는 세션 쿠키로, `true` 또는 값 없음(하위 호환)이면 기존처럼 7일 쿠키로 발급한다. 토큰 자체의 만료(7일)는 동일. refresh는 Refresh 쿠키를 재발급하지 않으므로 쿠키 유형이 그대로 유지된다. 프론트는 이미 `authApi.login`에서 값을 보내므로 변경 없음 |
| R-2 | 로그아웃과 동시에 진행 중이던 요청의 재발급 차단 | frontend-lead | `request()`가 **요청을 보낸 시점**의 `authGeneration`을 기억한다. 401 수신 시 세대가 바뀌었으면(그 사이 로그인·로그아웃) 재발급하지 않는다. 바뀐 세대에 토큰이 있으면 그 토큰으로 1회 재시도, 없으면 원래 401을 던진다 |
| R-3 | 새 탭 복원 중 헤더 깜빡임 | frontend-lead | Header는 `isRestoring && !member`일 때 로그인/회원가입 버튼 대신 같은 폭의 빈 자리를 렌더링한다 |
| R-4 | 로그아웃 실패 알림 | frontend-lead | `logout()`은 서버 호출 성공 여부(boolean)를 반환한다. 화면은 즉시 비로그인으로 전환하고(§2.2 유지), 실패하면 Header가 "로그아웃이 완료되지 않았을 수 있습니다. 다시 시도해 주세요." 알림을 표시한다 |
| R-5 | refresh 실패 범위 축소 | frontend-support-backend | 토큰·회원 검증 실패(쿠키 없음, 파싱·서명·타입·만료 오류, 회원 없음)만 401 + 쿠키 삭제. 그 밖의 예외는 전파해 500이 되게 하고 로그인 상태를 지우지 않는다. 검증 실패 원인은 `log.debug`, 예상 못 한 오류는 `log.error` |
| R-12 | 중복 주석 삭제 | frontend-support-backend | `SecurityConfig` |

후속 과제로 남기는 항목: R-6(필터의 grade null), R-7(네트워크 오류 한국어 문구), R-9(재시도 경로 member 동기화), R-10(세대 카운터 통일), R-11(쿠키 없는 refresh의 삭제 Set-Cookie), R-13, M-8.

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-23 | 초안 (설계안 C 선택) | WOOJIN |
| 0.2 | 2026-09-23 | §12 Act-1 변경 설계 추가 (리뷰 R-1~R-5, R-12) | WOOJIN |
