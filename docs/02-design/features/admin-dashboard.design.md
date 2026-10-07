# admin-dashboard 설계 문서

> **요약**: `/admin` 하위에 `RequireAdmin` 가드 + `AdminLayout`(사이드바)을 두고, 공지·여행코스·회원·피드 4개 리소스 관리 화면을 만든다. 회원 "활동 정지"는 영구 정지가 아니라 **기간제 로그인 차단**으로 설계한다 — `suspendedUntil` 타임스탬프 하나를 로그인·리프레시·매 요청(JwtAuthenticationFilter)의 세 지점에서 현재 시각과 비교하는 방식이라 별도 배치·스케줄러 없이 활성화와 자동 해제가 모두 성립한다. 여행코스는 코스 → 일자(Day) → 경유지(Stop, REFERENCE/CUSTOM) 3단 구조로 스키마와 관리자 CRUD API를 확정하지만, **피드와의 연동 방식은 이번 설계에서 다루지 않고 미해결 사항으로 남긴다**(사용자 유보 지시).
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-29
> **상태**: Draft
> **버전**: 0.1
> **계획 문서**: `docs/01-plan/features/admin-dashboard.plan.md` (FR-D01~05, FR-N01~04, FR-C01~06, FR-U01~06, FR-F01~06, D-1~D-7)

---

## Context Anchor

> 계획 문서에서 복사하고, 설계 단계에서 구체화된 부분을 덧붙였다.

| Key | Value |
|-----|-------|
| **WHY** | 관리자가 공지·여행코스·회원·피드를 다룰 화면이 없어 운영이 불가능하다. `/api/v1/admin/**` 인가는 이미 있지만 활용되지 않고 있다 |
| **WHO** | GRADE가 ADMIN인 내부 운영자 |
| **RISK** | 여행코스 스키마를 잘못 정하면 후속 기능(사용자용 목록·상세)까지 다시 설계해야 함 / 회원 정지를 boolean 플래그로 만들면 만료 처리가 누락되는 버그가 생기기 쉬움(설계로 회피, §4.2) / 피드 소프트 삭제 도입으로 공개 목록 쿼리가 바뀌면 회귀 위험 / 여행코스-피드 연동을 지금 설계에 끼워 넣으면 유보 지시를 어기게 됨 |
| **SUCCESS** | 계획 문서 7장과 동일. 추가: 정지 기간이 지나면 관리자 개입 없이 로그인이 다시 가능함, 여행코스 CRUD가 피드 관련 필드를 전혀 참조하지 않음 |
| **SCOPE** | 계획 문서 SCOPE와 동일. **제외를 재확인**: 여행코스-피드 연동 스펙, 지도 API 연동, 공지 이미지 관리, 감사 로그 UI |

---

## 계획 대비 변경

| # | 항목 | 계획 | 설계 | 이유 |
|---|------|------|------|------|
| P-1 | 관리자 피드 목록/상세 API (FR-F01) | "기존 공개 조회 API(`GET /api/v1/feed/posts`) 재사용" | **`GET /api/v1/admin/feed/posts`, `GET /api/v1/admin/feed/posts/{id}` 신규 추가**. 리포지토리 쿼리는 공유하되 `deletedAt` 필터가 다르다 | FR-F02 결정(소프트 삭제된 게시물은 공개 API 응답에서 제외)과 FR-F05 요구(관리자 목록에 삭제 상태·사유 표시)가 동시에 성립하려면 공개 API를 그대로 쓸 수 없다. 공개 API에서 삭제 게시물을 빼는 순간, 관리자가 "무엇을 왜 지웠는지" 볼 방법이 없어진다 |
| P-2 | 여행코스 이미지 업로드 방식 | "S3StorageService 재사용" (형태 미지정) | **구조(코스-일자-경유지)를 JSON으로 먼저 저장하고, 이미지는 저장된 경유지 id에 개별 멀티파트 엔드포인트로 붙인다** (§3.3.4) | 코스 하나에 일자 여러 개, 일자마다 경유지 여러 개, 경유지마다 이미지 여러 장인 3단 중첩 구조를 멀티파트 하나에 담으려면 파일과 경유지를 인덱스로 매핑하는 파싱이 필요해 백엔드·프론트 모두 복잡해진다. 구조 저장(생성된 id 확보) → id 기준 이미지 첨부의 2단계로 나누면 각 요청이 단순해지고, board `PUT /admin/notices`가 이미 쓰는 "본문과 이미지를 분리"하는 관례와도 맞는다 |
| P-3 | 회원 정지 자동 해제 (FR-U04 "설계 문서에서 확정") | 미확정 | **배치/스케줄러 없음. `suspendedUntil`과 `now()`를 매 확인 시점(로그인, 리프레시, JWT 필터)에 비교**해 정지 여부를 그때그때 판단한다 | §4.2. boolean 플래그 + 해제 배치 조합은 배치가 늦게 돌면 만료된 정지가 유지되는 버그가 생긴다. 타임스탬프 비교는 상태를 저장하지 않아 이런 버그 자체가 성립하지 않는다 |
| P-4 | 정지된 회원의 활성 세션 처리 | 언급 없음 | **즉시 강제 로그아웃은 만들지 않는다.** JwtAuthenticationFilter가 다음 API 호출에서 401을 주고, 프론트의 기존 401→재발급 흐름에서 리프레시도 실패해 자연스럽게 로그아웃된다 (§4.2 체크포인트 3) | 별도 세션 무효화·소켓 알림 없이 기존 인증 갱신 경로만으로 충분하다. 새 인프라(WebSocket, 강제 로그아웃 큐 등)를 추가할 근거가 약하다 |

---

## 1. 개요

### 1.1 설계 목표

- 관리자만 `/admin`에 들어갈 수 있고, 4개 리소스를 하나의 레이아웃 안에서 일관된 방식으로 다룬다.
- 회원 활동 정지를 "기간이 지나면 저절로 풀리는" 방식으로 만들어, 정지 해제를 관리자가 잊거나 배치가 실패해도 사고가 나지 않게 한다.
- 여행코스 스키마는 이번 기능(관리자 CRUD)과 후속 기능(사용자 조회, 계획 문서 4장)이 공유하는 계약이 되므로, **이번 기능이 다루지 않는 것(피드 연동)까지 스키마에 미리 끼워 넣지 않는다.** 필요해지면 그때 추가할 수 있는 형태(경유지에 필요 이상의 필드를 두지 않음)로 최소하게 만든다.

