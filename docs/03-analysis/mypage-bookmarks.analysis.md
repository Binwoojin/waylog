# mypage-bookmarks Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현) — **PDCA 사이클** (마이페이지·북마크 — `/mypage`, `/bookmarks` 신규 화면 + 가짜 저장 버튼 3곳 교체)
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: frontend-lead (Claude Code 보조)
> **Date**: 2026-10-02
> **Design Doc**: [mypage-bookmarks.design.md](../02-design/features/mypage-bookmarks.design.md) (v0.1)
> **Plan Doc**: [mypage-bookmarks.plan.md](../01-plan/features/mypage-bookmarks.plan.md) (v0.2, Q-1~Q-8 결정 완료)

PRD 문서는 없다(이전 사이클들과 동일하게 PM 단계 없이 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

**세션 경계 고지**: 이 기능의 프론트 구현은 세션 한도(rate limit)로 한 번 중단됐다가 새 세션에서 재개됐다. 재개 세션은 먼저 기존 산출물(훅·API 모듈·컴포넌트)을 전수 점검해 중복 작업을 피했고, 남은 작업(`MyPage.jsx`/`BookmarksPage.jsx` 신규, 라우팅 교체, 가짜 저장 버튼 3곳 교체)만 이어서 완료했다. 이 gap 분석은 **세션 경계와 무관하게 최종 코드 상태 전체**를 설계 대비로 대조한다.

---

## Context Anchor

> 계획·설계 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | `/mypage`, `/bookmarks` 메뉴는 이미 노출돼 있었지만 `ComingSoonPage`만 보였다. 회원 프로필 수정·회원 탈퇴·피드 북마크 목록 API가 백엔드에 없었고, 이미 완성된 `tour.bookmark` API는 프론트가 단 한 줄도 연결하지 않은 상태였다. `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`에는 저장되지 않는 로컬 state만으로 동작하는 "가짜 저장 버튼"이 있었다 |
| **WHO** | 로그인한 사용자 본인(마이페이지·북마크 모두 본인 전용) |
| **RISK** | 회원 탈퇴 데이터 정책이 프로젝트에 전혀 없었음 / 비밀번호 변경 플로우를 실제로 연동하는 최초 사례 / 북마크 두 도메인(`feed`, `tour.bookmark`) 통합 / 가짜 버튼을 실제 버튼으로 교체하는 과정에서 "교체는 했지만 여전히 거짓으로 보이는" 상태가 될 위험(실제로 발생, 아래 §3 G-1) |
| **SUCCESS** | Plan 문서 §4.1과 동일(10개 조건, 아래 Success Criteria Status) |
| **SCOPE** | 회원 프로필 확장 API, 비밀번호 변경 연동, 회원 탈퇴 신규 API, 피드 북마크 목록 신규 API, 투어 북마크 프론트 연동, `/mypage`·`/bookmarks` 화면, 가짜 저장 버튼 3곳 교체 |

---

## Success Criteria Status (계획 §4.1 완료 조건)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | `/mypage`에서 본인 프로필(닉네임·소개·프로필이미지·@피드아이디)을 조회·수정할 수 있다 | ✅ | `ProfileSection.jsx`(보기/수정 모드 토글) + `useMyFeedProfile.js`(`GET/PATCH /api/v1/feed/profile`) + `MyPage.jsx` 통합 확인 |
| SC-2 | `/mypage`에서 본인이 쓴 글 목록을 볼 수 있다 | ✅ | `MyPage.jsx`가 `profile.posts`를 `FeedCard`로 렌더링, offset 페이지네이션(이전/다음) 확인 |
| SC-3 | `/mypage`에서 비밀번호를 변경할 수 있다(이메일 인증 플로우) | ✅ | `PasswordChangeForm.jsx` + `usePasswordChangeFlow.js`(idle→code-sent→verified→done) + `userApi.js`(기존 3단계 체인 최초 실연동) 확인 |
| SC-4 | `/mypage`에서 회원 탈퇴를 할 수 있고, 탈퇴 후 재로그인이 차단된다 | ✅ | `WithdrawalDialog.jsx`(비밀번호 재확인+동의 체크박스) + `UserWithdrawalFlowTest` 6개 테스트(로그인/리프레시/필터 3개 체크포인트 전부 통과, §4.2) |
| SC-5 | `/bookmarks`에서 피드/여행지/즐길거리 탭별 북마크 목록을 볼 수 있다 | ✅ | `BookmarksPage.jsx`의 `FeedBookmarkTab`/`TourBookmarkTab`, `?tab=` URL 쿼리로 탭 전환 확인 |
| SC-6 | `/bookmarks`에서 북마크를 해제하면 목록에서 즉시 제거된다 | ✅ | `useFeedBookmarks.removeBookmark`/`useTourBookmarks.removeBookmark`(낙관적 제거 + 실패 시 롤백) 확인 |
| SC-7 | `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 저장 버튼이 실제로 서버에 북마크를 남긴다 | ✅(코드 리뷰에서 발견된 치명적 버그 수정 후 충족) | 최초 구현은 `tourBookmarkApi.js`가 응답 필드명을 잘못 읽어(`data.saved`, 실제는 `data.active`) 저장 버튼이 항상 롤백됐다(아래 §3 G-1). 코드 리뷰가 발견해 수정, 현재 코드는 `Boolean(data?.active)`로 확인 |
| SC-8 | 로딩·에러(재시도)·빈 상태가 구분되어 표시된다 | ✅ | `MyPage`/`BookmarksPage` 모두 `DetailStatus`(loading/error) + 전용 빈 상태 카드(`EmptyBookmarks`, "아직 작성한 게시물이 없습니다") 확인 |
| SC-9 | 비로그인 사용자는 두 화면 모두에서 로그인 화면으로 안내된다 | ✅ | `useMyFeedProfile`/`useFeedBookmarks`/`useTourBookmarks`의 `login-required` 상태 → 각 페이지가 로그인 유도 카드 렌더링 확인 |
| SC-10 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ | 코드 리뷰에서 Critical 1건(G-1) + Should Improve 1건(G-2) 발견, 전건 수정 완료 확인. 이 문서가 gap 분석 |

**Success Rate**: 10/10 완전 충족(단, SC-7은 코드 리뷰의 Critical 수정 없이는 충족되지 않았을 것 — 아래 §3에서 심각도를 그대로 기록한다).

---

## 1. 분석 개요

### 1.1 목적

`mypage-bookmarks` 사이클의 구현(백엔드 신규/확장 API 7종 + 프론트 신규 화면 2개 + 가짜 저장 버튼 3곳 교체)과 그 이후의 코드 리뷰 수정 사항이, 설계(`mypage-bookmarks.design.md`) 및 계획(`mypage-bookmarks.plan.md` FR-01~17)의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/mypage-bookmarks.design.md`(§1~§13, v0.1)
- **구현 경로(백엔드)**: `user/entity/UserEntity.java`(수정), `user/controller/UserController.java`(수정), `user/service/{AuthService,UserService}.java`(수정), `user/dto/UserWithdrawalRequest.java`(신규), `config/JwtAuthenticationFilter.java`(수정), `feed/controller/{FeedProfileController,FeedBookmarkController}.java`(수정/신규), `feed/dto/{FeedProfileResponse,FeedProfileUpdateRequest,FeedBookmarkPageResponse}.java`(수정/신규), `feed/service/{FeedProfileService,FeedService}.java`(수정), `feed/repository/FeedBookMarkRepository.java`(수정), 신규 테스트 3개 파일(`FeedBookmarkServiceTest`, `FeedProfileUpdateServiceTest`, `UserWithdrawalFlowTest`), `backend/db/migrations/2026-10-02-mypage-bookmarks.sql`
- **구현 경로(프론트)**: `api/{tourBookmarkApi,userApi}.js`(신규), `api/feedApi.js`(확장), `hooks/{useFeedBookmarks,useMyFeedProfile,usePasswordChangeFlow,useTourBookmarks,useWithdrawal}.js`(신규), `components/mypage/{ProfileSection,AccountSettingsSection,PasswordChangeForm,WithdrawalDialog}.jsx`(+css, 신규), `pages/{MyPage,BookmarksPage}.jsx`(+css, 신규), `pages/{TravelDetailPage,EnjoyDetailPage,EnjoyCategoryPage}.jsx`(+TravelDetailPage.css, 수정), `App.jsx`(라우트 교체)
- **분석 일자**: 2026-10-02
- **분석 방식**: 정적 분석(전체 파일 정독, `git status` 기준 신규/변경 파일 대조) + 코드 리뷰 Critical 1건·Should Improve 1건 반영 확인(코드 직접 대조) + `npm run lint`/`npm run build` 실행 확인 + 백엔드 신규 테스트 3개 파일(15개 테스트) 정독 + 백엔드 자동 테스트 실행 재시도(환경 제약 재현, §4.2) + 기존 `surefire-reports` 실행 기록 대조

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 대조 (설계 §4 전체 ↔ 서버 ↔ 클라이언트)

| # | 엔드포인트 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------------|:----:|:----:|:----------:|:----:|
| 1 | `GET /api/v1/feed/profile` | ✅ `introduce` 필드 추가(하위 호환) | ✅ `FeedProfileResponse.of`가 `user.getIntroduce()` 포함 | ✅ `toFeedProfile`이 `introduce` 파싱 | PASS |
| 2 | `PATCH /api/v1/feed/profile`(멀티파트) | ✅ `{nickname, introduce, feedHandle}` JSON part + 선택적 `profileImage` part | ✅ `FeedProfileController.updateMyProfile`이 `@RequestPart` 2개로 수신, `FeedProfileService.updateMyProfile`이 "값이 바뀐 경우만" 중복확인(Q-4) | ✅ `updateMyFeedProfile`이 `FormData`로 동일하게 구성 | PASS |
| 3 | `DELETE /api/v1/users/me` | ✅ 바디 `{password}`, 성공 시 리프레시 쿠키 즉시 만료 | ✅ `UserController.withdraw` → `UserService.withdraw`(비밀번호 검증 후 `authService.logout()`의 만료 쿠키 재사용) | ✅ `withdrawMyAccount`가 `apiClient.delete(path, {body, credentials:'include'})` 호출. **설계 §9·§12가 "`client.js`의 `delete`가 바디를 지원하는지 구현 전 확인 필요"로 명시한 열린 사항**이었는데, 실제로 이미 지원하고 있어 `client.js` 변경 없이 그대로 동작 | PASS(열린 사항 해소 확인) |
| 4 | `GET /api/v1/feed/bookmarks?page=&size=` | ✅ 북마크 시각 내림차순, `bookmarked`는 상수 true | ✅ `FeedBookmarkController.getMyBookmarks` → `FeedService.getMyBookmarks`(좋아요만 배치 조회, N+1 방지 원칙은 `getFeed`와 동일) | ✅ `fetchFeedBookmarks`(fail-closed 파싱) | PASS |
| 5 | `GET /api/v1/tour-bookmarks?group=&page=&size=` | ✅ 기존 API, 프론트 최초 연결 | ✅ 변경 없음(계획대로) | ✅ `fetchTourBookmarks`가 Spring Data `Page<T>` 직렬화(`content`/`totalPages`/`last`)를 흡수 | PASS |
| 6 | `POST /api/v1/tour-bookmarks/toggle` | ❌ **설계 §3.5·§4.6 코드 예시 자체가 응답 필드를 `{ saved: boolean, bookmarkId }`로 잘못 기술**(실제 백엔드 `TourBookmarkToggleResponse`는 `(boolean active, Long bookmarkId)`) | ✅ 서버는 처음부터 `active` 필드로 일관되게 응답(변경 없음, 계획대로) | ❌→✅ 최초 구현(`tourBookmarkApi.js`)이 설계 예시를 그대로 따라 `Boolean(data?.saved)`로 작성 → 항상 `undefined`(false)를 반환해 **저장 버튼이 눌러도 항상 롤백되는 것처럼 보임**. 코드 리뷰가 발견해 `Boolean(data?.active)`로 수정 | **완료(Critical, 수정됨)** — 아래 §3 G-1 |

**Contract Match Rate**: 5/6 = 83%(6번 항목은 설계 문서 자체의 오기가 구현에 그대로 전파된 경우라, 구현이 설계를 "충실히 따랐음에도" 틀린 특수한 사례다. 코드 리뷰로 발견·수정돼 최종 코드는 올바르지만, "설계-서버-클라이언트 3면 대조"라는 이 표의 목적상 설계 자체가 서버와 불일치했던 사실은 감점으로 남긴다)

### 2.2 구조적 일치 (설계 §2.2, §6~§8 모듈·라우팅 목록)

| 구분 | 설계 명시 | 실제 | 결과 |
|------|-----------|------|:----:|
| 백엔드 수정 | `UserEntity`(`withdrawnAt`/`isWithdrawn`/`withdraw`/`updateProfile`/`updateProfileImage`), `FeedProfileResponse`/`FeedProfileUpdateRequest` 확장 | 전부 존재, 설계 코드 예시와 필드·메서드명 일치 | PASS |
| 백엔드 신규 | `UserWithdrawalRequest`, `FeedBookmarkController`, `FeedBookmarkPageResponse` | 전 파일 존재 | PASS |
| 백엔드 체크포인트 3곳 | `AuthService.login`/`refreshToken`, `JwtAuthenticationFilter` | 3곳 모두 `isWithdrawn()` 체크 추가 확인. **단, `login()`은 `isWithdrawn()`→`isSuspended()` 순서, `refreshToken()`은 `isSuspended()`→`isWithdrawn()` 순서로 두 메서드의 체크 순서가 반대**(결과는 동일 — 두 조건 모두 궁극적으로 거부로 이어지고, 두 상태가 동시에 성립하는 회원이 실제로 존재할 가능성도 낮다. 다만 설명 시 "항상 같은 순서로 체크한다"처럼 부정확하게 단순화하지 않도록 주의 필요) | 완료(동작 일치, 순서만 다름) — 아래 §3 G-3 |
| 프론트 신규 API | `tourBookmarkApi.js`, `userApi.js` | 존재, 함수명 설계와 일치 | PASS |
| 프론트 신규 훅 | `useFeedBookmarks`, `useMyFeedProfile`, `usePasswordChangeFlow`, `useTourBookmarks`, `useWithdrawal` | 5개 전부 존재, 상태 머신·status 값 설계와 일치 | PASS |
| 프론트 신규 컴포넌트 | `ProfileSection`, `AccountSettingsSection`, `PasswordChangeForm`, `WithdrawalDialog` | 전부 존재. 세션 재개 중 `ProfileSection`/`WithdrawalDialog`에서 `react-hooks/set-state-in-effect` 린트 위반 2건 발견, `key` 기반 리마운트 패턴으로 수정(동작 변화 없음) | 완료(버그 수정 포함) |
| 프론트 신규 페이지 | `MyPage.jsx`, `BookmarksPage.jsx`(설계 §5·§6) | 전부 존재. `BookmarksPage`는 설계가 명시한 대로 탭별 완전히 독립된 하위 컴포넌트(`FeedBookmarkTab`/`TourBookmarkTab`)로 분리 | PASS |
| 라우팅 | `App.jsx`의 `/mypage`, `/bookmarks`를 `ComingSoonPage`→실제 페이지로 교체(§8) | 확인(`git diff` 대조) | PASS |
| 가짜 저장 버튼 교체 | `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`(§7) | 3곳 모두 `toggleTourBookmark` 연결 확인. `EnjoyCategoryPage`는 설계에 없던 추가 개선으로 북마크 상태 추적 키를 "카드 위치"에서 "콘텐츠 id"로 변경(같은 목업 항목이 45장으로 반복 렌더링되는 구조라 위치 기반 키는 동일 콘텐츠의 저장 여부가 카드마다 달라 보이는 모순이 있었음) | 완료(설계보다 개선된 구현) |

**Structural Match Rate**: 100%(설계가 명시한 모듈·파일이 전부 존재하고 이름·역할이 일치한다. 체크포인트 순서 차이(G-3)는 "존재 여부"가 아니라 "동작 세부"의 문제라 구조적 일치에는 영향 없음)

### 2.3 기능 요구사항(FR-01~17) 충족 여부 및 코드 리뷰 반영 확인

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-01 (`FeedProfileResponse`/`FeedProfileUpdateRequest` 확장, PATCH 멀티파트) | ✅ | 코드 확인 완료 |
| FR-02 (닉네임 "값이 바뀐 경우만" 중복확인) | ✅ | `FeedProfileService.updateMyProfile`의 `!normalizedNickname.equals(user.getNickname())` 분기 확인 |
| FR-03 (`UserEntity` 변경 메서드 추가) | ✅ | `updateProfile`/`updateProfileImage` 확인 |
| FR-04 (마이페이지 프로필 조회/수정 폼) | ✅ | `ProfileSection.jsx`(보기/수정 모드), `useMyFeedProfile.js` |
| FR-05 (내가 쓴 글 목록) | ✅ | `MyPage.jsx`의 `FeedCard` 리스트 + offset 페이지네이션 |
| FR-06 (비밀번호 변경 최초 실연동) | ✅ | `PasswordChangeForm.jsx` + `usePasswordChangeFlow.js` + `userApi.js` |
| FR-07 (`withdrawnAt`/`isWithdrawn`/체크포인트 3곳) | ✅(순서 차이 있음, 결과 동일) | §2.2, G-3 |
| FR-08 (회원 탈퇴 API, 비밀번호 재확인, 쿠키 무효화) | ✅ | `UserController.withdraw`, `UserWithdrawalFlowTest` 6개 테스트 전부 통과 |
| FR-09 (탈퇴 확인 다이얼로그) | ✅ | `WithdrawalDialog.jsx`(비밀번호+동의 체크박스 모두 있어야 제출 버튼 활성화) |
| FR-10 (`FeedBookMarkRepository` 페이지네이션 추가) | ✅ | `findByUser_IdAndFeedPost_DeletedAtIsNullOrderByCreatedAtDesc` 확인 |
| FR-11 (피드 북마크 목록 서비스+컨트롤러) | ✅ | `FeedService.getMyBookmarks`, `FeedBookmarkController` |
| FR-12 (`feedApi.js` `fetchFeedBookmarks`) | ✅ | fail-closed 파싱 확인 |
| FR-13 (`tourBookmarkApi.js` 신규) | ⚠️→✅ | **최초 구현에 Critical 버그(G-1) 포함, 코드 리뷰로 발견·수정 완료** |
| FR-14 (가짜 저장 버튼 3곳 교체) | ⚠️→✅ | FR-13의 버그로 인해 "교체했지만 저장이 항상 실패하는 것처럼 보이는" 상태였다가, 같은 수정으로 함께 해결 |
| FR-15 (`/bookmarks` 3탭 화면) | ✅ | `BookmarksPage.jsx`, `?tab=` URL 쿼리 기반 전환(새로고침·공유 링크에도 유지) |
| FR-16 (북마크 해제 낙관적 처리) | ✅ | `removeBookmark`(피드/투어 양쪽) 낙관적 제거 + 실패 시 롤백 |
| FR-17 (라우팅 교체, 비로그인 안내) | ✅ | `App.jsx` 라우트 교체, 각 페이지 `login-required` 상태 분기 |

**코드 리뷰에서 발견되고 실제로 고쳐진 이슈 — 완료(수정됨)**

| # | 이슈 | 발견 단계 | 수정 내용 | 확인 근거 |
|---|------|-----------|-----------|-----------|
| G-1 | **(Critical)** `tourBookmarkApi.js`의 `toggleTourBookmark`가 백엔드 응답 필드 `active`를 `saved`로 잘못 읽어(`Boolean(data?.saved)`) 항상 `false`를 반환. `TravelDetailPage`/`EnjoyDetailPage`/`EnjoyCategoryPage`의 저장 버튼이 낙관적으로 `true`로 바뀌었다가 서버 응답(`false`)으로 즉시 롤백돼, **실제로는 서버에 정상 저장되는데도 화면에는 항상 "저장 실패"처럼 보이는 상태**였다. 이번 사이클의 핵심 목표("가짜 버튼을 진짜 버튼으로 교체")를 사실상 무력화시키는 버그였다 | frontend-code-reviewer | `tourBookmarkApi.js`를 `Boolean(data?.active)`로 수정하고, 파일 내 주석에 "백엔드 `TourBookmarkToggleResponse`는 `active` 필드(`saved`가 아님)"를 명시해 재발을 막음 | `tourBookmarkApi.js` 68~85행(수정 후 코드 직접 확인), 백엔드 `TourBookmarkToggleResponse.java`의 실제 필드(`active`, `bookmarkId`)와 대조 |
| G-2 | (Should Improve) `TravelDetailPage`의 "주변에서 함께 둘러볼 곳" 섹션 미니 북마크 버튼이 메인 저장 버튼과 시각적으로 구분되지 않아, 실제로는 로컬 전용(서버 미연동)인데도 사용자가 메인 버튼과 동일하게 "저장된다"고 오인할 수 있었다. 설계 §7.2·회귀 체크리스트가 "저장 버튼 외 나머지 기능은 그대로 둔다"고 명시해 서버 연동 자체는 이번 범위가 아니었지만, 거짓 UI 금지 원칙(NFR)에 비추어 최소한 "로컬 전용/준비 중"임을 드러내는 것이 맞다고 판단 | frontend-code-reviewer | 버튼에 `is-local-only` 클래스, `title="준비 중: 추후 서버 연동 예정"`, `aria-label`에 "(로컬 전용, 준비 중)" 문구 추가. `TravelDetailPage.css`에 `.is-local-only`를 메인 저장 버튼과 다른(더 옅은) 색상으로 분리해 시각적으로도 구분 | `TravelDetailPage.jsx`의 해당 버튼 마크업, `TravelDetailPage.css`의 `.is-local-only` 규칙 |
| G-3 | (Minor, 설명 주의) `AuthService.login()`과 `refreshToken()`의 탈퇴·정지 체크 순서가 서로 다름(§2.2) | frontend-code-reviewer | 코드 수정 없음(결과가 동일해 기능적 결함이 아님) — 분석 문서·보고서에 정확한 순서를 기록해 향후 "항상 같은 순서"라고 잘못 설명되지 않도록 함 | `AuthService.java` 72/82행(login), 204/214행(refreshToken) |

**완료(문서만, 후속 과제로 보류)**

| # | 항목 | 내용 |
|---|------|------|
| G-4 | 설계-구현 불일치(기능 아님) | 설계 §5.1이 "PRIVATE 글도 섞여 내려오므로 카드에 비공개 배지 추가"를 명시했으나, 실제로는 백엔드 `FeedPostResponse.java`에 `visibility`/`isPrivate` 필드 자체가 없어(설계 작성 시점에 확인되지 않음) 프론트에서 구현 불가능했다. 보안 문제는 아니다(비공개 글 자체는 서버가 이미 본인에게만 내려주고 있음) — "어떤 게시물이 비공개인지 시각적으로 표시"라는 UX 기능 하나가 설계와 다르게 빠진 것. 백엔드를 건드리지 말라는 이번 세션의 제약과, "프론트 우선순위"(불필요한 백엔드 확장 금지) 원칙에 따라 이번 사이클에서는 배지 없이 진행 |
| G-5 | Minor | 피드 북마크 목록(`FeedService.getMyBookmarks`)이 각 게시물의 `photos`를 `@EntityGraph`로 미리 불러오지 않아 N+1 조회가 발생한다. 다만 이는 `FeedPostRepository`의 다른 목록 조회 메서드(`author`만 fetch, `photos` 제외)들도 전부 공유하는 **기존 패턴**이며, 이번 PR이 새로 만든 문제가 아니다 |
| G-6 | Minor | `BookmarksPage.jsx`가 `?tab=` 쿼리를 정규화하는 `useEffect`(없는 값·오타를 기본 탭으로 교체) 때문에, 쿼리가 없거나 잘못된 최초 진입 시 렌더가 1회 더 일어난다(화면 깜빡임 등 사용자 체감 영향은 없음) |
| G-7 | Nice to Have(설계 §9가 이미 명시) | `extractRequiredEmail(authorization)`이 `FeedProfileController`/`TourBookmarkController`/`FeedBookmarkController`/`UserController` 4곳에 동일하게 중복된다. 설계 문서가 이미 "리스크 없는 개선이지만 범위 폭주를 피하기 위해 손대지 않는다"고 명시한 항목 |
| G-8 | 테스트 공백(사각지대, 중요) | 백엔드는 이번 사이클에서 신규 로직마다 테스트를 작성했다(`FeedBookmarkServiceTest` 4개, `FeedProfileUpdateServiceTest` 5개, `UserWithdrawalFlowTest` 6개, 아래 §4.1). 반면 프론트의 북마크 토글 로직(`tourBookmarkApi.js`, `TravelDetailPage`/`EnjoyDetailPage`/`EnjoyCategoryPage`의 `handleToggleSave`)에는 **단위 테스트가 전혀 없다.** G-1(Critical)이 바로 이 사각지대에서 나왔다 — `data?.saved`는 문법적으로 완전히 유효한 JS라 `npm run lint`/`npm run build` 둘 다 통과했고, 실제로 토글 응답 객체를 검증하는 테스트가 하나라도 있었다면 즉시 드러났을 결함이다. 이번 사이클에서는 보강하지 않았고, 후속 과제로 남긴다 |

**Functional Match Rate**: 95%(FR 17/17 최종 충족, 그러나 FR-13/14가 한때 Critical 결함을 포함했던 사실(G-1)과 설계-백엔드 불일치로 인한 기능 누락 1건(G-4)을 반영해 feed-comment-integration 등 이전 사이클보다 낮게 평가한다. 발견된 결함은 Report 이전에 전부 수정 완료됐다)

### 2.4 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  100%                │
│  Functional Match Rate:   95%                │
│  Contract Match Rate:     83%                │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:      91.2%              │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)  [서버 정적 공식]      │
├─────────────────────────────────────────────┤
│  참고: npm run lint 0 오류, npm run build 성공│
│  코드 리뷰 Critical 1건 + Should Improve 1건  │
│  전건 반영 확인                                │
│  백엔드 신규 테스트 15개(3개 파일, 정독+실행   │
│  기록 대조 확인)                               │
│  백엔드 자동 테스트 — 이 세션에서는 재현 실패  │
│  (§4.2, JDK 버전 제약 — 5번째 연속 반복)       │
│  L2(브라우저 UI)/L3(E2E) — 미검증(도구 부재)  │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical 1건은 Report 이전에 수정 완료. Important(Should Improve) 1건도 수정 완료. 나머지 5건은 Minor/후속 과제다.

