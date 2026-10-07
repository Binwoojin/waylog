# tour-course-list-integration 설계 문서

> **요약**: admin-dashboard가 만든 여행코스 3단 스키마(코스-일자-경유지-이미지)를 읽기 전용 공개 API(`GET /api/v1/courses`, `GET /api/v1/courses/{id}`)로 감싸고, 프론트에는 코스 전용 목록·상세 화면을 새로 만든다. destination-list-integration이 검증한 패턴(URL을 상태 원천으로 쓰는 목록, `useTourList`류 렌더 중 파생 상태 머신, AbortController+isActive, 표시 컴포넌트 재사용)을 데이터 계층은 새로 짜고 표시 계층은 최대한 재사용하는 방식으로 옮긴다. 코스 ID와 TourAPI contentId의 숫자 패턴 충돌을 피하기 위해 상세 라우트를 완전히 분리(`/destinations/courses/:id`)하고, CUSTOM 경유지는 좌표가 있을 때만 외부 지도(카카오맵) 딥링크 버튼을 보여준다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-09-30
> **상태**: Draft (계획 8장 사용자 결정 Q-1 ~ Q-6 반영, 전부 추천안 채택)
> **버전**: 0.1
> **계획 문서**: `docs/01-plan/features/tour-course-list-integration.plan.md` (FR-01 ~ FR-15, 사용자 결정 Q-1 ~ Q-6)
> **선행 기능**: `docs/02-design/features/admin-dashboard.design.md` §3.3(스키마 출처), `docs/02-design/features/destination-list-integration.design.md`(재사용 패턴 출처)

---

## Context Anchor

> 계획 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | admin-dashboard가 만든 여행코스 데이터를 사용자가 볼 방법이 없다. `/destinations/courses`는 여전히 목업이고, 관리자 API는 인증이 걸려 있어 재사용할 수 없다 |
| **WHO** | 여행코스를 찾아보는 방문자, 코스 상세를 보고 목록으로 돌아오는 사용자, 검색 모달에서 '여행코스' 유형을 선택하는 사용자 |
| **RISK** | 코스 ID(DB 시퀀스, 작은 정수)가 `isTourContentId`의 숫자 패턴과 겹침 / 코스 엔티티에 지역·기간 필드가 없음 / 목록 카드에 보여줄 대표 주소·일자·경유지 수가 관리자 응답에 없음 / CUSTOM 경유지는 지도 없이 표시해야 함 |
| **SUCCESS** | `/destinations/courses`가 실제 등록된 코스와 정확한 총 건수를 표시 / 코스 상세가 일자별 경유지(REFERENCE/CUSTOM)와 이미지를 실제로 보여줌 / 검색 모달에서 '여행코스' 유형으로 검색 가능 / 로딩·에러·빈 상태 구분 / destination-list-integration 패턴 재사용 |
| **SCOPE** | 백엔드: 공개 조회 컨트롤러·서비스(읽기 전용, 기존 `tourcourse` 패키지에 추가), `SecurityConfig` permitAll / 프론트: `courseApi.js`, 코스 전용 목록·상세 훅과 표시 컴포넌트, 코스 목록·상세 페이지 신설, 목업 분기 제거, 검색 모달 여행코스 유형 활성화 |

---

## 계획 대비 변경 (사용자 결정 반영, 2026-09-30)

계획 문서 8장의 Q-1 ~ Q-6은 모두 추천안대로 확정됐다. 설계 단계에서 그 결정을 구체적인 구조로 바꾼 지점을 정리한다.

| # | 항목 | 계획의 질문 | 설계에서 구체화한 내용 |
|---|------|-------------|------------------------|
| P-1 | CUSTOM 경유지 표시 (Q-1) | "좌표 있으면 외부 지도 딥링크 버튼"(B) | **카카오맵 웹 링크**(`https://map.kakao.com/link/map/{name},{lat},{lng}`)로 확정. API 키가 필요 없는 공개 URL 스킴이다(§5.2). 좌표가 없으면 버튼 자체를 렌더링하지 않는다 |
| P-2 | REFERENCE 경유지 링크 (Q-2) | "항상 링크"(A) | 기존 `getTourDetailPath(tourContentId, tourContentTypeId)`를 그대로 재사용(§5.1). 이 함수가 이미 관광지·문화시설·즐기기 5종을 처리하므로 추가 분기가 필요 없다 |
| P-3 | 목록 지역 필터·카드 정보 (Q-3) | "필터는 키워드만 + 카드에 1일차 주소 배지 + 일자·경유지 수"(A+C+D 조합) | **공개 목록 전용 신규 DTO**(`TourCoursePublicListItemResponse`)와 **집계 전용 쿼리 2개**(§4.2)로 N+1 없이 구현. 관리자 목록 응답(`TourCourseListItemResponse`)은 손대지 않는다 |
| P-4 | 검색 모달 여행코스 조건 (Q-4) | "키워드 검색으로 활성화" | 검색 모달은 **여행코스 전용 검색 결과 화면을 만들지 않는다.** 코스 카탈로그 자체가 키워드로 필터링되는 하나의 목록이므로, 모달 제출 시 `/destinations/courses?keyword=`로 바로 이동한다(§6.2). `DestinationSearchResultsPage.jsx`·`lib/tourListQuery.js`·`data/tourListConfigs.js`는 **전혀 수정하지 않는다** |
| P-5 | 상세 라우팅 (Q-5) | "별도 라우트 신설"(A) | `/destinations/courses/:id` 신설. `TravelDetailPage.jsx`의 코스 mock 분기(`item.stops` 판정)를 제거해 **코드가 오히려 단순해진다**(§6.1) |
| P-6 | 랜딩 페이지 코스 섹션 (Q-6) | "현행 유지"(B) | `DestinationsPage.jsx`의 정적 코스 섹션은 이번에 수정하지 않는다(계획 2.2와 동일) |

이 표 외에 설계 단계에서 새로 드러난 사항(계획에는 없던 것):

| # | 항목 | 내용 |
|---|------|------|
| P-7 | 코스 공개 여부 | `TourCourse` 스키마에 게시 상태 컬럼이 없다. 관리자가 저장한 코스는 저장 즉시 공개 API에 노출된다. 이번 범위에서 상태 컬럼을 새로 추가하지 않는다 — 공지사항도 생성 즉시 공개되는 것과 같은 전례를 따른다(§4.1 "확인된 제약"). 초안 저장 개념이 필요해지면 별도 후속 기능으로 분리한다 |
| P-8 | 검색 모달 구조 확장 | 여행코스 유형을 선택하면 지역(1단계)·세부 항목(3단계) 대신 키워드 입력 하나를 보여준다. `SearchModal.jsx`(여행지·즐기기 공용)에 `keywordStep` optional prop을 추가하고, `useSearchSelection`에 `keyword` 필드를 추가한다(§6.2). `EnjoySearchModal`은 이 prop을 쓰지 않으므로 동작이 바뀌지 않는다 |