### 1.2 설계 원칙

- **새 의존성 없음**: 프론트 서버 상태는 기존 `useTourList`/`useTourDetail` 패턴을 따르는 커스텀 훅으로 만든다(계획 5.3).
- **기존 패턴 재사용**: 이미지 업로드는 `StorageService`(`board.storage`, 이미 `feed`도 재사용 중)를, 콘텐츠 스냅샷은 `FeedPost`의 `tourContentId`+`locationName`+`address` 패턴을 그대로 따른다(§3.3.1).
- **타임스탬프로 상태를 표현한다**: 회원 정지처럼 "시간이 지나면 풀리는" 상태는 boolean이 아니라 만료 시각으로 저장한다(§4.2).
- **유보 지시는 스키마에도 반영하지 않는다**: 여행코스-피드 연동은 코드로도, 스키마 필드로도 미리 설계하지 않는다(§8).
- **fail-closed**: 관리자 API도 요청 검증(일자당 이미지 10장, REFERENCE/CUSTOM 필수값 등)을 통과하지 못하면 저장하지 않는다.

---

## 2. 아키텍처

### 2.1 프론트 구성도

```
BrowserRouter
└─ Route path="/admin/*" element={<RequireAdmin><AdminLayout /></RequireAdmin>}
   ├─ isRestoring          → 전체 로딩 화면 (판단 보류)
   ├─ member === null      → <Navigate to="/login" />
   ├─ member.role !== 'ADMIN' → <AdminAccessDenied />
   └─ 통과 → <Outlet />
       ├─ /admin                     AdminDashboardHome (리소스 진입 카드)
       ├─ /admin/notices             AdminNoticeListPage
       ├─ /admin/notices/new         AdminNoticeFormPage
       ├─ /admin/notices/:id/edit    AdminNoticeFormPage
       ├─ /admin/courses             AdminCourseListPage
       ├─ /admin/courses/new         AdminCourseFormPage
       ├─ /admin/courses/:id/edit    AdminCourseFormPage
       ├─ /admin/users               AdminUserListPage
       ├─ /admin/users/:id           AdminUserDetailPage
       ├─ /admin/feed                AdminFeedListPage
       └─ /admin/feed/:id            AdminFeedDetailPage
```

- `RequireAdmin`은 `useAuth()`의 `member`, `isRestoring`만 읽는다(계획 5.1). 관리자 API가 403을 주면(FR-D03) 각 목록/폼 화면의 데이터 훅이 이를 `AdminAccessDenied`로 전역 전파하지 않고, 화면 단위 오류로 표시한 뒤 `/admin`으로 돌아가는 링크를 준다 — 등급이 바뀐 시점과 화면이 바뀌는 시점 사이에 사용자가 이미 다른 관리 작업을 하고 있었을 수 있어, 갑자기 전체 화면을 덮지 않는다.
- `AdminLayout`은 사이드바(공지·여행코스·회원·피드 4개 고정 메뉴) + `<Outlet/>` 콘텐츠 영역이다. 기존 `Layout.jsx`(헤더/푸터)와는 트리가 분리된다(App.jsx에서 `/admin/*`은 `Layout` 안에 두지 않는다).

### 2.2 공용 컴포넌트 (FR-D04)

| 컴포넌트 | 역할 | 재사용처 |
|----------|------|----------|
| `AdminTable` | 컬럼 정의를 props로 받는 테이블. 로딩(스켈레톤 행)·에러(재시도)·빈 상태를 자체 처리 | 공지·여행코스·회원·피드 목록 4곳 |
| `AdminPagination` | 윈도잉 페이지네이션. `destination-list-integration`의 `lib/pagination.js`(`getPageWindow`) 재사용 | 목록 4곳 |
| `AdminSearchBar` | 검색어 입력 + `useSearchParams` 연동 | 공지·회원·(여행코스 검색은 FR-C02 범위) |
| `ConfirmDialog` | 삭제 등 되돌릴 수 없는 동작 확인 모달. 포커스 트랩은 `app-safety-net`의 `MobileNav` 패턴(§5.1 그 문서) 재사용 | 삭제 4곳, 정지 적용 |
| `AdminToast` | 저장/삭제 후 짧은 성공 피드백 | 폼 저장·삭제 전체 |

각 리소스의 **폼**은 공용화하지 않는다(계획 5.4). 공지 폼(텍스트만), 회원 정지 폼(기간 선택), 코스 폼(중첩 구조)은 서로 다른 입력 모델이라 억지로 합치면 조건 분기만 늘어난다.

### 2.3 상태 관리

계획 5.3과 동일. 목록 검색어·페이지는 `useSearchParams`, 서버 상태는 리소스별 커스텀 훅(`useAdminNoticeList`, `useAdminCourseList`, `useAdminUserList`, `useAdminFeedList`와 각 상세/폼 훅), 폼 상태는 로컬 `useState`.

### 2.4 백엔드 패키지 구조

```
kr.co.mycom.travel_korea
├── board/              (기존, 공지) — 변경 없음
├── course/             (신규)
│   ├── controller/  AdminCourseController
│   ├── domain/      TourCourse, TourCourseDay, TourCourseStop, TourCourseStopImage, StopType(enum)
│   ├── dto/         TourCourseCreateRequest, TourCourseResponse, TourCourseDayResponse, TourCourseStopResponse, ...
│   ├── repository/  TourCourseRepository, TourCourseStopRepository
│   └── service/      AdminCourseService
├── feed/               (기존 확장)
│   ├── controller/  AdminFeedController (신규)
│   ├── domain/      FeedPost (컬럼 추가: deletedAt, deleteReason)
│   ├── dto/         FeedAdminPostResponse (신규)
│   ├── repository/  FeedPostRepository (쿼리 메서드 추가)
│   └── service/      FeedAdminService (신규)
└── user/               (기존 확장)
    ├── controller/  AdminUserController (신규)
    ├── entity/      UserEntity (컬럼 추가: suspendedUntil, suspensionReason, suspendedAt)
    ├── dto/         UserAdminResponse, UserGradeUpdateRequest, UserSuspensionRequest (신규)
    ├── repository/  UserRepository (쿼리 메서드 추가)
    ├── service/      UserAdminService (신규), UserSuspensionService (신규, feed에서도 사용)
    ├── service/AuthService.java   (기존, 로그인·리프레시에 정지 검사 추가)
    └── config 밖: JwtAuthenticationFilter.java (기존, 정지 검사 추가)
```

