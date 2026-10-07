# tour-detail-integration 설계 문서

> **요약**: 상세 라우트가 id를 "목업 / TourAPI 상세 API / not-found" 세 가지로 해석한다. API 경로는 `useTourDetail` 훅의 상태(`loading`·`success`·`not-found`·`error`)로 렌더링한다. 이동할 때 이전 상태가 남지 않도록 `key`로 재마운트한다. 백엔드는 없는 콘텐츠를 404 `TOUR_CONTENT_NOT_FOUND`로 응답하고, `local-mock` 프로필에서도 상세를 돌려준다.
>
> **프로젝트**: WayLog
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-24
> **상태**: Approved (계획 문서 8장 D-1 ~ D-6 결정 반영)
> **버전**: 0.4 (분석 문서 8장·11.6 역반영, 코드 리뷰·gap 분석 수정, 2차 리뷰 MF-A 반영)
> **분석 문서**: `docs/03-analysis/tour-detail-integration.analysis.md`
> **계획 문서**: `docs/01-plan/features/tour-detail-integration.plan.md`
> **이전 이름**: `detail-not-found` (진단 `docs/development/waylog-renewal.md` Must Fix 4)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 홈에서 상세로 가는 클릭이 100% 다른 장소를 보여 주고, 잘못된 주소도 조용히 다른 콘텐츠로 대체된다 |
| **WHO** | 홈에서 추천 카드를 눌러 상세를 보는 모든 방문자, 공유 링크나 직접 입력한 주소로 들어오는 사용자 |
| **RISK** | 목업과 API 두 출처 혼재로 코드 복잡도 증가 / TourAPI의 "없는 콘텐츠" 응답 형태 미검증 / TourAPI 일일 호출 제한 / overview의 HTML 태그 / id 변경 시 경쟁 조건 |
| **SUCCESS** | 홈 카드 제목과 상세 제목 일치 / 목록 → 상세 회귀 없음 / 잘못된 id는 API 호출 없이 not-found / 없는 contentId는 404 → not-found / 서버 오류는 재시도 가능 / id 변경 시 이전 상태 없음 |
| **SCOPE** | 백엔드: 상세 not-found 404, local-mock 상세 / 프론트: 상세 2화면, 홈 섹션 3개, 신규 tourContentTypes·tourApi·useTourDetail·components/detail |

---

## 1. 개요

### 1.1 설계 목표

- 상세 화면은 요청한 id의 콘텐츠만 보여 준다. 찾지 못하면 다른 콘텐츠로 대체하지 않고 not-found를 보여 준다.
- 목록 페이지가 아직 목업이라는 제약을 유지하면서 홈(실제 API id) → 상세 흐름을 살린다.
- 비동기 조회는 한 가지 상태 값으로 표현해 "로딩이면서 오류" 같은 불가능한 조합을 만들지 않는다.

### 1.2 설계 원칙

- **출처 해석은 한 곳에서**: 라우트 컴포넌트가 id를 한 번 해석하고, 그 아래 View는 출처를 모르는 view model만 받는다.
- **최소 변경**: 기존 fetch 래퍼(`apiClient`, `ApiError`), `NotFoundPage`, `StatusPage.css`를 그대로 쓴다. 새 의존성은 추가하지 않는다.
- **거짓 정보 금지**: API 콘텐츠에는 목업용 하드코딩 값(전화번호, 이용시간)이나 무관한 "주변" 목업을 붙이지 않는다.
- **fail-closed**: 200이지만 형식이 다른 응답(`client.js`는 비JSON을 `{}`로 반환)은 성공으로 취급하지 않고 오류로 처리한다.

---

## 2. 아키텍처

### 2.0 선택지 비교와 결정 (D-1)

| 기준 | A. 404만 적용 | A'. 404 + 홈 링크를 목록으로 | B. 상세 전면 API | **C. 목업 + API 해석 (선택)** |
|------|:---:|:---:|:---:|:---:|
| 내용 | 목업에 없는 id → NotFoundPage | A + 홈 카드가 카테고리 목록으로 이동 | 상세는 API만 사용 | 목업 id → 목업, 숫자 id → API, 그 외 → not-found |
| 홈 → 상세 결과 | **항상 404** | 상세로 가지 않음 | 정상 | 정상 |
| 목록 → 상세 결과 | 정상 | 정상 | **깨짐** (목록은 slug id). 목록 API 전환이 선행돼야 함 | 정상 |
| 로딩·오류·없음 UI | 불필요 | 불필요 | 필요 | 필요 (API 경로만) |
| 백엔드 작업 | 없음 | 없음 | 404 + 목록 검색 API 연동 | 404, local-mock 상세 (작음) |
| 복잡도 | 낮음 | 낮음 | 높음 | 중간 |
| 위험 | 핵심 흐름이 막힌 것처럼 보임 | 기능 후퇴 | 범위가 목록 페이지네이션·검색까지 번짐 | 두 출처 공존 (해석 함수로 격리) |

**결정: C** (사용자 결정, 2026-09-24)

**선택하지 않은 안의 근거**
- **A·A'**: 홈의 상세 링크는 기본·`local-mock` 두 프로필 모두 숫자 contentId다. 그래서 A는 "틀린 장소"를 "항상 없음"으로 바꿀 뿐 흐름을 복구하지 못한다. A'는 이미 있는 상세 API를 쓰지 않고 기능을 후퇴시킨다.
- **B**: 카탈로그, 여행지 검색, 즐기기 카테고리, 즐기기 검색이 모두 목업 slug로 상세에 링크한다. 상세를 API 전용으로 바꾸면 이 네 화면의 API 전환이 먼저 필요하다. 결함 수정 범위를 크게 넘는다.
- **C**: 이미 있는 `TourDetailController`를 쓴다. 목록이 API로 전환되면 해석 함수의 목업 분기만 지우면 된다(점진적 전환).

### 2.1 구성도

```
/destinations/detail/:id?type=12|14                /enjoy/:category/:id
┌──────────────────────────────┐                  ┌──────────────────────────────┐
│ TravelDetailPage (라우트)     │                  │ EnjoyDetailPage (라우트)      │
│  resolveDestinationDetail()  │                  │  카테고리 가드(기존 유지)     │
│                              │                  │  resolveEnjoyDetail()        │
└──┬────────────┬──────────┬───┘                  └──┬────────────┬──────────┬───┘
   │ mock       │ api      │ not-found               │ mock       │ api      │ not-found
   ▼            ▼          ▼                         ▼            ▼          ▼
 stops?       TourApiDetail  NotFoundPage         EnjoyDetail  TourApiDetail  NotFoundPage
 ├ Course     key=id:type    (상세 문구)          Content      key=id:type    (상세 문구)
 │ key=id       │                                  key=id        │
 └ TravelDetail │ renderDetail(detail)                           │ renderDetail(detail)
   View key=id  ▼                                                ▼
          useTourDetail(contentId, contentTypeId) ──▶ api/tourApi.fetchTourDetail
               │ status                                   └▶ apiClient.get('/api/v1/tour/contents/{id}?contentTypeId=')
     ┌─────────┼──────────┬───────────┐
  loading   success    not-found    error
 DetailStatus  View    NotFoundPage  DetailStatus(재시도)
```

### 2.2 id 해석 규칙

라우트 컴포넌트가 렌더링할 때 계산한다. state에 저장하지 않는 파생값이다.

| 순서 | 조건 | 결과 | API 호출 |
|:---:|------|------|:---:|
| 1 | (즐기기만) 카테고리가 `enjoyConfigs`·`categoryFacts`에 없음 | not-found (app-safety-net 동작 유지) | 0 |
| 2 | id가 목업에 있음 | `{ kind: 'mock', item }` | 0 |
| 3 | `isTourContentId(id)`이고 유형을 정할 수 있음 | `{ kind: 'api', contentId, contentTypeId }` | 1 |
| 4 | 그 외 | `{ kind: 'not-found' }` | 0 |

