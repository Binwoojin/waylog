# mypage-bookmarks 계획 문서

> **요약**: `/mypage`, `/bookmarks`는 현재 둘 다 `ComingSoonPage`다. feed-integration 계획 문서 Q-8에서 "이번 범위 제외"로 명시적으로 보류됐던 항목이며, 이번에 착수한다.
>
> 코드 조사 결과 두 화면 모두 "이미 있는 API를 연결하면 되는 부분"과 "신규 개발이 필요한 부분"이 섞여 있다. 특히 **북마크는 생각보다 범위가 넓다** — 백엔드에 서로 다른 성숙도를 가진 **두 개의 완전히 분리된 북마크 도메인**(`feed` 패키지의 피드 북마크, `tour.bookmark` 패키지의 여행지/즐길거리 북마크)이 이미 존재하고, 그중 `tour.bookmark`는 토글·목록 조회 API가 **전부 완성돼 있는데 프론트가 단 한 줄도 연결하지 않은 상태**다. 게다가 `TravelDetailPage`·`EnjoyCategoryPage`·`EnjoyDetailPage`에는 **저장되지 않는 로컬 state만으로 동작하는 "가짜 북마크 버튼"**이 지금도 남아 있다.
>
> **사용자 결정(8장, Q-1~Q-8) 완료**. 범위는 (1) 마이페이지 프로필 수정(기존 `/api/v1/feed/profile` 확장) (2) 계정 설정(비밀번호 변경·회원 탈퇴 포함) (3) 북마크는 피드+투어 탭 통합, 가짜 저장 버튼 3곳 전부 실제 API로 교체로 **확정**됐다. 설계 과정에서 추가로 확인한 사실 두 가지가 있다: `ForgotPasswordPage.jsx`가 백엔드 호출이 전혀 없는 **완전히 정적인 화면**이라는 점(비밀번호 변경 플로우를 마이페이지가 사실상 최초로 실제 연동하게 된다), 그리고 `FeedPost.java`에 "회원을 삭제하더라도 게시글을 어떻게 처리할지는 추후 정책으로 결정해야 합니다"라는 주석이 이미 존재해 회원 탈퇴 시 게시물 처리 정책이 프로젝트 차원에서 미정이었다는 점이다(이번 설계에서 최소 범위로 결정, Design 문서 §3 참고).
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-10-01
> **상태**: Approved / **사용자 결정 완료**(2026-10-01) / 설계 문서 작성 완료(`mypage-bookmarks.design.md`)
> **근거**: `frontend/src/App.jsx`, `backend/.../feed/**`, `backend/.../tour/bookmark/**`, `backend/.../user/**` 코드 직접 확인

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | `/mypage`, `/bookmarks`가 `ComingSoonPage`뿐이라 네비게이션에 노출된 두 메뉴가 전혀 동작하지 않는다. 회원 프로필(닉네임·소개·프로필이미지) 수정 API, 북마크 목록 조회(피드), 회원 탈퇴 API가 백엔드에 아예 없다. 비밀번호 변경 API는 있지만 어떤 화면도 실제로 호출한 적이 없다(`ForgotPasswordPage`는 정적 UI). 여행지/즐길거리 북마크는 백엔드가 완성돼 있지만 프론트 연동이 전혀 없다 |
| **해결** | 기존 `GET/PATCH /api/v1/feed/profile`을 확장(닉네임·소개·프로필이미지 추가), 계정 설정(비밀번호 변경·회원 탈퇴)을 마이페이지에 연결, 피드 북마크 목록 API 신설, `tour-bookmarks` API를 프론트에 연결해 `/bookmarks`를 피드+여행지+즐길거리 통합 화면으로 구성, 가짜 저장 버튼 3곳을 실제 토글로 교체 |
| **기능/UX 효과** | 사용자가 프로필을 확인·수정하고, 비밀번호를 바꾸거나 탈퇴할 수 있고, 본인이 쓴 글을 모아 보고, 여행지·즐길거리·피드에서 북마크한 콘텐츠를 한 화면에서 다시 찾아보고 해제할 수 있다 |
| **핵심 가치** | "메뉴는 있는데 화면이 없다"는 반복 패턴을 조사로 걷어내면서, 같은 이름(북마크)의 서로 다른 두 백엔드 도메인을 하나의 화면으로 통합한 근거, 과거부터 존재했던 "거짓 UI"(가짜 북마크 버튼, 정적 비밀번호 찾기 화면)를 식별하고 실제 API 연동으로 교체한 과정, 기존 정지(suspend) 로직의 설계 패턴을 탈퇴(withdraw)에 그대로 재사용한 판단을 면접에서 설명할 수 있다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | `/mypage`, `/bookmarks`는 네비게이션(`data/navigation.js`)에 "마이 페이지", "북마크" 메뉴로 이미 노출돼 있지만 `ComingSoonPage`만 보인다 |
| **WHO** | 로그인한 사용자 본인(두 화면 모두 본인 전용, 비로그인 접근 불가) |
| **RISK** | 회원 탈퇴 시 게시물·댓글·좋아요·북마크 처리 정책이 기존 코드에 전혀 없어 신규로 정의해야 함(이번 사이클은 최소 범위로 한정, Design §3.3 참고) / 북마크가 두 도메인으로 쪼개져 있어 화면 통합 복잡도가 있음 / 비밀번호 변경이 처음 실제 연동되는 플로우라 검증된 프론트 패턴이 없음 |
| **SUCCESS** | `/mypage`에서 프로필 조회·수정, 비밀번호 변경, 회원 탈퇴, 내가 쓴 글 목록이 모두 동작 / `/bookmarks`에서 피드·여행지·즐길거리 탭 북마크 목록 조회와 즉시 해제가 동작 / 가짜 저장 버튼 3곳이 실제 API로 교체 |
| **SCOPE** | Design 문서(`mypage-bookmarks.design.md`)에서 API 응답 모양, 컴포넌트 구조, 라우팅을 구체화함 |