`course` 패키지는 `tour` 패키지(TourAPI 프록시)와 완전히 분리한다. 계획 1.2에서 확인했듯 기존 `tour` 코드는 외부 API 캐시일 뿐이라 자체 CRUD 도메인과 섞으면 책임이 헷갈린다. `course`가 `tour` 쪽 코드를 참조하는 곳은 딱 하나, REFERENCE 경유지의 `tourContentId`/`tourContentTypeId` 필드뿐이며 이는 값만 저장할 뿐 `tour` 패키지의 서비스를 호출하지 않는다(관리자가 이미 검색·선택한 값을 그대로 저장).

`UserSuspensionService`는 `user` 패키지에 두고 `feed` 패키지가 의존한다. 반대 방향(user가 feed를 아는 것)보다 안전하다 — 회원 도메인은 어떤 도메인의 제재 요청이든 받아들일 수 있어야 하고, 피드 도메인이 회원 상태를 바꾸는 것이 자연스러운 의존 방향이다.

---

## 3. 데이터 모델

### 3.1 공지사항 — 변경 없음

계획 D-6에 따라 스키마·API 변경 없음. 프론트는 기존 4개 엔드포인트(`GET /notices`, `GET/PATCH/PUT/DELETE /admin/notices/{id}`, `POST /admin/notices`)를 그대로 소비한다.

### 3.2 회원 (활동 정지)

#### 3.2.1 `UserEntity` 추가 컬럼

| 컬럼 | 타입 | 의미 |
|------|------|------|
| `SUSPENDED_UNTIL` | `TIMESTAMP`, nullable | 정지 만료 시각. `null` 또는 과거 시각 = 정지 아님. 미래 시각 = 정지 중 |
| `SUSPENSION_REASON` | `VARCHAR(255)`, nullable | 정지 사유(관리자 회원 화면 직접 입력, 또는 피드 정책위반 삭제 시 자동 채움) |
| `SUSPENDED_AT` | `TIMESTAMP`, nullable | 정지가 적용된 시각(정지 시작일 표시용) |

**boolean 플래그를 두지 않는 이유**: "정지 중" 여부는 상태가 아니라 `suspendedUntil.isAfter(now())`라는 **매 순간 다시 계산되는 값**이다. 별도 `isSuspended` 컬럼을 두면 만료 시점에 그 컬럼을 `false`로 되돌리는 배치나 트리거가 필요해지고, 그 배치가 지연되거나 실패하면 "이미 끝난 정지가 계속 유지되는" 버그가 생긴다(§계획 대비 변경 P-3). 타임스탬프 하나면 이런 동기화 자체가 필요 없다.

#### 3.2.2 활동 정지 API

| 메서드 | 경로 | 요청 | 응답 | 설명 |
|--------|------|------|------|------|
| PATCH | `/api/v1/admin/users/{id}/suspension` | `{ days: number, reason: string }` | `UserAdminResponse`(정지 필드 포함) | `suspendedUntil = now().plusDays(days)`, `suspensionReason = reason`, `suspendedAt = now()`로 **덮어쓴다**(과거 정지 이력은 남기지 않음, 계획 2.2 감사 로그 제외와 일관) |
| DELETE | `/api/v1/admin/users/{id}/suspension` | 없음 | `UserAdminResponse` | 조기 해제. 세 필드를 모두 `null`로 |

- `days`는 **관리자가 그때 입력하는 값**이다(D-4 유지: 고정값 아님). 서버는 `1 <= days <= 365` 범위만 검증한다. 상한은 오조작(0일이나 10000일 입력) 방지용 안전장치이지 "무기한 정지 금지"라는 제품 결정이 아니다.
- 자기 자신을 대상으로 하는 호출은 403(FR-U06, 계획 3.4).
- `UserSuspensionService.suspend(Long userId, int days, String reason)` / `lift(Long userId)`로 만들어 `AdminUserController`와 `FeedAdminService`(정책위반 삭제 시, §3.4.3) 양쪽이 호출한다(계획 FR-U04 "공용 API").

#### 3.2.3 프론트 UI (일자 프리셋)

정지 폼은 프리셋 버튼 `3일` / `7일` / `30일` + "직접 입력" 숫자 필드 하나로 만든다. 어떤 값을 고르든 최종적으로 `days` 정수 하나를 API에 보낸다 — 프리셋은 UI 편의일 뿐 서버 계약에는 드러나지 않는다. 사유(`reason`)는 필수 입력으로 둔다(빈 사유로 정지하면 나중에 왜 정지했는지 아무도 알 수 없다).

관리자 회원 목록/상세에는 정지 상태를 `suspendedUntil > now`이면 "정지 중 (해제: {날짜})", 아니면 "정상"으로 표시한다. 이 판정은 **프론트에서 계산**하지만(표시용), 실제 로그인 차단은 반드시 백엔드가 한다(§4.2). 프론트 판정이 시계 오차로 몇 초 어긋나도 보안에는 영향이 없다(표시 문제일 뿐).

### 3.3 여행코스

#### 3.3.1 스키마 (3단 구조)

```
TourCourse 1 ── n TourCourseDay 1 ── n TourCourseStop 1 ── n TourCourseStopImage
```

