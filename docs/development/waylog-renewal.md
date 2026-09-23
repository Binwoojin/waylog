# WayLog 리뉴얼: 프론트엔드 진단과 회원가입 이메일 중복확인 수정

> 작성일: 2026-09-23
> 상태: 모든 변경은 **미커밋** (브랜치 `appmod/java-upgrade-20260923005029`)
> 변경 파일: `frontend/src/pages/SignupPage.jsx`, `backend/src/main/java/kr/co/mycom/travel_korea/config/SecurityConfig.java`

## 1. 개요

이번 세션에서 한 일은 다음과 같다.

1. **frontend-lead**가 프론트엔드 전체를 읽기 전용으로 진단하고 개선 우선순위(Must/Should/Later)를 정했다.
2. Must Fix 1번 **"회원가입 이메일 중복확인이 항상 실패함"**을 고쳤다.
3. **frontend-code-reviewer** 리뷰에서 Critical 이슈(해당 API가 인가 설정상 비로그인 사용자에게 막혀 있음)가 나왔다. **frontend-support-backend**가 `SecurityConfig`를 고쳤다.
4. 리뷰 Nit에 따라 `SignupPage.jsx` 상단의 API 주석을 실제 백엔드 코드와 맞게 정정했다.

진단 한계: 프론트엔드에 `node_modules`가 없어서 lint, build, 렌더링은 확인하지 못했다.

---

## 2. 진단 결과

### 2.1 기술 스택

| 영역 | 현황 |
|---|---|
| 빌드 | Vite 8.2 + `@vitejs/plugin-react` 6 |
| 언어 | JavaScript (JSX). TypeScript는 쓰지 않음 |
| UI | React 19.2, StrictMode 사용 (`main.jsx:8`) |
| 라우팅 | react-router-dom 7.18, `BrowserRouter` + `Routes` (`App.jsx:265-285`) |
| 전역 상태 | `AuthContext` 하나뿐 |
| 서버 통신 | 직접 만든 fetch 래퍼 `api/client.js`. React Query, SWR, axios는 없음 |
| 스타일 | 페이지별 전역 CSS |
| 품질 도구 | ESLint 10만 있음. Prettier, 테스트, 프론트 CI는 없음 |
| 환경 설정 | `VITE_API_BASE_URL`, Vite 프록시 `/api` → `localhost:8080`. `.env.example`은 없음 |
| 문서 | README가 Vite 템플릿 그대로 |
| 런타임 의존성 | react, react-dom, react-router-dom 3개 |

### 2.2 구조

- 폴더: `api/`, `context/`, `components/{home,layout,search,icons}`, `pages/`(12개), `data/`(목업), `assets/`(약 109MB)
- `hooks/`, `utils/`, 공통 UI, 도메인별 API 모듈은 없다.
- `HomePage`가 `App.jsx:64` 안에 들어 있다.
- 에셋 상태: 쓰지 않는 파일 13개, 중복 파일 15쌍 이상, 3~4MB짜리 PNG가 있다.

### 2.3 화면 흐름

- 실제 API를 쓰는 화면은 `/`(`GET /api/v1/home`), `/login`, `/signup` 세 곳뿐이다.
- `forgot-password`, `destinations/*`, `enjoy/*`는 목업 데이터로 동작한다.
- 404 라우트가 없다.
- 홈에서 상세 화면으로 갈 때, 실제 `contentId`가 목업에 없으면 첫 번째 목업으로 대체한다(`TravelDetailPage.jsx:13`, `EnjoyDetailPage.jsx:19`). 그래서 **다른 장소가 표시된다**.
- Header의 `/bookmarks`, `/mypage` 링크는 대응하는 라우트가 없다(`Header.jsx:83-84`).
- 피드, 글쓰기, 댓글, 좋아요, 북마크, 마이페이지는 프론트 화면이 없다. 백엔드에는 Feed, Comment, FeedProfile, TourBookmark 컨트롤러가 있다.

### 2.4 컴포넌트 설계

| 구분 | 내용 |
|---|---|
| 장점 | `PlacePinIcon` 설계. 홈 섹션 4개가 `{items, isLoading, errorMessage}` 규약을 따름. `SearchModal`을 설정 기반으로 재사용함(단 props가 18개) |
| 중복 | 홈 로딩/에러/빈 상태 분기(4회 반복), 인증 레이아웃, 비밀번호 보기 토글, 비밀번호 규칙(`SignupPage.jsx:79-93`, `ForgotPasswordPage.jsx:37-50`), 북마크 SVG(5곳 이상), 페이지네이션, 뒤로가기 버튼, 이름은 같고 구현은 다른 `SectionHeading` |