---

## 1. 개요

### 1.1 설계 목표

- 여행코스 목록·상세가 실제 데이터를 정확한 총 건수와 함께 보여준다. 목업 복제를 만들지 않는다.
- destination-list-integration이 검증한 패턴(URL 상태 원천, 요청 취소, 상태별 화면 분리)을 코스에도 적용하되, **패턴만 복제**하고 관광지 전용 코드(지역 코드, 분류 코드)에 코스를 억지로 끼워 넣지 않는다.
- 코스 ID와 TourAPI contentId가 같은 판정 로직에서 절대 섞이지 않는다.
- 기존에 이미 완성된 관리자 코스 CRUD(`/api/v1/admin/courses/**`)와 destination-list-integration이 만든 공용 표시 컴포넌트에 회귀를 만들지 않는다.

### 1.2 설계 원칙

- **데이터 계층은 새로, 표시 계층은 재사용**: `useTourList`/`lib/tourListQuery.js`는 관광지 전용 쿼리 파라미터(`contentTypeId`, `lclsSystm1/2`, `lDongRegnCd`)를 전제로 만들어졌다. 코스는 이 모델에 맞지 않으므로 같은 패턴(렌더 중 파생 상태, AbortController+isActive)으로 **새 모듈**(`useCourseList`, `lib/courseListQuery.js`)을 만든다. `TourCardGrid`/`Pagination`/`ListStatus`/`TourCardSkeleton`처럼 props만 받는 순수 표시 컴포넌트는 그대로 재사용하거나(변경 없이 import), 카드처럼 정보 모양이 다르면 같은 CSS 클래스를 쓰는 병렬 컴포넌트(`CourseCard`)를 새로 만든다.
- **이미 검증된 코드는 건드리지 않는다**: `DestinationSearchResultsPage.jsx`, `data/tourListConfigs.js`, `lib/tourListQuery.js`는 destination-list-integration에서 이미 gap 분석과 코드 리뷰를 마쳤다. 이번 기능이 그 파일들을 수정하면 이미 끝난 검증이 무효화된다. 그래서 코스 검색은 독립된 경로(카탈로그로 직행)를 택한다(P-4).
- **fail-closed**: 공개 API 응답이 배열/필수 필드를 만족하지 않으면 성공으로 보지 않는다(destination-list-integration과 동일 원칙).
- **거짓 UI 금지**: 좌표가 없는 CUSTOM 경유지에는 "지도에서 보기" 버튼을 아예 렌더링하지 않는다(눌러도 아무 일 없는 버튼을 만들지 않는다).
- 새 의존성은 추가하지 않는다(지도 SDK 없이 URL 딥링크만 사용).

---

## 2. 아키텍처

### 2.1 구성도

```
                    URL (?keyword=&page=)                         URL (courses/:id)
                          │ 유일한 상태 원천                              │
                          ▼                                            ▼
                TourCourseCatalogPage                          TourCourseDetailPage
                          │                                            │
              useCourseListSearchParams                         useCourseDetail(id)
              parseCourseListQuery / serialize                        │
              (lib/courseListQuery.js, 순수)                          │
                          │                                    ┌──────┴──────┐
                          ▼                                    ▼             ▼
                   CourseListView (컨테이너)              REFERENCE stop  CUSTOM stop
                    │ useCourseList(query)              getTourDetailPath  이름·주소
                    │   ├ AbortController + isActive      (여행지 상세 링크)  + 좌표 있으면
                    │   └ fetchCourseList(query, {signal})                  카카오맵 딥링크
                    ▼        │
        ┌───────┬─────┬──────┴────┬────────┐         apiClient.get('/api/v1/courses?...')
      loading refreshing empty  success   error
   CourseCardSkeleton (aria-busy) ListStatus CourseCardGrid ListStatus
    (재사용, count만 다름)                    + Pagination(재사용)  (재사용)

TravelSearchModal ── 유형='여행코스' 선택 ──▶ SearchModal(keywordStep 모드)
                                              └▶ navigate('/destinations/courses?keyword=...')
                                                 (검색 결과 전용 화면 없음, P-4)
```

### 2.2 모듈과 분리 근거

| 모듈 | 역할 | 분리 근거 |
|------|------|-----------|
| `lib/courseListQuery.js` | URL ↔ 코스 목록 query 파싱·정규화·직렬화 | `lib/tourListQuery.js`와 파라미터 모델이 근본적으로 다름(코스는 `contentTypeId`/지역/분류가 없고 `keyword`만 있음). 합치면 두 모델을 하나의 함수가 분기 처리해야 해 오히려 복잡해진다 |
| `api/courseApi.js` | 코스 목록·상세 호출, view model 변환 | 재사용처: 카탈로그, 검색 모달 이동 경로 계산. `tourApi.js`와 응답 모양(0-based page, `content`/`totalElements`)이 다르므로 변환 로직을 분리한다 |
| `hooks/useCourseList.js` | 코스 목록 상태 머신(취소, 재시도) | `useTourList`와 상태 전이 로직(렌더 중 파생, key 비교)은 동일한 패턴이지만, 코스 쿼리가 항상 유효(하다 — "조건 없음" 상태가 없음)하므로 `idle` 분기가 없다. 별도 파일로 두어 두 도메인이 서로의 쿼리 모델을 몰라도 되게 한다 |
| `hooks/useCourseDetail.js` | 코스 상세 상태(loading/success/not-found/error, retry) | `useTourDetail`과 동일 패턴, `fetchCourseDetail` 호출만 다름 |
| `components/tour-list/CourseCard.jsx` | 코스 카드(제목, 대표 이미지, 대표 주소 배지, 일자·경유지 수) | `TourCard`와 표시 정보가 다르다(코스는 기간·경유지 수를, 여행지는 분류 배지를 보여줌). `TourCard`에 옵셔널 props를 늘리면 여행지 카드의 단순함이 깨지므로 병렬 컴포넌트로 분리한다 |
| `components/tour-list/CourseCardGrid.jsx` | 카드 그리드 | `TourCardGrid`와 그리드 레이아웃(CSS 클래스)은 같지만 `CourseCard`를 매핑해야 하므로 분리 |
| `components/tour-list/CourseListView.jsx` | 컨테이너: `useCourseList` 호출, 상태별 분기, 페이지 초과 보정 | `TourListView`는 `useTourList`를 하드코딩해서 import한다(prop으로 훅을 주입받지 않음). 이미 출시된 이 컴포넌트를 일반화하려고 수정하면 관광지·문화시설 카탈로그에 회귀 위험이 생긴다. 상태 전이 로직(스켈레톤/오류/빈 결과/페이지 초과 보정)은 그대로 복제하되 `useCourseList`+`CourseCardGrid`를 쓰는 병렬 컴포넌트로 만든다 |
| `pages/TourCourseCatalogPage.jsx` | 코스 목록 페이지(신규, `DestinationCatalogPage`의 course 분기를 대체) | 관광지·문화시설이 이미 `TourCatalogPage`로 분리돼 있는 것과 대칭. `DestinationCatalogPage.jsx`는 이제 쓰는 곳이 없어지므로 삭제한다 |
| `pages/TourCourseDetailPage.jsx` | 코스 상세 페이지(신규, `TravelCourseDetailPage.jsx` 대체) | 목업 전제(문자열 배열 `stops`, 좌표 없음)와 실제 스키마(중첩 객체, 좌표·이미지)가 근본적으로 달라 기존 파일을 고치는 것보다 새로 작성하는 편이 안전하다. 기존 파일은 삭제한다 |
| `dto/TourCoursePublicListItemResponse.java` (백엔드) | 공개 목록 행(일자·경유지 수, 대표 주소 포함) | 관리자 목록 응답(`TourCourseListItemResponse`)은 이 필드들을 의도적으로 뺐다(N+1 회피 결정 문서화됨, admin-dashboard report). 그 결정을 뒤집지 않고 공개 목록 전용 응답을 새로 만든다 |
| `service/TourCoursePublicService.java` (백엔드) | 읽기 전용 조회 | `TourCourseAdminService`는 CRUD 메서드를 포함한다. 공개 컨트롤러가 이 서비스를 직접 호출하면 쓰기 메서드에 실수로 접근할 경로가 생긴다. 읽기 전용 서비스를 분리해 공개 컨트롤러가 물리적으로 쓰기 메서드를 호출할 수 없게 한다 |

