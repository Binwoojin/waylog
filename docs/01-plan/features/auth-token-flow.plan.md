# auth-token-flow 계획 문서

> **요약**: 로그인 후 버려지던 Access Token을 저장·전송·재발급하는 인증 흐름을 완성하고, 백엔드의 401/403 응답을 정리한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-23
> **상태**: Draft
> **출처**: `docs/development/waylog-renewal.md` Must Fix 2, 7장 후속 과제 "401/403 정리"

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 프론트가 로그인 응답의 accessToken을 버려서 로그인이 필요한 API를 하나도 호출할 수 없다. 백엔드는 미인증 요청에 401이 아닌 403을 반환해 "재로그인 필요"와 "권한 없음"을 구분할 수 없다. |
| **해결** | 백엔드는 미인증 401, 권한 부족 403, 재발급 실패 401을 JSON으로 반환한다. 프론트는 토큰을 메모리에 두고 모든 요청에 Bearer 헤더를 붙이며, 401이면 한 번 재발급 후 재시도하고 실패하면 로그아웃한다. |
| **기능/UX 효과** | 로그인 후 피드·댓글·북마크 등 보호 API를 쓸 수 있게 되고, 새로고침·새 탭에서도 로그인 상태가 유지되며, 세션 만료 시 화면이 자연스럽게 로그아웃 상태로 바뀐다. |
| **핵심 가치** | 이후 모든 로그인 기능(피드, 댓글, 좋아요, 북마크, 마이페이지)의 전제 조건을 해결한다. 토큰 보관 위치·재발급 동시성 처리는 면접에서 설명 가능한 프론트엔드 설계 포인트다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 로그인해도 토큰이 없어 보호 API 호출이 불가능하고, 401/403이 구분되지 않아 재발급 로직을 만들 수 없다 |
| **WHO** | 로그인한 WayLog 사용자 (이후 피드·댓글·북마크 화면을 구현할 개발자 포함) |
| **RISK** | 재발급 무한 루프, 동시 401 시 중복 재발급, 새로고침 시 로그인 상태 깜빡임, 기존 공개 API 동작 변경 |
| **SUCCESS** | 보호 API가 로그인 시 200, 비로그인 시 401 / 새로고침 후 세션 복원 / 만료 시 1회 재발급 후 재시도 / 로그아웃 시 쿠키 삭제 |
| **SCOPE** | 백엔드 SecurityConfig·AuthService 재발급 → 프론트 api/client.js·AuthContext·LoginPage·Header |

---

## 1. 개요

### 1.1 목적

로그인부터 로그아웃까지 인증 토큰이 끊기지 않고 흐르게 만들어, 로그인이 필요한 기능을 프론트에서 구현할 수 있는 기반을 만든다.

### 1.2 배경

- 백엔드는 로그인 시 body로 `accessToken`(30분)과 `member`를, HttpOnly 쿠키로 `refreshToken`(7일)을 준다.
- 프론트는 `login(response.member)`만 호출해 토큰을 버린다(`LoginPage.jsx:50`). 요청 헤더에 토큰을 넣지 않고, 401 재발급과 로그아웃 API 호출도 없다.
- 백엔드에 `authenticationEntryPoint`가 없어 미인증 요청이 403을 받는다. `/auth/refresh` 실패는 400이다.
- 진단 문서에서 두 작업이 충돌하므로 함께 고쳐야 한다고 정리했다.

### 1.3 관련 문서

- 진단: `docs/development/waylog-renewal.md` (3장 Must Fix 2, 7장 후속 과제)
- 작업 규칙: `CLAUDE.md` (Agent Workflow, bkit 협업 규칙)

---

## 2. 범위

### 2.1 포함

- [ ] 백엔드: 미인증 요청 401, 권한 부족 403을 `{ "message": ... }` JSON으로 응답
- [ ] 백엔드: `/auth/refresh` 실패 시 401 (쿠키 삭제 유지), 성공 시 `member`도 함께 반환
- [ ] 프론트: Access Token을 메모리에 저장하고 요청마다 `Authorization: Bearer` 헤더 추가
- [ ] 프론트: 401 수신 시 재발급 1회 후 원 요청 재시도, 재발급 실패 시 로그인 상태 해제
- [ ] 프론트: 동시 401에도 재발급 요청은 1회만 전송
- [ ] 프론트: 앱 시작 시 Refresh 쿠키로 세션 자동 복원
- [ ] 프론트: 로그인 시 토큰 전달, 로그아웃 시 `/auth/logout` 호출

### 2.2 제외

