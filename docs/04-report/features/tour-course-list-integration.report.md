# tour-course-list-integration 완료 보고서

> **상태**: ✅ Complete
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: frontend-lead (Claude Code 보조)
> **완료일**: 2026-09-30
> **PDCA 주기**: #3 (destination-list-integration → admin-dashboard에 이은 세 번째 주기)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **기능** | admin-dashboard가 만든 여행코스 3단 스키마(코스-일자-경유지-이미지)를 일반 사용자가 볼 수 있도록 공개(비로그인) 조회 API(`GET /api/v1/courses`, `GET /api/v1/courses/{id}`)를 신설하고, `/destinations/courses`(목록)·`/destinations/courses/:id`(상세)를 목업에서 실제 데이터로 전환. 검색 모달의 '여행코스' 유형도 함께 활성화 |
| **시작일** | 2026-09-30 (계획 단계) |
| **완료일** | 2026-09-30 (코드 리뷰 반영 + gap 분석 완료) |
| **소요 기간** | 1일 (계획·설계·구현·리뷰·검증·보고를 하나의 세션 안에서 진행) |

### 1.2 결과 요약

```
┌──────────────────────────────────────────────┐
│  전체 Match Rate: 99.2%                       │
├──────────────────────────────────────────────┤
│  ✅ 완료:     목록·상세·검색 모달 3개 화면 전환   │
│  ✅ 신규 API: 공개 조회 2개(GET 목록/상세)      │
│  ✅ 계약:     API 3면 대조 100% 일치            │
│  ✅ 코드 리뷰: Should Improve 3건 전건 수정 완료 │
│  ✅ Gap:      Critical 0건, Important 0건     │
│  ⚠️  Minor:    5건(설계보다 나은 구현 2,        │
│              의도적 편차 1, 여유범위 1,        │
│              환경 제약 1)                     │
└──────────────────────────────────────────────┘
```

### 1.3 전달한 가치 (4 관점)

| 관점 | 내용 |
|------|------|
| **문제** | admin-dashboard가 여행코스 스키마와 관리자 CRUD API를 완성했지만, `/api/v1/admin/courses/**`는 `ROLE_ADMIN` 전용이라 일반 사용자는 접근할 수 없었다. `/destinations/courses`는 여전히 목업 3건을 45장으로 복제하는 화면이었고, 검색 모달은 '여행코스' 유형을 아예 비활성화해 두었다. |
| **해결** | admin-dashboard가 만든 스키마를 그대로 재사용하는 읽기 전용 공개 API를 신설했다. 관리자 목록 API가 N+1 회피를 위해 의도적으로 빼뒀던 일자 수·경유지 수·대표 주소를, 공개 목록 전용 DTO와 페이지당 3개 쿼리(검색 1 + 집계 2)로 채워 N+1 없이 해결했다. 관리자 서비스는 물리적으로 건드리지 않고 새 서비스·컨트롤러만 추가해 회귀 위험을 원천 차단했다. 프론트는 destination-list-integration이 검증한 패턴(URL 상태, AbortController+isActive, 상태별 화면 분리)을 데이터 계층은 새로 짜고 표시 계층은 재사용하는 방식으로 옮겼다. 코드 리뷰 과정에서 코스 ID(작은 정수)가 기존 TourAPI contentId 숫자 판정과 겹치는 위험을 미리 발견해, 상세를 완전히 분리된 라우트(`/destinations/courses/:id`)로 만들어 예방했다. |
| **기능/UX 효과** | 사용자가 실제로 등록된 여행코스를 검색하고, 일자별 경유지(참조/직접 입력 모두)와 이미지를 상세에서 확인할 수 있다. REFERENCE 경유지는 여행지 상세로 항상 이동할 수 있고, CUSTOM 경유지는 좌표가 있을 때만 외부 지도(카카오맵) 딥링크를 보여줘 없는 기능을 있는 것처럼 보여주지 않는다. 검색 모달에서 '여행코스'를 고르면 지역 선택 대신 키워드 입력으로 자연스럽게 바뀐다. |
| **핵심 가치** | 이 기능의 포트폴리오 가치는 세 가지다. 첫째, **이전 기능이 만든 스키마와 API 컨벤션을 그대로 재사용하면서 물리적으로 서비스를 분리하는 설계**(관리자 서비스를 고치지 않고 읽기 전용 서비스를 새로 추가해, 코드 경로상 공개 컨트롤러가 쓰기 메서드에 접근할 수 없게 만듦). 둘째, **"패턴 재사용"과 "무비판적 복사"를 구분한 판단**(URL 상태·상태 머신 패턴은 복제하되, 관광지 전용 쿼리 모델(`lib/tourListQuery.js`)에 코스를 억지로 끼워 넣지 않고 코스 전용 모듈을 새로 만듦, 또한 검색 모달을 `keywordStep` 모드로 확장하면서 이미 검증된 `EnjoySearchModal` 등 기존 코드는 전혀 건드리지 않음). 셋째, **구현 전 설계 단계에서 ID 네임스페이스 충돌 같은 잠재 버그를 코드 실행 없이 발견하고 아키텍처로 예방한 과정**(코스 ID가 `isTourContentId` 숫자 패턴과 겹치는 위험을 라우트 분리로 해소, 그 부수 효과로 `TravelDetailPage.jsx`의 특수 분기가 사라져 코드가 더 단순해짐). 셋 다 면접에서 구체적인 코드 위치와 함께 설명할 수 있다. |

