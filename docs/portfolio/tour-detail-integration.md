# tour-detail-integration 포트폴리오·면접 자료

> **기능**: tour-detail-integration (상세 페이지 id 해석: 목업 / TourAPI 상세 API / not-found, 홈 카드 → 상세 흐름 복구)
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **목표 직무**: 프론트엔드 개발자
> **작성일**: 2026-09-24
> **근거 자료**: 계획 `docs/01-plan/features/tour-detail-integration.plan.md`(v0.3), 설계 `docs/02-design/features/tour-detail-integration.design.md`(v0.4), 분석 `docs/03-analysis/tour-detail-integration.analysis.md`(v0.2, Check 2회차), 완료 보고서 `docs/04-report/features/tour-detail-integration.report.md`, 그리고 커밋 전 작업 트리의 실제 코드(`frontend/src/data/tourContentTypes.js`, `api/tourApi.js`, `hooks/useTourDetail.js`, `components/detail/{TourApiDetail,DetailStatus,detailMessages}`, `components/common/ScrollToTop.jsx`, `pages/{TravelDetailPage,EnjoyDetailPage}.jsx`, `components/home/{Recommended,Theme,WeeklyNews}*Section.jsx`, `App.jsx`, 백엔드 `tour/` 5개 파일의 `git diff`)