---

## 1. 개요

### 1.1 목적

네비게이션에 이미 노출된 "마이 페이지", "북마크" 메뉴가 실제로 동작하도록 두 화면을 만든다. 프로필 조회·수정, 계정 설정(비밀번호 변경·탈퇴), 내가 쓴 글 목록을 마이페이지에, 피드·여행지·즐길거리 북마크 통합 조회·해제를 북마크 화면에 구현한다.

### 1.2 배경 (코드 확인 결과)

#### 1.2.1 마이페이지 — 회원 프로필

| 항목 | 확인 내용 |
|------|-----------|
| `GET/PATCH /api/v1/feed/profile` | "SNS 전용" 프로필. `FeedProfileResponse`는 `nickname`(읽기 전용)·`feedHandle`(피드 전용 @아이디)·`profileImageUrl`(읽기 전용)·`postCount`·`receiveLikeCount`·`posts`를 반환. **PATCH는 `feedHandle` 하나만 수정 가능** → **Q-2 결정: 이 엔드포인트를 확장**해 닉네임·소개·프로필이미지까지 함께 수정 |
| 닉네임/소개/프로필이미지 수정 | 백엔드에 수정 API가 전혀 없었음. `UserEntity`에 `nickname`·`introduce`(소개, 최대 200자)·`profileImageUrl` 컬럼은 이미 존재하지만 변경 메서드가 없음. `introduce`는 선언만 되고 어디서도 읽거나 쓰이지 않는 죽은 컬럼이었음 |
| 닉네임 중복확인 | `GET /api/v1/users/check-nickname`이 이미 있지만 본인의 기존 닉네임도 "사용 중"으로 걸리는 문제 존재 → **Q-4 결정: `FeedProfileService.updateMyHandle`처럼 "값이 실제로 바뀐 경우에만" 서버가 중복확인**하도록 처리(프론트는 단순히 값을 보내기만 함) |
| 프로필 이미지 업로드 | `board.storage.S3StorageService`(`upload`/`delete`/`createReadUrl`)가 피드 이미지 업로드에 이미 쓰이고 있고 특정 도메인에 묶여 있지 않아 재사용 가능 → **Q-3 결정: 저장 버튼을 눌러야 일괄 반영**(피드 작성 폼과 동일하게 multipart로 텍스트 필드+이미지를 한 번에 전송) |
| 비밀번호 변경 | `PUT /api/v1/auth/password`가 이미 존재. 다만 **이메일 인증 코드 → 1회용 티켓 발급 → 티켓 제시 후 변경**이라는 "비밀번호 찾기"와 동일한 플로우를 요구한다(로그인 상태에서 "현재 비밀번호 확인"으로 바로 바꾸는 방식이 아님). **중요 발견**: 이 플로우를 사용하는 `ForgotPasswordPage.jsx`를 확인한 결과, 이 화면은 **`apiClient` 호출이 단 한 줄도 없는 완전히 정적인 화면**이었다(입력창·타이머·버튼이 전부 로컬 state로만 동작). 즉 이 API들은 지금까지 **어떤 화면도 실제로 호출한 적이 없다** |
| 회원 탈퇴 | 코드베이스 전체에서 탈퇴 관련 API·서비스 메서드를 찾지 못함. 다만 `UserEntity`에 이미 "정지"(`suspendedUntil`/`suspensionReason`/`suspendedAt`, `isSuspended()`, `suspend()`/`liftSuspension()`) 기능이 구현돼 있고, 로그인(`AuthService.login`)·리프레시(`AuthService.refresh`)·매 요청(`JwtAuthenticationFilter`) 3곳에서 `isSuspended()`를 검사하는 패턴이 이미 있다. **탈퇴도 같은 구조(영구 버전의 정지)로 재사용 가능** |
| 회원 탈퇴 시 데이터 정책 | `FeedPost.java`에 "회원을 삭제하더라도 게시글을 어떻게 처리할지는 추후 정책으로 결정해야 합니다"라는 주석이 이미 존재 — 프로젝트 차원에서 미정이었던 사항. `author` FK가 `nullable = false`라 탈퇴 시 작성자를 null로 바꾸는 것은 스키마 변경 없이는 불가능 |