- `isTourContentId(id)`: `/^\d{1,12}$/`. 목업 slug는 모두 숫자가 아니므로 2번과 3번이 겹치지 않는다.
- **여행지 유형 (D-4)**: `useSearchParams().get('type')`. 값이 없으면 12. 문자열 `'12'`·`'14'`만 허용하고, 그 밖의 값(빈 문자열 포함)이면 4번(not-found)으로 처리한다.
  - v0.4 (G-09): 백엔드가 요청 유형과 실제 유형이 다르면 404를 준다(§4.3 BE-4). 그래서 `?type=` 없이 문화시설(14) id를 열면 12로 요청되어 not-found가 된다. 앱 안의 링크는 `getTourDetailPath`가 항상 `?type=`을 붙이므로(§5.3) 이 경우는 사용자가 주소를 직접 고친 경우뿐이다. 다른 콘텐츠나 틀린 태그를 보여 주지 않는 쪽을 택했다.
  - v0.3 (G-01): `Number()`로 바꾸면 `'0xc'`, `'12.0'`, `' 12'`, `'1.2e1'`도 12가 되어 한 콘텐츠에 URL이 여러 개 생긴다. 그래서 숫자로 바꾸지 않고 문자열을 그대로 비교한다(`toDestinationTypeId`).
- **즐기기 유형**: 카테고리 slug로 정한다. `ENJOY_CONTENT_TYPES[category]` 값은 festivals 15, leports 28, food 39, shopping 38, stay 32다.
- 해석 함수는 각 페이지 파일 안의 모듈 수준 순수 함수로 둔다. 목업 import가 페이지에만 남게 하려는 것이다. 목록 API 전환 시 이 함수의 2번 분기만 삭제한다.

```js
// TravelDetailPage.jsx (모듈 수준)
function resolveDestinationDetail(id, typeParam) {
  const item = allDestinationMocks.find(entry => entry.id === id)
  if (item) return { kind: 'mock', item }
  const contentTypeId = typeParam == null ? DESTINATION_CONTENT_TYPES.attraction : toDestinationTypeId(typeParam)
  if (isTourContentId(id) && contentTypeId != null) return { kind: 'api', contentId: id, contentTypeId }
  return { kind: 'not-found' }
}

// '12' → 12, '14' → 14, 그 외 문자열 → null
function toDestinationTypeId(typeParam) {
  return Object.values(DESTINATION_CONTENT_TYPES).find(typeId => String(typeId) === typeParam) ?? null
}
```

### 2.3 컴포넌트 분리와 key 전략

| 컴포넌트 | 역할 | key |
|----------|------|-----|
| `TravelDetailPage` | 라우트. params 읽기, 해석, 분기만 담당 (state 없음) | - |
| `TravelDetailView` (같은 파일) | 기존 JSX를 옮긴 표시 컴포넌트. `saved`, `nearbyBookmarks`, `photoIndex`, `slideMotion` state를 보유 | 목업: `id` |
| `TravelCourseDetailPage` | 기존 코스 목업 화면 (변경 없음) | 목업: `id` |
| `EnjoyDetailPage` | 라우트. 카테고리 가드, 해석, 분기 | - |
| `EnjoyDetailContent` (같은 파일, 기존) | 표시 컴포넌트. `saved` state 보유. props를 `detail`(view model)로 변경 | 목업: `id` |
| `TourApiDetail` (공통) | 훅 호출, 상태별 렌더링 | API: `` `${contentId}:${contentTypeId}` `` |

**key를 쓰는 이유**
- 같은 라우트에서 id만 바뀌면 React는 컴포넌트를 재사용한다. 그래서 state가 남는다(진단 2.5절).
- `key`가 바뀌면 하위 트리 전체가 언마운트되고 다시 마운트된다. 모든 state가 초기값으로 돌아가고, 이전 effect의 cleanup도 실행된다.
- effect에서 state를 하나씩 초기화하는 방식은 누락 위험이 있고, ESLint `react-hooks` v7의 `set-state-in-effect` 규칙에도 걸린다.
- API 경로는 `TourApiDetail`에 key를 준다. 그 아래 View도 함께 재마운트되므로 View에 key를 따로 줄 필요가 없다.

### 2.4 비동기 상태와 경쟁 조건 (`useTourDetail`)

```js
// hooks/useTourDetail.js
// status: 'loading' | 'success' | 'not-found' | 'error'
export function useTourDetail(contentId, contentTypeId) {
  const [state, setState] = useState({ status: 'loading', detail: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true
    fetchTourDetail(contentId, contentTypeId)
      .then(detail => { if (isActive) setState({ status: 'success', detail }) })
      .catch(error => {
        if (!isActive) return
        const isNotFound = isNotFoundError(error)
        if (!isNotFound) console.error('상세 정보를 불러오지 못했습니다.', error)
        if (error instanceof ApiError && error.status === 400) {
          console.warn('상세 요청이 400으로 거절되었습니다. ...', { contentId, contentTypeId, body: error.body })
        }
        setState({ status: isNotFound ? 'not-found' : 'error', detail: null })
      })
    return () => { isActive = false }
  }, [contentId, contentTypeId, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', detail: null })   // 이벤트 핸들러 안에서 설정 (effect 안 동기 setState 금지)
    setAttempt(value => value + 1)
  }, [])

  return { ...state, retry, hasRetried: attempt > 0 }
}
```

- **상태 하나로 표현**: `isLoading`/`error`/`data` 세 값을 조합하지 않고 `status` 하나로 둔다. 불가능한 조합이 생기지 않는다.
- **경쟁 조건**: 호출하는 쪽이 key로 재마운트하므로 id가 바뀌면 이전 effect의 cleanup이 `isActive = false`를 설정한다. 늦게 도착한 이전 응답은 무시된다. 재시도 중에 이전 요청이 늦게 끝나는 경우도 effect 재실행 전 cleanup이 막는다.
- **isNotFoundError**: `error instanceof ApiError && (error.status === 404 || error.status === 400)`. 400도 URL에서 만든 잘못된 요청이므로 not-found로 처리한다.
- **로그 (v0.3)**: not-found가 아닌 오류는 `console.error`로 남기고 사용자에게는 노출하지 않는다(A-5). 400은 화면에서는 not-found로 안내한다. 하지만 해석 함수를 통과한 요청을 서버가 거절했다는 뜻이므로, 프론트·백엔드 파라미터 계약(`contentId` 형식, `contentTypeId` 허용값)이 어긋났을 가능성을 `console.warn`으로 남긴다(SI-3). 404는 정상적인 "없음"이라 로그를 남기지 않는다.
- **hasRetried (v0.3)**: 사용자가 "다시 시도"를 한 번이라도 눌렀는지를 나타낸다. 오류 카드의 포커스 이동 조건으로 쓴다(§5.1).
- **요청 취소**: `client.js`는 AbortSignal을 받지 않는다. 이번에는 응답 무시만 하고, 요청 취소는 후속 과제로 둔다(`client.js`는 auth-token-flow 결과물이라 이번 범위에서 수정하지 않음).
- **캐시**: 프론트 캐시는 두지 않는다. 서버 Caffeine 캐시가 있고, 무효화할 수 없는 모듈 전역 캐시(`fetchHomeDataOnce`와 같은 구조)를 늘리지 않기 위해서다.
- StrictMode 개발 환경에서는 effect가 두 번 실행되어 요청이 2회 나간다. 첫 응답은 cleanup으로 무시된다. 운영 빌드에서는 1회다.

### 2.5 의존성

| 컴포넌트 | 의존 대상 |
|----------|-----------|
| TravelDetailPage | destinationMocks, tourContentTypes, TourApiDetail, NotFoundPage, TravelCourseDetailPage, api/tourApi(`toTelHref`), components/detail/detailMessages |
| EnjoyDetailPage | enjoyMocks, tourContentTypes, TourApiDetail, NotFoundPage, api/tourApi(`toTelHref`), components/detail/detailMessages |
| TourApiDetail | useTourDetail, DetailStatus, NotFoundPage, components/detail/detailMessages |
| App (v0.3) | components/common/ScrollToTop (§5.4) |
| useTourDetail | api/tourApi, api/client(`ApiError`) |
| api/tourApi | api/client(`apiClient`) |
| 홈 섹션 3개 | tourContentTypes(`getTourDetailPath`) |

페이지가 `api/tourApi`를 직접 import하는 경로는 `toTelHref` 하나다(C-1). 네트워크를 쓰지 않는 순수 함수라 "화면은 상세 API URL을 직접 쓰지 않는다"(§9) 원칙은 유지된다.

---

## 3. 데이터 모델