| 엔티티 | 컬럼 | 설명 |
|--------|------|------|
| `TourCourse` | `id`, `title`(코스명, not null), `theme`(자유 텍스트), `coverImageObjectKey`(nullable, S3 objectKey), `createdAt`, `updatedAt` | 코스 자체는 일자 목록만 가진다(직접 경유지를 참조하지 않음) |
| `TourCourseDay` | `id`, `course_id`(FK), `dayNumber`(int, 코스 내 유일) | "1일차", "2일차" 등. `(course_id, dayNumber)` 유니크 제약 |
| `TourCourseStop` | `id`, `course_day_id`(FK), `sortOrder`(int), `stopType`(`REFERENCE`\|`CUSTOM`), `tourContentId`(nullable), `tourContentTypeId`(nullable), `name`(not null), `address`(nullable), `latitude`(`DECIMAL(10,7)`, nullable), `longitude`(`DECIMAL(10,7)`, nullable) | D-1 설계 제약 반영 (§3.3.2) |
| `TourCourseStopImage` | `id`, `stop_id`(FK), `objectKey`, `sortOrder` | `FeedPhoto`와 같은 모양(엔티티, cascade, orphanRemoval) |

`TourCourse`가 `TourCourseDay`를, `TourCourseDay`가 `TourCourseStop`을 `cascade = CascadeType.ALL, orphanRemoval = true`로 소유한다(코스를 지우면 일자·경유지·경유지 이미지가 모두 정리된다. S3 객체 삭제는 서비스 레이어에서 명시적으로 처리 — JPA cascade는 DB 행만 지우고 S3는 모른다).

**REFERENCE 경유지의 스냅샷 저장**: `tourContentId`/`tourContentTypeId`만 저장하고 매번 TourAPI를 조회하지 않는다. `name`/`address`/좌표는 관리자가 검색 결과에서 선택한 시점의 값을 그대로 저장한다(스냅샷). 이는 새로 만든 규칙이 아니라 **`FeedPost`가 이미 쓰는 패턴을 그대로 따른 것**이다 — `FeedPost.tourContentId`(`String`, nullable) + `locationName` + `address` + `latitude`/`longitude`(`DECIMAL(10,7)`)가 정확히 같은 모양이다(`FeedPost.java:43-57,63-67`). 같은 프로젝트 안에서 "외부 콘텐츠를 참조하되 표시용 데이터는 스냅샷으로 가진다"는 규칙이 두 도메인에서 일관되게 나타난다.

#### 3.3.2 REFERENCE / CUSTOM (D-1 설계 제약)

| stopType | 필수 필드 | 선택 필드 | 비고 |
|----------|-----------|-----------|------|
| `REFERENCE` | `tourContentId`, `tourContentTypeId`, `name`(스냅샷) | `address`, 좌표(스냅샷) | 관리자가 카탈로그 검색(`useTourList`, 검색 모달 선택 로직 재사용, 계획 5.4)으로 고른다 |
| `CUSTOM` | `name` | `address`, 좌표(숫자 입력) | 지도 API 연동 전까지 좌표는 텍스트/숫자 입력 폼으로만 받는다(계획 2.2). 좌표를 비워 두고 주소만 입력하는 것도 허용한다 — 관리자가 정확한 좌표를 모를 수 있고, 이번 범위에는 지도로 좌표를 확인할 방법이 없기 때문이다 |

이 표는 **확정 사양이 아니라 설계 제약의 구체화**다(계획 D-1, 4장). `stopType` 컬럼과 두 세트의 nullable 필드를 미리 만들어 두면, 향후 지도 API 연동은 CUSTOM 입력 폼에 좌표 선택 UI를 추가하는 작업으로 끝나고 스키마 변경이 필요 없다.

#### 3.3.3 검증 규칙 (FR-C06)

| 규칙 | 적용 시점 |
|------|-----------|
| `title` 필수 | 생성·수정 |
| 최소 일자 1개 | 생성·수정 |
| 일자당 최소 경유지 1개 | 생성·수정 |
| `dayNumber`는 1부터 연속 정수(1, 2, 3, ...), 코스 내 유일 | 생성·수정 |
| 경유지 `sortOrder`는 같은 일자 내에서 유일 | 생성·수정 |
| `stopType='REFERENCE'`면 `tourContentId`+`tourContentTypeId` 필수, `stopType='CUSTOM'`이면 없어야 함 | 생성·수정 |
| **같은 일자(day)에 속한 모든 경유지 이미지 수의 합 ≤ 10** | 이미지 첨부 시점(§3.3.4). 생성·수정 시점에는 이미지가 없으므로 해당 없음 |

#### 3.3.4 이미지 첨부 흐름 (P-2)

1. `POST /api/v1/admin/courses` 또는 `PUT /api/v1/admin/courses/{id}` — 코스·일자·경유지 **구조만** JSON으로 저장하고, 생성된 `stopId`를 응답으로 받는다.
2. `POST /api/v1/admin/courses/{courseId}/stops/{stopId}/images` (multipart, 필드명 `images`, 여러 장 동시 가능) — 이 경유지가 속한 **일자**의 기존 이미지 수 + 새로 올릴 파일 수가 10을 넘으면 저장하지 않고 400을 반환한다. 파일 검증(개수·용량·MIME)은 `FeedService`의 상수(`MAX_IMAGE_SIZE` 5MB, `ALLOWED_IMAGE_TYPES` jpeg/png/webp, `FeedService.java:40-50`)와 같은 값을 코스 전용 정책 클래스(`TourCourseImagePolicy`)에 둔다. 업로드는 `StorageService.upload`(재사용)를 그대로 쓴다.
3. `DELETE /api/v1/admin/courses/{courseId}/stops/{stopId}/images/{imageId}` — 개별 이미지 삭제. `StorageService.delete(objectKey)` 호출.
4. `PUT /api/v1/admin/courses/{courseId}/cover-image` (multipart, 단일 파일 `image`) — 코스 대표 이미지 교체. 일자당 10장 제한과는 무관한 별도 슬롯.

이렇게 2단계로 나눈 이유는 "계획 대비 변경" P-2를 본다. 프론트 폼도 같은 순서로 동작한다: 먼저 코스 구조(일자·경유지)를 저장(또는 임시 저장) → 각 경유지 카드에서 이미지를 추가/삭제. 완전히 새 코스를 만드는 도중에도 "구조 저장" 버튼을 한 번 거치게 되므로, 폼에는 "1단계: 코스 정보 저장 → 2단계: 이미지 추가"라는 두 단계가 화면에 드러난다(§5.3).

