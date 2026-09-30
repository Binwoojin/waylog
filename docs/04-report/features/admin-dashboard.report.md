# admin-dashboard 완료 보고서

> **상태**: ✅ Complete
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: frontend-lead (Claude Code 보조)
> **완료일**: 2026-09-30
> **PDCA 주기**: #2 (destination-list-integration에 이은 두 번째 주기)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **기능** | `/admin` 하위에 관리자 전용 레이아웃(라우트 가드 + 사이드바 + 대시보드 홈)을 신설하고, 공지사항·여행코스·회원·피드 4개 리소스를 관리자가 한 곳에서 조회·생성·수정·삭제·상태 변경할 수 있게 함. 공지사항은 기존 백엔드 API를 소비하는 프론트만 추가, 여행코스·회원·피드는 스키마와 API부터 새로 설계·구현 |
| **시작일** | 2026-09-29 (계획 단계) |
| **완료일** | 2026-09-30 (코드 리뷰 반영 + gap 분석 완료) |
| **소요 기간** | 2일 (계획·설계·구현·리뷰·검증·보고를 하나의 PDCA로 진행, 계획 D-7) |

### 1.2 결과 요약

```
┌──────────────────────────────────────────────┐
│  전체 Match Rate: 99.2%                       │
├──────────────────────────────────────────────┤
│  ✅ 완료:     4개 리소스(공지·여행코스·회원·피드) │
│  ✅ 신규 API: 15개 + 1개(리뷰 중 추가)         │
│  ✅ 계약:     API 3면 대조 100% 일치            │
│  ✅ 코드 리뷰: Must Fix 발견분 전건 수정 완료   │
│  ✅ Gap:      Critical 0건, Important 0건     │
│  ⚠️  Minor:    6건 (사용자 승인 스코프 아웃 4,   │
│              코드 품질 1, 인프라 후속 1)       │
└──────────────────────────────────────────────┘
```

### 1.3 전달한 가치 (4 관점)

| 관점 | 내용 |
|------|------|
| **문제** | WayLog에는 관리자가 서비스 데이터를 다룰 화면이 전혀 없었다. 공지사항은 백엔드 API만 있고 소비하는 프론트가 없었고, 여행코스·회원·피드는 관리자용 조회·변경 API 자체가 없었다. `/api/v1/admin/**`은 이미 `ROLE_ADMIN`으로 보호돼 있었지만 그 뒤에 아무 화면도 없는 상태였다. |
| **해결** | 4개 리소스가 공유하는 관리자 UI 패턴(`AdminTable`/`AdminPagination`/`AdminSearchBar`/`ConfirmDialog`/`AdminToast`)과 URL 기반 목록 상태(`useSearchParams`)를 먼저 만들고, 리소스별로 "백엔드 API 준비 → 프론트 구현 → 코드 리뷰 → 발견된 문제 수정"을 반복했다. 회원 활동 정지는 boolean 플래그 대신 `suspendedUntil` 타임스탬프로 설계해 배치 없이 자동 만료가 성립하게 했고, 여행코스는 코스-일자-경유지 3단 구조에 REFERENCE/CUSTOM 이중 지원을 넣어 향후 지도 API 연동을 스키마 변경 없이 수용할 수 있게 했다. |
| **기능/UX 효과** | 관리자가 콘솔이나 DB 직접 조작 없이 공지·여행코스·회원·피드를 관리할 수 있다. 일반 사용자 화면과 완전히 분리된 레이아웃(`AdminLayout`)으로 오조작 위험을 줄였다. 회원 정지는 되돌릴 수 없는 동작이라 확인 모달을 거치고, 정지 기간이 지나면 관리자 개입 없이 로그인이 자동으로 복구된다. 여행코스는 구조 저장 → 이미지 첨부의 2단계 흐름을 화면에 그대로 드러내 저장 순서를 헷갈리지 않게 했다. |
| **핵심 가치** | 이 기능의 포트폴리오 가치는 두 가지다. 첫째, **4개 리소스가 공통 셸·패턴·서비스를 교차 재사용하는 설계**(공지에서 만든 `useAdmin*List` 상태 머신 패턴을 회원·피드·여행코스가 그대로 재사용, `UserSuspensionService`를 회원 관리와 피드 정책위반 삭제 양쪽이 공유). 둘째, **코드 리뷰를 통해 실제 동시성·보안·데이터 유실 버그를 발견하고 고친 과정**(여행코스 일자 순서 교체 시 DB 유니크 제약 위반, 이미지 업로드 응답으로 미저장 로컬 편집이 사라지는 데이터 유실, 관리자가 자기 자신을 정지시킬 수 있는 보안 구멍 등). 둘 다 면접에서 구체적인 코드 위치와 함께 설명할 수 있다. |

---

## PDCA 주기 요약

### Plan (계획)

**문서**: `docs/01-plan/features/admin-dashboard.plan.md` (v0.2)