### 2.3 상태의 원천과 데이터 흐름

| 상태 | 위치 | 이유 |
|------|------|------|
| 목록 조건(`keyword`, `page`) | **URL** | destination-list-integration과 동일 근거(뒤로 가기 복원, 공유 가능) |
| 파싱한 query | 렌더 중 계산(파생값) | URL과 어긋날 수 없음 |
| 코스 목록 요청 상태·결과 | `useCourseList` 내부 state | 서버 상태, 이 화면만 필요 |
| 코스 상세 데이터 | `useCourseDetail` 내부 state | 서버 상태, `key={id}`로 재마운트해 id 변경 시 항상 loading부터 시작(`useTourDetail`과 동일 전제) |
| 검색 모달 선택값(지역/유형/세부/**키워드**) | `useSearchSelection`(모달 마운트 동안만) | 기존 훅에 `keyword` 필드만 추가 |

Context·전역 store는 쓰지 않는다.

**히스토리 정책**은 destination-list-integration과 동일하게 유지한다: 키워드·페이지 변경은 push, 모달 "검색"은 push, 페이지 초과 보정은 replace.

---

## 3. 데이터 모델

### 3.1 URL 스키마 (코스 목록)

| 파라미터 | 허용값 | 기본값(URL에서 생략) |
|----------|--------|----------------------|
| `keyword` | 임의 문자열, trim, 255자 초과분은 자름 | 없음 = 전체 |
| `page` | `/^[1-9]\d{0,3}$/` | `1` |

예시: `/destinations/courses?keyword=제주&page=2`

**차이점**: 관광지 목록(`lib/tourListQuery.js`)과 달리 코스 목록은 **"조건 없음(no-query)" 상태가 없다.** `contentTypeId` 같은 필수 파라미터가 없으므로, URL에 아무 파라미터가 없어도 곧바로 전체 코스 목록을 요청한다(관리자 목록·공지 목록과 같은 컨벤션).

**공개 계약** (`lib/courseListQuery.js`)

```js
export const COURSE_LIST_PAGE_SIZE = 9   // 관광지 카탈로그와 동일한 화면 밀도(destination-list-integration 관례 유지)

export function parseCourseListQuery(searchParams)   // → { keyword: string, page: number }  (null 없음)
export function serializeCourseListQuery(query)      // → URLSearchParams (keyword 없으면 생략, page=1 생략)
export function applyCourseQueryPatch(query, patch)  // → CourseListQuery (keyword 바뀌면 page=1로 리셋)
export function buildCourseListPath(query)           // → '/destinations/courses?...' (검색 모달에서 사용, P-4)
```

정규화 규칙은 `lib/tourListQuery.js`의 원칙을 그대로 따른다: 허용되지 않는 `page`(숫자 아님, 범위 밖)는 기본값으로 정규화하고 `replace`로 URL을 교정한다(§3.2와 동일 이유).

### 3.2 코스 목록 view model

**`CourseCard`** (`toCourseCard(item)`)

| 필드 | 원천(공개 API) | 규칙 |
|------|-----------------|------|
| `id` | `id` | 코스 PK(정수). 문자열로 변환해 카드 key·경로에 사용 |
| `title` | `title` | trim. 비면 카드를 버린다(fail-closed) |
| `theme` | `theme` | nullable. 카드 배지에 표시(없으면 배지 생략) |
| `image` | `coverImageUrl` | 없으면 null → 카드가 기본 이미지 사용(`TourCard`와 동일 자산) |
| `dayCount` | `dayCount` | "1박 2일" 같은 문구로 변환(`formatDuration(dayCount)`: 1→"당일치기", 2→"1박 2일", n→"(n-1)박 (n)일") |
| `stopCount` | `stopCount` | "N곳" 문구 |
| `representativeAddress` | `representativeAddress` | nullable(1일차 경유지가 없거나 주소가 비었을 수 있음). 없으면 배지를 표시하지 않는다 |
| `detailPath` | `id`로 계산 | `getCourseDetailPath(id)` → `/destinations/courses/{id}` (§6.1 신규 헬퍼) |

**`CourseListResult`** (`toCourseList(data, requestedSize, requestedPage)`)

```js
{ items: CourseCard[], totalCount: number, page: number, totalPages: number }
```

- 백엔드 `PageResponse`(0-based `page`, `content`, `totalElements`, `totalPages`)를 프론트 관례(1-based `page`, `totalCount`)로 변환한다. destination-list-integration의 `/api/v1/search` 응답(`{items,page,size,totalCount}`)과 모양이 다르지만, `toCourseList`가 흡수하므로 `CourseListView`·`Pagination`은 두 도메인의 API 차이를 몰라도 된다.
- **fail-closed**: `data.content`가 배열이 아니거나 `totalElements`가 0 이상 정수가 아니면 `Error`.

**`CourseDetail`** (`toCourseDetail(data)`)

공개 상세 응답은 관리자 상세(`TourCourseResponse`, admin-dashboard.design.md §3.3.5)와 **같은 모양**을 그대로 쓴다(§4.1에서 이유 설명). view model 변환은 `adminCourseApi.js`의 `toCourseDetail`/`toDay`/`toStop`/`toStopImage`와 사실상 동일한 로직이지만, 공개 API 모듈이 관리자 API 모듈을 import하면 인증이 필요 없는 화면이 인증이 필요한 모듈에 의존하는 것처럼 보여 혼동을 줄 수 있으므로 `courseApi.js`에 독립적으로 둔다(코드 3~4줄 중복은 이 경우 "재사용"보다 "이유 있는 분리"에 해당한다, destination-list-integration 설계 원칙과 동일).

```js
// CourseDetail
{
  id, title, theme, coverImageUrl,
  days: [{ id, dayNumber, stops: [{
    id, sortOrder, stopType: 'REFERENCE' | 'CUSTOM',
    tourContentId, tourContentTypeId, name, address, latitude, longitude,
    images: [{ id, url, sortOrder }],
  }] }],
}
```

---

## 4. API 명세

### 4.1 신규 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/v1/courses` | 공개 코스 목록(키워드·페이지네이션, 일자·경유지 수·대표 주소 포함) | 불필요(permitAll) |
| GET | `/api/v1/courses/{id}` | 공개 코스 상세(관리자 상세와 동일한 중첩 구조) | 불필요(permitAll) |

기존 `/api/v1/admin/courses/**`는 변경하지 않는다.

**확인된 제약(P-7)**: `TourCourse`에 게시 상태 컬럼이 없으므로 관리자가 저장한 모든 코스가 두 엔드포인트에 즉시 노출된다. 이번 기능은 이 동작을 그대로 받아들인다(공지사항도 저장 즉시 공개되는 것과 동일한 전례). 초안 저장이 필요해지면 `TourCourse`에 상태 컬럼을 추가하는 별도 후속 기능으로 분리한다.

### 4.2 목록 집계 쿼리 설계 (N+1 방지)

관리자 목록이 일자·경유지 수를 뺀 이유(N+1)를 그대로 두고, 공개 목록에서만 **페이지당 쿼리 3개**(검색 1 + 집계 2)로 필요한 정보를 채운다. 페이지 안 행 수가 늘어나도 쿼리 수는 늘지 않는다.

```java
// dto/TourCourseAggregateProjection.java (신규)
public record TourCourseAggregateProjection(Long courseId, long dayCount, long stopCount) {}
```

```java
// repository/TourCourseRepository.java — 기존 메서드는 그대로 두고 2개 추가

@Query("""
    select new kr.co.mycom.travel_korea.tourcourse.dto.TourCourseAggregateProjection(
        d.course.id, count(distinct d.id), count(s.id))
    from TourCourseDay d left join d.stops s
    where d.course.id in :courseIds
    group by d.course.id
""")
List<TourCourseAggregateProjection> aggregateCounts(@Param("courseIds") List<Long> courseIds);

// 1일차의 경유지를 sortOrder 순으로 가져온다. 코스별 "첫 경유지"는 서비스에서
// 이 리스트를 courseId 순서대로 훑으며 처음 만나는 행만 취한다(= sortOrder 최솟값).
@Query("""
    select s from TourCourseStop s
    where s.day.dayNumber = 1 and s.day.course.id in :courseIds
    order by s.day.course.id asc, s.sortOrder asc
""")
List<TourCourseStop> findFirstDayStopsOrderedByCourse(@Param("courseIds") List<Long> courseIds);
```

```java
// service/TourCoursePublicService.java (신규, 읽기 전용)
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TourCoursePublicService {

    private final TourCourseRepository courseRepository;
    private final StorageService storageService;

    public PageResponse<TourCoursePublicListItemResponse> list(String keyword, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id"));

        // 관리자 목록과 같은 search()를 그대로 재사용한다(days를 fetch하지 않으므로 여기서도 N+1 없음).
        Page<TourCourse> result = courseRepository.search(keyword, pageable);
        List<Long> ids = result.getContent().stream().map(TourCourse::getId).toList();

        Map<Long, TourCourseAggregateProjection> aggregates = courseRepository.aggregateCounts(ids).stream()
                .collect(Collectors.toMap(TourCourseAggregateProjection::courseId, a -> a));

        Map<Long, String> firstAddressByCourseId = new LinkedHashMap<>();
        for (TourCourseStop stop : courseRepository.findFirstDayStopsOrderedByCourse(ids)) {
            // sortOrder 오름차순으로 순회하므로 각 courseId의 "처음 만나는" 행이 곧 1일차 첫 경유지다.
            firstAddressByCourseId.putIfAbsent(stop.getDay().getCourse().getId(), stop.getAddress());
        }

        Page<TourCoursePublicListItemResponse> mapped = result.map(course -> {
            TourCourseAggregateProjection agg = aggregates.get(course.getId());
            return TourCoursePublicListItemResponse.from(
                    course,
                    agg == null ? 0 : agg.dayCount(),
                    agg == null ? 0 : agg.stopCount(),
                    firstAddressByCourseId.get(course.getId()),
                    this::toReadableUrl
            );
        });

        return PageResponse.from(mapped);
    }

    public TourCourseResponse getOne(Long id) {
        // 관리자 상세와 완전히 같은 응답(§3.2 "이유 있는 분리" 참고 — DTO는 같아도 서비스는 분리).
        TourCourse course = courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("여행코스를 찾을 수 없습니다."));
        return TourCourseResponse.from(course, this::toReadableUrl);
    }

    private String toReadableUrl(String objectKey) { /* TourCourseAdminService.toReadableUrl과 동일 로직 */ }
}
```

```java
// dto/TourCoursePublicListItemResponse.java (신규)
public record TourCoursePublicListItemResponse(
        Long id, String title, String theme, String coverImageUrl,
        long dayCount, long stopCount, String representativeAddress
) {
    public static TourCoursePublicListItemResponse from(
            TourCourse course, long dayCount, long stopCount, String representativeAddress,
            Function<String, String> urlResolver) {
        String objectKey = course.getCoverImageObjectKey();
        return new TourCoursePublicListItemResponse(
                course.getId(), course.getTitle(), course.getTheme(),
                (objectKey == null || objectKey.isBlank()) ? null : urlResolver.apply(objectKey),
                dayCount, stopCount, representativeAddress
        );
    }
}
```

```java
// controller/TourCoursePublicController.java (신규)
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/courses")
public class TourCoursePublicController {

