# auth-token-flow 분석 보고서

> **분석 유형**: Gap Analysis (설계 대비 구현, 정적 분석 + L1 런타임 결과) + 코드 리뷰 통합
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **분석자**: bkit gap-detector, frontend-code-reviewer (WOOJIN 요청)
> **작성일**: 2026-09-23
> **상태**: Draft
> **계획 문서**: [auth-token-flow.plan.md](../01-plan/features/auth-token-flow.plan.md)
> **설계 문서**: [auth-token-flow.design.md](../02-design/features/auth-token-flow.design.md)

> gap 분석과 코드 리뷰는 병렬로 실행했다. gap-detector 원문은 리뷰 결과를 알지 못한 상태에서 SC-4를 "미수행"으로 판정했으며, 이 문서에서는 실제 리뷰 결과(6장)를 반영해 SC-4를 갱신했다.

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

## 요약

| 항목 | 결과 |
|------|------|
| 정적 Match Rate | **98.8%** (구조 100% × 0.2 + 기능 97% × 0.4 + 계약 100% × 0.4) |
| FR-01 ~ FR-11 | 11/11 충족 (FR-03, FR-07, FR-09에 경계 사례 메모) |
| 계획 4장 성공 기준 | 7/8 충족. 미충족 1건: SC-4 (리뷰는 수행했으나 Must Fix 1건 존재) |
| 코드 리뷰 판정 | **조건부 머지** (Must Fix 1, Should Improve 5) |
| Critical gap | 0건 |
| Important | 2건 (L2 미검증, 리뷰 Must Fix) |
| Minor | 8건 (확신도 80% 미만 4건 포함) |
| 런타임 | L1 9/10 통과, 1건 대체 검증. L2 미수행 |

---

## 1. 전략 정합성

### 1.1 기능 요구사항 (FR-01 ~ FR-11)

| ID | 요구사항 | 판정 | 근거 (file:line) |
|----|----------|:---:|------------------|
| FR-01 | 미인증·무효 토큰 보호 API → 401 + `{ message }` | ✅ | `SecurityConfig.java:85-88` entryPoint 등록, `:104-107` 401 핸들러, `:120-126` JSON 작성(`charset=UTF-8`). 무효 토큰은 `JwtAuthenticationFilter.java:81-87`에서 익명 처리 후 entryPoint로 감. L1 #1·#2 통과 |
| FR-02 | 권한 부족 → 403 + `{ message }` | ✅ | `SecurityConfig.java:69-70` `/admin/**` ROLE_ADMIN, `:114-117` 403 핸들러. L1 #4 통과 |
| FR-03 | refresh 실패 → 401 + `{ message }` + 쿠키 삭제 | ✅ | `AuthService.java:87-89`(쿠키 없음), `:96`(위조·타입·만료), `:103-104`(회원 없음), `:115-129`(401 + 고정 메시지 + `deleteToken()`). L1 #5·#6 통과. 참고: `catch (Exception)`이 설계에 나열된 원인보다 넓게 잡음(M-1) |
| FR-04 | refresh 성공 → `{ accessToken, member }` (login과 같은 member) | ✅ | `AuthService.java:110-113`. 공통 헬퍼 `:142-150`을 login `:69-72`와 함께 사용. L1 #7 통과 |
| FR-05 | Access Token은 JS 메모리에만 | ✅ | `client.js:24`, `:29-32`. `AuthContext.jsx:18-33`은 sessionStorage에 member 표시 정보만 저장. `frontend/src`에서 `localStorage` 사용 0건 |
| FR-06 | 토큰이 있으면 모든 요청에 Bearer | ✅ | `client.js:44-49` (호출부 헤더가 우선) |
| FR-07 | 비인증 API 401 → 재발급 후 1회 재시도, 실패 시 로그인 상태 해제 | ✅ | `client.js:67-69` 조건(401, `!isRetry`, `!isAuthPath`), `:77-94` 재발급 → 재시도, `:88` 만료 핸들러. `AuthContext.jsx:72-78`에서 member 해제. 런타임 미검증(L2-7, L2-8) |
| FR-08 | 동시 401·StrictMode에서도 재발급 1회 | ✅ | `client.js:105-130` single-flight(`:106` 공유, `:124-128` 정리). `AuthContext.jsx:82-86,103-105` StrictMode 대응. 런타임 미검증(L2-3, L2-7) |
| FR-09 | 앱 시작 시 복원. 401이면 비로그인, 네트워크 오류면 표시 유지 | ✅ | `AuthContext.jsx:81-106`. `:97` 401일 때만 `applyMember(null)`, `:99-101` `isRestoring` 해제 |
| FR-10 | 로그인 시 member·token 모두 저장, 하나라도 없으면 오류 | ✅ | `LoginPage.jsx:43-45` 검증, `:47` `login(member, accessToken)`, `AuthContext.jsx:51-55` |
| FR-11 | 로그아웃 시 화면 즉시 비움 → `/auth/logout` 호출 | ✅ | `AuthContext.jsx:58-69` (먼저 비움 `:59-61`, 그다음 API `:64`), `authApi.js:21-23` (`credentials: 'include'`), `Header.jsx:47-52` |

**FR 충족률**: 11/11

### 1.2 계획 4장 성공 기준