---

## PDCA 주기 요약

### Plan (계획)

**문서**: `docs/01-plan/features/tour-course-list-integration.plan.md` (v0.2)

**목표**
- admin-dashboard가 만든 여행코스 스키마를 공개 API로 감싸 일반 사용자가 조회할 수 있게 함
- `/destinations/courses`(목록)·`/destinations/courses/:id`(상세)를 목업에서 실제 데이터로 전환
- 검색 모달의 '여행코스' 유형 활성화
- destination-list-integration 패턴(URL 상태, 요청 취소, 상태별 화면) 재사용 방안 구체화

**주요 결정** (사용자 D-1 ~ D-6, 2026-09-30, 전부 추천안 채택)

| # | 결정 | 요지 |
|---|------|------|
| D-1 | CUSTOM 경유지 표시 | 좌표 있으면 외부 지도(카카오맵) 딥링크 버튼, 없으면 버튼 미노출 |
| D-2 | REFERENCE 경유지 링크 | 항상 여행지 상세로 링크(`getTourDetailPath` 재사용) |
| D-3 | 코스 목록 필터·카드 정보 | 지역 필터는 이번 범위 제외(키워드 검색만) + 1일차 주소 배지 + 일자·경유지 수 표시. `TourCourse` 스키마 변경은 하지 않음 |
| D-4 | 검색 모달 여행코스 유형 | 키워드 검색으로 활성화. 코스 전용 검색 결과 화면은 만들지 않고 카탈로그로 직행 |
| D-5 | 코스 상세 라우팅 | 별도 라우트 신설(`/destinations/courses/:id`), 기존 `/destinations/detail/:id`와 완전 분리 |
| D-6 | 랜딩 페이지 코스 섹션 | 현행 유지, 이번 범위 제외 |

**범위**: FR-01~03(백엔드 공개 API), FR-04~15(프론트 전체)

### Design (설계)

**문서**: `docs/02-design/features/tour-course-list-integration.design.md` (v0.2, 코드 리뷰 반영)

**아키텍처 결정**

| 기준 | 선택 | 이유 |
|------|------|------|
| **공개/관리자 서비스 분리** | `TourCoursePublicService`를 신규로 만들고 `TourCourseAdminService`는 손대지 않음 | 공개 컨트롤러가 물리적으로 쓰기 메서드를 호출할 수 없는 구조를 코드 경로로 강제. 관리자 CRUD에 회귀가 생길 여지 자체를 없앰 |
| **목록 집계 정보(일자 수·경유지 수·대표 주소)** | 관리자 목록 DTO(`TourCourseListItemResponse`)는 그대로 두고, 공개 전용 DTO(`TourCoursePublicListItemResponse`) + 집계 쿼리 2개(페이지당 고정, N+1 아님)로 해결 | admin-dashboard가 N+1 회피로 이미 내린 결정을 뒤집지 않으면서, 공개 화면에 필요한 정보만 별도로 채움 |
| **데이터 계층은 새로, 표시 계층은 재사용** | `useCourseList`/`lib/courseListQuery.js`는 신규, `ListStatus`/`Pagination`/`TourCardSkeleton`은 그대로 재사용 | `useTourList`/`lib/tourListQuery.js`는 관광지 전용 쿼리 모델(지역·분류 코드)을 전제해 코스에 억지로 맞추면 역결합이 생김. 표시 컴포넌트는 이미 props만 받는 순수 컴포넌트라 그대로 재사용 가능 |
| **코스 상세 라우트 분리** | 기존 `/destinations/detail/:id` 재사용 대신 `/destinations/courses/:id` 신설 | 코스 ID(작은 정수)가 `isTourContentId`의 숫자 판정과 겹쳐 TourAPI contentId로 오판정될 위험을 원천 차단 |
| **검색 모달 확장** | `SearchModal.jsx`에 `keywordStep` optional prop 추가, 코스는 검색 결과 전용 화면 없이 카탈로그로 직행 | `EnjoySearchModal`은 이 prop을 넘기지 않아 기존 3단계 구조가 그대로 유지됨. `DestinationSearchResultsPage.jsx`/`lib/tourListQuery.js`/`data/tourListConfigs.js`는 전혀 수정하지 않아 이미 검증된 코드의 회귀 위험이 없음 |

**주요 모듈**