- 보호 라우트(로그인 필요 페이지 가드)
- ~~"로그인 상태 유지" 체크박스 동작 (현재처럼 Refresh 쿠키 항상 7일) → 후속 과제~~ → **FR-12로 이동 (Check 리뷰 Must Fix)**
- Refresh Token 회전(rotation)·서버 측 폐기 목록
- Spring Security CORS 통합(개발 환경은 Vite 프록시로 동일 출처) → 후속 과제
- 피드·댓글·북마크 등 신규 화면
- TanStack Query 등 서버 상태 라이브러리 도입

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | 인증 정보가 없거나 유효하지 않은 보호 API 요청은 401 + `{ message }` | High | frontend-support-backend | Pending |
| FR-02 | 인증됐지만 권한이 부족한 요청(예: 일반 회원의 `/admin/**`)은 403 + `{ message }` | High | frontend-support-backend | Pending |
| FR-03 | `/auth/refresh` 실패(쿠키 없음·만료·위조·회원 없음)는 401 + `{ message }`, 쿠키 삭제 | High | frontend-support-backend | Pending |
| FR-04 | `/auth/refresh` 성공 시 `{ accessToken, member }` 반환 (login과 같은 member 형태) | High | frontend-support-backend | Pending |
| FR-05 | Access Token은 JS 메모리에만 보관 (localStorage·sessionStorage 금지) | High | frontend-lead | Pending |
| FR-06 | 토큰이 있으면 모든 API 요청에 `Authorization: Bearer <token>` | High | frontend-lead | Pending |
| FR-07 | 인증 API(`/api/v1/auth/**`)가 아닌 요청이 401이면 재발급 후 1회 재시도, 재발급 실패 시 로그인 상태 해제 | High | frontend-lead | Pending |
| FR-08 | 동시에 여러 401이 발생하거나 StrictMode로 두 번 실행돼도 재발급 요청은 1회 | Medium | frontend-lead | Pending |
| FR-09 | 앱 시작 시 `/auth/refresh`로 세션 복원. 401이면 비로그인, 네트워크 오류면 기존 표시 유지 | High | frontend-lead | Pending |
| FR-10 | 로그인 성공 시 `member`와 `accessToken`을 모두 저장, 둘 중 하나라도 없으면 오류 | High | frontend-lead | Pending |
| FR-11 | 로그아웃 시 화면 상태를 즉시 비우고 `/auth/logout`을 호출해 Refresh 쿠키 삭제 | Medium | frontend-lead | Pending |
| FR-12 | (Act-1 추가) "로그인 상태 유지" 해제 시 Refresh 쿠키를 세션 쿠키로 발급, 체크 시 7일 쿠키 | High | frontend-support-backend | Pending |

> **범위 변경 (2026-09-23, Check 이후)**: 세션 자동 복원이 들어가면서 "로그인 상태 유지"를 해제해도 브라우저 재실행 시 자동 로그인되는 문제가 코드 리뷰 Must Fix(R-1)로 지적됐다. 사용자 결정으로 2.2 제외 항목이던 체크박스 동작을 FR-12로 포함한다.

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 보안 | Access Token이 Web Storage에 남지 않음, Refresh Token은 HttpOnly 유지 | 코드 확인, 브라우저 저장소 확인 |
| 안정성 | 재발급 실패가 무한 재시도로 이어지지 않음 (재시도 최대 1회) | 코드 리뷰, 시나리오 테스트 |
| 호환성 | 공개 API(home, search, check-email 등)는 토큰 유무·만료와 관계없이 기존처럼 200 | curl 검증 |
| 유지보수 | 오류 응답 형식이 `GlobalExceptionHandler`와 같은 `{ message }` | 코드 확인 |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] FR-01 ~ FR-11 구현
- [ ] 백엔드 컴파일 성공, 프론트 build·lint 오류 0
- [ ] curl 검증: 비로그인 보호 API 401, 일반 회원 `/admin/**` 403, 잘못된 쿠키 refresh 401, 정상 refresh 200 + member
- [ ] frontend-code-reviewer 리뷰 완료 (Must Fix 0건)
- [ ] bkit gap 분석 Match Rate 90% 이상

### 4.2 품질 기준

- [ ] 린트 오류 0
- [ ] 빌드 성공
- [ ] 공개 API 회귀 없음

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 재발급 요청 자체가 401 → 다시 재발급 시도 (무한 루프) | High | Medium | `/api/v1/auth/**` 요청은 재시도 대상에서 제외 |
| 동시 401로 재발급 요청 여러 번 | Medium | High | 진행 중인 재발급 Promise 공유 |
| 새로고침 직후 헤더가 로그아웃 상태로 깜빡임 | Low | High | 회원 표시 정보는 sessionStorage 유지, 복원 결과로 갱신 |
| 복원 요청 중 사용자가 로그인 → 복원 실패가 새 로그인 상태를 덮어씀 | Low | Low | 설계 단계에서 처리 방식 결정 |
| 기존 permitAll API가 401로 바뀜 | High | Low | 필터는 잘못된 토큰도 익명으로 통과시키므로 영향 없음, curl로 회귀 확인 |
| Secure 쿠키가 http 개발 환경에서 저장 안 됨 | Medium | Low | localhost는 브라우저가 보안 출처로 취급. 실제 브라우저에서 확인 |