### 2.5 상태 관리

- 잘한 점: 파생값을 렌더 중에 계산한다. `AuthContext`를 메모이제이션한다. 단, 토큰은 보관하지 않는다.
- 서버 상태: 모듈 전역 Promise 캐시에 둔다(`App.jsx:33-55`). 이 캐시는 무효화할 수 없다.
- URL 상태: `window.location.search`로 읽고 `window.location.href`로 이동한다(`SearchModal.jsx:25,61`).
- 목록의 필터, 정렬, 페이지가 로컬 state라서 뒤로가기를 하면 사라진다.
- **버그**: 라우트 파라미터가 바뀌어도 이전 state가 남는다(`EnjoyCategoryPage.jsx:11-14`, `TravelDetailPage.jsx:14-16`).
- `SignupPage`는 `useState`가 13개이고 상태를 boolean 조합으로 표현한다. 타이머가 0이 된 뒤에도 interval이 계속 돈다.

### 2.6 API 연동

- `client.js`는 `get`, `post`, `put`만 제공한다. 응답이 JSON이 아니면 `{}`를 반환한다(`client.js:20`). timeout과 abort 처리가 없다.
- **토큰 흐름이 끊겨 있다**:
  - 백엔드는 Bearer 토큰으로 인증한다(`JwtAuthenticationFilter.java:40-55`).
  - 그런데 프론트는 `login(response.member)`만 호출해 accessToken을 버린다(`LoginPage.jsx:50`).
  - 요청 헤더에 토큰을 넣지 않고, 401을 받았을 때 refresh하는 로직도 없다.
  - 로그아웃할 때 API를 호출하지 않는다(`Header.jsx:47-51`).
- ErrorBoundary가 없다.
- 엔드포인트가 코드에 하드코딩되어 있다.

### 2.7 반응형

- 모든 CSS 파일에 `@media`가 있지만, 브레이크포인트가 13종으로 제각각이다.
- `Header.css:166`: 760px 이하에서 nav를 `display: none`으로 숨기는데 대신 쓸 메뉴가 없다(확인됨).
- iOS 모달 하단 문제, 히어로 고정 높이, 콜라주 겹침은 (추측).

### 2.8 비동기 UI 상태

| 화면 | 상태 |
|---|---|
| 홈 섹션 | 로딩, 에러, 빈 상태를 처리함. 재시도는 없음 |
| 로그인 | 양호 |
| 회원가입 | 로딩 표시와 중복 클릭 방지가 없음. 최종 가입 요청에 catch가 없음 |
| 목록 | 빈 상태 처리가 없음 |
| Enjoy 상세 | 잘못된 카테고리가 들어오면 크래시(`EnjoyDetailPage.jsx:27`) |

### 2.9 기존 코드의 강점

- 홈 API 호출을 `HomePage`에서 한 번만 하고 props로 내려주도록 리팩터링되어 있다.
- StrictMode의 이중 요청을 Promise 캐시로 막는다.
- `isActive` 가드와 cleanup을 쓴다.
- 방어적으로 렌더링한다.
- 접근성 속성, rAF 기반 스크롤, `prefers-reduced-motion` 대응이 있다.

---

## 3. 개선 우선순위

### Must Fix

| # | 항목 | 상태 |
|---|---|---|
| 1 | 회원가입 이메일 중복확인이 항상 실패함 | **이번 세션 수정 (미커밋)** |
| 2 | 인증 토큰 흐름 | 미착수 |
| 3 | 회원가입 보완: 닉네임 API, 최종 가입 try/catch와 로딩, 디버그용 alert/console.log 제거 | 미착수 |
| 4 | 상세 페이지의 잘못된 fallback | 미착수 |
| 5 | 크래시, 404, ErrorBoundary, 깨진 링크 | 미착수 |
| 6 | 모바일에서 헤더 내비게이션이 없음 | 미착수 |
| 7 | 비밀번호 찾기가 실제로는 동작하지 않음(가짜 동작) | 미착수 |

### Should Improve

- SPA 라우팅으로 전환: `useNavigate`, `useSearchParams`, `Link` 사용
- 필터/정렬/페이지를 URL 상태로 옮기고, 라우트 파라미터 변경 시 state가 남는 버그 수정
- 서버 상태 계층 정비: TanStack Query 도입을 검토하거나 공통 훅을 만든다. 도메인별 API 모듈을 두고, `delete`, `patch`, abort를 추가한다.
- 공통 Async 상태 컴포넌트와 재시도 버튼을 만든다. `alert`는 인라인 메시지나 토스트로 바꾼다.
- 가짜 UI 제거: 45개 복제 데이터, 가짜 페이지네이션, 핸들러 없는 버튼, 로컬에서만 동작하는 북마크
- 공통 컴포넌트 추출, `App.jsx` 분리
- 목업 필드명을 실제 API 필드명으로 맞추기
- `SignupPage`를 상태 머신으로 정리
- Prettier, `.env.example`, README 추가. 브레이크포인트 통일