| # | 기준 | 판정 | 근거 |
|---|------|:---:|------|
| SC-1 | FR-01 ~ FR-11 구현 | ✅ | 1.1 표 |
| SC-2 | 백엔드 컴파일 성공, 프론트 build·lint 오류 0 | ✅ | JDK 25 컴파일 성공, `npm run build` 성공, `npx eslint .` 오류 0 (메인 세션에서 재확인) |
| SC-3 | curl: 비로그인 보호 API 401, 일반 회원 `/admin/**` 403, 잘못된 쿠키 refresh 401, 정상 refresh 200 + member | ✅ | L1 #1, #4, #6, #7 통과 |
| SC-4 | frontend-code-reviewer 리뷰 완료 (Must Fix 0건) | ❌ | 리뷰 수행 완료, 판정 "조건부 머지". **Must Fix 1건**("로그인 상태 유지" 체크박스) 남음 → 6장 |
| SC-5 | bkit gap 분석 Match Rate 90% 이상 | ✅ | 98.8% (정적) |
| SC-6 | 린트 오류 0 | ✅ | |
| SC-7 | 빌드 성공 | ✅ | |
| SC-8 | 공개 API 회귀 없음 | ✅ | L1 #9 통과. L1 #8(`/home` + 잘못된 Bearer)은 502였으나 `TourExceptionHandler.java:48`(BAD_GATEWAY)에서 나온 것으로, 요청이 보안 필터를 통과해 컨트롤러까지 도달했다는 뜻이다. 대체 검증 `/notices`, `/regions`, `/classifications` + 잘못된 Bearer 모두 200 |

**성공률**: 7/8 (SC-4: Must Fix 1건 남음)

### 1.3 비기능 요구사항

| 분류 | 판정 | 근거 |
|------|:---:|------|
| 보안: Web Storage에 토큰 없음, Refresh는 HttpOnly | ✅ | `client.js:24`, `JwtConfig.java:88-96` (HttpOnly·Secure·SameSite=Strict) |
| 안정성: 재시도 최대 1회 | ✅ | `client.js:67` `!isRetry`, `:93` `isRetry=true`로 재호출. 인증 API 제외 |
| 호환성: 공개 API는 토큰 상태와 무관하게 200 | ✅ | SC-8 |
| 유지보수: `{ message }` 형식 통일 | ✅ | `SecurityConfig.java:125`, `AuthService.java:128`, `GlobalExceptionHandler.java:21` |

### 1.4 결정 기록 검증

| 출처 | 결정 | 준수 | 비고 |
|------|------|:---:|------|
| Plan 7.2 | 토큰은 메모리에 보관 | ✅ | FR-05 |
| Plan 7.2 | 앱 시작 시 자동 복원 | ✅ | FR-09 |
| Plan 7.2 | 기존 fetch 래퍼 확장, 새 의존성 없음 | ✅ | package.json 변경 없음 |
| Plan 7.2 | 기존 AuthContext 확장 | ✅ | |
| Plan 7.2 | "로그인 상태 유지" 체크박스 동작은 제외 | ✅ (결정은 준수) | 단, 세션 복원이 생기면서 체크 해제가 무의미해지는 부작용이 드러남 → 리뷰 Must Fix (6장 R-1) |
| Design §2 | 설계안 C (신규 파일은 `authApi.js` 1개) | ✅ | |
| Design §2.3 | client는 상위 계층을 import하지 않고 콜백으로 만료 통지 | ✅ | `client.js:35-37`, import 없음 |

---

## 2. 설계 대비 구현 Gap

### 2.1 구조 (§9, §11.1)

| 설계 항목 | 구현 | 상태 |
|-----------|------|:---:|
| `config/SecurityConfig.java` exceptionHandling 401/403 JSON | `SecurityConfig.java:85-126` | ✅ |
| `user/service/AuthService.java` refresh 401 + member, member 헬퍼 | `AuthService.java:84-150` | ✅ |
| `api/client.js` `setAccessToken`, `setSessionExpiredHandler`, `refreshSession`, `apiClient` | `client.js:29,35,105,132` | ✅ |
| `api/authApi.js` (신규) `login`, `refresh`, `logout` | `authApi.js:11,16,21` | ✅ |
| `context/AuthContext.jsx` `member`, `isRestoring`, `login`, `logout` | `AuthContext.jsx:108-111` | ✅ |
| `pages/LoginPage.jsx` | `LoginPage.jsx:4,39,47` | ✅ |
| `components/layout/Header.jsx` | `Header.jsx:47-52` | ✅ |
| §9.2 화면 → Context → authApi → client | 준수 | ✅ |
| §9.2 화면에 인증 URL을 직접 쓰지 않음 (범위 내 화면) | LoginPage는 주석에만 URL | ✅ |
| §9.2 client는 상위 계층을 import하지 않음 | 준수 | ✅ |

**구조 일치율: 100%** (10/10). 범위 밖 참고: `SignupPage.jsx:166,229,324`는 인증 URL을 직접 사용 (M-8).

### 2.2 기능 깊이 (§11.2 + §5.3)