### 3.1 상세 view model (출처 공통)

```js
{
  source: 'mock' | 'api',
  id: string,
  title: string,
  image: string | null,      // null이면 View가 페이지별 기본 이미지 사용
  address: string,           // 없으면 '주소 정보 없음'
  typeLabel: string,         // 목업: item.tag / config.title, API: contentTypeName
  description: string,       // 줄바꿈(\n) 포함 가능한 순수 텍스트
  infos: [{ label, value }], // API: detailInfos (정리된 텍스트). 목업 화면은 기존 하드코딩 문구를 그대로 씀
  contact: string | null,    // API: 라벨이 '문의 및 안내' 또는 '문의'인 항목의 값
  meta?: string,             // 목업 전용 선택 필드(v0.3, A-2). 여행지 "휴무일", 즐기기 "행사 기간" 표시에만 씀. API view model에는 없음
}
```

**변환 함수 위치**

| 함수 | 위치 | 내용 |
|------|------|------|
| `toTourDetail(data)` | `api/tourApi.js` | API 응답 → view model. `data.title`이 문자열이 아니면 `Error` throw (fail-closed) |
| `toDestinationMockDetail(item)` | `TravelDetailPage.jsx` | 목업 → view model. `description`은 기존처럼 `${item.description}.` |
| `toEnjoyMockDetail(item, config)` | `EnjoyDetailPage.jsx` | 목업 → view model. `typeLabel = config.title`, `address = item.location` |

목업 화면의 하드코딩 문구(`highlights`, `guideLabels`, `categoryFacts`, 전화번호)는 View 안에 `detail.source === 'mock'` 분기로 그대로 남긴다. 목업은 목록 API 전환 때 사라질 대상이므로 view model로 옮겨 일반화하지 않는다.

- API의 `latitude`·`longitude`는 이번에 쓰지 않는다(백엔드 좌표 순서 문제는 후속).

### 3.2 텍스트 정리 규칙 (FR-06)

`api/tourApi.js`의 `toPlainText(value)`로 `overview`와 `detailInfos[].label`·`detailInfos[].value`를 정리한다(v0.3: `label`도 정리, A-6).

1. `null`·`undefined` → `''`
2. `/<br\s*\/?>[ \t]*(?:\r?\n)?/gi` → `'\n'`. `<br>` 바로 뒤에 원문 개행이 이어지면(`<br>\n`) 개행까지 함께 치환해 줄바꿈이 두 번 생기지 않게 한다(v0.3, N-5)
3. `new DOMParser().parseFromString(text, 'text/html').body.textContent ?? ''`로 나머지 태그를 제거하고 엔티티(`&nbsp;`, `&amp;`, `&lt;` 등)를 복원한다. `DOMParser`로 만든 문서는 스크립트를 실행하지 않고 이미지도 불러오지 않는다.
4. `U+00A0`(`&nbsp;`가 복원된 문자) → 일반 공백, 줄 끝 공백·탭 제거(v0.3, A-6)
5. 개행이 3개 이상 이어지면 2개로 줄이고(빈 줄은 최대 1줄), 앞뒤 공백을 제거한다.
6. 정리 후 `label`이나 `value`가 빈 `detailInfos` 항목은 제외한다.

`title`은 공백만 있어도 형식 오류로 보고(fail-closed), trim해서 쓴다(A-6).

화면에서는 `white-space: pre-line`으로 줄바꿈을 표시한다. `dangerouslySetInnerHTML`은 쓰지 않는다.

**연락처 링크** (`toTelHref(contact)`, v0.3 MF-1, v0.3.1 MF-A)

v0.2는 `contact.replace(/[^\d+]/g, '')`처럼 숫자를 모두 이어 붙였다. 그래서 문의처에 번호가 여러 개 있으면 존재하지 않는 번호로 전화 링크가 만들어졌다(예: `"02-3700-3900~1"` → `tel:02370039001`).

v0.3은 "숫자로 시작·끝나고 사이에 하이픈·점·괄호·공백이 있는 구간"을 후보로 잡았다. 그런데 공백과 `(`를 번호 안쪽 문자로 허용해서, 번호 뒤에 붙은 설명의 숫자까지 한 번호로 합쳤다(2차 리뷰 MF-A). 예: `"02-123-4567 (2)"` → `tel:0212345672`, `"1330 1588-1234"` → `tel:133015881234`.

v0.3.1은 후보를 **한국 전화번호 형태**로 좁히고, 번호 하나로 확정할 수 있을 때만 링크를 만든다.

```js
const PHONE_NUMBER_PATTERN =
  /(?<!\d)(?:(?:\+82[-. ]?\(?0?\d{1,3}\)?|\(?0\d{1,3}\)?)[-. ]?\d{3,4}[-.]?\d{4}|1[5-9]\d{2}[-.]?\d{4})(?!\d)/g
```

- 허용 형태: 0으로 시작하는 지역번호·휴대폰·050x 번호(지역번호 괄호 허용), `+82` 국제 형식(지역번호 앞 0 생략 가능), 15xx ~ 19xx 대표번호
- 구분자는 하이픈·점만 허용한다. 공백은 지역번호(또는 `+82`) 바로 뒤에서만 허용한다(`"(064) 710-7912"`).
- `(?<!\d)`·`(?!\d)`: 앞뒤에 숫자가 붙어 있으면 긴 숫자열의 일부만 잡은 것이므로 매치하지 않는다.

판정 순서

1. 패턴에 맞는 번호가 정확히 1개가 아니면(0개, 2개 이상) `null`
2. 번호를 뺀 나머지에 4자리 이상 이어진 숫자가 있으면 `null`. 패턴이 인식하지 못한 다른 번호일 수 있다(`"1330 1588-1234"`). 시각(`09:00`)이나 내선(`23`)은 2자리라 걸리지 않는다.
3. 번호 앞뒤에 `~`가 있으면 범위 번호로 보고 `null`. 번호와 `~` 사이에 공백이 있어도 같다(`/~\s*$/`, `/^\s*~/`. 예: `"02-3700-3900~1"`, `"02-3700-3900 ~ 1"`, v0.4 A-11)
4. 숫자가 7 ~ 12자리가 아니면 `null`. `+`는 국제 형식일 때만 유지한다.
5. `null`이면 문의처를 텍스트로만 표시한다. 여행지 화면의 라벨은 "문의"가 된다(링크일 때만 "문의 전화").

| 입력 | 결과 | 이유 |
|------|------|------|
| `"033-123-4567"`, `"010-1234-5678"`, `"0507-1234-5678"` | `tel:0331234567` 등 | 번호 1개 |
| `"+82-2-1234-5678"` | `tel:+82212345678` | 국제 형식 |
| `"(064)710-7912"`, `"(064) 710-7912"`, `"064-710-7912 (내선 2)"`, `"평일 09:00~18:00 / 064-710-7912"` | `tel:0647107912` | 괄호 지역번호, 짧은 숫자 설명 |
| `"02-123-4567 (09:00~18:00)"`, `"02-123-4567 (1번)"`, `"02-123-4567(내선 23)"`, `"문의 02-123-4567 2층"`, `"09:00~18:00 02-123-4567"` | `tel:021234567` | 뒤·앞의 설명 숫자를 번호에 합치지 않음 (v0.3에서는 잘못된 번호) |
| `"054-123-4567 (2)"` | `tel:0541234567` | 같음 |
| `"1588-1234"` | `tel:15881234` | 대표번호 |
| `"02-3700-3900~1"`, `"02-3700-3900 ~ 1"` | `null` | 범위 번호 (`~` 앞뒤 공백 허용) |
| `"02-123-4567, 02-123-4568"`, `"02-123-4567 02-123-4568"`, `"관리사무소 02)2133-5555\n매표소 02)2133-5556"` | `null` | 번호 2개 |
| `"1330 1588-1234"` | `null` | 번호 밖에 4자리 숫자가 남음 |
| `"02-120 1330"`, `"02-120"`, `"1330"` | `null` | 한국 전화번호 형태가 아님(짧은 대표번호) |
| `""`, `null` | `null` | 입력 없음 |

잘못된 번호로 전화가 걸리는 것보다 링크가 없는 편이 안전하다. 그래서 확신할 수 없는 경우는 모두 텍스트로 둔다. `1330`, `02-120` 같은 짧은 대표번호를 링크로 만들지는 사용자 결정 전까지 보류한다(allowlist 미도입).

