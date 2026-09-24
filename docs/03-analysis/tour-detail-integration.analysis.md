# tour-detail-integration 분석 보고서

> **분석 유형**: Gap Analysis (설계 대비 구현, 정적)
>
> **프로젝트**: WayLog
> **분석자**: bkit gap-detector (WOOJIN 요청)
> **작성일**: 2026-09-24
> **상태**: Check 2회차
> **기준**: `c157806` 위의 커밋 전 작업 트리 (백엔드 `tour/` 5개 파일, 프론트 신규 6개 파일, 상세 2화면과 CSS, 홈 섹션 3개)
> **계획**: [tour-detail-integration.plan.md](../01-plan/features/tour-detail-integration.plan.md)
> **설계**: [tour-detail-integration.design.md](../02-design/features/tour-detail-integration.design.md) (설계안 C, v0.3. 1회차는 v0.2 기준)

> 정적 분석만 수행했다. `mvnw compile`, `npm run build`, `npx eslint .`(오류 0)는 메인 세션이 확인한 결과를 그대로 옮겼다. F-7(§8.3 L2 브라우저 확인)과 BE-6의 L1 curl 결과는 아직 없어서 **미측정**으로 표기했다. 미측정 항목은 0%로 계산하지 않고 점수 계산에서 뺐다.

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

## 요약

| 항목 | 결과 |
|------|------|
| **Overall Match Rate (v2.1.1, 정적)** | **97.6%** (2회차, 1회차 96.8%) |
| 참고: 3축 Match Rate (app-safety-net과 같은 계산) | 98.8% (2회차: 구조 100 / 기능 99.2 / 계약 97.9. 1회차 98.5%) |
| FR-01 ~ FR-12 | 정적 기준 **12개 모두 충족**. FR-11은 실제 TourAPI 전제가 검증되지 않음(G-02) |
| BE-1 ~ BE-5 | 모두 일치 |
| F-1 ~ F-6 | 모두 일치 (F-6 정적 검증 통과) |
| F-7 (§8.3 L2) | **미측정** |
| BE-6 L1 curl (§8.2) | **미측정** (compile 통과만 확인됨) |
| Gap Critical / Important / Minor | 0 / 2 / 4 (2회차: G-02·G-09 / G-05·G-07·G-08·G-10) |
| 의도적 설계 변경 | 8건 (구현자가 밝힘) + 추가 발견 9건. 모두 설계 문서에 역반영할 대상 |
| 정적 검증 | `mvnw compile` 통과, `npm run build` 통과, `npx eslint .` 오류 0 |

---

## 1. 점수

### 1.1 구조·기능·계약

| 축 | 점검 | 일치 | 점수 | 비고 |
|----|:---:|:---:|:---:|------|
| 구조 (§11 파일 목록) | 17 | 17 | 100% | `DetailStatus.css`는 설계상 "필요 시"라서 필수 항목에서 뺐다. 추가 파일 `detailMessages.js`는 §5.1에서 허용한 파일이다 |
| 기능 (BE-1 ~ 5, §2 ~ §7, §5.2 섹션 규칙, 홈 링크) | 49 | 48.5 | 99.0% | 부분 일치 1건: `?type=` 검증(G-01) |
| 계약 (§9 공개 계약, §5.1 props, §3.1 view model, §4 API 3-way, §5.3 경로 규칙) | 18 | 17.5 | 97.2% | 부분 일치 1건: view model에 `meta` 필드 추가(A-2) |

### 1.2 의미 평가 (v2.1.1)

| 축 | 점수 | 근거 |
|----|:---:|------|
| 의도 일치 (Intent) | 93.8% | 계획 4.1 성공 기준 8개 중 완전 충족 7개, 부분 충족 1개("없는 contentId → 404"는 실제 TourAPI 동작이 검증되지 않음, G-02). "리뷰 Must Fix 0"은 프로세스 기준이라 제외했다 |
| 동작 완결성 (Behavioral) | 96.7% | §6 오류 처리와 경계 조건 15개 중 14.5개. `?type=` 부분 일치(G-01) |
| UX 충실도 | 95.8% | 정적으로 확인한 UX 요소 12개 중 11.5개. 로딩 카드의 live region 공지 여부는 확인이 필요하다(G-05). 360px 폭과 스크린 리더 확인은 L2 미측정이라 제외했다 |

```
Overall (v2.1.1, 런타임 없음)
= 구조 100×0.10 + 기능 99.0×0.20 + 계약 97.2×0.20
+ 의도 93.8×0.25 + 동작 96.7×0.15 + UX 95.8×0.10
= 10.0 + 19.8 + 19.4 + 23.4 + 14.5 + 9.6
= 96.8%

참고 (3축, app-safety-net 방식) = 100×0.2 + 99.0×0.4 + 97.2×0.4 = 98.5%
```

---

## 2. FR 판정

| ID | 판정 | 근거 | 비고 |
|----|:---:|------|------|
| FR-01 | ✅ | `TravelDetailPage.jsx:27-29,63-67`, `EnjoyDetailPage.jsx:33-35,75-77` | 목업 분기는 기존 View를 그대로 쓴다 |
| FR-02 | ✅ | `TravelDetailPage.jsx:31-32,69-80`, `EnjoyDetailPage.jsx:36-37,79-89`, `tourApi.js:19-24` | |
| FR-03 | ✅ | `TravelDetailPage.jsx:33,82`, `EnjoyDetailPage.jsx:38,91`, `enjoyMocks.js:57`(`items[0]` 대체 없음) | `?type=` 검증이 느슨함(G-01) |
| FR-04 | ✅ | `useTourDetail.js:19-21,27-51`, `TourApiDetail.jsx:19-24`, `DetailStatus.jsx` | |
| FR-05 | ✅ | `TravelDetailPage.jsx:119-127,146-171`, `EnjoyDetailPage.jsx:111,115-124,129-136` | |
| FR-06 | ✅ | `tourApi.js:64-76`. `dangerouslySetInnerHTML`은 주석에만 있고 사용처는 0건 | 이중 인코딩 관찰(G-08) |
| FR-07 | ✅ | key: `TravelDetailPage.jsx:65,66,73`, `EnjoyDetailPage.jsx:76,82`. 늦은 응답 차단: `useTourDetail.js:30,34,37,42-44` | 런타임 확인은 L2 미측정 |
| FR-08 | ✅ | `ThemeDestinationSection.jsx:150`, `tourContentTypes.js:37-46` | |
| FR-09 | ✅ | `WeeklyNewsSection.jsx:127` `Link`, `onError` 유지 `:130-137` | |
| FR-10 | ✅ | `RecommendedDestinationSection.jsx:50`, 주석 갱신 `:45-49` | |
| FR-11 | ✅ (정적) | `TourApiClientImpl.java:275-308`, `TourExceptionHandler.java:58-71`, `TourDetailService.java:43-45` | 실제 TourAPI의 빈 items 전제는 미검증(G-02) |
| FR-12 | ✅ (정적) | `MockTourApiClient.java:173-241` | L1 #1·#2 미측정(G-03) |