| # | 항목 | 판정 | 근거 |
|---|------|:---:|------|
| B1 | 401 entryPoint JSON | ✅ | `SecurityConfig.java:104-107` |
| B2 | 403 accessDeniedHandler JSON | ✅ | `SecurityConfig.java:114-117` |
| B3 | `{ message }` JSON 헬퍼 + UTF-8 | ✅ | `SecurityConfig.java:120-126` |
| B4 | login·refresh 공통 member 헬퍼 | ✅ | `AuthService.java:71,112,142-150` |
| B5 | refresh 실패 401 + 고정 메시지 + 쿠키 삭제 | ⚠️ | 동작은 충족. `catch (Exception)`이 예상 못 한 서버 오류까지 401로 바꾸고 `log.debug`라 운영 로그에 남지 않음 (M-1) |
| B6 | refresh 성공 시 member 포함 | ✅ | `AuthService.java:110-113` |
| F1 | 메모리 토큰 `setAccessToken` | ✅ | `client.js:29-32` |
| F2 | `setSessionExpiredHandler` | ✅ | `client.js:35-37` |
| F3 | `refreshSession` single-flight | ✅ | `client.js:105-130` |
| F4 | 401 재시도 (인증 API 제외, 1회) | ✅ | `client.js:67-69` |
| F5 | 403은 재발급 안 함 | ✅ | `client.js:67` |
| F6 | 재발급 실패 → 토큰 제거 → 만료 통지 → 원래 401 | ✅ | `client.js:84-89`, `:119-121` |
| F7 | 네트워크 오류 → 로그인 상태 유지 | ✅ | `client.js:84`, `:118-119` |
| F8 | 재발급 성공 → 새 토큰 → 재시도 | ✅ | `client.js:113-115`, `:93` (member 동기화는 설계에 없음, M-2) |
| A1 | `login({ email, password, rememberLogin })` + include | ✅ | `authApi.js:11-13` |
| A2 | `refresh()` | ✅ | `authApi.js:16-18` |
| A3 | `logout()` + include | ✅ | `authApi.js:21-23` |
| C1 | `login(member, token)` | ✅ | `AuthContext.jsx:51-55` |
| C2 | 마운트 시 복원 + `isRestoring` | ✅ | `AuthContext.jsx:37,81-106` |
| C3 | `logout()` 비동기 | ✅ | `AuthContext.jsx:58-69` |
| C4 | 만료 핸들러 등록·해제 | ✅ | `AuthContext.jsx:72-78` |
| C5 | 늦게 온 복원 결과가 새 상태를 덮어쓰지 않음 | ⚠️ | 클라이언트 상태는 이중 보호(`AuthContext.jsx:86,90,94`, `client.js:113,119`). 서버 401의 삭제 `Set-Cookie`가 새 로그인 쿠키를 지울 수 있음 (M-3) |
| S1 | LoginPage `authApi.login` | ✅ | `LoginPage.jsx:39` |
| S2 | `login(member, accessToken)` | ✅ | `LoginPage.jsx:47` |
| S3 | accessToken·member 누락 시 오류 표시 | ✅ | `LoginPage.jsx:43-45` |
| S4 | `console.log` 제거 | ✅ | |
| S5 | 401 시 폼 오류, 재발급 없음 | ✅ | `LoginPage.jsx:51-52`, `client.js:67` |
| S6 | 로그인 성공 시 홈 이동 | ✅ | `LoginPage.jsx:48` |
| S7 | Header 로그아웃 → 즉시 비로그인 + 메뉴 닫힘 | ✅ | `Header.jsx:47-52` |
| S8 | Header 주석 정정 | ✅ | `Header.jsx:48-49` |
| S9 | 세션 만료 시 자동 비로그인 표시 | ✅ | `AuthContext.jsx:73-76` → `Header.jsx:76` |
| T1 | 백엔드 컴파일 + L1 curl | ✅ | 9/10 + 대체 검증 |
| T2 | build, lint | ✅ | |

**기능 일치율: 97.0%** (완전 충족 31 + 부분 2 × 0.5 = 32 / 33)

### 2.3 API 계약 (설계 §4 ↔ 백엔드 ↔ 프론트)

| # | 엔드포인트 | 서버 | 클라이언트 | 계약 |
|---|------------|------|------------|:---:|
| 1 | `POST /auth/login` → `{ accessToken, member }` + 쿠키 | `AuthService.java:67-72` | `authApi.js:12`, `LoginPage.jsx:43-47` | PASS |
| 2 | `POST /auth/refresh` 200 `{ accessToken, member }` / 401 `{ message }` + 쿠키 삭제 | `AuthService.java:110-113,125-128` | `client.js:110,113`, `AuthContext.jsx:91,97` | PASS |
| 3 | `POST /auth/logout` 쿠키 삭제 | `AuthController.java:48-54` | `authApi.js:22`, `client.js:58`이 text body를 `{}`로 처리 | PASS |
| 4 | 보호 API 401 `{ message }` | `SecurityConfig.java:30,104-107` | `client.js:61,67` | PASS |
| 5 | `/admin/**` 권한 부족 403 `{ message }` | `SecurityConfig.java:31,114-117` | `client.js:67` (401이 아니므로 그대로 throw) | PASS |

**계약 일치율: 100%** (5/5). member 필드 `{ memberId, email, nickname, role }`도 설계 §3과 일치.

### 2.4 Match Rate

```
구조 일치율:   100.0%
기능 일치율:    97.0%
계약 일치율:   100.0%
─────────────────────────────────────────
전체 Match Rate (정적) = 100 × 0.2 + 97.0 × 0.4 + 100 × 0.4 = 98.8%
```

L2 런타임이 수행되지 않아 정적 공식을 적용했다.

---

## 3. 설계와 다르게 구현된 부분

