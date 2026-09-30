# tour-course-list-integration 계획 문서

> **요약**: admin-dashboard 기능에서 만든 여행코스 3단 스키마(코스 → 일자(Day) → 경유지(Stop, REFERENCE/CUSTOM) → 이미지)를 일반 사용자가 볼 수 있게 공개(비로그인) 조회 API와 사용자 화면을 만든다. `/destinations/courses`는 지금도 `destinationMocks.js` 목업이므로, 이번 기능이 여행지(관광지·문화시설)에 이어 마지막 남은 목업 목록·상세를 실제 데이터로 전환한다. destination-list-integration이 확립한 패턴(URL을 상태 원천으로 쓰는 목록, AbortController+isActive 경쟁 조건 방어, 로딩/에러/빈 상태 구분)을 재사용하되, 여행코스는 지역·분류 체계가 TourAPI와 달라 그대로 복사할 수 없는 지점이 여러 곳 있다. 이 문서는 그 지점을 구체적으로 짚고 사용자 결정을 요청한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-09-30
> **상태**: Approved (8장 사용자 결정 D-1 ~ D-6 반영, 2026-09-30. 전부 추천안 채택) / 설계 문서 작성 완료(`tour-course-list-integration.design.md`)
> **근거**: `docs/01-plan/features/admin-dashboard.plan.md` 4장 "여행코스 리소스의 의존관계와 작업 순서"의 후속 기능 지정, `docs/02-design/features/admin-dashboard.design.md` §3.3(스키마), `docs/04-report/features/admin-dashboard.report.md`(구현 결과·발견된 트레이드오프), `docs/01-plan/features/destination-list-integration.plan.md` D-1(분리 결정의 원 출처)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | `/destinations/courses`는 관광지·문화시설과 달리 여전히 목업 3건을 45장으로 복제해 보여준다(`DestinationCatalogPage.jsx`). 실제 여행코스는 admin-dashboard에서 이미 등록·관리되고 있지만(`/api/v1/admin/courses/**`), 이 API는 `ROLE_ADMIN` 전용이라 일반 사용자는 접근할 수 없다. 검색 모달도 여행코스 유형을 아예 비활성화(`disabled` + '준비 중' 배지)해 두었다. |
| **해결** | 여행코스 전용 공개 조회 API(`GET /api/v1/courses`, `GET /api/v1/courses/{id}`)를 신설하고, 프론트는 destination-list-integration이 만든 URL 상태·요청 취소·상태 머신 패턴을 재사용하는 여행코스 전용 목록·상세 화면을 만든다. 다만 코스에는 TourAPI식 지역 코드·분류 코드가 없으므로(코스 엔티티에 지역·기간 필드가 없음), 목록 필터·탭 구성은 그대로 복제하지 않고 이번 문서에서 새로 설계한다. |
| **기능/UX 효과** | 사용자가 실제로 등록된 여행코스를 목록에서 찾아보고, 일자별 경유지(참조/직접 입력 모두)와 이미지를 상세에서 확인할 수 있다. 검색 모달의 '여행코스' 유형이 다른 유형과 동등하게 동작한다. |
| **핵심 가치** | 같은 "목록 전환" 문제를 이미 확립한 패턴으로 얼마나 재사용할 수 있는지, 그리고 재사용이 끝나는 지점(지역 코드 체계 부재, ID 네임스페이스 충돌 위험)을 어떻게 식별하고 다르게 설계했는지를 면접에서 설명할 수 있다. "패턴 재사용"과 "무비판적 복사"의 차이를 보여주는 사례다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | admin-dashboard가 만든 여행코스 데이터를 사용자가 볼 방법이 없다. `/destinations/courses`는 여전히 목업이고, 관리자 API는 인증이 걸려 있어 재사용할 수 없다 |
| **WHO** | 여행코스를 찾아보는 방문자, 코스 상세를 보고 목록으로 돌아오는 사용자, 검색 모달에서 '여행코스' 유형을 선택하는 사용자 |
| **RISK** | 코스 ID(DB 시퀀스, 1부터 시작하는 작은 정수)가 기존 `isTourContentId`의 숫자 패턴(`/^\d{1,12}$/`)과 겹쳐, 같은 상세 라우트를 쓰면 코스 ID를 TourAPI contentId로 잘못 해석할 수 있음 / 코스 엔티티에 지역·기간 필드가 없어 관광지·문화시설과 같은 지역·탭 필터를 그대로 만들 수 없음 / 목록 카드에 보여줄 대표 주소·대표 이미지·기간 정보가 현재 응답 모양에 없음 / CUSTOM 경유지는 지도 없이 표시해야 함(admin-dashboard가 지도 연동을 이번 범위 밖으로 명시) |
| **SUCCESS** | `/destinations/courses`가 실제 등록된 코스와 정확한 총 건수를 표시 / 코스 상세가 일자별 경유지(REFERENCE/CUSTOM)와 이미지를 실제로 보여줌 / 검색 모달에서 '여행코스' 유형을 선택해 검색할 수 있음 / 로딩·에러·빈 상태 구분 / destination-list-integration의 URL 상태·요청 취소 패턴 재사용 |
| **SCOPE** | 백엔드: 공개 조회 컨트롤러·서비스(기존 `tourcourse` 패키지 재사용, 읽기 전용), `SecurityConfig` permitAll 추가 / 프론트: `courseApi.js`, 코스 전용 목록 훅과 표시 컴포넌트(destination-list-integration 컴포넌트 재사용 검토), `DestinationCatalogPage` course 분기 제거 후 API 전환, 코스 상세 화면(REFERENCE 링크, CUSTOM 텍스트 표시), 검색 모달 여행코스 유형 활성화 |

