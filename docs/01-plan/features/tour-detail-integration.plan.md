# tour-detail-integration 계획 문서

> **요약**: 상세 페이지가 목업에 없는 id를 첫 번째 목업으로 바꿔 보여 주는 문제를 고친다. 목업 id는 목업으로, TourAPI contentId는 실제 상세 API로, 둘 다 아니면 not-found 화면으로 처리한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-24
> **상태**: Approved (8장 사용자 결정 D-1 ~ D-6 반영, 2026-09-24)
> **출처**: `docs/development/waylog-renewal.md` 2.3절(잘못된 fallback, Must Fix 4), 2.5절(route param 변경 시 이전 state 유지)
> **이전 이름**: `detail-not-found`(진단 Must Fix 4). 작업의 중심이 상세 API 연동이 되어 D-6에서 `tour-detail-integration`으로 바꿨다.

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 홈의 "여행을 더 즐겁게"와 "이번 주 여행 소식" 카드는 TourAPI contentId(숫자)를 상세 URL로 넘긴다. 상세 페이지는 목업(slug id)에서만 찾기 때문에 **홈에서 상세로 가는 클릭은 모두 다른 장소**(비자림 또는 부산 바다축제)를 보여 준다. 음식점·숙박 카드는 관광지 상세 경로로 가서 유형까지 틀린다. |
| **해결** | 상세 페이지의 id 해석 규칙을 "목업 id → 목업, 숫자 contentId → `GET /api/v1/tour/contents/{id}`, 그 외 → not-found"로 바꾼다. API 경로에는 로딩·오류(재시도)·없음 상태를 둔다. 홈 카드는 콘텐츠 유형에 맞는 상세 경로로 보낸다. 백엔드는 없는 콘텐츠를 502가 아닌 404로 응답한다. |
| **기능/UX 효과** | 사용자가 누른 카드와 같은 장소가 상세에 표시된다. 잘못된 주소는 다른 장소 대신 "콘텐츠를 찾을 수 없습니다"를 보여 준다. 상세 간 이동 시 이전 장소의 저장 상태나 사진 위치가 남지 않는다. |
| **핵심 가치** | 가장 눈에 띄는 핵심 흐름(홈 → 상세)의 신뢰성을 복구한다. 목록 페이지는 아직 목업이라 한 번에 API로 전환할 수 없는 상황에서, 데이터 출처를 한곳에서 해석하는 점진적 전환 구조와 비동기 상태 모델(loading/success/not-found/error)을 면접에서 설명할 수 있다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 홈에서 상세로 가는 클릭이 100% 다른 장소를 보여 주고, 잘못된 주소도 조용히 다른 콘텐츠로 대체된다 |
| **WHO** | 홈에서 추천 카드를 눌러 상세를 보는 모든 방문자, 공유 링크나 직접 입력한 주소로 들어오는 사용자 |
| **RISK** | 404만 적용하면 홈 클릭이 전부 404가 됨 / 목업과 API 두 출처 혼재로 코드 복잡도 증가 / TourAPI의 "없는 콘텐츠" 응답 형태 미검증 / TourAPI 일일 호출 제한 / overview의 HTML 태그 |
| **SUCCESS** | 홈 카드 제목과 상세 제목 일치 / 목록 → 상세 회귀 없음 / 잘못된 id는 API 호출 없이 not-found / 없는 contentId는 404 → not-found / 서버 오류는 재시도 가능 / id 변경 시 이전 상태 없음 |
| **SCOPE** | 프론트: TravelDetailPage, EnjoyDetailPage, 홈 ThemeDestinationSection·WeeklyNewsSection, 신규 tourApi·useTourDetail·콘텐츠 유형 매핑 / 백엔드: 상세 not-found 404, local-mock 상세 응답 |

---

## 1. 개요

### 1.1 목적

상세 페이지가 "요청한 콘텐츠"만 보여 주도록 한다. 그 콘텐츠를 찾을 수 없으면 대체 콘텐츠를 보여 주지 않고 사용자에게 사실대로 알린다.

### 1.2 배경 (코드 확인 결과)

**상세 페이지와 id 조회 방식**