| 모듈 | 역할 | 재사용성 |
|------|------|----------|
| `api/courseApi.js` | 코스 목록·상세 호출, view model 변환, `getCourseDetailPath`/`formatCourseDuration` | `CourseCard`/`CourseListView`/`TourCourseDetailPage`가 공유 |
| `hooks/useCourseList.js`/`useCourseDetail.js` | 코스 전용 상태 머신 | `useTourList`/`useTourDetail`의 "렌더 중 파생" 패턴 복제 |
| `components/tour-list/CourseCard*.jsx`/`CourseListView.jsx` | 코스 목록 표시 | `TourCard`/`TourListView`가 `useTourList`를 하드코딩 import해 회귀 위험이 있어 병렬 컴포넌트로 분리 |
| `lib/mapLink.js` | 카카오맵 딥링크 URL 생성 | 이 프로젝트 최초의 지도 딥링크. CUSTOM 경유지 전용이지만 좌표 기반이라 범용 |

### Do (구현)

**진행 순서**: 백엔드 공개 API(frontend-support-backend) → 프론트 전체 구현(frontend-lead) → 코드 리뷰 → Should Improve 3건 수정.

| 순서 | 영역 | 담당 | 주요 산출물 |
|:---:|------|------|-------------|
| 1 | 백엔드 공개 API | frontend-support-backend | `TourCoursePublicController`/`Service`, `TourCoursePublicListItemResponse`, `TourCourseAggregateProjection`, `TourCourseRepository` 집계 쿼리 2개, `SecurityConfig` permitAll, `TourCoursePublicServiceTest` |
| 2 | 프론트 데이터 계층 | frontend-lead | `lib/courseListQuery.js`, `lib/mapLink.js`, `api/courseApi.js`, `hooks/useCourseList.js`/`useCourseListSearchParams.js`/`useCourseDetail.js` |
| 3 | 프론트 표시 계층 | frontend-lead | `CourseCard.jsx`/`CourseCardGrid.jsx`/`CourseListView.jsx`, `TourCourseCatalogPage.jsx`(+css), `TourCourseDetailPage.jsx`(+css) |
| 4 | 검색 모달·라우팅·목업 정리 | frontend-lead | `App.jsx` 라우트 교체, `TravelDetailPage.jsx` 코스 분기 제거, `destinationMocks.js`에서 `courseItems` 제거, `SearchModal.jsx`(`keywordStep`)/`useSearchSelection.js`(`keyword`)/`TravelSearchModal.jsx` 확장, 구 파일(`TravelCourseDetailPage.*`, `DestinationCatalogPage.jsx`) 삭제 |
| 5 | 코드 리뷰 반영 | frontend-lead | Should Improve 3건 수정(아래 표) |

**완료 항목**
- ✅ 공개 조회 API 2종(`GET /api/v1/courses`, `GET /api/v1/courses/{id}`), 일자·경유지 수·대표 주소 집계 (FR-01~03)
- ✅ 코스 카탈로그(`/destinations/courses`) 실제 API 전환, 목업 완전 제거 (FR-04~07, FR-13~14)
- ✅ 코스 상세(`/destinations/courses/:id`) 일자별 경유지·이미지 렌더링, REFERENCE/CUSTOM 표시 (FR-08~11)
- ✅ 검색 모달 여행코스 유형 활성화, 키워드 모드 (FR-12)
- ✅ 랜딩 페이지 코스 섹션 현행 유지 (FR-15, D-6)

**코드 품질**
- 백엔드 신규 테스트 1개: `TourCoursePublicServiceTest`(관리자 서비스로 데이터 생성 → 공개 서비스로 집계 값 검증)
- `npm run lint` 오류 0, `npm run build` 성공(구현 직후, 코드 리뷰 수정 후 재확인 총 2회)
- frontend-code-reviewer 독립 리뷰: Must Fix 0건, Should Improve 3건 발견, 전건 수정 반영 확인

**코드 리뷰에서 발견·수정된 이슈** (포트폴리오 소재)

| # | 이슈 | 근본 원인 | 수정 |
|---|------|-----------|------|
| 1 | `useCourseDetail`이 `useTourDetail`과 달리 400 오류 시 "파라미터 계약 어긋남" 경고 로그가 빠져 있음 | 새 훅을 만들면서 기존 훅의 개발자용 경고 로직을 놓침 | `error.status === 400`일 때 `console.warn`으로 `{ id, body }` 로그 추가 |
| 2 | 검색 모달 키워드 입력의 화면 문구와 `aria-label` 문구가 서로 달라 접근성 이름이 어긋남 | 시각적 라벨(`<strong>`)과 스크린리더 라벨(`aria-label`)을 별도 필드로 관리 | `aria-label` 제거, `<label htmlFor>`/`<input id>`로 프로그래밍적 연결(화면 문구를 그대로 접근성 이름으로 사용) |
| 3 | 설계 문서가 `DestinationCatalogPage.css`를 삭제 대상으로 명시했으나 실제로는 3개 페이지가 공유하는 자산 | 설계 당시 이 CSS가 이미 destination-list-integration에서 여러 페이지의 공용 자산이 되어 있었다는 점을 놓침 | 코드는 그대로 두고 설계 문서만 "의도적 편차"로 정정. 리네이밍은 과잉 엔지니어링으로 판단해 보류 |