| # | 항목 | 설계 | 구현 | 분류 |
|---|------|------|------|------|
| DV-1 | 늦게 온 재발급 결과 차단 | §11.2-6은 AuthContext 수준만 요구 | client에도 `authGeneration`을 두어 이중 보호 | 설계 갱신 |
| DV-2 | 재발급 실패 분기 | §2.2와 §6.1이 서로 모순 | 401만 토큰 제거·만료 처리, 그 외 오류는 상태 유지 | 설계 갱신 (§2.2를 §6.1에 맞춤) |
| DV-3 | member 표시 정보 캐시 | §2, §7에 언급 없음 | sessionStorage `waylogMember`에 표시 정보만 저장 | 설계 갱신 |
| DV-4 | 로그인 호출 경로 | §2.1 구성도와 §2.2/§2.3이 다름 | LoginPage → `authApi.login` | 설계 갱신 (구성도 수정) |
| DV-5 | role 기본값 | §3 `role: string`만 정의 | GRADE null이면 `"user"` | 설계 갱신 (필터 불일치는 M-5) |
| DV-6 | 응답 필드 누락 시 문구 | §5.3 "오류 메시지 표시" | 일반 문구 "서버 오류가 발생했습니다." | 설계 갱신 |
| DV-7 | refresh 실패 처리 범위 | §4.2의 원인만 401 | `catch (Exception)` 전체 401 + `log.debug` | 구현 수정 |
| DV-8 | 재시도 경로의 재발급 성공 | member 언급 없음 | 토큰만 갱신 | 구현 수정 + 설계 보완 |
| DV-9 | 코드 주석 | §10 스타일 유지 | 같은 주석 블록 중복 (`SecurityConfig.java:75-77`, `:89-91`) | 구현 수정 |
| DV-10 | 쿠키 없을 때 refresh 401 응답 | 항상 삭제 `Set-Cookie` | 설계대로. 복원·로그인 경합 시 새 쿠키를 지울 수 있음 | 설계 재검토 |

---

## 4. 심각도별 Gap 목록 (gap-detector)

> 확신도 80% 미만은 **[확신 < 80%]** 표시.

### Critical

없음.

### Important

| ID | 내용 | 조치 |
|----|------|------|
| I-1 | 리뷰 Must Fix 1건 남음 (원문: 리뷰 미수행 → 리뷰 결과 반영해 갱신) | 6장 R-1 처리 |
| I-2 | L2 UI 시나리오 미수행. 특히 Secure 쿠키가 http://localhost:5173(Vite 프록시)에서 저장·전송되는지 미확인. 실패하면 FR-07, FR-09가 실제 브라우저에서 동작하지 않음 **[실제 실패 가능성 확신 < 80%]** | 5장 L2-1, L2-3 우선 수행 |

### Minor

| ID | 내용 | 근거 | 확신도 |
|----|------|------|:---:|
| M-1 | refresh `catch (Exception)`이 서버 결함까지 401로 바꿔 로그아웃시키고, `log.debug`라 운영 로그에 남지 않음 | `AuthService.java:115,124` | 85% |
| M-2 | 401 재시도 경로에서 재발급 성공 시 member 미갱신 → 토큰은 있는데 헤더는 비로그인 | `client.js:81,93` | **[< 80%]** 75% |
| M-3 | 쿠키 없는 복원 요청 진행 중 로그인하면 늦은 401의 삭제 `Set-Cookie`가 새 로그인 쿠키를 지울 수 있음 | `AuthService.java:87-89,125-127` | **[< 80%]** 65% |
| M-4 | 새 탭에서 복원 전 "로그인/회원가입"이 잠깐 보임. `isRestoring` 사용처 없음 | `AuthContext.jsx:36-37`, `Header.jsx:76-95` | 85% |
| M-5 | GRADE null 회원: 로그인·refresh는 성공하지만 필터는 NPE → 익명 → 보호 API 항상 401 | `AuthService.java:143`, `JwtAuthenticationFilter.java:70-71` | **[< 80%]** 60% |
| M-6 | 로그아웃 직후 보호 API 401 → 재발급이 쿠키 삭제보다 먼저 성공하면 토큰이 되살아남 | `client.js:77-93`, `AuthContext.jsx:58-64` | **[< 80%]** 55% |
| M-7 | `SecurityConfig` 주석 중복 | `SecurityConfig.java:75-77` | 100% |
| M-8 | SignupPage가 인증 URL을 직접 사용 (범위 밖) | `SignupPage.jsx:166,229,324` | 95% |

---

## 5. 런타임 검증

### 5.1 L1 (frontend-support-backend 수행, test 프로필 + H2 + 시드 회원)

| # | 요청 | 기대 | 결과 | 통과 |
|---|------|------|------|:---:|
| 1 | 보호 API 토큰 없음 | 401 `.message` | 401 `{"message":"로그인이 필요합니다."}` | ✅ |
| 2 | 보호 API 잘못된 Bearer | 401 | 401 | ✅ |
| 3 | 보호 API 정상 Bearer | 200 | 200 | ✅ |
| 4 | `/admin/notices` 일반 회원 | 403 | 403 `{"message":"접근 권한이 없습니다."}` | ✅ |
| 4b | `/admin/notices` 토큰 없음 | 401 | 401 | ✅ |
| 5 | refresh 쿠키 없음 | 401 + 삭제 Set-Cookie | 기대대로 | ✅ |
| 6 | refresh 잘못된 쿠키 | 401 | 401 | ✅ |
| 6b | Access Token을 refresh 쿠키로 | 401 | 401 | ✅ |
| 6c | 없는 회원의 Refresh Token | 401 | 401 | ✅ |
| 7 | refresh 정상 쿠키 | 200 `.accessToken`, `.member` | 기대대로 | ✅ |
| 8 | `/home` + 잘못된 Bearer | 200 | 502 (가짜 TourAPI 키). 보안 필터는 통과 | 대체 ✅ |
| 9 | check-email 토큰 없음 | 200 | 200 | ✅ |
| 10 | login 틀린 비밀번호 | 401 | 401 | ✅ |

실제 TourAPI 키가 있는 local 프로필에서 #8 재확인을 권장한다.

### 5.2 L2 UI 검증 계획 (미수행)

**사전 준비**: 백엔드 local 프로필 또는 test 프로필 + 시드 회원, 프론트 `npm run dev`(Vite 프록시), Chrome DevTools(Network Preserve log, Application, Console). 보호 API를 호출하는 화면이 아직 없으므로 FR-07·FR-08은 개발 서버 콘솔에서 확인한다.

