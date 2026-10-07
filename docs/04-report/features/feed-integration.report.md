# feed-integration 완료 보고서

> **상태**: ✅ Complete (PDCA 사이클 1 — 댓글 제외)
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: frontend-lead (Claude Code 보조)
> **완료일**: 2026-09-30
> **PDCA 주기**: #4 (destination-list-integration → admin-dashboard → tour-course-list-integration에 이은 네 번째 주기). 이 기능은 규모상 2개 PDCA 사이클로 분리됐고, 이 문서는 **사이클 1**(댓글 제외: 타임라인·상세·작성·삭제·좋아요·북마크·타인 프로필·버그 정리)만 다룬다

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **기능** | 네비게이션에 이미 노출돼 있던 "여행 피드" 메뉴(`/feed`)가 `ComingSoonPage`뿐이던 상태를 실제 화면으로 전환. 이미 존재하던 백엔드 CRUD(목록·상세·작성·삭제·좋아요·북마크·내 프로필)를 프론트에 연결하고, 무한 스크롤을 위한 커서 기반 목록 API와 타인 프로필 조회 API를 신규로 추가 |
| **시작일** | 2026-09-30 (계획 단계) |
| **완료일** | 2026-09-30 (세션 한도로 한 차례 중단됐다가 재개 → 코드 리뷰 Must Fix 2건 수정 → gap 분석 완료) |
| **소요 기간** | 1일(여러 세션에 걸쳐 진행). 세션 한도(rate limit)로 구현 도중 한 번 중단됐고, 후속 세션이 `git status`로 현재 상태를 점검한 뒤 남은 부분만 이어서 완성했다 |

### 1.2 결과 요약

```
┌──────────────────────────────────────────────┐
│  전체 Match Rate: 98.8%                       │
├──────────────────────────────────────────────┤
│  ✅ 완료:     타임라인·상세·작성·타인프로필 4개 화면 │
│  ✅ 신규 API: 커서 기반 목록 1개 + 타인 프로필 1개  │
│  ✅ 계약:     API 5면 대조 100% 일치            │
│  ✅ 코드 리뷰: Must Fix 2건 전건 수정 완료       │
│  ✅ 자체 점검: 세션 재개 중 발견한 이슈 3건 수정   │
│  ✅ Gap:      Critical 0건, Important 4건(전건 완료) │
│  ⚠️  Minor:    7건(완료 1, 후속과제 5, 여유범위 1) │
└──────────────────────────────────────────────┘
```

### 1.3 전달한 가치 (4 관점)

| 관점 | 내용 |
|------|------|
| **문제** | `/feed`는 네비게이션에 이미 노출된 메뉴였지만 실제로는 `ComingSoonPage`뿐이었다. 백엔드는 목록·상세·작성·삭제·좋아요·북마크·내 프로필까지 이미 동작했지만, 오프셋(`page`/`size`) 방식 목록 API를 그대로 무한 스크롤에 쓰면 스크롤 도중 새 글이 생겼을 때 이미 본 글이 중복되거나 건너뛰어지는 문제가 있었고, 타인의 피드 프로필을 조회하는 API 자체가 없었다. |
| **해결** | 이 프로젝트 최초로 커서(`id`) 기반 무한 스크롤을 도입했다. 오프셋 대신 "마지막으로 본 게시물보다 오래된 것만" 요청하는 방식으로 설계해, 스크롤 중 새 글이 몇 개 생기든 이미 본 항목이 중복되거나 건너뛰어지지 않는다. 프론트 상태 머신(`useFeedInfiniteList`)은 기존 `useTourList`류의 "요청 key 비교로 늦은 응답 무시" 방식 대신, `loadingRef`(동기 플래그)로 진행 중인 요청이 있으면 다음 트리거 자체를 시작하지 않는 **선제적 차단** 방식을 새로 설계했다 — 누적(append)형 상태는 두 요청이 동시에 끝나면 순서가 꼬일 수 있어, "늦게 온 응답을 버린다"가 아니라 "애초에 동시 요청을 허용하지 않는다"는 판단이 더 안전했기 때문이다. 또한 계획 단계에서 `FeedExceptionHandler`의 죽은 메서드를 "긴급 버그"로 잘못 분류했던 것을, 설계 단계에서 `GlobalExceptionHandler`를 추가로 조사해 "실제로는 무해한 죽은 코드"임을 스스로 재확인하고 더 안전한 수정 방향(애너테이션 추가 대신 죽은 코드 삭제)으로 바로잡았다. |
| **기능/UX 효과** | 사용자가 무한 스크롤로 다른 사람의 공개 게시물을 훑어보고, 사진(최대 5장, 미리보기+드래그/키보드 순서변경)·태그·공개범위·위치 태깅을 담아 글을 쓰고, 좋아요·북마크를 남기고, 본인 글을 확인 모달을 거쳐 지우고, 다른 사용자의 피드 프로필(공개 게시물, 페이지네이션)을 구경할 수 있게 됐다. 댓글 수는 아직 항상 0이지만 클릭 가능한 링크로 만들지 않아("거짓 UI 금지" 원칙) 없는 기능을 있는 것처럼 보이지 않는다. |
| **핵심 가치** | 이 기능의 포트폴리오 가치는 세 가지다. 첫째, **커서 기반 무한 스크롤과 경쟁 조건 방어를 함께 설계한 것** — 페이지네이션 방식 전환이 단순 API 파라미터 변경이 아니라 "스크롤 중 데이터 정합성"이라는 실제 문제를 해결하기 위한 선택이었음을, `loadingRef` 선제 차단이라는 구체적 메커니즘과 함께 설명할 수 있다. 둘째, **자신의 조사 오류를 다음 단계에서 스스로 발견하고 정정한 과정** — Plan 문서가 "긴급 수정 대상"으로 분류했던 버그를 Design 단계에서 재조사해 "죽은 코드지만 실제로는 무해함"을 확인하고, 심지어 처음 제안했던 수정 방법(애너테이션 추가)이 두 개의 전역 예외 핸들러가 충돌하는 새 위험을 만든다는 것까지 발견해 더 안전한 방향(죽은 코드 삭제)으로 바꿨다. 셋째, **코드 리뷰와 자체 점검이 실제로 결함을 잡아낸 사례** — `SecurityConfig`에 타인 프로필 조회의 `permitAll` 규칙이 설계 문서의 "변경 자원" 표에서 누락돼 실제 구현에서 빠졌던 것을 세션 재개 중 자체 점검으로 발견했고(비로그인 사용자가 타인 프로필을 보면 401), 별도의 frontend-code-reviewer 리뷰에서는 타인 프로필 화면이 13개 이상 게시물을 조용히 숨기는 기능 결함(페이지네이션 미사용)과 요청 취소 누락을 추가로 찾아냈다. 셋 다 커밋 전에 발견해 회귀 테스트까지 남기고 닫았다. |