| 라우트 | 컴포넌트 | 데이터 | id 조회 | id가 없을 때 |
|--------|----------|--------|---------|--------------|
| `/destinations/detail/:id` | `TravelDetailPage` | `destinationMocks.allDestinationMocks` (관광지 4, 문화 3, 코스 3) | `find(entry => entry.id === id)` (`TravelDetailPage.jsx:13`) | `allDestinationMocks[0]`(비자림) 표시 |
| 같은 라우트, `item.stops`가 있을 때 | `TravelCourseDetailPage` (별도 라우트 없음, `TravelDetailPage.jsx:25`에서 렌더링) | 코스 목업 | 부모가 넘긴 `item` | 부모의 fallback을 따름 |
| `/enjoy/:category/:id` | `EnjoyDetailPage` → `EnjoyDetailContent` | `enjoyMocks.enjoyConfigs` (5개 카테고리, 18개) | `findEnjoyItem(category, id)` (`EnjoyDetailPage.jsx:31`) | 카테고리가 없으면 `NotFoundPage`(app-safety-net), 카테고리는 있고 id가 없으면 `config.items[0]` 표시 |

상세 페이지 세 곳 모두 API를 호출하지 않는다. 목업 id는 모두 `bijarim`, `busan-sea` 같은 slug다.

**상세로 들어오는 진입점**

| 진입점 | 위치 | 이동 경로 | 넘기는 id | 목업에 있음? | 현재 결과 |
|--------|------|-----------|-----------|:---:|-----------|
| 홈 · 추천 여행지 | `RecommendedDestinationSection.jsx:51` | `/destinations/attractions` (목록) | 없음 | - | 상세로 가지 않음. 누른 장소가 없는 목업 목록으로 이동 |
| 홈 · 추천 여행코스 | `RecommendedCourseSection.jsx` | 링크 없음 | - | - | 클릭 불가 |
| 홈 · 여행을 더 즐겁게 | `ThemeDestinationSection.jsx:148` (`Link`) | `/destinations/detail/{contentId}` | TourAPI contentId (숫자), 유형 15·28·39·38·32 | **없음** | **항상 비자림.** 축제·음식점·숙박도 관광지 상세 경로로 감 |
| 홈 · 이번 주 여행 소식 | `WeeklyNewsSection.jsx:122` (`<a href>`) | `/enjoy/festivals/{contentId}` | TourAPI contentId (숫자) | **없음** | **항상 부산 바다축제.** `<a>`라서 전체 새로고침(홈 API·세션 복원 재요청) |
| 여행지 카탈로그 | `DestinationCatalogPage.jsx:63` | `/destinations/detail/{id}` | slug | 있음 | 정상 |
| 여행지 검색 결과 | `DestinationSearchResultsPage.jsx:18` | `/destinations/detail/{id}` | slug | 있음 | 정상 |
| 여행지 상세 · 주변 | `TravelDetailPage.jsx:49` | `/destinations/detail/{id}` | slug | 있음 | 내용은 정상, 이전 state 유지(아래) |
| 여행 즐기기 · 소식 | `TravelEnjoyPage.jsx:117` | `/enjoy/festivals/{slug}` | 배열 인덱스로 고른 slug 3개 | 있음 | 정상 (인덱스 결합이라 취약) |
| 여행 즐기기 · 카테고리 카드 | `TravelEnjoyPage.jsx:81` | `/enjoy/{category}/{slug}` | 인덱스+오프셋으로 고른 slug 15개 | 있음 (카드 수 4·4·3·4와 일치 확인) | 정상 (취약) |
| 즐기기 카테고리 목록 | `EnjoyCategoryPage.jsx:40` | `/enjoy/{category}/{id}` | slug | 있음 | 정상 |
| 즐기기 검색 결과 | `EnjoySearchResultsPage.jsx:28` | `/enjoy/{category}/{id}` | slug | 있음 | 정상 |
| 즐기기 상세 · 함께 살펴볼 정보 | `EnjoyDetailPage.jsx:42` | `/enjoy/{category}/{id}` | slug | 있음 | 내용은 정상, 이전 state 유지 |
| 직접 입력·오래된 공유 링크 | - | 임의 | 임의 | 없음 | 첫 번째 목업이 조용히 표시됨 |