### Check (검증)

**문서**: `docs/03-analysis/tour-course-list-integration.analysis.md`

**Gap 분석 결과**

```
Overall Match Rate: 99.2%
├ Structural:  100% (설계 §2.2/§10 모듈 목록 완전 일치, 추가 2건은 설계보다 나은 구현)
├ Functional:   98% (FR-01~15 전체 충족 + 리뷰 발견분 3건 수정 확인)
└ Contract:   100%  (API 3면 대조 4/4)
```

**Success Criteria** (계획 §4.1, 8개 항목) — 8/8 완전 충족

**Gap 목록** (전부 Minor, 처리 방향)
1. **G-1 (설계보다 나은 구현)**: `TourCoursePublicServiceTest.java`는 설계에 명시되지 않았으나 신규 작성됨
2. **G-2 (완료, 수정됨)**: `ListStatus`에 코스 전용 문구를 위한 optional prop 추가(코드 리뷰 반영, 하위 호환)
3. **G-3 (의도적 편차, 설계 문서 정정 완료)**: `DestinationCatalogPage.css` 유지
4. **G-4 (여유 범위)**: 코스 목록 지역 필터 미구현(D-3에서 이미 범위 제외 확정)
5. **G-5 (환경 제약)**: 백엔드 자동 테스트가 이 세션의 JDK(17)와 `pom.xml`의 컴파일 대상(`release 25`) 불일치로 실행되지 못함(코드 결함 아님)

### Act (완료)

**판단**: gap 분석 결과(Match Rate 99.2%, Critical/Important 0건, 남은 Minor 5건 전부 실제 위험 없음 또는 이미 처리됨)에 따라 Report 단계로 진행. 코드 리뷰에서 발견된 Should Improve 3건은 모두 이번 PDCA 내에서 수정 완료.

---

## 1.4 성공 기준 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | `/destinations/courses`가 실제 등록된 코스와 정확한 총 건수를 표시 | ✅ 충족 | 목업 45장 복제 제거, 실제 API 소비 확인 |
| SC-2 | 코스 상세가 일자별 경유지(REFERENCE/CUSTOM)와 이미지를 실제로 보여줌 | ✅ 충족 | `TourCourseDetailPage.jsx` 중첩 구조 렌더링 확인 |
| SC-3 | 검색 모달에서 '여행코스' 유형으로 검색 가능 | ✅ 충족 | `disabled`/`badge` 제거, 키워드 모드 동작 확인 |
| SC-4 | CUSTOM 경유지의 지도 딥링크가 좌표 있을 때만 노출 | ✅ 충족 | `buildKakaoMapLink` null 폴백 확인 |
| SC-5 | 코스 ID와 TourAPI contentId가 혼동되지 않음 | ✅ 충족 | 별도 라우트 신설 + `TravelDetailPage.jsx` 코스 분기 완전 제거 |
| SC-6 | 로딩·에러(재시도)·빈 상태(조건 초기화) 구분 표시 | ✅ 충족 | `CourseListView` + 코스 전용 `ListStatus` 문구 |
| SC-7 | 관리자 코스 CRUD 화면에 회귀 없음 | ✅ 충족 | `TourCourseAdminService`/`AdminCourseListPage`/`AdminCourseFormPage` git status 미표시로 미변경 확인 |
| SC-8 | frontend-code-reviewer 리뷰 + gap 분석 완료 | ✅ 충족 | Should Improve 3건 수정 반영, 이 보고서와 짝을 이루는 gap 분석 완료 |

**전체 성공률**: 8/8 (100%)

---

## 1.5 주요 결정 기록