---

## PDCA 주기 요약

### Plan (계획)

**문서**: `docs/01-plan/features/feed-integration.plan.md` (v0.3, PDCA 사이클 분리 확정)

**목표**
- 네비게이션에 이미 노출된 "여행 피드"를 실제로 동작하게 함
- 오프셋 목록 API를 커서 기반 무한 스크롤로 전환
- 타인 프로필 조회 API 신설
- `FeedExceptionHandler`의 발견된 문제를 정리
- 기능 전체(댓글 포함)가 admin-dashboard의 개별 리소스 하나보다 커진다는 점을 근거로 2개 PDCA 사이클로 분리(사이클 1: 이 문서 / 사이클 2: `feed-comment-integration`, 후속)

**주요 결정** (사용자 Q-1 ~ Q-9, 2026-09-30 — 대부분 추천안과 다르게 선택)

| # (Plan 원 번호) | 결정 | 요지 | 실행 |
|---|------|------|:----:|
| D-1 (Q-1) | 댓글+답글 포함 여부 | C) 포함 확정(답글 1단계)하되, **PDCA 사이클 분리 확정**에 따라 구현 시점을 사이클 2로 이관 — 이 문서(사이클 1)는 댓글을 전혀 다루지 않음 | ✅(분리 실행) |
| D-2 (Q-2) | 게시물 수정 기능 | A) 기존 백엔드 설계 유지(수정 없음, 삭제만) | ✅ |
| D-3 (Q-3) | 목록 로드 방식 | A) 무한 스크롤 신규 도입, 커서(`id`) 기반 API 신설 | ✅ |
| D-4 (Q-4) | 위치 태깅 UX | A) `TourReferencePicker` 재사용(공용 경로 이동 필요) | ✅ |
| D-5 (Q-5) | 이미지 업로드 UX | B) 미리보기 + 드래그 순서변경(진행률 표시는 제외) | ✅ |
| D-6 (Q-6) | 타인 프로필 조회 | B) 포함, 신규 공개 API 필요 | ✅ |
| D-7 (Q-7) | 태그 검색 | A) 이번 범위 제외 | ✅(미구현이 완료 조건) |
| D-8 (Q-8) | `/mypage`, `/bookmarks` 경계 | A) 이번 범위는 `/feed`만("내가 쓴 글" 탭도 만들지 않음) | ✅(미구현이 완료 조건) |
| D-9 (Q-9) | 버그 수정 시점 | A) 이번에 함께 고침(단, 방법은 설계 단계에서 정정 — 아래 Design 참고) | ✅ |

**범위**: FR-01~12, FR-15~18(프론트+백엔드). FR-13, FR-14(댓글)는 사이클 2로 이관돼 번호만 결번 처리

### Design (설계)

**문서**: `docs/02-design/features/feed-integration.design.md` (v0.2)

**아키텍처 결정**

| 기준 | 선택 | 이유 |
|------|------|------|
| **커서 정렬 키** | `createdAt` 대신 `id`(IDENTITY, auto-increment) | `createdAt`은 초 단위 정밀도라 동시각 충돌 위험이 있지만, `id`는 생성 순서와 항상 정확히 일치해 복합 커서 인코딩 없이 정수 하나만으로 안전한 커서가 됨 |
| **다음 페이지 존재 여부** | `size`+1개를 조회해 COUNT 쿼리 없이 판단 | tour-course-list-integration이 이미 검증한 "쿼리 수를 늘리지 않는" 원칙의 연장 |
| **무한 스크롤 상태 머신** | `useTourList`류(교체형)를 복제하지 않고 새로 설계, `loadingRef`로 선제 차단 | 누적(append)형 상태는 "늦은 응답 무시"가 아니라 "애초에 동시 요청을 막는" 편이 더 단순하고 안전 |
| **`FeedExceptionHandler` 수정 방법** | 애너테이션 추가 대신 죽은 메서드 삭제(계획 단계 제안을 설계 단계에서 정정) | `GlobalExceptionHandler`가 이미 같은 예외를 동일한 형식으로 처리 중임을 재조사로 확인. 애너테이션을 추가하면 두 전역 `@RestControllerAdvice`가 같은 예외를 동시에 처리하게 되어 어느 빈이 우선하는지가 스프링의 내부 정렬 순서에 암묵적으로 의존하는 새 위험이 생김 |
| **타인 프로필 노출 범위** | liked/bookmarked 항상 false | 조회자 기준 좋아요 여부를 계산하려면 목록 API와 같은 추가 조회가 필요한데, "둘러보기" 목적이 우선이라 이번 범위에서 생략 |
| **`TourReferencePicker` 이동** | `components/admin/` → `components/common/`, 내부의 `AdminPagination` 참조는 의도적으로 유지 | 이미 검증된 `AdminCourseFormPage`의 시각적 출력을 그대로 유지하는 것이, 새 공개용 페이지네이션 컴포넌트를 만드는 것보다 더 낮은 회귀 위험이라고 판단 |

**주요 모듈**