```js
const c = await import('/src/api/client.js')
const BOOKMARKS = '/api/v1/tour-bookmarks?group=DESTINATION&page=1&size=9'
```

| # | 동작 | 기대 결과 | 관찰 지점 | 대상 |
|---|------|-----------|-----------|------|
| L2-1 | 정상 로그인 | 홈 이동, 헤더 닉네임 | `Set-Cookie refreshToken` 실제 저장. Session Storage에 `waylogMember`만, 토큰 없음 | FR-05, FR-10, I-2 |
| L2-2 | 틀린 비밀번호 | 폼 오류 표시 | `/auth/refresh` 호출 없음 | FR-07 제외 규칙 |
| L2-3 | 로그인 후 새로고침 | 헤더 유지 | `POST /auth/refresh` 정확히 1회, 200 + member | FR-08, FR-09, I-2 |
| L2-4 | 새 탭에서 URL 직접 입력 | 복원 후 헤더 닉네임 | 복원 전 "로그인/회원가입" 노출 여부 | FR-09, M-4 |
| L2-5 | 로그아웃 | 즉시 비로그인, 새로고침 후에도 비로그인 | logout 200 + `Max-Age=0`, 새로고침 시 refresh 401 | FR-11 |
| L2-6 | 비로그인 새로고침 | 정상, 비로그인 | refresh 401 1회, Uncaught 오류 없음 | FR-09 |
| L2-7 | `c.setAccessToken('invalid'); await Promise.all([c.apiClient.get(BOOKMARKS), c.apiClient.get(BOOKMARKS)])` | 두 요청 resolve | 401 × 2 → refresh 1회 → 200 × 2 | FR-07, FR-08 |
| L2-8 | 쿠키 삭제 후 `c.setAccessToken('invalid'); await c.apiClient.get(BOOKMARKS)` | 401 reject, 헤더 즉시 비로그인 | refresh 401 1회, 재시도 없음 | FR-07 |
| L2-9 | 일반 회원으로 `c.apiClient.post('/api/v1/admin/notices', {})` | 403 reject, 로그인 유지 | refresh 호출 없음 | FR-02 |
| L2-10 (선택) | 로그인 후 백엔드 중지 → 새로고침 | 헤더 유지 | refresh가 401이 아닌 오류 | FR-09 네트워크 분기 |
| L2-11 (선택) | `--jwt.access-expiration=60000`, 1분 후 보호 API | 200 | 401 → refresh → 200 | 실제 만료 경로 |
| L2-12 (선택) | Firefox, Safari에서 L2-1, L2-3 | 동일 | Secure 쿠키 저장 | I-2 |

**통과 기준**: L2-1 ~ L2-9 전부 통과. L2-1 또는 L2-3이 실패하면(쿠키 미저장) I-2를 Critical로 올린다.

---

## 6. 코드 리뷰 결과 (frontend-code-reviewer, frontend-audit)

**판정: 조건부 머지.** 머지 조건은 R-1(백엔드 반영 또는 체크박스 숨김/후속 이슈 명시)과 R-2.

| ID | 등급 | 내용 | 근거 | gap 대응 |
|----|------|------|------|----------|
| R-1 | **Must Fix** | "로그인 상태 유지" 체크박스가 동작하지 않음. 세션 복원이 생기면서 체크 해제해도 브라우저 재실행 시 자동 로그인됨 (공용 PC 보안 문제) | `LoginPage.jsx:29,39`, 백엔드 사용처 0건, `JwtConfig.java:88-96` 항상 7일 쿠키, `AuthContext.jsx:81-106` | 신규 |
| R-2 | Should | 로그아웃 순간 진행 중이던 요청이 401 → 재발급 성공 → "로그아웃 화면 + 유효 토큰". 세대 번호를 401 수신 시점에 읽는 것이 원인 | `client.js:67-68,77-78,113` | M-6과 동일 |
| R-3 | Should | 새 탭에서 "로그인" 버튼이 항상 먼저 보임 | `Header.jsx:15,76-95` | M-4 |
| R-4 | Should | 로그아웃 API 실패를 조용히 무시 → 새로고침 시 재로그인, 사용자가 알 수 없음 | `AuthContext.jsx:63-68` | 신규 |
| R-5 | Should | refresh가 모든 예외를 401 + 쿠키 삭제로 처리, `@Transactional` rollback-only 가능성, `log.debug` | `AuthService.java:115-128` | M-1 |
| R-6 | Should | grade null 기본값이 필터와 불일치, nickname null도 NPE | `AuthService.java:143-144`, `JwtAuthenticationFilter.java:70-71` | M-5 |
| R-7 | Nice | 재발급 네트워크 실패 시 "Failed to fetch" 영어 문구 노출 (SignupPage `alert`) | `client.js:84`, `SignupPage.jsx:185` | 신규 |
| R-8 | Nice | 비로그인 401마다 refresh 1회 추가 → 현재 유지 권장 | `client.js:67` | 참고 |
| R-9 | Nice | 재시도 경로에서 member 미갱신 | `client.js:111-116` | M-2 |
| R-10 | Nice | 세대 카운터가 두 개 (`authGeneration`, `authVersionRef`) → 통일 또는 주석 | `client.js:25`, `AuthContext.jsx:44` | 신규 |
| R-11 | Nice | 쿠키 없을 때도 삭제 `Set-Cookie` | `AuthService.java:87,125` | M-3 |
| R-12 | Nice | 중복 주석 | `SecurityConfig.java:75-77` | M-7 |
| R-13 | Nice | LoginPage 404 개발자용 문구, `console.error` (기존 코드) | `LoginPage.jsx:55-58` | 신규 |