---

## 6. 영향 분석

### 6.1 변경 자원

| 자원 | 유형 | 변경 내용 |
|------|------|-----------|
| `SecurityConfig` | 보안 설정 | 인증 실패 401 / 권한 부족 403 JSON 핸들러 추가 |
| `JwtConfig` | 설정 | Refresh 쿠키 유형 2종 (세션/7일) 생성 메서드 추가 |
| `UserRequest` | DTO | `rememberLogin` 필드 추가 |
| `AuthService.refreshToken` | API | 실패 400 → 401, 응답에 `member` 추가, 검증 실패만 401 |
| `api/client.js` | 프론트 API 계층 | 토큰 보관, Bearer 헤더, 401 재발급·재시도, 세대 번호 |
| `api/authApi.js` | 프론트 API 함수 | `login`, `refresh`, `logout` 호출 (신규) |
| `AuthContext` | 프론트 전역 상태 | `login(member, token)`, 세션 복원, 로그아웃 API, 로그아웃 반환값 |
| `LoginPage`, `Header` | 화면 | 토큰 전달, 로그아웃 API 연결 |
| `Header.css` | 스타일 | 복원 중 placeholder, 로그아웃 실패 알림 카드 |

### 6.2 현재 사용처

| 자원 | 동작 | 코드 경로 | 영향 |
|------|------|-----------|------|
| 보안 필터 | 공개 API 조회 | `App.jsx:42` `GET /api/v1/home` | 없음 (permitAll) |
| 보안 필터 | 회원가입 | `SignupPage.jsx` check-email, email-verification, signup | 없음 (permitAll) |
| `/auth/refresh` | 호출 | 현재 프론트 호출 없음 | 없음 |
| `apiClient` | get/post | `App.jsx`, `LoginPage.jsx`, `SignupPage.jsx` | 확인 필요 (헤더 추가, 401 처리) |
| `useAuth().login` | 호출 | `LoginPage.jsx:50` | 시그니처 변경 → 함께 수정 |
| `useAuth().logout` | 호출 | `Header.jsx:47-51` | 비동기화 → 함께 수정 |
| `useAuth().member` | 읽기 | `Header.jsx:15` | 없음 |
| `SignupPage` 인증코드 확인 401 | 폼 오류 | `SignupPage.jsx` `/auth/email-verification/confirm` | 없음 (인증 API는 재시도 제외) |

### 6.3 검증

- [ ] 위 사용처가 변경 후에도 정상 동작
- [ ] 인가 변경이 기존 공개 API를 막지 않음
- [ ] 로그인 응답 필드 변경 없음

---

## 7. 아키텍처 고려사항

### 7.1 프로젝트 수준

| 수준 | 선택 |
|------|:----:|
| Starter | ☐ |
| Dynamic (프론트 + 자체 백엔드) | ☑ |
| Enterprise | ☐ |

### 7.2 주요 결정

| 결정 | 선택지 | 선택 | 근거 |
|------|--------|------|------|
| 토큰 보관 | 메모리 / sessionStorage / localStorage | 메모리 | XSS 노출 최소화. 사용자 확인 (2026-09-23) |
| 세션 복원 | 앱 시작 시 자동 / 401 시에만 | 앱 시작 시 자동 | 새로고침·새 탭 UX. 사용자 확인 |
| API 클라이언트 | 기존 fetch 래퍼 확장 / axios / TanStack Query | 기존 fetch 래퍼 확장 | 의존성 추가 없이 최소 변경. 라이브러리 도입은 별도 과제 |
| 전역 상태 | 기존 AuthContext 확장 | AuthContext | 이미 사용 중, 범위 최소화 |
| 로그인 유지 체크박스 | 이번 구현 / 제외 | 제외 | 사용자 확인. 후속 과제 |

### 7.3 작업 분담 (CLAUDE.md bkit 협업 규칙)

```
frontend-support-backend : SecurityConfig, AuthService (FR-01~04)
        ↓ (API 계약 확정)
frontend-lead            : api/client.js, AuthContext, LoginPage, Header (FR-05~11)
        ↓
frontend-code-reviewer   : 코드 리뷰 (frontend-audit)
bkit gap-detector        : 설계 대비 gap 분석
        ↓
frontend-lead            : 발견된 문제 수정
        ↓
report → frontend-interview-coach : 포트폴리오 자료 추출
```

같은 파일을 여러 구현 에이전트가 동시에 수정하지 않는다. 백엔드와 프론트 파일이 겹치지 않으므로, 설계에서 API 계약을 확정하면 두 에이전트를 순차 또는 병렬로 실행할 수 있다.

---

## 8. 다음 단계

1. `/pdca design auth-token-flow`: 설계안 3가지 비교 후 선택
2. 구현 (frontend-support-backend → frontend-lead)
3. 리뷰 + gap 분석 → 수정 → 완료 보고서