| # | 등급 | 항목 | 설계 | 구현 | 분류 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|------|-----------|:--:|
| G-1 | **Critical(완료, 수정됨)** | `tourBookmarkApi.js` 응답 필드명 오독(`saved`↔`active`) | 설계 §3.5·§4.6 코드 예시 자체가 `{saved, bookmarkId}`로 잘못 기술 | 구현이 설계를 충실히 따랐으나 실제 백엔드(`active`)와 불일치 → 저장 버튼이 항상 롤백되는 것처럼 보임 | 완료(수정됨) | 설계 문서 §3.5·§4.6의 응답 필드명을 `active`로 정정 | 100% |
| G-2 | Important(완료, 수정됨) | `TravelDetailPage` 주변 추천의 로컬 전용 북마크 버튼이 메인 버튼과 시각적으로 구분되지 않음 | 설계는 해당 버튼을 범위 밖으로 명시, 시각적 구분까지는 요구하지 않음 | `is-local-only` 클래스+툴팁+aria-label로 "준비 중" 명시, CSS로 색상 구분 | 완료(설계보다 개선) | 없음 | 100% |
| G-3 | Minor(설명 주의) | `AuthService.login`/`refreshToken`의 탈퇴·정지 체크 순서 불일치 | 설계 §4.4가 "기존 분기 옆에 추가"로만 명시, 순서 고정은 없음 | 두 메서드가 서로 다른 순서로 체크(결과는 동일) | 후속 과제(일관성 정리) | 두 메서드의 체크 순서를 통일(예: 둘 다 탈퇴 우선)하는 리팩토링, 위험 낮음 | 90% |
| G-4 | Minor(설계-구현 불일치) | 설계 §5.1 "PRIVATE 글 배지"가 구현되지 않음 | 설계가 명시 | 백엔드 `FeedPostResponse`에 `visibility` 필드 자체가 없어 구현 불가(설계 작성 시점에 미확인) | 후속 과제(백엔드 필드 추가 필요 — 프론트 우선순위 원칙상 이번 세션은 보류) | 설계 문서 §5.1에 "백엔드 필드 부재로 이번 사이클 보류"를 명시 | 100% |
| G-5 | Minor(기존 패턴) | 피드 북마크 목록의 `photos` N+1 | 설계에 명시 없음(구현 세부사항) | 다른 목록 API들과 동일한 기존 패턴, 이번 PR이 새로 만든 문제 아님 | 후속 과제(전체 피드 API 공통 이슈로 별도 PDCA에서 일괄 검토 권장) | 없음 | 90% |
| G-6 | Minor | `BookmarksPage`의 `?tab=` 정규화로 인한 렌더 1회 추가 | 설계에 명시 없음(구현 세부사항) | 사용자 체감 영향 없음 | 후속 과제(낮은 우선순위) | 없음 | 95% |
| G-7 | Nice to Have | `extractRequiredEmail` 4곳 중복 | 설계 §9가 이미 "후속 Nice to Have"로 명시 | 그대로 유지 | 후속 과제(설계 의도대로) | 공통 `JwtAuthorizationExtractor` 유틸 추출 | 100% |
| G-8 | 중요(프로세스) | 프론트 북마크 토글 로직에 단위 테스트 부재 | 설계에 테스트 요구 명시 없음 | G-1이 바로 이 사각지대에서 발생 | 후속 과제(다음 사이클 착수 전 최우선 권장) | `tourBookmarkApi.js`/`handleToggleSave` 계열에 응답 필드 계약을 검증하는 단위 테스트 추가 | 100% |