---

## 3. 성공 기준 (계획 4장)

| 기준 | 판정 | 근거 |
|------|:---:|------|
| FR-01 ~ FR-12 구현 | ✅ | 2장 |
| 홈 카드 → 같은 제목의 상세 | ✅ (정적) / 런타임 미측정 | 홈 카드가 넘긴 contentId를 그대로 상세 API로 조회한다. local-mock의 목록과 상세는 같은 id·제목(`MockTourApiClient.java:43-83,173-218`)을 쓴다 |
| `/destinations/detail/no-such-place`, `/enjoy/food/no-such-food` → API 호출 없이 not-found | ✅ (정적) | 해석 함수는 `isTourContentId`를 통과하지 못하면 `not-found`를 반환한다. 이 경로에서는 `TourApiDetail`이 렌더링되지 않는다 |
| `/destinations/detail/999999999` → 404 → not-found | ⚠️ | local-mock은 코드상 충족한다(Mock throw → 404 → `isNotFoundError`). 실제 TourAPI는 전제가 검증되지 않았다(G-02) |
| 백엔드 중지 → 오류 → 다시 시도 → 성공 | ✅ (정적) | `fetch`의 TypeError는 `ApiError`가 아니므로 `error`가 된다. `retry`는 `useTourDetail.js:48-51` |
| 주변·추천 카드 이동 시 저장 초기화, 이전 제목 없음 | ✅ (정적) | key 재마운트 |
| 목록·검색 → 상세 회귀 없음 | ✅ (정적) | 목업 분기와 목업 View JSX는 source 분기 안에서 유지된다 |
| build, lint 0, 백엔드 컴파일 | ✅ | 메인 세션 확인 |
| 리뷰 Must Fix 0, Match Rate 90% 이상 | ⏳ / ✅ | 리뷰는 이 문서 범위 밖이다. Match Rate는 96.8% |
| L1 curl (계획 4.2) | 미측정 | G-03 |

---

## 4. 설계 항목별 대조

### 4.1 백엔드 (BE-1 ~ BE-6)

| ID | 판정 | 근거 | 비고 |
|----|:---:|------|------|
| BE-1 | ✅ | `TourContentNotFoundException.java:11-23` | 메시지와 `contentId` 필드가 설계와 같다 |
| BE-2 | ✅ | `TourExceptionHandler.java:58-71` | 기존 `ErrorResponse` 레코드를 재사용한다. 전역 `Exception` 핸들러가 없어서 핸들러 우선순위 문제도 없다 |
| BE-3 | ✅ | `TourApiClientImpl.java:242`(contentId 전달), `:279-284`(null → 502 유지), `:289-292`(header 없음 → `EMPTY_HEADER` 502), `:294-305`(0000 + 빈 items → 404), `:243-247`(catch 변경 없음) | `getDetailIntro` 변경 없음 (`:251-272`, `:311-335`) |
| BE-4 | ✅ | `TourDetailService.java:43-45` | `@Cacheable`은 예외를 캐시하지 않는다(설계에서 허용) |
| BE-5 | ✅ | `MockTourApiClient.java:173-218`: 3건, `firstimage`·`firstimage2` null, `<br>`·`&nbsp;`가 섞인 overview, 좌표는 목록과 같음. `:227-236`: 없는 id면 throw. `:238-241`: intro는 null | contentTypeId를 무시하는 목 전용 동작은 주석으로 남겼다 |
| BE-6 | ✅ | compile 통과, L1 #1 ~ #4·#7 통과 (9.1, `local-mock`, 2026-09-24) | #5·#6은 실제 키가 없어 미측정(G-02) |

`getDetailCommon`을 호출하는 곳은 `TourDetailService` 하나뿐이다. 새 예외가 목록·홈·축제 API의 502 형식에 영향을 주지 않는다(계획 6.3).

### 4.2 프론트 (F-1 ~ F-6)

| ID | 판정 | 근거 |
|----|:---:|------|
| F-1 `tourContentTypes.js` | ✅ | §9 계약의 5개 export가 모두 있다. `getEnjoyContentType`이 추가되었다(A-1) |
| F-1 `tourApi.js` | ✅ | `fetchTourDetail`(`encodeURIComponent`, `URLSearchParams`), `toTourDetail`(fail-closed: 제목이 없거나 공백이면 Error), `toPlainText`(규칙 1 ~ 5). `toTelHref`가 추가되었다(의도적 변경 C-1) |
| F-2 `useTourDetail` | ✅ | §2.4 코드와 구조가 같다. 404와 400 외의 오류에서 `console.error`를 추가로 호출한다(A-5) |
| F-2 `DetailStatus` | ✅ | loading은 `role="status"` 한 줄, error는 `role="alert"`, eyebrow·제목·설명·[다시 시도]`<button>`·[목록으로]`Link`. 서버 message는 노출하지 않는다 |
| F-2 `TourApiDetail` | ✅ | §5.1 계약의 props와 네 상태 분기가 같다 |
| F-3 `EnjoyDetailPage` | ✅ | fallback 제거, 카테고리 가드 유지(`:66-69`), 해석, key, `--api`, 커버(`image ?? config.cover`, 첫 줄 80자), facts 숨김, 소개, 이용 안내, 추천 유지 |
| F-3 CSS | ✅ | `--api` 아래 `pre-line`, 커버 말줄임(`:235-241`) |
| F-4 `TravelDetailPage` | ✅ | 라우트와 View 분리, 해석, key(코스·View·API), `--api`, 단일 갤러리, facts·슬라이더·주변 숨김, `infos`와 빈 문구, 문의처 조건부 표시, 위치·출처 유지 |
| F-4 CSS | ✅ | `detail-gallery--single` 450px, 모바일 250px(`:22-23,32`). 모바일 미디어쿼리의 `.detail-gallery` 규칙보다 뒤에 선언되어 있어 캐스케이드가 올바르다. `--api`의 `pre-line`(`:25,27`) |
| F-5 홈 3곳 | ✅ | 2장 FR-08 ~ FR-10 |
| F-6 정적 검증 | ✅ | build, lint 0 |
| F-7 L2 | **미측정** | 9장 |

### 4.3 §5.2 출처별 섹션 표시 규칙