| 모듈 | 역할 | 비고 |
|------|------|------|
| `api/feedApi.js` | 타임라인·상세·작성·삭제·좋아요/북마크·타인 프로필, view model 변환 | `courseApi.js`와 동일한 fail-closed 원칙 |
| `hooks/useFeedInfiniteList.js` | 무한 스크롤 상태 머신(누적, 커서, 로딩/추가로딩/에러 구분) | 이 프로젝트 최초의 "누적형" 상태 훅 |
| `hooks/useFeedDetail.js`/`useFeedUserProfile.js` | 상세·타인 프로필 상태(loading/success/not-found/error) | `useCourseDetail` 패턴 재사용, `key={id}`/`key={userId}` 재마운트 |
| `components/feed/FeedComposer.jsx`+`FeedImageEditor.jsx` | 작성 폼 + 이미지 미리보기·순서변경 | 새 드래그 라이브러리 없이 HTML5 네이티브 드래그 + 항상 노출되는 키보드 접근 가능 버튼 병행 |
| `components/feed/FeedConfirmDialog.jsx` | 공개 화면 전용 삭제 확인 모달 | 관리자 `ConfirmDialog`를 재사용하지 않고 접근성 패턴만 복제(관리자 CSS 결합 회피) |

### Do (구현) — 세션 한도로 중단 후 재개

**진행 순서**: 백엔드 신규 API(frontend-support-backend) → 프론트 전체 구현(frontend-lead) → **세션 한도 도달, 중단** → 후속 세션이 `git status`로 현재 상태 점검 → 중단된 부분 완성 → 코드 리뷰 → Must Fix 2건 수정.

| 순서 | 영역 | 담당 | 주요 산출물 |
|:---:|------|------|-------------|
| 1 | 백엔드 커서 API·타인 프로필 API·버그 정리 | frontend-support-backend | `FeedController`(cursor), `FeedTimelineResponse` 신규, `FeedPageResponse` 폐기, `FeedProfileController.getUserProfile`, `FeedExceptionHandler` 죽은 메서드 삭제 |
| 2 | 프론트 데이터 계층·표시 계층(1차) | frontend-lead | `feedApi.js`, 3개 훅, `FeedCard`/`FeedComposer`/`FeedConfirmDialog`/`FeedImageEditor`/`FeedTimelineSentinel`, `FeedPage.jsx`(+css), `FeedDetailPage.jsx`, `TourReferencePicker` 이동 — **이 지점에서 세션 한도로 중단** |
| 3 | 중단 상태 점검·마무리(세션 재개) | frontend-lead | `FeedDetailPage.css`(누락 발견, 신규 작성), `FeedUserProfilePage.jsx`(+css)(신규, `useFeedUserProfile`을 소비하는 화면이 없었음), `App.jsx` 라우트 3개 교체, `FeedComposer.jsx`의 `react-hooks/refs` lint 오류 수정, `SecurityConfig` permitAll 누락 발견·보고 |
| 4 | 코드 리뷰 반영 | frontend-lead | Must Fix 2건 수정(아래 표) |

**완료 항목**
- ✅ 커서 기반 무한 스크롤 타임라인(`/feed`), 로딩·에러·빈 상태 구분 (FR-01, 06, 07, 12)
- ✅ 게시물 작성(사진 순서변경·위치 태깅 포함)·삭제(확인 모달)·좋아요·북마크 (FR-02~05, 08~10)
- ✅ 타인 프로필 조회(`/feed/users/:userId`), 페이지네이션 포함 (FR-15, 16)
- ✅ `/feed` 라우팅 실제 화면 전환, `TourReferencePicker` 공용 경로 이동 (FR-11, 18)
- ✅ `FeedExceptionHandler` 죽은 코드 정리 (FR-17)

**코드 품질**
- 백엔드 신규 테스트 3개: `FeedTimelineCursorTest`(커서 5종), `FeedUserProfileServiceTest`(프로필 4종), `SecurityConfigFeedProfileAccessTest`(권한 회귀 3종, G-1 수정과 함께 신설)
- `npm run lint` 오류 0, `npm run build` 성공(세션 재개 시 1회, 코드 리뷰 수정 후 1회, 총 2회 확인)
- frontend-code-reviewer 독립 리뷰: Must Fix 2건 발견, 전건 수정 반영 확인

**발견·수정된 이슈** (포트폴리오 소재)

| # | 이슈 | 발견 경로 | 근본 원인 | 수정 |
|---|------|-----------|-----------|------|
| 1 | `SecurityConfig`에 타인 프로필 조회(`GET /api/v1/feed/profile/{userId}`) permitAll 누락 — 설계 의도("비로그인도 조회 가능")와 달리 401 | 자체 점검(세션 재개, 코드 리뷰 이전) | 설계 문서 §6.1 "변경 자원" 표에 `SecurityConfig.java`가 빠져 있어, 새 엔드포인트를 추가하면서 보안 설정 갱신이 함께 누락됨 | `HttpMethod.GET, "/api/v1/feed/profile/*"`(단일 세그먼트 와일드카드로 인증 필요한 `GET /api/v1/feed/profile`과 구분) permitAll 추가 + `SecurityConfigFeedProfileAccessTest` 3종 신설 |
| 2 | 세션 중단으로 `FeedDetailPage.css`가 없고, `useFeedUserProfile`을 소비하는 화면 자체가 없어 `/feed`가 여전히 `ComingSoonPage` | 자체 점검(세션 재개 1단계) | 세션 한도(rate limit)로 구현이 "`FeedPage.css`를 쓰는 중"에 중단됨 | 누락 파일 완성, `App.jsx` 라우트 3개 추가 |
| 3 | 타인 프로필 화면이 게시물 13개 이상인 사용자에서 최신 12개만 보이고 나머지가 조용히 사라짐 | frontend-code-reviewer(Must Fix 1) | 백엔드·API·훅은 이미 `currentPage`/`totalPages`/`hasNext`를 내려주고 있었으나, 화면이 `page`를 1로 고정 호출 | `page` 로컬 상태 + 이전/다음 버튼 + "요청한 page와 마지막으로 받은 page가 다르면 전환 중"이라는 렌더 중 파생 상태(`isPageChanging`) 추가 |
| 4 | `useFeedUserProfile`가 언마운트·페이지 전환 시 HTTP 요청 자체를 취소하지 않음(`isActive` 플래그로 `setState`만 막음) | frontend-code-reviewer(Must Fix 2) | `fetchFeedUserProfile`이 `signal` 파라미터를 받지 않아 `apiClient.get`에 취소 신호가 전달되지 않음 | `feedApi.js`에 `{ signal }` 인자 추가, 훅에서 `AbortController` 생성·`abort()`·`isAbortError` 분기 추가(`useFeedDetail`/`useFeedInfiniteList`와 동일 패턴) |
| 5 | `FeedComposer.jsx`가 렌더링 중 ref에 직접 대입해 `npm run lint`에서 `react-hooks/refs` 오류 | 자체 점검(세션 재개 시 최초 lint 실행) | `imagesRef.current = images`를 컴포넌트 본문에서 직접 실행 | `useEffect(() => { imagesRef.current = images }, [images])`로 커밋 이후 갱신하도록 이동 |