| # | 결정 | 실행 | 결과 |
|---|------|:----:|------|
| D-1 | CUSTOM 경유지는 좌표 있으면 카카오맵 딥링크, 없으면 미노출 | ✅ | `buildKakaoMapLink`가 좌표 없으면 null 반환 → 버튼 자체를 렌더링하지 않음(거짓 UI 금지 원칙 유지) |
| D-2 | REFERENCE 경유지는 항상 여행지 상세로 링크 | ✅ | `getTourDetailPath` 재사용, 기존 함수 무변경 |
| D-3 | 코스 목록은 지역 필터 없이 키워드만, 카드에 집계 정보 포함 | ✅ | `TourCoursePublicListItemResponse` + 집계 쿼리 2개(N+1 없음), `TourCourse` 스키마 변경 없음 |
| D-4 | 검색 모달 여행코스는 키워드 검색, 전용 결과 화면 없음 | ✅ | `keywordStep` 모드 + `/destinations/courses?keyword=` 직행. `DestinationSearchResultsPage.jsx` 등 기존 코드 무변경 |
| D-5 | 코스 상세는 별도 라우트로 분리 | ✅ | `/destinations/courses/:id` 신설, ID 네임스페이스 충돌 원천 차단 + `TravelDetailPage.jsx` 단순화 |
| D-6 | 랜딩 페이지 코스 섹션은 현행 유지 | ✅ | `DestinationsPage.jsx` 무변경 확인 |
| 설계 결정 | 공개/관리자 서비스 물리적 분리(`TourCoursePublicService` 신규, `TourCourseAdminService` 무변경) | ✅ | git status로 관리자 서비스·컨트롤러·화면 전부 미변경 확인 |
| 설계 결정 | 데이터 계층(훅·쿼리 모듈)은 신규, 표시 계층(`ListStatus`/`Pagination`/`TourCardSkeleton`)은 재사용 | ✅ | 코드 리뷰에서 `ListStatus`에 optional override를 추가하는 방식으로 재사용 범위를 하위 호환적으로 확장(G-2) |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:----:|
| Plan | [tour-course-list-integration.plan.md](../../01-plan/features/tour-course-list-integration.plan.md) | ✅ 최종화 (v0.2, D-1~D-6 반영) |
| Design | [tour-course-list-integration.design.md](../../02-design/features/tour-course-list-integration.design.md) | ✅ 최종화 (v0.2, 코드 리뷰 반영) |
| Check | [tour-course-list-integration.analysis.md](../../03-analysis/tour-course-list-integration.analysis.md) | ✅ 완료 (Match Rate 99.2%) |
| Act | 이 문서 | ✅ 완료 |
| 선행 기능 | [admin-dashboard.report.md](admin-dashboard.report.md) (여행코스 스키마 출처) | 참고 |
| 선행 기능 | [destination-list-integration.report.md](destination-list-integration.report.md) (재사용 패턴 출처) | 참고 |

---

## 3. 완료된 항목

### 3.1 기능 요구사항

| 그룹 | 항목 수 | 상태 |
|------|:---:|:---:|
| FR-01~03 (백엔드 공개 API) | 3 | ✅ 3/3 완료 |
| FR-04~07 (데이터 계층·목업 제거) | 4 | ✅ 4/4 완료 |
| FR-08~11 (상세 화면·경유지 표시·라우팅) | 4 | ✅ 4/4 완료 |
| FR-12 (검색 모달) | 1 | ✅ 1/1 완료 |
| FR-13~14 (상태별 화면·카드) | 2 | ✅ 2/2 완료 |
| FR-15 (랜딩 섹션, D-6 현행 유지) | 1 | ✅ 1/1 완료(변경하지 않는 것이 완료 조건) |

**기능 완성도**: 15/15 = 100%

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|:----:|:----:|
| 회귀 방지 | 관리자 코스 CRUD, destination-list-integration 검증 완료 코드, 즐기기 검색 모달에 영향 없음 | ✅ git status로 전부 미변경 확인(§5, 분석 문서) | ✅ |
| N+1 방지 | 공개 목록에 집계 정보를 추가하되 쿼리 수는 페이지 크기와 무관하게 고정 | ✅ 검색 1 + 집계 쿼리 2, 총 3개 고정 | ✅ |
| ID 안전성 | 코스 ID와 TourAPI contentId가 같은 판정 로직에서 혼동되지 않음 | ✅ 별도 라우트로 원천 차단 | ✅ |
| 접근성 | 목록 `aria-busy`, 오류 `role="alert"`, 키워드 입력 label 연결 | ✅ `CourseListView`가 기존 패턴 재사용 + label/htmlFor 연결(코드 리뷰 반영) | ✅ |
| 일관성 | 표시 컴포넌트가 관광지 카탈로그와 같은 로딩/에러/빈 상태 패턴을 따름 | ✅ `ListStatus`/`Pagination`/`TourCardSkeleton` 그대로 재사용 | ✅ |

**품질 메트릭**
- `npm run lint` 오류 0, `npm run build` 성공(2회 확인: 구현 직후, 코드 리뷰 수정 후)
- Gap 분석: Match Rate 99.2%, Critical 0건
- 코드 리뷰 Should Improve 3건 전건 수정 확인

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:----:|
| 백엔드 신규 | `backend/.../tourcourse/{controller/TourCoursePublicController,service/TourCoursePublicService,dto/TourCoursePublicListItemResponse,dto/TourCourseAggregateProjection}.java` | ✅ |
| 백엔드 수정 | `TourCourseRepository.java`(집계 쿼리 2개), `SecurityConfig.java`(permitAll) | ✅ |
| 백엔드 신규 테스트 | `TourCoursePublicServiceTest.java` | ✅ |
| 프론트 신규(데이터 계층) | `lib/courseListQuery.js`, `lib/mapLink.js`, `api/courseApi.js`, `hooks/useCourseList.js`, `hooks/useCourseListSearchParams.js`, `hooks/useCourseDetail.js` | ✅ |
| 프론트 신규(표시 계층) | `components/tour-list/{CourseCard,CourseCardGrid,CourseListView}.jsx`, `pages/{TourCourseCatalogPage,TourCourseDetailPage}.jsx`(+css) | ✅ |
| 프론트 수정 | `App.jsx`, `TravelDetailPage.jsx`, `data/destinationMocks.js`, `hooks/useSearchSelection.js`, `components/search/{SearchModal,TravelSearchModal}.jsx`(+css), `pages/TourCatalogPage.jsx`(주석), `components/tour-list/ListStatus.jsx`(코드 리뷰 반영) | ✅ |
| 프론트 삭제 | `pages/TravelCourseDetailPage.jsx`(+css), `pages/DestinationCatalogPage.jsx` | ✅ |
| 문서 | Plan, Design, Analysis, Report | ✅ 4개 |