**감점 없는 참고 사항**: 계획 §2.2가 명시적으로 제외한 항목(회원 탈퇴 시 게시물 완전 익명화/연쇄 삭제, 2단계 인증, `ForgotPasswordPage.jsx` 실연동, 투어 코스 북마크, 상세/목록 화면의 기존 북마크 여부 초기 표시)은 전부 미구현 상태 그대로이며, 이는 설계 의도와 완전히 일치하므로 gap이 아니다.

---

## 4. Runtime Verification

### 4.1 정적 분석 + 빌드 + 백엔드 테스트 실행 기록

| 카테고리 | 결과 |
|----------|:----:|
| `npm run lint` | ✅ 오류 0건 |
| `npm run build` | ✅ 성공(284 modules, 이번 변경과 무관한 기존 CSS 오탈자 경고 1건은 `HomeSections.css`에 사이클 이전부터 존재, 영향 없음) |
| API 계약 대조 | ⚠️ 5/6(1건은 설계 자체의 오기, 구현은 최종적으로 정정 완료 — §2.1) |
| 코드 리뷰 Critical·Should Improve 반영 확인 | ✅ 2/2 코드 직접 대조로 재확인(§2.3, §3) |
| 수정 금지 파일(`FeedController`/`FeedPage`/`SecurityConfig` 등) 회귀 | ✅ `git status`에 미표시(미변경) 확인 |
| 백엔드 신규 테스트 — `surefire-reports` 기존 실행 기록 | ✅ `FeedBookmarkServiceTest` 4/4, `FeedProfileUpdateServiceTest` 5/5, `UserWithdrawalFlowTest` 6/6 — 전부 PASS로 기록됨(총 15/15) |
| 백엔드 전체 테스트 스위트 — `surefire-reports` 집계 | ✅ 19개 테스트 클래스, 121/121 통과, 실패·오류·스킵 0건으로 기록됨 |