#### 3.3.5 API 응답 모양

```json
// GET /api/v1/admin/courses/{id}
{
  "id": 1, "title": "제주 동부 1박2일", "theme": "가족여행",
  "coverImageUrl": "https://.../cover.jpg",
  "days": [
    {
      "id": 10, "dayNumber": 1,
      "stops": [
        {
          "id": 100, "sortOrder": 1, "stopType": "REFERENCE",
          "tourContentId": "126508", "tourContentTypeId": 12,
          "name": "성산일출봉", "address": "제주 서귀포시 ...",
          "latitude": 33.4581, "longitude": 126.9425,
          "images": [{ "id": 1000, "url": "https://...", "sortOrder": 0 }]
        },
        {
          "id": 101, "sortOrder": 2, "stopType": "CUSTOM",
          "tourContentId": null, "tourContentTypeId": null,
          "name": "동네 해녀식당", "address": "제주 구좌읍 ...",
          "latitude": null, "longitude": null,
          "images": []
        }
      ]
    }
  ]
}
```

`coverImageUrl`/`images[].url`은 `StorageService.createReadUrl(objectKey)`로 응답 시점에 변환한다(objectKey를 그대로 내려주지 않는다, 기존 board/feed 관례와 동일).

### 3.4 피드

#### 3.4.1 `FeedPost` 추가 컬럼

| 컬럼 | 타입 | 의미 |
|------|------|------|
| `DELETED_AT` | `TIMESTAMP`, nullable | `null` = 정상 노출. 값이 있으면 소프트 삭제됨 |
| `DELETE_REASON` | `VARCHAR(255)`, nullable | 소프트 삭제 사유 |

정책위반(하드 삭제)은 행 자체가 사라지므로 이 두 컬럼에 값이 남지 않는다 — **의도된 트레이드오프**다(D-5: 정책위반 삭제는 하드 삭제까지 허용하기로 결정했으므로, 그 경우 삭제 흔적이 남지 않는 것은 사용자 결정의 자연스러운 결과이지 설계 누락이 아니다). 삭제 이력을 남기고 싶다면 별도 감사 로그 테이블이 필요한데, 이는 계획 2.2에서 이번 범위 밖으로 뺐다.

#### 3.4.2 리포지토리 변경

| 기존 메서드 | 변경 |
|-------------|------|
| `findByVisibility(String, Pageable)` | `findByVisibilityAndDeletedAtIsNull(String, Pageable)`로 대체 (공개 목록, FR-F02) |
| `findWithDetailsById(Long)` | `findWithDetailsByIdAndDeletedAtIsNull(Long)` 추가 (공개 상세). 기존 시그니처는 **관리자 상세용으로 그대로 둔다**(삭제된 것도 조회 가능해야 함) |

관리자 목록은 `deletedAt` 조건 없이 전체를 최신순으로 조회하는 새 쿼리(`findAllByOrderByCreatedAtDesc(Pageable)`)를 추가한다.

#### 3.4.3 관리자 삭제 API

| 메서드 | 경로 | 요청 | 처리 |
|--------|------|------|------|
| DELETE | `/api/v1/admin/feed/posts/{id}` | `{ type: 'NORMAL' \| 'POLICY_VIOLATION', reason: string, suspendAuthor?: boolean, suspensionDays?: number }` | `type=NORMAL`: `deletedAt=now()`, `deleteReason=reason` 저장(소프트). `type=POLICY_VIOLATION`: 기존 `FeedService`의 삭제 로직(사진 objectKey 수집 → DB 삭제 → S3 삭제, `FeedService.java:198-` 이하)을 **소유권 검사(`getOwnedPost`) 없이** 호출하는 `adminHardDelete(postId)`로 하드 삭제. `suspendAuthor=true`이면 같은 트랜잭션에서 `UserSuspensionService.suspend(authorId, suspensionDays, reason)` 호출(D-4) |

`FeedAdminService`는 `FeedService`가 이미 가진 삭제 로직을 재사용하되, 호출 전 소유권 검사를 건너뛰는 별도 조회(`feedPostRepository.findById`, 작성자 무관)로 대상을 가져온다. `FeedService`의 기존 공개 `delete(postId, email)`은 손대지 않는다(일반 사용자 본인 삭제 동작 회귀 방지).

#### 3.4.4 응답 모양

```json
// GET /api/v1/admin/feed/posts (목록)
{ "items": [
  { "id": 1, "authorId": 5, "authorNickname": "여행러", "contentPreview": "제주 여행 3일차...",
    "imageCount": 3, "likeCount": 12, "commentCount": 4, "createdAt": "...",
    "status": "ACTIVE" },
  { "id": 2, "authorId": 7, "authorNickname": "구름", "contentPreview": "...",
    "imageCount": 1, "likeCount": 0, "commentCount": 0, "createdAt": "...",
    "status": "SOFT_DELETED", "deletedAt": "...", "deleteReason": "광고성 게시물" }
], "page": 1, "size": 20, "totalCount": 42 }
```

`status`는 `deletedAt` 유무로 서버가 계산해 내려준다(프론트가 null 체크로 다시 판단하지 않게).

---

## 4. API 명세

### 4.1 신규 엔드포인트 목록