| 섹션 | 여행지 API | 즐기기 API |
|------|:---:|:---:|
| 뒤로 버튼 (history가 없으면 `backTo`) | ✅ `:107-110` | ✅ `:101` |
| 헤더와 태그 (`typeLabel`) | ✅ 비어 있으면 숨김(C-7) | ✅ 비어 있으면 `config.title`(A-8) |
| 갤러리·커버 | ✅ 1장, 버튼 없음 | ✅ `config.cover`, 첫 줄 80자 + CSS 2줄 말줄임(C-5) |
| 요약 facts | ✅ 숨김 | ✅ 숨김 |
| 소개 (`description`만, `pre-line`) | ✅ 빈 값이면 대체 문구(A-4) | ✅ 같음 |
| 이용 안내 (`infos`, 빈 문구) | ✅ | ✅ |
| 문의 | ✅ `contact`가 있을 때만. 라벨 분기(C-6) | ✅ 목업 "전화 문의" 버튼 숨김, 실제 문의처 블록 추가(A-7) |
| 정보 오류 제보 | ✅ 유지 | ✅ 유지 |
| 위치·지도 자리 | ✅ | ✅ |
| 추가 사진, 주변 | ✅ 숨김 | - |
| 함께 살펴볼 정보 | - | ✅ 유지 |
| TourAPI 출처 | ✅ | - |

### 4.4 §7 보안

| 항목 | 판정 | 근거 |
|------|:---:|------|
| HTML 미삽입 | ✅ | 텍스트 노드로만 렌더링. `dangerouslySetInnerHTML` 사용 0건 |
| `tel:`은 숫자와 `+`만 | ✅ | `tourApi.js:84-88` |
| `contentId` 검증과 `encodeURIComponent` | ✅ | 해석 함수의 `isTourContentId`, `tourApi.js:22` |
| `contentTypeId`는 `URLSearchParams`로 직렬화 | ✅ | `tourApi.js:21` |

---

## 5. API 계약 3-way (§4 ↔ 서버 ↔ 클라이언트)

| # | 계약 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------|:---:|:---:|:---:|:---:|
| 1 | `GET /api/v1/tour/contents/{id}?contentTypeId=` URL·메서드·쿼리 | ✅ | ✅ `TourDetailController` (기존) | ✅ `tourApi.js:21-22` | PASS |
| 2 | 200 `TourDetailResponse` 필드 소비 (`contentId`, `title`, `image`, `address`, `contentTypeName`, `overview`, `detailInfos[{label,value}]`) | ✅ | ✅ `TourDetailService.java:54-65` | ✅ `tourApi.js:32-55` | PASS |
| 3 | 404 `{code:"TOUR_CONTENT_NOT_FOUND", message, timestamp}` → not-found | ✅ | ✅ | ✅ status로만 판정 | PASS |
| 4 | 400 → not-found | ✅ | ✅ (기존) | ✅ | PASS |
| 5 | 502·500·네트워크 오류 → error | ✅ | ✅ | ✅ | PASS |
| 6 | 200인데 형식이 다름(`{}`) → error | ✅ | - | ✅ `client.js:62` → `toTourDetail` throw | PASS |

§9 공개 계약: `tourContentTypes.js` 5/5, `tourApi.js` 3/3, `DetailStatus`와 `TourApiDetail` props 2/2, `useTourDetail` 반환값 1/1, not-found 문구 상수 위치 1/1(설계의 대체 경로), §5.3 경로 규칙 1/1, §3.1 view model 0.5/1(`meta` 추가).

---

## 6. 설계와 다른 구현

### 6.1 구현자가 밝힌 의도적 변경

| # | 항목 | 분류 | 구현 | 판정 | 설계 반영 위치 |
|---|------|------|------|------|------|
| C-1 | `toTelHref`를 `api/tourApi.js`로 옮겨 export | 계약 확장 | `tourApi.js:84-88`, 두 페이지에서 import | 수용. 두 화면이 규칙 하나를 공유한다. 다만 페이지가 API 모듈을 직접 import하는 경로가 생겼다. `toTelHref`는 네트워크를 쓰지 않는 순수 함수라 §9의 "화면은 API URL을 직접 쓰지 않는다" 원칙은 지켜진다 | §9 `tourApi.js` 계약, §2.5 의존성(두 페이지 → `api/tourApi`), §3.2 연락처 링크 |
| C-2 | `detailMessages.js`에 `DETAIL_EMPTY_INFOS_MESSAGE` 추가 | 문구 상수 공유 | `detailMessages.js:7` | 수용. §5.2의 빈 문구를 두 화면이 같은 값으로 쓴다 | §5.1 상수 목록, §5.2 |
| C-3 | API 소개 문단 스타일 축소 (17px, 굵기 500, 줄간격 1.85) | UX 조정 | `TravelDetailPage.css:25`, `EnjoyDetailPage.css:208-216` | 수용. 긴 overview를 강조 문단 크기로 쓰면 읽기 어렵다 | §5.2 소개 행 |
| C-4 | API 이용 안내 위쪽 정렬, 긴 값 줄바꿈 (`align-items:start`, `overflow-wrap:anywhere`) | 반응형 보강 | `TravelDetailPage.css:26-27,30-31`, `EnjoyDetailPage.css:219-226,257-261` | 수용. 360px 가로 스크롤 방지에 필요하다 | §5.2 이용 안내 행 |
| C-5 | 즐기기 커버 문구 CSS 2줄 말줄임 | 설계 보강 | `EnjoyDetailPage.css:235-241` (JS 80자 자르기와 이중 적용) | 수용 | §5.2 커버 행 |
| C-6 | 여행지 문의 라벨 분기 (`tel:`이면 "문의 전화", 아니면 "문의") | 문구 세분화 | `TravelDetailPage.jsx:150` | 수용. 즐기기는 항상 "문의"로 표시한다 | §5.2 방문 전 확인 행 |
| C-7 | `typeLabel`이 비어 있으면 태그를 표시하지 않음 | 방어 처리 | `TravelDetailPage.jsx:117,160` | 수용 | §5.2 헤더 행 |
| C-8 | `DetailStatus.css` 미생성 | 설계 조건부 항목 | `StatusPage.css:75-92`의 `.status-page__button`에 이미 `font: inherit`, 테두리, `cursor`가 있어 `<button>` 보정이 필요 없다 | 불일치 아님 | §11.2 "미생성(보정 불필요)" 기록 |

### 6.2 추가로 발견한 차이 (구현자가 밝히지 않음)