### 4.2 백엔드 자동 테스트 — 이 세션 실행 시도 결과

`./mvnw -Dtest=FeedBookmarkServiceTest,FeedProfileUpdateServiceTest,UserWithdrawalFlowTest test`를 이 세션에서 직접 실행했으나, 로컬 `JAVA_HOME`(JDK 17.0.0.1)이 `pom.xml`의 `<java.version>25</java.version>`을 지원하지 않아 컴파일 단계에서 실패했다(코드 결함이 아니다). `destination-list-integration`부터 `feed-comment-integration`까지 **네 차례 연속** 보고된 것과 동일한 환경 제약이며, 이번 사이클로 **다섯 번째**다.

이 세션은 대신 작업 디렉터리에 이미 존재하는 `backend/target/surefire-reports/`(frontend-support-backend가 별도 JDK 25 환경에서 생성한 것으로 추정)를 직접 열어 확인했다:
- `kr.co.mycom.travel_korea.feed.FeedBookmarkServiceTest.txt`: `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0`
- `kr.co.mycom.travel_korea.feed.FeedProfileUpdateServiceTest.txt`: `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`
- `kr.co.mycom.travel_korea.user.UserWithdrawalFlowTest.txt`: `Tests run: 6, Failures: 0, Errors: 0, Skipped: 0`
- 전체 19개 리포트 파일 집계: `Tests run: 121, Failures: 0, Errors: 0, Skipped: 0`

