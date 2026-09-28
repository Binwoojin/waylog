# destination-list-integration 계획 문서

> **요약**: 여행지 카탈로그(관광지·문화시설)와 검색 결과, 검색 모달을 목업에서 실제 API(`/api/v1/search`, `/regions`, `/regions/districts`, `/classifications`)로 전환한다. 이로써 검색 → 목록 → 상세 흐름이 실제 데이터로 이어진다. 필터와 페이지는 URL에 둬서 상세에서 뒤로 와도 유지되게 한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-28
> **상태**: Approved (8장 사용자 결정 D-1 ~ D-8 반영, 2026-09-28) / v0.2: 설계 단계 결정(설계안 B, Q-1 ~ Q-6) 반영
> **근거**: frontend-lead 분석 (2026-09-28), `docs/04-report/features/tour-detail-integration.report.md` 후속 과제

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 상세는 실제 API와 연결됐지만 그 앞 단계인 목록과 검색은 목업이다. 카탈로그는 목업 3~4건을 45장으로 복제해 가짜 총 건수와 가짜 페이지를 보여 준다. 필터와 페이지가 로컬 state라 상세에서 뒤로 오면 초기화된다. 검색 모달은 지역이 '전체'뿐인 스텁이고, 전체 새로고침으로 이동한다. 로딩·에러·빈 상태도 없다. |
| **해결** | 목록 전용 훅 `useTourList`와 view model 변환(`toTourCard`)을 추가한다. 카탈로그와 검색 결과는 같은 목록 컴포넌트를 공유한다. 필터·정렬·페이지는 `useSearchParams`로 URL에 둔다. 검색 모달은 `/regions`·`/districts`·`/classifications`로 실제 조건을 고르고 `navigate()`로 이동한다. 요청 취소를 위해 `client.js`에 AbortSignal을 전달한다. |
| **기능/UX 효과** | 사용자가 고른 지역과 분류의 실제 여행지가 정확한 총 건수와 함께 보인다. 상세에서 뒤로 오면 보던 탭·지역·페이지가 그대로 있다. 로딩 중, 실패(재시도), 결과 없음(조건 초기화)을 구분해 보여 준다. |
| **핵심 가치** | 검색 → 목록 → 상세라는 핵심 탐색 흐름을 실제 데이터로 완성한다. URL을 단일 상태 원천으로 쓰는 설계, 요청 경쟁 조건 처리(AbortController), 외부 API 호출 한도를 고려한 UI 설계를 면접에서 설명할 수 있다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 목록과 검색이 목업이라 검색 → 목록 → 상세 흐름이 실제 데이터로 이어지지 않고, 필터 상태가 뒤로 가기에서 사라진다 |
| **WHO** | 지역·유형으로 여행지를 찾는 방문자, 상세를 보고 목록으로 돌아오는 사용자, 공유된 목록 URL로 들어오는 사용자 |
| **RISK** | TourAPI 일일 1,000회 한도 (특히 중분류 필터의 전체 조회) / 목업 탭과 API 분류 체계 불일치 / 늦게 도착한 응답이 최신 결과를 덮어씀 / 목업에 의존하는 상세 "주변 장소" 섹션 |
| **SUCCESS** | 카탈로그·검색 결과가 실제 API 데이터와 totalCount를 표시 / 필터·페이지가 URL에 반영되고 뒤로 가기로 복원 / 로딩·에러·빈 상태 구분 / 카드 → 상세 제목 일치 / 빠른 조건 변경에도 마지막 조건의 결과만 표시 |
| **SCOPE** | 프론트: client.js signal, tourApi 목록 함수·view model, useTourList, 공통 목록 컴포넌트, DestinationCatalogPage(관광지·문화), DestinationSearchResultsPage, SearchModal/TravelSearchModal, DestinationsPage 지역 카드 링크 / 백엔드: 중분류 조회 호출량 방어, arrange 검증 |

---

## 1. 개요

### 1.1 목적