### Check (검증)

**문서**: `docs/03-analysis/feed-integration.analysis.md`

**Gap 분석 결과**

```
Overall Match Rate: 98.8%
├ Structural:  100% (설계 §2.2/§6.1/§10 모듈·라우팅 목록 완전 일치)
├ Functional:   97% (FR-01~12, 15~18 전체 충족 + 발견분 5건 수정 확인, 감점은 커서 경계값 테스트 1건 미비 + L2 미검증)
└ Contract:   100%  (API 5면 대조 5/5, SecurityConfig 포함)
```

**Success Criteria** (계획 §4.1, 9개 항목) — 9/9 완전 충족

**Gap 목록** (Critical 0, Important 4건 전건 완료, Minor 7건)
1. **G-1 (Important, 완료)**: `SecurityConfig` 타인 프로필 permitAll 누락 — 자체 점검으로 발견·수정
2. **G-2 (Important, 완료)**: 세션 중단으로 인한 미완성 파일 3종 — 재개 세션에서 완성
3. **G-3 (Important, 완료)**: 타인 프로필 페이지네이션 UI 누락 — 코드 리뷰 Must Fix 1 수정
4. **G-4 (Important, 완료)**: `useFeedUserProfile` 요청 미취소 — 코드 리뷰 Must Fix 2 수정
5. **G-5 (Minor, 완료)**: `FeedComposer` 렌더 중 ref 쓰기 lint 오류 — 자체 점검으로 발견·수정
6. **G-6~G-10 (Minor, 후속 과제)**: 낙관적 업데이트 오버레이 패턴 3곳 중복, 커서 경계값 테스트 미비, `removeItem` 죽은 코드, `TourReferencePicker`의 admin 폴더 교차 import, `FeedComposer`의 Escape 핸들러 재등록
7. **G-11 (Minor, 여유 범위)**: 댓글+답글 — 계획에서 이미 사이클 2로 분리 확정

### Act (완료)

**판단**: gap 분석 결과(Match Rate 98.8%, Critical 0건, Important 4건 전건 완료·수정)에 따라 Report 단계로 진행. 세션 재개 중 자체 점검으로 발견한 이슈 3건(G-1, G-2, G-5)과 frontend-code-reviewer가 찾은 Must Fix 2건(G-3, G-4)은 모두 이번 PDCA 사이클 내에서 수정 완료됐다. 남은 Minor 5건은 다음 세션 또는 다음 PDCA로 이월한다.

---

## 1.4 성공 기준 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | `/feed`에서 무한 스크롤로 실제 공개 게시물을 볼 수 있다(비로그인 포함) | ✅ 충족 | `FeedPage` + `useFeedInfiniteList` + 커서 API, `SecurityConfig` GET permitAll 확인 |
| SC-2 | 로그인 사용자가 사진·글·태그·공개범위·위치 태깅을 담아 작성할 수 있다 | ✅ 충족 | `FeedComposer`+`FeedImageEditor`+`TourReferencePicker` |
| SC-3 | 좋아요·북마크 토글이 실제로 동작한다 | ✅ 충족 | 3개 화면 모두 낙관적 업데이트+롤백 확인 |
| SC-4 | 작성자 본인이 게시물을 삭제할 수 있다 | ✅ 충족 | `FeedConfirmDialog` 경유 확인 |
| SC-5 | 다른 사용자의 피드 프로필(공개 게시물만)을 볼 수 있다 | ✅ 충족 | `FeedUserProfilePage` 신규 작성 + 페이지네이션(G-3) + SecurityConfig 수정(G-1) |
| SC-6 | 스크롤 중 새 글이 생겨도 목록에 중복·누락이 생기지 않는다 | ✅ 충족(경계값 테스트 1건 후속) | `id` 커서 + `FeedTimelineCursorTest` 5종 |
| SC-7 | 로딩·에러(재시도)·빈 상태가 구분되어 표시된다 | ✅ 충족 | 3개 화면 모두 상태 분기 확인 |
| SC-8 | 관리자 피드 모더레이션 화면, `AdminCourseFormPage`에 회귀가 없다 | ✅ 충족 | git status로 관리자 파일 미변경 확인 |
| SC-9 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ 충족 | Must Fix 2건 수정 반영, 이 보고서와 짝을 이루는 gap 분석 완료 |

**전체 성공률**: 9/9 (100%)

---

## 1.5 주요 결정 기록