---

## 4. API 명세

### 4.1 엔드포인트

| 메서드 | 경로 | 설명 | 인증 | 변경 |
|--------|------|------|------|------|
| GET | `/api/v1/tour/contents/{contentId}?contentTypeId={12\|14\|15\|28\|32\|38\|39}` | 통합 상세 조회 | 불필요 (`SecurityConfig:63` permitAll) | **없는 콘텐츠 502 → 404** |

### 4.2 응답

**성공 (200)**: 기존 `TourDetailResponse`. 변경 없음.

```json
{
  "contentId": "126508", "contentTypeId": 12, "contentTypeName": "관광지",
  "title": "경복궁", "image": null, "address": "서울특별시 종로구 사직로 161",
  "overview": "조선 왕조의 법궁입니다.<br>...", "latitude": 126.977, "longitude": 37.578,
  "detailInfos": []
}
```

**없는 콘텐츠 (404, 신규)**: 기존 `TourExceptionHandler.ErrorResponse`와 같은 형식이다.

```json
{ "code": "TOUR_CONTENT_NOT_FOUND", "message": "요청한 관광 콘텐츠를 찾을 수 없습니다.", "timestamp": "2026-09-24T10:00:00" }
```

**기타 (기존 유지)**

| 상태 | 원인 | body |
|------|------|------|
| 400 | `contentTypeId` 누락 | Spring 기본 오류 응답 |
| 400 | 지원하지 않는 `contentTypeId` | `{ code: "INVALID_REQUEST", message, timestamp }` 또는 `{ message }` (IAE 핸들러 2개 중복, 후속 과제) |
| 502 | 외부 통신 실패, 응답 body 없음, `resultCode` ≠ `0000` | `{ code, message, timestamp }` |

**요청 유형 ≠ 실제 유형 (404, v0.4 G-09)**: `detailCommon2`는 contentId만으로 조회하므로 다른 유형으로 요청해도 콘텐츠를 돌려준다. 실제 유형(`contenttypeid`)이 있고 요청한 `contentTypeId`와 다르면, 없는 콘텐츠와 같은 404 `TOUR_CONTENT_NOT_FOUND`로 응답한다(예: `126508?contentTypeId=14`). 요청 유형을 그대로 응답하면 화면에 틀린 태그와 빈 이용 안내가 표시되기 때문이다.

프론트는 `status`로만 분기한다. 404와 400은 not-found, 그 밖의 오류는 error다. `code`는 로그 확인용이다.

### 4.3 백엔드 변경 명세 (frontend-support-backend 전용)

경로 기준: `backend/src/main/java/kr/co/mycom/travel_korea/tour/`

**BE-1. `exception/TourContentNotFoundException.java` (신규)**

```java
public class TourContentNotFoundException extends RuntimeException {
    private final String contentId;
    public TourContentNotFoundException(String contentId) {
        super("요청한 관광 콘텐츠를 찾을 수 없습니다.");
        this.contentId = contentId;
    }
    public String getContentId() { return contentId; }
}
```

**BE-2. `exception/TourExceptionHandler.java` (수정)**: 핸들러를 하나 추가한다. 응답 형식은 기존 `ErrorResponse` 레코드를 그대로 쓴다.

```java
@ExceptionHandler(TourContentNotFoundException.class)
public ResponseEntity<ErrorResponse> handleContentNotFound(TourContentNotFoundException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("TOUR_CONTENT_NOT_FOUND", exception.getMessage(), LocalDateTime.now()));
}
```

**BE-3. `client/TourApiClientImpl.java` (수정)**
- `getDetailCommon`에서 `extractDetailCommon(rawResponse, contentId)`로 contentId를 넘긴다.
- `extractDetailCommon`에서 `validateDetailResult` 통과(`resultCode == "0000"`) 후 `body`·`items`·`item`이 null이거나 비어 있으면 `TourContentNotFoundException(contentId)`를 던진다.
- 다음 경우는 기존대로 `TourApiException`(502)를 유지한다: `rawResponse == null`, `response == null`, header 없음, `resultCode` ≠ `0000`.
- `getDetailCommon`의 `catch (TourApiException)`는 그대로 둔다. `TourContentNotFoundException`은 `RestClientException`이 아니므로 변환되지 않고 전파된다.
- `getDetailIntro`는 변경하지 않는다. intro가 없어도 공통 상세는 표시한다.

**BE-4. `service/TourDetailService.java` (수정)**: `getDetailCommon` 호출 직후 null이면 예외를 던진다.

```java
if (common == null) {
    throw new TourContentNotFoundException(contentId);
}
```

`@Cacheable`은 예외를 캐시하지 않으므로, 없는 id는 요청마다 외부 API를 호출한다(허용).

**BE-4 추가 (v0.4, G-09): 실제 유형 검증.** null 검사 바로 뒤, `getDetailIntro` 호출 전에 실행한다.

```java
// getDetail 안: common null 검사 직후
validateActualContentType(contentId, contentTypeId, common.contenttypeid());
TourApiDetailIntroItem intro = tourApiClient.getDetailIntro(contentId, contentTypeId);

private void validateActualContentType(String contentId, Integer requestedContentTypeId, Integer actualContentTypeId) {
    if (actualContentTypeId != null && !actualContentTypeId.equals(requestedContentTypeId)) {
        throw new TourContentNotFoundException(contentId);
    }
}
```

- 실제 유형이 `null`이면 판단할 수 없으므로 기존처럼 통과시킨다.
- `detailIntro2` 호출 전에 검사해, 유형이 틀린 요청의 외부 API 호출을 1회(`detailCommon2`)로 줄인다.
- 예외는 `@Cacheable`(key `detail:{id}:{type}`)에 저장되지 않는다. 잘못된 유형 요청은 캐시에 남지 않고, 올바른 유형의 캐시 항목에도 영향을 주지 않는다.

**BE-5. `client/MockTourApiClient.java` (수정, `@Profile("local-mock")`)**
- `getAreaBasedList`와 같은 3건으로 `Map<String, TourApiDetailCommonItem>` 상수를 만든다.

  | contentid | contenttypeid | title | addr1 / addr2 | mapx / mapy |
  |-----------|:---:|-------|---------------|-------------|
  | `126508` | 12 | 경복궁 | 서울특별시 종로구 / 사직로 161 | 126.9770170625 / 37.5788222356 |
  | `126485` | 12 | 비자림 | 제주특별자치도 제주시 구좌읍 / 비자숲길 55 | 126.8114078 / 33.4913452 |
  | `125476` | 12 | 경포해변 | 강원특별자치도 강릉시 / 창해로 | 128.9071180 / 37.8056495 |

  `firstimage`·`firstimage2`는 null로 둔다(프론트 기본 이미지 경로 확인용). `overview`는 `<br>`와 `&nbsp;`를 포함한 두 문장 이상의 한국어 설명으로 만든다(프론트 텍스트 정리 확인용).
- `getDetailCommon(contentId, contentTypeId)`: 맵에 있으면 반환하고, 없으면 `throw new TourContentNotFoundException(contentId)`. `contenttypeid`는 요청 유형에 따라 다르게 돌려준다(v0.4, G-09).
  - 여행지 유형(12, 14) 또는 `null`로 요청하면 저장된 실제 유형(12)을 그대로 반환한다. 그래서 `126508?contentTypeId=14`는 BE-4 유형 검증에 걸려 실제 TourAPI와 같이 404가 된다.
  - 즐기기 유형(15, 28, 32, 38, 39)으로 요청하면 `contenttypeid`를 요청값으로 바꾼 항목을 반환한다. 목에는 즐기기용 데이터가 없어서, 3건을 즐기기 상세 성공 경로 확인에 재사용하기 위한 목 전용 동작이다(`/enjoy/festivals/126485`, `/enjoy/food/126508` 등).
- `getDetailIntro`: 기존처럼 `null`을 반환한다. `TourApiDetailIntroItem`은 필드가 43개라 목으로 만드는 비용이 크다. 그 결과 `detailInfos`는 `[]`가 되고, 프론트의 "상세 이용 정보가 없습니다" 경로를 확인할 수 있다. `detailInfos`가 있는 경로는 실제 키로 확인한다.