여행지 목록과 검색 결과가 실제 여행지를 보여 주고, 사용자가 고른 조건이 URL로 유지되게 한다. 그래서 탐색 흐름(검색 → 목록 → 상세 → 뒤로)이 끊기지 않게 한다.

### 1.2 배경 (코드 확인 결과)

**화면별 현재 상태**

| 화면 | 라우트 | 현재 데이터 | 주요 문제 |
|------|--------|-------------|-----------|
| 여행지 랜딩 | `/destinations` | 파일 안 정적 데이터 (`DestinationsPage.jsx:41-72`) | 지역 카드 8개가 `<article>`이라 클릭해도 반응 없음 (`:99`) |
| 카탈로그 | `/destinations/attractions`, `/culture`, `/courses` | `destinationMocks` 3~4건 (`DestinationCatalogPage.jsx:4`) | 45장으로 복제한 가짜 목록 (`:30`), 총 45건 고정 (`:57`), 필터·페이지가 로컬 state (`:17-21`), 페이지 버튼 전체 렌더링 (`:78`), 로딩·에러·빈 상태 없음 |
| 검색 결과 | `/destinations/search` | 목업 4건을 반복한 8건 (`DestinationSearchResultsPage.jsx:14`) | `window.location.search`를 렌더링 중 직접 읽음 (`:9`), 조건을 필터에 쓰지 않음, 정적 배지와 동작하지 않는 페이지네이션 (`:18-19`) |
| 검색 모달 | (모달) | `TravelSearchModal`이 regions를 넘기지 않음 (`TravelSearchModal.jsx:12-31`) | 지역·시군구·상세 항목이 '전체'뿐 (`SearchModal.jsx:14, 87, 106`), 한글 라벨을 쿼리에 실음, `window.location.href`로 전체 새로고침 (`:61`) |

**백엔드 API 계약 (요약)**

| API | 요청 | 응답 | 비고 |
|-----|------|------|------|
| `GET /api/v1/search` | `page`(기본 1), `size`(기본 9, 1~100), `lDongRegnCd`, `lDongSignguCd`, `contentTypeId`, `arrange`(기본 Q), `lclsSystm1`, `lclsSystm2`, `regionGroup` | `{ items, page, size, totalCount }` | 결과가 없으면 200 + 빈 items. 400 `INVALID_REQUEST`, 502 TourAPI 오류. 키워드 파라미터는 없음 |
| `GET /api/v1/regions` | 없음 | `[{ lDongRegnCd, name }]` 16건 | 로컬 JSON, TourAPI 호출 없음 |
| `GET /api/v1/regions/districts` | `lDongRegnCd` | `[{ lDongRegnCd, lDongSignguCd, name, regionName }]` | 로컬 JSON |
| `GET /api/v1/classifications` | `contentTypeId` | `[{ lclsSystm1Cd, lclsSystm1Nm, lclsSystm2Cd, lclsSystm2Nm, ... }]` (중분류 기준 중복 제거) | 로컬 JSON |

- 응답의 `page`/`size`는 TourAPI 값을 그대로 전달한다. 마지막 페이지에서는 `size`가 남은 건수로 줄어들 수 있으므로, **총 페이지 수는 요청한 size로 계산**한다.
- `address`는 빈 문자열일 수 있고, `image`와 `thumbnail`은 null일 수 있다.
- `lclsSystm2`만 보내면 백엔드가 해당 contentType 전체를 100건씩 끝까지 조회한다(`TourClassificationSearchService.java:45-71`). 호출 한도에 가장 위험한 경로다.

**목업 필드 ↔ API 필드**

| 목업 | API | 처리 |
|------|-----|------|
| `id` (slug) | `contentId` | 상세 링크는 `getTourDetailPath(contentId, contentTypeId)` 재사용 |
| `image` | `image ?? thumbnail` | 둘 다 없으면 대체 이미지 |
| `title`, `address` | `title`, `address` | 빈 주소는 "주소 정보 없음" (`tourApi.js`의 기존 문구와 통일) |
| `tag` | `lclsSystm2Nm ?? lclsSystm1Nm` | null이면 표시하지 않음 |
| `description`, `meta` | 없음 | 카드에서 제거 (개요·휴무일은 상세 API에만 있음) |
| 검색 결과 배지 (문의·주차·운영) | 없음 | 제거 |