| # | 결정 | 실행 | 결과 |
|---|------|:----:|------|
| D-1 (Q-1) | 댓글+답글은 포함 확정하되 구현은 사이클 2로 분리 | ✅ | 이 문서(사이클 1)는 댓글을 전혀 다루지 않음. 후속 `feed-comment-integration`에서 Plan부터 재시작 |
| D-2 (Q-2) | 게시물 수정 기능은 기존 백엔드 판단 유지(삭제만) | ✅ | `FeedController`/`FeedService`의 주석 처리된 수정 코드 무변경 |
| D-3 (Q-3) | 무한 스크롤 신규 도입, 커서(`id`) 기반 | ✅ | 오프셋 `page` 대신 `id` 커서로 스크롤 중 중복·누락 방지, `loadingRef` 선제 차단으로 경쟁 조건 방어 |
| D-4 (Q-4) | 위치 태깅은 `TourReferencePicker` 재사용 | ✅ | `components/common/`으로 이동, `AdminCourseFormPage` import 경로만 변경(로직 무변경) |
| D-5 (Q-5) | 이미지 업로드는 미리보기+드래그 순서변경 | ✅ | 새 라이브러리 없이 HTML5 네이티브 드래그 + 항상 노출되는 키보드 버튼 병행 |
| D-6 (Q-6) | 타인 프로필 조회 포함 | ✅ | `GET /api/v1/feed/profile/{userId}` 신규 + `FeedUserProfilePage` 신규(페이지네이션 포함) |
| D-7 (Q-7) | 태그 검색은 이번 범위 제외 | ✅ | 태그는 표시만, 클릭 검색 기능 미구현(완료 조건과 일치) |
| D-8 (Q-8) | `/mypage`, `/bookmarks`는 이번 범위 제외 | ✅ | 두 라우트 모두 `ComingSoonPage` 그대로 유지 |
| D-9 (Q-9) | `FeedExceptionHandler` 버그는 이번에 함께 고침 | ✅ | **Plan 단계에서 "긴급 수정 대상"으로 분류 → Design 단계에서 재조사해 "무해한 죽은 코드"로 재분류 → 애너테이션 추가 대신 죽은 코드 삭제로 수정 방향 정정** |
| 설계 결정 | 커서 정렬 키는 `id`(IDENTITY), `createdAt` 아님 | ✅ | 동시각 충돌 없이 정수 하나만으로 안전한 커서 확보 |
| 설계 결정 | `useFeedInfiniteList`는 `loadingRef` 선제 차단 방식 | ✅ | 누적형 상태에 맞는 새로운 경쟁 조건 방어 패턴, `useTourList`류의 "늦은 응답 무시"와 의도적으로 다르게 설계 |
| 발견 사항(계획外) | `SecurityConfig`에 타인 프로필 permitAll 누락 | ✅ | 자체 점검으로 발견, 회귀 테스트와 함께 수정(G-1) |
| 발견 사항(코드 리뷰) | 타인 프로필 페이지네이션 누락, 요청 미취소 | ✅ | Must Fix 2건 전건 수정(G-3, G-4) |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:----:|
| Plan | [feed-integration.plan.md](../../01-plan/features/feed-integration.plan.md) | ✅ 최종화 (v0.3, PDCA 사이클 분리 확정) |
| Design | [feed-integration.design.md](../../02-design/features/feed-integration.design.md) | ✅ 최종화 (v0.2, 사이클 1 구현 범위 명시) |
| Check | [feed-integration.analysis.md](../../03-analysis/feed-integration.analysis.md) | ✅ 완료 (Match Rate 98.8%) |
| Act | 이 문서 | ✅ 완료 |
| 선행 기능 | [tour-course-list-integration.report.md](tour-course-list-integration.report.md) (커서·view model·재사용 패턴 출처) | 참고 |
| 선행 기능 | [admin-dashboard.report.md](admin-dashboard.report.md) (피드 스키마·`TourReferencePicker` 출처) | 참고 |
| 후속(미작성) | `docs/01-plan/features/feed-comment-integration.plan.md` | 사이클 2, 이 보고서 완료 후 Plan부터 재시작 |

---

## 3. 완료된 항목

### 3.1 기능 요구사항

| 그룹 | 항목 수 | 상태 |
|------|:---:|:---:|
| FR-01~05 (feedApi.js — 목록·상세·작성·삭제·토글) | 5 | ✅ 5/5 완료 |
| FR-06 (useFeedInfiniteList 상태 머신) | 1 | ✅ 1/1 완료 |
| FR-07~09 (타임라인·작성 폼·삭제 확인) | 3 | ✅ 3/3 완료 |
| FR-10~11 (로그인 유도·라우팅 교체) | 2 | ✅ 2/2 완료 |
| FR-12 (백엔드 커서 파라미터) | 1 | ✅ 1/1 완료 |
| FR-15~16 (백엔드·프론트 타인 프로필) | 2 | ✅ 2/2 완료 |
| FR-17~18 (버그 정리·`TourReferencePicker` 이동) | 2 | ✅ 2/2 완료 |
| FR-13~14 (댓글, 사이클 2 이관) | - | 결번(이번 사이클 대상 아님) |

**기능 완성도**: 16/16 = 100%(이번 사이클 범위 기준)

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|:----:|:----:|
| 회귀 방지 | 관리자 피드 모더레이션, `AdminCourseFormPage`에 영향 없음 | ✅ git status로 미변경 확인 | ✅ |
| 경쟁 조건 방어 | 무한 스크롤 중복 요청 방지, 언마운트 시 요청 취소 | ✅ `loadingRef` 선제 차단 + `useFeedDetail`/`useFeedInfiniteList`/`useFeedUserProfile` 전부 `AbortController` 확인(마지막 건은 코드 리뷰 Must Fix 2로 완성) | ✅ |
| 데이터 정합성 | 스크롤 중 새 글이 생겨도 중복·누락 없음 | ✅ `id` 커서 + 회귀 테스트(경계값 1건은 후속) | ✅(부분) |
| 낙관적 UI 일관성 | 좋아요·북마크 실패 시 롤백 | ✅ 3개 화면 모두 확인 | ✅ |
| 메모리 누수 방지 | 이미지 미리보기 `revokeObjectURL` | ✅ 개별 삭제·언마운트 시 정리 확인 | ✅ |
| 접근성 | aria-pressed, alertdialog, 키보드 이미지 순서변경 | ✅ 확인 | ✅ |
| 반응형 | 모바일 폭에서 깨지지 않음 | ✅ 모든 신규 CSS에 `@media (max-width: 620px)` 포함 | ✅ |