#### 1.2.2 마이페이지 — 내가 쓴 글

`GET /api/v1/feed/profile`가 이미 본인 게시물 목록을 offset 페이지네이션(`page`/`size`, 기본 12)으로 함께 내려준다(신규 API 불필요). `FeedUserProfilePage.jsx` + `useFeedUserProfile.js`가 거의 동일한 화면(아바타·닉네임·`@핸들`·게시물 수·받은 좋아요 수·게시물 그리드·offset 페이지네이션·좋아요/북마크 낙관적 토글)을 이미 구현해 두었다. 차이는 "본인 프로필"이라 수정 UI가 추가되고 인증이 필요하며 `PRIVATE` 게시물도 섞여 내려온다는 점.

#### 1.2.3 북마크 — 두 개로 분리된 백엔드 도메인

**(A) 피드 북마크 (`feed` 패키지)**: 토글(`POST /api/v1/feed/posts/{id}/bookmarks`)은 완성, 목록 조회는 없음(`FeedBookMarkRepository`에 단건 확인용 메서드뿐) → 신규 백엔드 필요. `FeedBookMark.createdAt`(북마크 시각) 컬럼이 이미 존재해 **Q-7 결정(북마크 시각 기준 정렬)**을 스키마 변경 없이 바로 적용 가능함을 확인.

**(B) 여행지/즐길거리 북마크 (`tour.bookmark` 패키지)**: 토글(`POST /api/v1/tour-bookmarks/toggle`)과 목록 조회(`GET /api/v1/tour-bookmarks?group=DESTINATION|ENJOY&page=&size=`, `createdAt` 내림차순)가 **이미 완성**돼 있다. `TourBookmarkGroup`으로 여행지/즐길거리 탭 구분까지 설계돼 있다. **프론트 연동이 전혀 없다** — `TourCard.jsx`는 "저장되지 않는 버튼은 사용자를 속인다"는 이유로 카탈로그 카드의 북마크 버튼을 의도적으로 제거한 상태(`destination-list-integration` Q-1).

**발견된 문제**: `TravelDetailPage.jsx`·`EnjoyCategoryPage.jsx`·`EnjoyDetailPage.jsx`에는 `useState`만으로 토글되는 가짜 "저장" 버튼이 남아 있다(새로고침하면 사라짐, 서버 저장 없음). `TourCard.jsx`가 피했던 문제가 이 세 화면에는 그대로 남아 있었다. → **Q-6 결정: 실제 `tour-bookmarks` API로 교체**.

#### 1.2.4 프론트엔드 재사용 대상