### 1.3 관련 문서

- 이전 기능: `docs/01-plan/features/tour-detail-integration.plan.md`, `docs/04-report/features/tour-detail-integration.report.md` (후속-1 AbortSignal, 후속-3 목 클라이언트)
- 진단: `docs/development/waylog-renewal.md`
- 로컬 실행: `README.md` Backend "로컬 실행" (`local`, `local,local-mock` 프로필)

---

## 2. 범위

### 2.1 포함

- [ ] `client.js`: 요청 옵션의 `signal`을 fetch에 전달
- [ ] `tourApi.js`: `fetchTourList(query, { signal })`, `fetchRegions`, `fetchDistricts`, `fetchClassifications`, view model 변환 `toTourCard`
- [ ] `hooks/useTourList.js`: 목록 조회 상태 훅 (`useTourDetail` 패턴)
- [ ] 공통 목록 UI: 카드 그리드, 스켈레톤, 에러(재시도), 빈 상태(조건 초기화), 윈도잉 페이지네이션
- [ ] `DestinationCatalogPage` 관광지(12)·문화시설(14): API 목록, API 분류 기반 탭, 지역·시군구 선택, 정렬, URL 상태
- [ ] `DestinationSearchResultsPage`: `useSearchParams`, 카탈로그와 같은 목록 컴포넌트
- [ ] `SearchModal`/`TravelSearchModal`: 실제 지역·시군구·분류 선택, 코드 기반 쿼리, `navigate()` 이동
- [ ] `DestinationsPage`: 지역 카드를 해당 시·도 조건의 목록으로 연결 (정적 섹션은 API 호출 없이 유지)
- [ ] 백엔드 (frontend-support-backend): 중분류 조회 호출량 방어, `arrange` 허용값 검증, 단위 테스트 2개
- [ ] 즐기기 검색 모달(`EnjoySearchModal`)을 새 option 모델과 어댑터로 이전. 결과 페이지가 읽는 쿼리 형식은 그대로 유지 (설계 P-1)
- [ ] local-mock 목 클라이언트 최소 개선: 유형별 합성 데이터, page/size/totalCount 반영, 특정 지역은 빈 결과 (설계 P-2, frontend-support-backend)
- [ ] 검색 모달 포커스 관리: 초기 포커스, 닫을 때 포커스 복원 (Tab 순환은 여유 범위) (설계 P-7)

### 2.2 제외