| # | 항목 | 구현 | 판정 | 설계 반영 위치 |
|---|------|------|------|------|
| A-1 | `getEnjoyContentType(category)` export (`Object.hasOwn`) | `tourContentTypes.js:26-28` | 수용. 프로토타입 키 방어가 app-safety-net D-16과 일관된다 | §9 계약 |
| A-2 | 목업 view model에 `meta` 필드 | `TravelDetailPage.jsx:48`, `EnjoyDetailPage.jsx:53` | 수용. 목업 화면의 휴무일·행사 기간 표시에만 쓴다 | §3.1 (목업 전용 선택 필드) |
| A-3 | 목업 경로의 `backTo` (관광지 또는 문화 목록) | `TravelDetailPage.jsx:53-55` | 수용 | §5.1 backTo 표 |
| A-4 | API `description`이 비면 "등록된 소개 정보가 없습니다." | `TravelDetailPage.jsx:134`, `EnjoyDetailPage.jsx:117` | 수용 | §5.2 소개 행 |
| A-5 | not-found가 아닌 오류에서 `console.error` | `useTourDetail.js:38` | 수용. 사용자에게는 노출하지 않는다 | §2.4 |
| A-6 | `toPlainText` 추가 정리: `U+00A0` → 공백, 줄 끝 공백 제거. `label`도 정리하고, 제목 공백 검사와 trim 추가 | `tourApi.js:33,38,47,72-73` | 수용 | §3.2 규칙 목록 |
| A-7 | 즐기기 API 화면의 문의 블록, 목업 "전화 문의" 버튼 숨김 | `EnjoyDetailPage.jsx:129-136`, CSS `:244-271` | 수용. 설계 §5.2 즐기기 표에는 aside 행이 없다 | §5.2 즐기기 표에 "방문 전 확인" 행 추가 |
| A-8 | 즐기기 태그 `typeLabel \|\| config.title` | `EnjoyDetailPage.jsx:105` | 수용 | §5.2 즐기기 표 |
| A-9 | 오류 카드 eyebrow `--error` 수정자, `aria-labelledby` | `DetailStatus.jsx:27-28` | 수용 | §5.1 |

---

## 7. Gap 목록

### Critical

없음.

### Important

| ID | 내용 | 근거 | 권장 조치 |
|----|------|------|-----------|
| G-02 | BE-3의 핵심 전제("TourAPI가 없는 contentId에 `0000`과 빈 items를 준다")가 검증되지 않았다. 전제가 틀리면 없는 id가 502 → `error`로 표시된다. 다른 장소를 보여 주지 않으므로 안전하게 저하되지만, SUCCESS "없는 contentId는 404 → not-found"는 충족하지 못한다. **2026-09-24 재확인: 실행 환경(셸·사용자·시스템 환경변수)에 `TOUR_API` 키가 없어 여전히 미측정** | 설계 §8.2 L1 #6, 계획 5장 위험 3 | 실제 키로 L1 #5·#6 실행. 응답이 다르면 백엔드에서 판정 조건을 보완한다(frontend-support-backend) |
| G-03 | ~~BE-6 L1 1 ~ 4, 7의 curl 결과가 보고되지 않았다~~ **해소 (2026-09-24)**: `local-mock`으로 L1 #1 ~ #4·#7을 실행했고 모두 기대대로 나왔다(9.1) | 설계 §4.3 BE-6, 계획 4.2 | 조치 완료 |

### Minor

| ID | 내용 | 근거 | 권장 조치 |
|----|------|------|-----------|
| G-01 | `?type=` 검증이 `Number()` 변환이라 `'12.0'`, `' 12'`, `'0xc'`, `'1.2e1'`도 12로 받아들인다. 설계는 `'12'`·`'14'`만 허용한다. 다른 콘텐츠가 표시되지는 않지만 같은 상세에 URL이 여러 개 생긴다 | `TravelDetailPage.jsx:31` | `typeParam === '12' \|\| typeParam === '14'` 같은 문자열 비교로 바꾼다 (frontend-lead) |
| G-05 | 로딩 카드는 `role="status"` 영역을 내용과 함께 한 번에 마운트한다. 일부 스크린 리더는 이미 채워진 live region을 읽지 않는다. 오류 카드(`role="alert"`)는 비교적 안정적으로 공지된다 | `DetailStatus.jsx:17-19`, 계획 3.2 접근성 | L2 "스크린 리더 전달" 항목에서 실제로 확인한다. 공지되지 않으면 영역을 유지하고 내용만 바꾸는 구조를 검토한다 |
| G-06 | 설계 문서가 6장의 의도적 변경과 추가 차이를 반영하지 않았다 | 6장 | 8장 목록대로 설계 v0.3에 반영 |
| G-07 | 즐기기 카테고리 기준이 `enjoyConfigs`, `categoryFacts`, `ENJOY_CONTENT_TYPES` 세 곳에 있다. 현재 키는 모두 일치한다 | `EnjoyDetailPage.jsx:66`, `tourContentTypes.js:12` | 후속. app-safety-net NH-7을 연장하는 과제다. 목록 API 전환 때 하나로 합친다 |
| G-08 | 원문이 `&lt;br&gt;`처럼 인코딩되어 오면 DOMParser가 리터럴 `<br>` 문자열로 복원한다. 그 결과 화면에 `<br>`가 보일 수 있다. 실제 TourAPI 데이터에 이런 인코딩이 있는지는 확인하지 못했다(확신도 낮음) | `tourApi.js:67-68` | 실제 키로 L2를 확인할 때 overview를 본다. 문제가 있으면 DOMParser 뒤에 `<br>` 치환을 한 번 더 적용한다 |

### 범위 밖 관찰

- `goBack`의 `window.history.length > 1`은 다른 사이트에서 같은 탭으로 들어온 경우에도 참이다. 이때는 외부 사이트로 돌아간다. 설계 문구("history가 있으면 뒤로")와는 일치하며, 기존 동작과도 같다.
- `TourExceptionHandler`, `GlobalExceptionHandler`, `FeedExceptionHandler`가 모두 `IllegalArgumentException`을 처리한다. 설계 §13 후속 과제에 이미 있다.

---

## 8. 설계 문서 역반영 필요 항목 (설계 v0.3)