---

## 1. 개요

### 1.1 목적

일반 사용자가 admin-dashboard에서 관리자가 등록한 여행코스를 실제로 찾아보고 상세를 확인할 수 있게 한다. 목업으로 남아 있던 마지막 목록·상세 화면을 실제 데이터로 전환해, 여행지 탐색 흐름(검색 → 목록 → 상세)을 여행코스까지 완성한다.

### 1.2 배경 (코드 확인 결과)

**현재 상태**

| 화면/기능 | 위치 | 현재 상태 | 문제 |
|-----------|------|-----------|------|
| 코스 목록 | `/destinations/courses` → `DestinationCatalogPage.jsx` (`kind="course"`) | `courseItems`(목업 3건, `destinationMocks.js:26-30`)를 45장으로 복제, 로컬 state 필터·페이지 | 실제 코스 데이터 없음, 목업 복제 패턴(destination-list-integration이 관광지·문화시설에서 이미 제거한 문제)이 코스에만 남아 있음 |
| 코스 상세 | `/destinations/detail/:id` → `TravelDetailPage.jsx:70-73` → `TravelCourseDetailPage.jsx` | `item.stops`(문자열 배열)가 있으면 코스 상세로 분기. `stops: ['성심당 본점', ...]`처럼 이름만 있는 배열이라 좌표·이미지·경유지 상세가 없음 | 실제 스키마(REFERENCE/CUSTOM, 이미지, 좌표)를 표현할 수 없는 구조 |
| 검색 모달 | `TravelSearchModal.jsx:19-31` | 유형 선택지에 '여행코스'(`value: '25'`)가 있지만 `disabled: true`, `badge: '준비 중'` (destination-list-integration 설계 문서 Q-5 결정) | 여행코스를 조건으로 검색할 수 없음 |
| 관리자 코스 API | `backend/.../tourcourse/**`, `/api/v1/admin/courses/**` | 완성됨(admin-dashboard). `ROLE_ADMIN` 전용 | 일반 사용자가 호출하면 401/403 |
| 관리자 코스 목록 응답 | `TourCourseListItemResponse` (admin-dashboard report 코드 리뷰 항목) | 일자 수·경유지 수를 포함하지 않음(N+1 회피, 의도적 트레이드오프로 문서화됨) | 공개 목록 카드에 "2박 3일 · 5곳" 같은 정보를 그대로 못 씀 |
| `TourCourse` 엔티티 | `admin-dashboard.design.md §3.3.1` | 컬럼: `id`, `title`, `theme`(자유 텍스트), `coverImageObjectKey` | **지역 컬럼이 없다.** 대표 지역이 필요하면 일자 1의 경유지 주소에서 유추하거나, 새 컬럼을 추가해야 한다 |
| ID 네임스페이스 | `tourContentTypes.js:15-18` | `isTourContentId(id)`가 `/^\d{1,12}$/`로 판정. `TravelDetailPage.jsx:28-36`이 목업에 없고 이 패턴에 맞으면 무조건 TourAPI 상세 API를 호출 | 코스 ID(1, 2, 3, ...)가 이 패턴과 겹친다. 코스 목업(`item.stops` 분기)을 지우고 코스 ID를 같은 라우트에 그대로 얹으면, 코스 ID "1"이 TourAPI contentId "1"로 오인될 위험이 있다 |

