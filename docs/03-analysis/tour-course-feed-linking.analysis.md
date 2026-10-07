# tour-course-feed-linking Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현)
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: frontend-lead (Claude Code 보조)
> **Date**: 2026-10-01
> **Design Doc**: [tour-course-feed-linking.design.md](../02-design/features/tour-course-feed-linking.design.md) (v0.1)
> **Plan Doc**: [tour-course-feed-linking.plan.md](../01-plan/features/tour-course-feed-linking.plan.md) (Approved, Q-1~Q-4 결정 완료)

PRD 문서는 없다(이전 사이클들과 동일하게 PM 단계 없이 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

**계보 고지**: 이 기능은 `admin-dashboard` 설계 단계(§8)가 "여행코스 API 계약은 피드와도 연결되는 부분이라 지금 확정하기 어렵다"며 명시적으로 유보했던 결정을, `tour-course-list-integration`과 `feed-comment-integration`까지 포함해 **4개의 선행 PDCA 사이클이 끝난 뒤** 실제로 설계·구현한 것이다. Plan 단계에서 frontend-lead가 권장했던 "코스 전체 단일 참조"안은 사용자 결정(Q-1)으로 기각되고 "일자 필수 + 경유지 선택"의 2단 참조 모델이 채택됐다. 이 gap 분석은 그 결정이 반영된 설계 대비 실제 구현을 대조한다.

---

## Context Anchor

> 계획·설계 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | `admin-dashboard.design.md` §8이 명시적으로 유보한 연동을, 여행코스·피드 두 기능이 각각 완성된 뒤 실제로 설계·구현할 차례가 됐다 |
| **WHO** | 여행코스를 보고 실제로 여행을 떠난 뒤 후기를 남기고 싶은 사용자 / 코스 상세에서 "진짜 이 코스로 여행한 사람이 있는지" 확인하고 싶은 사용자 / 신고된 게시물이 어느 코스를 가리키는지 확인하려는 관리자 |
| **RISK** | 코스 관리자가 구조를 바꾸거나(일자·경유지 삭제) 코스 자체를 삭제할 때, 참조 중인 피드 게시물이 있으면 기본 FK 제약(`RESTRICT`)이 그 삭제를 막아 코스 관리 기능에 500 오류를 일으킬 수 있음(설계 §5) |
| **SUCCESS** | 사용자가 게시물 작성 시 코스의 일자·경유지를 태그할 수 있다 / 코스 상세에서 참조 피드 목록을 볼 수 있다 / 코스 구조 변경·삭제가 피드에 영향을 주지 않는다 / 관리자가 `AdminFeedDetailPage`에서 참조 정보를 확인할 수 있다 |
| **SCOPE** | 백엔드: `FeedPost` 참조 컬럼 6개, `FeedCreateRequest`/`FeedPostResponse`/`FeedAdminPostResponse` 확장, `FeedController`/`FeedService` 필터 확장, 리포지토리 2개 신규 / 프론트: `CourseReferencePicker.jsx` 신규, `FeedComposer.jsx`/`TourCourseDetailPage.jsx`/`AdminFeedDetailPage.jsx` 수정 |

---

## Success Criteria Status (계획 §4.1 완료 조건, §4.2 품질 기준)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | 사용자가 게시물 작성 시 여행코스를 선택해 태그할 수 있다(일자 필수, 경유지 선택) | ✅ | `CourseReferencePicker.jsx`(코스 검색 → 일자/경유지 선택) → `FeedComposer.jsx`의 `courseTag` state → `createFeedPost`의 `linkedCourseDayId`/`linkedCourseStopId` 전송 → `CourseLinkResolver.resolve`가 서버에서 체인 검증·스냅샷 채움(`CourseLinkResolverTest` 7건, `FeedCourseLinkIntegrationTest` T-1/T-2 확인) |
| SC-2 | 코스 상세 화면에서 그 코스를 참조한 피드 목록을 확인할 수 있다 | ✅ | `TourCourseDetailPage.jsx`의 `CourseFeedSection` → `useCourseFeedPosts`(`useFeedInfiniteList` 재사용) → `GET /api/v1/feed/posts?linkedCourseId=` → `FeedPostRepository.findByLinkedCourseIdAnd...` 확인. `FeedCourseLinkIntegrationTest.getFeedFiltersByLinkedCourseIdWithoutAffectingMainTimeline`가 필터링·회귀 둘 다 검증 |
| SC-3 | 기존 피드 게시물(코스 미태그)이 오류 없이 그대로 보인다 | ✅ | 마이그레이션(`2026-10-01-tour-course-feed-linking.sql`)이 `ADD COLUMN ... NULL`만 포함, 데이터 이관 구문 없음(Q-4 확정 그대로). `createWithoutCourseLinkLeavesLinkedCourseNull` 테스트로 `linkedCourse`가 `null`로 정상 처리됨을 확인 |
| SC-4 | 기존 TourAPI 위치 태깅, 코스 목록/상세, 피드 타임라인/댓글/좋아요/북마크에 회귀가 없다 | ✅ | `git status`에 `TourReferencePicker.jsx`, `TourCourseAdminService.java`, `TourCourseAdminController.java`, `AdminCourseFormPage.jsx`, 피드 좋아요·북마크·댓글 관련 파일, `SecurityConfig.java` 전혀 미표시(미변경) 확인(§5). `FeedPage.jsx`/`FeedUserProfilePage.jsx`도 무변경(두 화면 모두 `FeedCard.jsx`를 재사용하므로 아이콘 교체 등은 자동 반영되되 로직 변경은 없음) |
| SC-5 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ | Must Fix 1건(`hasCourseLink()` 게이트 조건) + Should Improve 1건(코스/위치 태그 아이콘 미구분) 전건 수정 확인(§3), 이 문서가 gap 분석 |
| QC-1 | `npm run lint` 오류 0, `npm run build` 성공 | ✅ | 이번 세션에서 재실행 확인(§4.1) |
| QC-2 | 백엔드 신규 테스트(유효하지 않은 코스 id 거부, PRIVATE/소프트삭제 게시물 제외) | ✅ | `CourseLinkResolverTest`(7건) + `FeedCourseLinkIntegrationTest`(7건) = 14건 신규. `findByLinkedCourseIdAndVisibilityAndDeletedAtIsNull...` 메서드명 자체가 `visibility="PUBLIC"`·`deletedAtIsNull` 조건을 고정해 구조적으로 보장 |
| QC-3 | gap 분석 Match Rate 90% 이상 | ✅ | 아래 §2.4 — Overall 99.2% |

**Success Rate**: 8/8 완전 충족.

---

## 1. 분석 개요

### 1.1 목적

`tour-course-feed-linking`의 구현(백엔드 신규 참조 모델 + API 확장 + 프론트 코스 태깅 UI)과 그 이후의 코드 리뷰 수정 사항이, 설계(`tour-course-feed-linking.design.md`) 및 계획(`tour-course-feed-linking.plan.md` FR-01~08)의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/tour-course-feed-linking.design.md`(§1~§15, v0.1)
- **구현 경로**: `backend/.../feed/{domain/FeedPost.java, dto/Feed{CreateRequest,PostResponse,AdminPostResponse}.java, repository/FeedPostRepository.java, service/{FeedService,CourseLinkResolver}.java, controller/FeedController.java}`, `backend/.../tourcourse/repository/{TourCourseDayRepository,TourCourseStopRepository}.java`(신규), `backend/db/migrations/2026-10-01-tour-course-feed-linking.sql`, `frontend/src/{components/common/CourseReferencePicker.jsx(+css), components/icons/CourseRouteIcon.jsx, components/feed/Feed{Card,Composer}.jsx(+css), api/{feedApi,adminFeedApi}.js, hooks/{useFeedInfiniteList,useCourseFeedPosts}.js, pages/{FeedDetailPage,TourCourseDetailPage,admin/AdminFeedDetailPage}.jsx(+css)}`
- **분석 일자**: 2026-10-01
- **분석 방식**: 정적 분석(전체 파일 정독, `git status` 기준 신규/변경 파일 대조) + 코드 리뷰 Must Fix 1건·Should Improve 1건 반영 확인(코드 레벨 재확인) + `npm run lint`/`npm run build` 실행 확인 + 백엔드 신규 테스트 2개 파일(14개 테스트) 정독 + `surefire-reports` 집계로 전체 스위트 106/106 통과 확인

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 대조 (설계 §4.1~§4.5 ↔ 서버 ↔ 클라이언트)

| # | 계약 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------|:----:|:----:|:----------:|:----:|
| 1 | `POST /api/v1/feed/posts`의 `post` 파트에 `linkedCourseDayId`/`linkedCourseStopId` | ✅ 클라이언트는 이 둘만 전송, courseId는 서버가 채움 | ✅ `FeedCreateRequest`에 두 필드 추가, `FeedService.create`가 `CourseLinkResolver` 호출 | ✅ `feedApi.js`의 `createFeedPost`가 `courseTag.dayId`/`courseTag.stopId`만 전송(courseId·스냅샷 미전송) | PASS |
| 2 | `FeedPostResponse.linkedCourse` (nullable, `{courseId,courseTitle,dayId,dayNumber,stopId,stopName}`) | ✅ | ✅ `LinkedCourseResponse` 레코드, `FeedPostResponse.from`이 포함 | ✅ `feedApi.js`의 `toCourseTag()`가 그대로 흡수, `detailPath`는 `courseId`가 있을 때만 생성 | PASS |
| 3 | `GET /api/v1/feed/posts?linkedCourseId=` (코스 참조 피드 목록, 신규 엔드포인트 아님) | ✅ 기존 타임라인 API 확장 | ✅ `FeedController.getFeed`에 `linkedCourseId` 선택 파라미터 추가, `FeedService.getFeed` 3인자 오버로드가 4인자(`null`)로 위임(설계보다 더 안전한 하위 호환 방식) | ✅ `fetchFeedTimeline({..., linkedCourseId})`, `useFeedInfiniteList`가 옵션으로 수용, `useCourseFeedPosts`가 감쌈 | PASS(서버가 설계안보다 견고한 오버로드 구조 채택 — 감점 아님) |
| 4 | `FeedAdminPostResponse.linkedCourse` (공개 응답과 같은 타입 재사용) | ✅ | ✅ `FeedAdminPostResponse`에 `FeedPostResponse.LinkedCourseResponse` 그대로 재사용 | ✅ `adminFeedApi.js`의 `toCourseTag()`(관리자 전용, 링크 없이 텍스트만) | PASS |
| 5 | `SecurityConfig` 변경 여부 | ✅ 변경 불필요(쿼리 파라미터는 매처 대상 아님) | ✅ `git status`에 `SecurityConfig.java` 미표시(미변경) | 실제 코드 확인 | PASS |

**Contract Match Rate**: 5/5 = 100%

### 2.2 구조적 일치 (설계 §13 의존성 목록)

| 구분 | 설계 명시 | 실제 | 결과 |
|------|-----------|------|:----:|
| 백엔드 신규 | `CourseLinkResolver`, `TourCourseDayRepository`, `TourCourseStopRepository`, 마이그레이션 SQL | 전 파일 존재, 클래스명·패키지 설계와 일치(`CourseLinkResolver`는 package-private, 설계 의도인 "feed 모듈 내부 전용" 그대로) | PASS |
| 백엔드 수정 | `FeedPost`, `FeedCreateRequest`, `FeedPostResponse`, `FeedAdminPostResponse`, `FeedPostRepository`, `FeedController`, `FeedService` | 전부 확인, 필드·메서드명 설계와 일치 | PASS |
| 백엔드 수정(설계보다 개선) | `FeedPost.hasCourseLink()`가 `linkedCourseDayId != null`로 게이트(설계 §3.1 코드 예시 원문) | **코드 리뷰로 변경**: `linkedCourseTitle != null`(스냅샷 컬럼) 게이트로 수정 — 코스가 삭제돼 `linkedCourseDayId`까지 `NULL`이 되어도 스냅샷은 API 응답에 남는다(설계 §5.3이 원래 의도했던 동작) | 완료(Must Fix, 수정됨) — 아래 §3 G-1 |
| 백엔드 수정(설계보다 개선) | `FeedService.getFeed(loginEmail, cursor, size, linkedCourseId)` 단일 메서드(설계 §4.4 코드 예시) | 3인자 오버로드가 4인자 메서드에 `null` 위임하는 구조로 구현 — 기존 3인자 호출 관례(혹시 모를 다른 호출부)까지 하위 호환 보장 | 완료(설계 의도 동일, 더 안전한 구현으로 대체, 감점 아님) |
| 백엔드 신규 테스트(설계에 파일 목록 없음) | - | `CourseLinkResolverTest`(7건), `FeedCourseLinkIntegrationTest`(7건) | 완료(설계 §11 테스트 계획 T-1~T-9를 실제 테스트 코드로 구현, 설계보다 상세) |
| 백엔드 변경 없음(계획·설계가 명시) | `TourCourseAdminService`/`TourCourseAdminController`/`TourReferencePicker.jsx`/피드 댓글·좋아요·북마크/`SecurityConfig` | `git status`에 전혀 나타나지 않음(미변경 확인) | PASS |
| 프론트 신규 | `CourseReferencePicker.jsx`(+css), `useCourseFeedPosts.js` | 전 파일 존재, 설계 §6.1/§6.4와 일치 | PASS |
| 프론트 신규(설계에 없었음) | - | `components/icons/CourseRouteIcon.jsx` | 완료(코드 리뷰 Should Improve로 추가, §3 G-2) |
| 프론트 수정 | `FeedComposer.jsx`, `TourCourseDetailPage.jsx`(+css), `AdminFeedDetailPage.jsx`(+css), `api/{feedApi,adminFeedApi}.js` | 전부 확인, 설계와 일치 | PASS |
| 프론트 수정(설계보다 구체화) | `useFeedInfiniteList`를 `linkedCourseId` 옵션으로 일반화(설계 §6.4가 "재사용 가능한지 판단"으로만 열어둠) | 기존 훅에 `{ linkedCourseId }` 옵션 파라미터 추가(하위 호환, 기존 `FeedPage` 호출부 무변경), `useCourseFeedPosts`가 얇은 래퍼로 감쌈 | 완료(설계가 열어 둔 선택지 중 "재사용" 쪽을 코드로 확정) |

**Structural Match Rate**: 100%(설계에 없던 `CourseRouteIcon`/`hasCourseLink` 수정은 코드 리뷰로 발견된 문제를 고치는 과정에서 생긴 것이라 감점 대상이 아니다)

### 2.3 기능 요구사항(FR-01~08) 충족 여부 및 코드 리뷰 반영 확인

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-01 (`FeedPost` 참조 컬럼 6개 + `ON DELETE SET NULL`) | ✅ | `linkedCourse{Id,Title,DayId,DayNumber,StopId,StopName}` 전부 확인. 마이그레이션 SQL의 FK 3종 모두 `ON DELETE SET NULL` 확인 |
| FR-02 (`FeedCreateRequest` + `CourseLinkResolver` 서버 검증) | ✅ | `linkedCourseDayId`/`linkedCourseStopId`만 요청에 존재, `CourseLinkResolver.resolve`가 체인 검증(일자 없이 경유지만 거부, 소속 불일치 거부, 존재하지 않는 id 거부) — `CourseLinkResolverTest` 7건 전부 통과 |
| FR-03 (`FeedPostResponse.linkedCourse`) | ✅(Must Fix로 게이트 조건 개선) | `hasCourseLink()`가 스냅샷 컬럼 기준으로 수정되어, 코스 삭제 후에도 스냅샷이 API 응답에 남음(§3 G-1) |
| FR-04 (`GET /feed/posts?linkedCourseId=`) | ✅ | `FeedController`/`FeedService`/`FeedPostRepository` confirmed, `FeedCourseLinkIntegrationTest.getFeedFiltersByLinkedCourseIdWithoutAffectingMainTimeline`가 필터링·회귀 둘 다 검증 |
| FR-05 (`CourseReferencePicker.jsx`) | ✅ | 코스 검색(1단계, `fetchCourseList` 재사용) → 일자/경유지 선택(2단계, `fetchCourseDetail` 재사용) 2단계 모달 확인. `TourReferencePicker.jsx`는 `git status` 미표시로 무변경 확인 |
| FR-06 (코스 상세 참조 피드 섹션) | ✅ | `CourseFeedSection`(로딩/에러/빈 상태/"더 보기" 구분, `FeedCard` 재사용, 좋아요·북마크 낙관적 업데이트까지 `FeedPage.jsx`와 동일 패턴으로 구현) |
| FR-07 (피드 카드·상세 코스 태그 표시+링크) | ✅(Should Improve로 아이콘 개선) | `FeedCard.jsx`/`FeedDetailPage.jsx`에 코스 태그 표시, `detailPath` 있을 때만 링크(거짓 링크 방지). 최초 구현은 위치 태그와 동일한 `PlacePinIcon`을 썼으나 코드 리뷰로 `CourseRouteIcon`(신규)으로 교체(§3 G-2) |
| FR-08 (`AdminFeedDetailPage.jsx` 참조 표시) | ✅ | "참조한 여행코스: OO코스 · N일차 · 경유지명" 읽기 전용 한 줄 확인, 링크 없음(설계 의도대로 — 관리자 코스 상세 화면 자체가 없음) |

**코드 리뷰에서 발견되고 실제로 고쳐진 이슈 — 완료(수정됨)**

| # | 이슈 | 발견 단계 | 수정 내용 | 확인 근거 |
|---|------|-----------|-----------|-----------|
| G-1 | (Must Fix) `FeedPost.hasCourseLink()`가 FK 컬럼(`linkedCourseDayId != null`)을 게이트로 썼다. 설계 §5.2가 "코스/일자가 `ON DELETE SET NULL`로 삭제되면 FK 컬럼은 `NULL`이 되지만 스냅샷 컬럼은 남는다"고 명시했는데도, 이 게이트 조건 때문에 코스(또는 일자)가 삭제되는 순간 `linkedCourseDayId`까지 `NULL`이 되어 `hasCourseLink()`가 `false`를 반환 — 결과적으로 `linkedCourse` 응답 객체 전체가 `null`이 되어, 어렵게 남겨둔 스냅샷 텍스트(코스명 등)가 API 레벨에서 통째로 사라지는 문제. 이는 사용자가 리뷰 전 미리 제기했던 우려("linkedCourse가 courseId 없이 title만 있는 경우가 생기는데 프론트가 그 케이스를 맞게 처리하는지")가 실제로는 그 경우 자체가 백엔드에서 발생하지 않던(= API가 그 상태를 아예 숨기던) 더 근본적인 문제였음이 코드 리뷰로 확인된 사례 | frontend-code-reviewer(Must Fix) | 게이트 조건을 `linkedCourseTitle != null`(스냅샷 컬럼)로 변경. FK 컬럼은 참조 무결성을 위한 것이고, "이 게시물이 한때 코스를 참조한 적이 있는가"라는 질문에는 스냅샷 컬럼이 답해야 한다는 원칙으로 수정 | `FeedPost.java`의 `hasCourseLink()` 주석(이유 명시), `FeedCourseLinkIntegrationTest.deletingReferencedCourseNullsAllLinkIdsButKeepsSnapshot`이 API 레벨(`feedService.getOne()`)에서 `linkedCourse`가 `null`이 아니고 `courseId`만 `null`, `courseTitle`/`stopName`은 유지됨을 명시적으로 검증 |
| G-2 | (Should Improve) `FeedComposer`/`FeedCard`/`FeedDetailPage`에서 코스 태그 칩에도 위치 태그(TourAPI)와 동일한 `PlacePinIcon`을 그대로 써서, 설계상 명확히 다른 두 개념(장소 하나 vs 코스의 일자·경유지로 이어지는 경로)이 아이콘으로는 구분되지 않음 | frontend-code-reviewer(Should Improve) | `components/icons/CourseRouteIcon.jsx` 신규(두 지점을 점선 경로로 잇는 모양, 기존 `HeartIcon`/`PlacePinIcon`과 동일한 props 규칙). 코스 태그가 표시되는 3곳(`FeedComposer`/`FeedCard`/`FeedDetailPage`) 전부 교체, 위치 태그의 `PlacePinIcon`은 그대로 유지 | `CourseRouteIcon.jsx`, 세 파일의 import·JSX 교체 확인, `npm run lint`/`build` 통과 |

**완료(문서만, 후속 과제로 분류 — Nice to Have)**

| # | 항목 | 내용 |
|---|------|------|
| G-3 | Nice to Have | `FeedCreateRequest.imageUrls` 필드가 실제로는 사용되지 않는다 — 이미지 업로드는 전부 멀티파트 `images` 파트(파일)로 처리되고(`FeedController.create`), JSON 바디의 `imageUrls` 문자열 목록 경로는 호출되지 않는다. 이 기능이 새로 만든 문제는 아니며(`feed-integration` 시점부터 존재하던 "향후 URL 업로드 방식도 지원할 수 있도록" 남겨둔 필드), 이번 코드 리뷰에서 다시 지적됨 |
| G-4 | Nice to Have | `useFeedInfiniteList.js`의 JSDoc 주석이 `linkedCourseId` 옵션을 설명하지만, 함수 시그니처 바로 위 원래 "커서 기반 무한 스크롤" 설명과 신규 옵션 설명이 한 블록에 섞여 있어 가독성이 다소 떨어짐(기능상 문제 없음) |
| G-5 | Nice to Have | `CourseReferencePicker`의 로딩 상태가 텍스트("검색 중입니다...", "불러오는 중입니다...")만 있고 시각적 로딩 인디케이터(스피너 등)가 없음 — 다른 모달(`TourReferencePicker`)과 동일한 수준이라 일관성은 있으나, 개선 여지로 지적됨 |
| G-6 | Nice to Have | `FeedCreateRequest.linkedCourseDayId`/`linkedCourseStopId`에 `@Positive`(또는 `@Min(1)`) validation이 없다 — 음수·0 값이 들어와도 Bean Validation 단계에서 걸러지지 않고 `CourseLinkResolver`가 "존재하지 않는 여행코스 일자입니다" 수준의 일반 404류 오류로 처리한다(보안·정합성 문제는 없음, 오류 메시지 구체성만 다름) |

**Functional Match Rate**: 98%(FR 8/8 전부 충족, Must Fix 1건·Should Improve 1건 전건 수정 완료. 감점 사유는 G-3~G-6 Nice to Have 4건 — 전부 기능 영향 없는 개선 여지)

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
│  코드 리뷰 Must Fix 1건 + Should Improve 1건  │
│  전건 반영 확인                                │
│  백엔드 신규 테스트 14개(코드 정독 + 실행 로그 확인)│
│  백엔드 전체 스위트 106/106 통과(surefire 집계) │
│  L2(브라우저 UI)/L3(E2E) — 미검증(도구 부재)  │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical 없음. Important(Must Fix/Should Improve 대응) 2건은 전부 "완료(수정됨)". 나머지는 Nice to Have 4건뿐이다.

| # | 등급 | 항목 | 설계 | 구현 | 분류 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|------|-----------|:--:|
| G-1 | Important(완료, 수정됨) | `hasCourseLink()`가 FK 컬럼을 게이트로 써서 코스 삭제 시 스냅샷이 API에서 통째로 사라짐 | 설계 §5.3이 "삭제된 참조는 스냅샷 텍스트로 표시되어야 한다"고 명시했으나, §3.1 코드 예시 자체가 FK 컬럼(`linkedCourseDayId`) 기준 게이트를 제시해 설계 문서 내부에 모순이 있었음 | `hasCourseLink()`를 `linkedCourseTitle != null`(스냅샷 컬럼) 기준으로 수정 | 완료(Must Fix, 수정됨) | 설계 §3.1/§5.3의 코드 예시를 `linkedCourseTitle` 게이트로 갱신해 두 절의 모순을 문서에서도 해소 | 100% |
| G-2 | Important(완료, 수정됨) | 코스 태그와 위치 태그가 같은 아이콘(`PlacePinIcon`)을 공유해 시각적으로 구분되지 않음 | 설계에 아이콘 종류까지는 명시하지 않음(구현 세부사항) | `CourseRouteIcon.jsx` 신규, 3개 파일에서 교체 | 완료(Should Improve, 수정됨) | 없음 | 100% |
| G-3 | Nice to Have(후속 과제) | `FeedCreateRequest.imageUrls` 미사용 필드 | 설계에 명시 없음(feed-integration 이전부터 존재) | 멀티파트 업로드만 사용, JSON 필드 경로 미사용 | 후속 과제(정리 또는 실제 구현) | 사용 계획이 없다면 필드 제거, 향후 URL 업로드를 지원할 계획이면 `FeedController`에 실제 처리 경로 추가 | 100% |
| G-4 | Nice to Have(후속 과제) | `useFeedInfiniteList.js` JSDoc 가독성 | 설계에 명시 없음(구현 세부사항) | 신규 옵션 설명이 기존 설명과 한 블록에 섞임 | 후속 과제(주석 정리) | `linkedCourseId` 옵션 설명을 별도 문단으로 분리 | 100% |
| G-5 | Nice to Have(후속 과제) | `CourseReferencePicker`에 로딩 스피너 없음 | 설계에 명시 없음(구현 세부사항) | 텍스트 상태 문구만 존재(`TourReferencePicker`와 동일 수준) | 후속 과제(UX 개선) | 공용 로딩 스피너 컴포넌트 도입 검토(현재 프로젝트에 공용 스피너 자체가 없어 더 큰 범위의 결정 필요) | 100% |
| G-6 | Nice to Have(후속 과제) | `linkedCourseDayId`/`linkedCourseStopId`에 `@Positive` 미적용 | 설계에 명시 없음(구현 세부사항) | Bean Validation 없이 서비스 계층(`CourseLinkResolver`)의 존재 여부 검증에만 의존 | 후속 과제(검증 보강) | `@Positive` 추가해 음수·0 값을 컨트롤러 레벨에서 조기에 거부 | 100% |

**감점 없는 참고 사항**: 계획 §2.2가 명시적으로 제외한 항목("코스 전체만" 참조 상태 금지, 여행코스 스키마 변경 없음, 관리자 코스 상세 화면 신규 제작 없음, 마이그레이션/백필 없음)은 전부 설계 의도와 일치하므로 gap이 아니다.

---

## 4. Runtime Verification

### 4.1 정적 분석 + 빌드

| 카테고리 | 결과 |
|----------|:----:|
| `npm run lint` | ✅ 오류 0건(프론트 구현 1차 + 아이콘 교체 수정 후 재확인, 총 2회) |
| `npm run build` | ✅ 성공(261 modules, 이번 변경과 무관한 기존 `lanpst-child` CSS 경고·청크 크기 경고는 그대로) |
| API 계약 대조 | ✅ 5/5(§2.1) |
| 코드 리뷰 Must Fix·Should Improve 반영 확인 | ✅ 2/2 코드 근거로 재확인(§2.3, §3) |
| 수정 금지 파일 회귀 | ✅ `TourReferencePicker.jsx`/`TourCourseAdminService.java`/`TourCourseAdminController.java`/`AdminCourseFormPage.jsx`/`SecurityConfig.java`/피드 댓글·좋아요·북마크 전부 `git status` 미표시로 미변경 확인 |

### 4.2 백엔드 자동 테스트 — 실행 결과

`backend/target/surefire-reports/*.txt`를 집계한 결과(이 세션에서 직접 재실행하지 않고, 최근 테스트 실행 기록을 합산):

```
전체: Tests run 106, Failures 0, Errors 0
├ CourseLinkResolverTest: 7/7 통과 (T-1~T-5 + 미태그·존재하지 않는 stopId 방어)
└ FeedCourseLinkIntegrationTest: 7/7 통과 (T-1, T-2, 미태그, 일자 없이 경유지만 거부,
  T-6 경유지 프루닝, T-7 코스 전체 삭제, T-8/T-9 linkedCourseId 필터+메인 피드 회귀)
```

이전 세 사이클(tour-course-list-integration, feed-integration, feed-comment-integration)에서 반복됐던 JDK 버전 불일치(로컬 17 vs `pom.xml` 요구 25) 제약이 이번에는 `surefire-reports`에 이미 106/106 통과로 기록돼 있어 **이 세션에서 직접 재실행 없이도 정량적 근거를 확보**했다. 특히 `FeedCourseLinkIntegrationTest`의 T-6·T-7은 이 설계의 핵심 검증 포인트(참조 무결성, `ON DELETE SET NULL`)였고, 둘 다 실제 DB 레벨 통합 테스트(MockMvc 없이 서비스·리포지토리 직접 호출)로 통과가 확인됐다.

### 4.3 L2 UI(브라우저)/L3 E2E — 미검증

이전 네 PDCA 주기와 동일하게 이 환경에 브라우저 자동화 도구가 없어 미실행이다. 우선순위가 높은 후속 검증 항목:

| 항목 | 관련 완료 조건 |
|------|----------------|
| `CourseReferencePicker`에서 코스 검색 → 일자 선택 → 경유지 선택 → 다시 검색으로 돌아가기가 실제 브라우저에서 상태 꼬임 없이 동작하는지 | SC-1 |
| 코스 상세의 참조 피드 섹션에서 "더 보기"를 여러 번 눌렀을 때 실제 응답이 정상 누적되는지 | SC-2 |
| 위치 태그 + 코스 태그를 동시에 설정한 게시물이 실제 화면에서 두 섹션 모두 정상 표시되는지 | 계획 §2.1 |
| 코스가 삭제된 뒤(G-1 수정 확인) 피드 상세·카드에서 "코스명은 보이되 링크는 없는" 상태가 실제로 거짓 링크 없이 표시되는지 | §5.3 |
| 모바일 폭에서 `CourseReferencePicker`의 일자/경유지 트리, 코스 상세의 참조 피드 카드 그리드가 깨지지 않는지 | 계획 §3.2 반응형 |

---

## 5. 회귀 확인 (계획 §2.2 "변경하지 않는 것" 원칙 검증)

```
M  backend/.../feed/domain/FeedPost.java                         (참조 컬럼 6개 + linkCourse/hasCourseLink 추가, 기존 필드·메서드 무변경)
M  backend/.../feed/dto/FeedCreateRequest.java                   (linkedCourseDayId/StopId 추가)
M  backend/.../feed/dto/FeedPostResponse.java                    (linkedCourse 중첩 객체 추가)
M  backend/.../feed/dto/FeedAdminPostResponse.java                (linkedCourse 추가)
M  backend/.../feed/repository/FeedPostRepository.java           (linkedCourseId 커서 쿼리 2종 추가)
M  backend/.../feed/controller/FeedController.java                (linkedCourseId 선택 파라미터 추가)
M  backend/.../feed/service/FeedService.java                      (getFeed 4인자 오버로드 추가, 3인자는 위임)

A  backend/.../feed/service/CourseLinkResolver.java
A  backend/.../tourcourse/repository/TourCourseDayRepository.java
A  backend/.../tourcourse/repository/TourCourseStopRepository.java
A  backend/db/migrations/2026-10-01-tour-course-feed-linking.sql
A  backend/src/test/.../feed/FeedCourseLinkIntegrationTest.java
A  backend/src/test/.../feed/service/CourseLinkResolverTest.java

M  frontend/src/api/feedApi.js                                    (toCourseTag, linkedCourseId 파라미터, linkedCourseDayId/StopId 전송)
M  frontend/src/api/adminFeedApi.js                                (toCourseTag — 관리자용)
M  frontend/src/components/feed/FeedComposer.jsx                   (courseTag state, 여행코스 태그 섹션, CourseRouteIcon)
M  frontend/src/components/feed/FeedCard.jsx(+css)                 (코스 태그 표시, CourseRouteIcon)
M  frontend/src/hooks/useFeedInfiniteList.js                       (linkedCourseId 옵션 추가, 하위 호환)
M  frontend/src/pages/FeedDetailPage.jsx(+css)                     (코스 태그 표시+조건부 링크, CourseRouteIcon)
M  frontend/src/pages/TourCourseDetailPage.jsx(+css)               (CourseFeedSection 추가)
M  frontend/src/pages/admin/AdminFeedDetailPage.jsx(+css)          (참조한 여행코스 한 줄 표시)

A  frontend/src/components/common/CourseReferencePicker.jsx(+css)
A  frontend/src/components/icons/CourseRouteIcon.jsx
A  frontend/src/hooks/useCourseFeedPosts.js
```

`TourCourseAdminService.java`, `TourCourseAdminController.java`, `AdminCourseFormPage.jsx`, `TourReferencePicker.jsx`, `FeedPage.jsx`, `FeedUserProfilePage.jsx`, `FeedCommentController/Service/Repository`, `FeedAdminController.java`, `SecurityConfig.java`는 `git status`에 전혀 나타나지 않아 **단 한 줄도 수정되지 않았음**을 확인했다.

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
│  Important Gap: 2건(전건 완료·수정됨)          │
│  Nice to Have: 4건(후속 과제)                 │
└─────────────────────────────────────────────┘
```

Match Rate가 계획 §4.2 목표(90% 이상)를 크게 상회한다. Critical gap이 없고, Important 2건(`hasCourseLink()` 게이트 조건, 코스/위치 태그 아이콘 미구분)은 코드 리뷰를 거쳐 전건 수정 완료됐다. 남은 Nice to Have 4건은 전부 기능에 영향이 없는 개선 여지다.

---

## 7. 권장 조치

### 7.1 코드 수정

없음. Important 2건 모두 이미 수정 완료됐다(§2.3, §3).

### 7.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-1: 설계 §3.1·§5.3의 `hasCourseLink()` 코드 예시를 `linkedCourseTitle` 게이트 방식으로 갱신해 두 절의 모순을 해소
- G-2: 설계 §6.2~§6.4의 아이콘 언급(있다면)을 `CourseRouteIcon` 기준으로 갱신

### 7.3 후속 과제 (다음 세션 또는 다음 PDCA)

- G-3: `FeedCreateRequest.imageUrls` 미사용 필드 — 제거할지 실제 구현할지 결정
- G-4: `useFeedInfiniteList.js` JSDoc 가독성 개선
- G-5: `CourseReferencePicker`(및 `TourReferencePicker`)에 공용 로딩 스피너 도입 검토
- G-6: `linkedCourseDayId`/`linkedCourseStopId`에 `@Positive` validation 추가
- 브라우저 자동화 환경에서 §4.3 L2 체크리스트 실행

---

## 8. Next Steps

- [x] Critical gap 없음 확인
- [x] Important gap 2건(G-1~G-2) 전건 수정 확인
- [x] 코드 리뷰 Must Fix 1건·Should Improve 1건 반영 확인
- [ ] Completion Report 작성(`tour-course-feed-linking.report.md`)
- [ ] 후속: Nice to Have 4건(G-3~G-6) 처리 여부 결정
- [ ] 후속: 브라우저 자동화 환경에서 L2 체크리스트 실행

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-10-01 | 최초 gap 분석. Match Rate 99.2%, Critical 0건, Important 2건(전건 완료). 코드 리뷰 Must Fix 1건(`hasCourseLink()` FK 게이트 조건 → 스냅샷 컬럼 게이트로 수정)과 Should Improve 1건(코스/위치 태그 아이콘 미구분 → `CourseRouteIcon` 신규)을 완료로, Nice to Have 4건(미사용 `imageUrls` 필드, 주석 가독성, 로딩 스피너, `@Positive` validation)을 후속 과제로 분류. 백엔드 신규 테스트 14건은 `surefire-reports` 집계(전체 스위트 106/106 통과)로 확인 | frontend-lead (Claude Code 보조) |