| 메서드 | 경로 | 리소스 | 인증 |
|--------|------|--------|------|
| GET | `/api/v1/admin/courses` | 여행코스 목록 | ROLE_ADMIN |
| GET | `/api/v1/admin/courses/{id}` | 여행코스 상세 | ROLE_ADMIN |
| POST | `/api/v1/admin/courses` | 여행코스 생성(구조) | ROLE_ADMIN |
| PUT | `/api/v1/admin/courses/{id}` | 여행코스 수정(구조 전체 교체) | ROLE_ADMIN |
| DELETE | `/api/v1/admin/courses/{id}` | 여행코스 삭제 | ROLE_ADMIN |
| POST | `/api/v1/admin/courses/{id}/stops/{stopId}/images` | 경유지 이미지 추가 | ROLE_ADMIN |
| DELETE | `/api/v1/admin/courses/{id}/stops/{stopId}/images/{imageId}` | 경유지 이미지 삭제 | ROLE_ADMIN |
| PUT | `/api/v1/admin/courses/{id}/cover-image` | 코스 대표 이미지 교체 | ROLE_ADMIN |
| GET | `/api/v1/admin/users` | 회원 목록(검색·페이지) | ROLE_ADMIN |
| PATCH | `/api/v1/admin/users/{id}/grade` | 등급 변경 | ROLE_ADMIN |
| PATCH | `/api/v1/admin/users/{id}/suspension` | 활동 정지 적용 | ROLE_ADMIN |
| DELETE | `/api/v1/admin/users/{id}/suspension` | 활동 정지 조기 해제 | ROLE_ADMIN |
| GET | `/api/v1/admin/feed/posts` | 피드 관리자 목록(삭제 포함) | ROLE_ADMIN |
| GET | `/api/v1/admin/feed/posts/{id}` | 피드 관리자 상세(삭제 포함) | ROLE_ADMIN |
| DELETE | `/api/v1/admin/feed/posts/{id}` | 피드 삭제(소프트/하드 구분) | ROLE_ADMIN |

모두 `/api/v1/admin/**` 아래 있어 `SecurityConfig`의 기존 규칙을 그대로 상속한다. 새 인가 설정이 필요 없다(계획 6장).

### 4.2 회원 활동 정지 — 로그인 차단 3개 체크포인트

기간제 로그인 차단(D-4)을 **하나의 코드로 여러 번 검사**하지 않고, 기존에 이미 회원 상태를 확인하던 세 지점에 검사를 하나씩 추가한다. 세 지점 모두 이미 DB에서 `UserEntity`를 조회하고 있어 추가 쿼리가 필요 없다.

| # | 체크포인트 | 위치 | 정지 중일 때 동작 |
|---|-----------|------|--------------------|
| 1 | 로그인 시도 | `AuthService.login()` (`AuthService.java:59-84`), 비밀번호 검증 통과 **직후** | 토큰을 발급하지 않고 `403 { code: 'ACCOUNT_SUSPENDED', message: '계정이 일시 정지되었습니다. 해제 예정: {suspendedUntil}', suspendedUntil }` |
| 2 | Refresh Token 재발급 | `AuthService.findRefreshSessionUser()` (`AuthService.java:135-172`), 회원 조회 성공 **직후** | "회원 없음"과 같은 분기로 취급 — `Optional.empty()` 반환 → 기존 401 `REFRESH_FAILED_MESSAGE` 흐름 그대로(§계획 대비 변경 P-4) |
| 3 | 보호 API 매 요청 | `JwtAuthenticationFilter.doFilterInternal()` (`JwtAuthenticationFilter.java:60-80`), `UserEntity` 조회 성공 **직후** | 인증 정보를 설정하지 않고 `SecurityContextHolder.clearContext()` — 잘못된 토큰과 같은 분기(§`JwtAuthenticationFilter.java:81-87`) → 401 |

세 곳 모두 판정 로직은 동일하다: `user.getSuspendedUntil() != null && user.getSuspendedUntil().isAfter(LocalDateTime.now())`. 이 식을 `UserEntity`에 `isSuspended()` 메서드로 추가해 세 곳이 같은 코드를 부른다(엔티티가 자기 상태를 스스로 판정하게 해, 판정 기준이 여러 파일에 흩어지지 않게 한다).

**만료(자동 해제) 처리**: 별도로 만들지 않는다. `suspendedUntil`이 과거가 되는 순간 `isSuspended()`가 `false`를 반환하므로, 그 다음 로그인 시도·리프레시·API 호출부터 자동으로 정상 취급된다. 배치·스케줄러·이벤트가 전혀 필요 없다.

**활성 세션 처리**: 정지 적용 시점에 이미 발급된 Access Token은 만료 전까지는 여전히 유효한 JWT 서명을 가진다. 하지만 체크포인트 3(JwtAuthenticationFilter)이 매 요청마다 DB를 다시 확인하므로, **다음 API 호출에서 바로 401**이 된다(계획 1.2에서 확인한 "등급 변경이 다음 요청부터 즉시 반영"과 같은 메커니즘). 프론트는 이 401을 기존 방식대로 재발급을 시도하고, 체크포인트 2에서 재발급도 실패하므로 결국 로그아웃 상태가 된다. 새로운 프론트 코드가 필요 없다(§계획 대비 변경 P-4) — 다만 정지된 사용자는 "왜 로그아웃됐는지" 이 시점에는 알 수 없고, 다시 로그인을 시도할 때 체크포인트 1에서 구체적인 사유를 받는다. 이 지연은 허용 가능한 트레이드오프로 본다(실시간 알림 인프라를 새로 만들지 않기 위함).

### 4.3 오류 응답 형식

기존 `SecurityConfig`/`GlobalExceptionHandler`의 `{ "message": "..." }` 형식을 따르되, 정지 오류만 프론트가 구체적으로 분기해야 하므로 `code`와 `suspendedUntil`을 덧붙인다.

```json
// 403, 로그인 시도가 정지 중일 때
{ "code": "ACCOUNT_SUSPENDED", "message": "계정이 일시 정지되었습니다. 해제 예정: 2026-10-15T00:00:00", "suspendedUntil": "2026-10-15T00:00:00" }
```

---

## 5. UI/UX

### 5.1 공통

- `AdminLayout` 사이드바: 공지·여행코스·회원·피드 4개 항목, 현재 메뉴 `aria-current="page"`.
- 목록 화면 공통 상태: 로딩(스켈레톤 행) → 성공(테이블) / 빈 결과("등록된 항목이 없습니다") / 오류(재시도 버튼).
- 삭제·정지 등 되돌리기 어려운 동작은 항상 `ConfirmDialog`를 거친다.

### 5.2 회원 관리 화면

- 목록: 닉네임, 이메일, 등급, 정지 상태 배지("정상" / "정지 중 (해제: {날짜})").
- 상세: 등급 변경 select, 활동 정지 폼(프리셋 3/7/30일 + 직접 입력 + 사유 입력 필수) 또는 "정지 해제" 버튼(정지 중일 때만 노출).
- 자기 자신의 상세 화면에서는 등급 변경·정지 컨트롤을 비활성화하고 "본인 계정은 여기서 변경할 수 없습니다" 안내(FR-U06).