**admin-dashboard가 이미 남긴 이정표**

- `docs/01-plan/features/admin-dashboard.plan.md` 4장이 이 기능을 "후속 기능(가칭 `tour-course-list-integration`)"으로 이미 지정했고, 다음을 명시했다: "REFERENCE 타입 경유지를 여행지 상세로 링크할 수 있지만, CUSTOM 타입 경유지(좌표만 있는 임의 장소)는 지도 API 연동 전까지 이름·주소 텍스트로만 보여준다."
- `docs/04-report/features/admin-dashboard.report.md`는 여행코스-피드 연동을 "§8 미해결 사항, 사용자가 명시적으로 유보"라고 남겼다. 이번 기능도 그 연동을 다루지 않는다(2.2 제외).
- 같은 보고서는 "여행코스 목록에 일자/경유지 수 미표시"를 "여유 범위(G-A1), N+1 회피를 위한 트레이드오프"로 문서화했다. 공개 목록에서 이 정보를 보여줄지는 이번 기능이 새로 결정해야 한다(8장 D-3).

**공개 API로 재사용 가능한 것 / 새로 만들어야 하는 것**

| 항목 | 관리자 API에 이미 있음 | 공개 API에 그대로 재사용 가능? |
|------|------------------------|-------------------------------|
| 코스 상세 중첩 구조(코스-일자-경유지-이미지) | 있음 (`GET /admin/courses/{id}`) | 응답 모양은 재사용 가능. 인증만 제거 |
| 이미지 URL 변환(`StorageService.createReadUrl`) | 있음 | 그대로 재사용 |
| 목록 검색(키워드, 페이지네이션) | 있음 (`GET /admin/courses`) | 응답 모양은 재사용 가능하나, 지역 필터가 없고 일자/경유지 수도 없음(위 표) |
| 지역별 필터 | 없음 | **신규 설계 필요** (8장 D-3) |
| 소프트 삭제/게시 상태(공개 여부) | 없음. `TourCourse`에 게시 여부 컬럼이 없어 보이므로, 관리자가 만든 코스는 저장 즉시 전부 "공개"로 취급됨 | 확인 필요 — 초안 작성 중인 코스도 바로 노출되는지 설계 단계에서 점검 |

### 1.3 관련 문서

- 원 결정: `docs/01-plan/features/destination-list-integration.plan.md` D-1 (여행코스 분리 결정)
- 선행 기능(스키마 출처): `docs/01-plan/features/admin-dashboard.plan.md` 4장, `docs/02-design/features/admin-dashboard.design.md` §3.3, `docs/04-report/features/admin-dashboard.report.md`
- 재사용 대상 패턴: `docs/02-design/features/destination-list-integration.design.md` (URL 상태, `useTourList` 상태 머신, `SearchModalFrame`/`SearchOptionGroup`)

---

## 2. 범위

### 2.1 포함

- [ ] 백엔드: 공개 여행코스 조회 API 신설 — `GET /api/v1/courses`(목록), `GET /api/v1/courses/{id}`(상세). 기존 `tourcourse` 패키지의 리포지토리·서비스를 읽기 전용으로 재사용하고, 새 컨트롤러만 추가(관리자 CRUD 서비스는 건드리지 않음)
- [ ] 백엔드: `SecurityConfig`에 `/api/v1/courses`, `/api/v1/courses/**`를 `permitAll`로 추가
- [ ] 백엔드: 8장 사용자 결정에 따라 목록 응답에 지역·기간·경유지 수 등 표시용 필드를 추가할지 확정하고 구현
- [ ] 프론트: `api/courseApi.js` — `fetchCourseList`, `fetchCourseDetail`, view model 변환
- [ ] 프론트: 코스 전용 목록 훅(`useCourseList`, `useTourList`와 같은 렌더 중 파생 상태 머신 패턴 재사용) 및 URL 상태(`useSearchParams`)
- [ ] 프론트: `DestinationCatalogPage`의 course 목업 분기 제거, 코스 목록을 API 목록으로 전환 (관광지·문화시설처럼 `TourCatalogPage` 계열에 합류할지, 별도 컴포넌트로 둘지는 7장에서 결정)
- [ ] 프론트: 코스 상세 화면 — 실제 스키마(일자·경유지·이미지) 렌더링, REFERENCE 경유지의 여행지 상세 링크(8장 D-2), CUSTOM 경유지의 지도 없는 표시(8장 D-1)
- [ ] 프론트: 코스 상세 라우팅 방식 확정 및 구현 (기존 `/destinations/detail/:id` 재사용 여부, 8장 D-5)
- [ ] 프론트: 검색 모달 '여행코스' 유형 활성화 (`disabled`/`badge` 제거), 검색 결과 페이지가 코스 목록도 표시하도록 연결
- [ ] 프론트: `DestinationsPage`의 "코스를 따라 떠나는 여행" 섹션을 정적 목업(`courses` 배열, `DestinationsPage.jsx:63-67`)에서 실제 데이터로 전환할지 결정 (8장 D-6, 홈 섹션처럼 상위 N건만 노출하는 별도 API 호출이 필요할 수 있음)