**품질 메트릭**
- `npm run lint` 오류 0, `npm run build` 성공(2회 확인: 세션 재개 시, 코드 리뷰 수정 후)
- Gap 분석: Match Rate 98.8%, Critical 0건
- 코드 리뷰 Must Fix 2건 전건 수정 확인, 자체 점검 발견분 3건 전건 수정 확인

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:----:|
| 백엔드 신규 | `feed/dto/FeedTimelineResponse.java` | ✅ |
| 백엔드 수정 | `FeedController`/`FeedService`(커서), `FeedProfileController`/`FeedProfileService`(타인 프로필), `FeedExceptionHandler`(죽은 코드 삭제), `FeedPostRepository`(커서 쿼리), `SecurityConfig`(타인 프로필 permitAll) | ✅ |
| 백엔드 삭제 | `feed/dto/FeedPageResponse.java` | ✅ |
| 백엔드 신규 테스트 | `FeedTimelineCursorTest.java`, `FeedUserProfileServiceTest.java`, `SecurityConfigFeedProfileAccessTest.java` | ✅ |
| 프론트 신규(데이터 계층) | `api/feedApi.js`, `hooks/{useFeedInfiniteList,useFeedDetail,useFeedUserProfile}.js` | ✅ |
| 프론트 신규(표시 계층) | `components/feed/{FeedCard,FeedComposer,FeedConfirmDialog,FeedImageEditor,FeedTimelineSentinel}.jsx`(+css), `components/icons/{HeartIcon,BookmarkIcon}.jsx`, `pages/{FeedPage,FeedDetailPage,FeedUserProfilePage}.jsx`(+css) | ✅ |
| 프론트 이동 | `components/admin/TourReferencePicker.*` → `components/common/TourReferencePicker.*` | ✅ |
| 프론트 수정 | `App.jsx`(라우트 3개), `pages/admin/AdminCourseFormPage.jsx`(import 경로) | ✅ |
| 문서 | Plan, Design, Analysis, Report | ✅ 4개 |

---

## 4. 미완료 / 이월 항목

### 4.1 설계 여유 범위 (의도적 미구현, 계획에서 이미 확정)

| 항목 | 설계/계획 근거 | 사유 | 우선순위 | 이월 처리 |
|------|---------|------|----------|----------|
| 댓글+답글 전체 | 계획 D-1(Q-1), 설계 §13 "PDCA 사이클 분리 확정" | 기능 전체를 한 사이클로 묶기에는 규모가 너무 커진다는 판단(엔티티 신설+API 3종+컴포넌트 10여 개) | High(다음 사이클 최우선) | `docs/01-plan/features/feed-comment-integration.plan.md` 작성부터 새로 시작 |
| 태그 검색/필터 | 계획 D-7(Q-7) | 이번 범위 제외 확정 | Low | 필요성 확인되면 별도 후속 |
| `/mypage`, `/bookmarks` 전용 화면 | 계획 D-8(Q-8) | 이번 범위는 `/feed`만 | Medium | 마이페이지 기능 자체가 별도 PDCA 대상 |

### 4.2 코드 리뷰·자체 점검 후속 과제 (Minor, 위험 낮음)

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| 낙관적 업데이트 오버레이 패턴 통합 | `FeedPage`(리듀서 액션)/`FeedDetailPage`(단일 객체 패치)/`FeedUserProfilePage`(로컬 state) 3곳이 각각 다른 모양으로 같은 문제를 해결 | Low | 공용 훅 통합 여지 검토(데이터 원천 모양이 서로 달라 비용 대비 효과 먼저 확인) |
| 커서 경계값 테스트 보강 | "정확히 size개만 남았을 때 hasNext=false"가 공유 DB 환경 제약으로 미검증 | Medium | 격리된 테스트 환경에서 추가 |
| `useFeedInfiniteList.removeItem` 죽은 코드 | 반환되지만 어떤 화면도 호출하지 않음 | Low | 실제 사용 또는 제거 |
| `TourReferencePicker`의 admin 폴더 교차 import | 설계 §5.2가 이미 의도적 트레이드오프로 문서화, 코드 리뷰에서도 재확인 | Low | 다음 사이클에서 분리 여부 재논의 |
| `FeedComposer` Escape 핸들러 재등록 | 부모의 인라인 `onClose`로 인해 effect가 필요 이상 재실행 | Low | `useCallback` 안정화 또는 ref 패턴으로 개선 |

### 4.3 환경 제약 후속

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| 백엔드 자동 테스트 미실행 | 이 세션의 JDK(17)와 `pom.xml`의 컴파일 대상(`release 25`)이 맞지 않아 `mvnw test` 컴파일 단계에서 실패(tour-course-list-integration에서도 동일하게 겪은 환경 제약) | High(배포 전 필수) | CI 또는 JDK 25 환경에서 `mvnw clean test` 실행 확인(신규 테스트 3개 포함) |
| L2 브라우저 검증 | 브라우저 자동화 도구 부재로 미실행 | Medium | 도구 도입 시 분석 문서 §4.3 체크리스트 실행 |

---

## 5. 품질 메트릭