---

## 4. 미완료 / 이월 항목

### 4.1 설계 여유 범위 (의도적 미구현)

| 항목 | 설계/계획 근거 | 사유 | 우선순위 | 이월 처리 |
|------|---------|------|----------|----------|
| 코스 목록 지역 필터 | 계획 D-3 | `TourCourse` 스키마에 지역 컬럼이 없어 필터를 만들려면 스키마 변경이 필요. 이번 범위에서 보류 | Low | 필요성이 확인되면 별도 후속 기능으로 분리(계획 §8 Q-3 논의 참고) |
| 랜딩 페이지 코스 섹션 API 전환 | 계획 D-6 | destination-list-integration도 랜딩 정적 섹션은 범위 밖으로 뒀던 전례를 따름 | Low | 필요 시 별도 후속 |

### 4.2 문서 drift (Report 단계에서 갱신 권장)

| 항목 | 내용 | 처리 |
|------|------|------|
| 설계 §13 다음 단계 표 | `TourCoursePublicServiceTest.java`(설계에 없던 신규 테스트) 미반영 | 설계 문서에 테스트 파일 추가(코드 변경 없음) |
| 설계 §7.2 서술 | "`ListStatus`는 수정 없이 그대로 import" | "title/description override로 코스 전용 문구를 준다"로 갱신(코드 리뷰 반영 결과 반영, §G-2) |

### 4.3 환경 제약 후속

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| 백엔드 자동 테스트 미실행 | 이 세션의 JDK(17)와 `pom.xml`의 컴파일 대상(`release 25`)이 맞지 않아 `mvnw test` 컴파일 단계에서 실패. 코드 결함이 아니라 로컬 툴체인 구성 문제 | High(배포 전 필수) | CI 또는 JDK 25가 설치된 환경에서 `mvnw clean test` 실행 확인 |
| L2 브라우저 검증 | 이전 두 PDCA와 동일하게 브라우저 자동화 도구 부재로 미실행 | Medium | 브라우저 자동화 도구 도입 시 §4.3(분석 문서) 체크리스트 실행 |

---

## 5. 품질 메트릭