### 2.2 제외

- 여행코스-피드 연동 (admin-dashboard report §8, 사용자가 이미 별도 논의로 유보. 이번 기능도 다루지 않는다)
- 지도 API 연동(좌표 선택 UI, 실제 지도 렌더링). CUSTOM 경유지는 이번에도 텍스트/좌표 숫자 표시까지만 (admin-dashboard 2.2와 동일 결정 유지)
- 사용자가 코스를 직접 만들거나 코멘트/좋아요를 남기는 기능 (이번은 조회 전용)
- 관리자 코스 CRUD 화면 변경 (완성된 상태 유지, 이번 기능은 새 공개 컨트롤러만 추가)
- 코스 북마크 (destination-list-integration Q-1과 동일한 이유로 가짜 버튼을 만들지 않는다. 북마크 기능 자체가 아직 없음)
- `AdminCourseFormPage.jsx` 컴포넌트 분리 리팩터 (admin-dashboard report가 남긴 별도 기술 부채, 이번 범위 아님)

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | `GET /api/v1/courses`(공개, 키워드·페이지네이션)를 만든다. 응답에 8장 D-3 결정에 따른 일자 수·경유지 수·1일차 대표 주소를 포함한다(관리자 목록 응답과는 별도 DTO, N+1 방지 집계 쿼리는 설계 §4.2) | High | frontend-support-backend | Pending |
| FR-02 | `GET /api/v1/courses/{id}`(공개)를 만든다. 응답은 관리자 상세(`admin-dashboard.design.md §3.3.5`)와 같은 중첩 구조(코스-일자-경유지-이미지)를 쓰되, 관리자 전용 필드(있다면)는 제외한다 | High | frontend-support-backend | Pending |
| FR-03 | `SecurityConfig`에 `/api/v1/courses`, `/api/v1/courses/**`를 `permitAll`로 추가한다. 기존 `/api/v1/admin/courses/**` 인가 규칙은 변경하지 않는다 | High | frontend-support-backend | Pending |
| FR-04 | `courseApi.js`가 목록·상세를 호출하고 view model로 변환한다(`toCourseCard`, `toCourseDetail`). AbortSignal을 지원한다(destination-list-integration D-8과 동일 원칙) | High | frontend-lead | Pending |
| FR-05 | `useCourseList(query)`가 `loading`/`success`/`error`/`empty` 상태와 `retry`를 제공한다. 조건이 바뀌면 이전 요청을 취소하고 늦게 도착한 응답은 무시한다(`useTourList` 상태 머신 재사용) | High | frontend-lead | Pending |
| FR-06 | 코스 목록 조건(검색어, 페이지, 8장 결정에 따른 필터)을 URL 쿼리에 둔다. 뒤로 가기·공유·새로고침에서 복원된다 | High | frontend-lead | Pending |
| FR-07 | `DestinationCatalogPage`의 course 목업 분기(`courseItems`, 45장 복제)를 제거하고 실제 API 목록으로 교체한다 | High | frontend-lead | Pending |
| FR-08 | 코스 상세 화면이 실제 일자·경유지 구조를 렌더링한다: 일자별 섹션, 경유지 순서, 경유지 이미지(있으면), 코스 대표 이미지 | High | frontend-lead | Pending |
| FR-09 | REFERENCE 경유지는 8장 D-2 결정에 따라 여행지 상세(`getTourDetailPath(tourContentId, tourContentTypeId)`)로 링크한다 | High | frontend-lead | Pending |
| FR-10 | CUSTOM 경유지는 8장 D-1 결정에 따라 지도 없이 표시한다(이름·주소, 좌표가 있으면 보조 표기) | High | frontend-lead | Pending |
| FR-11 | 코스 상세 라우팅을 8장 D-5 결정에 따라 확정한다. 기존 `/destinations/detail/:id`를 재사용하면 `resolveDestinationDetail`이 코스 ID와 TourAPI contentId를 혼동하지 않도록 분기 로직을 함께 수정한다 | High | frontend-lead | Pending |
| FR-12 | 검색 모달(`TravelSearchModal.jsx`)의 '여행코스' 유형에서 `disabled`/`badge: '준비 중'`을 제거하고, 실제 검색 조건으로 코스 목록/검색 결과로 이동하게 한다 | High | frontend-lead | Pending |
| FR-13 | 첫 로딩은 스켈레톤, 조건 변경 중에는 이전 결과를 유지하며 `aria-busy`로 표시한다. 에러는 재시도, 빈 결과는 조건 초기화 버튼을 제공한다(destination-list-integration FR-08과 동일 패턴) | High | frontend-lead | Pending |
| FR-14 | 코스 카드는 코스 목록의 기존 여행지 카드와 시각적으로 일관된 정보 밀도를 갖는다: 제목, 대표 이미지, (8장 결정에 따라) 대표 지역·기간·경유지 수 | Medium | frontend-lead | Pending |
| FR-15 | `DestinationsPage`의 "코스를 따라 떠나는 여행" 섹션을 8장 D-6 결정에 따라 실제 데이터로 전환하거나 현행 유지한다 | Low | frontend-lead | Pending |

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 회귀 방지 | 관리자 코스 CRUD(`/api/v1/admin/courses/**`)와 admin 화면 동작에 변화가 없다 | 관리자 화면 수동 확인 |
| 경쟁 조건 | 조건을 빠르게 바꿔도 마지막 조건의 결과만 표시(destination-list-integration과 동일 기준) | 수동 확인 |
| ID 안전성 | 코스 ID와 TourAPI contentId가 같은 라우트/판정 로직에서 혼동되지 않는다 | 코드 리뷰 + 수동 확인(작은 숫자 ID의 코스로 직접 테스트) |
| 접근성 | 목록 `aria-busy`, 에러 `role="alert"`, 상세의 일자·경유지 목록에 적절한 heading 구조 | 코드 리뷰 |
| 반응형 | 코스 상세의 일자별 섹션·경유지 카드가 모바일에서 깨지지 않는다 | 브라우저 크기 조절 |
| 일관성 | 관광지·문화시설 카탈로그와 같은 로딩/에러/빈 상태 컴포넌트를 재사용한다(새로 만들지 않는다) | 설계 리뷰 |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] `/destinations/courses`가 실제 등록된 여행코스와 정확한 총 건수를 표시한다(목업 복제 없음)
- [ ] 코스 상세가 실제 일자·경유지(REFERENCE/CUSTOM 모두)와 이미지를 보여준다
- [ ] REFERENCE 경유지에서 여행지 상세로 이동할 수 있다(8장 D-2 결정대로)
- [ ] CUSTOM 경유지가 지도 없이도 사용자에게 의미 있게 표시된다(8장 D-1 결정대로)
- [ ] 검색 모달에서 '여행코스' 유형을 선택해 검색할 수 있다
- [ ] 코스 ID와 TourAPI contentId가 상세 라우팅에서 혼동되지 않는다(테스트로 확인)
- [ ] 로딩·에러(재시도)·빈 상태(조건 초기화)가 구분되어 표시된다
- [ ] 관리자 코스 CRUD 화면에 회귀가 없다
- [ ] frontend-code-reviewer 리뷰와 gap 분석 완료