이 기록은 이 세션이 직접 재현한 것이 아니라 디스크에 남아 있던 산출물을 근거로 삼은 것이므로, §3 G-8과 별개로 "같은 세션 내 재현 불가"라는 환경 문제 자체는 미해결로 남긴다.

### 4.3 L2 UI(브라우저)/L3 E2E — 미검증

이전 사이클들과 동일하게 이 환경에 브라우저 자동화 도구가 없어 미실행이다. 우선순위가 높은 후속 검증 항목:

| 항목 | 관련 완료 조건 |
|------|----------------|
| `TravelDetailPage`/`EnjoyDetailPage`/`EnjoyCategoryPage`에서 저장 버튼을 눌렀을 때 실제로 새로고침 후에도(다른 화면 경유) 북마크 화면에 나타나는지(G-1 수정이 실제 브라우저에서도 동작하는지 실측) | SC-7 |
| 회원 탈퇴 후 기존 브라우저 탭의 Access Token으로 보호된 API를 호출하면 즉시 401이 되는지 | SC-4 |
| 비밀번호 변경 플로우(이메일 인증 코드 수신 포함)가 실제 이메일 발송까지 end-to-end로 동작하는지 | SC-3 |
| 모바일 폭에서 `MyPage`/`BookmarksPage`의 탭·카드 그리드가 깨지지 않는지 | 계획 §3.2 반응형 |