### 5.3 여행코스 관리 화면

- 목록: 대표 이미지 썸네일, 코스명, 테마, 일자 수, 경유지 수.
- 폼: "1단계 코스 정보"(코스명·테마) → "2단계 일자·경유지"(일자 추가/삭제, 경유지 추가 시 REFERENCE(카탈로그 검색 모달 재사용)/CUSTOM(명칭·주소·좌표 입력) 선택, 드래그 또는 이동 버튼으로 순서 변경) → 저장 후 "3단계 이미지"(각 경유지 카드에 이미지 추가/삭제, 같은 일자의 이미지 합계를 실시간으로 표시해 10장 제한에 가까워지면 경고).
- 저장 전(구조를 아직 서버에 보내지 않은 상태)에는 이미지 첨부 버튼을 비활성화하고 "먼저 저장해야 이미지를 추가할 수 있습니다" 안내(§3.3.4의 2단계 흐름을 화면에 그대로 노출).

### 5.4 피드 관리 화면

- 목록: 작성자, 내용 미리보기, 이미지 수, 좋아요/댓글 수, 상태 배지("정상" / "삭제됨 · {사유}").
- 삭제 폼(`ConfirmDialog` 확장): 유형 선택(일반 삭제 / 정책위반 삭제) → 사유 입력(필수) → 정책위반 선택 시에만 "작성자 활동 정지" 체크박스와 기간 프리셋 노출.
- 정책위반 삭제를 확정하면 "이 작업은 되돌릴 수 없습니다"를 굵게 표시(하드 삭제이므로).

---

## 6. 오류 처리

| 상황 | 처리 |
|------|------|
| 비관리자가 관리자 API 호출 | 403 (기존 `SecurityConfig`) |
| 정지 중 로그인 시도 | 403 `ACCOUNT_SUSPENDED` (§4.3), 로그인 화면에 해제 예정일 표시 |
| 정지 중 사용자의 API 호출(이미 로그인된 상태) | 401 → 재발급 시도 → 재발급도 401 → 로그아웃 상태로 전환 (§4.2) |
| 일자당 이미지 10장 초과 업로드 | 400, 업로드 폼에 "이 일자에는 이미지를 더 추가할 수 없습니다(10/10)" |
| REFERENCE인데 `tourContentId` 없음 / CUSTOM인데 있음 | 400 `INVALID_STOP_TYPE` |
| 최소 일자·경유지 미달 | 400, 폼 저장 버튼 비활성으로 사전 차단(서버 검증은 방어선) |
| 관리자가 자기 자신을 정지/강등 시도 | 403 (FR-U06) |

---

## 7. 보안

- 모든 신규 엔드포인트는 `/api/v1/admin/**` 아래 두어 기존 `hasAuthority("ROLE_ADMIN")`을 상속한다.
- 프론트 `RequireAdmin`은 UX 보조일 뿐이다(계획 5.1). 실제 방어는 백엔드 인가와 §4.2의 세 체크포인트다.
- 정지 사유·정책위반 삭제 사유는 관리자만 볼 수 있는 응답에만 포함한다(공개 API에는 노출하지 않음).
- 관리자가 다른 관리자를 정지시키는 것은 이번 설계에서 막지 않는다(계획에 명시된 제약은 "자기 자신"뿐, FR-U06). 필요하면 후속 과제로 남긴다(§9).

---

## 8. 미해결 사항 (Open Question — 이번 설계에서 다루지 않음)

**여행코스 ↔ 피드(SNS) 연동 방식은 설계하지 않았다.** 사용자가 "여행코스 API 계약은 피드와도 연결되는 부분이라 지금 확정하기 어렵다"고 명시적으로 유보했기 때문에, 다음을 **의도적으로** 하지 않았다.

- `TourCourse`/`TourCourseStop`에 피드 관련 필드(예: 게시물 수, 태그된 피드 목록)를 추가하지 않았다.
- `FeedPost`에 코스 참조 필드(예: `linkedCourseId`)를 추가하지 않았다.
- "피드 게시물이 코스를 태그/참조한다"는 기능 자체를 API나 화면 어디에도 반영하지 않았다.

**막지 않는지만 확인했다**: `FeedPost`에 향후 `linkedCourseId`(nullable FK, `TourCourse.id` 참조) 하나를 **추가**하는 정도로는 이번 여행코스 스키마를 변경할 필요가 없다(코스 쪽은 자신을 참조하는 존재를 몰라도 되는 단방향 관계이기 때문). 즉 이번 설계가 그 연동을 구조적으로 막고 있지는 않다. 다만 다음은 이번 설계로 답하지 않은 채 남는다.

- 연동의 방향과 형태: 게시물 1개가 코스 1개를 참조하는가, 코스의 특정 일자/경유지를 참조하는가?
- 연동이 어드민 화면에도 노출돼야 하는가(예: "이 코스를 참조한 피드 목록"), 아니면 사용자 화면(피드)에만 필요한가?
- 연동이 이번 admin-dashboard 범위에 포함될 다음 반복 작업인지, 완전히 별도 기능(가칭 `feed-course-linking`)인지?

이 질문들은 **별도 논의 후 결정이 필요**하며, 그 결정이 나오기 전까지 여행코스 스키마·API는 이번 설계(§3.3, §4.1)로 확정해 구현을 진행해도 된다고 판단한다 — 위에서 확인했듯 추가는 가능하지만 지금 구조를 바꿔야 하는 결정은 아니기 때문이다.

---

## 9. 테스트 계획

### 9.1 정적

- 프론트: `npm run lint` 0, `npm run build` 성공
- 백엔드: `mvnw clean test` 통과