### 4.2 품질 기준

- [ ] `npm run lint` 오류 0, `npm run build` 성공
- [ ] 백엔드 `mvnw clean test` 통과, 신규 공개 API는 curl로 인증 없이 호출 가능한지 확인
- [ ] gap 분석 Match Rate 90% 이상

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 코스 ID(작은 정수)가 TourAPI contentId 숫자 패턴과 겹쳐 상세 라우팅이 오작동 | High | High | 8장 D-5(별도 라우트 신설)로 해결. 설계 §6에 구체화 |
| `TourCourse`에 지역 컬럼이 없어 지역 필터를 만들 수 없음 | Medium | High | 8장 D-3(필터 제외 + 표시용 배지)으로 해결. 스키마 변경 없이 진행 |
| 목록 응답에 일자/경유지 수가 없어 카드 정보가 부실 | Medium | Medium | 8장 D-3에서 공개 목록 전용 필드 추가로 확정. N+1을 피하는 집계 쿼리는 설계 §4.2에 구체화 |
| 관리자가 작성 중인(미완성) 코스가 공개 API에 그대로 노출됨 | High | Medium(확인 필요) | 설계 단계에서 `TourCourse`에 게시 상태 컬럼이 있는지 재확인. 없다면 8장에 상태 필드 추가 여부를 결정 항목으로 올려야 함(현재는 열린 위험으로만 기록) |
| 코스 상세 화면 재작성이 기존 `TravelCourseDetailPage.jsx`(목업 전용, `item.stops` 문자열 배열 가정)를 깨뜨림 | Medium | High(구조가 다름) | 목업 전제(문자열 배열, 좌표 없음)와 실제 스키마(중첩 객체, 좌표·이미지)가 근본적으로 달라 **재작성이 아니라 신규 컴포넌트**로 접근(설계 단계에서 재사용 가능 부분만 골라냄, 예: 히어로·통계 섹션 레이아웃) |
| 검색 모달 활성화 후 코스 검색 결과 페이지가 관광지/문화시설과 다른 파라미터 체계를 요구 | Medium | Medium | `lib/tourListQuery.js`를 코스까지 억지로 확장하지 않고, 코스 전용 쿼리 파라미터(키워드 중심)를 별도로 정의(설계 단계에서 통합 여부 재검토) |