| # | 설계 위치 | 반영 내용 | 출처 |
|---|-----------|-----------|------|
| 1 | §9 `tourApi.js` 공개 계약 | `export function toTelHref(contact) // string \| null` 추가 | C-1 |
| 2 | §9 `tourContentTypes.js` 공개 계약 | `export function getEnjoyContentType(category) // number \| null` 추가 | A-1 |
| 3 | §2.5 의존성 | 두 페이지 → `api/tourApi`(`toTelHref`), `components/detail/detailMessages`. TourApiDetail → `detailMessages` | C-1, C-2 |
| 4 | §3.1 view model | 목업 전용 선택 필드 `meta` | A-2 |
| 5 | §3.2 텍스트 정리 규칙 | `U+00A0` → 공백, 줄 끝 공백 제거, `label`도 정리. 규칙 4 문구를 "개행 3개 이상 → 2개(빈 줄 최대 1줄)"로 명확히 | A-6 |
| 6 | §5.1 | `detailMessages.js`로 확정(대체 경로 채택), `DETAIL_EMPTY_INFOS_MESSAGE` 상수, 오류 eyebrow `--error`, 목업 경로 `backTo` | C-2, A-3, A-9 |
| 7 | §5.2 여행지 표 | 태그가 비면 숨김, 소개 문단 17px, 빈 소개 대체 문구, 이용 안내 위쪽 정렬·긴 값 줄바꿈, 문의 라벨 분기 | C-3, C-4, C-6, C-7, A-4 |
| 8 | §5.2 즐기기 표 | "방문 전 확인" 행 추가(목업: 전화 문의 버튼, API: 실제 문의처 블록), 태그 대체값 `config.title`, 커버 CSS 2줄 말줄임 | A-7, A-8, C-5 |
| 9 | §11.2 | `DetailStatus.css` 미생성과 그 이유, `detailMessages.js` 신규 파일 추가 | C-8 |
| 10 | §2.2 (G-01을 수정하지 않는 경우) | `Number()` 변환으로 허용되는 값의 범위를 명시 | G-01 |

---

## 9. 런타임 확인 계획 (미측정)

### 9.1 L1 API (frontend-support-backend, `local-mock`)

| # | 명령 | 기대 | 결과 |
|---|------|------|------|
| 1 | `curl -s -w "%{http_code}" "http://localhost:8080/api/v1/tour/contents/126508?contentTypeId=12"` | 200, `.title == "경복궁"`, `.image == null`, `.detailInfos == []` | ✅ 200, `title` "경복궁", `image` null, `detailInfos` [], `contentTypeName` "관광지", overview에 `<br>`·`&nbsp;` 포함 |
| 2 | `curl -s -w "%{http_code}" "http://localhost:8080/api/v1/tour/contents/999999999?contentTypeId=12"` | 404, `.code == "TOUR_CONTENT_NOT_FOUND"`, `.message`, `.timestamp` | ✅ 404, `code` "TOUR_CONTENT_NOT_FOUND", `message` "요청한 관광 콘텐츠를 찾을 수 없습니다.", `timestamp` 있음 |
| 3 | `curl -s -w "%{http_code}" "http://localhost:8080/api/v1/tour/contents/126508?contentTypeId=99"` | 400 | ✅ 400. 본문은 `{"message":"지원하지 않는 콘텐츠 유형입니다."}`로, `code`·`timestamp`가 없다(다른 `IllegalArgumentException` 핸들러가 처리). 프론트는 status로만 판정하므로 영향 없음 |
| 4 | `curl -s -w "%{http_code}" "http://localhost:8080/api/v1/tour/contents/126508"` | 400 | ✅ 400. Spring 기본 오류 본문(`MissingServletRequestParameterException`)이다 |
| 5 | (기본 프로필 + 실제 키) 홈 응답의 contentId로 상세 조회 | 200, 제목이 홈과 같음 | 미측정 (실제 키 `TOUR_API` 미설정) |
| 6 | (기본 프로필 + 실제 키) `.../999999999?contentTypeId=12` | 404 (G-02 전제 검증) | 미측정 (실제 키 `TOUR_API` 미설정) |
| 7 | `curl -s -w "%{http_code}" http://localhost:8080/api/v1/home` | 200, 회귀 없음 | ✅ 200, `recommendedDestinations`·`recommendedCourses`·`festivals`·`enjoyItems` 모두 있음 |
| 8 | (SI-1) `curl -s -w "%{http_code}" "http://localhost:8080/api/v1/tour/contents/126508?contentTypeId=14"` | 404 (실제 유형 12와 다름) | ✅ 404 `TOUR_CONTENT_NOT_FOUND`. 두 번 연속 요청해도 404(예외는 캐시되지 않음). 이어서 `?contentTypeId=12` 요청은 200 |
| 9 | (SI-1, 목 즐기기 경로) `.../126485?contentTypeId=15`, `.../126508?contentTypeId=39`, `.../125476?contentTypeId=32` | 200 (목은 즐기기 유형을 요청값으로 반환) | ✅ 모두 200, `contentTypeName` 각각 "축제 · 행사"·"음식점"·"숙박" |

### 9.2 L2 UI (frontend-lead, F-7)

설계 §8.3 체크리스트 전체가 미측정이다. 이번 분석에서 확인이 필요한 곳으로 표시한 항목은 다음과 같다.

| # | 페이지 | 동작 | 기대 | 관련 |
|---|--------|------|------|------|
| 1 | `/destinations/detail/126508?type=0xc` | 진입 | 설계대로라면 not-found, 현재 구현은 경복궁 | G-01 |
| 2 | `/destinations/detail/126508` | 로딩 카드 표시 중 스크린 리더(NVDA·VoiceOver) | "상세 정보를 불러오는 중입니다." 공지 | G-05 |
| 3 | `/destinations/detail/126508` | 소개 | 줄바꿈 표시, `<br>`·`&nbsp;` 문자열 노출 없음 | FR-06, G-08 |
| 4 | 360px, API 상세 | 가로 스크롤 | 없음 (긴 이용 안내 값 포함) | C-4 |
| 5 | 홈 "이번 주 여행 소식" 카드 | 클릭 | `/api/v1/home` 재요청 없음 | FR-09 |
| 6 | `/enjoy/festivals/126485` | 네트워크 탭 | `contentTypeId=15`, 커버 `config.cover`, 커버 문구 2줄 이하 | C-5 |

### 9.3 L3 시나리오

| # | 시나리오 | 성공 기준 |
|---|----------|-----------|
| 1 | 홈 → 추천 여행지 카드 → 상세 → 뒤로 → 여행을 더 즐겁게 카드 → 상세 | 두 상세 모두 카드와 같은 제목. 이전 상세의 저장 상태 없음 |
| 2 | 백엔드 중지 → 숫자 id 상세 → 오류 카드 → 백엔드 시작 → 다시 시도 | 로딩 → 성공, 오류 카드 흔적 없음 |
| 3 | 목업 상세 → 주변 카드 연속 클릭 | 저장·사진 위치 초기화, 이전 제목이 깜빡이지 않음 |

---

## 10. 다음 단계

- [x] frontend-code-reviewer 리뷰 (1차·2차 완료)
- [x] G-03: L1 1 ~ 4, 7 실행 (frontend-support-backend)
- [ ] G-02: 실제 키로 L1 #5·#6 실행
- [x] G-01 수정 완료
- [ ] F-7: §8.3 L2 + 9.2 추가 항목
- [x] 설계 문서 v0.3: 8장 목록 반영
- [x] 설계 v0.4: 11.6 반영 (2026-09-24)
- [x] 계획 §2.2 스크롤 항목 갱신(G-10) (2026-09-24)
- [x] 완료 보고서 작성 (2026-09-24)