**Keep**: 401 재시도 조건 하나로 무한 루프·403·인증 API 제외를 모두 보장 / 회원가입 인증코드 확인 401이 재발급 대상이 아님 / 기존 사용처 회귀 없음 / single-flight와 StrictMode 처리 / 토큰은 메모리에만 / `{ message }` 형식 통일 / `authApi.js`와 콜백 주입으로 순환 의존 회피.

---

## 7. 설계 문서 갱신 필요 항목

- [x] §2.1 구성도: 로그인 호출을 LoginPage → authApi로 수정 (DV-4)
- [x] §2.2: 재발급 실패를 "401이면 토큰 제거 + 만료 통지, 그 외 오류는 상태 유지"로 수정 (DV-2)
- [ ] §2.2 또는 §11.2-6: client `authGeneration`과 AuthContext `authVersionRef` 이중 보호 명시 (DV-1) → 후속
- [ ] §2.2: 재시도 경로 재발급 성공 시 member 처리 방침 (DV-8) → 후속
- [x] §3: GRADE null이면 role 기본값 `"user"` (DV-5)
- [ ] §5.3: 응답 필드 누락 시 문구 (DV-6) → LoginPage 체크리스트에만 표시
- [x] §7: member 표시 정보만 sessionStorage 저장 (DV-3)
- [ ] §4.2: 쿠키 없을 때 삭제 `Set-Cookie` 여부 (DV-10) → 후속 과제 명시

---

## 8. 다음 단계

- [ ] 수정 범위 결정 (Checkpoint 5)
- [ ] frontend-lead / frontend-support-backend 수정 → 재리뷰·재분석
- [ ] L2 검증 수행 → 5.2에 결과 기록
- [ ] 설계 문서 7장 반영
- [ ] 완료 보고서 `/pdca report auth-token-flow`

---

## 9. Act-1 재분석

> **분석일**: 2026-09-23
> **대상**: 설계 §12 (R-1 ~ R-5, R-12), 계획 FR-12
> **변경 파일**: 백엔드 `JwtConfig.java`, `UserRequest.java`, `AuthService.java`, `SecurityConfig.java` / 프론트 `client.js`, `AuthContext.jsx`, `Header.jsx`, `Header.css`
> **런타임**: 백엔드 통과(rememberLogin false/true/생략/null 쿠키, refresh 401 시나리오 5·6·6c와 RS256 헤더 토큰, 세션 쿠키로 받은 토큰의 refresh 200). DB 장애 → 500은 미검증. 프론트 build·lint 통과, L2 미수행.
> gap 재분석과 재리뷰는 병렬로 실행했다. SC-4와 I-1은 재리뷰 결과(9.7)를 반영해 갱신했다.

### 9.1 요약

| 항목 | v0.2 | v0.3 (Act-1) |
|------|------|--------------|
| 정적 Match Rate | 98.8% | **99.6%** (구조 100 / 기능 98.9 / 계약 100) |
| FR 충족 | 11/11 | **12/12** |
| 계획 4장 성공 기준 | 7/8 | **8/8** (재리뷰 Must Fix 0) |
| 코드 리뷰 판정 | 조건부 머지 | **머지 가능** |
| §12 반영 | - | 6/6 |
| Critical / Important | 0 / 2 | 0 / 1 (I-2 L2 미검증만 남음) |
| Minor (v0.2 기준) | 8 | 해결 3 (M-1, M-4, M-7), 축소 1 (M-6), 유지 4 |
| 신규 Minor | - | 4 (N-1 ~ N-4) |

### 9.2 FR 판정 (변경분)

| ID | 판정 | 근거 | v0.2 대비 |
|----|:---:|------|-----------|
| FR-03 | ✅ | `AuthService.java:93-107` 401 + 고정 메시지 + 쿠키 삭제. 판단 `:135-171` (쿠키 없음 `:136-139`, 파싱·서명·타입·만료 `:149-151`, 회원 없음 `:167-170`) | 401 대상을 검증 실패로 한정 (R-5, M-1 해소) |
| FR-07 | ✅ | `client.js:47,84,99,104-108` | 로그아웃 경합 차단 (R-2) |
| FR-09 | ✅ | 서버 오류가 500으로 와서 `client.js:90`, `AuthContext.jsx:99`에서 로그인 유지 | 서버 결함이 로그아웃으로 이어지지 않음 |
| FR-11 | ✅ | `AuthContext.jsx:60-71` boolean 반환, `Header.jsx:51-61` 실패 알림 | 로그아웃 실패 알림 (R-4) |
| FR-12 | ✅ | `LoginPage.jsx:29,39` → `authApi.js:12` → `UserRequest.java:28` → `AuthService.java:71-72` → `JwtConfig.java:99-109`. refresh는 쿠키를 다시 발급하지 않아 유형 유지. 백엔드 런타임 통과 | 신규. 브라우저 종료는 L2-13·14 |

그 밖의 FR은 변경 없음(줄 번호만 이동). **FR 충족률: 12/12**

### 9.3 설계 §12 반영