---

## 6. 영향 분석

### 6.1 변경 자원 (예상)

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `backend/.../tourcourse/**` | 백엔드 도메인 | 읽기 전용 공개 컨트롤러·DTO 추가 (기존 관리자 서비스는 그대로 재사용 또는 별도 읽기 서비스 분리) |
| `SecurityConfig.java` | 백엔드 설정 | `/api/v1/courses`, `/api/v1/courses/**` permitAll 추가 |
| `frontend/src/api/courseApi.js` | 신규 API 모듈 | 목록·상세 호출, view model |
| `frontend/src/hooks/useCourseList.js` | 신규 훅 | 목록 상태 머신 |
| `frontend/src/pages/DestinationCatalogPage.jsx` | 페이지 | course 목업 분기 제거 (관광지·문화시설처럼 `TourCatalogPage` 계열로 흡수할지는 설계 단계 결정) |
| `frontend/src/pages/TravelCourseDetailPage.jsx` | 페이지 | 사실상 신규 작성 (스키마가 다름) |
| `frontend/src/pages/TravelDetailPage.jsx` | 페이지 | 코스 ID 판정 분기 수정 (8장 D-5) |
| `frontend/src/components/search/TravelSearchModal.jsx` | 컴포넌트 | 여행코스 유형 활성화 |
| `frontend/src/data/destinationMocks.js` | 데이터 | `courseItems` 제거 시점 결정 (다른 목업에 영향 없는지 확인) |
| `frontend/src/pages/DestinationsPage.jsx` | 페이지 | 코스 섹션 전환 여부(8장 D-6) |

### 6.2 현재 사용처 (영향받을 수 있는 곳)

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `destinationMocks.js`의 `allDestinationMocks` | `TravelDetailPage.jsx`(mock 판정), `DestinationCatalogPage.jsx` | `courseItems`를 제거하면 `allDestinationMocks`에서 코스 슬러그가 사라짐. 관광지·문화시설 목업(`destinationItems`, `cultureItems`)은 destination-list-integration D-5 결정으로 아직 남아 있으므로 **함께 삭제하지 않는다** |
| `tourContentTypes.js`의 `isTourContentId`/`getTourDetailPath` | 상세 라우팅 전반 | 코스 ID 처리를 추가할 때 이 파일의 규칙을 깨지 않아야 한다(다른 화면이 이미 이 규칙에 의존) |
| `TravelSearchModal.jsx`의 `TRAVEL_TYPE_VALUES`(`{ course: '25' }`) | 검색 모달, URL 쿼리 | '25'는 TourAPI contentTypeId 관례를 빌린 값일 뿐, 실제 코스 API는 이 값을 쓰지 않을 수 있음(8장 D-4 확인 필요) |
| 관리자 코스 API(`/api/v1/admin/courses/**`) | admin-dashboard 화면 전체 | 이번 기능은 읽기 전용 공개 API만 추가하므로 회귀 없음(수정 대상 아님) |

### 6.3 검증

- [ ] 관리자 코스 CRUD 화면(생성·수정·삭제·이미지 첨부)이 기존과 동일하게 동작
- [ ] 관광지·문화시설 카탈로그·검색에 회귀 없음
- [ ] `destinationMocks.js`의 다른 목업(관광지·문화시설, 상세 목업 분기)에 영향 없음

---