### Later

- 접근성: `lang="ko"`, 모달 포커스 트랩, `aria-label`
- 성능: WebP 변환, 이미지 lazy 로딩, `React.lazy`
- 테스트: Vitest + React Testing Library
- TypeScript 점진 전환
- 신규 기능은 인증 흐름을 정리한 뒤에 진행

---

## 4. 수행한 작업과 의사결정

### 4.1 이메일 중복확인 조건 수정 (frontend-lead, Must Fix 1)

**문제**

`SignupPage.jsx:128`의 조건이 `if (data.email !== null)`이었다. 백엔드는 `{ available: boolean }`을 반환한다(`UserController.java:20-28`). 응답에 `email` 필드가 없으므로 `data.email`은 `undefined`이고, `undefined !== null`은 항상 `true`다. 그래서 **누구도 가입할 수 없었다**.

**수정**

| 조건 | 처리 |
|---|---|
| `typeof data.available !== 'boolean'` | 안내 메시지를 보여주고 중단 (fail-closed) |
| `!data.available` | 이미 사용 중인 이메일이라고 안내 |
| 그 외 | 다음 단계로 진행 |

**의사결정**

- **fail-closed를 택한 이유**: `client.js`는 JSON이 아닌 응답을 `{}`로 바꾼다. 필드 존재만 확인하는 식의 느슨한 조건이면 이런 응답을 "사용 가능"으로 잘못 판단할 수 있다. 그래서 응답 형식이 예상과 다르면 진행하지 않도록 했다.
- **범위를 좁힌 이유**: 이번 수정은 조건문만 고쳤다. 닉네임 확인, try/catch, alert 정리는 Must Fix 3으로 따로 뺐다.

### 4.2 중복확인 API 비로그인 허용 (frontend-support-backend, 리뷰 C1 조치)

**문제**

`/api/v1/users/check-email`이 `SecurityConfig`의 `permitAll` 목록에 없었다. 그래서 비로그인 사용자의 요청이 차단됐다. 4.1의 수정만으로는 증상이 "HTTP 403"으로 바뀔 뿐, 여전히 가입할 수 없었다.

**수정** (`SecurityConfig.java:40-41`)

```java
.requestMatchers(HttpMethod.GET, "/api/v1/users/check-email", "/api/v1/users/check-nickname").permitAll()
```

**의사결정**

- `/users/**` 전체가 아니라 이 두 엔드포인트의 **GET만** 열었다.
- 엔드포인트를 `/auth/**` 아래로 옮기는 방법도 있었지만, 변경이 가장 작은 `permitAll` 추가를 택했다.
- 토큰이 없거나 잘못된 경우에도 문제가 없는지 필터 동작을 확인했다. `JwtAuthenticationFilter.java:49-52`는 Authorization 헤더가 없으면 그냥 통과시킨다. `81-87`은 토큰이 잘못되면 SecurityContext만 비우고 통과시킨다.

**보안 트레이드오프**

- 이메일 가입 여부가 외부에 노출된다. 즉 가입된 이메일을 하나씩 대입해 찾아낼 수 있다(계정 열거).
- 이는 가입 중복확인 기능이 본질적으로 가진 트레이드오프다. 가입 API도 이미 같은 정보를 노출한다.
- 완화책은 이번 범위 밖이다: IP 기반 rate limit, 인증코드 발송 단계와 통합.

### 4.3 SignupPage API 주석 정정 (frontend-lead, 리뷰 Nit N1)

`SignupPage.jsx` 상단의 API 주석을 실제 백엔드 코드와 대조해 모두 정정했다.

| 엔드포인트 | 요청 | 응답 |
|---|---|---|
| `GET /users/check-email` | - | `{ available }` |
| `POST /auth/email-verification` | `{ email }` | 본문 없음 |
| `POST /auth/email-verification/confirm` | `{ email, authCode }` | `{ verificationToken }`, 인증코드 불일치 시 401 |
| `GET /users/check-nickname` | - | `{ available }` |
| `POST /auth/signup` | `{ email, password, nickname, verificationToken }` | `{ memberId, email, nickname, role }` |

**대조하다 발견한 문제 (수정하지 않음)**