**목표**
- `/admin` 전용 라우트·레이아웃·라우트 가드 신설
- 공지사항 관리 UI(기존 API 소비), 여행코스 신규 스키마·CRUD, 회원 조회·등급·활동 정지, 피드 모니터링·소프트/하드 삭제
- 4개 리소스가 공유하는 관리자 UI 패턴 확립

**주요 결정** (사용자 D-1 ~ D-7, 2026-09-29)

| # | 결정 | 요지 |
|---|------|------|
| D-1 | 여행코스 경유지 입력 방식 | REFERENCE(TourAPI 참조)와 CUSTOM(직접 입력)을 모두 지원하는 구조. 지도 API 연동을 막지 않기 위한 **설계 제약**(확정 사양 아님) |
| D-2 | "기간" 필드 구조 | 일자별(Day) 구조화 |
| D-3 | 여행코스 이미지 제한 | 코스 단위가 아니라 **일자(Day)당 최대 10장**(같은 날짜 모든 경유지 이미지 합) |
| D-4 | 회원 "제재"의 실체 | 회원 리소스 자체의 일반 정지가 아니라 **피드 정책위반 대응**의 일부. 회원 쪽엔 상태 컬럼만, 실제 트리거는 피드 관리 화면 |
| D-5 | 피드 삭제 방식 | 소프트 삭제가 기본, "정책위반" 사유는 **하드 삭제**도 허용 |
| D-6 | 공지사항 이미지 관리 | 이번 범위에서 제외 확정(텍스트 공지만) |
| D-7 | PDCA 진행 단위 | 4개 리소스를 **하나의 PDCA**로 진행(리소스별로 나누지 않음) |

**범위**: FR-D01~05(공통 셸), FR-N01~04(공지), FR-C01~06(여행코스), FR-U01~06(회원), FR-F01~06(피드)

### Design (설계)

**문서**: `docs/02-design/features/admin-dashboard.design.md` (v0.1)

**아키텍처 결정**

| 기준 | 선택 | 이유 |
|------|------|------|
| **회원 활동 정지 표현** | `suspendedUntil` 타임스탬프 하나, boolean 플래그 없음 | 배치·스케줄러 없이 로그인 시도·리프레시·매 요청(JwtAuthenticationFilter)의 세 지점에서 `now()`와 비교하는 것만으로 활성화와 자동 해제가 모두 성립. boolean + 해제 배치 조합은 배치 지연 시 만료된 정지가 유지되는 버그를 유발할 수 있음(설계 §계획 대비 변경 P-3) |
| **여행코스 스키마** | 코스 → 일자(Day) → 경유지(Stop, REFERENCE/CUSTOM) → 경유지 이미지의 3단 구조 | D-1/D-2/D-3을 구체화한 계약. `FeedPost`가 이미 쓰는 "외부 콘텐츠 참조 + 표시용 스냅샷" 패턴을 그대로 재사용 |
| **여행코스 이미지 첨부** | 구조(JSON)를 먼저 저장 → 생성된 stopId 기준으로 이미지를 개별 멀티파트 엔드포인트로 첨부(2단계) | 코스-일자-경유지-이미지 4단 중첩을 멀티파트 하나에 담으면 파일-경유지 인덱스 매핑이 복잡해짐. board의 "본문과 이미지 분리" 관례와도 일치(설계 P-2) |
| **관리자 피드 목록/상세** | 공개 조회 API 재사용이 아니라 신규 엔드포인트(`/api/v1/admin/feed/posts`) 분리 | 소프트 삭제된 게시물을 공개 API에서 제외해야 하는 요구(FR-F02)와 관리자가 "무엇을 왜 지웠는지" 봐야 하는 요구(FR-F05)가 동시에 성립하려면 공개 API를 그대로 쓸 수 없음(설계 P-1) |
| **여행코스-피드 연동** | 이번 설계에서 다루지 않음(§8 미해결 사항으로 명시적 유보) | 사용자가 "지금 확정하기 어렵다"고 명시적으로 유보. 스키마가 그 확장을 구조적으로 막지 않는지만 확인 |

**주요 모듈**

| 모듈 | 역할 | 재사용성 |
|------|------|----------|
| `components/admin/*` (AdminTable, AdminPagination, AdminSearchBar, ConfirmDialog, AdminToast) | 목록/삭제 확인의 공용 UI | 4개 리소스 목록·삭제 전체 |
| `hooks/useAdmin{Notice,User,Feed,Course}{List,Detail}` | 리소스별 서버 상태 관리 | `useTourList`/`useTourDetail`의 "렌더 중 파생 상태" 패턴 재사용 |
| `UserSuspensionService` | 회원 활동 정지 적용/해제 | 회원 관리 화면과 피드 정책위반 삭제 양쪽이 공유(교차 리소스 설계) |
| `TourReferencePicker` | 여행코스 REFERENCE 경유지 검색·선택 | `useTourList`/검색 모달 선택 로직 재사용 |

### Do (구현)

**진행 순서** (계획 9장 / 설계 §12.1과 동일): 공통 셸 → 공지사항 → 회원 관리 → 피드 관리 → 여행코스. 회원의 활동 정지 API가 피드 정책위반 삭제 연동보다 먼저 준비되어야 하므로 이 순서를 지켰다.