## 7. 프론트엔드 아키텍처 고려사항

### 7.1 destination-list-integration 패턴 재사용 방안

| destination-list-integration의 패턴 | 여행코스에 그대로 재사용 가능한가 | 근거 |
|--------------------------------------|-----------------------------------|------|
| URL을 목록 조건의 유일한 상태 원천으로 (`useSearchParams`) | **가능** | 코스도 뒤로 가기 복원·공유 가능한 URL이 필요한 이유는 동일 |
| `useTourList`의 렌더 중 파생 상태 머신(취소, 늦은 응답 무시) | **가능** (구조만 복제, `useCourseList`로 별도 구현) | 상태 전이 로직 자체는 API 종류와 무관한 일반 패턴. 다만 `fetchCourseList`를 호출하도록 바꿔야 하므로 훅 자체를 공유하기보다 **같은 패턴으로 새로 작성**하는 편이 결합도를 낮춘다(코스가 관광지 쿼리 파라미터를 몰라도 되게) |
| `lib/tourListQuery.js`(파싱·정규화·직렬화) | **부분적** | 코스는 `contentTypeId`·`lclsSystm1/2`·`lDongRegnCd` 파라미터 체계가 없다. 코스 전용 파라미터(키워드, 페이지, 8장 결정에 따른 필터)를 다루는 별도 순수 함수 모듈이 필요 (`lib/courseListQuery.js` 신설 검토) |
| `TourCardGrid`/`Pagination`/`ListStatus`(표시 컴포넌트) | **가능** | 이 컴포넌트들은 훅·API를 모른 채 props만 받는 순수 표시 컴포넌트로 설계돼 있어(destination-list-integration §2.2), 코스 카드 view model만 같은 `TourCard` 모양(`id`, `title`, `image`, `address`, `category`, `detailPath`)으로 맞추면 그대로 재사용 가능. 다만 코스 카드에 보여줄 정보(기간·경유지 수)가 `TourCard` 모양과 다르면 확장이 필요 |
| `SearchModalFrame`/`SearchOptionGroup` | **가능** | 모달 틀·포커스 관리는 콘텐츠와 무관. '여행코스' 유형은 8장 D-4 결정에 따라 지역·세부 항목 대신 키워드 입력 하나로 대체(설계 §9) |
| `AbortController` + `isActive` 경쟁 조건 방어 | **가능** | `client.js`의 `signal` 전달은 이미 범용으로 구현됨(destination-list-integration D-8) |

**재사용 원칙**: "이미 있는 코드를 그대로 import"가 아니라 "이미 검증된 패턴(상태 머신 모양, 분리 기준)을 복제"하는 쪽을 기본으로 삼는다. `useTourList`를 코스 목록에 직접 재사용하면 관광지 전용 쿼리 파라미터를 코스 훅이 알아야 하는 역결합이 생긴다. destination-list-integration 설계 문서(§2.2)가 이미 "분리에는 이유가 있어야 한다"는 원칙을 세워 두었으므로, 이번에도 표시 컴포넌트는 공유하고 데이터 계층(쿼리 모듈, 훅, API)은 코스 전용으로 새로 만드는 것을 기본 방향으로 제안한다. 최종 분리 경계는 설계 단계에서 확정한다.

### 7.2 상태 관리

| 상태 | 위치 | 이유 |
|------|------|------|
| 목록 조건(검색어, 페이지, 필터) | URL | destination-list-integration과 동일 근거 |
| 목록 요청 상태 | `useCourseList` 내부 state | 서버 상태, 이 화면만 필요 |
| 코스 상세 데이터 | 상세 화면 전용 훅(`useCourseDetail`, `useTourDetail`과 같은 패턴) | 캐시·재검증 요구가 낮고 프로젝트에 서버 상태 라이브러리가 없다는 기존 결정과 일관 |

새 Context나 전역 store는 만들지 않는다.

### 7.3 작업 분담 (CLAUDE.md bkit 협업 규칙)

```
frontend-lead            : FR-04 ~ FR-15 (프론트 전체)
frontend-support-backend : FR-01 ~ FR-03 (공개 조회 API, permitAll)
frontend-code-reviewer   : 구현 후 리뷰
bkit gap-detector        : 설계 대비 gap 분석
frontend-interview-coach : 완료 보고서 후 포트폴리오 자료 추출
```