**BE-6. 검증** (`local-mock` 프로필, JDK 25: `C:\Users\ASUS\dev\jdks\jdk-25.0.2`)
- `mvnw -q -DskipTests compile`
- §8.2 L1 1 ~ 4, 7. 실제 키가 있으면 5 ~ 6 (특히 6: TourAPI가 없는 id에 `0000` + 빈 items를 주는지)
- 수정 금지: `SecurityConfig`, 목록·홈·축제 API 동작, 프론트 파일 전체

---

## 5. UI/UX

### 5.1 상태별 화면

| 상태 | 컴포넌트 | 내용 | 접근성 |
|------|----------|------|--------|
| loading | `DetailStatus variant="loading"` | 카드 하나: 스피너 없이 "상세 정보를 불러오는 중입니다." 한 줄. `status-page`(min-height 72vh)를 재사용해 푸터가 튀어 오르지 않게 함 | 카드에 `role="status"` |
| error | `DetailStatus variant="error"` | eyebrow "오류"(`status-page__eyebrow--error`, A-9), 제목 "상세 정보를 불러오지 못했습니다", 설명 "잠시 후 다시 시도해 주세요.", 버튼 [다시 시도](`<button>`, primary) [목록으로](`<Link to={backTo}>`) | `role="alert"`, `aria-labelledby`로 제목 연결. 서버 `message`는 노출하지 않음. 재시도 후 실패면 제목으로 포커스 이동(아래) |
| not-found | `NotFoundPage` | `title="콘텐츠를 찾을 수 없습니다"`, `description="요청한 여행 정보가 없거나 삭제되었을 수 있습니다. 주소를 다시 확인해 주세요."` | 기존 구조 |
| success | 각 View | §5.2 규칙 | 기존 |

**DetailStatus 계약** (`components/detail/DetailStatus.jsx`)

```js
DetailStatus({ variant: 'loading' | 'error', onRetry, backTo, focusOnMount = false })
```

**오류 카드 포커스 (v0.3, SI-2)**
- "다시 시도"를 누르면 버튼이 로딩 카드로 바뀌며 사라지고, 포커스가 `body`로 떨어진다. 재시도가 또 실패하면 키보드 사용자는 처음부터 Tab으로 버튼을 다시 찾아야 한다.
- 그래서 `hasRetried`(§2.4)가 참일 때 오류 카드가 마운트되면 제목(`tabIndex={-1}`)으로 포커스를 옮긴다. 제목에서 Tab을 한 번 누르면 "다시 시도"다.
- **첫 진입 실패에는 옮기지 않는다.** 사용자가 아무것도 누르지 않았으므로 `role="alert"` 공지로 충분하다. 페이지 로드 직후 포커스를 강제로 옮기면 스크린 리더가 문서를 처음부터 읽는 흐름을 끊는다.
- 포커스 윤곽선은 `:focus-visible`일 때만 보인다(마우스로 누른 경우 숨김). 스타일은 `components/detail/DetailStatus.css`의 `.detail-status__title`에 둔다(`StatusPage.css`는 수정 금지, §10).

- `StatusPage.css`의 클래스(`status-page`, `status-page__card`, `__eyebrow`, `__title`, `__description`, `__actions`, `__button`, `__button--primary`)를 import해서 재사용한다.
- `<button>` 보정 스타일은 필요 없었다. `StatusPage.css`의 `.status-page__button`에 이미 `font: inherit`, 테두리, `cursor`가 있다(C-8). `DetailStatus.css`는 v0.3에서 제목 포커스 스타일 때문에 만들었다.
- `NotFoundPage.jsx`와 `StatusPage.css`는 수정하지 않는다(app-safety-net 소유).

**TourApiDetail 계약** (`components/detail/TourApiDetail.jsx`)

```js
TourApiDetail({ contentId, contentTypeId, backTo, renderDetail })
// loading   → <DetailStatus variant="loading" />
// error     → <DetailStatus variant="error" onRetry={retry} backTo={backTo} />
// not-found → <NotFoundPage title=... description=... />
// success   → renderDetail(detail)
```

**문구 상수** (`components/detail/detailMessages.js`, v0.3 확정)

컴포넌트 파일에서 상수를 함께 export하면 `react-refresh/only-export-components` 경고가 나므로 대체 경로(별도 파일)를 채택했다(C-2).

| 상수 | 문구 | 쓰는 곳 |
|------|------|---------|
| `DETAIL_NOT_FOUND_TITLE` | 콘텐츠를 찾을 수 없습니다 | TourApiDetail, 두 페이지의 해석 단계 not-found |
| `DETAIL_NOT_FOUND_DESCRIPTION` | 요청한 여행 정보가 없거나 삭제되었을 수 있습니다. 주소를 다시 확인해 주세요. | 같음 |
| `DETAIL_EMPTY_INFOS_MESSAGE` | 상세 이용 정보가 없습니다. 방문 전 현지에 확인해 주세요. | 두 View의 API 이용 안내 |
| `DETAIL_EMPTY_DESCRIPTION_MESSAGE` | 등록된 소개 정보가 없습니다. | 두 View의 API 소개 (v0.3, N-1) |

**backTo**

| 페이지 | 값 |
|--------|----|
| 여행지, 유형 12 | `/destinations/attractions` |
| 여행지, 유형 14 | `/destinations/culture` |
| 즐기기 | `/enjoy/{category}` |
| 여행지 목업 (A-3) | `destinationItems`에 있으면 `/destinations/attractions`, 아니면 `/destinations/culture` |

### 5.2 출처별 섹션 표시 규칙 (FR-05, D-5)

**TravelDetailView**: API일 때 `main`에 `travel-detail-main--api` 수정자 클래스를 붙인다.

| 섹션 | 목업 (기존 그대로) | API |
|------|-------------------|-----|
| 뒤로 버튼 `goBack` | 기존 | history가 있으면 뒤로, 없으면 `backTo` |
| 헤더 (태그·제목·주소·공유·저장) | 유지 | 유지. 태그 = `typeLabel`. `typeLabel`이 비면 태그 숨김(헤더·위치 안내 모두, C-7) |
| 갤러리 | 대표 1 + 같은 이미지 4 + "사진 전체보기 5" | 대표 이미지 1장만 표시하고 버튼 숨김. `detail-gallery--single` 클래스 (1열, 높이 450px, 모바일 250px). 로드 실패 시 기본 이미지로 한 번만 교체(아래 "이미지 로드 실패") |
| 상단 요약 `detail-facts` | 하드코딩 5개 | **숨김** (`dd`가 `white-space: nowrap`이라 긴 API 값이 넘침, 이용 안내와 중복) |
| 소개 | `description` + 기존 일반 문단 | `description`만 (`pre-line`). 긴 overview를 읽기 쉽게 17px·굵기 500·줄간격 1.85(C-3). 비면 `DETAIL_EMPTY_DESCRIPTION_MESSAGE`(A-4) |
| 이용 안내 `detail-guide` | `guideLabels` 6개 | `infos` 전체 (`dd`에 `pre-line`). 행은 위쪽 정렬, 긴 값은 `overflow-wrap: anywhere`로 줄바꿈(360px 가로 스크롤 방지, C-4). 비어 있으면 `DETAIL_EMPTY_INFOS_MESSAGE` |
| 방문 전 확인 aside | 하드코딩 번호 | `contact`가 있을 때만 문의 영역 표시. `toTelHref`가 링크를 만들면 라벨 "문의 전화" + `tel:` 링크, `null`이면 라벨 "문의" + 텍스트(§3.2, C-6). "정보 오류 제보" 버튼 유지 |
| 위치 안내 | 유지 | 유지 (지도 자리 표시, 태그·제목·주소) |
| 추가 사진 슬라이더 | 유지 | **숨김** |
| 주변에서 함께 둘러볼 곳 | 유지 | **숨김** |
| TourAPI 출처 문구 | 유지 | 유지 |

**EnjoyDetailContent**: API일 때 `main`에 `enjoy-detail-main--api` 클래스를 붙인다.

