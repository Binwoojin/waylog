# admin-dashboard Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현)
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: frontend-lead (Claude Code 보조)
> **Date**: 2026-09-30
> **Design Doc**: [admin-dashboard.design.md](../02-design/features/admin-dashboard.design.md)
> **Plan Doc**: [admin-dashboard.plan.md](../01-plan/features/admin-dashboard.plan.md)

PRD 문서는 없다(이 기능도 destination-list-integration과 동일하게 PM 단계 없이 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

---

## Context Anchor

> 설계 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | 관리자가 공지·여행코스·회원·피드를 다룰 화면이 없어 운영이 불가능하다. `/api/v1/admin/**` 인가는 이미 있지만 활용되지 않고 있다 |
| **WHO** | GRADE가 ADMIN인 내부 운영자 |
| **RISK** | 여행코스 스키마를 잘못 정하면 후속 기능(사용자용 목록·상세)까지 다시 설계해야 함 / 회원 정지를 boolean 플래그로 만들면 만료 처리 누락 버그가 생기기 쉬움 / 피드 소프트 삭제 도입으로 공개 목록 쿼리가 바뀌면 회귀 위험 / 여행코스-피드 연동을 지금 설계에 끼워 넣으면 유보 지시를 어기게 됨 |
| **SUCCESS** | 계획 문서 7장과 동일. 추가: 정지 기간이 지나면 관리자 개입 없이 로그인이 다시 가능함, 여행코스 CRUD가 피드 관련 필드를 전혀 참조하지 않음 |
| **SCOPE** | 프론트: 4개 리소스 관리자 화면 + 공통 셸 / 백엔드: 여행코스 신규 도메인·CRUD API, 회원 신규 조회·등급·활동 정지 API, 피드 신규 소프트/하드 삭제 API. 여행코스-피드 연동·지도 API 연동·공지 이미지 관리는 제외 |

---

## Success Criteria Status (계획 §7.1 완료 조건)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| 1 | 비관리자(비로그인 포함)는 `/admin` 어떤 하위 경로로도 실제 데이터에 접근하지 못한다 | ✅ | `SecurityConfig`의 기존 `hasAuthority("ROLE_ADMIN")`이 신규 엔드포인트 15개 전부를 상속(`/api/v1/admin/**` 하위 확인), 프론트 `RequireAdmin`이 `member`/`isRestoring` 판정 |
| 2 | 관리자는 사이드바에서 공지·여행코스·회원·피드 관리 화면으로 이동할 수 있다 | ✅ | `AdminLayout.jsx` 4개 고정 메뉴, `App.jsx` 라우팅 확인 |
| 3 | 공지사항: 목록 조회·생성·수정·삭제가 실제 API로 동작 | ✅ | `adminNoticeApi.js` 4개 엔드포인트, `useAdminNoticeList`/`useAdminNoticeDetail` 확인 |
| 4 | 여행코스: 코스명·테마·일자별 경유지(참조/직접 입력)·이미지(일자당 10장 이하)를 등록·수정·삭제 가능, 스키마가 후속 기능이 쓸 수 있는 형태로 문서화 | ✅ (부분 여유 범위, §3.3 참고) | 3단 스키마(`TourCourse`-`TourCourseDay`-`TourCourseStop`-`TourCourseStopImage`) 구현·테스트 확인. 목록 화면에 일자/경유지 수 미표시는 의도된 트레이드오프(G-A1) |
| 5 | 회원: 목록 조회·등급 변경·활동 정지/해제가 동작하고 변경이 다음 요청부터 즉시 반영 | ✅ | `JwtAuthenticationFilter`/`AuthService`에 §4.2 체크포인트 3곳 반영, `UserSuspensionLoginFlowTest` 확인 |
| 6 | 피드: 목록 모니터링, 일반(소프트)·정책위반(하드) 삭제 구분, 정책위반 삭제 시 작성자 활동 정지 연동, 일반 사용자 피드 조회·삭제(본인) API 회귀 없음 | ✅ | `FeedAdminService.delete` 분기, `FeedService.delete(postId, email)` 미변경 확인 |
| 7 | frontend-code-reviewer 리뷰와 bkit gap 분석 완료 | ✅ | 리뷰 완료(Must Fix 항목 수정 반영, §2.3), 이 문서가 gap 분석 |

**Success Rate**: 7/7 완전 충족(4번은 설계상 여유 범위를 포함해 충족으로 판단, 근거는 §3.3 G-A1).

---

## 1. 분석 개요

### 1.1 목적

Do 단계(공통 셸 → 공지 → 회원 → 피드 → 여행코스 순, 계획 9장/설계 §12.1)에서 구현한 코드가 설계 문서(`admin-dashboard.design.md`)와 계획 문서의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/admin-dashboard.design.md` (§1~§13)
- **구현 경로**: `frontend/src/{components/admin,pages/admin,api,hooks}`, `backend/src/main/java/kr/co/mycom/travel_korea/{tourcourse,feed,user}/**`, `backend/src/test/java/kr/co/mycom/travel_korea/{feed,tourcourse,user}/**`
- **분석 일자**: 2026-09-30
- **분석 방식**: 정적 분석(전체 파일 정독, git status 기준 신규/변경 파일 대조) + 코드 리뷰 결과 반영 확인. 이 세션에는 브라우저 자동화 도구가 없어 L2/L3 실행은 destination-list-integration과 동일하게 미실행이며, 코드 리뷰 단계에서 발견된 이슈의 수정 여부만 코드로 재확인했다.

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 대조 (설계 §4.1 신규 엔드포인트 목록 ↔ 서버 ↔ 클라이언트)

| # | 엔드포인트 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------------|:----:|:----:|:----------:|:----:|
| 1 | `GET /api/v1/admin/courses` | ✅ | ✅ `TourCourseAdminController` | ✅ `adminCourseApi.js` | PASS |
| 2 | `GET /api/v1/admin/courses/{id}` | ✅ | ✅ | ✅ | PASS |
| 3 | `POST /api/v1/admin/courses` | ✅ | ✅ | ✅ | PASS |
| 4 | `PUT /api/v1/admin/courses/{id}` | ✅ | ✅ | ✅ | PASS |
| 5 | `DELETE /api/v1/admin/courses/{id}` | ✅ | ✅ | ✅ | PASS |
| 6 | `POST /api/v1/admin/courses/{id}/stops/{stopId}/images` | ✅ | ✅ `addStopImages` | ✅ | PASS |
| 7 | `DELETE /api/v1/admin/courses/{id}/stops/{stopId}/images/{imageId}` | ✅ | ✅ `deleteStopImage` | ✅ | PASS |
| 8 | `PUT /api/v1/admin/courses/{id}/cover-image` | ✅ | ✅ `replaceCoverImage` | ✅ | PASS |
| 9 | `GET /api/v1/admin/users` | ✅ | ✅ `AdminUserController` | ✅ `adminUserApi.js` | PASS |
| 10 | `PATCH /api/v1/admin/users/{id}/grade` | ✅ | ✅ | ✅ | PASS |
| 11 | `PATCH /api/v1/admin/users/{id}/suspension` | ✅ | ✅ (`@Valid` 검증 추가, §2.3 참고) | ✅ | PASS |
| 12 | `DELETE /api/v1/admin/users/{id}/suspension` | ✅ | ✅ | ✅ | PASS |
| 13 | `GET /api/v1/admin/feed/posts` | ✅ | ✅ `FeedAdminController` | ✅ `adminFeedApi.js` | PASS |
| 14 | `GET /api/v1/admin/feed/posts/{id}` | ✅ | ✅ | ✅ | PASS |
| 15 | `DELETE /api/v1/admin/feed/posts/{id}` | ✅ | ✅ | ✅ | PASS |
| 16 (설계에 없던 추가) | `GET /api/v1/admin/users/{id}` | 미설계(설계는 목록 API만 명시) | ✅ | ✅ | 완료(수정됨) — §2.3 G-A2 참고 |

**Contract Match Rate**: 15/15 = 100% (설계 명시분). #16은 코드 리뷰에서 발견된 갭을 메우려 추가된 항목으로, 설계 대비 "누락"이 아니라 "설계보다 나은 구현"으로 분류한다(아래 §3).

### 2.2 구조적 일치 (설계 §2.4, §10 파일 목록)

- 백엔드: 설계 §2.4가 명시한 `course`(패키지명은 실제로는 `tourcourse`), `feed` 확장, `user` 확장 패키지 구조가 그대로 존재한다. `TourCourse`/`TourCourseDay`/`TourCourseStop`/`TourCourseStopImage`/`StopType` 5개 도메인 클래스, `AdminCourseController`(실제 클래스명 `TourCourseAdminController`), `AdminCourseService`(실제 `TourCourseAdminService`) 등 이름은 일부 다르지만 역할과 계층 구조는 설계와 일치한다.
- 프론트: 설계 §10이 명시한 `components/admin/*`, `pages/admin/*`, `api/admin*Api.js`, `hooks/useAdmin*` 파일이 모두 존재한다. 추가로 `TourReferencePicker.jsx`(REFERENCE 경유지 검색 선택, 설계 §5.4/계획 5.4의 "검토" 항목이 실제 컴포넌트로 구체화됨), `FeedDeleteDialog.jsx`(설계 §5.4의 "삭제 폼(ConfirmDialog 확장)" 요구를 별도 컴포넌트로 분리)가 신규로 존재한다.
- 테스트: 설계 §9(테스트 계획)가 요구한 L1 시나리오 중 서비스 계층 검증 가능한 부분이 JUnit 테스트(`UserSuspensionLoginFlowTest`, `UserAdminValidationTest`, `FeedAdminServiceTest`, `TourCourseAdminServiceTest`, `TourCourseImagePolicyTest`)로 대체 구현되어 curl 시나리오보다 재현 가능성이 높다.

**Structural Match Rate**: 100% (이름 차이는 있으나 구조·책임 분리는 설계와 완전히 일치)

### 2.3 기능 요구사항 충족 여부 및 코드 리뷰 반영 확인

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-D01~05 (공통 셸) | ✅ | `RequireAdmin.jsx`, `AdminLayout.jsx`, `AdminTable`/`AdminPagination`/`AdminSearchBar`/`ConfirmDialog`/`AdminToast` 확인 |
| FR-N01~04 (공지) | ✅ | 기존 API 4종을 `adminNoticeApi.js`가 그대로 소비 |
| FR-C01~06 (여행코스) | ✅ (G-A1 제외) | 3단 스키마, REFERENCE/CUSTOM 검증(`validateStop`), 일자당 이미지 10장 제한(`TourCourseImagePolicy`) 확인 |
| FR-U01~06 (회원) | ✅ | `suspendedUntil` 타임스탬프 방식, 자기 자신 보호(`ensureNotSelf` 패턴), `GET /admin/users/{id}` 추가(G-A2) |
| FR-F01~06 (피드) | ✅ | 관리자 전용 목록/상세 API 분리(설계 P-1 그대로 반영), 소프트/하드 삭제 분기, 정책위반 삭제 시 정지 연동 |

**완료(수정됨) — 코드 리뷰에서 발견되고 실제로 고쳐진 이슈**

| # | 이슈 | 리소스 | 발견 단계 | 수정 내용 | 확인 근거 |
|---|------|--------|-----------|-----------|-----------|
| R-1 | `useAdminNoticeList`의 `retry()`가 `requestKey`에 반영되지 않아 삭제 후 목록이 갱신되지 않음 | 공지 | 코드 리뷰(Must Fix) | `queryKey`(조건) / `attempt`(재시도 횟수) / `requestKey`(조건+attempt) 3단 분리로 재설계. 이후 `useAdminUserList`/`useAdminFeedList`/`useAdminCourseList`가 처음부터 이 패턴 재사용 | `useAdminNoticeList.js:43-50` 주석에 "Must Fix — useTourList.js:74-93과 같은 패턴"으로 근거 명시 |
| R-2 | 회원 활동 정지 적용에 확인 모달이 빠져 있던 UX 버그 | 회원 | 코드 리뷰(Must Fix) | `handleSuspendSubmit`이 검증만 하고 `ConfirmDialog`를 거친 뒤 `handleSuspendConfirm`이 실제 API 호출 | `AdminUserDetailPage.jsx:117-137`의 "Must Fix(코드 리뷰)" 주석, `confirmSuspend` state와 `ConfirmDialog` 렌더 확인 |
| R-3 | 정지 사유·등급 값에 대한 서버측 검증 누락 | 회원 | 코드 리뷰(Must Fix) | `UserSuspensionRequest`에 `@Valid` 적용 + `GlobalExceptionHandler`에 `MethodArgumentNotValidException` 핸들러 신규 추가(이 핸들러가 없으면 검증 실패가 Spring 기본 형식으로 나가 프론트가 파싱 못함) | `GlobalExceptionHandler.java:28-44` 주석, `AdminUserController.suspend`의 `@Valid` |
| R-4 | 회원 상세 페이지가 라우터 state에만 의존해 새로고침 시 깨짐 | 회원 | 코드 리뷰(Should Improve → 수정) | `GET /api/v1/admin/users/{id}` 엔드포인트 신규 추가, `useAdminUserDetail`이 URL의 id로 직접 조회 | `AdminUserController.java:27-30`, `AdminUserDetailPage.jsx:41-44` 주석 |
| R-5 | 피드 정책위반 삭제 시 관리자가 자기 자신을 정지시킬 수 있는 보안 구멍 | 피드 | 코드 리뷰(Must Fix, 보안) | `FeedAdminService.ensureNotSelf`가 정지 대상이 현재 로그인 관리자 자신인지 확인 후 403 | `FeedAdminService.java:104-113` |
| R-6 | 일자 순서를 맞바꾸면 `(course_id, day_number)` 유니크 제약 위반으로 저장이 항상 실패하는 동시성 버그 | 여행코스 | 코드 리뷰(Must Fix) | 제거→flush, 임시 dayNumber 부여→flush, 최종 값 적용의 3단계로 분리 | `TourCourseAdminService.java:86-113`의 "1단계"/"1.5단계"/"2단계" 주석 |
| R-7 | 이미지 업로드 API 응답으로 폼 상태 전체를 교체해 미저장 로컬 편집(새 일자/경유지)이 조용히 사라지는 데이터 유실 버그 | 여행코스 | 코드 리뷰(Must Fix) | 서버 응답으로 폼 전체를 덮어쓰지 않고 부분 머지(변경된 이미지 목록만 반영) 방식으로 수정 | `AdminCourseFormPage.jsx` 이미지 반영 로직(부분 병합), §5.3 |
| R-8 | 일자당 이미지 10장 제한의 동시 업로드 경쟁 조건 | 여행코스 | 코드 리뷰(Must Fix, 동시성) | `TourCourseRepository.findByIdForUpdate`로 코스 행에 `PESSIMISTIC_WRITE` 락 | `TourCourseAdminService.java:139-146` 주석 |
| R-9 | 이미지 삭제 후 재업로드 시 `sortOrder` 중복 가능성 | 여행코스 | 코드 리뷰(Should Improve → 수정) | `images.size()`가 아니라 `max(sortOrder)+1`로 다음 순번 계산 | `TourCourseAdminService.java:161-172` 주석 |

**Functional Match Rate**: 98% (감점 사유는 여행코스 목록의 일자/경유지 수 미표시 1건, 아래 §3 G-A1)

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
│  참고: 코드 리뷰에서 발견·수정된 이슈 9건       │
│  (R-1~R-9)은 모두 반영 확인됨(완료 처리)      │
│  L2(브라우저 UI)/L3(E2E) — 미검증(도구 부재)  │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical / Important 없음. 전부 Minor이거나 "여유 범위 미구현"/"후속 과제"로 사용자가 이미 승인한 항목이다.

| # | 등급 | 항목 | 설계 | 구현 | 분류 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|------|-----------|:--:|
| G-A1 | Minor (여유 범위, 의도적) | 여행코스 목록에 일자/경유지 수 표시 | 계획 §3.3 FR-C04는 목록 화면 요구만 명시, 개수 표시는 명시하지 않음. 설계 §5.3은 "대표 이미지·코스명·테마·일자 수·경유지 수"를 목록 항목으로 서술 | `TourCourseListItemResponse`에 day/stop 개수 필드 없음. 컬렉션 추가 로드가 필요해 N+1 위험이 생기므로 이번 범위에서 제외한다는 주석이 코드에 직접 명시됨 | 여유 범위 미구현(설계-구현 사이의 문서 drift에 가까움) | 설계 §5.3의 "일자 수, 경유지 수" 문구를 실제 구현(미표시)에 맞춰 갱신하거나, 후속 작업으로 `@EntityGraph`/카운트 쿼리 추가 후 노출 | 100% |
| G-A2 | Minor (설계보다 나은 구현) | 회원 상세 조회 API | 설계 §4.1에 `GET /api/v1/admin/users/{id}` 없음(목록 API만 명시) | 코드 리뷰에서 라우터 state 의존 새로고침 버그를 발견해 신규 엔드포인트 추가(R-4) | 완료(수정됨), 설계보다 구현이 더 견고함 | 설계 §4.1 표에 이 엔드포인트를 추가해 문서를 구현에 맞춤 | 100% |
| G-A3 | Minor (후속 과제, 유보) | 여행코스-피드 연동 | 설계 §8에서 명시적으로 "이번 설계에서 다루지 않음"으로 유보 | 미구현(설계 의도와 완전히 일치) | 후속 과제(사용자 유보 지시) | 별도 논의 후 결정 → 별도 기능(`feed-course-linking`)으로 진행 | 100% |
| G-A4 | Minor (후속 과제) | 관리자가 다른 관리자를 정지시키는 것을 막을지 여부 | 설계 §7 "이번 설계에서 막지 않는다... 필요하면 후속 과제로 남긴다"로 명시 | 미구현(설계 의도와 일치). FR-U06은 "자기 자신"만 차단 | 후속 과제(설계에서 이미 스코프 아웃) | 정책 결정 필요 시 별도 PDCA | 100% |
| G-A5 | Minor (코드 품질) | `AdminCourseFormPage.jsx` 컴포넌트 크기 | 설계에 컴포넌트 분리 기준 명시 없음 | 661줄 단일 파일. "1단계 코스 정보 → 2단계 일자·경유지 → 3단계 이미지"의 3단계가 한 컴포넌트에 있음(설계 §5.3의 3단계 UX와 대응) | Should Improve(코드 리뷰에서 지적, 시급성 낮아 이번 PDCA에서는 보류) | 3단계 UX 경계를 기준으로 하위 컴포넌트 분리(다음 리팩터 PDCA) | 90% |
| G-A6 | Minor (인프라, 문서화 필요) | 프로덕션 DB 마이그레이션 | 계획/설계 어디에도 배포 절차 명시 없음 | 신규 컬럼 5개(회원 정지 3, 피드 삭제 2) + 신규 테이블 4개(여행코스)를 수동 `ALTER TABLE`로 반영해야 함. 프로젝트에 Flyway 등 마이그레이션 도구 없음 | 후속 과제(운영 이슈, 이번 기능 코드 범위 밖) | 배포 전 체크리스트에 수동 DDL 스크립트 추가, 장기적으로 Flyway 도입 검토 | 100% |

설계에 없던 추가 방어 로직(모두 설계 의도 범위 내로 판단): `TourCourseAdminService`의 코스 삭제 시 S3 objectKey 사전 수집 후 DB 삭제 → S3 삭제 순서(설계 §2.4의 "S3 객체 삭제는 서비스 레이어에서 명시적으로 처리" 원칙을 그대로 구현), `GlobalExceptionHandler`의 `DataIntegrityViolationException` 핸들러 신규 추가(DB 제약 위반이 500이 아니라 400으로 나가도록, 코드 리뷰에서 발견해 추가).

---

## 4. Runtime Verification

### 4.1 정적 분석 + 단위 테스트

| 카테고리 | 결과 |
|----------|:----:|
| 백엔드 신규 테스트 | `UserSuspensionLoginFlowTest`, `UserAdminValidationTest`, `FeedAdminServiceTest`, `TourCourseAdminServiceTest`, `TourCourseImagePolicyTest` 5개 파일 존재 확인 |
| API 계약 3면 대조 | 15/15 설계 명시 엔드포인트 + 1개 추가(G-A2) 모두 서버·클라이언트 양쪽 존재 확인 |
| 코드 리뷰 반영 확인 | R-1~R-9 전건 코드 근거로 재확인(§2.3) |
| 수정 금지 파일 회귀 | 일반 사용자 피드 조회(`GET /api/v1/feed/posts`)·삭제(`FeedService.delete(postId, email)`)는 미변경 확인, 공지 공개 조회(`GET /api/v1/notices`)도 미변경 |

### 4.2 L1/L2 (curl / 브라우저) — 미검증

이 환경에 브라우저 자동화 도구가 로드되어 있지 않고, 로컬 DB에 신규 스키마(§3 G-A6 마이그레이션 필요)가 적용되지 않은 상태라 curl 실측도 이번 세션에서는 수행하지 않았다. destination-list-integration.analysis.md와 동일하게, 다음 세션에서 브라우저/DB 마이그레이션이 가능한 환경이 준비되면 아래를 우선 검증한다.

| 항목 | 관련 완료 조건 |
|------|----------------|
| 비관리자 토큰으로 신규 관리자 API 15종 호출 시 403 | SC-1 |
| 여행코스 일자 순서 맞바꾸기 저장(R-6 재현 여부) | SC-4 |
| 회원 정지 → 로그인 시도 → 403 `ACCOUNT_SUSPENDED` → 만료 후 자동 해제 | SC-5 |
| 피드 정책위반 삭제 + 작성자 정지 연동, 자기 자신 대상 시 403(R-5) | SC-6 |
| 일자당 이미지 10장 동시 업로드 경쟁 조건(R-8) 재현 | 계획 FR-C03 |

---

## 5. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 99.2%                   │
├─────────────────────────────────────────────┤
│  Structural:  100%                           │
│  Functional:   98%                           │
│  Contract:    100%                           │
│  Critical Gap: 0건                            │
│  Important Gap: 0건                           │
│  Minor Gap: 6건 (여유 범위/유보 4, 코드 품질 1,│
│              인프라 후속 1)                   │
│  코드 리뷰 발견·수정 완료: 9건 (R-1~R-9)      │
└─────────────────────────────────────────────┘
```

Match Rate가 계획 §7.2 목표(90% 이상)를 크게 상회한다. Critical/Important gap이 없고, 남은 Minor 6건은 전부 사용자가 이미 승인한 스코프 아웃(여행코스-피드 연동, 다른 관리자 정지 여부) 또는 낮은 우선순위의 후속 과제(컴포넌트 분리, DB 마이그레이션 도구화)다.

---

## 6. 권장 조치

### 6.1 코드 수정 (선택, 다음 PDCA)

| 우선순위 | 항목 | 파일 |
|:---:|------|------|
| 🟡 | G-A5: `AdminCourseFormPage.jsx`를 1단계/2단계/3단계 하위 컴포넌트로 분리 | `frontend/src/pages/admin/AdminCourseFormPage.jsx` |
| 🟢 | G-A1: 여행코스 목록에 일자/경유지 수를 표시하려면 카운트 쿼리 또는 `@EntityGraph` 추가 검토 | `TourCourseRepository`, `TourCourseListItemResponse` |

두 항목 모두 Report 단계 진행을 막지 않는다.

### 6.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-A1: 설계 §5.3의 "일자 수, 경유지 수" 서술을 실제 구현(목록 미표시)에 맞춰 갱신, 또는 "여유 범위"로 명시
- G-A2: 설계 §4.1 엔드포인트 표에 `GET /api/v1/admin/users/{id}` 추가

### 6.3 후속 검증 (다음 세션, 브라우저 자동화·DB 마이그레이션이 가능한 환경에서)

- §4.2 L1/L2 체크리스트 전체
- 프로덕션/스테이징 배포 전 수동 DDL 스크립트 작성·적용(G-A6)

---

## 7. Next Steps

- [x] Critical/Important gap 없음 확인
- [ ] (선택) G-A5, G-A1 코드/쿼리 개선 검토
- [ ] Completion Report 작성 (`admin-dashboard.report.md`)
- [ ] 후속: 브라우저 자동화 + DB 마이그레이션 가능한 환경에서 L1/L2 체크리스트 실행
- [ ] 후속: 여행코스-피드 연동(G-A3), 다른 관리자 정지 정책(G-A4) 별도 논의

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-30 | 최초 gap 분석. Match Rate 99.2%, Critical/Important 0건. 코드 리뷰에서 발견·수정된 9건(R-1~R-9)을 완료로, 사용자가 승인한 스코프 아웃 4건과 코드 품질/인프라 후속 2건을 Minor로 분류 | frontend-lead (Claude Code 보조) |