Match Rate가 96.8%(90% 이상)이므로 자동 iterate 대상은 아니다. 다만 G-02·G-03은 점수가 아니라 측정 공백이므로 보고서를 쓰기 전에 채우는 것을 권장한다.

---

## 11. 2회차 분석 (설계 v0.3 대비)

> **기준**: 설계 v0.3, `c157806` 위의 커밋 전 작업 트리(1회차 이후 프론트·백엔드 수정 포함)
> **방법**: 정적 분석. `npm run build` 성공, `npx eslint .` 오류 0, `mvnw compile` 통과는 메인 세션이 확인한 결과를 옮겼다. L1은 9.1 결과를 인용했다.
> **미측정**: F-7(§8.3 L2 전체), G-02(L1 #5·#6). 1회차와 같이 0%로 계산하지 않고 점수에서 뺐다.
> **참고**: 2차 코드 리뷰의 MF-A(`toTelHref` 후보 패턴이 번호 뒤 숫자를 합침)는 이 분석 이후에 수정 중이다. 설계 규칙 자체와의 불일치가 아니라 규칙 구현의 결함이라 점수에는 반영하지 않았다.

### 11.1 점수

| 축 | 점검 | 일치 | 점수 | 1회차 | 비고 |
|----|:---:|:---:|:---:|:---:|------|
| 구조 (§11 파일 목록) | 21 | 21 | 100% | 100% | v0.3 기준 백엔드 5개와 프론트 16개. `DetailStatus.css`, `ScrollToTop.jsx`, `App.jsx`가 필수 항목으로 추가됐다 |
| 기능 (BE-1 ~ 5, §2 ~ §7, §5.2, 홈 링크, v0.3 신규 12개) | 61 | 60.5 | 99.2% | 99.0% | G-01 해소(1.0). BE-5의 "`contentTypeId`는 무시한다"가 구현과 달라 부분 일치(G-09) |
| 계약 (§9, §5.1 props, §2.4 반환값, §3.1, §5.3, §5.4, §4 API 3-way) | 24 | 23.5 | 97.9% | 97.2% | `meta`, `toTelHref`, `getEnjoyContentType`, `hasRetried`, `focusOnMount`가 설계와 일치한다. 3-way #7 "요청 유형 ≠ 실제 유형"은 설계에 없어 부분 일치(G-09) |
| 의도 일치 | 8 | 7.5 | 93.8% | 93.8% | 계획 4.1 기준 8개 중 7개 충족. "없는 contentId → 404"는 local-mock에서 확인(L1 #2)됐지만 실제 TourAPI 전제가 미검증이다(G-02) |
| 동작 완결성 | 20 | 20 | 100% | 96.7% | §6 오류 처리와 경계 조건 15개에 v0.3 동작 5개 추가: 400 warn, 이미지 대체(무한 onError 없음), 전화 링크 null 규칙, `<br>\n` 치환, 빈 소개 문구 |
| UX 충실도 | 18 | 17.5 | 97.2% | 95.8% | v0.3 UX 6개 추가: 스크롤 초기화, POP 복원, 재시도 실패 시 포커스, `:focus-visible` 윤곽선, 번호가 여러 개인 문의처는 텍스트로, 이미지 대체. 로딩 live region(G-05)은 계속 0.5 |

계약 축은 이번에 항목을 다시 셌다. 1회차 문서의 합계(18)와 세부 목록 합계가 맞지 않아서, 이번 회차부터는 아래 세부 목록 기준으로 센다.
- §9 `tourContentTypes.js` 6/6, `tourApi.js` 4/4
- `DetailStatus`·`TourApiDetail` props 2/2
- `useTourDetail` 반환값 1/1, 문구 상수 4개 1/1
- §5.3 경로 규칙 1/1, §3.1 view model 1/1, §5.4 `ScrollToTop` 위치 1/1
- API 3-way 6.5/7

```
Overall (v2.1.1, 런타임 없음)
= 구조 100×0.10 + 기능 99.2×0.20 + 계약 97.9×0.20
+ 의도 93.8×0.25 + 동작 100×0.15 + UX 97.2×0.10
= 10.0 + 19.8 + 19.6 + 23.4 + 15.0 + 9.7
= 97.6%

참고 (3축, app-safety-net 방식) = 100×0.2 + 99.2×0.4 + 97.9×0.4 = 98.8%
참고 (G-09를 설계 v0.4에 반영한 뒤 예상) = 98.2%
참고 (G-02 기준까지 미측정으로 제외) = 99.1%
```

### 11.2 1회차 이후 변경 대조 (설계 v0.3 항목)

| 설계 | 항목 | 구현 근거 | 판정 |
|------|------|-----------|:---:|
| §3.2 MF-1 | `toTelHref`: 후보 패턴, 숫자 3자리 이상만 번호로 셈, 번호가 정확히 1개일 때만, `~` 범위 번호 제외, 7 ~ 12자리, `+`는 맨 앞만 | `tourApi.js:79-114` | ✅ |
| §3.2 표 | 입력 예시 11개 | 정규식으로 하나씩 따라가 보니 모두 기대값이다. `"02-3700-3900 ~ 3901"`은 범위 규칙보다 먼저 "번호 2개" 규칙에서 `null`이 된다 | ✅ |
| §5.4 MF-2 | `ScrollToTop`: `useLayoutEffect`, 직전 pathname을 ref로 비교, POP 제외, 첫 로드 제외 | `ScrollToTop.jsx:17-30` | ✅ |
| §5.4 위치 | `BrowserRouter` 바로 아래(Layout 밖 라우트 포함) | `App.jsx:29,271` | ✅ |
| §5.1 SI-2 | `hasRetried`일 때만 오류 카드 제목(`tabIndex=-1`)으로 포커스, 첫 진입 실패는 이동하지 않음 | `useTourDetail.js:60`, `TourApiDetail.jsx:20`, `DetailStatus.jsx:36-41,47` | ✅ |
| §5.1 SI-2 | 제목 윤곽선은 `:focus-visible`일 때만, `DetailStatus.css`에 둠 | `DetailStatus.css:6-14` | ✅ |
| §2.4 SI-3 | 400은 not-found로 표시하고 `console.warn`, 404는 로그 없음, 그 밖의 오류는 `console.error` | `useTourDetail.js:38-45` | ✅ |
| §5.2 SI-4 | 이미지 로드 실패 시 `isImageBroken` state로 기본 이미지 교체, 재요청 반복 없음 | 여행지 `TravelDetailPage.jsx:103-104,133`, 즐기기 `EnjoyDetailPage.jsx:100-101,110` | ✅ |
| §2.2 G-01 | `?type=`은 문자열 `'12'`·`'14'`만 허용. 없으면 12, 빈 문자열은 not-found | `TravelDetailPage.jsx:33,39-41` | ✅ |
| §3.2 N-5 | `/<br\s*\/?>[ \t]*(?:\r?\n)?/gi` → `'\n'` | `tourApi.js:68` | ✅ |
| §5.1 N-1 | `DETAIL_EMPTY_DESCRIPTION_MESSAGE` | `detailMessages.js:10`, `TravelDetailPage.jsx:144`, `EnjoyDetailPage.jsx:120` | ✅ |
| §3.2 A-6 | `U+00A0` → 공백, 줄 끝 공백 제거, 개행 3개 이상 → 2개, `label` 정리, 제목 trim | `tourApi.js:33,38,47,71-76` | ✅ |
| §10 | 수정 금지 파일(`NotFoundPage.jsx`, `StatusPage.css`, `api/client.js`) 변경 없음 | `git status` | ✅ |
| (설계 없음) SI-1 | 요청 유형 ≠ 실제 유형 → 404 | `TourDetailService.java:47-48,278-286` | ⚠️ G-09 |
| BE-5 | 목 상세의 `contentTypeId` 처리 | `MockTourApiClient.java:220-258`: 12·14 요청이면 저장된 12를 반환하고, 즐기기 유형이면 요청값을 반환한다 | ⚠️ G-09 |

### 11.3 1회차 Gap 처리 결과

| ID | 1회차 | 2회차 | 근거 |
|----|-------|-------|------|
| G-01 | Minor | **해소** | 문자열 비교(`toDestinationTypeId`) |
| G-02 | Important | **미측정 유지** | `TOUR_API` 키 없음. L1 #5·#6 미실행 |
| G-03 | Important | 해소 (9.1) | L1 #1 ~ #4·#7 통과 |
| G-05 | Minor | 유지 | 로딩 카드는 여전히 `role="status"` 영역을 내용과 함께 마운트한다(`DetailStatus.jsx:26-27`). L2에서 확인 |
| G-06 | Minor | **해소** | 8장 역반영 1 ~ 9가 설계 v0.3에 모두 들어갔다. 10번은 G-01 수정으로 필요 없어졌다 |
| G-07 | Minor | 유지 (후속) | `enjoyConfigs`, `categoryFacts`, `ENJOY_CONTENT_TYPES` 세 곳. 현재 키는 일치한다 |
| G-08 | Minor | 유지 (L2) | `&lt;br&gt;` 이중 인코딩은 실제 데이터로 확인해야 한다 |

### 11.4 2회차 신규 발견

| # | 항목 | 구현 | 판정 |
|---|------|------|------|
| G-09 | 백엔드 SI-1(요청 유형과 실제 유형이 다르면 404)과 목의 유형별 응답이 설계 v0.3에 없다 | `TourDetailService.java:47-48,278-286`, `MockTourApiClient.java:220-258` | **Important (문서)**. 동작은 타당하고 L1 #8·#9로 확인했다. 프론트는 404를 not-found로 처리하는 기존 계약 그대로라 코드 변경은 필요 없다. 설계를 코드에 맞춘다(11.6) |
| G-10 | 계획 §2.2 "제외"에 "페이지 이동 시 스크롤 맨 위로 이동(후속)"이 남아 있다. 설계 v0.3 §5.4(MF-2)에서 범위로 옮겼다 | `tour-detail-integration.plan.md:119` | Minor (문서). 계획 문서를 고치거나 완료 보고서에 범위 변경으로 기록한다 |
| A-10 | 즐기기 **목업** 커버에도 `onError` 대체(`config.cover`)가 적용된다. 설계 §5.2는 API 커버만 명시한다 | `EnjoyDetailPage.jsx:110` | 수용. 목업 이미지는 로컬 자산이라 영향이 없다. 여행지 목업 갤러리에는 `onError`가 없다(설계와 같음) |
| A-11 | `toTelHref`의 범위 판정이 `~` 앞뒤 공백도 허용한다(`/~\s*$/`, `/^\s*~/`). 설계 규칙 4의 "바로 앞뒤"보다 넓다 | `tourApi.js:108` | 수용. 링크를 덜 만드는 보수적인 방향이다 |

G-09 세부 (설계에서 코드와 다른 곳):
1. §4.3 BE-4: null 검사 뒤 `validateActualContentType(contentId, 요청 유형, common.contenttypeid())`. 실제 유형이 있고 요청 유형과 다르면 `TourContentNotFoundException`을 던진다. 실제 유형이 null이면 통과한다. `detailIntro2` 호출 전에 검사하고, 예외는 캐시되지 않는다.
2. §4.3 BE-5: "`contentTypeId`는 무시한다"는 현재 동작과 다르다. 지금은 12·14로 요청하면 저장된 유형 12를 반환한다(→ `126508?contentTypeId=14`는 404). 15·28·32·38·39로 요청하면 요청 유형을 그대로 돌려준다(→ `/enjoy/food/126508`은 계속 200).
3. §4.2 응답 표와 §6 오류 표에 "요청 유형 ≠ 실제 유형 → 404 → not-found" 행이 없다.
4. §8.2 L1에 #8(`126508?contentTypeId=14` → 404)과 #9(목 즐기기 경로 → 200)가 없다.
5. §2.2 D-4의 결과가 적혀 있지 않다. 실제 TourAPI에서 문화시설(14) id를 `?type=` 없이 열면 기본값 12로 요청해 not-found가 된다. 이전에는 틀린 태그로 표시됐다. 홈 링크는 항상 `?type=`을 붙이므로 홈 → 상세 흐름에는 영향이 없다.

### 11.5 Gap 목록 (2회차 기준)

| 심각도 | ID | 내용 | 조치 | 담당 |
|--------|----|------|------|------|
| Critical | - | 없음 | - | - |
| Important | G-02 | 실제 TourAPI의 "없는 id → `0000` + 빈 items" 전제 미검증 (**미측정**) | 실제 키로 L1 #5·#6 | frontend-support-backend |
| Important | G-09 | SI-1과 목 유형별 응답이 설계에 없음 | 설계 v0.4에 반영 (11.6) | 문서 |
| Minor | G-05 | 로딩 live region 공지 여부 | L2 스크린 리더 확인 | frontend-lead |
| Minor | G-07 | 즐기기 카테고리 기준 3곳 | 후속(목록 API 전환 때) | - |
| Minor | G-08 | `&lt;br&gt;` 이중 인코딩 가능성 | 실제 키 L2에서 overview 확인 | frontend-lead |
| Minor | G-10 | 계획 문서 범위와 설계 v0.3 불일치(스크롤 초기화) | 계획 §2.2 갱신 또는 보고서에 기록 | 문서 |

### 11.6 설계 역반영 필요 항목 (설계 v0.4)

| # | 설계 위치 | 반영 내용 | 출처 |
|---|-----------|-----------|------|
| 1 | §4.3 BE-4 | `validateActualContentType` 코드와 설명(실제 유형 null이면 통과, intro 호출 전 검사, 예외는 캐시하지 않음) | G-09 |
| 2 | §4.3 BE-5 | "`contentTypeId`는 무시한다" → "12·14 요청은 저장 유형(12)을 반환, 즐기기 유형 요청은 요청값을 반환(목 전용)" | G-09 |
| 3 | §4.2, §6 | "요청 유형 ≠ 실제 유형 → 404 `TOUR_CONTENT_NOT_FOUND` → not-found" 행 | G-09 |
| 4 | §8.2 | L1 #8 `126508?contentTypeId=14` → 404, #9 목 즐기기 경로 → 200 | G-09 |
| 5 | §2.2 D-4 | `?type=` 없이 문화시설 id를 열면 not-found가 된다는 점(홈 링크는 항상 `?type=`을 붙임) | G-09 |
| 6 | §5.2 즐기기 커버 행 | 이미지 로드 실패 대체는 목업과 API 모두에 적용 | A-10 |
| 7 | §3.2 연락처 규칙 4 | "`~`가 공백을 사이에 두고 붙어도 범위 번호로 본다" | A-11 |

### 11.7 미측정 항목

| 항목 | 상태 | 이유 | 점수 처리 |
|------|------|------|-----------|
| F-7 (§8.3 L2 전체) | 미측정 | 브라우저 확인 미실행 | 제외. UX의 360px 폭·스크린 리더 항목은 분모에서 뺐다 |
| G-02 (L1 #5·#6) | 미측정 | `TOUR_API` 키 없음 | 의도 축의 해당 기준만 1회차와 같이 부분 충족(0.5). 빼면 Overall 99.1% |
| L1 #1 ~ #4, #7 ~ #9 | ✅ 측정 | 9.1 | 근거로만 사용(런타임 축은 쓰지 않음) |

### 11.8 남은 런타임 확인 계획

**L1** (기본 프로필 + 실제 키, frontend-support-backend)

| # | 명령 | 기대 |
|---|------|------|
| 5 | 홈 응답의 contentId와 contentTypeId로 `GET /api/v1/tour/contents/{id}?contentTypeId={type}` | 200, 제목이 홈 카드와 같음 |
| 6 | `curl -s -w "%{http_code}" "http://localhost:8080/api/v1/tour/contents/999999999?contentTypeId=12"` | 404 `TOUR_CONTENT_NOT_FOUND` (G-02) |
| 10 | 홈 `enjoyItems`에서 고른 음식점 id로 `?contentTypeId=39` 요청, 같은 id로 `?contentTypeId=12` 요청 | 200 / 404 (SI-1이 실제 `contenttypeid`로 동작하는지) |

**L2** (frontend-lead, F-7). §8.3 전체 중 이번 회차에서 확인이 필요한 항목:

| # | 페이지 | 동작 | 기대 | 관련 |
|---|--------|------|------|------|
| 1 | `/destinations/detail/126508?type=0xc`, `?type=12.0`, `?type=%2012`, `?type=` | 진입 | not-found, `/api/v1/tour/contents` 요청 0건 | G-01 |
| 2 | 홈을 아래로 스크롤한 뒤 추천 카드 클릭 → 뒤로 가기 | 이동 | 상세는 맨 위에서 열리고, 홈은 이전 위치로 복원 | MF-2 |
| 3 | 백엔드 중지 → 숫자 id 상세 → 키보드로 "다시 시도" → 다시 실패 | 포커스 | 첫 실패는 포커스 이동 없음, 재실패 시 제목에 포커스와 윤곽선, Tab 한 번에 "다시 시도" | SI-2 |
| 4 | 3번과 같은 상황에서 스크린 리더(NVDA) | 공지 | 로딩 문구 공지, 오류 공지. 재실패 때 제목이 두 번 읽히는지도 확인(`role="alert"`와 포커스 겹침) | G-05, SI-2 |
| 5 | 개발자 도구에서 API 대표 이미지 URL을 깨뜨림 | 로드 | 기본 이미지로 한 번 교체, 네트워크 재요청 반복 없음 | SI-4 |
| 6 | 개발자 도구로 400 유도(`contentTypeId` 변조) | 콘솔 | not-found 화면, `console.warn` 1건, `console.error` 없음 | SI-3 |
| 7 | `/destinations/detail/126508?type=14` (local-mock) | 진입 | not-found (SI-1) | G-09 |
| 8 | `/destinations/detail/126508` (local-mock) | 소개 | `<br>`가 연달아 있는 곳에서 빈 줄 1개, `<br>`·`&nbsp;` 문자열 노출 없음 | N-5, G-08 |
| 9 | 360px, API 상세와 오류 카드 | 가로 스크롤 | 없음 | C-4 |

**L3**: 9.3의 시나리오 1 ~ 3을 그대로 쓴다. 시나리오 1에는 "상세가 맨 위에서 열림"을 성공 기준으로 추가한다.

### 11.9 결론

- Overall **97.6%** (1회차 96.8%), 3축 참고 **98.8%**. 90% 이상이므로 iterate 대상이 아니다.
- 코드를 고쳐야 하는 gap은 없다. G-09·G-10은 문서 작업이다.
- 완료 보고서 전에 F-7 L2(11.8)를 채우는 것을 권장한다. G-02는 키를 확보할 때까지 보고서에 "미측정"과 "안전한 저하(502 → 오류 카드, 다른 장소를 보여 주지 않음)"를 함께 적는다.

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성 |
|------|------|------|------|
| 0.1 | 2026-09-24 | 정적 gap 분석 1회차 (96.8%, 3축 98.5%). 의도적 변경 C-1 ~ C-8, 추가 차이 A-1 ~ A-9, Gap G-01 ~ G-08, 설계 역반영 목록 | bkit gap-detector, WOOJIN (Claude Code 보조) |
| 0.2 | 2026-09-24 | gap 분석 2회차 (설계 v0.3 대비, 97.6%, 3축 98.8%). v0.3 항목(MF-1·MF-2·SI-2·SI-3·SI-4·G-01·N-5·N-1) 일치 확인, G-01·G-06 해소, 신규 G-09(SI-1 설계 미반영, Important·문서)·G-10(계획 범위 불일치, Minor)·A-10·A-11, 설계 v0.4 역반영 목록, 남은 런타임 확인 계획(F-7 L2, G-02) | bkit gap-detector, WOOJIN (Claude Code 보조) |