| 기존 패턴 | 재사용 가능 범위 |
|-----------|------------------|
| `FeedUserProfilePage.jsx` / `useFeedUserProfile.js` | 레이아웃·offset 페이지네이션·낙관적 토글 구조를 마이페이지가 재사용. 훅은 `userId` 기반 공개 조회 전용이라 "내 프로필"에는 새 훅 필요 |
| `feedApi.js`의 view-model 변환·fail-closed 파싱 원칙 | 신규 API(회원 프로필 확장, 피드 북마크 목록, tour-bookmarks) 모두 동일 원칙 |
| `FeedCard.jsx`의 좋아요/북마크 낙관적 토글 | 북마크 목록의 해제 버튼에도 동일 패턴 |
| `BookmarkIcon.jsx`, `.catalog-card__bookmark` CSS | 이미 존재(미사용 상태) → `tour.bookmark` 연동에 재사용 |
| `UserEntity.suspend()`/`isSuspended()` 패턴 | 탈퇴(`withdraw()`/`isWithdrawn()`)에 동일 구조 재사용 |
| `FeedController.create()`의 멀티파트(`@RequestPart` JSON Blob + 파일) 패턴 | 확장된 `PATCH /api/v1/feed/profile`에도 동일 패턴 적용 |

### 1.3 관련 문서

- `docs/01-plan/features/feed-integration.plan.md` 8장 Q-8 — 이번 기능의 출발점
- `docs/01-plan/features/destination-list-integration.plan.md` 2.1절, `docs/02-design/features/destination-list-integration.design.md` Q-1 — 카탈로그 카드 북마크 버튼 제거 결정과 이유
- `docs/02-design/features/mypage-bookmarks.design.md` — 이번 사이클 상세 설계(API 응답 모양, 컴포넌트 구조, 라우팅)

---

## 2. 범위

### 2.1 포함