- 여행코스 목록·상세 (D-1: 다음 기능으로 분리). `/destinations/courses`는 당분간 목업 유지
- 권역(regionGroup) 조회와 그 백엔드 버그 수정 (D-2)
- 키워드 검색 `searchKeyword2` (D-4)
- 북마크 API 연동. 카드의 가짜 북마크 버튼은 **제거** (Q-1)
- 즐기기(`/enjoy/*`) 페이지 전환. 단, 훅과 목록 컴포넌트는 재사용할 수 있게 설계. 즐기기 검색 모달은 어댑터로 이전하고 결과 페이지는 유지
- 상세의 목업 분기와 `destinationMocks.js` 삭제 (D-5: 주변 장소 섹션과 코스 목업이 의존)
- 무한 스크롤, 다음 페이지 프리페치

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | `client.js`의 `request`가 `signal` 옵션을 fetch에 전달한다. 취소된 요청은 에러 UI로 표시하지 않는다 | High | frontend-lead | Pending |
| FR-02 | `fetchTourList`가 `/api/v1/search`를 호출하고, 결과를 `{ items: TourCard[], totalCount, page, totalPages }`로 변환한다. totalPages는 요청한 size로 계산한다 | High | frontend-lead | Pending |
| FR-03 | `toTourCard`가 `contentId`, `title`, `address`(빈 값이면 "주소 정보 없음"), `image`(`image ?? thumbnail`, 없으면 null), `category`(`lclsSystm2Nm ?? lclsSystm1Nm`), `detailPath`(`getTourDetailPath`)를 만든다 | High | frontend-lead | Pending |
| FR-04 | `useTourList(query)`가 `loading`·`success`·`error` 상태와 `retry`를 제공한다. 조건이 바뀌면 이전 요청을 취소하고, 늦게 도착한 응답은 무시한다 | High | frontend-lead | Pending |
| FR-05 | 카탈로그의 탭·지역·시군구·정렬·페이지를 URL 쿼리에 둔다. 잘못된 값은 기본값으로 정규화하고, 필터를 바꾸면 page를 1로 초기화한다 | High | frontend-lead | Pending |
| FR-06 | 카탈로그 탭을 API 분류로 재구성한다 (D-3). 관광지(12): 전체/자연(NA)/역사(HS)/체험(EX)/문화(VE)는 대분류. 문화시설(14): 전체/공연(VE06)/전시(VE07)/행사(VE08)/교육(VE09)은 중분류 | High | frontend-lead | Pending |
| FR-07 | 정렬은 최신순 Q(기본)와 이름순 O 두 가지만 제공한다. 둘 다 대표 이미지가 있는 항목만 반환해 정렬을 바꿔도 totalCount가 같다. '지역순'은 제거한다 (Q-2) | Medium | frontend-lead | Pending |
| FR-08 | 첫 로딩은 스켈레톤, 페이지·조건 변경 중에는 이전 결과를 유지하고 `aria-busy`로 표시한다. 에러는 재시도 버튼, 빈 결과는 조건 초기화 버튼을 보여 준다. 400은 "조건이 올바르지 않음", 그 외는 "불러오지 못함"으로 구분한다 (상태 코드 기준) | High | frontend-lead | Pending |
| FR-09 | 페이지네이션은 현재 페이지 주변만 표시(윈도잉)하고 처음·이전·다음·끝 이동을 제공한다. URL의 page가 총 페이지보다 크면 마지막 페이지로 `replace`한다 | High | frontend-lead | Pending |
| FR-10 | 카드는 `getTourDetailPath`로 상세에 연결되고, 카드 제목과 상세 제목이 일치한다. 이미지가 없으면 대체 이미지를 쓰고, 이미지는 lazy loading과 고정 비율을 쓴다 | High | frontend-lead | Pending |
| FR-11 | 검색 결과 페이지는 `useSearchParams`로 조건을 읽고 카탈로그와 같은 목록 컴포넌트를 쓴다 | High | frontend-lead | Pending |
| FR-12 | 검색 모달은 `/regions`, `/regions/districts`와 `data/tourListConfigs.js`의 정적 분류 정의로 선택지를 만들고 (설계 P-3), 쿼리에 코드(`lDongRegnCd`, `lDongSignguCd`, `contentTypeId`, `lclsSystm1`/`lclsSystm2`)를 실어 `navigate()`로 이동한다. 모달을 열 때 현재 URL 조건을 반영한다. 여행코스 유형은 비활성 + '준비 중'으로 표시한다 (Q-5) | High | frontend-lead | Pending |
| FR-13 | 지역·시군구 목록은 앱 수명 동안 메모리에 캐시한다 (로컬 JSON API라 변하지 않음). 분류는 정적 정의라 호출하지 않는다 | Medium | frontend-lead | Pending |
| FR-14 | 랜딩의 지역 카드를 해당 시·도 조건의 목록으로 연결한다. 권역 카드는 대표 시·도로 연결한다 | Medium | frontend-lead | Pending |
| FR-15 | 백엔드: `lclsSystm2`만 오면 앞 2자리로 `lclsSystm1`을 보정하고, 중분류 전체 조회는 최대 20페이지(2,000건)로 제한하며 초과 시 WARN 로그를 남긴다. 상한은 실제 키로 문화시설 전국 건수를 확인한 뒤 확정 (Q-3) | High | frontend-support-backend | Pending |
| FR-16 | 백엔드: `arrange`가 허용값(A/C/D/O/Q/R)이 아니면 400 `INVALID_REQUEST`로 응답한다 | Medium | frontend-support-backend | Pending |
| FR-17 | 조건 없이 `/destinations/search`에 들어오면 API를 호출하지 않고 "조건을 선택해 주세요" 안내와 모달 열기 버튼을 보여 준다 (Q-6) | Medium | frontend-lead | Pending |
| FR-18 | local-mock 목 클라이언트가 contentTypeId별 합성 데이터와 page/size/totalCount를 반영하고, 특정 지역 코드는 빈 결과를 반환한다 (Q-4) | Medium | frontend-support-backend | Pending |

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 호출량 | 목록 조회는 조건 조합 1개당 요청 1회. 프리페치 없음. 지역·분류 API는 세션당 1회 | 네트워크 탭, 서버 로그 |
| 경쟁 조건 | 조건을 빠르게 연속 변경해도 마지막 조건의 결과만 표시 | 수동 확인 (네트워크 throttling) |
| 레이아웃 안정성 | 로딩·페이지 전환 중 그리드 높이가 급변하지 않음. 이미지 고정 비율 | 수동 확인 |
| 접근성 | 목록 영역 `aria-busy`, 에러 `role="alert"`, 페이지 버튼에 `aria-label`과 `aria-current` | 코드 리뷰 |
| 반응형 | 모바일·태블릿·데스크톱에서 그리드, 필터, 페이지네이션이 깨지지 않음 | 브라우저 크기 조절 |
| 유지보수성 | 목록 훅과 목록 컴포넌트를 즐기기 페이지에서 재사용할 수 있음 (contentTypeId와 필터 정의만 교체) | 설계 리뷰 |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] 관광지·문화시설 카탈로그가 실제 API 데이터와 totalCount를 표시한다 (목업 복제 없음)
- [ ] 탭·지역·시군구·정렬·페이지 변경이 URL에 반영되고, 상세 → 뒤로 가기에서 그대로 복원된다
- [ ] URL을 직접 입력하거나 공유해도 같은 목록이 나온다. 잘못된 쿼리는 기본값으로 정규화된다
- [ ] 검색 모달에서 실제 지역·시군구·분류를 골라 검색 결과로 이동한다 (전체 새로고침 없음)
- [ ] 로딩·에러(재시도)·빈 상태(조건 초기화)가 구분되어 표시된다
- [ ] 카드 → 상세 이동 시 카드 제목과 상세 제목이 일치한다
- [ ] 조건을 빠르게 바꿔도 마지막 조건의 결과만 남는다
- [ ] 랜딩의 지역 카드가 해당 지역 목록으로 이동한다
- [ ] `/destinations/courses`와 상세 목업 분기에 회귀가 없다
- [ ] frontend-code-reviewer 리뷰와 gap 분석 완료