**판단: 홈에서 상세로 가는 경로는 모두 목업에 없는 id다.** 홈 API는 기본 프로필에서 실제 TourAPI contentId를, `local-mock` 프로필에서도 숫자 id(`126508`, `126485`, `125476`)를 준다. 두 프로필 모두 slug와 겹치지 않는다. 따라서 fallback을 404로만 바꾸면 홈의 상세 링크 두 섹션이 **전부 404**가 된다. 지금은 "틀린 장소"가 나오고, 바꾼 뒤에는 "항상 없음"이 나온다. 정확하긴 하지만 핵심 흐름이 막힌 것처럼 보인다.

**백엔드 상세 API (이미 있음)**

- `GET /api/v1/tour/contents/{contentId}?contentTypeId={12|14|15|28|32|38|39}` (`TourDetailController`), `SecurityConfig:63`에서 GET permitAll
- 응답 `TourDetailResponse { contentId, contentTypeId, contentTypeName, title, image, address, overview, latitude, longitude, detailInfos[{label, value}] }`
- `contentTypeId`는 필수다. 코스(25)는 지원하지 않는다.
- 서버 Caffeine 캐시(`tourLists`, 키 `detail:{id}:{type}`)가 있다.
- **없는 contentId**: `extractDetailCommon`이 `TourApiException("EMPTY_DETAIL_COMMON_RESPONSE")`를 던지고, `TourExceptionHandler`가 **502**로 응답한다. 응답 body가 비었을 때(실제 외부 장애)도 같은 코드를 쓰므로 프론트는 "없음"과 "장애"를 구분할 수 없다.
- **`local-mock` 프로필**: `MockTourApiClient.getDetailCommon`이 `null`을 반환하고, `TourDetailService`가 `common.contentid()`에서 NPE를 일으켜 500이 된다. API 키 없이 개발할 때는 상세 API를 쓸 수 없다.
- (참고, 범위 밖) `TourDetailService`가 `mapx`(경도)를 `latitude`에, `mapy`(위도)를 `longitude`에 넣는다. 아직 지도를 쓰지 않으므로 후속 과제로 남긴다.

**route param 변경 시 이전 state가 남는 문제 (진단 2.5절)**

- `TravelDetailPage`의 `saved`, `nearbyBookmarks`, `photoIndex`, `slideMotion`, 그리고 `EnjoyDetailContent`의 `saved`는 같은 라우트 안에서 id만 바뀌면 초기화되지 않는다. 주변·추천 카드 링크가 바로 이 이동을 만든다.
- API 조회를 추가하면 같은 구조에서 **이전 장소의 데이터가 새 id와 함께 잠깐 보이거나, 늦게 온 이전 응답이 새 화면을 덮어쓰는** 문제가 생긴다. 이 기능과 직접 겹치므로 **범위에 포함한다.**
- `EnjoyCategoryPage.jsx:23-26`의 같은 문제(카테고리 변경 시 필터·페이지 유지)는 목록 화면이라 범위 밖으로 둔다.

### 1.3 관련 문서

- 진단: `docs/development/waylog-renewal.md` (2.3, 2.5절, Must Fix 4)
- 선행 기능: `docs/01-plan/features/app-safety-net.plan.md`, `docs/02-design/features/app-safety-net.design.md` (§5.1 NotFoundPage `title`·`description` props, "MF-4에서 재사용")
- 작업 규칙: `CLAUDE.md`

---

## 2. 범위

### 2.1 포함