| 섹션 | 목업 (기존 그대로) | API |
|------|-------------------|-----|
| 제목·주소·저장 | 유지 | 유지. 태그 = `typeLabel || config.title`(A-8) |
| 커버 | `item.image`. 로드 실패 시 `config.cover`로 한 번만 교체(v0.4, A-10: 목업과 API가 같은 `<img>`를 써서 대체도 함께 적용됨) | `image` 또는 `config.cover`(로드 실패 시 `config.cover`로 한 번만 교체). 커버 위 문구는 `description`의 첫 줄(최대 80자, 넘으면 말줄임). CSS로도 2줄 말줄임을 적용한다(C-5) |
| `enjoy-detail-facts` | `categoryFacts` | **숨김** |
| 소개 | 기존 문단 + "TourAPI 연동 후에는..." 안내 | `description`만 (`pre-line`, 여행지와 같은 문단 스타일). 비면 `DETAIL_EMPTY_DESCRIPTION_MESSAGE` |
| 이용 안내 | `categoryFacts` | `infos` (비면 `DETAIL_EMPTY_INFOS_MESSAGE`). 위쪽 정렬, 긴 값 줄바꿈 |
| 방문 전 확인 aside (v0.3, A-7) | 안내 문구 + "전화 문의" 버튼 + "정보 오류 제보" | "전화 문의" 버튼 숨김. `contact`가 있을 때만 "문의" 블록 표시(링크 규칙 §3.2, 라벨은 항상 "문의"). "정보 오류 제보" 유지 |
| 지도 자리 | 유지 | 유지 |
| 함께 살펴볼 정보 (같은 카테고리 목업 3개) | 유지 | 유지. 위치를 주장하지 않는 카테고리 추천이므로 D-5 대상이 아님. API id는 목업 id와 겹치지 않아 3개가 표시됨 |

**기본 이미지**: 여행지는 `assets/figma/destination-jeju.png`(홈 추천 여행지와 같음), 즐기기는 `config.cover`.

**이미지 로드 실패 (v0.3, SI-4)**: API `image`가 있어도 외부 URL이 깨질 수 있다. `onError`에서 View의 `isImageBroken` state를 `true`로 바꾸면 기본 이미지로 다시 그린다. 기본 이미지까지 실패해도 `true → true`라 재렌더링과 재요청이 반복되지 않는다(무한 `onError` 방지). View는 콘텐츠마다 key로 재마운트되므로 이전 콘텐츠의 실패 상태가 남지 않는다. DOM의 `src`를 직접 바꾸지 않고 state로 두어, 화면이 항상 state에서 계산되게 했다.

### 5.3 홈 진입점 변경 (FR-08 ~ FR-10)

`data/tourContentTypes.js`의 `getTourDetailPath(contentId, contentTypeId)` 하나로 경로를 만든다.

| contentTypeId | 경로 |
|---|---|
| 12, 14 | `/destinations/detail/{contentId}?type={12\|14}` |
| 15, 28, 39, 38, 32 | `/enjoy/{festivals\|leports\|food\|shopping\|stay}/{contentId}` |
| 그 외, `contentId`가 형식에 맞지 않음 | `null` (호출하는 쪽이 대체 경로 사용) |

`contentTypeId`는 문자열(`"39"`)과 숫자를 모두 받는다(`Number()` 변환).

| 섹션 | 변경 전 | 변경 후 |
|------|---------|---------|
| 여행을 더 즐겁게 (`ThemeDestinationSection.jsx:148`) | `Link` → `/destinations/detail/{contentId}` | `Link` → `getTourDetailPath(item.contentId, item.contentTypeId) ?? '/enjoy'` |
| 이번 주 여행 소식 (`WeeklyNewsSection.jsx:122`) | `<a href="/enjoy/festivals/{contentId}">` | **`Link`로 교체** → `getTourDetailPath(festival.contentId, 15) ?? '/enjoy/festivals'`. 전체 새로고침이 없어져 홈 API와 세션 복원(`/auth/refresh`)을 다시 요청하지 않는다. `img`의 `onError` 처리는 그대로 둔다 |
| 추천 여행지 (`RecommendedDestinationSection.jsx:51`, D-3) | `<a href="/destinations/attractions">` | `Link` → `getTourDetailPath(item.contentId, item.contentTypeId ?? 12) ?? '/destinations/attractions'`. 주석의 "detailCommon2 연결이 완료되면..." 문구도 갱신 |

`TourFestivalResponse`에는 `contentTypeId`가 없어서 축제는 15로 고정한다. 12·14를 여행지 상세로 보내는 규칙은 `local-mock` 때문에도 필요하다. `local-mock`의 목록은 요청한 유형과 관계없이 `contenttypeid "12"`를 반환한다. 이 규칙이 없으면 `local-mock`의 "여행을 더 즐겁게" 카드가 모두 `/enjoy`로 가게 된다.

### 5.4 라우트 이동 시 스크롤 초기화 (v0.3, MF-2)

v0.2에서는 후속 과제(§13)였다. 그런데 §5.3에서 홈 카드를 `Link`로 바꾸면서 전체 새로고침이 사라졌고, 상세가 홈의 스크롤 위치(페이지 중간·하단)에서 열리게 되었다. 이번 변경이 만든 회귀이므로 이번 범위로 옮긴다.

- `components/common/ScrollToTop.jsx`: `useLocation().pathname`이 바뀌면 `useLayoutEffect`에서 `window.scrollTo(0, 0)`을 호출한다.
- **위치**: `App.jsx`의 `BrowserRouter` 바로 아래. 홈(`/`), `/login`, `/signup`, `/forgot-password`는 `Layout` 밖 라우트다. `Layout`에 두면 상세 → 홈(빵 부스러기 "홈" 링크) 이동이 초기화되지 않는다.
- **useLayoutEffect**: 새 화면을 그리기 전에 스크롤해 이전 위치가 한 프레임 보였다 튀는 현상을 막는다.
- **pathname만 비교**: 같은 화면에서 쿼리만 바뀌는 이동(검색 조건 등)은 위치를 유지한다. 직전 pathname을 ref에 두고 비교한다. 그래서 POP 뒤 같은 화면에서 쿼리만 PUSH할 때 `navigationType`만 바뀐 것으로 초기화되지 않는다.
- **POP 제외**: 뒤로·앞으로 가기와 첫 로드는 브라우저의 스크롤 복원을 따른다. 덮어쓰면 목록으로 돌아왔을 때 보던 위치를 잃는다.

---

## 6. 오류 처리

| 상황 | 판정 위치 | 프론트 상태 | 사용자 행동 |
|------|-----------|-------------|-------------|
| 목업에 없는 slug, 허용되지 않는 `type`, 형식이 틀린 id | 해석 함수 | not-found (API 호출 없음) | 홈·목록 이동 |
| 404 `TOUR_CONTENT_NOT_FOUND` | 백엔드 | not-found | 동일 |
| 요청 유형 ≠ 실제 유형 (예: 관광지 id를 `?type=14`로 요청) → 404 `TOUR_CONTENT_NOT_FOUND` (v0.4) | 백엔드 (BE-4 유형 검증) | not-found | 동일 |
| 400 | 백엔드 | not-found (`console.warn`으로 계약 불일치 가능성 기록, §2.4) | 동일 |
| 502 / 500 / 네트워크 오류 | 백엔드·브라우저 | error | 다시 시도, 목록으로 |
| 200인데 `title` 없음 (`{}` 포함) | `toTourDetail` | error | 동일 |
| 대표 이미지 로드 실패 | View `onError` | success 유지, 기본 이미지로 교체 (§5.2) | - |
| 백엔드 BE-1 ~ 4 적용 전의 없는 id (502) | - | error | 동일. 다른 장소를 보여 주지 않으므로 안전한 저하 |

---

## 7. 보안

- [ ] 외부 API 문자열을 HTML로 삽입하지 않음 (§3.2)
- [ ] `tel:` 링크는 한국 전화번호 형태 하나로 확정될 때만 숫자와 `+`(국제 형식)로 생성. 외부 문자열을 `href`에 그대로 넣지 않음 (§3.2)
- [ ] `contentId`는 `isTourContentId`를 통과한 경우에만 API 경로에 넣고, `encodeURIComponent`를 적용
- [ ] `contentTypeId`는 `URLSearchParams`로 직렬화

---

## 8. 테스트 계획

### 8.1 범위