> **사실 범위 메모 (이 문서 전체에 적용)**
> - 성능 수치(로딩 시간, 렌더 횟수, 호출량 측정값)와 사용자 지표는 **측정하지 않았다.** 이 문서에 그런 수치는 없다.
> - **브라우저 L2(설계 §8.3, 분석 11.8)는 전부 미측정이다(F-7).** 스크롤 초기화, 재시도 포커스, 360px 폭, 스크린 리더 공지, 이미지 대체는 코드와 정적 분석으로만 확인했다. app-safety-net 때와 달리 이번에는 헤드리스 자동 L2도 하지 않았다.
> - **실제 TourAPI 키가 없다(G-02).** "없는 contentId → TourAPI가 `0000` + 빈 items를 준다"는 백엔드 404 판정의 전제는 검증되지 않았다. L1 #5·#6 미측정.
> - 검증된 것: `npm run build` 성공, `npx eslint .` 오류 0, `mvnw compile` 통과, `local-mock` 프로필 L1 curl 9개 중 7개(#1 ~ #4, #7 ~ #9) 기대값, 코드 리뷰 2회(1차 MF-1·MF-2·SI-1 ~ 4 → 수정, 2차 MF-A → 수정 후 27개 입력 회귀 케이스 FAIL 0), bkit gap 분석 정적 Match Rate 96.8% → 97.6%.
> - 27개 회귀 케이스는 재리뷰 대신 쓴 확인 수단이다. 저장소에 테스트 파일로 남아 있지 않다(프로젝트에 테스트 러너가 없음).
> - 성공 기준은 8/9 충족, 1건(SC-4, 실제 TourAPI의 없는 id → 404) 부분 충족이다.

---

## Overview

홈 카드에서 상세로 가는 클릭이 **항상 다른 장소**를 보여 주고, 잘못된 주소도 조용히 첫 번째 목업으로 대체되던 문제를 고쳤다. 목록 페이지는 아직 목업(slug id)이고 홈은 실제 TourAPI contentId(숫자)를 쓰는 **두 데이터 출처가 섞인 상황**이었다. 그래서 상세 라우트가 id를 한 곳에서 "목업 / API 조회 / not-found" 세 가지로 해석하고, 그 아래 View는 출처를 모르는 view model만 받는 구조로 만들었다. API 경로는 `status` 하나로 된 비동기 상태 훅(`useTourDetail`), `isActive` 플래그와 `key` 재마운트로 이전 응답·이전 상태가 남지 않게 했다. 백엔드는 "없는 콘텐츠"를 외부 장애(502)와 구분해 404로 응답하도록 바꿨다.

## Background

- `TravelDetailPage`는 `allDestinationMocks.find(...) || allDestinationMocks[0]`, `EnjoyDetailContent`는 `findEnjoyItem(...) || config.items[0]`로 조회했다(`git diff`의 삭제 줄). 목업에 없는 id는 첫 번째 목업(비자림, 부산 바다축제 등)으로 대체됐다.
- 홈 "여행을 더 즐겁게"와 "이번 주 여행 소식" 카드는 TourAPI contentId(숫자)를 상세 URL로 넘겼다. 기본·`local-mock` 두 프로필 모두 숫자 id라 목업 slug와 겹치지 않는다. 그래서 **홈 → 상세 클릭은 모두 다른 장소**를 보여 줬다. 음식점·숙박 카드도 관광지 상세 경로로 가서 유형까지 틀렸다(계획 1.2).
- "이번 주 여행 소식"은 `<a href>`라 전체 새로고침이 일어나 홈 API와 세션 복원(`/auth/refresh`)을 다시 요청했다. "추천 여행지"는 상세가 아니라 목록(`/destinations/attractions`)으로 갔다.
- 같은 라우트에서 id만 바뀌면(주변·추천 카드 이동) `saved`, `photoIndex` 등 이전 state가 남았다(진단 2.5절).
- 백엔드 상세 API(`GET /api/v1/tour/contents/{id}?contentTypeId=`)는 이미 있었지만 프론트가 호출하지 않았다. 없는 contentId는 **502**로 응답해 외부 장애와 구분할 수 없었고, `local-mock` 프로필에서는 `getDetailCommon`이 null을 돌려 NPE(500)가 났다.
- 선행 기능 app-safety-net이 `NotFoundPage`에 `title`·`description` props를 만들어 두었고, 이번 작업에서 수정 없이 재사용했다.

---

## 1. 포트폴리오 프로젝트 설명용 문단

WayLog는 React와 Spring Boot로 만든 국내 여행 SNS입니다. 홈 추천 카드는 실제 TourAPI의 숫자 contentId를 쓰는데 상세 페이지는 목업 slug에서만 찾아서, 홈에서 누른 카드와 다른 장소가 상세에 표시되고 없는 주소도 첫 번째 목업으로 조용히 대체되고 있었습니다. 목록은 아직 목업이라 상세만 API로 바꿀 수 없어서, 상세 라우트가 id를 "목업 / API 조회 / not-found"로 한 번 해석하고 그 아래 View는 출처를 모르는 공통 view model만 받도록 나눴습니다. 목록이 API로 전환되면 해석 함수의 목업 분기만 지우면 되는 점진적 전환 구조입니다. API 조회는 `status` 하나로 된 커스텀 훅으로 로딩·성공·없음·오류를 표현하고, effect cleanup의 `isActive` 플래그와 `key` 재마운트로 늦은 응답과 이전 상태가 새 화면에 섞이지 않게 했습니다. 백엔드와는 "없음은 404, 외부 장애는 502"로 계약을 정리했고, 200이어도 형식이 다른 응답은 오류로 보는 fail-closed 원칙을 적용했습니다. 코드 리뷰 2회와 gap 분석 2회를 거쳐 정적 Match Rate 97.6%로 마쳤지만, 실제 TourAPI 키와 브라우저 확인은 아직 남아 있습니다.

---

## 2. 이력서 bullet

- 목업(slug)과 TourAPI(숫자 contentId)가 섞인 상황에서 **상세 id를 라우트 한 곳에서 "목업 / API / not-found"로 해석하고, View는 출처를 모르는 view model만 받는 구조**로 재설계해 홈 → 상세에서 다른 장소가 표시되던 결함을 수정 (목록 API 전환 시 목업 분기만 삭제하면 되는 점진적 전환 구조)
- 상세 조회를 **`status` 단일 값(`loading`·`success`·`not-found`·`error`)의 커스텀 훅**으로 구현하고 effect cleanup의 `isActive` 플래그 + `key` 재마운트로 늦은 응답·이전 state 잔존을 차단, 200이지만 형식이 다른 응답은 오류로 처리(fail-closed)
- Spring Boot 백엔드와 **"없는 콘텐츠 404 / 외부 장애 502 / 잘못된 요청 400" 상태 코드 계약**을 정리해 프론트가 `code` 문자열 없이 상태 코드만으로 not-found와 재시도 가능한 오류를 구분하도록 구성 (`local-mock` 프로필 L1 curl 측정 7개 기대값 일치)
- 코드 리뷰에서 지적된 전화번호 `tel:` 링크 결함(여러 번호·설명 숫자를 이어 붙여 존재하지 않는 번호 생성)을 **한국 전화번호 형태 정규식 + "번호가 정확히 1개일 때만 링크" 규칙**으로 두 차례 고쳐 27개 입력 회귀 케이스 FAIL 0 확인
- `<a>` → `Link` 전환으로 생긴 스크롤 위치 회귀를 `ScrollToTop`(`useLayoutEffect`, pathname 비교, POP 제외)으로 해결하고, TourAPI HTML 텍스트는 `DOMParser`로 텍스트만 추출해 `dangerouslySetInnerHTML` 없이 렌더링

> bullet의 수치는 모두 문서에 기록된 값이다. "L1 7개"는 `local-mock` 프로필 curl #1 ~ #4, #7 ~ #9이고, 실제 키가 필요한 #5·#6은 미측정이다. 스크롤 회귀 수정의 브라우저 확인(L2 #2)은 아직 하지 않았다.

---

## 3. 기술적 의사결정

### 3.1 처리 방향: 목업 + API 혼합 해석 (대안: 404만 / 상세 전면 API)

| 기준 | A. 404만 적용 | A'. 404 + 홈 링크를 목록으로 | B. 상세 전면 API | **C. 목업 + API 해석 (선택)** |
|------|:---:|:---:|:---:|:---:|
| 홈 → 상세 | **항상 404** | 상세로 가지 않음 | 정상 | 정상 |
| 목록 → 상세 | 정상 | 정상 | **깨짐** (목록은 slug) | 정상 |
| 로딩·오류 UI | 불필요 | 불필요 | 필요 | 필요 (API 경로만) |
| 위험 | 핵심 흐름이 막힌 것처럼 보임 | 기능 후퇴 | 목록 페이지네이션·검색까지 범위 확대 | 두 출처 공존 (해석 함수로 격리) |

- **근거** (설계 §2.0): 원래 과제는 "없는 id를 첫 목업으로 대체하는 버그"(진단 Must Fix 4, 이전 이름 `detail-not-found`)였다. 그런데 진입점을 모두 조사하니 홈 링크는 전부 목업에 없는 숫자 id였다. 404만 적용하면 "틀린 장소"가 "항상 없음"으로 바뀔 뿐 흐름은 복구되지 않는다. B는 카탈로그·검색·즐기기 카테고리·즐기기 검색 네 화면이 목업 slug로 링크하고 있어 먼저 목록 API 전환이 필요했다.
- **결정**: C (사용자 결정 D-1). 이미 있는 `TourDetailController`를 쓰고, 목록이 API로 전환되면 해석 함수의 목업 분기만 지운다. 작업의 중심이 API 연동으로 바뀌어 기능명도 `tour-detail-integration`으로 바꿨다(D-6).
- **면접 포인트**: "버그를 고치러 들어갔는데 진입점을 표로 전부 정리해 보니 단순 404 처리로는 핵심 흐름이 오히려 막힌다는 걸 알게 됐다"는 흐름이 이 결정의 핵심이다.

### 3.2 id 해석을 라우트 한 곳에서, View는 출처를 모름

```js
// TravelDetailPage.jsx (모듈 수준 순수 함수, 렌더 중 계산하는 파생값)
function resolveDestinationDetail(id, typeParam) {
  const item = allDestinationMocks.find(entry => entry.id === id)
  if (item) return { kind: 'mock', item }
  const contentTypeId = typeParam == null ? DESTINATION_CONTENT_TYPES.attraction : toDestinationTypeId(typeParam)
  if (isTourContentId(id) && contentTypeId != null) return { kind: 'api', contentId: id, contentTypeId }
  return { kind: 'not-found' }
}
```

| 순서 | 조건 | 결과 | API 호출 |
|:---:|------|------|:---:|
| 1 | (즐기기만) 카테고리가 `enjoyConfigs`·`categoryFacts`에 없음 | not-found (app-safety-net 동작 유지) | 0 |
| 2 | id가 목업에 있음 | `mock` | 0 |
| 3 | `/^\d{1,12}$/`이고 유형을 정할 수 있음 | `api` | 1 |
| 4 | 그 외 | `not-found` | 0 |

- **state에 두지 않은 이유**: URL에서 계산할 수 있는 값이라 렌더 중 파생값으로 둔다. 동기화할 state가 없다.
- **해석 결과 → 화면 구성**
  - `mock`: 기존 View(`TravelDetailView`, `EnjoyDetailContent`)에 `toDestinationMockDetail` / `toEnjoyMockDetail`로 만든 view model을 넘긴다.
  - `api`: 공통 `TourApiDetail`이 훅을 호출하고, 성공하면 `renderDetail(detail)`로 **같은 View**를 그린다(render prop).
  - `not-found`: `NotFoundPage`에 상세 전용 문구(`detailMessages.js`)를 넘긴다.
- **view model** (설계 §3.1): `{ source, id, title, image, address, typeLabel, description, infos, contact, meta? }`. View는 `detail.source === 'mock'`일 때만 목업용 하드코딩 섹션(요약 facts, `064-710-7912` 전화번호, 추가 사진 슬라이더, 주변 목업)을 그린다. API 콘텐츠에 거짓 정보를 붙이지 않기 위해서다(설계 원칙 "거짓 정보 금지", FR-05).
- **목업 하드코딩을 view model로 일반화하지 않은 이유**: 목업은 목록 API 전환 때 사라질 대상이다. 사라질 코드를 추상화하지 않고 `source` 분기로 남겼다(설계 §3.1).
- **의존 방향**: 화면 → 훅 → `api/tourApi` → `api/client`. `components/detail`은 목업을 import하지 않고, 목업 import는 두 페이지 파일에만 있다. 예외 하나: 두 페이지가 `api/tourApi`의 `toTelHref`를 직접 import한다. 네트워크를 쓰지 않는 순수 함수라 "화면은 API URL을 직접 쓰지 않는다" 원칙은 유지된다고 판단했다(분석 C-1).
- **`?type=` 검증** (G-01): 1차 구현은 `Number()` 변환이라 `'0xc'`, `'12.0'`, `' 12'`, `'1.2e1'`도 12가 되어 한 콘텐츠에 URL이 여러 개 생겼다. gap 분석 지적 뒤 문자열 `'12'`·`'14'`만 비교하는 `toDestinationTypeId`로 바꿨다.
- **즐기기 유형은 카테고리 slug로** 정한다: `getEnjoyContentType`이 `Object.hasOwn`으로 `__proto__` 같은 프로토타입 키를 막는다. app-safety-net에서 정한 규칙을 이어 쓴 것이다(분석 A-1).
- **단점(정직하게)**: 즐기기 카테고리 기준이 `enjoyConfigs`, `categoryFacts`, `ENJOY_CONTENT_TYPES` 세 곳에 있다(G-07). 지금은 키가 일치하지만 목록 API 전환 때 합쳐야 한다.

### 3.3 비동기 상태: `status` 하나 + `isActive` + `key` 재마운트

```js
// hooks/useTourDetail.js (요지)
const [state, setState] = useState({ status: 'loading', detail: null })
const [attempt, setAttempt] = useState(0)

useEffect(() => {
  let isActive = true
  fetchTourDetail(contentId, contentTypeId)
    .then(detail => { if (isActive) setState({ status: 'success', detail }) })
    .catch(error => { if (!isActive) return; /* 404·400 → not-found, 그 외 → error */ })
  return () => { isActive = false }
}, [contentId, contentTypeId, attempt])

const retry = useCallback(() => {
  setState({ status: 'loading', detail: null })   // 이벤트 핸들러에서 설정
  setAttempt(value => value + 1)
}, [])
```

- **`status` 하나**: `isLoading`·`error`·`data` 세 값을 조합하면 "로딩 중이면서 오류" 같은 불가능한 조합이 생길 수 있다. `TourApiDetail`은 `status`로 네 갈래만 분기한다.
- **`isActive` 플래그**: `client.js`가 AbortSignal을 받지 않아 요청 자체는 취소하지 못한다. cleanup 이후 도착한 응답(이전 id, 이전 재시도)을 무시하는 것으로 대신했다. `client.js`는 auth-token-flow 결과물이라 이번 범위에서 수정하지 않았고, AbortSignal 지원은 후속 과제다.
- **`key={`${contentId}:${contentTypeId}`}` 재마운트** (설계 §2.3)
  - 같은 라우트에서 id만 바뀌면 React는 컴포넌트를 재사용해 state가 남는다.
  - key가 바뀌면 하위 트리 전체가 언마운트·재마운트되어 **모든 state가 초기값**(`status: 'loading'`)으로 돌아가고, 이전 effect의 cleanup이 `isActive = false`를 실행한다.
  - 대안인 "effect에서 state를 하나씩 초기화"는 누락 위험이 있고, ESLint `react-hooks` v7의 `set-state-in-effect` 규칙에도 걸린다.
  - 목업 경로도 `TravelDetailView key={id}`, `EnjoyDetailContent key={id}`, `TravelCourseDetailPage key={id}`로 같은 원칙을 쓴다. 주변·추천 카드로 이동할 때 저장·사진 위치가 남던 기존 문제(진단 2.5절)도 함께 해결됐다.
- **`retry`에서 `loading`으로 바꾸는 위치**: effect 안이 아니라 이벤트 핸들러(`retry`) 안에서 한다. effect 안에서 동기 `setState`를 하지 않기 위해서다.
- **서버 상태 라이브러리를 쓰지 않은 이유**: 계획 7.2 "기존 결정(auth-token-flow)과 일관, 의존성 추가 없음, 서버에 Caffeine 캐시 존재". 프론트 캐시도 두지 않았다. 무효화할 수 없는 모듈 전역 캐시를 늘리지 않기 위해서다(설계 §2.4).
- **StrictMode**: 개발 환경에서는 effect가 두 번 실행되어 요청이 2회 나가고, 첫 응답은 cleanup으로 무시된다(설계 §2.4). 이 동작도 `isActive`가 처리한다.
- **검증 한계**: "id를 빠르게 바꿔도 마지막 결과만 표시"는 코드 리뷰와 정적 분석 근거다. 브라우저 L3 시나리오 3(주변 카드 연속 클릭)은 미측정이다.

### 3.4 fail-closed와 프론트·백엔드 오류 계약

| 서버 응답 | 프론트 상태 | 화면 |
|-----------|-------------|------|
| 200 + 올바른 형식 | `success` | View |
| 200인데 `title`이 없거나 공백 (`{}` 포함) | `error` | 오류 카드 + 다시 시도 |
| 404 `TOUR_CONTENT_NOT_FOUND` | `not-found` | "콘텐츠를 찾을 수 없습니다" |
| 400 | `not-found` + `console.warn` | 같음 |
| 502 / 500 / 네트워크 오류 | `error` + `console.error` | 오류 카드 |

- **fail-closed** (설계 §1.2): `client.js`는 JSON이 아닌 200 응답을 `{}`로 돌려준다. `toTourDetail`은 `title`이 문자열이 아니거나 공백이면 `Error`를 던진다. 형식이 다른 응답을 성공으로 보면 빈 상세 화면이 뜬다.
- **not-found 판정은 백엔드 404로** (대안: 프론트가 502 + `code`를 해석): 기존 502는 외부 장애에도 쓰여 프론트 해석으로는 "없음"과 "장애"를 구분할 수 없었다(계획 7.2).
  - `TourApiClientImpl.extractDetailCommon`: `resultCode == "0000"`인데 items가 비면 `TourContentNotFoundException`. null 응답·header 없음·`resultCode` ≠ `0000`은 기존대로 502.
  - `TourDetailService`: 구현체가 null을 돌려도 NPE(500) 대신 404.
- **프론트는 상태 코드만 본다**: `isNotFoundError`는 `ApiError`의 `status`가 404 또는 400인지만 확인하고, `code` 문자열은 로그 확인용이다. 그래서 백엔드 구현 세부가 바뀌어도 상태 코드만 지키면 프론트는 영향을 받지 않는다(설계 §12.2). 프론트와 백엔드를 병렬로 구현할 수 있었던 이유이기도 하다.
- **400을 not-found로 보면서 경고를 남긴 이유** (SI-3): 사용자에게는 "주소가 잘못됨"과 같은 상황이지만, 해석 함수를 통과한 요청을 서버가 거절했다는 뜻이므로 파라미터 계약이 어긋났을 가능성이 있다. 화면은 not-found, 개발자에게는 `console.warn`.
- **안전한 저하**: 실제 TourAPI의 "없는 id" 응답이 전제와 다르면 404가 아니라 502 → 오류 카드가 된다. 다른 장소를 보여 주지는 않는다(G-02).
- **L1 측정** (`local-mock`): #2 없는 id → 404 + `code`·`message`·`timestamp`, #3·#4 → 400. 단, #3의 400 본문은 `{"message": ...}`로 `code`가 없다(다른 `IllegalArgumentException` 핸들러가 처리). 프론트는 status만 보므로 영향이 없고, 오류 본문 형식 3종 정리는 후속-2로 남겼다.

### 3.5 TourAPI HTML을 텍스트로만 렌더링 (`DOMParser`, `dangerouslySetInnerHTML` 미사용)

- **문제**: `overview`·`detailInfos`에 `<br>`, `&nbsp;` 같은 HTML이 섞여 온다(계획 5장 위험).
- **대안**: `dangerouslySetInnerHTML`로 그대로 넣기 — 외부 API 문자열을 HTML로 해석하게 되므로 쓰지 않았다(설계 §7 보안).
- **구현** (`toPlainText`, `tourApi.js`)
  1. `<br>`(+ 바로 뒤 원문 개행)을 `\n`으로. `<br>\n`이 줄바꿈 두 번이 되지 않게 개행까지 함께 치환한다(N-5).
  2. `new DOMParser().parseFromString(text, 'text/html').body.textContent`로 나머지 태그 제거와 엔티티 복원. `DOMParser`로 만든 문서는 스크립트를 실행하지 않고 이미지도 불러오지 않는다(코드 주석).
  3. `U+00A0` → 일반 공백, 줄 끝 공백 제거, 개행 3개 이상 → 2개, trim.
  4. 화면은 `white-space: pre-line`으로 줄바꿈을 표시한다.
- **알려진 한계** (G-08, 확신도 낮음): 원문이 `&lt;br&gt;`처럼 이중 인코딩되어 오면 `DOMParser`가 리터럴 `<br>` 문자열로 복원해 화면에 보일 수 있다. 실제 데이터에 이런 인코딩이 있는지는 실제 키가 없어 확인하지 못했다.
- **목 데이터의 한계**: `local-mock`의 overview는 `<br>`·`&nbsp;`를 섞어 개발자가 만든 것이다. 실제 응답 패턴을 캡처한 것이 아니다(보고서 7.3).

### 3.6 상태 화면 UX와 접근성

| 상태 | 화면 | 접근성 |
|------|------|--------|
| loading | "상세 정보를 불러오는 중입니다." 카드 하나. 스피너 없음. `status-page`(min-height)를 재사용해 로딩 → 결과 전환 때 푸터가 튀어 오르지 않게 함 | `role="status"` |
| error | "상세 정보를 불러오지 못했습니다" + [다시 시도] `<button>` + [목록으로] `Link`. 서버 `message`는 노출하지 않음 | `role="alert"`, `aria-labelledby` |
| not-found | `NotFoundPage` + 상세 전용 문구 | 기존 구조 |

- **재시도 실패 시에만 포커스 이동** (SI-2): "다시 시도"를 누르면 버튼이 로딩 카드로 바뀌며 사라져 포커스가 `body`로 떨어진다. 재시도가 또 실패하면 `hasRetried`가 참일 때만 오류 카드 제목(`tabIndex={-1}`)으로 포커스를 옮긴다. 첫 진입 실패에는 옮기지 않는다. 사용자가 누른 것이 없으니 `role="alert"`로 충분하고, 페이지 로드 직후 포커스를 강제로 옮기면 스크린 리더가 문서를 처음부터 읽는 흐름을 끊기 때문이다(`DetailStatus.jsx` 주석). 윤곽선은 `:focus-visible`일 때만.
- **이미지 로드 실패** (SI-4): DOM의 `src`를 직접 바꾸지 않고 `isImageBroken` state로 기본 이미지를 고른다. 기본 이미지까지 실패해도 `true → true`라 재렌더링·재요청이 반복되지 않는다(무한 `onError` 방지). View가 콘텐츠마다 key로 재마운트되므로 이전 콘텐츠의 실패 상태도 남지 않는다.
- **API 콘텐츠 레이아웃**: 대표 이미지 1장뿐이라 같은 사진을 반복하던 5칸 갤러리 대신 `detail-gallery--single`(1열, 450px, 모바일 250px). `dd`가 `nowrap`이라 긴 API 값이 넘치는 상단 요약 facts는 숨기고, 이용 안내는 위쪽 정렬 + `overflow-wrap: anywhere`로 360px 가로 스크롤을 막도록 했다(C-4).
- **검증 한계**: 로딩 카드는 `role="status"` 영역을 내용과 함께 한 번에 마운트한다. 일부 스크린 리더는 이미 채워진 live region을 읽지 않는다(G-05). 스크린 리더·360px 확인 모두 L2 미측정이다.

### 3.7 홈 진입점: 경로 규칙 하나(`getTourDetailPath`)

| contentTypeId | 경로 |
|---|---|
| 12, 14 | `/destinations/detail/{id}?type={12\|14}` |
| 15, 28, 39, 38, 32 | `/enjoy/{festivals\|leports\|food\|shopping\|stay}/{id}` |
| 그 외, id 형식 불일치 | `null` → 호출하는 쪽이 목록 등 대체 경로 선택 |

- 홈 세 섹션이 모두 이 함수 하나로 경로를 만든다. 추천 여행지는 목록 → 상세 연결(D-3), 여행을 더 즐겁게는 유형별 경로, 이번 주 여행 소식은 `<a>` → `Link`.
- `<a>` → `Link` 전환의 효과: 전체 새로고침이 없어져 홈 API와 세션 복원(`/auth/refresh`)을 다시 요청하지 않는다(코드 주석). 이 "재요청 없음"은 네트워크 탭 L2(9.2 #5)로 확인할 계획이었고 **아직 측정하지 않았다.**
- 축제 응답(`TourFestivalResponse`)에는 `contentTypeId`가 없어 15로 고정했다.
- 12·14를 여행지 상세로 보내는 규칙은 `local-mock` 때문에도 필요했다. `local-mock` 목록은 요청 유형과 관계없이 `contenttypeid "12"`를 돌려준다(후속-3).

### 3.8 `ScrollToTop` 설계

- 트러블슈팅 4.2 참고. 결정 요지만 적는다.
- `useLayoutEffect`: 새 화면을 그리기 전에 스크롤해 이전 위치가 한 프레임 보였다 튀는 현상을 막는다.
- **pathname만 비교**: 쿼리만 바뀌는 이동(검색 조건, `?type=`)은 위치를 유지한다. 직전 pathname을 ref에 두고 비교해 `navigationType`만 바뀐 경우도 걸러 낸다.
- **POP 제외**: 뒤로·앞으로 가기와 첫 로드는 브라우저 스크롤 복원을 따른다.
- **위치**: `BrowserRouter` 바로 아래. 홈(`/`)과 로그인 화면은 `Layout` 밖 라우트라, `Layout`에 두면 상세 → 홈 이동이 초기화되지 않는다.

---

## 4. 트러블슈팅 스토리

### 4.1 없는 id가 조용히 첫 번째 목업으로 대체되던 문제

#### Problem
`/destinations/detail/no-such-place`처럼 없는 id로 들어가도 오류 없이 비자림 상세가 보였다. 더 큰 문제는 홈 "여행을 더 즐겁게"·"이번 주 여행 소식" 카드였다. **어느 카드를 눌러도** 비자림 또는 부산 바다축제 상세가 보였다. 사용자는 잘못된 화면이라는 것을 알 수 없다.

#### Cause
- 조회 코드가 `find(...) || allDestinationMocks[0]`, `findEnjoyItem(...) || config.items[0]`였다. 찾지 못하면 첫 항목으로 대체했다.
- 홈 카드는 TourAPI contentId(숫자)를 넘기고, 상세는 목업(slug)에서만 찾았다. 두 id 체계가 겹치지 않으니 홈에서 온 요청은 **항상** 대체 경로를 탔다.
- app-safety-net 작업 때 `EnjoyDetailPage`에 "있는 카테고리의 없는 항목 id fallback(`config.items[0]`)은 MF-4 범위라 이번에는 바꾸지 않습니다"라는 주석을 남겨 두었다(`git diff` 삭제 줄). 알고 있던 문제를 이번 기능으로 넘긴 것이다.

#### Investigation
- 출발점은 진단 문서(`docs/development/waylog-renewal.md` 2.3절, Must Fix 4)의 "잘못된 fallback"이었다.
- 계획 단계에서 상세로 들어오는 **진입점 13곳을 표로 정리**했다(계획 1.2). 각 진입점이 넘기는 id가 slug인지 contentId인지, 목업에 있는지를 하나씩 확인했다.
- 결론: 목록·검색·상세 내부 링크는 slug라 정상이고, **홈에서 상세로 가는 경로는 모두 목업에 없는 id**였다. 기본·`local-mock` 두 프로필 모두 숫자 id였다.
- 그래서 fallback을 404로만 바꾸면 홈 상세 링크 두 섹션이 전부 404가 된다는 점을 계획 단계에서 미리 알 수 있었다.

#### Solution
- 3.1 방향 결정(C안)과 3.2 해석 함수. 해석 결과가 `not-found`면 API를 호출하지 않고 상세 전용 문구의 `NotFoundPage`를 보여 준다.
- 숫자 id는 실제 상세 API로 조회하고, 홈 카드는 `getTourDetailPath`로 유형에 맞는 경로로 보낸다.
- 백엔드는 없는 contentId를 404로, `local-mock` 프로필에서는 목 홈 id 3개(`126508` 경복궁, `126485` 비자림, `125476` 경포해변)의 상세를 돌려주도록 바꿨다(FR-12).

#### Result
- 정적 기준 FR-01 ~ FR-12 충족. 잘못된 slug는 해석 함수에서 `TourApiDetail`을 렌더링하지 않으므로 API 호출 0(SC-3, 보고서는 "SSR 스크립트로 not-found 확인"이라고 기록).
- L1 #1: `126508` → 200 "경복궁", `local-mock` 목록과 상세가 같은 id·제목을 쓴다. "홈 카드 제목 = 상세 제목"(SC-2)은 이 정적·L1 근거로 충족 판정했고, **브라우저에서 카드를 눌러 확인하는 L2는 미측정**이다.
- 실제 TourAPI에서 없는 id가 404로 오는지는 미검증(SC-4 부분 충족).

#### Learning
- "없는 id → 404"라는 과제 문장만 보고 고쳤다면 홈 흐름을 막는 수정이 됐을 것이다. **진입점을 전부 나열하고 각 진입점이 넘기는 데이터를 확인하는 것**이 범위를 정하는 데 결정적이었다.
- `|| items[0]` 같은 조용한 대체는 크래시를 막는 대신 잘못된 데이터를 보여 준다. 사용자 입장에서는 크래시보다 알아차리기 어렵다.

### 4.2 홈 카드를 `Link`로 바꾸자 상세가 페이지 중간에서 열리던 회귀 (MF-2)

#### Problem
홈 "이번 주 여행 소식"·"추천 여행지" 카드를 `<a>`에서 `Link`로 바꾸자, 홈을 아래로 스크롤해 카드를 누르면 상세 화면이 맨 위가 아니라 **홈에서 보던 스크롤 위치**에서 열리게 됐다. 1차 코드 리뷰에서 Must Fix(MF-2)로 분류됐다.

#### Cause
- `<a href>`는 문서를 새로 불러오므로 브라우저가 스크롤을 맨 위로 둔다.
- `Link`는 SPA 안에서 화면만 바꾼다. 문서가 그대로라 `window`의 스크롤 위치도 그대로 남는다.
- 앱에는 라우트 이동 시 스크롤을 초기화하는 장치가 없었다. v0.2 설계에서 "페이지 이동 시 스크롤 맨 위로"는 후속 과제(계획 2.2 제외)로 분류돼 있었다.

#### Investigation
- 브라우저에서 먼저 발견한 것이 아니라 **1차 코드 리뷰(frontend-code-reviewer)** 가 `<a>` → `Link` 변경의 부수 효과로 지적했다.
- 설계 v0.3에서 "이번 변경이 만든 회귀이므로 이번 범위로 옮긴다"고 판단했다(§5.4). 계획 문서의 "제외" 항목에 이 내용이 남아 있던 것은 2차 gap 분석이 잡았다(G-10). 계획 v0.3에서 포함 항목으로 옮겼다.

#### Solution
```js
// components/common/ScrollToTop.jsx
const { pathname } = useLocation()
const navigationType = useNavigationType()
const previousPathnameRef = useRef(pathname)

useLayoutEffect(() => {
  if (previousPathnameRef.current === pathname) return
  previousPathnameRef.current = pathname
  if (navigationType !== 'POP') window.scrollTo(0, 0)
}, [pathname, navigationType])
```
- `App.jsx`의 `BrowserRouter` 바로 아래에 둬 Layout 밖 홈·로그인 라우트도 포함한다.
- **POP 제외**: 뒤로 가기로 홈에 돌아왔을 때는 브라우저의 스크롤 복원을 덮어쓰지 않아 보던 위치를 잃지 않게 한다.
- **pathname을 ref로 비교**: 의존성에 `navigationType`이 있어서, POP 뒤 같은 화면에서 쿼리만 PUSH하면 `navigationType`만 바뀌어 effect가 다시 실행된다. 직전 pathname과 같으면 바로 반환해 이 경우 초기화되지 않게 했다.

#### Result
- 2차 gap 분석에서 §5.4 항목(`useLayoutEffect`, ref 비교, POP 제외, 첫 로드 제외, 위치) 일치.
- **브라우저 확인(L2 11.8 #2: 카드 클릭 → 맨 위, 뒤로 → 이전 위치 복원)은 미측정이다.**
- 알려진 한계(후속-5): POP 복원은 브라우저 기본 동작에 맡기므로, 데이터를 비동기로 불러와 높이가 늦게 생기는 화면에서는 복원이 정확하지 않을 수 있다. 보고서는 이를 "POP 스크롤 복원의 한계, 브라우저 API 한계"로만 기록했고 재현 기록은 없다.

#### Learning
- `<a>` → `Link`는 "새로고침을 없앤다"는 이점만 보기 쉽다. 새로고침이 해 주던 일(스크롤 초기화, 상태 초기화)이 같이 사라진다는 점을 함께 봐야 한다.
- 내가 만든 변경이 만든 회귀는 "후속 과제"로 미루지 않고 이번 범위로 가져온다는 기준을 문서에 남겼다.

### 4.3 전화 링크가 번호를 이어 붙이던 버그: 1차 수정 후 공백·괄호 때문에 재발 (MF-1 → MF-A)

#### Problem
API 문의처(`detailInfos`의 "문의 및 안내")로 `tel:` 링크를 만드는데, 문자열에 번호가 여러 개이거나 설명 숫자가 붙어 있으면 **존재하지 않는 번호**로 전화 링크가 만들어졌다. 1차 리뷰 MF-1로 고쳤는데, 2차 리뷰에서 같은 계열의 결함이 다시 발견됐다(MF-A).

#### Cause
| 버전 | 방식 | 결함 예 |
|------|------|---------|
| v0.2 | `contact.replace(/[^\d+]/g, '')` — 숫자를 모두 이어 붙임 | `"02-3700-3900~1"` → `tel:02370039001` |
| v0.3 (1차 수정) | "숫자로 시작·끝나고 사이에 하이픈·점·괄호·**공백**이 있는 구간"을 후보로 | 공백과 `(`를 번호 안쪽 문자로 허용해 설명 숫자까지 합침. `"02-123-4567 (2)"` → `tel:0212345672`, `"1330 1588-1234"` → `tel:133015881234` |

1차 수정은 "번호 구간을 찾는다"는 방향은 맞았지만, 구간을 너무 넓게 정의해서 v0.2와 같은 결과(이어 붙인 번호)가 다른 입력에서 다시 나왔다.

#### Investigation
- 두 번 모두 브라우저가 아니라 **코드 리뷰**가 찾았다. 실제 TourAPI 키가 없어서 실제 문의처 데이터로 확인할 수 없었다.
- 2차 리뷰가 뒤쪽 괄호 숫자·공백으로 이어진 번호 같은 반례를 제시했다. v0.3의 문제는 "허용 문자 집합"이 아니라 **"무엇을 번호로 인정하느냐"는 정의 자체**라고 판단해 후보를 좁히는 방향으로 바꿨다.

#### Solution (v0.3.1)
- **후보를 한국 전화번호 형태로 좁힘**: 0으로 시작하는 지역번호·휴대폰·050x, `+82` 국제 형식, 15xx ~ 19xx 대표번호. 구분자는 하이픈·점만, 공백은 지역번호(또는 `+82`) 바로 뒤에서만(`"(064) 710-7912"`).
- `(?<!\d)`·`(?!\d)`: 앞뒤에 숫자가 붙어 있으면 긴 숫자열의 일부만 잡은 것이라 매치하지 않는다.
- **판정 순서**: (1) 번호가 정확히 1개가 아니면 `null` → (2) 번호 밖에 4자리 이상 숫자가 남으면 `null`(인식하지 못한 다른 번호일 수 있음. 시각 `09:00`, 내선 `23`은 2자리라 통과) → (3) 앞뒤에 `~`가 있으면 범위 번호로 보고 `null`(공백 허용) → (4) 7 ~ 12자리가 아니면 `null`.
- `null`이면 링크 없이 텍스트로만 표시하고, 여행지 화면 라벨은 "문의 전화" 대신 "문의"로 바꾼다.
- **원칙**: "잘못된 번호로 전화가 걸리는 것보다 링크가 없는 편이 안전하다"(설계 §3.2). 확신할 수 없으면 모두 텍스트.

| 입력 | 결과 |
|------|------|
| `"02-123-4567 (2)"`, `"02-123-4567(내선 23)"`, `"09:00~18:00 02-123-4567"` | `tel:021234567` |
| `"(064) 710-7912"`, `"평일 09:00~18:00 / 064-710-7912"` | `tel:0647107912` |
| `"+82-2-1234-5678"` | `tel:+82212345678` |
| `"02-3700-3900~1"`, `"02-123-4567, 02-123-4568"`, `"1330 1588-1234"` | `null` |
| `"02-120"`, `"1330"` | `null` (짧은 대표번호, 보류) |

#### Result
- 재리뷰 대신 **27개 입력 회귀 케이스**로 확인했고 FAIL 0이었다(보고서 SC-9). 설계 §3.2 입력 표의 예시는 2차 gap 분석에서 정규식을 하나씩 따라가 모두 기대값임을 확인했다(분석 11.2).
- **남은 한계**: 27개 케이스는 저장소에 자동 테스트로 남아 있지 않다. 보고서도 "로직이 v0.2 → v0.3 → v0.3.1로 3번 바뀌며 복잡해졌고, 추가 입력까지 완전히 커버하기는 어렵다"고 적었다. `1330`, `02-120` 같은 짧은 대표번호는 링크를 만들지 않는다. allowlist 도입은 사용자 결정 전까지 보류했다.

#### Learning
- 1차 수정이 "증상이 난 입력"만 고치고 규칙의 정의를 그대로 두면, 다른 입력에서 같은 결함이 다시 나온다. 두 번째 수정에서는 **허용 형태를 좁히고, 확신할 수 없으면 기능을 끄는** 쪽으로 방향을 바꿨다.
- 문자열 규칙은 입력 예시 표를 먼저 만들고 그 표를 회귀 케이스로 계속 돌리는 것이 효과적이었다. 다음에는 이 케이스를 테스트 파일로 남기겠다(테스트 러너 도입은 새 의존성이라 사용자 확인 필요).

### 4.4 요청 유형과 실제 유형이 달라도 200이 오던 문제 (SI-1 → G-09)

#### Problem
관광지(12) contentId를 문화시설(14)로 요청해도(`/destinations/detail/126508?type=14`) 상세가 성공으로 표시됐다. 화면에는 **틀린 유형 태그와 빈 이용 안내**가 나온다.

#### Cause
TourAPI `detailCommon2`는 contentId만으로 조회하므로 다른 유형으로 요청해도 콘텐츠를 돌려준다. 백엔드는 요청 유형을 기준으로 응답을 만들었다(설계 §4.2, `TourDetailService` 주석).

#### Investigation
- 1차 코드 리뷰의 Should Improve(SI-1)로 제기됐고, Act-1에서 백엔드(`TourDetailService`, `MockTourApiClient`)에 반영했다.
- 2차 gap 분석은 이 동작이 설계 v0.3에 없다는 문서 gap(G-09, Important)으로 잡았다. 코드 변경이 아니라 설계를 코드에 맞추는 일이었다.

#### Solution
```java
// TourDetailService.getDetail — null 검사 직후, detailIntro2 호출 전
validateActualContentType(contentId, contentTypeId, common.contenttypeid());

private void validateActualContentType(String contentId, Integer requested, Integer actual) {
    if (actual != null && !actual.equals(requested)) {
        throw new TourContentNotFoundException(contentId);
    }
}
```
- 실제 유형이 null이면 판단할 수 없으므로 통과.
- `detailIntro2` 호출 **전에** 검사해, 유형이 틀린 요청의 외부 API 호출을 1회로 줄인다.
- 예외는 `@Cacheable`에 저장되지 않아 잘못된 유형 요청이 캐시에 남지 않고, 올바른 유형의 캐시 항목(`detail:{id}:{type}`)에도 영향이 없다.
- **프론트 변경은 없었다.** 404 → not-found라는 기존 계약 그대로 동작한다. 상태 코드 계약만 두고 `code` 문자열에 의존하지 않은 설계(3.4)의 이점이 여기서 드러났다.
- `local-mock`도 맞췄다: 12·14 요청은 저장된 유형 12를 돌려줘 실제 TourAPI처럼 404가 되고, 즐기기 유형 요청은 요청값을 돌려준다(목에 즐기기 데이터가 없어 3건을 재사용하기 위한 목 전용 동작).

#### Result
- L1 #8: `126508?contentTypeId=14` → 404 `TOUR_CONTENT_NOT_FOUND`, 연속 요청해도 404(예외 미캐시), 이어서 `contentTypeId=12`는 200. L1 #9: 목 즐기기 경로 3개 200.
- 부수 결과(설계 §2.2 D-4): 실제 TourAPI에서 문화시설 id를 `?type=` 없이 열면 기본값 12로 요청돼 not-found가 된다. 앱 안 링크는 항상 `?type=`을 붙이므로 사용자가 주소를 직접 고친 경우뿐이다. 틀린 태그를 보여 주지 않는 쪽을 택했다.
- **실제 TourAPI에서 `contenttypeid`로 이 검증이 동작하는지(L1 #10)는 미측정이다.**

#### Learning
- 외부 API가 "요청 파라미터를 검증해 줄 것"이라고 가정하면 안 된다. 요청과 응답의 불변식(요청 유형 = 실제 유형)을 우리 서버가 확인해야 한다.
- 프론트와 백엔드의 계약을 상태 코드 수준으로 단순하게 유지하면, 한쪽에 새 판정 규칙이 생겨도 다른 쪽을 고치지 않아도 된다.

---

## 5. 면접 Q&A

### Q1. 목업과 실제 API 데이터가 섞여 있는데 어떻게 구조를 잡았나요?

**30초 답변**
상세 라우트가 id를 한 번 해석해서 "목업 / API 조회 / not-found" 셋 중 하나로 나누고, 그 아래 화면 컴포넌트는 출처를 모르는 공통 view model만 받게 했습니다. 목록 페이지가 API로 바뀌면 해석 함수의 목업 분기만 지우면 됩니다.

**1분 답변**
홈은 실제 TourAPI의 숫자 contentId를, 목록과 검색은 목업 slug를 쓰고 있었습니다. 상세를 API 전용으로 바꾸면 목록 → 상세가 깨지고, 404만 적용하면 홈 → 상세가 전부 404가 됩니다. 그래서 `resolveDestinationDetail`이라는 순수 함수가 목업에 있으면 mock, 숫자 형식이고 유형이 정해지면 api, 그 외는 not-found를 반환하게 했습니다. URL에서 계산되는 값이라 state에 두지 않고 렌더 중에 계산합니다. API 경로는 공통 `TourApiDetail`이 로딩·오류·없음을 처리하고, 성공하면 `renderDetail`로 목업과 같은 View를 그립니다. View는 `source`가 mock일 때만 목업용 하드코딩 전화번호나 주변 목업을 보여 줍니다. API 콘텐츠에 가짜 정보를 붙이지 않기 위해서입니다.

**예상 꼬리 질문**
- *목업 하드코딩도 view model로 일반화하지 않은 이유는요?* → 목업은 목록 API 전환 때 사라질 코드라, 사라질 코드를 추상화하지 않고 `source` 분기로 남겼습니다.
- *이 구조의 단점은요?* → 즐기기 카테고리 기준이 설정 객체 세 곳에 나뉘어 있습니다. 지금은 키가 일치하지만 목록 전환 때 하나로 합쳐야 합니다.
- *`?type=`은 어떻게 검증하나요?* → 처음엔 `Number()`로 바꿨는데 `'0xc'`, `'12.0'`도 12가 되어 한 콘텐츠에 URL이 여러 개 생긴다는 지적을 받았습니다. 지금은 문자열 `'12'`, `'14'`만 허용합니다.

### Q2. 로딩과 에러 상태는 어떻게 관리했나요?

**30초 답변**
`isLoading`, `error`, `data`를 따로 두지 않고 `status` 하나에 `loading`, `success`, `not-found`, `error` 네 값만 두었습니다. 불가능한 조합이 생기지 않고, 컴포넌트는 `status`로 네 갈래만 분기합니다.

**1분 답변**
`useTourDetail` 훅이 상태를 갖고 `TourApiDetail`이 분기합니다. 404와 400은 not-found, 502·500·네트워크 오류는 error로 나눠서 not-found는 "콘텐츠를 찾을 수 없습니다", error는 다시 시도 버튼이 있는 카드를 보여 줍니다. 서버 message는 사용자에게 보이지 않습니다. 재시도는 `attempt` state를 올려 effect를 다시 실행하고, 로딩 상태로 바꾸는 것은 effect가 아니라 `retry` 이벤트 핸들러 안에서 합니다. 접근성 쪽으로는 로딩에 `role="status"`, 오류에 `role="alert"`을 두었고, 사용자가 "다시 시도"를 눌렀는데 또 실패했을 때만 오류 제목으로 포커스를 옮깁니다. 버튼이 로딩 카드로 바뀌며 사라져 포커스가 body로 떨어지기 때문입니다.

**예상 꼬리 질문**
- *왜 TanStack Query를 쓰지 않았나요?* → 이전 기능에서 커스텀 훅으로 가기로 한 결정과 맞추고, 의존성을 늘리지 않기 위해서였습니다. 서버에 Caffeine 캐시도 있습니다. 목록까지 API로 바뀌어 캐시·중복 요청 관리가 늘어나면 다시 검토할 대상입니다.
- *첫 실패에는 왜 포커스를 옮기지 않나요?* → 사용자가 누른 게 없으니 `role="alert"` 공지로 충분하고, 로드 직후 포커스를 옮기면 스크린 리더가 처음부터 읽는 흐름을 끊습니다.
- *스크린 리더로 확인했나요?* → 아직 못 했습니다. 로딩 카드는 live region을 내용과 함께 마운트해서 일부 스크린 리더가 읽지 않을 수 있다는 지적(G-05)도 남아 있습니다.

### Q3. id가 바뀔 때 이전 응답이 새 화면을 덮어쓰는 문제는 어떻게 막았나요?

**30초 답변**
두 장치를 같이 썼습니다. `TourApiDetail`에 `contentId:contentTypeId` key를 줘서 id가 바뀌면 하위 트리를 재마운트하고, effect cleanup에서 `isActive = false`로 바꿔 그 뒤에 도착한 응답은 무시합니다.

**1분 답변**
같은 라우트에서 id만 바뀌면 React는 컴포넌트를 재사용해서 이전 state가 남습니다. 실제로 주변 카드를 누르면 저장 버튼과 사진 위치가 남는 기존 문제가 있었습니다. effect에서 state를 하나씩 초기화하면 빠뜨릴 수 있고 ESLint `set-state-in-effect` 규칙에도 걸려서, key로 재마운트해 모든 state를 한 번에 초기값으로 돌렸습니다. API 요청은 `client.js`가 AbortSignal을 받지 않아 취소할 수 없어서, cleanup에서 플래그를 꺼 늦은 응답을 버리는 방식으로 막았습니다. 재시도 중 이전 요청이 늦게 끝나는 경우도 effect 재실행 전 cleanup이 같은 방식으로 막습니다.

**예상 꼬리 질문**
- *요청을 실제로 취소하지 않으면 낭비 아닌가요?* → 맞습니다. 응답을 무시할 뿐 요청은 끝까지 갑니다. `client.js`는 이전 기능의 결과물이라 이번 범위에서 수정하지 않았고, AbortSignal 지원은 후속 과제입니다.
- *StrictMode에서는요?* → 개발 환경에서 effect가 두 번 실행돼 요청이 두 번 나가지만 첫 응답은 cleanup으로 무시됩니다.
- *실제로 빠르게 클릭해서 확인했나요?* → 브라우저 시나리오는 아직 측정하지 않았고, 코드 리뷰와 정적 분석이 근거입니다.

### Q4. 서버 응답은 어떻게 신뢰했나요? 200이면 성공인가요?

**30초 답변**
아닙니다. fetch 래퍼가 JSON이 아닌 200 응답을 빈 객체로 돌려주기 때문에, 제목이 없거나 공백인 응답은 성공이 아니라 오류로 처리합니다. 형식이 틀린 응답을 성공으로 보면 빈 상세 화면이 뜹니다.

**1분 답변**
`toTourDetail`이 응답을 view model로 바꾸면서 `title`이 문자열이 아니거나 공백이면 Error를 던집니다. 그러면 훅은 error 상태가 되고 사용자는 다시 시도할 수 있습니다. 상태 코드 계약도 백엔드와 정리했습니다. 원래는 없는 콘텐츠도 외부 장애도 502라 프론트가 구분할 수 없었는데, 백엔드가 TourAPI 결과가 정상인데 항목이 비어 있으면 404를 주도록 바꿨습니다. 프론트는 오류 `code` 문자열을 보지 않고 상태 코드만 봅니다. 그래서 나중에 백엔드가 "요청 유형과 실제 유형이 다르면 404" 규칙을 추가했을 때도 프론트는 고칠 게 없었습니다.

**예상 꼬리 질문**
- *400은 왜 not-found로 보나요?* → 400도 URL에서 만든 잘못된 요청이라 사용자에게는 같은 안내가 맞습니다. 다만 해석 함수를 통과한 요청을 서버가 거절한 것이니 파라미터 계약이 어긋났을 수 있어 `console.warn`을 남깁니다.
- *실제 TourAPI에서도 404가 오나요?* → 확인하지 못했습니다. 실제 키가 없어서 "없는 id에 빈 items를 준다"는 전제가 미검증입니다. 전제가 틀려도 502 → 오류 카드라 다른 장소를 보여 주지는 않습니다.

### Q5. 외부 API의 HTML 텍스트는 어떻게 안전하게 표시했나요?

**30초 답변**
`dangerouslySetInnerHTML`을 쓰지 않았습니다. `<br>`을 줄바꿈 문자로 바꾸고, `DOMParser`로 파싱해 `textContent`만 꺼내 태그를 지우고 엔티티를 복원한 뒤, `white-space: pre-line`으로 줄바꿈만 살렸습니다.

**1분 답변**
TourAPI overview에는 `<br>`, `&nbsp;` 같은 HTML이 섞여 옵니다. HTML로 넣으면 외부 문자열을 그대로 해석하게 되니 텍스트로만 렌더링하기로 했습니다. 정규식으로 태그를 지우면 `&amp;` 같은 엔티티 복원을 따로 해야 해서, `DOMParser`로 문서를 만들고 `textContent`만 씁니다. `DOMParser`로 만든 문서는 스크립트를 실행하지 않고 이미지도 불러오지 않습니다. 그 뒤 `&nbsp;`가 복원된 U+00A0을 일반 공백으로 바꾸고, 빈 줄은 최대 한 줄로 줄였습니다. `<br>` 뒤에 원래 개행이 있으면 줄바꿈이 두 번 생겨서 그 개행까지 함께 치환하도록 고쳤습니다.

**예상 꼬리 질문**
- *한계는요?* → 원문이 `&lt;br&gt;`처럼 이중 인코딩돼 오면 `DOMParser`가 `<br>` 글자로 복원해 화면에 보일 수 있습니다. 실제 데이터로 확인하지 못해 확신도가 낮은 항목으로 남겨 두었습니다.
- *목 데이터로는 충분히 확인됐나요?* → `local-mock` overview는 제가 `<br>`·`&nbsp;`를 넣어 만든 것이라 실제 응답 패턴과 다를 수 있습니다.

### Q6. 가장 까다로웠던 버그는 무엇이었나요?

**30초 답변**
전화 링크였습니다. 문의처 문자열에서 숫자를 모두 이어 붙여 `tel:` 링크를 만들었더니 번호가 여러 개면 없는 번호가 됐습니다. 한 번 고쳤는데 공백과 괄호를 번호 안쪽 문자로 허용해서 `"02-123-4567 (2)"`의 2까지 붙는 결함이 2차 리뷰에서 다시 나왔습니다.

**1분 답변**
처음엔 숫자와 +만 남겼고, 1차 리뷰 뒤에는 "숫자로 시작하고 끝나는 구간"을 찾는 방식으로 바꿨습니다. 그런데 그 구간 정의가 너무 넓어서 결과적으로 또 숫자를 이어 붙였습니다. 두 번째에는 허용 문자를 조정하는 대신 번호의 정의 자체를 좁혔습니다. 한국 전화번호 형태만 번호로 인정하고, 앞뒤에 숫자가 붙어 있으면 매치하지 않게 lookbehind/lookahead를 썼습니다. 그리고 번호가 정확히 하나일 때, 번호 밖에 4자리 이상 숫자가 남지 않을 때, 범위 표시 `~`가 없을 때만 링크를 만듭니다. 확신할 수 없으면 링크 없이 텍스트로 보여 줍니다. 잘못된 번호로 전화가 걸리는 것보다 링크가 없는 편이 낫다고 판단했습니다. 27개 입력 케이스로 회귀를 확인했고 실패는 0이었습니다.

**예상 꼬리 질문**
- *그 27개 케이스는 테스트 코드로 있나요?* → 아니요. 프로젝트에 테스트 러너가 없어서 저장소에 남아 있지 않습니다. 가장 먼저 테스트 파일로 옮기고 싶은 부분입니다. 러너 도입은 새 의존성이라 따로 결정이 필요합니다.
- *1330 같은 번호는요?* → 지금 규칙에서는 링크가 안 됩니다. 짧은 대표번호 allowlist는 사용자 결정 전까지 보류했습니다.
- *어떻게 찾았나요?* → 두 번 모두 코드 리뷰가 찾았습니다. 실제 키가 없어 실제 문의처 데이터를 볼 수 없었던 것도 원인입니다.

### Q7. `<a>`를 `Link`로 바꾼 뒤 생긴 문제는 없었나요?

**30초 답변**
있었습니다. 전체 새로고침이 없어지면서 홈에서 스크롤한 위치 그대로 상세가 열렸습니다. `ScrollToTop`을 `BrowserRouter` 바로 아래에 두고, pathname이 바뀌면 `useLayoutEffect`에서 맨 위로 올리되 뒤로 가기(POP)는 제외했습니다.

**1분 답변**
홈 소식 카드가 `<a>`라서 홈 API와 세션 복원을 다시 요청하길래 `Link`로 바꿨는데, 코드 리뷰에서 스크롤 회귀를 지적받았습니다. 원래 후속 과제로 분류했던 스크롤 초기화였지만, 제 변경이 만든 회귀라 이번 범위로 가져왔습니다. `useLayoutEffect`를 쓴 이유는 그리기 전에 스크롤해 이전 위치가 한 프레임 보이지 않게 하려는 것이고, pathname만 비교해서 검색 조건처럼 쿼리만 바뀌는 이동은 위치를 유지합니다. POP은 브라우저 복원을 덮어쓰면 목록으로 돌아왔을 때 보던 위치를 잃어서 제외했습니다. 홈과 로그인은 Layout 밖 라우트라 Layout이 아니라 라우터 바로 아래에 두었습니다.

**예상 꼬리 질문**
- *`navigationType`도 의존성에 있는데 ref는 왜 필요한가요?* → POP 뒤 같은 화면에서 쿼리만 PUSH하면 `navigationType`만 바뀌어 effect가 다시 돕니다. 직전 pathname과 같으면 바로 반환해 이 경우를 거릅니다.
- *브라우저에서 확인했나요?* → 아직입니다. L2 체크리스트에 "카드 클릭 → 맨 위, 뒤로 → 이전 위치"가 있지만 측정하지 않았습니다.

### Q8. 서비스가 커지면 무엇을 바꾸겠나요? 다시 한다면요?

**30초 답변**
목록이 API로 바뀌면 해석 함수의 목업 분기와 View의 목업 섹션을 지우고, 즐기기 카테고리 기준 세 곳을 합치겠습니다. 요청 취소(AbortSignal)와 서버 상태 라이브러리도 그때 다시 검토합니다. 다시 한다면 전화번호 규칙 같은 순수 함수는 처음부터 테스트 파일로 남기겠습니다.

**1분 답변**
이번 작업은 정적 검증은 끝났지만 런타임 근거가 약합니다. 브라우저 L2 체크리스트를 하나도 측정하지 못했고, 실제 TourAPI 키가 없어 "없는 id → 404" 전제와 실제 overview 인코딩을 확인하지 못했습니다. 다음에는 L2 체크리스트를 Playwright 같은 도구로 자동화하고, `local-mock` 데이터를 실제 응답을 캡처해 만들겠습니다. 지금 목 데이터는 제가 추측으로 만든 것이라 개발 환경 확인의 정확도에 한계가 있습니다. 또 `toTelHref`가 세 번 바뀌면서 복잡해졌는데, 입력 예시 표를 처음부터 테스트로 두었다면 1차 수정 때 재발을 잡았을 것입니다. 백엔드 쪽에는 좌표가 뒤바뀌어 들어가는 문제(`mapx`가 latitude)와 400 오류 본문 형식이 세 가지인 문제가 남아 있어서, 지도 연동 전에 먼저 정리해야 합니다.

**예상 꼬리 질문**
- *Match Rate 97.6%면 거의 완성 아닌가요?* → 설계 대비 정적 일치율이라 런타임 동작을 보장하지 않습니다. 미측정 항목은 점수에서 뺐기 때문에, 그 숫자만으로 "잘 동작한다"고 말하지 않습니다.

---

## 6. README용 요약

```md
### 여행지·즐기기 상세 페이지 (tour-detail-integration)

- 상세 라우트가 id를 한 곳에서 해석합니다: 목업 id → 목업 화면, TourAPI contentId(숫자) → 상세 API 조회,
  그 외 → "콘텐츠를 찾을 수 없습니다". 없는 id를 다른 콘텐츠로 대체하지 않습니다.
- 화면 컴포넌트는 출처를 모르는 공통 view model만 받습니다. 목록 페이지가 API로 전환되면 해석 함수의 목업 분기만 삭제합니다.
- API 조회는 `useTourDetail` 훅의 `status`(`loading`·`success`·`not-found`·`error`) 하나로 표현하고,
  `key` 재마운트와 cleanup 플래그로 이전 상태·늦은 응답이 새 화면에 섞이지 않게 합니다.
- 백엔드와 상태 코드로 계약합니다: 없는 콘텐츠·유형 불일치 404, 잘못된 요청 400 → not-found / 외부 장애 502 → 다시 시도.
  200이어도 형식이 다른 응답은 오류로 처리합니다(fail-closed).
- TourAPI의 HTML 텍스트는 `DOMParser`로 텍스트만 추출해 표시합니다(`dangerouslySetInnerHTML` 미사용).
- 문의처는 한국 전화번호 하나로 확정될 때만 `tel:` 링크를 만들고, 그 외에는 텍스트로 표시합니다.
- 홈 카드는 `getTourDetailPath`로 콘텐츠 유형에 맞는 상세 경로로 이동하고, 라우트 이동 시 스크롤은 맨 위로(뒤로 가기 제외) 초기화됩니다.
```

---

## 7. 알려진 한계와 개선 계획

| 항목 | 알고 있는 한계 | 개선 계획 |
|------|----------------|-----------|
| **F-7 브라우저 L2 전체 미측정** | 홈 카드 → 같은 제목, 스크롤 초기화·복원, 재시도 포커스, 360px 가로 스크롤, 이미지 대체, 네트워크 요청 0건 등 모두 정적 근거뿐이다. | 설계 §8.3·분석 11.8 체크리스트 실행. 장기적으로 Playwright 자동화(보고서 7.3, 새 의존성은 사용자 확인 필요). |
| **G-02 실제 TourAPI 키 미설정** | "없는 id → `0000` + 빈 items" 전제, 홈 contentId 상세 200(L1 #5·#6), 실제 `contenttypeid` 유형 검증(#10) 미측정. SC-4 부분 충족. | 키 확보 후 frontend-support-backend가 L1 실행. 응답이 다르면 백엔드 판정 조건 보완. |
| **G-05 로딩 live region** | `role="status"`를 내용과 함께 마운트해 일부 스크린 리더가 공지하지 않을 수 있다. | L2 스크린 리더 확인 후 필요하면 영역 유지 + 내용 교체 구조로. |
| **G-08 이중 인코딩** | `&lt;br&gt;`가 오면 `<br>` 글자가 보일 수 있다(확신도 낮음). | 실제 데이터 확인 후 필요하면 치환 추가. |
| **전화번호 규칙** | 짧은 대표번호(`1330`, `02-120`) 링크 보류. 27개 회귀 케이스가 저장소 테스트로 없다. 규칙이 3번 바뀌어 복잡하다. | allowlist 여부 사용자 결정. 테스트 파일화. |
| **요청 취소 없음** | `client.js`가 AbortSignal을 받지 않아 응답만 무시한다. | `client.js` AbortSignal 지원(후속). |
| **G-07 카테고리 기준 3곳** | `enjoyConfigs`, `categoryFacts`, `ENJOY_CONTENT_TYPES`. | 목록 API 전환 때 통합. |
| **후속-1 좌표 뒤바뀜** | `TourDetailService`가 `mapx`(경도)를 latitude에 넣는다. 이번에는 좌표를 쓰지 않았다. | 지도 연동 전에 수정. |
| **후속-2 400 본문 3종** | `code` 없는 400 본문이 있다(IAE 핸들러 중복). 프론트는 status만 봐서 영향 없음. | 에러 핸들러 통합. |
| **후속-3 local-mock 목록 유형** | 목록이 요청 유형과 관계없이 12만 반환한다. 그래서 `local-mock`에서는 "여행을 더 즐겁게" 카드가 모두 여행지 상세로 간다. | 목록 API 연동 때 정리. |
| **후속-5 POP 복원** | 뒤로 가기 복원은 브라우저 기본 동작에 맡겨, 늦게 그려지는 화면에서는 정확하지 않을 수 있다. | 관찰. |
| **목 데이터** | overview의 `<br>`·`&nbsp;` 패턴은 추측으로 만든 것이다. | 실제 응답 캡처로 교체. |
| **`?type=` 없는 문화시설 id** | 실제 TourAPI에서 12로 요청돼 not-found가 된다. 앱 링크는 항상 `?type=`을 붙여 영향은 직접 입력뿐이다. | 한계로 기록(의도된 선택). |

---

## Portfolio Value

| 분류 | 자료 |
|------|------|
| README material | 6장 요약 |
| Portfolio project description | 1장 문단 |
| Troubleshooting story | 4.1 첫 목업 대체, 4.2 `Link` 전환 후 스크롤 회귀, 4.3 전화 링크 재발, 4.4 유형 불일치 404 |
| Technical decision | 3.1 ~ 3.8 |
| Interview Q&A | 5장 Q1 ~ Q8 |
| Resume bullet | 2장 |

## Interview Topics

- React: 렌더 중 파생값(해석 함수), render prop(`renderDetail`), `key` 재마운트로 상태 초기화, effect cleanup과 경쟁 조건, StrictMode 이중 실행, `set-state-in-effect` 규칙, `useLayoutEffect` vs `useEffect`
- 상태 관리: `status` 단일 상태 머신, 재시도(`attempt`), 커스텀 훅 vs TanStack Query
- API 연동: fail-closed 응답 검증, 상태 코드 기반 프론트·백엔드 계약(404 / 400 / 502), `encodeURIComponent`·`URLSearchParams`, 요청 취소가 없을 때의 대안
- 아키텍처: 두 데이터 출처의 점진적 전환, 출처를 모르는 view model, 의존 방향(화면 → 훅 → API 모듈 → client)
- 라우팅: `<a>` vs `Link`, 스크롤 복원과 `navigationType`(POP), Layout 밖 라우트
- 보안: `DOMParser` + `textContent`, `dangerouslySetInnerHTML` 미사용, `tel:` href 생성 규칙
- 접근성: `role="status"`/`role="alert"`, 재시도 실패 시에만 포커스 이동, `:focus-visible`
- JavaScript: 정규식 lookbehind/lookahead, `Object.hasOwn`
- 협업 프로세스: 리뷰 2회·gap 분석 2회, 설계 역반영, 미측정 항목을 점수에서 분리해 보고

## Follow-up Tasks

- 7장 개선 계획 참고. 우선순위는 보고서 8.3 기준으로 G-02(실제 키 L1) → F-7(브라우저 L2)이다.