| ID | 판정 | 근거 |
|----|:---:|------|
| R-1 | ✅ | `!Boolean.FALSE.equals(...)`로 false만 세션 쿠키, true·null은 7일. 토큰 만료 불변. 프론트 변경 없음 |
| R-2 | ✅ | 요청 시점 `sentGeneration`(`client.js:47`), 재발급 전(`:84`)·후(`:99`) 비교, 새 세대 토큰으로 1회 재시도 또는 원래 401 (`:104-108`) |
| R-3 | ✅ | `Header.jsx:105-111` 같은 클래스의 숨긴 placeholder, `Header.css:153` |
| R-4 | ✅ | `AuthContext.jsx:60-71`, `Header.jsx:53-55` 문구가 설계와 일치, `role="alert"` |
| R-5 | ✅ | 401은 `AuthService.java:136-139,149-151,167-170`만. RuntimeException `:152-154`, checked `:155-159`, 발급 실패 `:179-186`은 500. DB 오류는 잡지 않음. `/error` permitAll이라 500이 401로 바뀌지 않음 |
| R-12 | ✅ | 주석 1곳만 남음 |

### 9.4 Match Rate 재계산

기능 항목 45개(v0.2 33 + §12 12). B5가 ✅로 바뀌었고 C5는 ⚠️ 유지(M-3/R-11 후속). API 계약 7건 모두 PASS(login `rememberLogin`, 쿠키 유형 2종, refresh 200/401/500, logout, 보호 API 401, admin 403).

```
구조   100.0% × 0.2 = 20.00
기능    98.9% × 0.4 = 39.56
계약   100.0% × 0.4 = 40.00
──────────────────────────────
전체 Match Rate (정적) = 99.6%   (v0.2: 98.8%)
```

### 9.5 설계 §12와 다르게 구현된 부분

| # | 항목 | 구현 | 분류 |
|---|------|------|------|
| DV-A1 | JwtConfig 오버로드 | 인자 1개짜리 메서드를 persistent=true 위임으로 남김. 사용처 0건 | 구현 수정 (선택, N-2) |
| DV-A2 | JOSEException 단계별 분류 | 검증 단계 401 (지원하지 않는 알고리즘 등), 발급 단계 500 | 설계 갱신 |
| DV-A3 | 500 body 형식 | Spring 기본 오류 응답, `message` 필드 없음. 프론트는 status만 사용 | 설계 갱신 |
| DV-A4 | "다시 시도"·"닫기" 버튼 | 알림 시점에 로그아웃 버튼이 사라지므로 복구 수단으로 추가 | 설계 갱신 (리뷰: 유지 권장) |
| DV-A5 | Header.css 수정 | placeholder, 알림 카드 스타일 | 설계 갱신 |
| DV-A6 | 재발급 대기 중 세대 변경 처리 | 재발급 성공 후에도 세대를 다시 비교 | 설계 갱신 |
| DV-A7 | DB 조회 오류 로그 | 전파해 컨테이너 ERROR 로그에 남김 | 설계 갱신 |
| DV-A8 | checked 예외 감싸기 | `IllegalStateException`(500). IllegalArgumentException이면 400이 되므로 의도적 | 설계 갱신 |

### 9.6 Gap 변화

**해소**: M-1(R-5), M-4(R-3), M-7(R-12), R-1(Must Fix), R-4

**축소**: M-6(R-2). 로그아웃 **전에 보낸** 요청은 차단됨. 남은 경우는 로그아웃 **후**, `/auth/logout` 응답 전에 보낸 보호 API 요청뿐이며 현재 보호 API 화면이 없어 실제 영향 없음 **[확신 < 80%]**

**신규 (모두 Minor, 머지 무관)**

| ID | 내용 | 근거 | 조치 |
|----|------|------|------|
| N-1 | 재발급 대기 중 세대가 바뀌고 재발급이 401로 끝나면 새 토큰이 있어도 원래 401을 던짐(성공 경로와 동작 차이). 리뷰는 이전 세대 재발급 Promise 합류 문제로 같은 영역을 지적 | `client.js:88-95,120` | 선택. R-10(세대 카운터 통일)과 함께 처리 |
| N-2 | 사용처 없는 `createRefreshTokenCookie(String)` 오버로드 | `JwtConfig.java:88-90` | 선택. 삭제 또는 `@Deprecated` |
| N-3 | 복원 요청에 timeout이 없어 백엔드가 멈추면 placeholder가 계속 표시됨 | `AuthContext.jsx:90-103`, `Header.jsx:105-111` | 선택. R-7과 함께 `AbortSignal.timeout` |
| N-4 | 세션 쿠키는 브라우저의 "이전 세션 계속" 설정에서 복원될 수 있음. 토큰 자체는 7일 유효 | `JwtConfig.java:105-107` | 설계에 한계로 명시. 근본 대책(비유지 로그인이면 짧은 토큰 만료)은 후속 |

**변동 없음 (후속 과제)**: M-2(R-9), M-3(R-11), M-5(R-6), M-8, R-7, R-10, R-13

### 9.7 재리뷰 결과 (frontend-code-reviewer)

**판정: 머지 가능.** R-1 ~ R-5, R-12 모두 해결. Must Fix 0, Should Improve 0.

- R-2: 지난 리뷰의 문제 순서를 다시 따라가면, 로그아웃 전에 보낸 요청은 `/auth/refresh`를 아예 보내지 않는다. 재발급 도중 로그아웃해도 토큰을 저장하지 않는다.
- 정상 흐름 유지: `refreshSession`이 세대를 올리지 않고 토큰을 저장하므로 401 → 재발급 → 재시도, single-flight, 무한 루프 방지가 유지된다.
- refresh 5xx: 서버는 쿠키를 지우지 않고, 프론트는 401일 때만 상태를 해제한다.
- 회귀 없음: 홈, 회원가입, 로그인 경로.
- 기본 500 body에 예외 메시지가 노출되지 않음(`server.error.include-message` 미설정).
- Keep: R-2의 "보낸 시점 캡처 + 재발급 전후 2회 비교", R-5의 명시적 예외 나열, R-1의 Boolean 하위 호환, R-3의 클래스 재사용.