### 4.2 품질 기준

- [ ] `npm run lint` 오류 0, `npm run build` 성공
- [ ] 백엔드 `mvnw clean test` 통과, 변경한 검증 로직은 curl로 확인
- [ ] gap 분석 Match Rate 90% 이상

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| TourAPI 일일 1,000회 한도 소진 (중분류 전체 조회, 개발 중 반복 호출) | High | Medium | FR-15 호출량 방어. 개발은 `local,local-mock` 프로필 우선, 실제 키 검증은 짧게. 프리페치 금지. 서버 재시작 시 캐시가 사라지는 점 유의 |
| local-mock 목록이 유형과 관계없이 관광지 3건만 반환 | Medium | High | FR-18(목 클라이언트 최소 개선)로 해결. 분류 결과의 정확성만 실제 키로 짧게 확인 |
| B안 채택으로 즐기기 검색 모달까지 수정 범위 확대 | Medium | Medium | 어댑터가 기존 쿼리 형식을 그대로 만들고, 설계 §8.3 L2에 즐기기 검색 회귀 항목을 명시 |
| 늦게 도착한 응답이 최신 결과를 덮어씀 | Medium | Medium | AbortController와 `isActive` 가드 병행 (FR-01, FR-04) |
| URL 조작으로 잘못된 조건 입력 | Low | Medium | 파싱 함수에서 정규화, 백엔드 400은 "조건이 올바르지 않음" + 초기화 링크 |
| 문화시설 탭 결과가 사용자의 기대와 다름 (박물관·미술관은 소분류라 '전시시설'로 묶임) | Low | High | 탭 이름을 API 중분류 이름에 맞춤. 카드에 분류명 표시 |
| 상세 목업 분기 유지로 두 데이터 출처가 공존 | Low | High | D-5 결정. 코스 기능에서 함께 정리 |
| `thumbnail` 해상도가 카드에 부족할 수 있음 | Low | Medium | `image` 우선, 실제 키로 확인 |