- [ ] 상세 id 해석 규칙: 목업 id → 목업 / 숫자 contentId → 상세 API / 그 외 → not-found (API 호출 없음)
- [ ] 상세 API 연동: 로딩, 오류(재시도), 없음(404) 상태
- [ ] API 콘텐츠에서는 목업용 하드코딩 값(전화번호 `064-710-7912`, 이용시간 `09:00 - 18:00` 등)을 표시하지 않고 `detailInfos`를 표시
- [ ] 상세 페이지의 id 변경 시 이전 state와 늦게 도착한 응답 차단 (TravelDetailPage, EnjoyDetailPage)
- [ ] 홈 "여행을 더 즐겁게": 콘텐츠 유형에 맞는 `/enjoy/{category}/{contentId}` 경로로 이동
- [ ] 홈 "이번 주 여행 소식": `<a href>` → `Link`
- [ ] not-found 화면은 `NotFoundPage` props로 상세 전용 문구 사용 (NotFoundPage 코드 수정 없음)
- [ ] 백엔드: 없는 콘텐츠 404 + `code`, `local-mock` 프로필 상세 응답 (frontend-support-backend)
- [ ] 페이지 이동 시 스크롤 맨 위로 이동(앱 전체). v0.3에서 추가: 홈 카드 링크를 `Link`로 바꾸면서 상세가 이전 스크롤 위치에서 열리는 회귀가 생겨, 코드 리뷰 MF-2로 이번 범위에 포함했다(설계 §5.4)

### 2.2 제외

- 목록·검색 페이지의 API 전환(카탈로그, 검색 결과, 즐기기 카테고리). 이 페이지들은 목업 slug를 계속 쓴다.
- 여행코스 상세 API(contentTypeId 25, `TravelCourseDetailPage`)와 홈 추천 코스 카드 링크
- 실제 "주변 여행지"(TourAPI locationBasedList), 사진 갤러리(detailImage2), 지도 연동, 좌표 순서 수정
- 저장(북마크) 버튼의 서버 연동. 현재처럼 화면 로컬 상태로 둔다
- 서버 상태 라이브러리(TanStack Query) 도입, `client.js`의 AbortSignal 지원
- `TravelEnjoyPage`의 인덱스 기반 slug 결합 정리 (현재 정상 동작, 후속)

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | 상세 id가 목업에 있으면 지금처럼 목업을 표시한다 (목록 → 상세 회귀 없음) | High | frontend-lead | Pending |
| FR-02 | id가 목업에 없고 TourAPI contentId 형식(숫자)이면 `GET /api/v1/tour/contents/{id}?contentTypeId=`로 조회한다 | High | frontend-lead | Pending |
| FR-03 | 둘 다 아니거나 유형을 정할 수 없으면 API를 호출하지 않고 상세 not-found 화면을 표시한다. 첫 번째 목업으로 대체하지 않는다 | High | frontend-lead | Pending |
| FR-04 | API 조회 중에는 로딩 상태, 404(없는 콘텐츠)는 not-found, 그 밖의 실패는 오류 상태와 "다시 시도"를 표시한다 | High | frontend-lead | Pending |
| FR-05 | API 콘텐츠에서는 목업용 하드코딩 값과 데이터 없는 섹션(추가 사진 슬라이더, 무관한 주변 목업)을 표시하지 않는다. 이용 정보는 `detailInfos`로 표시한다 | High | frontend-lead | Pending |
| FR-06 | TourAPI 텍스트(overview, detailInfos 값)의 HTML 태그는 줄바꿈·텍스트로 정리해 표시한다. `dangerouslySetInnerHTML`은 쓰지 않는다 | Medium | frontend-lead | Pending |
| FR-07 | 같은 상세 라우트에서 id가 바뀌면 저장 상태·사진 위치·조회 상태를 초기화하고, 이전 id의 늦은 응답은 무시한다 | High | frontend-lead | Pending |
| FR-08 | 홈 "여행을 더 즐겁게" 카드는 `contentTypeId`에 맞는 상세로 이동한다: 15·28·39·38·32 → `/enjoy/{category}/{contentId}`, 12·14 → `/destinations/detail/{contentId}?type=`, 그 외 → `/enjoy` | High | frontend-lead | Pending |
| FR-09 | 홈 "이번 주 여행 소식" 카드는 `Link`로 이동한다 (전체 새로고침 제거) | Medium | frontend-lead | Pending |
| FR-10 | (D-3) 홈 "추천 여행지" 카드는 목록 대신 `/destinations/detail/{contentId}?type=12`로 이동한다 | Medium | frontend-lead | Pending |
| FR-11 | 백엔드: 공통 상세 데이터가 없으면 404 + `{ code: "TOUR_CONTENT_NOT_FOUND", message, timestamp }`. 외부 응답 이상은 기존처럼 502 | High | frontend-support-backend | Pending |
| FR-12 | 백엔드: `local-mock` 프로필에서 목 홈 id(`126508` 경복궁, `126485` 비자림, `125476` 경포해변)는 상세를 반환하고, 그 외 id는 FR-11과 같은 404 | Medium | frontend-support-backend | Pending |

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 정확성 | 어떤 경로로 들어와도 "요청한 id와 다른 콘텐츠"를 표시하지 않음 | L2 시나리오 |
| 안정성 | id 변경·빠른 연속 클릭에도 마지막 id의 결과만 표시 | 코드 리뷰, L2 |
| 보안 | 외부 API 문자열을 HTML로 해석하지 않음 | 코드 확인 |
| 접근성 | 로딩·오류 안내가 스크린 리더에 전달됨(`role="status"`/`role="alert"`), 재시도는 `<button>` | 코드 확인 |
| 반응형 | 로딩·오류 카드가 360px 폭에서 가로 스크롤 없음 (기존 `StatusPage.css` 재사용) | 브라우저 확인 |
| 유지보수 | 목업/API 분기는 페이지 한 곳의 해석 함수에만 존재. 목록이 API로 전환되면 목업 분기만 삭제 | 코드 구조 확인 |
| 호출량 | 목업·잘못된 id는 API 호출 0회. 상세 1회 진입당 API 1회 (StrictMode 개발 이중 호출 제외) | 네트워크 탭 |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] FR-01 ~ FR-12 구현
- [ ] 홈 "여행을 더 즐겁게"·"이번 주 여행 소식" 카드를 누르면 카드와 같은 제목의 상세가 표시됨 (기본 프로필 + 실제 키, 또는 `local-mock`)
- [ ] `/destinations/detail/no-such-place`, `/enjoy/food/no-such-food` → API 호출 없이 not-found
- [ ] `/destinations/detail/999999999` → 404 → not-found
- [ ] 백엔드 중지 상태에서 숫자 id 상세 → 오류 + 다시 시도 → 백엔드 재시작 후 재시도 성공
- [ ] 상세의 주변·추천 카드로 이동하면 저장 버튼이 초기 상태, 이전 제목이 보이지 않음
- [ ] 목록·검색 → 상세 회귀 없음
- [ ] 프론트 `npm run build`, `npx eslint .` 오류 0, 백엔드 컴파일 성공
- [ ] frontend-code-reviewer 리뷰 Must Fix 0건, bkit gap 분석 Match Rate 90% 이상