- [ ] 백엔드: `/api/v1/feed/profile` GET/PATCH 확장 — 닉네임·소개·프로필이미지 추가, PATCH를 멀티파트로 변경
- [ ] 백엔드: 닉네임 변경 시 "값이 바뀐 경우만" 중복확인
- [ ] 백엔드: `UserEntity`에 탈퇴 필드(`withdrawnAt`)·메서드 추가, 로그인/리프레시/JwtAuthenticationFilter 3곳에 탈퇴 체크 추가
- [ ] 백엔드: 회원 탈퇴 API 신규(비밀번호 재확인 필수)
- [ ] 백엔드: 피드 북마크 목록 조회 API 신규(북마크 시각 내림차순)
- [ ] 프론트: 마이페이지 — 프로필 조회/수정(닉네임·소개·프로필이미지·@피드아이디), 내가 쓴 글 목록
- [ ] 프론트: 마이페이지 — 계정 설정(비밀번호 변경, 회원 탈퇴)
- [ ] 프론트: `tourBookmarkApi.js` 신규(기존 `tour-bookmarks` API 연결)
- [ ] 프론트: `/bookmarks` — 피드/여행지/즐길거리 3탭 통합 화면, 탭별 목록+즉시 해제
- [ ] 프론트: `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 가짜 저장 버튼을 실제 `tour-bookmarks` 토글로 교체
- [ ] 프론트: `App.jsx`의 `/mypage`, `/bookmarks` 라우트를 `ComingSoonPage`에서 실제 화면으로 교체
- [ ] 프론트: 비로그인 사용자가 두 화면에 접근 시 로그인 유도

### 2.2 제외

- 회원 탈퇴 시 게시물/댓글/좋아요/북마크의 완전한 익명화 또는 연쇄 삭제 — 이번 사이클은 "로그인 차단"까지만(최소 범위, Design §3.3에 정책과 후속 과제로 명시)
- 2단계 인증, 로그인 기기 관리 등 추가 계정 보안 기능
- 피드 게시물 수정 — 기존 결정 유지(`feed-integration` Q-2)
- 댓글·답글 — `feed-comment-integration`(별도 사이클) 대상
- 여행 코스 북마크 — `TourBookmarkGroup`에 코스 그룹이 없어 범위 밖
- `ForgotPasswordPage.jsx`를 실제 API로 연동하는 작업 — 이번 설계로 만드는 비밀번호 변경 플로우와 유사하지만 별개 화면이라 이번 사이클 범위에 포함하지 않음(후속 과제로 기록)

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | 백엔드: `FeedProfileResponse`/`FeedProfileUpdateRequest` 확장(닉네임·소개·프로필이미지), PATCH를 멀티파트로 변경 | High | frontend-support-backend | Pending |
| FR-02 | 백엔드: 닉네임 변경 시 "값이 바뀐 경우만" 중복확인(`updateMyHandle` 패턴 재사용) | High | frontend-support-backend | Pending |
| FR-03 | 백엔드: `UserEntity`에 `nickname`/`introduce`/`profileImageUrl` 변경 메서드 추가 | High | frontend-support-backend | Pending |
| FR-04 | 프론트: 마이페이지 프로필 조회/수정 폼(`FeedUserProfilePage` 레이아웃 재사용) | High | frontend-lead | Pending |
| FR-05 | 프론트: 마이페이지 "내가 쓴 글" 목록(`GET /api/v1/feed/profile` 연결) | High | frontend-lead | Pending |
| FR-06 | 프론트: 비밀번호 변경 — 이메일 인증코드 발송/확인 + `PUT /api/v1/auth/password` 연동(기존 API 최초 실연동) | High | frontend-lead | Pending |
| FR-07 | 백엔드: `UserEntity.withdrawnAt` 추가, `isWithdrawn()`, 로그인/리프레시/`JwtAuthenticationFilter` 3곳 체크(`isSuspended` 패턴 재사용) | High | frontend-support-backend | Pending |
| FR-08 | 백엔드: 회원 탈퇴 API 신규(비밀번호 재확인, 리프레시 쿠키 무효화) | High | frontend-support-backend | Pending |
| FR-09 | 프론트: 탈퇴 확인 다이얼로그(비밀번호 입력, 돌이킬 수 없음 경고) | High | frontend-lead | Pending |
| FR-10 | 백엔드: `FeedBookMarkRepository`에 페이지네이션 목록 조회 메서드 추가(북마크 시각 내림차순, 소프트 삭제된 원글 제외) | High | frontend-support-backend | Pending |
| FR-11 | 백엔드: 피드 북마크 목록 서비스+컨트롤러 엔드포인트 신규(`GET /api/v1/feed/bookmarks`) | High | frontend-support-backend | Pending |
| FR-12 | 프론트: `feedApi.js`에 `fetchFeedBookmarks` 추가 | High | frontend-lead | Pending |
| FR-13 | 프론트: `tourBookmarkApi.js` 신규(toggle, 목록조회) | High | frontend-lead | Pending |
| FR-14 | 프론트: `TravelDetailPage`/`EnjoyDetailPage`/`EnjoyCategoryPage`의 가짜 저장 버튼을 `tourBookmarkApi` 토글로 교체 | High | frontend-lead | Pending |
| FR-15 | 프론트: `/bookmarks` 화면 — 피드/여행지/즐길거리 3탭, 탭별 목록·로딩·에러·빈 상태 | High | frontend-lead | Pending |
| FR-16 | 프론트: 북마크 해제 시 목록에서 즉시 제거(낙관적) + 실패 시 롤백 | Medium | frontend-lead | Pending |
| FR-17 | 프론트: `App.jsx`의 `/mypage`, `/bookmarks` 라우트 교체, 비로그인 접근 시 로그인 유도 | High | frontend-lead | Pending |

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 거짓 UI 금지 | 북마크·저장 버튼은 실제 API 호출과 연결된 것만 노출. 가짜 로컬 state 버튼 신규 생성 금지 | 코드 리뷰 |
| 낙관적 UI 일관성 | 북마크 토글은 기존 `FeedUserProfilePage`/`FeedCard` 패턴과 동일하게 낙관적 업데이트 + 실패 시 롤백 | 코드 리뷰 + 수동 확인 |
| 권한 분리 | 본인 프로필 수정·탈퇴 API는 토큰의 이메일로만 대상을 특정(요청 바디의 ID 불신) | 코드 리뷰 |
| 탈퇴 보안 | 탈퇴는 비밀번호 재확인 필수, 성공 시 리프레시 쿠키 무효화 및 즉시 로그아웃 | 코드 리뷰 + 수동 확인 |
| 메모리 누수 방지 | 프로필 이미지 미리보기 `URL.createObjectURL` 사용 시 `revokeObjectURL` | 코드 리뷰 |
| 접근성 | 폼 에러 메시지, 북마크 토글 `aria-pressed`, 탭 전환 `role="tablist"` | 코드 리뷰 |
| 반응형 | 마이페이지·북마크 화면이 모바일 폭에서 깨지지 않음 | 브라우저 크기 조절 |
| 회귀 방지 | 기존 피드 타임라인/상세/타인 프로필의 북마크·좋아요 토글에 변화 없음 | 수동 확인 |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] `/mypage`에서 본인 프로필(닉네임·소개·프로필이미지·@피드아이디)을 조회·수정할 수 있다
- [ ] `/mypage`에서 본인이 쓴 글 목록을 볼 수 있다
- [ ] `/mypage`에서 비밀번호를 변경할 수 있다(이메일 인증 플로우)
- [ ] `/mypage`에서 회원 탈퇴를 할 수 있고, 탈퇴 후 재로그인이 차단된다
- [ ] `/bookmarks`에서 피드/여행지/즐길거리 탭별 북마크 목록을 볼 수 있다
- [ ] `/bookmarks`에서 북마크를 해제하면 목록에서 즉시 제거된다
- [ ] `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 저장 버튼이 실제로 서버에 북마크를 남긴다
- [ ] 로딩·에러(재시도)·빈 상태가 구분되어 표시된다
- [ ] 비로그인 사용자는 두 화면 모두에서 로그인 화면으로 안내된다
- [ ] frontend-code-reviewer 리뷰와 gap 분석 완료