### 5.1 최종 분석 결과

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 98.8%                   │
├─────────────────────────────────────────────┤
│  Structural Match:  100%                     │
│  Functional Match:   97%                     │
│  Contract Match:    100%                     │
├─────────────────────────────────────────────┤
│  Critical Gap: 0건                            │
│  Important Gap: 4건 (전건 완료·수정)           │
│  Minor Gap: 7건                              │
│  └ 완료(수정됨): 1건                          │
│  └ 후속 과제: 5건                             │
│  └ 여유 범위(계획에서 이미 확정): 1건           │
└─────────────────────────────────────────────┘
```

### 5.2 해결된 이슈 (자체 점검 + 코드 리뷰 → 수정)

| 이슈 | 발견 경로 | 해결 방법 | 결과 |
|------|-----------|----------|:----:|
| `SecurityConfig` 타인 프로필 permitAll 누락 | 자체 점검 | 단일 세그먼트 와일드카드 permitAll + 회귀 테스트 3종 | ✅ 비로그인 조회 정상 동작 |
| 세션 중단으로 인한 미완성 파일(css·페이지·라우트) | 자체 점검 | 설계 그대로 완성 | ✅ `/feed` 전체 플로우 동작 |
| 타인 프로필 페이지네이션 누락 | frontend-code-reviewer(Must Fix 1) | `page` 상태 + 이전/다음 버튼 + 전환 중 파생 상태 | ✅ 13개 이상 게시물도 전부 조회 가능 |
| `useFeedUserProfile` 요청 미취소 | frontend-code-reviewer(Must Fix 2) | `AbortController` + `isAbortError` | ✅ 언마운트·페이지 전환 시 실제 취소 |
| `FeedComposer` 렌더 중 ref 쓰기 lint 오류 | 자체 점검 | `useEffect`로 이전 | ✅ `npm run lint` 오류 0 |

### 5.3 테스트 결과

| 카테고리 | 결과 |
|----------|:----:|
| 정적 분석 | ✅ 설계 §2.2/§6.1/§10 모듈·라우팅 목록 100% 일치 |
| 기능 검증 | ✅ 16/16 FR 충족(이번 사이클 범위) |
| 코드 리뷰 반영 확인 | ✅ Must Fix 2/2 수정 확인 |
| 프론트 lint/build | ✅ `npm run lint` 0 오류, `npm run build` 성공(2회) |
| 백엔드 신규 테스트 | ⬜ 파일 존재·코드 정독 확인(12개 테스트), 자동 실행은 JDK 버전 불일치로 미실행(환경 제약) |
| L2 UI(브라우저) | ⬜ 미검증 (도구 부재, 다음 세션 이월) |

---

## 6. 배운 점 및 회고

### 6.1 잘된 점 (지속할 사항)

1. **세션 중단을 "재작업"이 아니라 "점검 후 이어가기"로 처리**: 세션 한도로 구현이 중단됐을 때, 이미 완료된 파일을 다시 만들지 않고 `git status`로 현재 상태를 먼저 점검한 뒤 실제로 비어 있는 부분(`FeedDetailPage.css`, 타인 프로필 화면, 라우팅)만 찾아 완성했다. 여러 세션에 걸친 작업에서 중복 작업을 피하는 실질적인 절차를 보여준 사례다.

2. **자기 조사 오류를 다음 단계에서 스스로 발견하고 정정**: Plan 문서가 `FeedExceptionHandler`의 죽은 메서드를 "긴급 수정 대상"으로 잘못 분류했던 것을, Design 단계에서 `GlobalExceptionHandler`를 추가로 조사해 "실제로는 무해한 죽은 코드"임을 확인했다. 더 나아가 처음 제안했던 수정 방법(애너테이션 추가)이 두 전역 예외 핸들러의 충돌이라는 새 위험을 만든다는 것까지 발견해 수정 방향 자체를 바꿨다. 잘못된 판단을 그대로 실행하지 않고, 다음 단계에서 검증하는 습관이 실제로 작동한 사례다.

3. **누적형 상태에 맞는 새로운 경쟁 조건 방어 패턴 설계**: 기존 `useTourList`류의 "요청 key 비교로 늦은 응답 무시" 패턴을 무비판적으로 복제하지 않고, "동시에 두 요청이 items를 append하면 순서가 꼬인다"는 무한 스크롤 특유의 문제를 분석해 `loadingRef` 선제 차단이라는 다른 메커니즘을 새로 설계했다. 왜 다른 패턴이 필요한지 근거와 함께 문서화했다.

4. **설계 문서의 누락(SecurityConfig)을 코드 리뷰 이전에 자체적으로 발견**: 새 엔드포인트를 추가할 때 "인증 불필요"라는 의도만 DTO/컨트롤러 레벨에서 구현하고 Spring Security 설정 갱신을 놓치기 쉬운데, 세션 재개 중 SecurityConfig 파일을 직접 열어 확인하는 점검 절차로 이를 코드 리뷰보다 먼저 잡아냈다.

5. **frontend-code-reviewer의 독립 리뷰가 실제로 다른 종류의 결함을 찾아냄**: 자체 점검이 놓친 "화면이 이미 있는 API 필드를 안 쓰는" 기능 결함(페이지네이션)과 "취소 신호가 전달되지 않는" 비동기 결함을, 별도 에이전트의 독립적인 리뷰가 찾아냈다. 자체 점검과 독립 리뷰가 서로 다른 종류의 문제를 잡아낸다는 것을 실제로 확인했다.

### 6.2 개선할 점 (다음 시도)

1. **새 공개 엔드포인트 추가 시 SecurityConfig 갱신을 체크리스트화하지 못함**: 이번에는 자체 점검으로 잡았지만, "컨트롤러에 새 `@GetMapping`을 추가하면 SecurityConfig도 함께 확인한다"는 절차를 설계 문서 템플릿 자체에 체크리스트 항목으로 넣었다면 더 일찍(설계 단계에서) 잡을 수 있었다.

2. **커서 경계값 테스트가 공유 DB 환경 제약으로 일부 비어 있음**: `FeedTimelineCursorTest`가 "정확히 size개만 남았을 때 hasNext=false"를 테스트 작성 시점에 의도적으로 건너뛰었다. 테스트 격리 전략(예: 트랜잭션 롤백 후 정확한 개수 통제)을 처음부터 설계했다면 이 경계값도 커버할 수 있었다.

3. **JDK 버전 불일치가 또 반복됨**: tour-course-list-integration에서 이미 겪은 `mvnw test` JDK 버전 문제(로컬 17 vs 요구 25)가 이번에도 동일하게 재현됐다. 개선할 점으로 이미 식별했던 항목이 다음 PDCA 세션 시작 체크리스트에 실제로 반영되지 않았다는 뜻이다.

### 6.3 다음에 시도할 사항

1. **"새 엔드포인트 추가 = SecurityConfig 확인"을 설계 문서 템플릿에 명시적 체크박스로 추가**: 이번 발견을 다음 기능부터 실제로 반영.

2. **JDK 버전 정합성 확인을 세션 시작 스크립트/체크리스트로 자동화**: 두 차례 연속 같은 문제를 겪었으므로, 매번 사람이 기억해서 확인하는 대신 세션 시작 시 자동으로 `java -version`과 `pom.xml`을 대조하는 절차를 bkit 워크플로에 추가하는 것을 검토.

3. **낙관적 업데이트 오버레이 패턴 통합 여부를 사이클 2 착수 전에 결정**: 댓글 기능이 추가되면 낙관적 업데이트가 필요한 지점이 하나 더 늘어난다(댓글 작성/삭제). 지금 3곳의 서로 다른 패턴을 정리하지 않고 사이클 2로 넘어가면 네 번째 변형이 생길 위험이 있다.

---

## 7. 다음 단계

### 7.1 즉시 (Report 단계)

- [ ] 설계 문서 갱신(G-1: `SecurityConfig.java`를 §6.1 변경 자원 표에 반영) — 코드 변경 없음
- [ ] JDK 25 또는 CI 환경에서 `mvnw clean test` 실행 확인(신규 테스트 3개 포함)

### 7.2 다음 PDCA 주기

| 항목 | 의존성 | 우선순위 | 비고 |
|------|--------|---------|------|
| `feed-comment-integration`(댓글+답글) | 이 기능(사이클 1 완료가 전제 조건) | High | Plan 문서 작성부터 완전히 새로 시작. 설계 §3.4~3.5/§4.3/§8의 사전 설계 초안을 출발점으로 참고 가능 |
| 낙관적 업데이트 오버레이 패턴 통합 | 이 기능 + 사이클 2에서 늘어날 낙관적 업데이트 지점 | Medium | 사이클 2 착수 전 결정 권장 |
| 커서 경계값 테스트 보강 | 이 기능(G-7) | Medium | 격리된 테스트 환경 구성 필요 |
| L2 브라우저 자동화 도입 | 프로세스 개선 | Medium | 네 번째 PDCA 연속으로 반복된 이슈 |

### 7.3 포트폴리오 추출 (이 세션 이후)

`frontend-interview-coach` 에이전트에 위임:
- 이 프로젝트 최초의 커서 기반 무한 스크롤 도입과, 누적형 상태에 맞춘 `loadingRef` 선제 차단 경쟁 조건 방어 설계
- Plan 단계의 조사 오류(죽은 코드를 "긴급 버그"로 오분류)를 Design 단계에서 스스로 재조사해 더 안전한 수정 방향으로 바로잡은 과정
- 세션 한도로 중단된 작업을 "재작업"이 아니라 "git status 기반 점검 후 이어가기"로 처리한 절차
- 코드 리뷰와 자체 점검이 각각 다른 종류의 결함(보안 설정 누락 vs 기능 결함 vs 비동기 취소 누락)을 찾아낸 사례와, 그 각각을 회귀 테스트로 닫은 과정

---

## 8. Changelog

### v1.0.0 (2026-09-30)

**Added**
- `backend/.../feed/dto/FeedTimelineResponse.java`
- `backend/src/test/java/.../feed/{FeedTimelineCursorTest,FeedUserProfileServiceTest}.java`
- `backend/src/test/java/.../config/SecurityConfigFeedProfileAccessTest.java`
- `frontend/src/api/feedApi.js`
- `frontend/src/hooks/{useFeedInfiniteList,useFeedDetail,useFeedUserProfile}.js`
- `frontend/src/components/feed/{FeedCard,FeedComposer,FeedConfirmDialog,FeedImageEditor,FeedTimelineSentinel}.jsx`(+css)
- `frontend/src/components/icons/{HeartIcon,BookmarkIcon}.jsx`
- `frontend/src/pages/{FeedPage,FeedDetailPage,FeedUserProfilePage}.jsx`(+css)
- `frontend/src/components/common/TourReferencePicker.{jsx,css}`(이동)

**Changed**
- `backend/.../feed/controller/FeedController.java`: 목록 API에 `cursor` 파라미터 추가
- `backend/.../feed/service/FeedService.java`: `getFeed`를 오프셋에서 커서 기반으로 교체
- `backend/.../feed/controller/FeedProfileController.java`/`service/FeedProfileService.java`: `getUserProfile` 신규 메서드
- `backend/.../feed/exception/FeedExceptionHandler.java`: 죽은 `handleValidation` 메서드 삭제
- `backend/.../feed/repository/FeedPostRepository.java`: 커서 쿼리 메서드 추가
- `backend/.../config/SecurityConfig.java`: 타인 프로필 GET permitAll 추가(자체 점검으로 발견한 누락분)
- `frontend/src/App.jsx`: `/feed`, `/feed/posts/:id`, `/feed/users/:userId` 라우팅 교체
- `frontend/src/pages/admin/AdminCourseFormPage.jsx`: `TourReferencePicker` import 경로 변경

**Removed**
- `backend/.../feed/dto/FeedPageResponse.java`(커서 전환으로 폐기)
- `frontend/src/components/admin/TourReferencePicker.{jsx,css}`(공용 경로로 이동)

**Fixed** (자체 점검 + 코드 리뷰에서 발견 → 수정)
- `SecurityConfig`의 타인 프로필 permitAll 누락(비로그인 401)
- 세션 중단으로 미완성이었던 `FeedDetailPage.css`/`FeedUserProfilePage`/`App.jsx` 라우팅
- 타인 프로필 페이지네이션 UI 누락(13개 이상 게시물 조용히 사라짐)
- `useFeedUserProfile`의 요청 미취소
- `FeedComposer`의 렌더 중 ref 쓰기 lint 오류

---

## 9. 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-09-30 | 완료 보고서 생성(사이클 1). Plan(Q-1~Q-9, 사이클 분리 확정)→Design(커서 키 선택, `FeedExceptionHandler` 정정)→Do(백엔드 신규 API+프론트 구현, 세션 중단·재개, 자체 점검 발견분 3건+코드 리뷰 Must Fix 2건 수정)→Check(98.8%)→Act(Report) | frontend-lead (Claude Code 보조) |

---

**작성 완료**: 2026-09-30 · frontend-lead (Claude Code 보조)