    private final TourCoursePublicService tourCoursePublicService;

    @GetMapping
    public PageResponse<TourCoursePublicListItemResponse> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "9") int size) {
        return tourCoursePublicService.list(keyword, page, size);
    }

    @GetMapping("/{id}")
    public TourCourseResponse getOne(@PathVariable Long id) {
        return tourCoursePublicService.getOne(id);
    }
}
```

없는 id를 조회하면 관리자 상세와 같은 컨벤션(`IllegalArgumentException` → 기존 `GlobalExceptionHandler`가 400으로 변환)을 따른다. 프론트 `useCourseDetail`은 `useTourDetail`과 동일하게 400/404를 not-found로 취급한다(§7.2).

### 4.3 `SecurityConfig` 변경

```java
// 기존 56번째 줄 "/api/v1/notices" permitAll 규칙 옆에 추가
.requestMatchers(HttpMethod.GET, "/api/v1/courses", "/api/v1/courses/**").permitAll()
```

`HttpMethod.GET`으로 한정해, 혹시 나중에 `/api/v1/courses` 아래 쓰기 메서드가 추가되더라도 실수로 permitAll이 상속되지 않게 한다(`/api/v1/notices`가 `HttpMethod` 한정 없이 permitAll인 것과 다른 점 — 코스는 공개 컨트롤러 자체가 GET만 가지므로 더 엄격하게 잠가도 손해가 없다).

---

## 5. REFERENCE / CUSTOM 경유지 표시 (Q-1, Q-2)

### 5.1 REFERENCE — 항상 링크 (Q-2 결정)

```jsx
// TourCourseDetailPage.jsx 안, 경유지 렌더링 부분(의사 코드)
const detailPath = stop.stopType === 'REFERENCE'
  ? getTourDetailPath(stop.tourContentId, stop.tourContentTypeId)   // 기존 함수 재사용, tourContentTypes.js 변경 없음
  : null

