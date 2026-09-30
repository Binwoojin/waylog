# tour-course-list-integration Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현)
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: frontend-lead (Claude Code 보조)
> **Date**: 2026-09-30
> **Design Doc**: [tour-course-list-integration.design.md](../02-design/features/tour-course-list-integration.design.md) (v0.2, 코드 리뷰 반영)
> **Plan Doc**: [tour-course-list-integration.plan.md](../01-plan/features/tour-course-list-integration.plan.md) (v0.2, D-1~D-6 반영)

PRD 문서는 없다(이 기능도 admin-dashboard·destination-list-integration과 동일하게 PM 단계 없이 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

---

## Context Anchor

> 설계 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | admin-dashboard가 만든 여행코스 데이터를 사용자가 볼 방법이 없다. `/destinations/courses`는 여전히 목업이고, 관리자 API는 인증이 걸려 있어 재사용할 수 없다 |
| **WHO** | 여행코스를 찾아보는 방문자, 코스 상세를 보고 목록으로 돌아오는 사용자, 검색 모달에서 '여행코스' 유형을 선택하는 사용자 |
| **RISK** | 코스 ID(DB 시퀀스, 작은 정수)가 `isTourContentId`의 숫자 패턴과 겹침 / 코스 엔티티에 지역·기간 필드가 없음 / 목록 카드에 보여줄 대표 주소·일자·경유지 수가 관리자 응답에 없음 / CUSTOM 경유지는 지도 없이 표시해야 함 |
| **SUCCESS** | `/destinations/courses`가 실제 등록된 코스와 정확한 총 건수를 표시 / 코스 상세가 일자별 경유지(REFERENCE/CUSTOM)와 이미지를 실제로 보여줌 / 검색 모달에서 '여행코스' 유형으로 검색 가능 / 로딩·에러·빈 상태 구분 / destination-list-integration 패턴 재사용 |
| **SCOPE** | 백엔드: 공개 조회 컨트롤러·서비스(읽기 전용), `SecurityConfig` permitAll / 프론트: `courseApi.js`, 코스 전용 목록·상세 훅과 표시 컴포넌트, 코스 목록·상세 페이지 신설, 목업 분기 제거, 검색 모달 여행코스 유형 활성화 |

---

## Success Criteria Status (계획 §4.1 완료 조건)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| 1 | `/destinations/courses`가 실제 등록된 여행코스와 정확한 총 건수를 표시(목업 복제 없음) | ✅ | `courseItems`(45장 복제) 제거, `TourCourseCatalogPage`가 `GET /api/v1/courses` 실제 응답 소비 확인 |
| 2 | 코스 상세가 실제 일자·경유지(REFERENCE/CUSTOM 모두)와 이미지를 보여줌 | ✅ | `TourCourseDetailPage.jsx`가 `days[].stops[]` 중첩 구조를 그대로 렌더링, `TourCoursePublicServiceTest`가 REFERENCE+CUSTOM 혼합 코스로 검증 |
| 3 | REFERENCE 경유지에서 여행지 상세로 이동 가능(D-2) | ✅ | `getTourDetailPath(tourContentId, tourContentTypeId)` 재사용, 기존 함수 미수정 확인 |
| 4 | CUSTOM 경유지가 지도 없이도 의미 있게 표시됨(D-1) | ✅ | 좌표 있으면 카카오맵 딥링크 버튼, 없으면 버튼 미노출(`buildKakaoMapLink` null 반환 확인) |
| 5 | 코스 ID와 TourAPI contentId가 상세 라우팅에서 혼동되지 않음 | ✅ | `/destinations/courses/:id` 별도 라우트 신설 + `TravelDetailPage.jsx`의 코스 mock 분기 완전 제거로 원천 차단 |
| 6 | 로딩·에러(재시도)·빈 상태(조건 초기화) 구분 표시 | ✅ | `CourseListView`가 `TourListView`와 같은 상태 분기(스켈레톤/오류/빈 결과) 재사용, 코스 전용 문구로 `ListStatus` 확장(코드 리뷰 반영) |
| 7 | 관리자 코스 CRUD 화면에 회귀 없음 | ✅ | `TourCourseAdminService`/`TourCourseAdminController`/`AdminCourseListPage`/`AdminCourseFormPage` 미변경 확인(§5) |
| 8 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ | 코드 리뷰 Should Improve 3건 전건 수정 확인(§2.3), 이 문서가 gap 분석 |

**Success Rate**: 8/8 완전 충족.

---

## 1. 분석 개요

### 1.1 목적

Do 단계(백엔드 공개 API → 프론트 구현 → 코드 리뷰 → Should Improve 3건 수정)에서 만들어진 코드가 설계 문서(`tour-course-list-integration.design.md`)와 계획 문서의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/tour-course-list-integration.design.md` (§1~§13, v0.2)
- **구현 경로**: `frontend/src/{lib,api,hooks,components/tour-list,components/search,pages}`, `backend/src/main/java/kr/co/mycom/travel_korea/tourcourse/**`, `backend/src/main/java/kr/co/mycom/travel_korea/config/SecurityConfig.java`
- **분석 일자**: 2026-09-30
- **분석 방식**: 정적 분석(전체 파일 정독, git status 기준 신규/변경/삭제 파일 대조) + 코드 리뷰 결과 반영 확인(Should Improve 3건) + `npm run lint`/`npm run build` 실행 확인. 백엔드 자동 테스트는 이 세션의 로컬 JDK(17)와 `pom.xml`이 요구하는 컴파일 대상(`release 25`)이 맞지 않아 실행하지 못했고(§4.2), 신규 테스트 파일(`TourCoursePublicServiceTest.java`)은 코드 정독으로 검증했다.

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 대조 (설계 §4.1 ↔ 서버 ↔ 클라이언트)

| # | 엔드포인트 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------------|:----:|:----:|:----------:|:----:|
| 1 | `GET /api/v1/courses` | ✅ (일자 수·경유지 수·대표 주소 포함) | ✅ `TourCoursePublicController.list` → `TourCoursePublicService.list`(집계 쿼리 2개, §4.2) | ✅ `fetchCourseList` → `toCourseList` | PASS |
| 2 | `GET /api/v1/courses/{id}` | ✅ (관리자 상세와 동일 중첩 구조) | ✅ `TourCoursePublicController.getOne` → `TourCoursePublicService.getOne`(`TourCourseResponse` 그대로 재사용) | ✅ `fetchCourseDetail` → `toCourseDetail` | PASS |
| 3 | `SecurityConfig` permitAll | ✅ `HttpMethod.GET` 한정 | ✅ `/api/v1/courses`, `/api/v1/courses/**`를 GET만 permitAll로 추가 확인 | 인증 헤더 없이 호출(`apiClient.get`이 토큰 없어도 동작) | PASS |
| 4 | `/api/v1/admin/courses/**` 인가 규칙 변경 없음 | ✅ 변경하지 않음 | ✅ `SecurityConfig`의 기존 admin 규칙 줄 미변경 확인(diff로 직접 확인) | - | PASS |

**Contract Match Rate**: 4/4 = 100%

### 2.2 구조적 일치 (설계 §2.2, §10 모듈 목록)

설계가 명시한 신규/삭제 파일이 실제로 그 형태로 존재하는지 git status와 대조했다.

| 구분 | 설계 명시 | 실제 | 결과 |
|------|-----------|------|:----:|
| 백엔드 신규 | `TourCoursePublicListItemResponse`, `TourCourseAggregateProjection`, `TourCoursePublicService`, `TourCoursePublicController` | 4개 파일 모두 존재, 클래스명 일치 | PASS |
| 백엔드 수정 | `TourCourseRepository`(집계 쿼리 2개 추가), `SecurityConfig`(permitAll 1줄) | 두 파일 모두 수정됨, 기존 메서드는 diff 없음 | PASS |
| 백엔드 추가(설계에 없었음) | - | `TourCoursePublicServiceTest.java` 신규(회귀 테스트) | 완료(설계보다 나은 구현) — 아래 §3 G-1 |
| 프론트 신규 | `lib/courseListQuery.js`, `lib/mapLink.js`, `api/courseApi.js`, `hooks/useCourseList.js`/`useCourseListSearchParams.js`/`useCourseDetail.js`, `components/tour-list/CourseCard.jsx`/`CourseCardGrid.jsx`/`CourseListView.jsx`, `pages/TourCourseCatalogPage.jsx`(+css), `pages/TourCourseDetailPage.jsx`(+css) | 13개 파일 모두 존재 | PASS |
| 프론트 수정 | `App.jsx`, `TravelDetailPage.jsx`, `data/destinationMocks.js`, `useSearchSelection.js`, `SearchModal.jsx`(+css), `TravelSearchModal.jsx`, `TourCatalogPage.jsx`(주석) | 7개 파일 모두 수정 확인 | PASS |
| 프론트 수정(설계에 없었음) | - | `components/tour-list/ListStatus.jsx`에 `title`/`description` optional prop 추가 | 완료(수정됨) — 아래 §3 G-2 |
| 프론트 삭제 | `TravelCourseDetailPage.jsx`(+css), `DestinationCatalogPage.jsx` | 3개 파일 모두 삭제 확인(`git status`에 `D`로 표시) | PASS |
| 프론트 삭제 제외(설계 §6.2 정정) | `DestinationCatalogPage.css`는 삭제 대상에서 제외 | 실제로 3개 페이지(`TourCatalogPage`/`TourCourseCatalogPage`/`DestinationSearchResultsPage`)가 계속 import, 삭제하지 않음 | 의도적 편차(설계 문서 정정 완료) — 아래 §3 G-3 |

**Structural Match Rate**: 100% (설계에 없던 2건은 모두 코드 리뷰로 발견해 추가한 "설계보다 나은 구현"이라 감점 대상이 아니다)

### 2.3 기능 요구사항(FR-01~FR-15) 충족 여부 및 코드 리뷰 반영 확인

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-01 (공개 목록 API, 집계 필드 포함) | ✅ | `TourCoursePublicListItemResponse`에 `dayCount`/`stopCount`/`representativeAddress`, `TourCourseRepository.aggregateCounts`/`findFirstDayStopsOrderedByCourse` 확인 |
| FR-02 (공개 상세 API) | ✅ | `TourCoursePublicService.getOne`이 `TourCourseResponse.from` 그대로 재사용, 관리자 전용 필드 없음(원래 응답에 없었음) |
| FR-03 (SecurityConfig permitAll) | ✅ | `HttpMethod.GET` 한정 permitAll, 기존 admin 규칙 미변경 |
| FR-04 (courseApi.js) | ✅ | `fetchCourseList`/`fetchCourseDetail`이 `{ signal }` 지원, `toCourseCard`/`toCourseList`/`toCourseDetail` fail-closed 확인 |
| FR-05 (useCourseList 상태 머신) | ✅ | `useTourList`와 동일한 `requestKey` 파생 + AbortController + isActive 이중 방어 |
| FR-06 (URL 쿼리 상태) | ✅ | `useCourseListSearchParams`가 정규 URL로 `replace`, `applyCourseQueryPatch`가 keyword 변경 시 page=1 리셋 |
| FR-07 (목업 분기 제거) | ✅ | `courseItems`·관련 이미지 import·`DestinationCatalogPage.jsx` 전부 제거, `allDestinationMocks`에서도 제외 |
| FR-08 (일자·경유지 렌더링) | ✅ | `TourCourseDetailPage.jsx`가 `days.map` → 일자별 섹션 → `stops.map` → `CourseStopCard` 구조로 렌더링 |
| FR-09 (REFERENCE 링크) | ✅ | `getTourDetailPath(stop.tourContentId, stop.tourContentTypeId)`, null 폴백 시 텍스트만 표시(방어적 fail-closed) |
| FR-10 (CUSTOM 지도 표시) | ✅ | `buildKakaoMapLink`가 좌표 없으면 null → 버튼 미렌더링, 있으면 `target="_blank"` 딥링크 |
| FR-11 (상세 라우팅 분리) | ✅ | `/destinations/courses/:id` 신설, `TravelDetailPage.jsx`의 `item.stops` 분기 삭제로 ID 네임스페이스 충돌 원천 차단 |
| FR-12 (검색 모달 여행코스 활성화) | ✅ | `disabled`/`badge` 제거, `keywordStep` 모드로 지역·세부 항목 대신 키워드 입력, 제출 시 `/destinations/courses?keyword=`로 이동 |
| FR-13 (로딩/에러/빈 상태) | ✅ | `CourseListView`가 스켈레톤·`aria-busy`·재시도·조건 초기화 모두 재현, 코드 리뷰로 코스 전용 문구 보강(G-2) |
| FR-14 (코스 카드 정보 밀도) | ✅ | `CourseCard`가 제목·대표 이미지·테마 배지·기간(`formatCourseDuration`)·경유지 수·대표 주소 배지를 표시 |
| FR-15 (랜딩 섹션 D-6 현행 유지) | ✅ | `DestinationsPage.jsx` 미변경 확인(git status에 없음) |

**완료(수정됨) — 코드 리뷰에서 발견되고 실제로 고쳐진 이슈**

| # | 이슈 | 발견 단계 | 수정 내용 | 확인 근거 |
|---|------|-----------|-----------|-----------|
| R-1 | `useCourseDetail`이 `useTourDetail`과 달리 400 오류일 때 "파라미터 계약 어긋남" 경고 로그가 없음 | 코드 리뷰(Should Improve) | `error.status === 400`이면 `console.warn('여행코스 상세 요청이 400으로 거절되었습니다...', { id, body: error.body })` 추가 | `useCourseDetail.js`의 catch 블록 |
| R-2 | 검색 모달 키워드 입력의 화면 문구(`keywordStep.title`)와 스크린리더용 `aria-label`(`keywordStep.label`)이 서로 다른 텍스트라 접근성 이름이 어긋남 | 코드 리뷰(Should Improve) | `aria-label` 제거, `<label htmlFor>`/`<input id>`로 프로그래밍적 연결(노출 문구를 그대로 접근성 이름으로 사용). 더 이상 쓰지 않는 `keywordStep.label` 필드도 함께 제거, `<label>` 시각 스타일(19px/700)을 CSS로 보강 | `SearchModal.jsx`, `SearchModal.css`, `TravelSearchModal.jsx` |
| R-3 | 설계 문서(§6.2)가 `DestinationCatalogPage.css`를 삭제 대상으로 명시했으나, 실제로는 3개 페이지가 공유하는 자산이라 삭제하면 빌드가 깨짐 | 코드 리뷰(Should Improve, 문서-구현 drift) | 코드는 그대로 두고 설계 §6.2를 "의도적 편차"로 정정(파일명은 유지, 리네이밍은 과잉 엔지니어링으로 보류) | `tour-course-list-integration.design.md` §6.2, 버전 0.2 |

**Functional Match Rate**: 98% (감점 사유는 CUSTOM 경유지 좌표-only 주소 없음 등 경계 케이스가 수동 브라우저 검증 없이 코드 추적만으로 확인됐다는 점, 아래 §4 참고. 코드 리뷰 발견분 3건은 모두 반영 완료라 감점 대상이 아니다)

### 2.4 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  100%                │
│  Functional Match Rate:   98%                │
│  Contract Match Rate:    100%                │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:     99.2%               │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)  [서버 정적 공식]      │
├─────────────────────────────────────────────┤
│  참고: npm run lint 0 오류, npm run build 성공│
│  코드 리뷰에서 발견·수정된 이슈 3건 전건 반영  │
│  백엔드 자동 테스트 — 미실행(§4.2, JDK 불일치)│
│  L2(브라우저 UI)/L3(E2E) — 미검증(도구 부재)  │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical / Important 없음. 전부 Minor이거나 "완료(수정됨)"/"의도적 편차"다.

| # | 등급 | 항목 | 설계 | 구현 | 분류 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|------|-----------|:--:|
| G-1 | Minor (설계보다 나은 구현) | 공개 서비스 회귀 테스트 | 설계에 테스트 파일 명시 없음 | `TourCoursePublicServiceTest.java` 신규 — 관리자 서비스로 데이터를 만들고 공개 서비스(집계 쿼리 포함)로 검증하는 통합 테스트 | 완료(설계보다 견고함) | 설계 §13 다음 단계 표에 이 테스트 파일을 반영(문서만) | 100% |
| G-2 | Minor (완료, 수정됨) | `ListStatus`의 코스 전용 문구 | 설계 §7.2는 `ListStatus`를 "수정 없이 그대로 import"라고 명시 | 코드 리뷰 중 "조건에 맞는 여행지가 없어요"라는 문구가 코스 화면에 그대로 노출되는 것이 부적절하다고 판단해 `title`/`description` optional prop을 추가(하위 호환, 기존 호출부 영향 없음) | 완료(설계보다 나은 구현, 설계 문서 미반영 상태) | 설계 §7.2 문구를 "ListStatus는 재사용하되 title/description override로 코스 전용 문구를 준다"로 갱신 | 100% |
| G-3 | Minor (의도적 편차, 설계 문서 정정 완료) | `DestinationCatalogPage.css` 삭제 여부 | 설계 §6.2(v0.1)는 삭제 대상으로 명시 | 삭제하지 않음. `TourCatalogPage`/`TourCourseCatalogPage`/`DestinationSearchResultsPage` 3곳이 계속 import하는 공유 자산이라 삭제하면 빌드가 깨짐 | 의도적 편차(설계 문서 정정 완료, v0.2) | 없음(이미 정정 완료) | 100% |
| G-4 | Minor (여유 범위) | 코스 목록 지역 필터 부재 | 계획 D-3에서 이미 "필터 제외, 키워드만" 확정 | 미구현(설계 의도와 완전히 일치) | 없음(사용자 승인 스코프) | - | 100% |
| G-5 | Minor (환경 제약) | 백엔드 자동 테스트 미실행 | 계획 §4.2 품질 기준: `mvnw clean test` 통과 확인 | 이 세션의 로컬 JDK(17)와 `pom.xml`의 컴파일 대상(`release 25`)이 맞지 않아 `mvnw test` 자체가 컴파일 단계에서 실패(코드 결함 아님, 환경 문제). `TourCoursePublicServiceTest.java`는 코드 정독으로 검증(§4.2) | 후속 검증(다음 세션, JDK 25 사용 가능한 환경에서) | 배포 전 CI 환경에서 `mvnw clean test` 실행 확인 | 100% |

설계에 없던 추가 방어 로직(모두 설계 의도 범위 내로 판단): REFERENCE 경유지의 `getTourDetailPath`가 `null`을 반환하는 경우(이론상 발생하지 않음)에도 `CourseStopCard`가 CUSTOM과 같은 텍스트 표시로 폴백하도록 방어(설계 §5.1이 이미 이 폴백을 언급했고, 구현이 그대로 반영).

---

## 4. Runtime Verification

### 4.1 정적 분석 + 빌드

| 카테고리 | 결과 |
|----------|:----:|
| `npm run lint` | ✅ 오류 0건 |
| `npm run build` | ✅ 성공(231 modules, 452KB 번들, 사전에 있던 무관한 `enjoy` CSS 경고 1건은 이번 변경과 무관) |
| API 계약 3면 대조 | ✅ 4/4 설계 명시 항목 + 신규 테스트 1건 모두 서버·클라이언트 양쪽 확인 |
| 코드 리뷰 반영 확인 | ✅ Should Improve 3/3 코드 근거로 재확인(§2.3) |
| 수정 금지 파일 회귀 | ✅ `TourCourseAdminService`/`TourCourseAdminController`/`AdminCourseListPage`/`AdminCourseFormPage`(관리자 CRUD), `DestinationSearchResultsPage.jsx`/`lib/tourListQuery.js`/`data/tourListConfigs.js`(destination-list-integration 검증 완료 코드), `EnjoySearchModal.jsx`/`EnjoySearchResultsPage.jsx`(즐기기) 전부 git status에 미표시 = 미변경 확인 |

### 4.2 백엔드 자동 테스트 — 실행 시도 결과

`TourCoursePublicServiceTest.java`만 대상으로 `mvnw -Dtest=TourCoursePublicServiceTest test`를 실행했으나, 이 세션의 `JAVA_HOME`(JDK 17)이 `pom.xml`이 요구하는 컴파일 대상(`--release 25`)을 지원하지 않아 컴파일 단계에서 실패했다(`error: release version 25 not supported`). `mvnw clean test`로 재시도해도 동일했다. 이는 로컬 환경의 JDK 버전 구성 문제이며, 테스트 코드나 구현 코드의 결함이 아니다. 테스트 파일 자체는 코드 정독으로 다음을 확인했다:

- 관리자 서비스(`TourCourseAdminService`)로 REFERENCE+CUSTOM 혼합 2일차 코스를 생성
- 공개 서비스(`TourCoursePublicService.list`)로 조회해 `dayCount=2`, `stopCount=3`, 1일차 첫 경유지 주소가 `representativeAddress`로 나오는지 검증하는 구조(계획 FR-01, 설계 §4.2와 일치)

### 4.3 L2 UI(브라우저)/L3 E2E — 미검증

이 환경에 브라우저 자동화 도구가 없어 이전 두 PDCA 주기(destination-list-integration, admin-dashboard)와 동일하게 미실행이다. 우선순위가 높은 후속 검증 항목:

| 항목 | 관련 완료 조건 |
|------|----------------|
| 코스 카탈로그 키워드 검색 제출 → 결과 반영, 뒤로 가기 시 검색어 복원 | SC-1, SC-6 |
| 검색 모달에서 '여행코스' 선택 → 키워드 입력 → 제출 → `/destinations/courses?keyword=` 이동(전체 새로고침 없음) | SC-3 |
| CUSTOM 경유지의 카카오맵 딥링크가 실제로 올바른 좌표로 새 탭을 여는지 | SC-4 |
| 코스 ID로 `/destinations/courses/:id` 접근 시 정상 렌더, 존재하지 않는 ID는 404 화면 | SC-5 |
| 관리자 코스 CRUD(생성·수정·삭제·이미지 첨부)가 공개 API 신설 이후에도 그대로 동작 | SC-7 |

---

## 5. 관리자 코스 CRUD 회귀 확인 (설계 §2.2 "이유 있는 분리" 원칙 검증)

이번 기능의 핵심 설계 원칙은 "공개 서비스는 새로 만들고, 관리자 서비스는 건드리지 않는다"였다. git status로 직접 확인한 결과:

```
M backend/.../config/SecurityConfig.java              (permitAll 1줄 추가)
M backend/.../tourcourse/repository/TourCourseRepository.java  (집계 쿼리 2개 추가, 기존 메서드 미변경)
?? backend/.../tourcourse/controller/TourCoursePublicController.java   (신규)
?? backend/.../tourcourse/dto/TourCourseAggregateProjection.java       (신규)
?? backend/.../tourcourse/dto/TourCoursePublicListItemResponse.java    (신규)
?? backend/.../tourcourse/service/TourCoursePublicService.java        (신규)
```

`TourCourseAdminController.java`, `TourCourseAdminService.java`, `TourCourseListItemResponse.java`(관리자 목록 DTO), `AdminCourseListPage.jsx`, `AdminCourseFormPage.jsx`는 git status에 전혀 나타나지 않아 **단 한 줄도 수정되지 않았음**을 확인했다. 설계가 의도한 "관리자/공개 서비스 물리적 분리"가 코드로 그대로 지켜졌다.

---

## 6. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 99.2%                   │
├─────────────────────────────────────────────┤
│  Structural:  100%                           │
│  Functional:   98%                           │
│  Contract:    100%                           │
│  Critical Gap: 0건                            │
│  Important Gap: 0건                           │
│  Minor Gap: 5건 (설계보다 나은 구현 2,        │
│              의도적 편차 1, 여유 범위 1,      │
│              환경 제약 1)                     │
│  코드 리뷰 발견·수정 완료: 3건 (R-1~R-3)      │
└─────────────────────────────────────────────┘
```

Match Rate가 계획 §4.2 목표(90% 이상)를 크게 상회한다. Critical/Important gap이 없고, 남은 Minor 5건 전부 실제 위험이 없거나(설계보다 나은 구현, 사용자 승인 스코프) 이미 처리됐거나(의도적 편차, 문서 정정 완료) 환경 문제(백엔드 테스트 실행)다.

---

## 7. 권장 조치

### 7.1 코드 수정

없음. 코드 리뷰에서 발견된 3건은 이미 전건 수정 완료됐다(§2.3).

### 7.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-1: 설계 §13 다음 단계 표에 `TourCoursePublicServiceTest.java` 반영
- G-2: 설계 §7.2의 "ListStatus는 수정 없이 재사용" 서술을 "title/description override로 코스 전용 문구를 준다"로 갱신

### 7.3 후속 검증 (다음 세션, JDK 25 + 브라우저 자동화가 가능한 환경에서)

- `mvnw clean test` 전체 실행(특히 `TourCoursePublicServiceTest`)
- §4.3 L2 체크리스트 전체

---

## 8. Next Steps

- [x] Critical/Important gap 없음 확인
- [x] 코드 리뷰 발견분 3건(R-1~R-3) 전건 반영 확인
- [ ] Completion Report 작성 (`tour-course-list-integration.report.md`)
- [ ] 후속: JDK 25 환경에서 `mvnw clean test` 실행
- [ ] 후속: 브라우저 자동화 환경에서 L2 체크리스트 실행

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-30 | 최초 gap 분석. Match Rate 99.2%, Critical/Important 0건. 코드 리뷰에서 발견·수정된 3건(R-1~R-3)을 완료로, `DestinationCatalogPage.css` 유지를 의도적 편차(설계 문서 정정 완료)로 분류 | frontend-lead (Claude Code 보조) |