### 4.2 품질 기준

- [ ] `npm run lint` 오류 0, `npm run build` 성공
- [ ] 백엔드 `mvnw clean test` 통과
- [ ] gap 분석 Match Rate 90% 이상

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 회원 탈퇴 시 게시물 처리 정책이 기존에 전혀 없었음(`FeedPost.java` 주석으로 확인) | High | 확실 | 이번 사이클은 "로그인 차단"까지만 최소 범위로 한정하고, 게시물 익명화/연쇄 삭제는 후속 과제로 명시(Design §3.3) — 거짓 범위 확장을 피함 |
| 비밀번호 변경 API가 지금까지 어떤 화면도 실제로 호출한 적이 없어(ForgotPasswordPage가 정적 UI) 검증된 프론트 통합 사례가 없음 | Medium | Medium | 이메일 인증 코드 발송·확인·티켓 기반 변경이라는 백엔드 계약을 Design 문서에서 먼저 구체화하고, 재사용 가능한 훅/컴포넌트로 분리해 추후 `ForgotPasswordPage` 실연동 시 재사용 여지를 남긴다 |
| 닉네임 중복확인 로직을 서버에서 "값이 바뀐 경우만" 처리하도록 바꾸면 기존 회원가입 화면의 `check-nickname` 호출과 의미가 미묘하게 달라질 수 있음 | Low | Low | 기존 `GET /api/v1/users/check-nickname`은 그대로 두고, 마이페이지 전용 로직은 새 PATCH 엔드포인트 내부에서만 처리(기존 엔드포인트 시그니처 변경 없음) |
| `tour.bookmark`와 `feed` 북마크를 한 화면에 합쳐 탭 전환 시 상태 관리가 복잡해질 수 있음 | Medium | Medium | 탭별로 완전히 독립된 하위 컴포넌트+훅으로 분리(상태 공유 없음) |
| 가짜 저장 버튼 3곳을 실제 API로 교체하면서 기존 화면 동작에 회귀가 생길 위험 | Medium | Low | 버튼 교체 외 나머지 로직은 건드리지 않음, 회귀 체크리스트로 수동 확인 |

---

## 6. 영향 분석