### 4.2 품질 기준

- [ ] 린트 오류 0, 빌드 성공
- [ ] 상세 API L1 curl 시나리오 통과 (설계 §8.2)

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 404만 적용하면 홈 상세 링크가 전부 404 | High | 확정 | 선택지 A 대신 C(API 연동 포함)를 추천 |
| 목업과 API 두 출처가 한 페이지에 섞여 코드가 복잡해짐 | Medium | High | 해석 함수 하나와 공통 view model로 분기를 격리. 목록 API 전환 시 목업 분기 삭제 |
| TourAPI가 없는 contentId에 실제로 어떤 응답을 주는지 미검증 (빈 items 추정) | Medium | Medium | 실제 키로 curl 확인(백엔드 Do 단계). 다르면 not-found 판정 조건을 백엔드에서 보완 |
| TourAPI 개발 계정 일일 1,000회 제한 (상세 1회 = 외부 2회) | Medium | Low | 서버 Caffeine 캐시 유지, 목업·잘못된 id는 호출하지 않음, 개발은 `local-mock` 우선 |
| overview·detailInfos에 `<br>` 등 HTML 포함 | Low | High | 텍스트 정리 함수 + `white-space: pre-line` |
| API 이미지 없음(`image: null`) | Low | Medium | 로컬 기본 이미지 사용 |
| id 변경 시 이전 응답이 새 화면을 덮어씀 | Medium | Medium | 콘텐츠 컴포넌트에 `key`, effect cleanup의 `isActive` 플래그 |
| app-safety-net 에이전트와 파일 충돌 | Low | Low | `NotFoundPage.jsx`, `StatusPage.css`, app-safety-net 문서는 수정하지 않고 사용만 함 |