---

## 5. 회귀 확인 (계획 §2.1 "이미 검증된 코드는 건드리지 않는다" 원칙 검증)

```
M  backend/.../config/JwtAuthenticationFilter.java        (탈퇴 체크 추가, 기존 정지 체크 무변경)
M  backend/.../feed/controller/FeedProfileController.java (PATCH 멀티파트 전환)
M  backend/.../feed/dto/FeedProfileResponse.java          (introduce 필드 추가만, 기존 필드 순서 유지)
M  backend/.../feed/dto/FeedProfileUpdateRequest.java     (필드 3개로 확장)
M  backend/.../feed/repository/FeedBookMarkRepository.java(목록 조회 메서드 추가)
M  backend/.../feed/service/FeedProfileService.java       (updateMyProfile로 대체)
M  backend/.../feed/service/FeedService.java              (getMyBookmarks 추가)
M  backend/.../user/controller/UserController.java        (탈퇴 엔드포인트 추가)
M  backend/.../user/entity/UserEntity.java                (withdrawnAt 등 추가, 기존 suspend 로직 무변경)
M  backend/.../user/service/AuthService.java              (탈퇴 체크 2곳 추가)
M  backend/.../user/service/UserService.java              (withdraw 메서드 추가)
M  frontend/src/App.jsx                                   (/mypage, /bookmarks 라우트 교체)
M  frontend/src/api/feedApi.js                             (introduce, fetchMyFeedProfile 등 확장)
M  frontend/src/pages/{TravelDetailPage,EnjoyDetailPage,EnjoyCategoryPage}.jsx (저장 버튼 실연동)
M  frontend/src/pages/TravelDetailPage.css                 (.is-local-only 스타일 추가)

A  backend/db/migrations/2026-10-02-mypage-bookmarks.sql
A  backend/.../feed/controller/FeedBookmarkController.java
A  backend/.../feed/dto/FeedBookmarkPageResponse.java
A  backend/.../user/dto/UserWithdrawalRequest.java
A  backend/src/test/.../feed/{FeedBookmarkServiceTest,FeedProfileUpdateServiceTest}.java
A  backend/src/test/.../user/UserWithdrawalFlowTest.java
A  frontend/src/api/{tourBookmarkApi,userApi}.js
A  frontend/src/components/mypage/{ProfileSection,AccountSettingsSection,PasswordChangeForm,WithdrawalDialog}.jsx(+css)
A  frontend/src/hooks/{useFeedBookmarks,useMyFeedProfile,usePasswordChangeFlow,useTourBookmarks,useWithdrawal}.js
A  frontend/src/pages/{MyPage,BookmarksPage}.jsx(+css)
```