{detailPath
  ? <Link to={detailPath}>{stop.name} 상세 보기</Link>
  : <span>{stop.name}</span>}
```

`getTourDetailPath`가 `null`을 반환하는 경우(스냅샷의 `tourContentTypeId`가 12·14·15·28·39·38·32 밖일 때)는 이론상 발생하지 않는다 — 관리자 폼(`TourReferencePicker`, admin-dashboard report §94)이 애초에 이 값들로만 REFERENCE 경유지를 만들기 때문이다. 다만 방어적으로 `null`이면 CUSTOM과 같은 텍스트 표시로 폴백한다(fail-closed).

### 5.2 CUSTOM — 좌표 있으면 카카오맵 딥링크 (Q-1 결정)

기존 코드에 지도 API 연동이 없으므로(전부 "지도 API 연동 영역" 플레이스홀더, `TravelDetailPage.jsx:170`, `TravelCourseDetailPage.jsx:34`, `EnjoyDetailPage.jsx:143`도 동일), 이번 기능이 이 프로젝트 최초의 지도 딥링크다. API 키가 필요 없는 카카오맵 공개 웹 링크 스킴을 쓴다.

```js
// courseApi.js 또는 별도 lib/mapLink.js
export function buildKakaoMapLink({ name, latitude, longitude }) {
  if (latitude == null || longitude == null) return null
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${latitude},${longitude}`
}
```

```jsx
// CUSTOM 경유지 렌더링(의사 코드)
const mapLink = stop.stopType === 'CUSTOM' ? buildKakaoMapLink(stop) : null

<div>
  <strong>{stop.name}</strong>
  {stop.address && <p>{stop.address}</p>}
  {mapLink && <a href={mapLink} target="_blank" rel="noopener noreferrer">지도에서 보기</a>}
</div>
```

- 좌표가 없으면(관리자가 주소만 입력하고 좌표를 비운 경우, admin-dashboard design §3.3.2에서 이미 허용된 케이스) 버튼을 렌더링하지 않는다(거짓 UI 금지 원칙).
- `target="_blank"` + `rel="noopener noreferrer"`로 외부 링크를 새 탭에 연다(코스 상세 화면 이탈 방지).
- 카카오맵을 고른 이유: (1) 국내 여행 서비스로서 브랜드 맥락에 맞음(로그인 화면에 이미 "카카오로 시작하기" 옵션 존재), (2) 이 스킴은 JS SDK 없이 URL 조합만으로 동작해 앱키·SDK 로드가 필요 없음, (3) 좌표 3개 값만 있으면 되므로 테스트가 쉬움(면접에서 "왜 지도 SDK를 새로 안 붙였는가"를 설명할 수 있는 지점).

### 5.3 카드의 대표 지역 배지 (Q-3 P-3)

목록 카드(`CourseCard`)는 `representativeAddress`가 있으면 관광지 카드와 같은 위치 아이콘(`PlacePinIcon`)과 함께 표시하고, 없으면(1일차 경유지가 없거나 주소가 비어 있으면) 배지 자체를 생략한다. "지역 미상"처럼 빈 정보를 억지로 채우지 않는다(fail-closed 원칙과 동일한 결).

---

## 6. 라우팅과 페이지 구성 (Q-5)

### 6.1 라우트 변경

```jsx
// App.jsx — 기존
<Route path="/destinations/courses" element={<DestinationCatalogPage kind="course" />} />

// App.jsx — 변경 후
<Route path="/destinations/courses" element={<TourCourseCatalogPage />} />
<Route path="/destinations/courses/:id" element={<TourCourseDetailPage />} />
```

`getCourseDetailPath(id)`(신규, `courseApi.js`에 둔다)가 `/destinations/courses/${id}`를 만든다. `getTourDetailPath`(관광지·즐기기 전용, `tourContentTypes.js`)는 **변경하지 않는다** — 두 함수는 서로 다른 ID 네임스페이스를 다루므로 하나로 합치면 오히려 Q-5가 없애려던 혼동이 재발한다.

### 6.2 `TravelDetailPage.jsx` 단순화

기존 코드는 `resolveDestinationDetail`에서 "목업에 있으면 mock, 그중 `item.stops`가 있으면 코스"라는 분기를 가진다(`TravelDetailPage.jsx:28-36, 70-73`). 코스가 별도 라우트로 옮겨가면 이 특수 분기가 필요 없어진다.

```diff
  if (resolved.kind === 'mock') {
    const { item } = resolved
-   if (item.stops) return <TravelCourseDetailPage key={id} item={item} />
    return <TravelDetailView key={id} detail={toDestinationMockDetail(item)} backTo={getMockBackTo(item)} />
  }
```

`data/destinationMocks.js`에서 `courseItems`와 `allDestinationMocks`의 코스 스프레드를 제거한다. `destinationItems`/`cultureItems`(관광지·문화시설 상세 목업 분기, destination-list-integration D-5로 유지 결정된 부분)는 **손대지 않는다**.

**삭제 대상**: `pages/TravelCourseDetailPage.jsx`, `pages/TravelCourseDetailPage.css`, `pages/DestinationCatalogPage.jsx`(course 전용 분기만 남아 있던 컴포넌트이므로 `TourCourseCatalogPage`로 완전히 대체된다).

**의도적 편차(구현 단계에서 확인)**: `pages/DestinationCatalogPage.css`는 삭제하지 않는다. 애초에 `catalog-*` 클래스는 `DestinationCatalogPage.jsx` 하나만 위한 것이 아니라, `TourCatalogPage.jsx`(관광지·문화시설)와 `DestinationSearchResultsPage.jsx`(검색 결과)가 이미 같은 파일을 import해 공유하는 자산이었다(destination-list-integration에서 확립된 구조). `TourCourseCatalogPage.jsx`도 같은 이유로 이 CSS를 그대로 import한다. 따라서 이 파일은 "코스 전용 잔재"가 아니라 "3개 페이지가 공유하는 카탈로그 공통 스타일"이며, 파일명(`DestinationCatalogPage.css`)만 그 원래 컴포넌트 이름을 남긴 상태로 유지한다. 삭제하면 세 페이지의 빌드가 깨지므로 리네이밍도 하지 않는다(과잉 엔지니어링 방지 — 클래스 이름과 파일 이름의 유래를 코드 주석으로 남기는 것으로 충분하다).

이 변경은 위험 항목(계획 5장 "코스 ID·contentId 충돌", "TravelCourseDetailPage 재작성")을 동시에 해소하면서 코드량을 순감소시킨다.

---

## 7. 코스 목록 화면

### 7.1 `TourCourseCatalogPage.jsx`

```jsx
export default function TourCourseCatalogPage() {
  const { query, updateQuery } = useCourseListSearchParams()   // useListSearchParams와 대칭되는 코스 전용 훅
  const handlePageChange = (page, options) => updateQuery({ page }, options)
  const handleKeywordChange = keyword => updateQuery({ keyword })   // page는 applyCourseQueryPatch가 1로 리셋

  return (
    <div className="catalog-page">
      <main className="catalog-main">
        <p className="catalog-breadcrumb">홈 › 여행지 › 여행코스</p>
        <div className="catalog-title"><h1>코스를 따라 떠나는 여행</h1><p>여러 장소를 순서대로 둘러보는 추천 코스를 확인해 보세요.</p></div>
        <CourseSearchBox value={query.keyword} onChange={handleKeywordChange} />
        <CourseListView query={query} onPageChange={handlePageChange} onReset={() => updateQuery({ keyword: '' })} resetLabel="검색어 지우기" />
      </main>
    </div>
  )
}
```

- `catalog-page`/`catalog-main`/`catalog-breadcrumb`/`catalog-title` CSS 클래스는 기존 `DestinationCatalogPage.css`·`TourCatalogPage.css`와 공유해 시각적 일관성을 유지한다(새 CSS 파일은 `CourseSearchBox`, `CourseCard`의 추가 정보 영역 정도만 최소로 늘린다).
- 코스 목록은 **탭(테마별)이 없다.** `TourCourse.theme`이 자유 텍스트라 정형 탭을 만들 근거 데이터가 없다는 계획의 위험 분석을 그대로 따른다. 대신 키워드 검색창 하나로 테마·제목을 함께 검색한다(백엔드 `search` 쿼리가 이미 title·theme 둘 다 검색함, §4.2 참고 리포지토리 코드).

### 7.2 `CourseListView.jsx` (`TourListView` 패턴 복제)

`useTourList` 대신 `useCourseList`를 호출하고, "조건 없음(no-query)" 분기가 없다는 점만 제외하면 상태 전이·페이지 초과 보정 로직은 `TourListView`와 동일하다.

```js
export function useCourseList(query) {
  const queryKey = serializeCourseListQuery(query).toString()   // 항상 유효(코스는 idle 없음)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${queryKey}#${attempt}`
  const [settled, setSettled] = useState({ key: null, status: null, data: null, errorKind: null })

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    fetchCourseList(query, { signal: controller.signal })
      .then(data => { if (isActive) setSettled({ key: requestKey, status: 'success', data, errorKind: null }) })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        setSettled({ key: requestKey, status: 'error', data: null, errorKind: 'failed' })
      })
    return () => { isActive = false; controller.abort() }
  }, [requestKey])

  const retry = useCallback(() => setAttempt(v => v + 1), [])

  if (settled.key === requestKey) return { ...settled, retry, hasRetried: attempt > 0 }
  const previous = settled.status === 'success' ? settled.data : null
  return { status: previous ? 'refreshing' : 'loading', data: previous, errorKind: null, retry, hasRetried: attempt > 0 }
}
```

(`useTourList`의 §2.4 상태 머신 설명·경쟁 조건 방어 근거를 그대로 인용한다 — destination-list-integration.design.md §2.4. 코스는 `invalid`(400) 오류 분기가 필요 없다: URL 정규화가 실패할 수 있는 파라미터가 `page` 하나뿐이고, 정규화 단계에서 이미 걸러지므로 백엔드가 400을 돌려줄 조건 자체가 거의 없다. 만에 하나 400이 와도 `failed`로 묶어 재시도 버튼을 보여준다.)

`CourseListView`는 `TourListView`와 같은 렌더 분기(스켈레톤 → 그리드/빈 상태/오류 → 페이지네이션)를 갖되 `TourCardGrid` 대신 `CourseCardGrid`를 렌더링한다. `ListStatus`·`Pagination`·`TourCardSkeleton`(카드 개수만 `COURSE_LIST_PAGE_SIZE`로 다름)은 **수정 없이 그대로 import**한다.

### 7.3 `CourseCard.jsx`

```jsx
export default function CourseCard({ card }) {
  const [isImageBroken, setIsImageBroken] = useState(false)
  const image = card.image && !isImageBroken ? card.image : defaultImage

  return (
    <article className="catalog-card">
      <Link className="catalog-card__link" to={card.detailPath}>
        <img className="tour-list__card-image" src={image} alt="" loading="lazy" decoding="async" onError={() => setIsImageBroken(true)} />
        {card.theme && <span className="catalog-card__image-tag">{card.theme}</span>}
        <div className="tour-list__card-body">
          <h2 className="tour-list__card-title">{card.title}</h2>
          <small className="tour-list__card-meta">
            {formatDuration(card.dayCount)} · {card.stopCount}곳
          </small>
          {card.representativeAddress && (
            <small className="catalog-address tour-list__card-address">
              <PlacePinIcon /><span>{card.representativeAddress}</span>
            </small>
          )}
        </div>
      </Link>
    </article>
  )
}
```

`TourCard.jsx`와 마크업 골격(`catalog-card`, `tour-list__card-*` 클래스)이 같아 그리드 안에서 시각적으로 이질감이 없다. 차이는 분류 배지 대신 테마 배지, 그리고 기간·경유지 수 한 줄이 추가된 것뿐이다.

---

## 8. 코스 상세 화면

### 8.1 `useCourseDetail.js` (`useTourDetail` 패턴 복제)

```js
export function useCourseDetail(id) {
  const [state, setState] = useState({ status: 'loading', detail: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let isActive = true
    fetchCourseDetail(id)
      .then(detail => { if (isActive) setState({ status: 'success', detail }) })
      .catch(error => {
        if (!isActive) return
        const isNotFound = error instanceof ApiError && (error.status === 404 || error.status === 400)
        if (!isNotFound) console.error('코스 상세 정보를 불러오지 못했습니다.', error)
        setState({ status: isNotFound ? 'not-found' : 'error', detail: null })
      })
    return () => { isActive = false }
  }, [id, attempt])

  const retry = useCallback(() => { setState({ status: 'loading', detail: null }); setAttempt(v => v + 1) }, [])
  return { ...state, retry, hasRetried: attempt > 0 }
}
```

`TourCourseDetailPage`는 `key={id}`로 재마운트해 id 변경 시 항상 `loading`부터 시작한다(`TourApiDetail.jsx`와 동일 전제, destination-list-integration §2.3).

### 8.2 화면 구성

- 히어로: 코스 대표 이미지(`coverImageUrl`, 없으면 기본 이미지), 제목, 테마, "N일 코스 · M곳" 요약(기존 `TravelCourseDetailPage.jsx`의 통계 섹션 레이아웃 재사용 — 값의 출처만 목업에서 API 응답으로 바꾼다).
- 일자별 섹션: `days`를 `dayNumber` 순회, 각 일자 안에서 `stops`를 `sortOrder` 순회. 경유지 카드는 순서 번호(STOP 01, 02...), 이름, 주소, 이미지(있으면 첫 번째 이미지 대표 노출 + 나머지는 썸네일), REFERENCE/CUSTOM에 따른 링크·지도 버튼(§5).
- 지도 섹션 전체(기존 "코스 지도 API 연동 영역")는 **이번에도 만들지 않는다**(계획 2.2, 지도 연동 자체가 범위 밖). 개별 CUSTOM 경유지의 딥링크 버튼(§5.2)과는 별개다.

---

## 9. 검색 모달 여행코스 유형 활성화 (Q-4)

### 9.1 `useSearchSelection.js` 확장

```diff
- const EMPTY_SELECTION = { region: '', district: '', type: '', detail: '' }
+ const EMPTY_SELECTION = { region: '', district: '', type: '', detail: '', keyword: '' }

  switch (action.type) {
    ...
+   case 'selectKeyword':
+     return { ...state, keyword: action.value }
    case 'reset':
      return EMPTY_SELECTION
```

`actions.selectKeyword(value)`를 추가한다. `EnjoySearchModal`은 이 필드를 참조하지 않으므로 동작이 바뀌지 않는다(기존 필드에 하나 추가하는 것은 상태 모양의 상위 호환 확장이다).

### 9.2 `SearchModal.jsx`에 `keywordStep` 모드 추가

```diff
  export default function SearchModal({
    frame, onClose, steps, selection, actions,
    regionOptions, districtOptions, typeOptions, detailOptions,
+   keywordStep,   // { title, label, placeholder, value, onChange } | undefined
    ...
  }) {
```

`keywordStep`이 주어지면 1단계(지역 선택 박스 2개)와 3단계(세부 항목 박스)를 렌더링하지 않고, 그 자리에 텍스트 입력 하나를 렌더링한다.

```jsx
{keywordStep ? (
  <div className="travel-search-modal__section">
    <h3>{keywordStep.title}</h3>
    <input
      type="text"
      className="travel-search-modal__keyword-input"
      value={keywordStep.value}
      onChange={event => keywordStep.onChange(event.target.value)}
      placeholder={keywordStep.placeholder}
      aria-label={keywordStep.label}
    />
  </div>
) : (
  <div className="travel-search-modal__section">{/* 기존 지역 선택 박스 2개 */}</div>
)}

{/* 2단계(유형 선택)는 keywordStep 여부와 무관하게 항상 렌더링 */}

{!keywordStep && (
  <div className="travel-search-modal__section">{/* 기존 세부 항목 박스 */}</div>
)}
```

`EnjoySearchModal`은 `keywordStep`을 넘기지 않으므로(prop 자체를 안 씀) 기존 3단계 구조가 그대로 유지된다.

### 9.3 `TravelSearchModal.jsx` 변경

```diff
- disabled: item.id === 'course',
- badge: item.id === 'course' ? '준비 중' : undefined,
+ // 여행코스 유형 활성화(Q-4). 지역·세부 항목 대신 키워드 검색으로 동작한다(§9.2).
```

```js
const isCourseType = selection.type === '25'

const canSubmit = isCourseType ? true : Boolean(selection.type)
// 여행코스는 유형만 선택하면 바로 검색 가능(키워드는 선택 사항 — "전체 코스 보기"도 유효한 검색이므로).
// 관광지·문화시설은 기존과 동일하게 유형 선택이 곧 canSubmit 조건.

const handleSubmit = () => {
  if (!canSubmit) return
  if (isCourseType) {
    navigate(buildCourseListPath({ keyword: selection.keyword || '', page: 1 }))
  } else {
    navigate(buildSearchResultsPath({ /* 기존과 동일 */ }))
  }
  window.scrollTo({ top: 0 })
  onClose()
}
```

`SearchModal`에는 `isCourseType`일 때만 `keywordStep={{ title: '3. 어떤 키워드로 찾을까요?', label: '코스 검색어', placeholder: '코스명이나 테마로 검색', value: selection.keyword, onChange: actions.selectKeyword }}`를 넘긴다. `summaryItems`도 `isCourseType`이면 `[{ label: '여행 유형', value: '여행코스' }, selection.keyword && { label: '검색어', value: selection.keyword }]`로 분기한다.

**결과**: 검색 모달에서 '여행코스'를 고르면 지역 선택 UI 대신 키워드 입력만 보이고, 제출하면 카탈로그(`/destinations/courses?keyword=`)로 바로 이동한다. `DestinationSearchResultsPage.jsx`는 이 경로를 전혀 거치지 않으므로 수정이 필요 없다(P-4).

---

## 10. 의존성

| 모듈 | 의존 대상 |
|------|-----------|
| `TourCourseCatalogPage` | `useCourseListSearchParams`, `CourseListView`, `lib/courseListQuery` |
| `TourCourseDetailPage` | `useCourseDetail`, `getTourDetailPath`(REFERENCE), `buildKakaoMapLink`(CUSTOM) |
| `CourseListView` | `useCourseList`, `CourseCardGrid`, `TourCardSkeleton`(재사용), `ListStatus`(재사용), `Pagination`(재사용), `listMessages`(재사용) |
| `useCourseList` | `api/courseApi`(`fetchCourseList`), `api/client`(`ApiError`, `isAbortError`), `lib/courseListQuery` |
| `useCourseDetail` | `api/courseApi`(`fetchCourseDetail`), `api/client`(`ApiError`) |
| `api/courseApi` | `api/client`, `lib/mapLink`(`buildKakaoMapLink`) |
| `TravelSearchModal` | (기존 의존성에 추가 없음) `useSearchSelection`(keyword 필드), `lib/courseListQuery`(`buildCourseListPath`) |
| `SearchModal` | (변경) `keywordStep` optional prop. `EnjoySearchModal`은 이 prop을 넘기지 않아 영향 없음 |
| `TourCoursePublicController` (백엔드) | `TourCoursePublicService` |
| `TourCoursePublicService` | `TourCourseRepository`(기존 `search`/`findById` + 신규 집계 쿼리 2개), `StorageService`(기존) |

의존 방향은 destination-list-integration과 동일하게 **페이지 → (훅, 표시 컴포넌트) → api → client**를 따른다. `lib/courseListQuery.js`는 React와 네트워크를 모른다.

---

## 11. 회귀 방지 체크리스트 (구현 단계에서 확인)

- [ ] `/api/v1/admin/courses/**` CRUD·이미지 첨부 동작이 그대로 유지된다(백엔드 서비스 분리로 회귀 없음 확인)
- [ ] `/destinations/attractions`, `/destinations/culture` 카탈로그·검색에 변화가 없다(`lib/tourListQuery.js`, `data/tourListConfigs.js`, `TourListView.jsx` 미수정 확인)
- [ ] `EnjoySearchModal`의 기존 3단계 흐름이 그대로 동작한다(`keywordStep` prop 미사용 확인)
- [ ] `/destinations/detail/:id`(관광지·문화시설 목업 + API)에 회귀가 없다(코스 분기 제거 후에도 `destinationItems`/`cultureItems` 목업 정상 동작)
- [ ] 코스 ID로 `/destinations/detail/:id`에 접근했을 때(구 URL, 있다면) 적절히 404 처리되는지 확인 — 이 라우트는 애초에 코스를 다루지 않으므로 자연히 not-found가 된다

---

## 12. 남은 열린 사항 (계획에는 없었으나 설계 중 확인 필요)

이 항목들은 Q-1~Q-6처럼 방향이 갈리는 결정이 아니라, 구현 착수 전 짧게 확인하면 되는 사실 확인성 사항이다. 사용자 승인 없이 진행해도 되는 낮은 위험으로 판단하지만, 투명성을 위해 남긴다.

| # | 항목 | 확인 방법 | 비고 |
|---|------|-----------|------|
| O-1 | `TourCourseStop.tourContentTypeId`가 실제로 12/14 외의 값(즐기기 15/28/39/38/32)을 가질 수 있는지 | `TourReferencePicker`(admin-dashboard) 코드 확인 | 관리자 UI가 관광지·문화시설 카탈로그 검색만 노출한다면 REFERENCE는 사실상 12/14로 한정될 수 있음. §5.1의 폴백은 어느 쪽이든 안전 |
| O-2 | 코스 검색(`search` 쿼리)이 대소문자·부분 일치를 지원하는지(§4.2 리포지토리 코드는 `lower(...) like`) | 이미 확인됨(`TourCourseRepository.search`) — 그대로 재사용되므로 별도 검증 불필요 | — |
| O-3 | `formatDuration(dayCount)` 문구가 기존 목업 문구("당일치기"/"1박 2일"/"2박 이상")와 자연스럽게 이어지는지 | 구현 단계에서 실제 코스 데이터로 확인 | 목업은 3종 고정 문구였지만 실제 데이터는 dayCount가 임의 정수이므로 "N박 (N+1)일" 일반식으로 확장 |

---

## 13. 다음 단계

1. [ ] 백엔드 구현: `TourCoursePublicListItemResponse`, `TourCourseAggregateProjection`, `TourCourseRepository` 신규 쿼리, `TourCoursePublicService`, `TourCoursePublicController`, `SecurityConfig` (frontend-support-backend)
2. [ ] 프론트 구현: `lib/courseListQuery.js`, `api/courseApi.js`, `hooks/useCourseList.js`/`useCourseDetail.js`, `components/tour-list/CourseCard*.jsx`/`CourseListView.jsx`, `pages/TourCourseCatalogPage.jsx`/`TourCourseDetailPage.jsx`, `SearchModal.jsx`/`TravelSearchModal.jsx`/`useSearchSelection.js` 수정, `App.jsx` 라우트 교체, 목업·구 파일 삭제 (frontend-lead)
3. [ ] 코드 리뷰(frontend-code-reviewer) + gap 분석(bkit gap-detector) — 회귀 방지 체크리스트(11장) 포함
4. [ ] 완료 보고서 → 포트폴리오 추출(frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-30 | 초안. 계획 Q-1~Q-6 결정(전부 추천안 채택) 반영. 공개 API 설계(N+1 방지 집계 쿼리 포함), REFERENCE/CUSTOM 표시(카카오맵 딥링크), 라우팅 분리, 검색 모달 키워드 모드, destination-list-integration 패턴 재사용 경계를 구체화 | WOOJIN |
| 0.2 | 2026-09-30 | 코드 리뷰 반영(구현 완료 후). §6.2 "삭제 대상"을 정정 — `DestinationCatalogPage.css`는 `TourCatalogPage`·`TourCourseCatalogPage`·`DestinationSearchResultsPage` 3곳이 공유하는 카탈로그 공통 스타일이라 삭제하지 않고 유지함을 의도적 편차로 명시 | WOOJIN |