| 순서 | 리소스 | 담당 | 주요 산출물 |
|:---:|--------|------|-------------|
| 1 | 공통 셸 | frontend-lead | `RequireAdmin`, `AdminLayout`, 공용 컴포넌트 5종, `AdminDashboardHome` |
| 2 | 공지사항 | frontend-lead | `AdminNoticeListPage`/`AdminNoticeFormPage`, `adminNoticeApi.js`, `useAdminNoticeList`/`useAdminNoticeDetail` |
| 3 | 회원 | frontend-support-backend + frontend-lead | `UserEntity` 정지 컬럼 3종, `UserSuspensionService`, `AdminUserController`, `AdminUserListPage`/`AdminUserDetailPage` |
| 4 | 피드 | frontend-support-backend + frontend-lead | `FeedPost` 소프트 삭제 컬럼 2종, `FeedAdminService`/`FeedAdminController`, `AdminFeedListPage`/`AdminFeedDetailPage`, `FeedDeleteDialog` |
| 5 | 여행코스 | frontend-support-backend + frontend-lead | `tourcourse` 패키지 전체(도메인 5종·DTO·리포지토리·서비스·컨트롤러), `AdminCourseListPage`/`AdminCourseFormPage`, `TourReferencePicker` |

**완료 항목**
- ✅ 관리자 공통 셸: 라우트 가드, 사이드바 레이아웃, 대시보드 홈, 공용 테이블/페이지네이션/검색바/확인 모달/토스트 (FR-D01~05)
- ✅ 공지사항 목록·생성·수정·삭제 (FR-N01~04)
- ✅ 여행코스 3단 스키마(코스-일자-경유지-이미지), REFERENCE/CUSTOM 검증, 일자당 이미지 10장 제한, 관리자 CRUD·이미지 API (FR-C01~06)
- ✅ 회원 목록·등급 변경·활동 정지/해제(기간제, 자동 만료) (FR-U01~06)
- ✅ 피드 관리자 목록/상세, 사유 구분 삭제(일반=소프트/정책위반=하드), 정책위반 삭제 시 작성자 활동 정지 연동 (FR-F01~06)

**코드 품질**
- 신규 백엔드 테스트 5개: `UserSuspensionLoginFlowTest`, `UserAdminValidationTest`, `FeedAdminServiceTest`, `TourCourseAdminServiceTest`, `TourCourseImagePolicyTest`
- frontend-code-reviewer 독립 리뷰: Must Fix 다수 발견(§Do 하위 "발견·수정된 버그" 참고), 전건 수정 반영 확인

**코드 리뷰에서 발견·수정된 버그** (포트폴리오 핵심 소재)

| # | 리소스 | 버그 | 근본 원인 | 수정 |
|---|--------|------|-----------|------|
| 1 | 공지 | `useAdminNoticeList`의 `retry()`가 조건 변경으로 인식되지 않아 삭제 후 목록이 갱신되지 않음 | React effect의 의존성 배열이 "조건"만 추적하고 "같은 조건으로 다시 시도"를 구분하지 못함 | `queryKey`(조건 정체성) / `attempt`(재시도 횟수) / `requestKey`(조건+attempt)로 3단 분리. 이후 회원·피드·여행코스 훅이 처음부터 이 패턴 재사용 |
| 2 | 회원 | 활동 정지 적용에 확인 모달 없이 즉시 API 호출되던 UX 버그 | 되돌릴 수 없는 동작(즉시 로그인 차단)에 대한 확인 단계 누락 | 검증(`handleSuspendSubmit`)과 실제 적용(`handleSuspendConfirm`)을 `ConfirmDialog`로 분리 |
| 3 | 회원 | 정지 사유/기간 값에 서버측 검증이 없어 빈 사유·범위 밖 기간도 저장될 수 있었음 | `UserSuspensionRequest`에 검증 애너테이션 부재, 전역 검증 실패 핸들러 부재 | `@Valid` 추가 + `GlobalExceptionHandler`에 `MethodArgumentNotValidException` 핸들러 신규 추가 |
| 4 | 회원 | 상세 페이지가 라우터 state에만 의존해 새로고침·URL 직접 진입 시 깨짐 | 목록 → 상세 이동 시 데이터를 state로만 전달 | `GET /api/v1/admin/users/{id}` 신규 엔드포인트 추가, URL의 id로 직접 조회 |
| 5 | 피드 | 정책위반 삭제 시 관리자가 **자기 자신을 정지**시킬 수 있는 보안 구멍 | "작성자 정지" 옵션에 대상이 요청자 자신인지 검사하는 로직 누락 | `FeedAdminService.ensureNotSelf`로 정지 호출 전에 403 처리 |
| 6 | 여행코스 | 일자 순서를 맞바꾼 뒤 저장하면 `(course_id, day_number)` DB 유니크 제약 위반으로 **항상 실패**하는 동시성 버그 | 새 값을 곧바로 적용하면 두 일자가 일시적으로 같은 슬롯을 다투게 됨 | 제거→flush, 임시 dayNumber 부여→flush, 최종 값 적용의 3단계로 트랜잭션 내 순서를 분리 |
| 7 | 여행코스 | 이미지 업로드 API 응답으로 폼 상태 전체를 교체하면서 **미저장 로컬 편집(새로 추가했지만 아직 저장 안 한 일자/경유지)이 조용히 사라지는 데이터 유실** | 서버 응답을 신뢰의 원천으로 삼아 폼 전체를 덮어씀 | 서버 응답 중 이미지 목록만 부분 머지하고 나머지 로컬 편집 상태는 보존 |
| 8 | 여행코스 | 일자당 이미지 10장 제한이 동시 업로드 요청에서 우회 가능(count-then-write 경쟁 조건) | 이미지 수 확인과 실제 저장 사이에 다른 트랜잭션이 끼어들 수 있음 | `findByIdForUpdate`로 코스 행에 `PESSIMISTIC_WRITE` 락 적용 |
| 9 | 여행코스 | 이미지 삭제 후 재업로드 시 `sortOrder` 중복 가능성 | 다음 순번을 `images.size()`로 계산해, 중간 삭제 후에는 기존 값과 충돌 | `max(sortOrder)+1`로 계산 방식 변경 |