### 9.8 계획 4장 성공 기준 (갱신)

| # | 판정 | 근거 |
|---|:---:|------|
| SC-1 FR 구현 | ✅ | 12/12 |
| SC-2 컴파일, build, lint | ✅ | |
| SC-3 curl | ✅ | 5·6·6c·RS256 재실행. #1·#4는 인가 규칙 변경 없음 |
| SC-4 리뷰 Must Fix 0 | ✅ | 9.7 재리뷰 |
| SC-5 Match Rate 90% 이상 | ✅ | 99.6% |
| SC-6 린트 0 | ✅ | |
| SC-7 빌드 | ✅ | |
| SC-8 공개 API 회귀 없음 | ✅ | 필터·permitAll 변경 없음 |

**성공률: 8/8**

### 9.9 추가 L2 검증 계획

5.2의 L2-1 ~ L2-12에 추가한다. 콘솔 준비 코드는 5.2와 같다.

| # | 대상 | 동작 | 기대 결과 |
|---|------|------|-----------|
| L2-13 | FR-12 | "로그인 상태 유지" 해제 후 로그인 → 브라우저 완전 종료 후 재실행("이전 세션 계속" 끔) | 비로그인, refresh 401. 쿠키 만료가 "세션" |
| L2-14 | FR-12 | 체크한 채 로그인 → 재실행 | 닉네임 복원, `Max-Age=604800` |
| L2-15 (선택) | N-4 | L2-13을 "이전 세션 계속" 켠 상태로 | 결과 기록 |
| L2-16 | R-3 | Slow 3G, 로그인 상태에서 새 탭 URL 직접 입력 | 빈 자리 → 닉네임, "로그인" 글자 안 보임, 레이아웃 고정 (1100px, 760px 이하 포함) |
| L2-17 | R-4 | DevTools에서 `*/api/v1/auth/logout` 차단 → 로그아웃 | 즉시 비로그인 + 실패 알림 |
| L2-18 | R-4 | 차단 해제 → "다시 시도" | "처리 중..." 비활성화 후 알림 닫힘, 새로고침 후 비로그인 |
| L2-19 | R-2 | `c.setAccessToken('invalid'); const p = c.apiClient.get(BOOKMARKS); c.setAccessToken(null); await p.catch(e => e.status)` | `401`, `/auth/refresh` 호출 없음 |
| L2-20 (선택) | R-5 | DB 중지 또는 `@MockitoBean UserRepository` 테스트로 refresh 500 | 500, 삭제 `Set-Cookie` 없음, ERROR 로그 |
| L2-21 (선택) | FR-09 + R-5 | L2-20 상태에서 로그인된 브라우저 새로고침 | 닉네임 유지 |

**통과 기준**: L2-1 ~ L2-9, L2-13, L2-14, L2-16 ~ L2-19

### 9.9.1 L2 수행 결과 (2026-09-23)

- **환경**: 백엔드 test 프로필(H2) + 시드 회원 `tester@waylog.dev`, 포트 8080 / 프론트 Vite 개발 서버 5173 (프록시 사용). 메인 세션이 프록시 경유 로그인 시 `Set-Cookie: refreshToken=...; Path=/; Secure; HttpOnly; SameSite=Strict`(rememberLogin=false, Max-Age 없음)와 쿠키 없는 refresh 401을 curl로 확인.
- **사용자 수동 확인**: 로그인 관련 흐름을 브라우저에서 테스트했고 **큰 오류는 나타나지 않음**.
- **한계**: 시나리오 번호별 통과 여부는 기록되지 않았다. 따라서 L2 개별 항목(특히 L2-13·14 브라우저 재시작, L2-17·18 로그아웃 차단, L2-19 콘솔 시나리오)은 "사용자 확인, 항목별 미기록"으로 둔다.
- **I-2 판정**: 핵심 위험이던 "Secure 쿠키가 localhost 프록시 환경에서 동작하는지"는 로그인·새로고침 흐름이 정상이었다는 사용자 확인으로 해소된 것으로 본다. I-2는 Important → 해소(항목별 기록은 후속).

### 9.10 문서 갱신 필요 (Act-1분)

- [x] 계획 §2.2 제외 목록의 "로그인 상태 유지" 항목이 FR-12와 모순 → 취소선
- [x] 계획 §6.1에 `JwtConfig`, `UserRequest`, `Header.css` 추가
- [x] 설계 §4.1·§4.2: login 요청 `rememberLogin`, 쿠키 유형 2종, refresh 500(쿠키 유지)
- [ ] 설계 §11.1 파일 목록 추가 (DV-A5) → 후속
- [ ] 설계 §12: N-4 한계, DV-A2·A3·A4·A6·A7·A8 → 후속
- [x] 7장 기존 항목(DV-1 ~ DV-10) → 일부 반영 (DV-2, DV-3, DV-4, DV-5)

### 9.11 다음 단계

- [ ] L2 브라우저 검증 (I-2)
- [ ] 9.10과 7장 문서 갱신
- [ ] `/pdca report auth-token-flow` (Match Rate 99.6%, iterate 불필요)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-23 | 초기 gap 분석 (정적 98.8%, L2 미수행) | bkit gap-detector |
| 0.2 | 2026-09-23 | 코드 리뷰 결과 통합(6장), SC-4·I-1 갱신 | WOOJIN (Claude Code 보조) |
| 0.3 | 2026-09-23 | 9장 Act-1 재분석 (99.6%, FR 12/12, 성공 기준 8/8, 재리뷰 머지 가능) | bkit gap-detector, frontend-code-reviewer |