`FeedController.java`, `FeedProfileController.java`의 GET 분기, `SecurityConfig.java`, `FeedPage.jsx`, `FeedUserProfilePage.jsx`, `AdminUserListPage.jsx`/`AdminUserDetailPage.jsx`, 관리자 피드 모더레이션 전체는 `git status`에 나타나지 않거나(또는 해당 파일 내 무관한 분기만) 기존 동작을 유지함을 확인했다.

---

## 6. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 91.2%                   │
├─────────────────────────────────────────────┤
│  Structural:  100%                           │
│  Functional:   95%                           │
│  Contract:     83%                           │
│  Critical Gap: 1건(완료·수정됨)               │
│  Important Gap: 1건(완료·수정됨)              │
│  Minor Gap: 5건(후속 과제)                    │
│  프로세스 Gap: 1건(단위 테스트 공백, 후속 과제)│
└─────────────────────────────────────────────┘
```

Match Rate가 계획 §4.2 목표(90% 이상)를 상회하지만, 이전 사이클들(98~99%대)보다 뚜렷하게 낮다. 이는 **이번 사이클에서 발견된 결함의 심각도가 이전 사이클보다 높았기 때문**이다 — G-1은 "기능이 설계와 다르게 구현됨" 수준이 아니라 "이번 사이클의 존재 이유였던 핵심 기능(가짜 버튼 교체)이 실질적으로 작동하지 않는" 수준의 결함이었다. Critical 1건과 Important 1건은 Report 작성 시점 기준 전건 수정 완료됐으나, gap 분석은 발견 당시의 심각도를 희석하지 않고 그대로 기록한다.

---

## 7. 권장 조치

### 7.1 코드 수정

없음. Critical 1건·Important 1건 모두 이미 수정 완료됐다(§2.3, §3).

### 7.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-1: 설계 §3.5·§4.6의 `toggleTourBookmark` 응답 필드 예시를 `{saved}` → `{active}`로 정정
- G-4: 설계 §5.1에 "PRIVATE 배지는 백엔드 `FeedPostResponse`에 필드가 없어 이번 사이클 보류"를 명시
- G-3: 설계 §4.4에 두 체크포인트의 실제 순서(login: 탈퇴→정지, refresh: 정지→탈퇴)를 정확히 기록

### 7.3 후속 과제 (다음 세션 또는 다음 PDCA)

- **G-8(최우선)**: `tourBookmarkApi.js`/`handleToggleSave` 계열에 응답 필드 계약을 검증하는 프론트 단위 테스트 추가 — G-1과 동일한 유형의 결함 재발 방지
- G-4: 백엔드 `FeedPostResponse`에 `visibility` 필드 추가 여부를 별도 PDCA(프론트 우선순위 원칙에 따라 신중히)로 검토
- G-3: `AuthService.login`/`refreshToken`의 탈퇴·정지 체크 순서 통일(위험 낮은 리팩토링)
- G-5: 피드 목록 API 전반의 `photos` N+1을 별도 PDCA에서 일괄 검토
- JDK 25 환경(또는 CI)에서 `mvnw clean test` 전체 실행으로 121/121 통과를 이 세션 기준으로도 재현·확정(다섯 번째로 반복되는 환경 제약)
- 브라우저 자동화 환경에서 §4.3 L2 체크리스트 실행

---

## 8. Next Steps

- [x] Critical gap 1건(G-1) 수정 확인
- [x] Important gap 1건(G-2) 수정 확인
- [x] 코드 리뷰 반영 확인
- [ ] Completion Report 작성(`mypage-bookmarks.report.md`)
- [ ] 후속: 프론트 북마크 토글 단위 테스트 추가(G-8, 최우선)
- [ ] 후속: JDK 25(또는 CI) 환경에서 `mvnw clean test` 전체 실행, 이 세션 기준으로도 재현
- [ ] 후속: 브라우저 자동화 환경에서 L2 체크리스트 실행
- [ ] 후속: 설계 문서 3곳(G-1, G-3, G-4) 갱신

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-10-02 | 최초 gap 분석. Overall Match Rate 91.2%. Critical 1건(`tourBookmarkApi.js` 응답 필드명 오독 — 설계 문서 자체의 오기가 원인, 저장 버튼이 항상 롤백되는 것처럼 보이던 핵심 결함)과 Important 1건(로컬 전용 버튼 시각적 구분)을 완료로, 설계-백엔드 불일치(PRIVATE 배지 미구현)와 체크포인트 순서 불일치·N+1·테스트 공백 등 5건을 Minor/후속 과제로 분류. 세션 중단 후 재개 과정에서 발견·수정한 `react-hooks/set-state-in-effect` 린트 위반 2건도 구조적 일치 섹션에 기록. 백엔드 자동 테스트는 다섯 번째로 반복되는 JDK 버전 제약으로 이 세션에서 재현하지 못했으나, 기존 `surefire-reports` 실행 기록(15/15, 전체 121/121)과 코드 정독으로 결과를 확인 | frontend-lead (Claude Code 보조) |