### 6.1 변경 자원

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `backend/.../feed/dto/FeedProfileResponse.java`, `FeedProfileUpdateRequest.java` | 백엔드 | 닉네임·소개·프로필이미지 필드 추가 |
| `backend/.../feed/controller/FeedProfileController.java`, `feed/service/FeedProfileService.java` | 백엔드 | PATCH 멀티파트 전환, 프로필 수정 로직 |
| `backend/.../user/entity/UserEntity.java` | 백엔드 | `nickname`/`introduce`/`profileImageUrl` 변경 메서드, `withdrawnAt`/`isWithdrawn()`/`withdraw()` 추가 |
| `backend/.../user/controller/UserController.java`, `user/service/UserService.java` | 백엔드 | 탈퇴 엔드포인트·서비스 추가 |
| `backend/.../config/JwtAuthenticationFilter.java`, `user/service/AuthService.java` | 백엔드 | 탈퇴 체크 추가(로그인·리프레시·필터 3곳) |
| `backend/.../feed/repository/FeedBookMarkRepository.java`, `feed/service/FeedService.java`, `feed/controller/FeedController.java` | 백엔드 | 피드 북마크 목록 조회 추가 |
| `frontend/src/pages/MyPage.jsx`(가칭), `BookmarksPage.jsx`(가칭) | 신규 페이지 | |
| `frontend/src/hooks/useMyFeedProfile.js`, `usePasswordChangeFlow.js`, `useFeedBookmarks.js`, `useTourBookmarks.js`(가칭) | 신규 훅 | |
| `frontend/src/api/feedApi.js`(확장), `tourBookmarkApi.js`(신규), `userApi.js`(신규, 탈퇴/비밀번호) | API 모듈 | |
| `frontend/src/pages/TravelDetailPage.jsx`, `EnjoyCategoryPage.jsx`, `EnjoyDetailPage.jsx` | 기존 수정 | 가짜 저장 버튼 → 실제 `tour-bookmarks` 토글 |
| `frontend/src/App.jsx` | 라우팅 | `/mypage`, `/bookmarks` 라우트 교체 |