---

## 6. 영향 분석

### 6.1 변경 자원

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `api/client.js` `request` | API 클라이언트 | `signal` 옵션 전달 추가 |
| `api/tourApi.js` | API 모듈 | 목록·지역·분류 조회 함수와 view model 추가 |
| `pages/DestinationCatalogPage.jsx` | 페이지 | 관광지·문화시설을 API 목록으로 전환. 코스는 기존 목업 유지 |
| `pages/DestinationSearchResultsPage.jsx` | 페이지 | API 목록과 URL 상태로 전환 |
| `components/search/SearchModal.jsx`, `TravelSearchModal.jsx` | 컴포넌트 | 실제 선택지, 코드 쿼리, `navigate()` |
| `components/search/EnjoySearchModal.jsx` | 컴포넌트 | option 모델과 어댑터로 이전. 쿼리 형식 유지 |
| `App.jsx` | 라우트 | 관광지·문화시설 라우트를 새 카탈로그 페이지로 변경. 코스는 기존 페이지 유지 |
| `pages/DestinationsPage.jsx` | 페이지 | 지역 카드 링크 |
| `GET /api/v1/search` | 백엔드 API | 중분류 보정·상한, arrange 검증 |

### 6.2 현재 사용처

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `client.js` `request` | `authApi.js`, `tourApi.js`, 홈 데이터 조회(`App.jsx`) | signal은 선택 옵션이라 기존 호출 영향 없음. 확인 필요 |
| `SearchModal` | `TravelSearchModal`, `EnjoySearchModal` | **즐기기 검색 모달도 같은 컴포넌트를 쓴다.** 즐기기 동작이 바뀌지 않도록 props 호환 유지 필요 |
| `DestinationCatalogPage` | App 라우트 3개 (attraction, culture, course) | course는 목업 경로를 유지해야 함 |
| `destinationMocks.js` | 카탈로그, 검색 결과, `TravelDetailPage` 목업 분기·주변 장소, `TravelCourseDetailPage` | 이번에 삭제하지 않음 |
| `/api/v1/search` | 홈 API 내부(`HomeTourService`), 프론트 신규 호출 | 중분류 보정은 lclsSystm1이 없을 때만 적용해 기존 호출 영향 없음. 확인 필요 |

### 6.3 검증

- [ ] 로그인·토큰 갱신·홈 데이터 조회가 signal 추가 후에도 동작
- [ ] 즐기기 검색 모달의 기존 동작 유지
- [ ] `/destinations/courses` 목업 목록과 코스 상세 유지
- [ ] 홈 API 응답 변화 없음

---

## 7. 아키텍처 고려사항

### 7.1 프로젝트 수준

Dynamic (React SPA + Spring Boot 자체 서버). 기존 폴더 구조(`api/`, `hooks/`, `components/`, `pages/`, `data/`)를 따른다.

### 7.2 주요 결정

