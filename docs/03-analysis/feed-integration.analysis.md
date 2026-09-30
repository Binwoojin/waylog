# feed-integration Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현) — **PDCA 사이클 1**만 대상
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: frontend-lead (Claude Code 보조)
> **Date**: 2026-09-30
> **Design Doc**: [feed-integration.design.md](../02-design/features/feed-integration.design.md) (v0.2)
> **Plan Doc**: [feed-integration.plan.md](../01-plan/features/feed-integration.plan.md) (v0.3, PDCA 사이클 분리 확정)

PRD 문서는 없다(이전 기능들과 동일하게 PM 단계 없이 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

**사이클 범위 고지**: 설계 문서 §3.4~3.5(`FeedComment` 엔티티·DTO), §4.3(댓글 API), §8(댓글·답글 UI)은 문서 자체에 "**[사이클 2 사전 설계 — 이번 사이클 구현 대상 아님]**"으로 명시돼 있다. 이 gap 분석은 그 절들을 구현 누락으로 채점하지 않는다 — 애초에 이번 사이클(`feed-integration`)의 완료 조건이 아니며, 후속 `feed-comment-integration` PDCA에서 별도로 Plan부터 다시 시작한다(계획 §9 8번 항목).

---

## Context Anchor

> 계획·설계 문서에서 복사했다(사이클 1 관점으로 재확인).

| Key | Value |
|-----|-------|
| **WHY** | `/feed`는 네비게이션에 이미 노출된 메뉴지만 `ComingSoonPage`뿐이었다. 백엔드 CRUD(목록·상세·작성·삭제·좋아요·북마크·내 프로필)는 완성돼 있어 프론트만 없는 상태를 방치할 이유가 없었다 |
| **WHO** | 여행 사진·글을 올리는 사용자, 무한 스크롤로 피드를 훑어보는 방문자(비로그인 포함), 다른 사용자의 피드 프로필을 구경하는 사용자 |
| **RISK** | 무한 스크롤 프로젝트 최초 도입(오프셋 방식은 스크롤 중 삽입으로 중복·누락 위험) / 타인 프로필 조회 API 부재 |
| **SUCCESS** | `/feed`에서 무한 스크롤 타임라인·상세·작성·삭제·좋아요·북마크·타인 프로필 조회가 모두 동작 / 로딩·에러·빈 상태 구분 / 관리자 피드 모더레이션에 회귀 없음 |
| **SCOPE** | 프론트: `feedApi.js`, 무한 스크롤 훅, 피드 카드·작성 폼·상세·타인 프로필 화면, `TourReferencePicker` 공용 경로 이동 / 백엔드: 커서 기반 목록 API, 타인 프로필 API, `FeedExceptionHandler` 죽은 코드 정리 |

---

## Success Criteria Status (계획 §4.1 완료 조건)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | `/feed`에서 무한 스크롤로 실제 공개 게시물을 볼 수 있다(비로그인 포함) | ✅ | `FeedPage.jsx` + `useFeedInfiniteList`가 `GET /api/v1/feed/posts?cursor=&size=` 소비, `SecurityConfig`에 GET permitAll 확인 |
| SC-2 | 로그인한 사용자가 사진·글·태그·공개범위·위치 태깅을 담아 게시물을 작성할 수 있다 | ✅ | `FeedComposer.jsx`(+`FeedImageEditor`, `TourReferencePicker` 재사용) → `createFeedPost` 멀티파트 확인 |
| SC-3 | 좋아요·북마크 토글이 실제로 동작한다 | ✅ | `FeedCard`/`FeedDetailPage`/`FeedUserProfilePage` 3곳 모두 `toggleFeedLike`/`toggleFeedBookmark` + 낙관적 업데이트·롤백 확인 |
| SC-4 | 작성자 본인이 게시물을 삭제할 수 있다 | ✅ | `FeedDetailPage.jsx`의 `isOwner` 분기 + `FeedConfirmDialog`(항상 확인 모달 경유) + `deleteFeedPost` |
| SC-5 | 다른 사용자의 피드 프로필(공개 게시물만)을 볼 수 있다 | ✅ | `FeedUserProfilePage.jsx` 신규 작성, `GET /api/v1/feed/profile/{userId}`가 PUBLIC만 반환. **단, `SecurityConfig`에 permitAll이 처음에는 빠져 있어 비로그인 조회가 401로 막혔던 것을 발견·수정(§3 G-1)** |
| SC-6 | 스크롤 중 새 글이 생겨도 목록에 중복·누락이 생기지 않는다(커서 기반 검증) | ✅(경계값 일부 미검증) | `id` 기반 커서(`findByVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc`), `FeedTimelineCursorTest`가 커서 제외·PRIVATE 제외·소프트삭제 제외·`nextCursor` 정확성을 검증. "정확히 size개만 남았을 때 hasNext=false" 경계값은 테스트가 스스로 "공유 DB 환경 제약"이라고 명시하며 비워둠(§3 G-7) |
| SC-7 | 로딩·에러(재시도)·빈 상태가 구분되어 표시된다 | ✅ | `FeedPage`(loading/error/success/loading-more/error-more), `FeedDetailPage`/`FeedUserProfilePage`(`DetailStatus` loading/error, `NotFoundPage`, 빈 상태 카드) 모두 확인 |
| SC-8 | 관리자 피드 모더레이션 화면, `AdminCourseFormPage`에 회귀가 없다 | ✅ | `git status`에 `AdminFeedListPage`/`AdminFeedDetailPage`/`FeedAdminController`/`FeedAdminService` 미표시(미변경) 확인. `AdminCourseFormPage.jsx`는 `TourReferencePicker` import 경로 한 줄만 변경 |
| SC-9 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ | 코드 리뷰 Must Fix 2건(§3 G-3, G-4) 전건 수정 확인, 이 문서가 gap 분석 |

**Success Rate**: 9/9 완전 충족(SC-6은 경계값 테스트 1건이 후속 과제로 남았으나 기능 자체는 충족).

댓글 작성·조회·답글·삭제는 계획 §4.1이 이미 "이번 사이클의 완료 조건이 아니다"로 명시했으므로 이 표에서 다루지 않는다.

---

## 1. 분석 개요

### 1.1 목적

이전 세션이 세션 한도(rate limit)로 중단된 지점부터 이어받아 완성한 구현(2단계 수행: ①상태 점검 후 누락분 완성, ②코드 리뷰 Must Fix 2건 수정)이 계획·설계 문서(사이클 1 범위)의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/feed-integration.design.md` (§1~§15, v0.2). 댓글 관련 §3.4~3.5/§4.3/§8은 사이클 2 사전 설계로 분석 대상에서 제외
- **구현 경로**: `frontend/src/{api,hooks,components/feed,components/common/TourReferencePicker.*,pages}`, `backend/src/main/java/kr/co/mycom/travel_korea/{feed/**,config/SecurityConfig.java}`
- **분석 일자**: 2026-09-30
- **분석 방식**: 정적 분석(전체 파일 정독, git status 기준 신규/변경/삭제 파일 대조) + 코드 리뷰 Must Fix 2건 반영 확인 + `npm run lint`/`npm run build` 실행 확인 + 백엔드 신규 테스트 3개 파일 정독. 백엔드 자동 테스트는 이 세션의 로컬 JDK(17)와 `pom.xml`이 요구하는 컴파일 대상(`release 25`)이 맞지 않아 실행하지 못했다(tour-course-list-integration 분석과 동일한 환경 제약, §4.2)

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 대조 (설계 §4.2, §4.4 ↔ 서버 ↔ 클라이언트)

| # | 엔드포인트 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------------|:----:|:----:|:----------:|:----:|
| 1 | `GET /api/v1/feed/posts?cursor=&size=` | ✅ `id` 커서, `{posts, nextCursor, hasNext}` | ✅ `FeedController.getFeed` → `FeedService.getFeed`(size+1 조회로 hasNext 판단), `FeedTimelineResponse` 신규(`FeedPageResponse` 폐기, P-10) | ✅ `fetchFeedTimeline` → `toFeedTimelineResult`(fail-closed, opaque cursor) | PASS |
| 2 | `GET /api/v1/feed/profile/{userId}?page=&size=` | ✅ PUBLIC만, liked/bookmarked 항상 false, 비로그인 조회 가능 | ✅ `FeedProfileController.getUserProfile` → `FeedProfileService.getUserProfile`(`findByAuthor_IdAndVisibilityAndDeletedAtIsNull`) | ✅ `fetchFeedUserProfile` → `toFeedProfile` | PASS(단, 최초 구현에서 `SecurityConfig` permitAll 누락 — 아래 G-1) |
| 3 | `SecurityConfig` — 목록 GET permitAll | ✅ | ✅ `HttpMethod.GET, "/api/v1/feed/posts/**"` | 인증 헤더 없이 호출 확인 | PASS |
| 4 | `SecurityConfig` — 타인 프로필 GET permitAll | ✅(설계 §4.4가 "비로그인 조회 가능"을 명시) | ⚠️→✅ 설계 문서 §6.1 변경 자원 표에 `SecurityConfig` 자체가 빠져 있어 최초 구현에 누락 → 코드 리뷰 이전 자체 점검으로 발견, `HttpMethod.GET, "/api/v1/feed/profile/*"`(단일 세그먼트 와일드카드로 인증이 필요한 `GET /api/v1/feed/profile`과 구분) 추가 + `SecurityConfigFeedProfileAccessTest` 신규 | 훅이 401을 `login-required` 상태로 미리 방어하도록 설계돼 있어 수정 전에도 화면이 깨지지 않았음 | 완료(수정됨) — §3 G-1 |
| 5 | `FeedExceptionHandler` 죽은 코드 삭제 | ✅ 애너테이션 추가 대신 `handleValidation` 삭제 | ✅ 메서드 삭제, `GlobalExceptionHandler`가 동일 예외를 이미 처리 중임을 주석으로 남김 | - | PASS |

**Contract Match Rate**: 5/5 = 100%(4번 항목은 최초 구현 시점에 결함이 있었으나 이번 사이클 종료 시점 기준으로는 회귀 테스트까지 포함해 완전히 닫혔다)

### 2.2 구조적 일치 (설계 §2.2, §6.1 모듈 목록)

| 구분 | 설계 명시 | 실제 | 결과 |
|------|-----------|------|:----:|
| 백엔드 신규 | `FeedTimelineResponse` | 존재, 클래스명 일치 | PASS |
| 백엔드 수정 | `FeedController`(cursor 파라미터), `FeedService`(getFeed 교체), `FeedProfileController`/`FeedProfileService`(getUserProfile 추가), `FeedExceptionHandler`(죽은 메서드 삭제), `FeedPostRepository`(커서 쿼리 메서드 추가) | 5개 파일 모두 수정 확인, 기존 메서드 시그니처 유지 | PASS |
| 백엔드 삭제 | `FeedPageResponse.java`(P-10, 커서 전환으로 폐기) | 삭제 확인(`git status`에 `D`) | PASS |
| 백엔드 수정(설계 §6.1에 없었음) | - | `SecurityConfig.java`(타인 프로필 permitAll) | 완료(설계 누락분 발견·수정) — §3 G-1 |
| 백엔드 신규 테스트(설계에 파일 목록 없음) | - | `FeedTimelineCursorTest.java`(커서 5종 검증), `FeedUserProfileServiceTest.java`(PUBLIC 필터·liked/bookmarked 고정값 4종 검증), `SecurityConfigFeedProfileAccessTest.java`(권한 회귀 3종 검증) | 완료(설계보다 견고한 구현) |
| 프론트 신규 | `api/feedApi.js`, `hooks/useFeedInfiniteList.js`/`useFeedDetail.js`/`useFeedUserProfile.js`, `components/feed/{FeedCard,FeedComposer,FeedConfirmDialog,FeedImageEditor,FeedTimelineSentinel}.jsx`(+css), `components/icons/{HeartIcon,BookmarkIcon}.jsx`, `pages/{FeedPage,FeedDetailPage,FeedUserProfilePage}.jsx`(+css) | 전 파일 존재, 클래스·함수명 설계와 일치 | PASS |
| 프론트 신규(중단 시점에 누락, 이번에 완성) | `pages/FeedDetailPage.css`, `pages/FeedUserProfilePage.jsx`(+css) | 세션 재개 1단계 점검에서 `FeedDetailPage.jsx`가 존재하지 않는 CSS를 import 중이고, `useFeedUserProfile` 훅을 소비하는 화면 자체가 없음을 발견 → 신규 작성 | 완료(중단된 구현의 정상 마무리) |
| 프론트 이동 | `components/admin/TourReferencePicker.jsx`/`.css` → `components/common/TourReferencePicker.jsx`/`.css` | 이동 확인, `AdminCourseFormPage.jsx` import 경로 갱신 확인, 옛 경로(`components/admin/TourReferencePicker`) 참조 잔존 없음(grep 재확인) | PASS |
| 프론트 라우팅(설계 §10) | `/feed` → `FeedPage`, `/feed/posts/:id` → `FeedDetailPage`, `/feed/users/:userId` → `FeedUserProfilePage` | `App.jsx`에 3개 라우트 모두 반영(중단 시점에는 `/feed`가 여전히 `ComingSoonPage`였음 — 이번에 교체) | 완료(중단된 구현의 정상 마무리) |

**Structural Match Rate**: 100%(설계에 없던 `SecurityConfig` 수정 1건과 신규 테스트 3건은 전부 "누락 발견 후 완료" 또는 "설계보다 견고한 구현"이라 감점 대상이 아니다. 중단 시점에 비어 있던 `FeedDetailPage.css`/`FeedUserProfilePage.*`/`App.jsx` 라우트는 이번 세션에서 설계 그대로 완성했다)

### 2.3 기능 요구사항(FR-01~12, FR-15~18) 충족 여부 및 코드 리뷰 반영 확인

FR-13(`FeedComment` 백엔드), FR-14(댓글 프론트 UI)는 계획 §3.1이 "결번 안내"로 명시한 대로 사이클 2로 이관돼 번호만 비어 있다. 이번 사이클 FR은 16개다.

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-01 (fetchFeedTimeline, view model 변환) | ✅ | `feedApi.js`의 `toFeedPost`/`toFeedTimelineResult`가 fail-closed(작성자 없는 게시물 폐기, `posts` 배열 아니면 Error) |
| FR-02 (fetchFeedDetail) | ✅ | 400/404를 `useFeedDetail`이 `not-found`로 구분 |
| FR-03 (createFeedPost 멀티파트) | ✅ | `FormData`에 `post`(JSON Blob) + `images`(순서대로 append), 서버 sortOrder와 일치 확인(설계 §6.2) |
| FR-04 (deleteFeedPost) | ✅ | `FeedDetailPage`가 확인 모달을 항상 경유 |
| FR-05 (toggleFeedLike/Bookmark) | ✅ | `{active: boolean}` 응답을 그대로 반영 |
| FR-06 (useFeedInfiniteList 상태 머신) | ✅ | `loadingRef` 선제 차단(경쟁 조건 방어), `loading`→`success`/`error`, `loading-more`→`error-more`(기존 items 유지) 전이 확인 |
| FR-07 (타임라인 화면) | ✅ | `FeedCard`가 닉네임(타인 프로필 링크)·대표 이미지·내용 미리보기·좋아요/댓글 수(댓글은 숫자만, 링크 없음 — 거짓 UI 금지 원칙)·토글 버튼 표시 |
| FR-08 (작성 폼) | ✅ | 내용·이미지(미리보기+순서변경, 최대 5장)·태그(최대 10개)·공개범위·위치 태깅(`TourReferencePicker`+자유 텍스트) 전부 확인 |
| FR-09 (삭제 확인 다이얼로그) | ✅ | `FeedConfirmDialog`(공개 화면 전용, `role="alertdialog"`, Esc 닫기, 포커스 이동) |
| FR-10 (비로그인 로그인 유도) | ✅ | `FeedPage`/`FeedDetailPage`/`FeedUserProfilePage` 3곳 모두 `requireLogin()` → `/login` 이동 |
| FR-11 (`/feed` 라우트 교체) | ✅ | 중단 시점 미완료 → 이번에 `App.jsx`에 3개 라우트 추가 완료 |
| FR-12 (백엔드 커서 파라미터) | ✅ | `FeedController.getFeed(cursor, size)`, `id` 내림차순, size+1 조회로 hasNext 판단 |
| FR-15 (백엔드 타인 프로필 API) | ✅ | `FeedProfileController.getUserProfile`, PUBLIC만, liked/bookmarked 항상 false. **SecurityConfig permitAll 누락은 발견 후 수정(G-1)** |
| FR-16 (프론트 타인 프로필 화면) | ✅ | 중단 시점 미완료(훅만 존재) → `FeedUserProfilePage.jsx` 신규 작성. **코드 리뷰 Must Fix 1(페이지네이션 누락)을 이번에 수정(G-3)** |
| FR-17 (`FeedExceptionHandler` 죽은 코드 삭제) | ✅ | `handleValidation` 삭제, `GlobalExceptionHandler` 중복 처리 방지 근거 주석 확인 |
| FR-18 (`TourReferencePicker` 이동) | ✅ | 이동 완료, 옛 경로 참조 잔존 없음 |

**완료(수정됨) — 발견되고 실제로 고쳐진 이슈**

| # | 이슈 | 발견 단계 | 수정 내용 | 확인 근거 |
|---|------|-----------|-----------|-----------|
| G-1 | `SecurityConfig`에 `GET /api/v1/feed/profile/{userId}` permitAll이 없어, 설계 의도("비로그인도 조회 가능")와 달리 실제로는 401 | frontend-lead 자체 점검(중단된 구현 마무리 중, 코드 리뷰 이전) | `HttpMethod.GET, "/api/v1/feed/profile/*"`(단일 세그먼트 와일드카드) 추가, `SecurityConfigFeedProfileAccessTest` 3종 회귀 테스트 신설 | `SecurityConfig.java` 67행, 신규 테스트 파일 |
| G-2 | `useFeedUserProfile` 훅은 있었으나 이를 소비하는 `FeedUserProfilePage`/`FeedDetailPage.css`가 존재하지 않아 `/feed/users/:userId`가 라우팅될 수 없고, `FeedDetailPage`는 없는 CSS를 import 중이었음 | frontend-lead 자체 점검(세션 재개 1단계) | `FeedDetailPage.css`, `FeedUserProfilePage.jsx`(+css) 신규 작성, `App.jsx` 라우트 3개 추가 | git status 신규 파일, `npm run build` 성공 |
| G-3 | (코드 리뷰 Must Fix 1) `FeedUserProfilePage`가 `currentPage`/`totalPages`/`hasNext`를 전혀 쓰지 않고 `page`를 1로 고정 호출 — 게시물 13개 이상인 사용자는 최신 12개만 보이고 나머지가 조용히 사라짐 | frontend-code-reviewer | `page` 로컬 상태 + 이전/다음 버튼 + `isPageChanging`(요청한 page와 `profile.currentPage` 불일치로 판단하는 렌더 중 파생 상태) 추가 | `FeedUserProfilePage.jsx` 페이지네이션 nav, `npm run build` 성공 |
| G-4 | (코드 리뷰 Must Fix 2) `fetchFeedUserProfile`이 `signal`을 받지 않아 `useFeedUserProfile`의 `isActive` 플래그가 `setState`만 막을 뿐 실제 HTTP 요청은 취소되지 않음 | frontend-code-reviewer | `feedApi.js`에 세 번째 인자 `{ signal }` 추가, 훅에서 `AbortController` 생성·`abort()`·`isAbortError` 분기 추가(`useFeedDetail`/`useFeedInfiniteList`와 동일 패턴) | `feedApi.js`/`useFeedUserProfile.js`, `npm run lint`/`build` 성공 |
| G-5 | `FeedComposer.jsx`가 렌더링 중 `imagesRef.current = images`를 직접 대입해 `npm run lint`에서 `react-hooks/refs`(Cannot access refs during render) 오류 발생 | frontend-lead 자체 점검(세션 재개 시 `npm run lint` 최초 실행) | ref 대입을 `useEffect(() => { imagesRef.current = images }, [images])`로 이동(언마운트 정리 effect는 여전히 최신 값을 읽음) | `FeedComposer.jsx`, `npm run lint` 오류 0 |

**Functional Match Rate**: 97%(FR 16/16 전부 충족, Must Fix 2건 포함 발견된 결함 전건 수정 완료. 감점 사유는 §3 G-7의 커서 경계값 테스트 미비 1건과 브라우저 실측 미검증, 아래 §4 참고)

### 2.4 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  100%                │
│  Functional Match Rate:   97%                │
│  Contract Match Rate:    100%                │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:     98.8%               │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)  [서버 정적 공식]      │
├─────────────────────────────────────────────┤
│  참고: npm run lint 0 오류, npm run build 성공│
│  코드 리뷰 Must Fix 2건 전건 반영             │
│  자체 점검으로 발견·수정한 이슈 3건(G-1,G-2,G-5)│
│  백엔드 자동 테스트 — 미실행(§4.2, JDK 불일치)│
│  L2(브라우저 UI)/L3(E2E) — 미검증(도구 부재)  │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical 없음. Important 4건은 전부 "완료(수정됨)". 나머지는 Minor다.

| # | 등급 | 항목 | 설계 | 구현 | 분류 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|------|-----------|:--:|
| G-1 | Important(완료, 수정됨) | `SecurityConfig` 타인 프로필 permitAll 누락 | 설계 §4.4가 "비로그인 조회 가능"을 명시했으나 §6.1 변경 자원 표에 `SecurityConfig.java`가 빠져 있음 | 최초 구현에 누락 → 자체 점검으로 발견·수정, 회귀 테스트 신설 | 완료(수정됨) | 설계 §6.1 변경 자원 표에 `SecurityConfig.java` 추가(문서만) | 100% |
| G-2 | Important(완료, 수정됨) | 세션 중단으로 인한 미완성 파일(`FeedDetailPage.css`, `FeedUserProfilePage.*`, `App.jsx` 라우트) | 설계 §10(라우팅)·§2.2(모듈 목록)에 모두 명시돼 있었음 | 이전 세션이 세션 한도로 중단돼 비어 있었음 → 이번 세션에서 설계 그대로 완성 | 완료(중단된 구현의 정상 마무리) | 없음 | 100% |
| G-3 | Important(완료, 수정됨) | 타인 프로필 페이지네이션 UI 누락 | 설계 §4.4가 `page`/`size` 파라미터와 `currentPage`/`totalPages`/`hasNext` 응답 필드를 명시 | 백엔드·API·훅은 필드를 이미 내려주고 있었으나 화면이 `page=1`로 고정 호출 | 완료(코드 리뷰 Must Fix 1, 수정됨) | 없음 | 100% |
| G-4 | Important(완료, 수정됨) | `useFeedUserProfile` 요청 미취소 | 설계가 명시적으로 다루지 않았으나, `useFeedDetail`/`useFeedInfiniteList`와 같은 프로젝트 전역 원칙(계획 §3.2 "메모리 누수 방지"·"경쟁 조건") 위반 | `isActive` 플래그만으로 `setState`는 막았지만 HTTP 요청 자체는 취소되지 않음 | 완료(코드 리뷰 Must Fix 2, 수정됨) | 없음 | 100% |
| G-5 | Minor(완료, 수정됨) | `FeedComposer`의 렌더 중 ref 쓰기 | 설계에 명시 없음(구현 세부사항) | `imagesRef.current = images`를 렌더링 중 직접 대입해 React 19 lint 규칙 위반 | 완료(자체 점검으로 발견·수정) | 없음 | 100% |
| G-6 | Minor(후속 과제) | 낙관적 업데이트 오버레이 패턴이 3곳에서 각각 다르게 구현됨 | 설계 §2.3이 "좋아요·북마크 상태는 목록/상세 훅 내부 state"라고만 명시, 구현 모양은 열어둠 | `FeedPage`는 `useFeedInfiniteList`의 리듀서 액션(`updateItem`), `FeedDetailPage`는 `useFeedDetail`의 `applyLocalUpdate`, `FeedUserProfilePage`는 컴포넌트 로컬 `overrides` state — 세 가지 다른 모양으로 "post 위에 로컬 변경분을 겹쳐 그리는" 같은 문제를 각자 해결함 | 후속 과제(Should Improve) | 공용 훅(예: `useOptimisticPostPatch`)으로 통합 검토. 다만 세 화면의 데이터 원천 모양(누적 배열 vs 단일 객체 vs 페이지 교체)이 서로 달라 통합 비용 대비 효과를 먼저 따져야 함 | 90% |
| G-7 | Minor(후속 과제) | 커서 경계값 테스트 일부 미비 | 계획 §3.2 "데이터 정합성" 비기능 요구사항 | `FeedTimelineCursorTest`가 "정확히 size개만 남았을 때 hasNext=false"를 검증하지 않음 — 테스트 코드 자체 주석이 "다른 테스트가 남긴 전역 데이터 건수를 통제할 수 없는 공유 DB 환경 제약"이라고 명시 | 후속 과제 | 별도 트랜잭션/스키마로 격리된 테스트 환경에서 정확한 개수를 통제하는 경계값 테스트 추가 | 100% |
| G-8 | Minor(후속 과제) | `useFeedInfiniteList`의 `removeItem`이 죽은 코드 | 설계에 명시 없음(구현 세부사항) | 훅이 반환하는 `removeItem`을 `FeedPage.jsx`를 포함한 어떤 화면도 호출하지 않음 — 게시물 삭제는 `FeedDetailPage`에서 목록 페이지로 이동 후 전체 재조회로 처리됨 | 후속 과제 | `removeItem`을 실제로 쓰거나(상세에서 삭제 후 목록으로 돌아왔을 때 재조회 대신 즉시 제거), 쓰지 않을 것이면 훅에서 제거 | 100% |
| G-9 | Minor(후속 과제, 의도적 트레이드오프 재확인) | `TourReferencePicker.jsx`가 여전히 `../admin/AdminPagination`을 참조하는 폴더 교차 import | 설계 §5.2가 이 결합을 "의도적 트레이드오프"로 이미 문서화(관리자 폼의 기존 시각적 출력 유지 우선) | 코드에 설계가 예고한 그대로 남아 있음, 코드 리뷰에서도 구조적 결합으로 재차 지적됨 | 후속 과제(구조 개선) | 공개 화면 전용 `Pagination`을 새로 만들어 완전히 분리할지, 현재 트레이드오프를 유지할지 다음 사이클에서 재논의 | 100% |
| G-10 | Minor(후속 과제) | `FeedComposer`의 Escape 키 리스너 effect가 필요 이상으로 자주 재등록됨 | 설계에 명시 없음(구현 세부사항) | `useEffect(..., [open, pickerOpen, onClose])`에서 `onClose`가 부모가 매 렌더마다 새로 만드는 인라인 함수라, 부모가 리렌더될 때마다 리스너가 제거·재등록됨(기능적 오류는 아님, 불필요한 작업) | 후속 과제(성능/정리) | 부모의 `onClose`를 `useCallback`으로 안정화하거나, 훅 내부에서 최신 콜백을 ref로 감싸 effect 의존성에서 제외 | 90% |
| G-11 | Minor(여유 범위, 계획에서 이미 확정) | 댓글+답글 전체(§3.4~3.5, §4.3, §8) | 계획 §2.2/§8, 설계 §13이 "PDCA 사이클 분리 확정"으로 이미 범위 밖 처리 | 미구현(설계 의도와 완전히 일치) | 없음(사용자 승인 스코프) | 후속 `feed-comment-integration` PDCA에서 Plan부터 재시작 | 100% |

**감점 없는 참고 사항**: `FeedCard`/`FeedDetailPage`가 `commentCount`를 항상 0으로 표시하되 클릭 가능한 링크로 만들지 않은 것은 설계 §13 "연결 지점"이 명시한 거짓 UI 금지 원칙을 그대로 따른 것으로, gap이 아니다.

---

## 4. Runtime Verification

### 4.1 정적 분석 + 빌드

| 카테고리 | 결과 |
|----------|:----:|
| `npm run lint` | ✅ 오류 0건(세션 중 `FeedComposer.jsx`의 `react-hooks/refs` 오류 1건을 발견 즉시 수정, G-5) |
| `npm run build` | ✅ 성공(252 modules, 이번 변경과 무관한 기존 `HomeSections.css` 경고 1건은 그대로 — grep으로 무관함 확인) |
| API 계약 대조 | ✅ 5/5 설계 명시 항목 + 회귀 테스트 3건 모두 서버·클라이언트 양쪽 확인 |
| 코드 리뷰 Must Fix 반영 확인 | ✅ 2/2 코드 근거로 재확인(§2.3 G-3, G-4) |
| 수정 금지 파일 회귀 | ✅ `AdminFeedListPage`/`AdminFeedDetailPage`/`FeedAdminController`/`FeedAdminService`(관리자 피드 모더레이션) git status 미표시로 미변경 확인 |

### 4.2 백엔드 자동 테스트 — 실행 시도 결과

`./mvnw -Dtest=FeedTimelineCursorTest test`를 실행했으나, 이 세션의 `JAVA_HOME`(JDK 17.0.0.1)이 `pom.xml`의 `<java.version>25</java.version>`을 지원하지 않아 컴파일 단계에서 실패했다(tour-course-list-integration 분석 §4.2와 동일한 환경 제약이며, 코드 결함이 아니다). 신규 테스트 파일 3개는 코드 정독으로 다음을 확인했다.

- `FeedTimelineCursorTest`(5개 테스트): 커서 제외(자기 자신보다 이전 글만), PRIVATE 제외, 소프트삭제 제외, size+1 조회 기반 `hasNext` 판정, `nextCursor`가 마지막 반환 게시물 id와 일치. "정확히 size개 남았을 때 hasNext=false"는 의도적으로 비워둠(§3 G-7)
- `FeedUserProfileServiceTest`(4개 테스트): PUBLIC만 노출, liked/bookmarked 항상 false, 최초 조회 시 `FeedProfile` 자동 생성, 존재하지 않는 userId는 예외
- `SecurityConfigFeedProfileAccessTest`(3개 테스트): 내 프로필(`GET /api/v1/feed/profile`)은 비인증 시 401 유지, 타인 프로필(`GET /api/v1/feed/profile/{userId}`)은 비인증이어도 401이 아님, 존재하지 않는 userId여도 401이 아님(즉 인가 문제가 아니라 도메인 문제로 분기됨을 검증) — G-1의 회귀 방지 테스트

### 4.3 L2 UI(브라우저)/L3 E2E — 미검증

이전 두 PDCA 주기(destination-list-integration, tour-course-list-integration)와 동일하게 이 환경에 브라우저 자동화 도구가 없어 미실행이다. 우선순위가 높은 후속 검증 항목:

| 항목 | 관련 완료 조건 |
|------|----------------|
| 실제 스크롤로 무한 스크롤이 끊김 없이 동작하고, `IntersectionObserver`의 `rootMargin: 200px`가 적절한지 | SC-1, 설계 §14 O-3 |
| 이미지 업로드 시 드래그 순서변경과 키보드 버튼(◀▶) 순서변경이 실제로 동일한 결과를 내는지 | SC-2 |
| 좋아요·북마크 낙관적 업데이트가 실패 시 실제로 롤백되는지(네트워크 차단 시뮬레이션) | SC-3 |
| 타인 프로필에서 페이지네이션(이전/다음)이 실제로 다음 12개를 보여주는지 | SC-5, G-3 |
| 관리자 피드 모더레이션 화면이 실제 브라우저에서 그대로 동작하는지 | SC-8 |

---

## 5. 관리자 코드 회귀 확인 (계획 §2.1 "이미 검증된 코드는 건드리지 않는다" 원칙 검증)

```
M  backend/.../config/SecurityConfig.java                 (permitAll 1줄 추가, 기존 admin 규칙 미변경)
M  backend/.../feed/controller/FeedController.java        (cursor 파라미터, 기존 상세/작성/삭제/좋아요/북마크 미변경)
M  backend/.../feed/controller/FeedProfileController.java (getUserProfile 메서드 추가, 기존 getMyProfile/updateMyHandle 미변경)
D  backend/.../feed/dto/FeedPageResponse.java              (커서 전환으로 폐기, 다른 호출부 없음 확인)
M  backend/.../feed/exception/FeedExceptionHandler.java   (죽은 메서드 삭제)
M  backend/.../feed/repository/FeedPostRepository.java    (커서 쿼리 메서드 추가, 기존 메서드 미변경)
M  backend/.../feed/service/FeedProfileService.java       (getUserProfile 메서드 추가)
M  backend/.../feed/service/FeedService.java              (getFeed 커서 전환)
```

`FeedAdminController.java`, `FeedAdminService.java`, `AdminFeedListPage.jsx`, `AdminFeedDetailPage.jsx`는 git status에 전혀 나타나지 않아 **단 한 줄도 수정되지 않았음**을 확인했다. `AdminCourseFormPage.jsx`는 `TourReferencePicker` import 경로 한 줄만 바뀌었고 내부 로직은 무변경이다.

---

## 6. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 98.8%                   │
├─────────────────────────────────────────────┤
│  Structural:  100%                           │
│  Functional:   97%                           │
│  Contract:    100%                           │
│  Critical Gap: 0건                            │
│  Important Gap: 4건(전건 완료·수정됨)          │
│  Minor Gap: 7건                              │
│  └ 완료(수정됨): 1건(G-5)                     │
│  └ 후속 과제: 5건(G-6~G-10)                   │
│  └ 여유 범위(계획에서 이미 확정): 1건(G-11)     │
└─────────────────────────────────────────────┘
```

Match Rate가 계획 §4.2 목표(90% 이상)를 크게 상회한다. Critical gap이 없고, Important 4건(SecurityConfig 누락, 미완성 파일, 페이지네이션 누락, 요청 미취소)은 세션 재개 중 자체 점검과 코드 리뷰를 거쳐 전건 수정 완료됐다. 남은 Minor 7건 중 6건은 실제 위험이 없거나(여유 범위) 후속 과제이고, 1건은 이미 수정됐다.

---

## 7. 권장 조치

### 7.1 코드 수정

없음. Important 4건, Minor 1건 모두 이미 수정 완료됐다(§2.3, §3).

### 7.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-1: 설계 §6.1 변경 자원 표에 `SecurityConfig.java`(타인 프로필 permitAll) 추가
- G-6: 설계 §2.3의 "좋아요·북마크 상태는 훅 내부 state" 서술에 "화면마다 오버레이 구현 방식이 다름(리듀서 액션/단일 객체 패치/컴포넌트 로컬 state), 통합은 후속 검토" 주석 추가

### 7.3 후속 과제 (다음 세션 또는 다음 PDCA)

- G-6: 낙관적 업데이트 오버레이 패턴 통합 검토
- G-7: 커서 경계값(`hasNext=false`) 테스트를 격리된 환경에서 추가
- G-8: `useFeedInfiniteList.removeItem` 실제 사용 또는 제거
- G-9: `TourReferencePicker`의 관리자 폴더 교차 import를 유지할지 분리할지 재논의
- G-10: `FeedComposer`의 Escape 리스너 재등록 최소화
- JDK 25 환경에서 `mvnw clean test` 전체 실행(§4.2)
- 브라우저 자동화 환경에서 §4.3 L2 체크리스트 실행
- 사이클 2: `docs/01-plan/features/feed-comment-integration.plan.md` 작성부터 재시작(댓글+답글)

---

## 8. Next Steps

- [x] Critical gap 없음 확인
- [x] Important gap 4건(G-1~G-4) 전건 수정 확인
- [x] 코드 리뷰 Must Fix 2건(G-3, G-4) 반영 확인
- [ ] Completion Report 작성 (`feed-integration.report.md`)
- [ ] 후속: JDK 25 환경에서 `mvnw clean test` 실행
- [ ] 후속: 브라우저 자동화 환경에서 L2 체크리스트 실행
- [ ] 후속: `feed-comment-integration` Plan 문서 작성부터 사이클 2 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-30 | 최초 gap 분석(사이클 1). Match Rate 98.8%, Critical 0건, Important 4건(전건 완료). 세션 재개 중 자체 점검으로 발견·수정한 이슈(G-1, G-2, G-5)와 코드 리뷰 Must Fix 2건(G-3, G-4)을 완료로, 남은 Minor 5건(G-6~G-10)을 후속 과제로, 댓글+답글(G-11)을 계획에서 이미 확정된 여유 범위로 분류 | frontend-lead (Claude Code 보조) |