### 6.2 현재 사용처(영향받을 수 있는 곳)

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `GET/PATCH /api/v1/feed/profile` | 없음(이번 사이클이 최초 실제 호출자) | 기존 동작 영향 없음, 응답 필드 추가는 하위 호환 |
| `PUT /api/v1/auth/password`, 이메일 인증 API | `ForgotPasswordPage.jsx`(정적, 실제로는 미사용) | 영향 없음(기존 화면은 애초에 호출하지 않았음) |
| `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 저장 버튼 | 각 화면 자체 로컬 state | 로컬 → 서버 연동으로 동작 방식이 바뀜, 회귀 체크 필요 |
| `data/navigation.js`의 "마이 페이지"/"북마크" 메뉴 | `Header.jsx` | 이미 연결돼 있어 라우트 교체만으로 동작 시작 |

### 6.3 검증

- [ ] 기존 피드 타임라인/상세/타인 프로필의 좋아요·북마크 토글에 회귀 없음
- [ ] 탈퇴 후 기존 세션(액세스 토큰)으로 보호된 API 호출 시 즉시 거부됨
- [ ] 탈퇴한 회원이 작성한 기존 게시물·댓글이 깨지지 않고 그대로 표시됨(작성자 닉네임 그대로 노출되는 것은 이번 사이클의 알려진 한계로 문서화)

---

## 7. 프론트엔드 아키텍처 고려사항

### 7.1 기존 패턴 재사용 방안

| 기존 패턴 | 재사용 가능한가 | 근거 |
|-----------|------------------|------|
| `FeedUserProfilePage.jsx`의 레이아웃 | **가능** | 마이페이지는 "본인 버전 + 수정 UI"로 확장 |
| `useFeedUserProfile.js` | **부분적** | 공개 조회 전용이라 "내 프로필"에는 새 훅 필요, 상태 전이 원칙은 계승 |
| `feedApi.js`의 fail-closed view-model 변환 | **가능** | 신규 API 모듈도 동일 원칙 |
| `FeedCard.jsx`의 낙관적 토글 | **가능** | 북마크 목록 해제 버튼에도 동일 패턴 |
| `BookmarkIcon.jsx`, `.catalog-card__bookmark` CSS | **가능**(미사용 상태로 이미 존재) | `tour.bookmark` 연동에 재사용 |
| `FeedController.create()`의 멀티파트 패턴 | **가능** | 프로필 수정 PATCH에도 동일하게 적용 |

### 7.2 상태 관리

| 상태 | 위치 | 이유 |
|------|------|------|
| 내 프로필 데이터 | 페이지 전용 훅 내부 state | 서버 상태, `AuthContext`는 인증 상태만 다룬다는 기존 경계 유지 |
| 북마크 목록(피드/투어) | 탭별 독립 훅 내부 state | 전역 store 불필요, 탭 간 상태 공유 없음 |
| 프로필 수정·탈퇴 폼 입력값 | 폼 컴포넌트 내부 state | 로컬 UI 상태 |

새 Context나 전역 store는 만들지 않는다.

### 7.3 작업 분담 (CLAUDE.md bkit 협업 규칙)

```
frontend-lead            : FR-04~06, FR-09, FR-12~17 (프론트 전체)
frontend-support-backend : FR-01~03, FR-07~08, FR-10~11 (백엔드 신규/확장)
frontend-code-reviewer   : 구현 후 리뷰
bkit gap-detector        : 설계 대비 gap 분석
frontend-interview-coach : 완료 보고서 후 포트폴리오 자료 추출
```

---

## 8. 사용자 결정 (결정됨, 2026-10-01)

| # | 결정 | 선택 | 비고 |
|---|------|------|------|
| Q-1 | 계정 설정(비밀번호 변경·회원 탈퇴) 포함 여부 | **B) 포함**(추천안과 반대) | 탈퇴 시 게시물 처리는 최소 범위로 한정(§2.2 제외, Design §3.3) |
| Q-2 | 회원 프로필 API 구조 | **B) 기존 `/api/v1/feed/profile` 확장**(추천안 채택) | 닉네임·소개·프로필이미지 필드 추가, 신규 엔드포인트 없음 |
| Q-3 | 프로필 이미지 업로드 UX | **B) 저장 시 일괄 반영**(추천안 채택) | 피드 작성 폼과 동일한 멀티파트 패턴 |
| Q-4 | 닉네임 중복확인 처리 | **B) 값이 바뀔 때만 서버가 검사**(추천안 채택) | `FeedProfileService.updateMyHandle` 패턴 재사용 |
| Q-5 | `/bookmarks` 범위 | **B) 피드+투어 탭 통합**(추천안 채택) | 피드는 목록 API 신규, 투어는 기존 API 연결 |
| Q-6 | 가짜 저장 버튼 교체 | **A) 포함**(강력 추천안 채택) | 3개 화면(`TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`) 전부 교체 |
| Q-7 | 피드 북마크 정렬 기준 | **A) 북마크한 시각**(추천안 채택) | `FeedBookMark.createdAt` 컬럼으로 스키마 변경 없이 적용 가능 확인 |
| Q-8 | 북마크 해제 포함 여부 | **A) 포함, 즉시 제거**(추천안 채택) | Undo 없음 |

구체적인 API 응답 모양, 탈퇴 정책 범위, 컴포넌트 구조, 라우팅은 `docs/02-design/features/mypage-bookmarks.design.md`에 구체화했다.

---

## 9. 다음 단계

1. [x] 코드 조사
2. [x] 8장 사용자 결정 (Q-1 ~ Q-8)
3. [x] 설계 문서 작성 (`mypage-bookmarks.design.md`)
4. [ ] 백엔드 구현 (frontend-support-backend): FR-01~03, FR-07~08, FR-10~11
5. [ ] 프론트 구현 (frontend-lead): FR-04~06, FR-09, FR-12~17
6. [ ] 코드 리뷰 (frontend-code-reviewer) + gap 분석
7. [ ] 완료 보고서 → 포트폴리오 추출 (frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-10-01 | 초안. `/mypage`, `/bookmarks` 관련 백엔드(`feed`, `tour.bookmark`, `user` 패키지)·프론트 전수 조사. Q-1~Q-8 사용자 결정 요청 정리 | WOOJIN |
| 0.2 | 2026-10-01 | 사용자 결정 반영(Q-1~Q-8). 설계 단계에서 `ForgotPasswordPage.jsx`가 완전히 정적인 화면임을 추가 발견(비밀번호 변경 API를 지금까지 아무도 호출한 적 없음), `FeedPost.java`의 기존 주석으로 회원 탈퇴 데이터 정책이 미정이었음을 확인 → 탈퇴는 "로그인 차단"까지 최소 범위로 한정. 범위·FR·위험·영향분석을 결정에 맞게 확정. 상태를 Approved로 변경 | WOOJIN |