| 유형 | 대상 | 도구 | 담당 |
|------|------|------|------|
| 정적 | 백엔드 컴파일 | mvnw | frontend-support-backend |
| L1 API | 상세 200/404/400 | curl | frontend-support-backend |
| 정적 | build, lint | npm | frontend-lead |
| L2 UI | §8.3 체크리스트 | 브라우저 + 네트워크 탭 | frontend-lead (백엔드 완료 후) |

### 8.2 L1 API 시나리오

| # | 요청 | 프로필 | 기대 |
|---|------|--------|------|
| 1 | `GET /api/v1/tour/contents/126508?contentTypeId=12` | local-mock | 200, `.title == "경복궁"`, `.detailInfos == []` |
| 2 | `GET /api/v1/tour/contents/999999999?contentTypeId=12` | local-mock | 404, `.code == "TOUR_CONTENT_NOT_FOUND"`, `.message`, `.timestamp` |
| 3 | `GET /api/v1/tour/contents/126508?contentTypeId=99` | local-mock | 400 |
| 4 | `GET /api/v1/tour/contents/126508` | local-mock | 400 |
| 5 | 홈 응답의 contentId 하나로 상세 조회 | 기본 + 실제 키 | 200, 제목이 홈과 같음 |
| 6 | `GET /api/v1/tour/contents/999999999?contentTypeId=12` | 기본 + 실제 키 | 404 (TourAPI 빈 응답 가정 검증) |
| 7 | `GET /api/v1/home` | local-mock | 200, 회귀 없음 |
| 8 | `GET /api/v1/tour/contents/126508?contentTypeId=14` (v0.4) | local-mock | 404 `TOUR_CONTENT_NOT_FOUND`(실제 유형 12와 다름). 연속 요청해도 404(예외 미캐시), 이어서 `contentTypeId=12`는 200 |
| 9 | `.../126485?contentTypeId=15`, `.../126508?contentTypeId=39`, `.../125476?contentTypeId=32` (v0.4) | local-mock | 200, `contentTypeName` 각각 "축제 · 행사"·"음식점"·"숙박" (목은 즐기기 유형을 요청값으로 반환) |

#8·#9 결과는 분석 문서 9.1에 기록되어 있다(모두 기대대로).

### 8.3 L2 UI 체크리스트

**TravelDetailPage**
- [ ] `/destinations/detail/bijarim` → 기존과 같은 화면, `/api/v1/tour/contents` 요청 0건
- [ ] `/destinations/detail/daejeon-bread` → 기존 코스 상세
- [ ] `/destinations/detail/no-such` → 상세 not-found 문구, 요청 0건
- [ ] `/destinations/detail/126508?type=99` → not-found, 요청 0건
- [ ] `/destinations/detail/126508` (local-mock) → 로딩 카드 → 경복궁. 기본 이미지, 갤러리 1장, 요약·추가 사진·주변 숨김, overview 줄바꿈 표시, `<br>` 문자열 노출 없음, "상세 이용 정보가 없습니다" 표시
- [ ] `/destinations/detail/999999999` → not-found
- [ ] 백엔드 중지 → 오류 카드 → 백엔드 시작 → 다시 시도 → 성공
- [ ] 목업 상세의 주변 카드로 이동 → 저장 버튼·사진 위치 초기화
- [ ] 저장 누른 상태에서 다른 상세로 이동한 뒤 뒤로 가기 → 저장 해제 상태 (서버 저장이 없으므로 의도된 동작)

**EnjoyDetailPage**
- [ ] `/enjoy/food/jeonju-bibimbap` → 기존 화면
- [ ] `/enjoy/food/no-such` → not-found (기존에는 첫 항목 표시)
- [ ] `/enjoy/nope/1` → not-found (app-safety-net 동작 유지)
- [ ] `/enjoy/festivals/126485` (local-mock) → 비자림, `contentTypeId=15`로 요청됨, 커버는 `config.cover`
- [ ] 추천 카드로 이동 → 저장 버튼 초기화

**홈** (local-mock)
- [ ] 추천 여행지 카드 → `/destinations/detail/{id}?type=12` → 카드와 같은 제목
- [ ] 여행을 더 즐겁게 카드 → 유형별 경로(local-mock은 모두 12이므로 여행지 상세) → 카드와 같은 제목
- [ ] 이번 주 여행 소식 카드 → 전체 새로고침 없음(네트워크 탭에 `/api/v1/home` 재요청 없음) → 같은 제목

**공통**
- [ ] 360px 폭에서 로딩·오류·not-found·API 상세에 가로 스크롤 없음
- [ ] 로딩·오류 카드가 스크린 리더에 전달됨(`role` 확인)
- [ ] (v0.3) 백엔드 중지 → 오류 카드 → 키보드로 다시 시도 → 다시 실패 → 제목에 포커스, Tab 한 번에 "다시 시도"
- [ ] (v0.3) 홈을 아래로 스크롤한 뒤 카드 클릭 → 상세가 맨 위에서 열림. 뒤로 가기 → 홈의 이전 위치 복원
- [ ] (v0.3) 번호가 2개인 문의처 → 텍스트만, 여행지 라벨 "문의"
- [ ] (v0.3) 대표 이미지 URL을 깨뜨림(개발자 도구) → 기본 이미지로 한 번 교체, 네트워크 요청 반복 없음
- [ ] (v0.3) `/destinations/detail/126508?type=0xc`, `?type=12.0`, `?type=%2012` → not-found, 요청 0건
- [ ] `npm run build`, `npx eslint .` 오류 0

---

## 9. 구조

| 구성요소 | 계층 | 위치 |
|----------|------|------|
| TravelDetailPage, EnjoyDetailPage | 화면(라우트) + 같은 파일의 View | `src/pages/` |
| TourApiDetail, DetailStatus | 상세 공통 UI | `src/components/detail/` (신규 폴더) |
| useTourDetail | 훅 | `src/hooks/` (신규 폴더) |
| fetchTourDetail, toTourDetail, toPlainText | API 도메인 모듈 | `src/api/tourApi.js` |
| 유형 매핑, `isTourContentId`, `getTourDetailPath` | 설정 | `src/data/tourContentTypes.js` |

의존 방향은 화면 → 훅 → API 모듈 → client다. 화면은 상세 API URL을 직접 쓰지 않는다. `components/detail`은 목업을 import하지 않는다.

**`tourContentTypes.js` 공개 계약**

```js
export const DESTINATION_CONTENT_TYPES = { attraction: 12, culture: 14 }
export const ENJOY_CONTENT_TYPES = { festivals: 15, leports: 28, food: 39, shopping: 38, stay: 32 }
export function isTourContentId(id)                 // /^\d{1,12}$/
export function isDestinationContentType(typeId)    // 12 | 14 (숫자). getTourDetailPath가 사용
export function getEnjoyContentType(category)       // number | null. Object.hasOwn으로 프로토타입 키 차단 (v0.3, A-1)
export function getTourDetailPath(contentId, contentTypeId) // string | null
```

**`tourApi.js` 공개 계약**

```js
export async function fetchTourDetail(contentId, contentTypeId) // → view model, 실패 시 ApiError 또는 Error
export function toTourDetail(data)                              // 내부용이지만 테스트 가능하게 export
export function toPlainText(value)
export function toTelHref(contact)                              // string | null (v0.3, §3.2. 두 View가 사용, C-1)
```

---

## 10. 코딩 규칙

- 기존 스타일을 유지한다: 세미콜론 없음, 작은따옴표, 한국어 주석
- 주요 결정 지점에 `// Design Ref: §N — 이유` 주석을 단다
- 새 의존성을 추가하지 않는다
- 수정하는 JSX는 읽을 수 있게 줄을 나눈다. 옮기기만 하는 기존 한 줄 JSX는 재포맷하지 않는다(diff 최소화)
- 수정 금지: `NotFoundPage.jsx`, `StatusPage.css`, `api/client.js`, `docs/**/app-safety-net*`

---

## 11. 파일별 변경 목록

두 구현 에이전트가 같은 파일을 수정하지 않도록 소유자를 나눈다.

### 11.1 frontend-support-backend 소유 (백엔드만)

| 파일 | 구분 | 명세 |
|------|------|------|
| `tour/exception/TourContentNotFoundException.java` | 신규 | BE-1 |
| `tour/exception/TourExceptionHandler.java` | 수정 | BE-2 |
| `tour/client/TourApiClientImpl.java` | 수정 | BE-3 |
| `tour/service/TourDetailService.java` | 수정 | BE-4 |
| `tour/client/MockTourApiClient.java` | 수정 | BE-5 |