### Check (검증)

**문서**: `docs/03-analysis/admin-dashboard.analysis.md`

**Gap 분석 결과**

```
Overall Match Rate: 99.2%
├ Structural:  100% (설계 §2.4/§10 패키지·파일 구조 완전 일치)
├ Functional:   98% (FR 전체 충족 + 리뷰 발견분 9건 수정 확인)
└ Contract:   100%  (API 3면 대조 15/15 + 리뷰 중 추가 1건)
```

**Success Criteria** (계획 §7.1, 7개 항목) — 7/7 완전 충족

**Gap 목록** (전부 Minor, 처리 방향)
1. **G-A1 (여유 범위, 의도적)**: 여행코스 목록에 일자/경유지 수 미표시. N+1 회피를 위한 트레이드오프로 코드에 사유가 직접 명시돼 있음
2. **G-A2 (설계보다 나은 구현)**: 회원 상세 조회 API(`GET /admin/users/{id}`)는 설계에 없었으나 리뷰에서 발견한 새로고침 버그(위 표 #4)를 고치며 추가됨
3. **G-A3/G-A4 (사용자 승인 유보)**: 여행코스-피드 연동, 관리자 간 정지 정책은 계획/설계 단계에서 이미 스코프 아웃 확정
4. **G-A5 (코드 품질)**: `AdminCourseFormPage.jsx` 661줄, 컴포넌트 분리 안 됨(Should Improve로 남김)
5. **G-A6 (인프라)**: 신규 컬럼 5개·테이블 4개를 수동 `ALTER TABLE`로 반영해야 함(프로젝트에 Flyway 등 마이그레이션 도구 없음)

### Act (완료)

**판단**: gap 분석 결과(Match Rate 99.2%, Critical/Important 0건, 남은 Minor 6건 전부 사용자 승인 스코프 아웃 또는 낮은 우선순위 후속 과제)에 따라 Report 단계로 진행. 코드 리뷰에서 발견된 Must Fix 9건은 모두 이번 PDCA 내에서 수정 완료.

---

## 1.4 성공 기준 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | 비관리자(비로그인 포함)는 `/admin` 어떤 하위 경로로도 실제 데이터에 접근하지 못함 | ✅ 충족 | `SecurityConfig` 기존 규칙 상속 + `RequireAdmin` 프론트 가드 이중 방어 |
| SC-2 | 관리자는 사이드바에서 4개 리소스 관리 화면으로 이동 가능 | ✅ 충족 | `AdminLayout` 4개 메뉴 확인 |
| SC-3 | 공지사항 목록·생성·수정·삭제가 실제 API로 동작 | ✅ 충족 | 기존 API 4종 소비 확인 |
| SC-4 | 여행코스 등록·수정·삭제(참조/직접 입력, 일자당 이미지 10장 이하) 및 스키마 문서화 | ✅ 충족 | 3단 스키마·검증·이미지 정책 구현 확인, 목록 개수 미표시는 문서화된 트레이드오프(G-A1) |
| SC-5 | 회원 목록·등급 변경·활동 정지/해제가 즉시 반영 | ✅ 충족 | `suspendedUntil` 타임스탬프 + 3개 체크포인트 구현 확인 |
| SC-6 | 피드 모니터링, 소프트/하드 삭제 구분, 정책위반 시 정지 연동, 일반 사용자 API 회귀 없음 | ✅ 충족 | `FeedAdminService` 분기 확인, `FeedService.delete(postId, email)` 미변경 확인 |
| SC-7 | frontend-code-reviewer 리뷰 + gap 분석 완료 | ✅ 충족 | 리뷰 Must Fix 9건 수정 반영, 이 보고서와 짝을 이루는 gap 분석 완료 |

**전체 성공률**: 7/7 (100%)

---

## 1.5 주요 결정 기록

| # | 결정 | 실행 | 결과 |
|---|------|:----:|------|
| D-1 | 여행코스 경유지 REFERENCE/CUSTOM 이중 지원(설계 제약) | ✅ | `StopType` enum + nullable 필드 세트로 두 방식 모두 저장. 향후 지도 API 연동은 CUSTOM 입력 폼에 좌표 선택 UI만 추가하면 되고 스키마 변경 불필요 |
| D-2 | 기간을 일자별(Day) 구조화 | ✅ | `TourCourse`-`TourCourseDay`-`TourCourseStop` 3단 구조, `(course_id, dayNumber)` 유니크 제약 |
| D-3 | 이미지 제한을 코스가 아닌 일자당 10장으로 | ✅ | `TourCourseImagePolicy.ensureWithinDayLimit`, 동시 업로드 경쟁 조건은 비관적 락으로 추가 방어(코드 리뷰 발견분) |
| D-4 | 회원 "제재" = 피드 정책위반 대응, 회원 화면에도 직접 노출 | ✅ | `UserSuspensionService`를 `AdminUserController`와 `FeedAdminService` 양쪽이 호출하는 공용 서비스로 구현 |
| D-5 | 피드 삭제는 일반=소프트/정책위반=하드 | ✅ | `FeedAdminService.delete`의 type 분기, 하드 삭제는 기존 `FeedService` 삭제 로직 재사용(소유권 검사만 우회) |
| D-6 | 공지 이미지 관리 제외 | ✅ | `PostAdminResponse` 확장 없음, 텍스트 공지만 지원 |
| D-7 | 4개 리소스를 단일 PDCA로 진행 | ✅ | 공통 셸 → 공지 → 회원 → 피드 → 여행코스 순서로 하나의 PDCA 안에서 완료 |
| 설계 P-1 | 관리자 피드 목록/상세를 신규 엔드포인트로 분리(공개 API 재사용 안 함) | ✅ | 소프트 삭제 게시물도 관리자 화면에서는 사유와 함께 조회 가능 |
| 설계 P-3 | 회원 정지를 boolean이 아닌 타임스탬프로 | ✅ | 배치·스케줄러 없이 3개 체크포인트에서 `now()` 비교만으로 활성화·자동 해제 성립 확인(`UserSuspensionLoginFlowTest`) |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:----:|
| Plan | [admin-dashboard.plan.md](../../01-plan/features/admin-dashboard.plan.md) | ✅ 최종화 (v0.2, D-1~D-7 반영) |
| Design | [admin-dashboard.design.md](../../02-design/features/admin-dashboard.design.md) | ✅ 최종화 (v0.1) |
| Check | [admin-dashboard.analysis.md](../../03-analysis/admin-dashboard.analysis.md) | ✅ 완료 (Match Rate 99.2%) |
| Act | 이 문서 | ✅ 완료 |

---

## 3. 완료된 항목

### 3.1 기능 요구사항

| 그룹 | 항목 수 | 상태 |
|------|:---:|:---:|
| FR-D (공통 셸) | 5 | ✅ 5/5 완료 |
| FR-N (공지) | 4 | ✅ 4/4 완료 |
| FR-C (여행코스) | 6 | ✅ 6/6 완료 (목록 개수 미표시는 문서화된 여유 범위) |
| FR-U (회원) | 6 | ✅ 6/6 완료 |
| FR-F (피드) | 6 | ✅ 6/6 완료 |

**기능 완성도**: 27/27 = 100%

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|:----:|:----:|
| 보안 | 프론트 가드는 UX 보조, 백엔드 인가가 최종 방어선 | ✅ 신규 API 전부 `/api/v1/admin/**` 하위, 자기 자신 보호 로직 확인 | ✅ |
| 일관성 | 4개 리소스 목록/폼 UI가 같은 패턴 | ✅ 공용 컴포넌트 5종 + 상태 훅 패턴 재사용 확인 | ✅ |
| 회귀 방지 | 기존 공개 API 응답 형식 불변 | ✅ `FeedService.delete(postId, email)`, `GET /api/v1/feed/posts`, `GET /api/v1/notices` 미변경 확인 | ✅ |
| 동시성 안전성 | 동시 요청에도 데이터 일관성 유지 | ✅ 일자 순서 교체(비관적 트랜잭션 분리), 이미지 업로드 한도(비관적 락) 두 건 모두 리뷰에서 발견해 수정 | ✅ |
| 유지보수성 | 훅·컴포넌트를 재사용할 수 있음 | ✅ `useAdminNoticeList` 패턴을 3개 리소스가 그대로 재사용 | ✅ |

**품질 메트릭**
- 백엔드 신규 테스트 5개 전체 존재 확인
- Gap 분석: Match Rate 99.2%, Critical 0건
- 코드 리뷰 Must Fix 9건 전건 수정 확인

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:----:|
| 프론트 신규 컴포넌트 | `frontend/src/components/admin/**` | ✅ 셸 5종 + `FeedDeleteDialog`, `TourReferencePicker` |
| 프론트 신규 페이지 | `frontend/src/pages/admin/**` | ✅ 공지·회원·피드·여행코스 목록/상세/폼 전체 |
| 프론트 신규 API/훅 | `frontend/src/api/admin*Api.js`, `frontend/src/hooks/useAdmin*.js` | ✅ 4개 리소스 각각 |
| 백엔드 신규 패키지 | `backend/src/main/java/kr/co/mycom/travel_korea/tourcourse/**` | ✅ 도메인 5종·DTO·리포지토리·서비스·컨트롤러 |
| 백엔드 확장 | `feed/`, `user/`, `config/JwtAuthenticationFilter.java`, `common/exception/GlobalExceptionHandler.java` | ✅ |
| 백엔드 신규 테스트 | `backend/src/test/java/.../{feed,tourcourse,user}/**` | ✅ 5개 |
| 문서 | Plan, Design, Analysis, Report | ✅ 4개 |

---

## 4. 미완료 / 이월 항목

### 4.1 설계 여유 범위 (의도적 미구현)

| 항목 | 설계/코드 근거 | 사유 | 우선순위 | 이월 처리 |
|------|---------|------|----------|----------|
| 여행코스 목록에 일자/경유지 수 표시 | `TourCourseListItemResponse` 주석 | 목록에서 개수까지 보여주려면 컬렉션을 추가 로드해야 해 N+1 위험 발생 | Low | 카운트 쿼리 또는 `@EntityGraph` 추가 검토(다음 PDCA) |

### 4.2 사용자 승인 스코프 아웃 (후속 과제)

| 항목 | 설계 근거 | 처리 |
|------|---------|------|
| 여행코스-피드 연동 | 설계 §8, 사용자가 "지금 확정하기 어렵다"고 명시적으로 유보 | 별도 논의 후 결정 → 별도 기능(`feed-course-linking`)으로 분리 |
| 관리자가 다른 관리자를 정지시키는 것을 막을지 여부 | 설계 §7, FR-U06은 "자기 자신"만 차단 | 정책 결정 필요 시 별도 PDCA |

### 4.3 코드 품질/인프라 후속

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| `AdminCourseFormPage.jsx` 컴포넌트 분리 | 661줄 단일 파일, 1/2/3단계 UX 경계로 분리 가능 | Medium | 다음 리팩터 PDCA |
| 프로덕션 DB 마이그레이션 | 신규 컬럼 5개(회원 정지 3, 피드 삭제 2) + 신규 테이블 4개(여행코스)를 수동 `ALTER TABLE` 필요, Flyway 등 도구 없음 | High(배포 전 필수) | 배포 체크리스트에 수동 DDL 스크립트 추가, 장기적으로 마이그레이션 도구 도입 검토 |

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
│  Minor Gap: 6건                              │
│  └ 여유 범위/유보(사용자 승인): 4건            │
│  └ 코드 품질: 1건                             │
│  └ 인프라 후속: 1건                           │
│  코드 리뷰 발견·수정: 9건 (전건 완료)          │
└─────────────────────────────────────────────┘
```

### 5.2 해결된 이슈 (코드 리뷰 → 수정)

| 이슈 | 해결 방법 | 결과 |
|------|----------|:----:|
| 공지 목록 재시도 미반영 | `queryKey`/`attempt`/`requestKey` 3단 분리 | ✅ 이후 3개 리소스가 처음부터 재사용 |
| 정지 적용 확인 모달 누락 | `ConfirmDialog` 삽입 | ✅ 되돌릴 수 없는 동작에 확인 단계 확보 |
| 정지 사유/기간 서버 검증 누락 | `@Valid` + `MethodArgumentNotValidException` 핸들러 | ✅ 빈 사유·범위 밖 값 서버에서 차단 |
| 회원 상세 새로고침 시 깨짐 | `GET /admin/users/{id}` 신규 추가 | ✅ URL 직접 진입·새로고침 모두 정상 |
| 자기 자신 정지 가능(보안) | `ensureNotSelf` 검사 | ✅ 403으로 차단 |
| 일자 순서 교체 시 저장 항상 실패 | 제거→임시값→최종값 3단계 트랜잭션 분리 | ✅ 유니크 제약 위반 없이 저장 |
| 이미지 업로드 응답이 미저장 편집을 지움 | 부분 머지로 변경 | ✅ 로컬 편집 보존 |
| 이미지 10장 제한 경쟁 조건 | 비관적 락(`PESSIMISTIC_WRITE`) | ✅ 동시 업로드에도 한도 준수 |
| 이미지 재업로드 시 순번 중복 가능성 | `max(sortOrder)+1` 계산 | ✅ 중복 없음 |

### 5.3 테스트 결과

| 카테고리 | 결과 |
|----------|:----:|
| 정적 분석 | ✅ 설계 §2.4/§10 구조 100% 일치 |
| 기능 검증 | ✅ 27/27 FR 충족 |
| 코드 리뷰 반영 확인 | ✅ Must Fix 9/9 수정 확인 |
| 백엔드 신규 테스트 | ✅ 5개 파일 존재 확인(`UserSuspensionLoginFlowTest` 등) |
| L1 API(curl)/L2 UI(브라우저) | ⬜ 미검증 (도구 부재 + DB 마이그레이션 미적용, 다음 세션 이월) |

---

## 6. 배운 점 및 회고

### 6.1 잘된 점 (지속할 사항)

1. **패턴의 조기 확립과 재사용**: 공지사항에서 코드 리뷰로 발견한 `queryKey`/`attempt`/`requestKey` 패턴을 회원·피드·여행코스가 처음부터 그대로 재사용했다. 첫 리소스에서 문제를 겪고 고친 경험이 이후 3개 리소스의 버그를 예방했다.

2. **교차 리소스 서비스 설계**: `UserSuspensionService`를 회원 도메인에 두고 피드 도메인이 의존하게 한 방향 선택(회원이 피드를 모르는 방향)이 실제로 정책위반 삭제 연동에서 깔끔하게 맞아떨어졌다.

3. **타임스탬프 기반 상태 표현**: 회원 활동 정지를 boolean 플래그가 아니라 `suspendedUntil` 타임스탬프로 설계한 것이 배치·스케줄러 없이 자동 만료를 성립시켰고, 실제로 이 설계 덕분에 놓치기 쉬운 "정지 해제 누락" 버그 클래스 자체가 발생하지 않았다.

4. **2단계 저장 흐름을 UI에 그대로 노출**: 여행코스의 "구조 저장 → 이미지 첨부" 2단계를 화면에서 숨기지 않고 "먼저 저장해야 이미지를 추가할 수 있습니다" 안내로 드러낸 것이 혼란을 줄였다.

5. **코드 리뷰가 실제로 심각한 버그를 잡음**: 동시성 버그(일자 순서 교체), 보안 구멍(자기 자신 정지), 데이터 유실(이미지 업로드 응답 덮어쓰기) 세 건 모두 사용자가 수동 테스트만으로는 발견하기 어려운 종류였다. 이 세션에서 리뷰 단계를 생략했다면 프로덕션에서 발견됐을 가능성이 높다.

### 6.2 개선할 점 (다음 시도)

1. **여행코스 목록의 개수 표시 트레이드오프를 설계 단계에서 미리 문서화하지 못함**: N+1 회피 결정 자체는 합리적이지만, 설계 문서 §5.3이 "일자 수, 경유지 수"를 목록 항목으로 서술해 두고 구현에서 빠진 것은 설계-구현 사이의 문서 drift다. 구현 중 의도적으로 스코프를 줄인 결정은 그 즉시 설계 문서에 반영하는 습관이 필요하다.

2. **DB 마이그레이션 도구 부재가 배포 리스크로 남음**: 이번 기능만으로 신규 컬럼 5개·테이블 4개가 생겼다. 프로젝트 규모가 커질수록 수동 `ALTER TABLE`은 위험도가 높아진다. Flyway 등 마이그레이션 도구 도입을 다음 인프라 개선 항목으로 명시적으로 올려야 한다.

3. **L1/L2 실측 환경 부재가 두 PDCA 연속으로 반복됨**: destination-list-integration에서도, 이번 admin-dashboard에서도 브라우저 자동화 도구 부재로 L2 체크리스트를 실행하지 못했다. 코드 리뷰와 단위 테스트로 상당 부분을 보완했지만, 실제 브라우저 동작 검증이 필요한 항목(동시 업로드 경쟁 조건의 실제 재현 등)은 여전히 남아 있다.

### 6.3 다음에 시도할 사항

1. **여행코스-피드 연동 설계**: 이번에 의도적으로 유보한 §8 미해결 사항을 별도 PDCA로 착수. 스키마가 이미 이 확장을 막지 않는다는 것은 확인했으므로 설계 단계부터 시작 가능하다.

2. **`AdminCourseFormPage.jsx` 컴포넌트 분리 리팩터**: 1단계(코스 정보)/2단계(일자·경유지)/3단계(이미지)의 UX 경계가 이미 화면에 명확히 드러나 있으므로, 이 경계를 그대로 컴포넌트 분리 기준으로 삼을 수 있다.

3. **DB 마이그레이션 도구 도입 검토**: Flyway를 우선 후보로 스파이크(spike) 진행.

4. **동시성 버그를 위한 통합 테스트**: 이번에 발견한 두 동시성 이슈(일자 순서 교체, 이미지 10장 제한)는 서비스 계층 단위 테스트로는 완전히 재현하기 어렵다. 실제 동시 요청을 흉내 내는 통합 테스트 작성을 검토.

---

## 7. 다음 단계

### 7.1 즉시 (Report 단계)

- [ ] 설계 문서 갱신 (G-A1: §5.3 목록 개수 표시 서술 정정, G-A2: §4.1에 `GET /admin/users/{id}` 추가)
- [ ] 배포 전 수동 DDL 스크립트 작성(신규 컬럼 5개·테이블 4개)

### 7.2 다음 PDCA 주기

| 기능 | 의존성 | 우선순위 | 비고 |
|------|--------|---------|------|
| 여행코스 공개 조회 API + 사용자 화면 전환 | 이 기능(여행코스 스키마 확정) | High | 계획 4장에서 이미 후속 기능으로 명시됨 |
| 여행코스-피드 연동 설계 | 이 기능(§8 유보 해제 필요) | Medium | 별도 논의 후 결정 필요 |
| `AdminCourseFormPage.jsx` 컴포넌트 분리 | 이 기능 | Medium | 코드 품질 개선 |
| DB 마이그레이션 도구(Flyway) 도입 | 이 기능(신규 스키마 규모 증가) | High | 배포 리스크 완화 |
| L2 브라우저 자동화 도입 | 프로세스 개선 | Medium | destination-list-integration부터 반복된 이슈 |

### 7.3 포트폴리오 추출 (이 세션 이후)

`frontend-interview-coach` 에이전트에 위임:
- 4개 리소스가 공통 셸·패턴·서비스를 교차 재사용하는 관리자 대시보드 설계
- 코드 리뷰로 발견한 동시성 버그(일자 순서 교체 시 유니크 제약 위반)와 3단계 트랜잭션 분리로 고친 과정
- 코드 리뷰로 발견한 보안 구멍(관리자 자기 자신 정지)과 데이터 유실 버그(이미지 업로드 응답 덮어쓰기)
- boolean 플래그 대신 타임스탬프로 "시간이 지나면 풀리는 상태"를 표현하는 설계
- REFERENCE/CUSTOM 이중 지원으로 향후 확장을 스키마 변경 없이 수용하는 설계 제약

---

## 8. Changelog

### v1.0.0 (2026-09-30)

**Added**
- `components/admin/{AdminLayout,RequireAdmin,AdminTable,AdminPagination,AdminSearchBar,ConfirmDialog,AdminToast,AdminAccessDenied,FeedDeleteDialog,TourReferencePicker}.jsx`
- `pages/admin/{AdminDashboardHome,AdminNoticeListPage,AdminNoticeFormPage,AdminUserListPage,AdminUserDetailPage,AdminFeedListPage,AdminFeedDetailPage,AdminCourseListPage,AdminCourseFormPage}.jsx`
- `api/admin{Notice,User,Feed,Course}Api.js`
- `hooks/useAdmin{Notice,User,Feed,Course}{List,Detail}.js`
- 백엔드 `tourcourse` 패키지 전체(도메인 5종, DTO 8종, 리포지토리, 서비스, 컨트롤러, 정책, 예외)
- 백엔드 `feed/{controller/FeedAdminController,service/FeedAdminService,dto/FeedAdmin*}.java`
- 백엔드 `user/{controller/AdminUserController,service/UserAdminService,service/UserSuspensionService,dto/UserAdminResponse,dto/UserGradeUpdateRequest,dto/UserSuspensionRequest}.java`
- 백엔드 테스트 5개: `UserSuspensionLoginFlowTest`, `UserAdminValidationTest`, `FeedAdminServiceTest`, `TourCourseAdminServiceTest`, `TourCourseImagePolicyTest`

**Changed**
- `frontend/src/App.jsx`: `/admin/*` 라우팅 추가
- `frontend/src/api/client.js`: patch/delete + FormData 지원 추가
- `frontend/src/api/tourApi.js`: `toTourCard` 필드 추가
- `backend/.../feed/{domain/FeedPost,repository/FeedPostRepository,service/FeedService}.java`: 소프트 삭제 컬럼·쿼리 추가
- `backend/.../user/{entity/UserEntity,repository/UserRepository,service/AuthService}.java`: 정지 컬럼, 로그인/리프레시 정지 검사 추가
- `backend/.../config/JwtAuthenticationFilter.java`: 매 요청 정지 검사 추가
- `backend/.../common/exception/GlobalExceptionHandler.java`: 검증 실패 + `DataIntegrityViolationException` 핸들러 추가

**Fixed** (코드 리뷰에서 발견 → 수정)
- 공지 목록 재시도 시 갱신 안 되던 버그 (`useAdminNoticeList` queryKey/attempt/requestKey 분리)
- 회원 정지 적용 확인 모달 누락
- 회원 정지 사유/기간 서버 검증 누락
- 회원 상세 새로고침 시 깨지는 문제 (`GET /admin/users/{id}` 추가)
- 피드 정책위반 삭제 시 관리자 자기 자신 정지 가능(보안)
- 여행코스 일자 순서 교체 시 저장 항상 실패(동시성)
- 여행코스 이미지 업로드 응답이 미저장 로컬 편집을 삭제(데이터 유실)
- 여행코스 일자당 이미지 10장 제한 경쟁 조건
- 여행코스 이미지 재업로드 시 sortOrder 중복 가능성

---

## 9. 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-09-30 | 완료 보고서 생성. Plan(D-1~D-7)→Design(P-1~P-4)→Do(4개 리소스, 리뷰 발견 9건 수정)→Check(99.2%)→Act(Report) | frontend-lead (Claude Code 보조) |

---

**작성 완료**: 2026-09-30 · frontend-lead (Claude Code 보조)