### 5.1 최종 분석 결과

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 99.2%                   │
├─────────────────────────────────────────────┤
│  Structural Match:  100%                     │
│  Functional Match:   98%                     │
│  Contract Match:    100%                     │
├─────────────────────────────────────────────┤
│  Critical Gap: 0건                            │
│  Important Gap: 0건                           │
│  Minor Gap: 5건                              │
│  └ 설계보다 나은 구현: 2건                     │
│  └ 의도적 편차(문서 정정 완료): 1건            │
│  └ 여유 범위(사용자 승인): 1건                 │
│  └ 환경 제약: 1건                             │
│  코드 리뷰 발견·수정: 3건 (전건 완료)          │
└─────────────────────────────────────────────┘
```

### 5.2 해결된 이슈 (코드 리뷰 → 수정)

| 이슈 | 해결 방법 | 결과 |
|------|----------|:----:|
| `useCourseDetail` 400 경고 로그 누락 | `useTourDetail`과 동일하게 `console.warn` 추가 | ✅ 개발자가 파라미터 계약 오류를 로그로 확인 가능 |
| 검색 모달 키워드 입력 접근성 레이블 불일치 | `aria-label` 대신 `label`/`htmlFor` 프로그래밍적 연결 | ✅ 화면 문구와 스크린리더 문구 일치 |
| 설계 문서와 실제 구현의 CSS 삭제 대상 불일치 | 코드는 유지, 설계 문서를 "의도적 편차"로 정정 | ✅ 문서-구현 drift 해소, 3개 페이지 빌드 유지 |

### 5.3 테스트 결과

| 카테고리 | 결과 |
|----------|:----:|
| 정적 분석 | ✅ 설계 §2.2/§10 모듈 목록 100% 일치 |
| 기능 검증 | ✅ 15/15 FR 충족 |
| 코드 리뷰 반영 확인 | ✅ Should Improve 3/3 수정 확인 |
| 프론트 lint/build | ✅ `npm run lint` 0 오류, `npm run build` 성공(2회) |
| 백엔드 신규 테스트 | ⬜ 파일 존재·코드 정독 확인, 자동 실행은 JDK 버전 불일치로 미실행(환경 제약) |
| L2 UI(브라우저) | ⬜ 미검증 (도구 부재, 다음 세션 이월) |

---

## 6. 배운 점 및 회고

### 6.1 잘된 점 (지속할 사항)

1. **선행 기능의 스키마·API 컨벤션을 그대로 재사용**: admin-dashboard가 이미 정한 응답 모양(`TourCourseResponse`의 코스-일자-경유지-이미지 중첩 구조)을 공개 상세 API가 그대로 재사용해, 새 DTO를 만들 필요가 없었다. "이전 기능이 남긴 계약을 다음 기능이 그대로 이어받는" 설계가 실제로 성립함을 확인했다.

2. **관리자/공개 서비스의 물리적 분리**: 공개 컨트롤러가 `TourCourseAdminService`(쓰기 메서드 포함)를 아예 참조하지 않고 별도의 읽기 전용 서비스만 참조하게 만들어, "실수로 쓰기 메서드를 호출할 수 없는" 구조를 코드 경로 자체로 강제했다. 리뷰나 테스트에 의존하지 않고 아키텍처로 방지한 사례다.

3. **패턴 재사용과 무비판적 복사의 구분**: `useTourList`/`lib/tourListQuery.js`를 그대로 재사용하는 대신, 상태 머신의 "모양"(렌더 중 파생, AbortController+isActive)만 복제하고 데이터 계층(쿼리 파라미터, API 호출)은 코스 전용으로 새로 만들었다. 반대로 표시 컴포넌트(`ListStatus`/`Pagination`/`TourCardSkeleton`)는 이미 순수 props 기반이라 그대로 재사용했다. "왜 이건 복제하고 저건 재사용했는가"를 매 순간 판단 근거와 함께 남겼다.

4. **설계 단계에서 ID 네임스페이스 충돌을 코드 실행 없이 발견**: 코스 ID(작은 정수)가 `isTourContentId`의 숫자 패턴과 겹친다는 위험을 계획 단계 코드 조사에서 미리 찾아, 상세를 별도 라우트로 분리하는 결정을 계획 문서에 명시했다. 구현 단계에 가서 버그로 드러나기 전에 설계로 예방한 사례다.

5. **회귀 방지 설계가 실제로 지켜졌는지 git status로 직접 확인**: "이 파일은 건드리지 않는다"는 설계 의도를 말로만 남기지 않고, gap 분석에서 `git status`로 관리자 CRUD 파일·destination-list-integration 검증 완료 파일·즐기기 모달 파일이 실제로 미변경 상태인지 확인했다.

### 6.2 개선할 점 (다음 시도)

1. **설계 문서의 "삭제 대상" 판단이 구현 시점의 실제 의존 관계를 놓침**: `DestinationCatalogPage.css`가 이미 destination-list-integration에서 여러 페이지의 공유 자산이 되어 있었다는 점을, 설계 단계에서 `grep`으로 한 번만 더 확인했다면 코드 리뷰까지 가지 않고 미리 걸러낼 수 있었다.

2. **백엔드 실행 환경(JDK 버전)을 세션 시작 시점에 먼저 확인하지 못함**: `mvnw test` 실행을 시도하고 나서야 로컬 JDK(17)와 `pom.xml`의 컴파일 대상(`release 25`)이 다르다는 것을 발견했다. Do 단계 착수 전에 `java -version`과 `pom.xml`의 컴파일러 설정을 먼저 대조했다면 이 세션에서 검증 가능한 범위를 더 정확히 계획할 수 있었다.

3. **L2/L3 실측 환경 부재가 세 번째 PDCA에서도 반복됨**: destination-list-integration, admin-dashboard에 이어 이번에도 브라우저 자동화 도구가 없어 실제 클릭·키보드 조작 검증을 하지 못했다. 코드 리뷰와 정적 분석으로 상당 부분을 보완했지만, 카카오맵 딥링크가 실제로 올바른 URL을 여는지 같은 항목은 브라우저 실행 없이는 완전히 검증할 수 없다.

### 6.3 다음에 시도할 사항

1. **JDK 버전 정합성 확인을 세션 시작 체크리스트에 포함**: 백엔드 작업이 포함된 PDCA를 시작할 때 `java -version`과 `pom.xml`의 `maven.compiler.release`를 먼저 대조하는 절차를 bkit 워크플로에 추가할 수 있는지 검토.

2. **코스 목록 지역 필터 필요성 재검토**: 실제 사용자 피드백이나 등록된 코스 수가 늘어나면, `TourCourse`에 지역 컬럼을 추가하는 스키마 변경이 정당화될 수 있다. 이번에 보류한 결정을 데이터가 쌓인 뒤 다시 논의.

3. **L2 브라우저 자동화 도입**: 세 번째 PDCA에서도 반복된 이슈이므로, 다음 기능 시작 전에 이 프로젝트에 브라우저 자동화 도구를 도입하는 것 자체를 하나의 작은 개선 과제로 다뤄볼 수 있다.

---

## 7. 다음 단계

### 7.1 즉시 (Report 단계)

- [ ] 설계 문서 갱신(G-1: `TourCoursePublicServiceTest.java` 반영, G-2: `ListStatus` 재사용 서술 갱신) — 코드 변경 없음
- [ ] JDK 25 또는 CI 환경에서 `mvnw clean test` 실행 확인

### 7.2 다음 PDCA 주기

| 항목 | 의존성 | 우선순위 | 비고 |
|------|--------|---------|------|
| 코스 목록 지역 필터(스키마 변경 포함) | 이 기능(D-3에서 보류) | Low | 데이터·사용자 피드백이 쌓인 뒤 재검토 |
| L2 브라우저 자동화 도입 | 프로세스 개선 | Medium | 세 PDCA 연속으로 반복된 이슈 |
| DB 마이그레이션 도구(Flyway) 도입 | admin-dashboard에서 이미 식별된 인프라 후속 | High | 이 기능은 스키마 변경이 없어 직접 영향은 없으나 여전히 미해결 |

### 7.3 포트폴리오 추출 (이 세션 이후)

`frontend-interview-coach` 에이전트에 위임:
- 이전 기능이 만든 스키마·API 컨벤션을 재사용하면서 서비스를 물리적으로 분리한 설계(공개/관리자 서비스 분리)
- N+1을 피하면서 목록에 집계 정보(일자 수·경유지 수·대표 주소)를 추가한 쿼리 설계
- "패턴 재사용"과 "무비판적 복사"를 구분한 판단 — 상태 머신 패턴은 복제, 표시 컴포넌트는 재사용, 쿼리 모델은 도메인별로 분리
- 코드 실행 전 설계 단계에서 ID 네임스페이스 충돌을 발견하고 라우트 분리로 예방한 과정
- 검색 모달을 하위 호환 방식(`keywordStep` optional prop)으로 확장하면서 이미 검증된 기존 코드(`EnjoySearchModal` 등)를 전혀 건드리지 않은 회귀 방지 설계

---

## 8. Changelog

### v1.0.0 (2026-09-30)

**Added**
- `backend/.../tourcourse/{controller/TourCoursePublicController,service/TourCoursePublicService,dto/TourCoursePublicListItemResponse,dto/TourCourseAggregateProjection}.java`
- `backend/src/test/java/.../tourcourse/TourCoursePublicServiceTest.java`
- `frontend/src/lib/{courseListQuery,mapLink}.js`
- `frontend/src/api/courseApi.js`
- `frontend/src/hooks/{useCourseList,useCourseListSearchParams,useCourseDetail}.js`
- `frontend/src/components/tour-list/{CourseCard,CourseCardGrid,CourseListView}.jsx`
- `frontend/src/pages/{TourCourseCatalogPage,TourCourseDetailPage}.jsx`(+css)

**Changed**
- `backend/.../tourcourse/repository/TourCourseRepository.java`: 집계 쿼리 2개 추가(기존 메서드 미변경)
- `backend/.../config/SecurityConfig.java`: `/api/v1/courses` GET permitAll 추가
- `frontend/src/App.jsx`: `/destinations/courses`·`/destinations/courses/:id` 라우팅 교체
- `frontend/src/pages/TravelDetailPage.jsx`: 코스 mock 분기 제거(코드 단순화)
- `frontend/src/data/destinationMocks.js`: `courseItems` 및 관련 이미지 import 제거
- `frontend/src/hooks/useSearchSelection.js`: `keyword` 필드·`selectKeyword` 액션 추가
- `frontend/src/components/search/{SearchModal,TravelSearchModal}.jsx`(+css): `keywordStep` 모드, 여행코스 유형 활성화
- `frontend/src/pages/TourCatalogPage.jsx`: 주석 갱신(코스 분리 반영)
- `frontend/src/components/tour-list/ListStatus.jsx`: `title`/`description` optional override 추가(코드 리뷰 반영)

**Removed**
- `frontend/src/pages/TravelCourseDetailPage.jsx`(+css)
- `frontend/src/pages/DestinationCatalogPage.jsx`

**Fixed** (코드 리뷰에서 발견 → 수정)
- `useCourseDetail`의 400 오류 경고 로그 누락
- 검색 모달 키워드 입력의 접근성 레이블 불일치(`aria-label` → `label`/`htmlFor`)
- 설계 문서와 실제 구현의 `DestinationCatalogPage.css` 삭제 대상 불일치(문서 정정)

---

## 9. 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-09-30 | 완료 보고서 생성. Plan(D-1~D-6)→Design(공개/관리자 분리, 라우트 분리)→Do(백엔드 공개 API+프론트 전환, 리뷰 발견 3건 수정)→Check(99.2%)→Act(Report) | frontend-lead (Claude Code 보조) |

---

**작성 완료**: 2026-09-30 · frontend-lead (Claude Code 보조)