### 11.2 frontend-lead 소유 (프론트만)

| 파일 | 구분 | 내용 |
|------|------|------|
| `src/data/tourContentTypes.js` | 신규 | §9 계약 |
| `src/api/tourApi.js` | 신규 | `fetchTourDetail`, `toTourDetail`, `toPlainText`, `toTelHref` |
| `src/hooks/useTourDetail.js` | 신규 | §2.4 |
| `src/components/detail/DetailStatus.jsx` | 신규 | §5.1 |
| `src/components/detail/DetailStatus.css` | 신규 (v0.3) | 오류 카드 제목 포커스 스타일. 버튼 보정은 필요 없어 v0.2 구현에서는 만들지 않았다(C-8) |
| `src/components/detail/TourApiDetail.jsx` | 신규 | §5.1 |
| `src/components/detail/detailMessages.js` | 신규 | §5.1 문구 상수 (C-2) |
| `src/components/common/ScrollToTop.jsx` | 신규 (v0.3) | §5.4 |
| `src/App.jsx` | 수정 (v0.3) | `BrowserRouter` 아래에 `ScrollToTop` 추가 |
| `src/pages/TravelDetailPage.jsx` | 수정 | 해석 함수, 라우트/View 분리, key, 출처별 섹션 |
| `src/pages/TravelDetailPage.css` | 수정 | `detail-gallery--single`, `--api`의 `pre-line` |
| `src/pages/EnjoyDetailPage.jsx` | 수정 | `config.items[0]` fallback 제거, 해석 함수, key, 출처별 섹션 |
| `src/pages/EnjoyDetailPage.css` | 수정 | `--api`의 `pre-line`, 커버 문구 말줄임 |
| `src/components/home/ThemeDestinationSection.jsx` | 수정 | §5.3 |
| `src/components/home/WeeklyNewsSection.jsx` | 수정 | §5.3, `<a>` → `Link` |
| `src/components/home/RecommendedDestinationSection.jsx` | 수정 | §5.3 |

---

## 12. 구현 순서와 병렬화

### 12.1 병렬 가능 여부

**가능하다.** 파일이 겹치지 않고(§11), API 계약이 §4.2에 확정되어 있다.

```
시간 →
frontend-support-backend : BE-1 → BE-2 → BE-3 → BE-4 → BE-5 → BE-6(컴파일, L1)
frontend-lead            : F-1 → F-2 → F-3 → F-4 → F-5 → F-6(build, lint)
                                                                         ↘
                                                    (둘 다 완료) → F-7 L2 확인 → 리뷰·gap 분석
```

### 12.2 프론트가 백엔드 404 계약에 의존하는 지점

| 지점 | 의존 내용 | 백엔드 완료 전 동작 | 완료 전 개발 방법 |
|------|-----------|---------------------|-------------------|
| `useTourDetail`의 `isNotFoundError` | 없는 id가 **404**로 온다는 계약 | 502 → `error` 상태 (다른 장소를 보여 주지 않으므로 안전) | 계약대로 404/400 → not-found로 구현. 수정 없이 백엔드 완료 후 동작 |
| API 성공 경로 확인 | `local-mock` 상세 응답(BE-5) | `local-mock`은 NPE로 500 → `error` | 실제 키가 있으면 기본 프로필로 확인. 없으면 성공 경로 L2는 BE-5 이후 |
| 홈 → 상세 L2 | BE-5 + 프론트 홈 링크 | 동일 | 백엔드 완료 후 |
| 오류·로딩 UI | 없음 (백엔드 중지 상태로 재현) | - | 바로 확인 가능 |
| 해석 단계 not-found, 목업 회귀 | 없음 (API 호출 안 함) | - | 바로 확인 가능 |

프론트 코드는 404 계약만 전제하고, 오류 `code` 문자열에는 의존하지 않는다. 그래서 백엔드 구현 세부가 바뀌어도 상태 코드만 지키면 영향이 없다.

### 12.3 프론트 구현 순서 (frontend-lead)

1. [ ] F-1 `tourContentTypes.js`, `tourApi.js`
2. [ ] F-2 `useTourDetail`, `DetailStatus`, `TourApiDetail`
3. [ ] F-3 `EnjoyDetailPage`: fallback 제거, 해석, key, 출처별 섹션, CSS (구조가 단순해 먼저)
4. [ ] F-4 `TravelDetailPage`: `TravelDetailView` 분리, 해석, key, 출처별 섹션, CSS
5. [ ] F-5 홈 섹션 3곳 링크
6. [ ] F-6 `npm run build`, `npx eslint .`, 해석 단계·오류 UI 확인
7. [ ] F-7 (백엔드 완료 후) §8.3 전체

### 12.4 이후 단계

frontend-code-reviewer 리뷰와 bkit gap 분석을 거쳐 frontend-lead가 문제를 수정한다. 완료 보고서를 쓴 뒤 frontend-interview-coach가 포트폴리오 자료를 추출한다.

---

## 13. 후속 과제 (이번 범위 밖)

- 목록·검색 페이지 API 전환 → 완료되면 해석 함수의 목업 분기와 View의 목업 섹션 삭제
- 여행코스 상세(contentTypeId 25) API와 홈 추천 코스 링크
- `TourDetailService` 좌표 순서 (`mapx` = 경도)
- 실제 주변 여행지(locationBasedList), 사진(detailImage2), 지도
- `EnjoyCategoryPage` 카테고리 변경 시 필터·페이지 유지 버그 (진단 2.5절)
- `TravelEnjoyPage`의 배열 인덱스 기반 slug 결합을 데이터 id로 교체
- `client.js` AbortSignal 지원
- 로딩 스켈레톤 (지금은 상태 카드)
- `TourExceptionHandler`와 `GlobalExceptionHandler`의 `IllegalArgumentException` 처리 중복
- `local-mock` 목록이 요청 유형과 관계없이 `contenttypeid "12"`를 반환하는 문제

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-24 | 초안 (`detail-not-found`, 추천안 C) | WOOJIN |
| 0.2 | 2026-09-24 | D-1 ~ D-6 결정 반영, 기능명 변경, 백엔드 명세 BE-1 ~ 6, 프론트 모듈·key·경쟁 조건, 파일 소유 분리, 구현 순서와 병렬화 | WOOJIN |
| 0.3 | 2026-09-24 | 분석 문서 8장 역반영 1 ~ 9(`toTelHref`·`getEnjoyContentType` 계약, 의존성, `meta`, 텍스트 정리 규칙, `detailMessages.js`, §5.2 표 보강, §11.2). 코드 리뷰·gap 수정 반영: 전화 링크 규칙 재정의(§3.2, MF-1), 스크롤 초기화를 이번 범위로 이동(§5.4, MF-2), 재시도 실패 시 오류 카드 포커스(§5.1, SI-2), 400 `console.warn`(§2.4, SI-3), 이미지 로드 실패 대체(§5.2, SI-4), `?type=` 문자열 비교(§2.2, G-01), `<br>` 뒤 개행 치환(§3.2, N-5), 빈 소개 문구 상수(§5.1, N-1) | WOOJIN |
| 0.3.1 | 2026-09-24 | 2차 리뷰 MF-A: `toTelHref` 후보를 한국 전화번호 형태로 좁힘(lookbehind/lookahead, 번호 안 공백·괄호 제한), 번호 밖 4자리 이상 숫자가 남으면 null. §3.2 규칙과 입력별 결과 표 갱신 | WOOJIN |
| 0.4 | 2026-09-24 | 분석 문서 11.6 역반영 1 ~ 7: BE-4 실제 유형 검증(`validateActualContentType`)과 BE-5 목 유형 반환 규칙(§4.3, G-09), 요청 유형 ≠ 실제 유형 → 404 행(§4.2, §6), L1 #8·#9(§8.2), `?type=` 없는 문화시설 id는 not-found(§2.2 D-4), 즐기기 커버 이미지 대체는 목업·API 공통(§5.2, A-10), `~` 범위 번호 판정의 공백 허용 명시(§3.2 규칙 3, A-11) | WOOJIN |