| 결정 | 선택지 | 선택 | 이유 |
|------|--------|------|------|
| 설계안 | A 최소 변경 / B 클린 아키텍처 / C 실용적 균형 | **B (사용자 결정)** | 추천은 C였음. 관심사 분리와 즐기기 재사용성을 우선. 분리 근거는 설계 §2.2 |
| 서버 상태 관리 | react-query / 자체 훅 | 자체 훅 (`useTourList`) | 기존 `useTourDetail`과 같은 패턴. 새 의존성 없이 취소·경쟁 조건 처리를 직접 설명할 수 있음 |
| 목록 상태의 원천 | 로컬 state / URL | URL (`useSearchParams`) | 뒤로 가기 복원, 공유 가능, 백엔드 캐시 키와 일치 |
| 페이지네이션 | 페이지 번호 / 더보기 / 무한 스크롤 | 페이지 번호 + 윈도잉 (D-6) | 기존 UI, URL 복원, 호출량 예측 가능 |
| 검색 결과 화면 | 별도 구현 / 목록 컴포넌트 공유 | 공유 (D-7) | 두 화면의 요구가 같아짐 |
| 요청 취소 | isActive 가드만 / AbortController 병행 | 병행 (D-8) | 실제 요청 취소로 서버 부하도 줄임. 이전 기능의 후속 과제 |
| 스타일 | 기존 CSS | 기존 CSS 유지 | 프로젝트 관례 |
| 테스트 | - | lint, build, 수동 흐름 확인, 백엔드 단위 테스트·curl | 프론트 테스트 러너가 없음 |

### 7.3 작업 분담 (CLAUDE.md bkit 협업 규칙)

```
frontend-lead            : FR-01 ~ FR-14 (프론트 전체)
frontend-support-backend : FR-15, FR-16 (백엔드 /search 검증·호출량 방어)
frontend-code-reviewer   : 구현 후 리뷰
bkit gap-detector        : 설계 대비 gap 분석
frontend-interview-coach : 완료 보고서 후 포트폴리오 자료 추출
```

백엔드와 프론트는 파일이 겹치지 않아 병렬로 진행할 수 있다. L2 통합 확인만 백엔드 완료 후에 한다. 같은 파일을 두 에이전트가 동시에 수정하지 않는다.

---

## 8. 사용자 결정 (결정됨, 2026-09-28)

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| D-1 | 여행코스 목록·상세 | **다음 기능으로 분리** | 카드(경유지 없음), 탭(기간 → 테마), 상세(백엔드 신규 API)가 모두 달라 범위가 두 배가 됨 |
| D-2 | 지역 선택 단위 | **16개 시·도 + 시군구** | 백엔드 수정 없이 정확한 totalCount. 권역 조회는 버그 수정이 선행돼야 함 |
| D-3 | 카탈로그 탭 구성 | **API 분류에 맞게 재구성** + 중분류 호출량 방어 | 결과가 탭 이름과 일치해야 함 |
| D-4 | 키워드 검색 | **제외** | 현재 UI에 입력창이 없고 백엔드 신규 엔드포인트가 필요 |
| D-5 | 목업 정리 | **상세 목업 분기 유지** (추천안 적용) | 주변 장소 섹션과 코스 목업이 의존 |
| D-6 | 페이지네이션 | **페이지 번호 + URL** (추천안 적용) | 7.2 참고 |
| D-7 | 검색 결과 화면 | **카탈로그와 목록 컴포넌트 공유** (추천안 적용) | 7.2 참고 |
| D-8 | client.js AbortSignal | **포함** (추천안 적용) | 7.2 참고 |

---

## 9. 다음 단계

1. [ ] 설계 문서 작성 (`destination-list-integration.design.md`, 설계안 3가지 비교 후 선택)
2. [ ] 백엔드 FR-15, FR-16 (frontend-support-backend)
3. [ ] 프론트 구현 (frontend-lead)
4. [ ] 코드 리뷰 (frontend-code-reviewer) + gap 분석
5. [ ] 완료 보고서 → 포트폴리오 추출 (frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-28 | 초안. frontend-lead 분석 반영, 사용자 결정 D-1 ~ D-8 반영 | WOOJIN |
| 0.2 | 2026-09-28 | 설계 단계 반영: 설계안 B, 범위 추가(즐기기 모달 이전, 목 개선, 포커스 관리, 백엔드 단위 테스트), FR-07·12·13·15 확정, FR-17·18 추가, 위험·영향·작업 순서 갱신 | WOOJIN |