백엔드 작업은 기존 `tourcourse` 패키지에 읽기 전용 컨트롤러만 추가하므로 관리자 CRUD 코드와 파일이 거의 겹치지 않는다. 8장 D-3 결정으로 `TourCourse` 스키마 변경(지역 컬럼 추가)은 하지 않으므로, 관리자 폼(`AdminCourseFormPage.jsx`)을 수정할 필요가 없다.

---

## 8. 사용자 결정 (결정됨, 2026-09-30)

아래 항목은 구현 범위와 데이터 모델에 직접 영향을 주어 설계 문서 작성 전에 결정을 요청했다. 전부 추천안대로 확정됐다.

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| D-1 | CUSTOM 경유지를 지도 없이 어떻게 보여줄지 | **B) 좌표가 있으면 외부 지도(카카오맵) 딥링크 버튼**. 좌표가 없으면 버튼을 아예 렌더링하지 않는다 | 이름·주소만 보여주는 것보다 실질적 가치가 있고, API 키·SDK 없이 URL 조합만으로 구현 가능해 지도 연동 자체(2.2 제외 항목)를 건드리지 않는다 |
| D-2 | REFERENCE 경유지를 기존 관광지 상세로 링크할지 | **A) 항상 링크**. `getTourDetailPath(tourContentId, tourContentTypeId)` 재사용 | admin-dashboard 계획 4장이 이미 이 방향을 제시했고, 이 함수가 관광지·문화시설·즐기기 5종을 이미 처리해 추가 구현 비용이 적다 |
| D-3 | 코스 목록의 필터·카드 정보 (지역 필드 부재) | **A + C + D 조합**: 지역 필터는 이번 범위 제외(키워드 검색만) + 카드에 1일차 경유지 주소로 표시용 지역 배지 + 목록 응답에 일자 수·경유지 수 포함. `TourCourse` 스키마 변경(지역 컬럼 추가, 선택지 B)은 하지 않는다 | 목록 응답 확장(일자·경유지 수, 대표 주소)은 admin-dashboard가 N+1 회피로 남겨 둔 "여유 범위" 갭을 이번 기능에서 공개 목록 전용으로 메운다. 스키마 변경 없이 집계 쿼리로 해결한다(설계 §4.2) |
| D-4 | 검색 모달의 '여행코스' 유형이 받을 조건 | **키워드 검색으로 활성화** (D-3에 따라 지역 필터 없음) | 코스 전용 검색 결과 화면을 새로 만들지 않고, 모달 제출 시 코스 카탈로그(`/destinations/courses?keyword=`)로 바로 이동한다(설계 §9) |
| D-5 | 코스 상세 라우팅 | **A) 별도 라우트 신설** (`/destinations/courses/:id`) | ID 네임스페이스 충돌(코스 ID와 TourAPI contentId 숫자 패턴 겹침) 위험을 원천적으로 없앤다. `TravelDetailPage.jsx`의 코스 mock 분기도 함께 제거되어 코드가 단순해진다(설계 §6) |
| D-6 | `DestinationsPage`의 코스 섹션(정적 3건) 전환 여부 | **B) 현행 유지**, 이번 범위 제외 | destination-list-integration도 랜딩의 정적 섹션은 범위 밖으로 뒀다. 이번에도 같은 원칙으로 범위를 좁힌다 |

이 결정에 따른 구체적인 API 응답 모양, 집계 쿼리 설계, 라우팅·컴포넌트 구조는 `docs/02-design/features/tour-course-list-integration.design.md`에 구체화했다.

---

## 9. 다음 단계

1. [x] 8장 사용자 결정 (D-1 ~ D-6)
2. [x] 설계 문서 작성 (`tour-course-list-integration.design.md`)
3. [ ] 백엔드 FR-01 ~ FR-03 (frontend-support-backend)
4. [ ] 프론트 구현 (frontend-lead)
5. [ ] 코드 리뷰 (frontend-code-reviewer) + gap 분석
6. [ ] 완료 보고서 → 포트폴리오 추출 (frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-30 | 초안. admin-dashboard 후속 기능 지정에 따른 최초 작성. 코드 조사 기반 FR 작성, Q-1 ~ Q-6 미해결 질문 정리 (특히 CUSTOM 표시, REFERENCE 링크, ID 네임스페이스 충돌 위험) | WOOJIN |
| 0.2 | 2026-09-30 | 사용자 결정 반영(원 질문 Q-1 ~ Q-6, 전부 추천안 채택해 D-1 ~ D-6으로 확정). 8장을 미해결 질문에서 사용자 결정 표로 전환. 설계 문서 작성 완료 반영, 상태를 Approved로 변경 | WOOJIN |