---

## 6. 영향 분석

### 6.1 변경 자원

| 자원 | 유형 | 변경 내용 |
|------|------|-----------|
| `TravelDetailPage.jsx` | 화면 | 해석 함수로 분기, 콘텐츠를 `key`가 있는 하위 컴포넌트로 분리, view model로 렌더링 |
| `EnjoyDetailPage.jsx` | 화면 | `config.items[0]` fallback 제거, 해석 함수로 분기, `EnjoyDetailContent`에 `key` |
| `ThemeDestinationSection.jsx` | 홈 섹션 | 링크 경로를 유형별 `/enjoy/{category}/{contentId}`로 |
| `WeeklyNewsSection.jsx` | 홈 섹션 | `<a>` → `Link` |
| `RecommendedDestinationSection.jsx` | 홈 섹션 | (D-3) 목록 → 상세 링크 (`<a>` → `Link`) |
| `src/api/tourApi.js` | API 도메인 모듈 | 신규. `fetchTourDetail`, 응답 → view model 변환 |
| `src/hooks/useTourDetail.js` | 훅 | 신규. 상세 조회 상태 머신, 재시도 |
| `src/data/tourContentTypes.js` | 설정 | 신규. 카테고리 slug ↔ contentTypeId |
| `src/components/detail/DetailStatus.jsx` | 공통 UI | 신규. 로딩·오류 카드 (`StatusPage.css` 클래스 재사용) |
| `src/components/detail/TourApiDetail.jsx` | 공통 UI | 신규. 훅 호출 + 상태별 렌더링 |
| `TravelDetailPage.css`, `EnjoyDetailPage.css` | 스타일 | API 콘텐츠용 수정자 클래스 (`pre-line`, 단일 갤러리) |
| `TourExceptionHandler`, `TourApiClientImpl`, `TourDetailService`, 신규 `TourContentNotFoundException` | 백엔드 | 없는 콘텐츠 404 |
| `MockTourApiClient` | 백엔드 (local-mock) | 상세 목 응답 |

### 6.2 현재 사용처

| 자원 | 동작 | 코드 경로 | 영향 |
|------|------|-----------|------|
| `allDestinationMocks` | 상세 조회 | `TravelDetailPage.jsx:13` | 조회 결과 없을 때 동작 변경 (fallback 제거) |
| `findEnjoyItem` | 상세 조회 | `EnjoyDetailPage.jsx:31` | 동일 |
| `TravelCourseDetailPage` | 코스 목업 렌더링 | `TravelDetailPage.jsx:25` | 없음 (목업 경로 유지) |
| `NotFoundPage` | 404 | `App.jsx` `*`, `EnjoyCategoryPage`, `EnjoyDetailPage` | 없음 (props로 문구만 전달) |
| `/destinations/detail/:id` 링크 | 이동 | 카탈로그, 검색 결과, 상세 주변 | 없음 (slug는 목업 경로) |
| `/enjoy/:category/:id` 링크 | 이동 | TravelEnjoyPage, 카테고리, 검색, 상세 추천 | 없음 |
| `GET /api/v1/tour/contents/{id}` | 조회 | 현재 프론트 호출 없음 | 신규 사용 |
| `TourApiException` 502 처리 | 오류 응답 | 목록·홈·축제 API | 없음 (상세 not-found만 새 예외로 분리) |
| `enjoyConfigs` | 카테고리 설정 | 즐기기 페이지 전체 | 없음 (유형 매핑은 별도 파일) |

### 6.3 검증