- 프론트가 보내는 `purpose`, `agreements` 필드가 백엔드 DTO에 없어 무시된다. 즉 **서버가 약관 동의 여부를 검증하지 않는다**.
- 로그인 요청의 `rememberLogin`도 백엔드 `UserRequest`에 없어 무시된다.
- `authCode`는 프론트에서 문자열이고 백엔드에서는 Integer다(추측: Jackson이 변환함).
- 프론트 타이머는 3분으로 고정되어 있다. 백엔드의 인증코드 만료 시간과 같은지는 확인하지 않았다.

---

## 5. 리뷰 결과 (frontend-code-reviewer)

- **판정**: 조건부로 머지 가능. 정상 응답, 비JSON 응답, 4xx 경로를 각각 대조해 보니 조건 로직은 정확하다.

| 등급 | 내용 | 처리 |
|---|---|---|
| Critical C1 | check-email이 `permitAll`에 없어 비로그인 사용자가 차단됨 | 4.2에서 조치 |
| Minor M1 | 요청이 진행되는 동안 이메일을 바꾸면, 늦게 도착한 응답이 새 이메일을 "확인 완료"로 표시함(경쟁 조건). 기존부터 있던 문제 | 미조치 |
| Minor M2 | 네트워크 실패 시 "Failed to fetch"라는 영문 메시지가 그대로 노출됨 | 미조치 |
| Nit N1 | 상단 API 주석이 절반만 정정됨 | 4.3에서 조치 |
| Nit | 이메일을 바꿔도 인증 토큰과 남은 시간이 초기화되지 않음. 공백과 세미콜론 스타일이 일관되지 않음 | 미조치 |
| Keep | fail-closed 처리, early return 구조 | 유지 |

---

## 6. 검증

| 항목 | 결과 |
|---|---|
| 백엔드 컴파일 `mvnw -q -DskipTests compile` | EXIT=0 |
| JDK 25 + test 프로필(H2)로 서버 실행, 토큰 없이 `GET check-email` | 200 `{"available":true}` |
| 토큰 없이 `GET check-nickname` | 200 |
| 토큰 없이 `/users/me` (대조군) | 403 |
| 토큰 없이 `POST check-email` | 403 (GET만 열렸음을 확인) |
| 잘못된 Bearer 토큰 + `GET check-email` | 200 |
| MySQL 기본 프로필 | 실행하지 않음 |
| 프론트 lint, build, 브라우저 E2E | 실행하지 않음 (`node_modules` 없음) |
| 회원가입 1단계를 실제 화면에서 통과하는지 | 확인하지 않음 |

검증이 끝난 뒤 서버는 종료했다.

**환경 메모**: 로컬 `JAVA_HOME`은 JDK 17을 가리키지만 빌드 대상은 Java 25(class version 69)다. 따라서 `C:\Users\ASUS\dev\jdks\jdk-25.0.2`를 써야 한다.

---

## 7. 후속 과제

- **401/403 정리**: 미인증 요청이 401이 아니라 403을 받는다(`authenticationEntryPoint` 미설정). Must Fix 2에서 만들 401 기반 refresh 로직과 충돌하므로 **두 작업을 함께 수정해야 한다**.
- 백엔드 입력 검증이 없다(`@Email`, `@NotBlank` 미적용).
- 리뷰 M1(경쟁 조건), M2(영문 에러 메시지), 이메일 변경 시 인증 상태 초기화
- 약관 동의 서버 검증, `authCode` 타입, 인증코드 만료 시간 일치 여부 확인
- 계정 열거 완화책: rate limit, 인증코드 발송 단계와 통합
- 프론트 의존성을 설치한 뒤 lint, build, 회원가입 E2E 확인
- 3장의 Must Fix 2~7 순서대로 진행
- 변경 사항 커밋 (현재 미커밋)

---

## 8. 포트폴리오 포인트

> frontend-lead와 frontend-code-reviewer가 언급한 내용만 정리했다. **frontend-interview-coach는 이번 세션에서 실행되지 않았으므로** 면접 질문 정리는 아직 없다.

- **응답 계약 불일치를 찾은 트러블슈팅 사례**: 프론트 조건(`data.email`)과 백엔드 응답(`{ available }`)을 코드 수준에서 대조해 원인을 찾았다. 리뷰어는 이 사례를 **인가 설정(403) 문제와 한 묶음으로** 설명해야 한다고 짚었다. 프론트 수정만으로는 해결되지 않았기 때문이다.
- **fail-closed 설계**: fetch 래퍼가 비JSON 응답을 `{}`로 바꾸는 특성을 고려해, 응답 형식이 예상과 다르면 진행하지 않도록 했다.
- **기존 코드의 강점**: 홈 API를 한 번만 호출하고 props로 내려주는 구조, StrictMode 이중 요청을 Promise 캐시로 막은 점