### 9.2 L1 (curl, frontend-support-backend)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 비관리자 토큰으로 `/api/v1/admin/courses` 호출 | 403 |
| 2 | 코스 생성(JSON, 2일 × 각 2경유지, REFERENCE+CUSTOM 혼합) | 201, 생성된 stopId 반환 |
| 3 | 한 일자의 경유지 이미지 합계가 10장을 넘도록 업로드 | 마지막 요청 400 |
| 4 | 회원 A를 3일 정지 → A 계정으로 로그인 시도 | 403 `ACCOUNT_SUSPENDED`, `suspendedUntil` 포함 |
| 5 | 시나리오 4 직후 A의 기존 access token으로 보호 API 호출 | 401 |
| 6 | `suspendedUntil`을 과거로 수정한 뒤(테스트 데이터 조작) 같은 계정 로그인 | 정상 로그인 (배치 없이 자동 해제 확인) |
| 7 | 피드 게시물 정책위반 삭제(`suspendAuthor=true`, 7일) | 게시물 하드 삭제 확인(DB에 행 없음, S3 objectKey 삭제 호출 확인), 작성자 `suspendedUntil` 갱신 확인 |
| 8 | 피드 게시물 일반 삭제 후 공개 목록(`GET /api/v1/feed/posts`) 조회 | 목록에서 제외됨 |
| 9 | 같은 게시물을 관리자 목록(`GET /api/v1/admin/feed/posts`)에서 조회 | `status: SOFT_DELETED`, `deleteReason` 포함되어 여전히 보임 |
| 10 | 관리자가 자기 자신 정지 시도 | 403 |

### 9.3 L2 (브라우저, 사용자 확인)

| # | 동작 | 기대 결과 |
|---|------|-----------|
| 1 | 일반 회원 계정으로 `/admin` 접속 | 접근 거부 화면, 데이터 노출 없음 |
| 2 | 공지 생성 → 목록 → 수정 → 삭제 | 각 단계 정상 반영 |
| 3 | 코스 생성(1단계 저장) → 경유지에 이미지 6장 추가 → 다른 경유지(같은 일자)에 5장 추가 시도 | 마지막 1장은 실패, 안내 문구 표시 |
| 4 | 회원 정지(7일, 사유 입력) → 목록에서 "정지 중" 배지 확인 → 그 계정으로 로그인 시도(다른 브라우저) | 정지 안내 메시지 표시 |
| 5 | 피드 게시물 정책위반 삭제 + 작성자 정지 체크 | 게시물이 목록에서 사라지고(관리자 목록엔 삭제됨으로 표시), 작성자 정지 상태 반영 |

---

## 10. 구조

프론트 신규 파일(개략)

```
frontend/src/
├── components/admin/
│   ├── AdminLayout.jsx / .css
│   ├── RequireAdmin.jsx
│   ├── AdminTable.jsx, AdminPagination.jsx, AdminSearchBar.jsx, ConfirmDialog.jsx, AdminToast.jsx
├── pages/admin/
│   ├── AdminDashboardHome.jsx
│   ├── AdminNoticeListPage.jsx, AdminNoticeFormPage.jsx
│   ├── AdminCourseListPage.jsx, AdminCourseFormPage.jsx
│   ├── AdminUserListPage.jsx, AdminUserDetailPage.jsx
│   └── AdminFeedListPage.jsx, AdminFeedDetailPage.jsx
├── api/
│   ├── adminNoticeApi.js, adminCourseApi.js, adminUserApi.js, adminFeedApi.js
└── hooks/
    ├── useAdminNoticeList.js / useAdminNoticeDetail.js
    ├── useAdminCourseList.js / useAdminCourseDetail.js
    ├── useAdminUserList.js / useAdminUserDetail.js
    └── useAdminFeedList.js / useAdminFeedDetail.js
```

백엔드 신규/변경 파일은 §2.4 패키지 구조를 따른다.

---

## 11. 코딩 규칙

- 프론트: 기존 스타일(세미콜론 없음, 작은따옴표, 한국어 주석), 주요 결정 지점에 `// Design Ref: §N`
- 백엔드: 기존 Lombok·`@Slf4j` 관례, 새 패키지(`course`)도 `feed`/`board`와 같은 계층(controller/domain/dto/repository/service) 유지
- 새 의존성 금지(프론트: react-query 등 미도입, 백엔드: 스케줄러 라이브러리 미도입 — §4.2에서 필요 없음을 확인)

---

## 12. 구현 가이드

### 12.1 구현 순서 (계획 9장과 동일한 순서를 그대로 따름)

1. 공통 셸: `RequireAdmin`, `AdminLayout`, 공용 컴포넌트, 대시보드 홈
2. 공지사항: 4개 화면(기존 API)
3. 회원: `UserEntity` 컬럼 추가 → §4.2 세 체크포인트 → 목록/상세/정지 API → 프론트 화면
4. 피드: `FeedPost` 컬럼 추가 → 리포지토리 쿼리 분리(P-1) → 관리자 목록/상세/삭제 API(정지 연동 포함) → 프론트 화면
5. 여행코스: 엔티티 3종 → CRUD API(구조) → 이미지 API(§3.3.4) → 프론트 폼(3단계)

### 12.2 세션 가이드

리소스별로 세션을 나눌 수 있다(파일이 겹치지 않음). 단, 3번(회원)의 §4.2 체크포인트 변경은 `AuthService`/`JwtAuthenticationFilter`를 건드리므로 다른 작업과 동시에 수정하지 않는다(계획 9장 "같은 파일을 여러 구현 에이전트가 동시에 수정하지 않는다").

---

## 13. 이후 단계

1. [ ] 이 설계 문서 기준으로 구현(§12.1 순서)
2. [ ] frontend-code-reviewer 리뷰 + bkit gap 분석
3. [ ] 완료 보고서 → frontend-interview-coach
4. [ ] (별도 논의) §8 여행코스-피드 연동 방식 결정 → 결정 이후 별도 기능으로 설계
5. [ ] (별도 후속 기능) 여행코스 공개 조회 API + 사용자 화면 전환(계획 4장)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-29 | 초안. 회원 활동 정지를 기간제 로그인 차단(타임스탬프 비교, 3개 체크포인트, 스케줄러 불필요)으로 확정. 여행코스 CRUD 스키마(코스-일자-경유지, REFERENCE/CUSTOM, 일자당 이미지 10장, 2단계 이미지 첨부)를 확정하되 피드 연동은 §8 미해결 사항으로 명시적으로 유보. 피드 관리자 목록/상세를 신규 엔드포인트로 분리(P-1) | WOOJIN |