- [ ] 6.2의 목업 경로 링크가 변경 후에도 같은 콘텐츠를 표시
- [ ] 홈·목록·축제 API의 오류 응답(502) 형식 변화 없음

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
|------|--------|------------|------|
| 처리 방향 | A 404만 / B 상세 전면 API / C 목업+API 혼합 해석 | C (D-1 결정) | A는 홈 링크 전부 404. B는 목록이 목업 slug라 목록 → 상세가 깨지므로 목록 전환까지 필요. 비교는 설계 §2.0 |
| 서버 상태 | 컴포넌트 state + 커스텀 훅 / TanStack Query | 커스텀 훅 | 기존 결정(auth-token-flow §7.2)과 일관. 의존성 추가 없음. 서버 캐시 존재 |
| id 변경 초기화 | `key`로 재마운트 / effect에서 수동 초기화 | `key` | state 전체를 한 번에 초기화, 누락 위험 없음 |
| not-found 판정 | 백엔드 404 / 프론트가 502 + `code` 해석 | 백엔드 404 | 같은 코드가 외부 장애에도 쓰여 프론트 해석으로는 구분 불가 |
| 여행지 상세 유형 전달 | URL `?type=` / 백엔드가 `contenttypeid`로 추론 | URL `?type=` (없으면 12) (D-4 결정) | 백엔드 계약 변경 없음 |

### 7.3 작업 분담 (CLAUDE.md bkit 협업 규칙)

```
frontend-support-backend : 상세 not-found 404, local-mock 상세 (FR-11, FR-12)
        ↓ (API 계약: 설계 §4)
frontend-lead            : 해석 규칙, tourApi, useTourDetail, 상세 2화면, 홈 링크 (FR-01~10)
        ↓
frontend-code-reviewer   : 코드 리뷰 (frontend-audit)
bkit gap-detector        : 설계 대비 gap 분석
        ↓
frontend-lead            : 발견된 문제 수정
        ↓
report → frontend-interview-coach : 포트폴리오 자료 추출
```

백엔드와 프론트는 파일이 겹치지 않으므로 병렬 진행이 가능하다. 프론트 L2의 404 시나리오만 백엔드 완료 후 확인한다.

---

## 8. 사용자 결정 (결정됨, 2026-09-24)

| ID | 질문 | 결정 | 반영 위치 |
|----|------|------|-----------|
| D-1 | 처리 방향 A / B / C | **C안 (목업 + API 해석)**. A·B 비교 근거는 설계 §2.0에 남김 | 전체 |
| D-2 | 백엔드 작업(404, local-mock 상세) 진행 여부 | **진행.** frontend-support-backend 담당. 없는 콘텐츠는 404 `TOUR_CONTENT_NOT_FOUND` | FR-11, FR-12, 설계 §4 |
| D-3 | 홈 "추천 여행지" 카드를 상세로 연결 | **연결** | FR-10, 설계 §5.3 |
| D-4 | 여행지 상세 유형 전달 방식 | **URL `?type=`** (백엔드 계약 유지, 없으면 12) | 설계 §2.2 |
| D-5 | API 콘텐츠에서 데이터 없는 섹션 숨김 | **숨김** (추가 사진 슬라이더, 주변 여행지) | FR-05, 설계 §5.2 |
| D-6 | 기능명 | **`tour-detail-integration`** (이전 이름 `detail-not-found`) | 문서명 |

---

## 9. 다음 단계

1. 설계 문서(`docs/02-design/features/tour-detail-integration.design.md`) 확정 (완료, v0.2)
2. 구현 (frontend-support-backend → frontend-lead, 병렬 가능)
3. 리뷰 + gap 분석 → 수정 → 완료 보고서 → frontend-interview-coach

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-24 | 초안 (진입점 분석, 추천안 C) | WOOJIN |
| 0.2 | 2026-09-24 | 사용자 결정 D-1 ~ D-6 반영, 기능명 변경, FR-08 경로 규칙 보완 (local-mock 목록 유형이 항상 12) | WOOJIN |
| 0.3 | 2026-09-24 | G-10: "페이지 이동 시 스크롤 맨 위로 이동"을 2.2 제외에서 2.1 포함으로 이동. 홈 링크의 `Link` 전환으로 생긴 회귀라 코드 리뷰 MF-2로 포함(설계 v0.3 §5.4) | WOOJIN |
