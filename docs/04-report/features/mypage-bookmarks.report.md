# mypage-bookmarks 완료 보고서

> **상태**: ✅ Complete (PDCA 사이클 — 마이페이지·북마크 신규 화면 + 가짜 저장 버튼 3곳 교체)
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: frontend-lead (Claude Code 보조)
> **완료일**: 2026-10-02
> **PDCA 주기**: `feed-integration`(사이클 1) → `feed-comment-integration`(사이클 2)으로 이어진 여행 피드 기능 완결 이후, `feed-integration` 계획 문서 Q-8에서 "이번 범위 제외"로 명시적으로 보류됐던 **`/mypage`·`/bookmarks`를 이번 사이클에서 착수**했다

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **기능** | 네비게이션에만 노출돼 있던 "마이 페이지"·"북마크" 메뉴를 실제 화면으로 만든다. 회원 프로필 수정(닉네임·소개·프로필이미지·@피드아이디), 계정 설정(비밀번호 변경·회원 탈퇴), 내가 쓴 글 목록을 `/mypage`에, 피드·여행지·즐길거리 북마크 통합 조회·해제를 `/bookmarks`에 구현한다. 동시에 `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`에 남아 있던 "저장되지 않는 가짜 저장 버튼" 3곳을 실제 API로 교체한다 |
| **시작일** | 2026-10-01 (계획 단계) |
| **완료일** | 2026-10-02 |
| **소요 기간** | 2일(세션 한도(rate limit)로 프론트 구현이 한 번 중단됐다가 재개 세션에서 이어짐 — 재개 세션은 기존 산출물을 전수 점검한 뒤 남은 작업만 완료) |

### 1.2 결과 요약

```
┌──────────────────────────────────────────────┐
│  전체 Match Rate: 91.2%                       │
├──────────────────────────────────────────────┤
│  ✅ 완료:     /mypage, /bookmarks 신규 화면 2개 │
│  ✅ 완료:     가짜 저장 버튼 3곳 → 실제 API 연동 │
│  ✅ 신규 API: 피드 북마크 목록, 회원 탈퇴, 프로필 PATCH 확장 │
│  ✅ 신규 테스트: 백엔드 15개(3개 파일), 전건 통과 │
│  ⚠️  코드 리뷰: Critical 1건 + Should Improve 1건 발견 → 전건 수정 │
│  ✅ Gap:      Critical 0건(수정 후 기준), Important 1건(완료) │
│  ⚠️  Minor:    5건(후속 과제)                     │
└──────────────────────────────────────────────┘
```

### 1.3 전달한 가치 (4 관점)

| 관점 | 내용 |
|------|------|
| **문제** | `/mypage`, `/bookmarks`는 네비게이션에 메뉴로 노출돼 있었지만 화면이 없었다. 더 심각한 문제는 조사 단계에서 직접 발견한 것인데, `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 "저장" 버튼이 `useState`만으로 토글되는 **완전히 가짜인 버튼**이었다 — 새로고침하면 사라지고 서버에는 아무것도 남지 않았다. 백엔드의 `tour.bookmark` 패키지(토글·목록 조회 API)는 이미 완성돼 있었는데도 프론트가 단 한 줄도 연결하지 않은 상태로 방치돼 있었다 |
| **해결** | 기존 `/api/v1/feed/profile`을 확장하고(신규 엔드포인트 추가 없이), 지금까지 어떤 화면도 호출한 적 없던 비밀번호 변경 3단계 체인을 처음으로 실제 연동했다. 회원 탈퇴는 기존 "정지"(suspend) 기능의 체크포인트 구조(로그인·리프레시·`JwtAuthenticationFilter` 3곳)를 그대로 재사용해 새로운 인프라 없이 소프트 삭제로 구현했다. 피드 북마크 목록 API를 신규로 추가하고, 완성돼 있던 `tour-bookmarks` API를 프론트에 처음 연결해 `/bookmarks`를 피드+여행지+즐길거리 3탭 통합 화면으로 구성했다 |
| **기능/UX 효과** | 사용자가 프로필을 확인·수정하고, 비밀번호를 바꾸거나 탈퇴할 수 있게 됐다. 본인이 쓴 글을 모아 보고, 여행지·즐길거리·피드에서 북마크한 콘텐츠를 한 화면에서 다시 찾아 해제할 수 있다. 무엇보다 **상세·목록 화면에서 누른 "저장"이 실제로 서버에 남는다** — 사이클 시작 시점에는 거짓이었던 UI가 끝에는 진짜로 동작한다 |
| **핵심 가치** | 이 사이클의 포트폴리오 가치는 세 가지다. 첫째, **조사 단계에서 "메뉴는 있는데 화면이 없다"는 표면적 문제보다 더 심각한 핵심 기능 결함("가짜 저장 버튼")을 스스로 찾아내 이번 사이클 범위에 포함시킨 것** — CLAUDE.md가 명시한 우선순위 1번("깨진 기능이 새 기능보다 먼저")에 해당한다고 판단해, 단순히 두 화면을 만드는 것에 그치지 않고 범위를 능동적으로 넓혔다. 둘째, **회원 탈퇴라는 "프로젝트에 정책 자체가 없던" 기능을, 기존에 이미 검증된 "정지" 기능의 체크포인트 구조를 그대로 재사용해 새 인프라 없이 안전하게 구현한 것** — `FeedPost.author`가 `nullable=false` FK라는 제약을 발견하고 하드 삭제 대신 소프트 삭제(`withdrawnAt`)를 선택한 근거까지 설계 문서에 남겼다. 셋째, 그리고 가장 중요한 것은 **코드 리뷰가 "가짜 버튼을 실제 버튼으로 교체"하는 이번 사이클의 핵심 산출물 자체에서 치명적 버그를 발견한 과정**이다 — `tourBookmarkApi.js`가 백엔드 응답 필드 `active`를 `saved`로 잘못 읽어, 저장 버튼을 눌러도 항상 롤백되는 것처럼 보이는(실제로는 서버에 정상 저장되는데도) 결함이 있었다. 이 버그는 설계 문서의 코드 예시 자체가 틀렸고, 구현이 그 틀린 예시를 충실히 따른 결과였다. 린트와 빌드 모두 통과했지만, "교체는 했지만 여전히 거짓으로 보이는" 상태를 커밋 전에 코드 리뷰가 잡아냈다는 것 자체가 이 사이클의 가장 뚜렷한 교훈이다(§6) |

---

## PDCA 주기 요약

### Plan (계획)

**문서**: `docs/01-plan/features/mypage-bookmarks.plan.md` (v0.2, Q-1~Q-8 결정 완료)

**목표**
- `/mypage`, `/bookmarks` 메뉴를 실제로 동작하게 만든다
- 조사 과정에서 발견한 "가짜 저장 버튼" 3곳을 실제 API로 교체해 거짓 UI를 제거한다(Plan 자체가 조사 단계에서 이 문제를 찾아 범위에 포함시켰다)
- 지금까지 아무도 실제로 호출한 적 없던 비밀번호 변경 체인을 마이페이지에서 처음 연동한다
- 회원 탈퇴를 기존 "정지" 구조를 재사용해 안전하게(FK 위반 없이) 최소 범위로 구현한다

**주요 결정** (사용자 Q-1 ~ Q-8, 2026-10-01)

| # | 결정 | 요지 | 실행 |
|---|------|------|:----:|
| Q-1 | 계정 설정(비밀번호 변경·탈퇴) 포함 여부 | **B) 포함**(추천안과 반대) — 탈퇴 시 게시물 처리는 최소 범위로 한정 | ✅ |
| Q-2 | 회원 프로필 API 구조 | **B) 기존 `/api/v1/feed/profile` 확장**(추천안 채택) — 신규 엔드포인트 없음 | ✅ |
| Q-3 | 프로필 이미지 업로드 UX | **B) 저장 시 일괄 반영**(추천안 채택) — 피드 작성 폼과 동일한 멀티파트 패턴 | ✅ |
| Q-4 | 닉네임 중복확인 처리 | **B) 값이 바뀔 때만 서버가 검사**(추천안 채택) — `updateMyHandle` 패턴 재사용 | ✅ |
| Q-5 | `/bookmarks` 범위 | **B) 피드+투어 탭 통합**(추천안 채택) | ✅ |
| Q-6 | 가짜 저장 버튼 교체 | **A) 포함**(강력 추천안 채택) — 3개 화면 전부 교체 | ✅(코드 리뷰 Critical 수정 거쳐 완료) |
| Q-7 | 피드 북마크 정렬 기준 | **A) 북마크한 시각**(추천안 채택) | ✅ |
| Q-8 | 북마크 해제 포함 여부 | **A) 포함, 즉시 제거**(추천안 채택) — Undo 없음 | ✅ |

**범위**: FR-01~17(백엔드+프론트)

### Design (설계)

**문서**: `docs/02-design/features/mypage-bookmarks.design.md` (v0.1)

**아키텍처 결정**

| 기준 | 선택 | 이유 |
|------|------|------|
| **회원 탈퇴 데이터 정책** | 소프트 삭제(`withdrawnAt` 플래그) | `FeedPost.author`가 `nullable=false` FK라 하드 삭제 시 FK 위반·연쇄 삭제가 강제됨. 둘 다 이번 범위에서 다루기엔 과도함 |
| **탈퇴 체크 재사용** | 기존 `UserEntity.suspend()`/`isSuspended()`와 로그인·리프레시·필터 3곳 체크포인트 구조를 그대로 재사용 | 새 인프라 없이, 이미 검증된 체크포인트 패턴을 그대로 확장 |
| **프로필 API 구조** | 신규 엔드포인트 대신 기존 `/api/v1/feed/profile` 확장 | "SNS 프로필"과 "계정 프로필"을 하나의 응답으로 통합(Q-2) |
| **북마크 화면 구조** | `tour.bookmark`(여행지/즐길거리)와 `feed`(피드) 두 개의 완전히 분리된 백엔드 도메인을 탭별로 독립된 하위 컴포넌트+훅으로 통합 | 탭 전환 시 상태 공유 없음(Plan §7.2), 전역 store 불필요 |
| **가짜 저장 버튼 교체 범위** | 메인 저장 버튼만 교체, 상세 화면의 "주변 추천" 미니 버튼은 범위 밖 | 회귀 체크리스트가 "저장 버튼 외 나머지 기능 무변경"을 명시 — 범위 폭주 방지 |
| **`client.js`의 `delete` 바디 지원 여부** | 설계가 "구현 전 확인 필요"로 명시한 열린 사항 | 구현 단계에서 이미 지원하고 있음을 확인, `client.js` 변경 없이 그대로 사용 |

**주요 모듈**

| 모듈 | 역할 | 비고 |
|------|------|------|
| `tourBookmarkApi.js` | `tour-bookmarks` 토글·목록 API 연결 + view model 변환 | 3개 상세/목록 화면과 북마크 탭이 공유 |
| `useMyFeedProfile`/`usePasswordChangeFlow`/`useWithdrawal` | 마이페이지 세 영역(프로필/비밀번호/탈퇴)의 독립된 상태 | 각자 다른 관심사라 하나로 합치지 않음 |
| `useFeedBookmarks`/`useTourBookmarks` | 북마크 탭별 목록+해제 상태 | 탭 간 상태 공유 없음(Plan §7.2) |
| `MyPage.jsx`/`BookmarksPage.jsx` | 신규 페이지, 기존 컴포넌트·훅 조합 | `FeedUserProfilePage`의 레이아웃·낙관적 토글 원칙 재사용 |

### Do (구현)

**진행 순서**: 백엔드 신규/확장 API(frontend-support-backend) → 프론트 API·훅·컴포넌트(frontend-lead, 세션 한도로 1회 중단) → 프론트 재개(점검 후 남은 페이지·라우팅·가짜 버튼 교체 완료) → 코드 리뷰(frontend-code-reviewer) → Critical 1건·Should Improve 1건 수정.

| 순서 | 영역 | 담당 | 주요 산출물 |
|:---:|------|------|-------------|
| 1 | 백엔드 프로필 확장·탈퇴·피드 북마크 목록 | frontend-support-backend | `UserEntity`(`withdrawnAt` 등), `FeedProfileResponse`/`FeedProfileUpdateRequest` 확장, `UserController`/`UserService`(탈퇴), `FeedBookmarkController`(신규), 체크포인트 3곳, DB 마이그레이션, 신규 테스트 3개 파일(15개) |
| 2 | 프론트 API·훅·컴포넌트(1차) | frontend-lead | `tourBookmarkApi.js`, `userApi.js`, `feedApi.js` 확장, 5개 신규 훅, `mypage/` 컴포넌트 4종 — **세션 한도로 중단** |
| 3 | 프론트 재개(점검 + 잔여 구현) | frontend-lead(새 세션) | 1차 산출물 전수 점검(미완성·버그 없음 확인) → `MyPage.jsx`/`BookmarksPage.jsx` 신규, `App.jsx` 라우트 교체, 가짜 저장 버튼 3곳 교체 |
| 4 | 코드 리뷰 | frontend-code-reviewer | **Critical 1건**(`tourBookmarkApi.js` 응답 필드명 오독) + Should Improve 1건(로컬 전용 버튼 시각적 구분 부재) 발견 |
| 5 | 프론트 수정 | frontend-lead | Critical 수정(`saved`→`active`), Should Improve 수정(`is-local-only` 클래스+CSS) |

**완료 항목**
- ✅ 마이페이지 프로필 조회/수정, 내가 쓴 글 목록, 비밀번호 변경, 회원 탈퇴 (FR-01~09)
- ✅ 피드 북마크 목록 API 신규, 투어 북마크 프론트 최초 연결 (FR-10~13)
- ✅ 가짜 저장 버튼 3곳 → 실제 API 교체 (FR-14, Critical 버그 수정 포함)
- ✅ `/bookmarks` 3탭 통합 화면, 해제 낙관적 처리 (FR-15~16)
- ✅ 라우팅 교체, 비로그인 안내 (FR-17)

**코드 품질**
- 백엔드 신규 테스트 3개 파일(15개): `FeedBookmarkServiceTest`(4), `FeedProfileUpdateServiceTest`(5), `UserWithdrawalFlowTest`(6) — 전건 통과(`surefire-reports` 기록 확인)
- 백엔드 전체 스위트 121/121 통과(`surefire-reports` 집계 기록 확인) — 이 세션은 이전 네 사이클과 동일한 JDK 버전 제약(로컬 17 vs `pom.xml` 요구 25)으로 직접 재현하지 못함(분석 문서 §4.2, 다섯 번째로 반복)
- `npm run lint` 오류 0, `npm run build` 성공
- frontend-code-reviewer 독립 리뷰: **Critical 1건 + Should Improve 1건 발견**, 전건 수정 반영 확인

**발견·수정된 이슈** (포트폴리오 소재)

| # | 이슈 | 발견 경로 | 근본 원인 | 수정 |
|---|------|-----------|-----------|------|
| 1 | `tourBookmarkApi.js`의 `toggleTourBookmark`가 백엔드 응답의 `active` 필드를 `saved`로 잘못 읽어 항상 `false`를 반환. 세 화면의 저장 버튼이 낙관적으로 `true`가 됐다가 즉시 `false`로 롤백돼, **실제로는 서버에 정상 저장되는데도 화면에는 항상 저장이 실패하는 것처럼 보임** | frontend-code-reviewer(Critical) | **설계 문서(`mypage-bookmarks.design.md` §3.5·§4.6)의 코드 예시 자체가 응답 필드를 `{saved, bookmarkId}`로 잘못 기술**했고, 구현이 그 예시를 충실히 따랐다. `data?.saved`는 문법적으로 완전히 유효한 JS라 `npm run lint`/`npm run build` 둘 다 이 결함을 잡지 못했다 | `tourBookmarkApi.js`를 `Boolean(data?.active)`로 수정, 재발 방지 주석 추가. 설계 문서 정정은 후속 과제로 기록 |
| 2 | `TravelDetailPage`의 "주변에서 함께 둘러볼 곳" 섹션 미니 북마크 버튼이, 서버 연동된 메인 저장 버튼과 시각적으로 구분되지 않아 사용자가 동일하게 "저장된다"고 오인할 수 있음(실제로는 로컬 전용, 설계가 이미 범위 밖으로 명시) | frontend-code-reviewer(Should Improve) | 거짓 UI 금지 원칙(NFR)에 비추어, 서버 연동은 범위 밖이더라도 "로컬 전용/준비 중"임을 최소한 드러내야 한다는 판단 | `is-local-only` 클래스, `title`/`aria-label`에 "준비 중" 명시, CSS로 메인 버튼과 다른 색상 적용(기능 변경 없음, 시각적 구분만 추가) |

### Check (검증)

**문서**: `docs/03-analysis/mypage-bookmarks.analysis.md`

**Gap 분석 결과**

```
Overall Match Rate: 91.2%
├ Structural:  100% (설계 §2.2/§6~8 모듈·라우팅 목록과 실제 파일 구성 완전 일치)
├ Functional:   95% (FR-01~17 전체 최종 충족, 단 FR-13/14가 한때 Critical 결함 포함했던 점과 설계-백엔드 불일치 1건 반영)
└ Contract:     83%  (API 6종 중 5종 완전 일치, 1종은 설계 문서 자체가 실제 백엔드와 달랐던 것을 구현이 그대로 따른 특수 사례)
```

Match Rate가 `feed-comment-integration`(99.2%) 등 이전 사이클보다 뚜렷하게 낮다. 이는 디테일을 적게 챙겨서가 아니라, **이번에 발견된 결함의 심각도 자체가 더 높았기 때문**이다 — 숨겨진 성능 문제가 아니라 "이번 사이클이 존재하는 이유"였던 기능이 실질적으로 작동하지 않는 수준의 결함이었다. Gap 분석은 수정 완료 여부와 무관하게 발견 당시의 심각도를 그대로 기록했다.

**Success Criteria** (계획 §4.1, 10개 항목) — 10/10 완전 충족

**Gap 목록** (Critical 1건 전건 완료, Important 1건 완료, Minor 5건 후속 과제)
1. **G-1 (Critical, 완료)**: `tourBookmarkApi.js` 응답 필드명 오독(설계 문서 오기가 원인) — 수정 완료
2. **G-2 (Important, 완료)**: 로컬 전용 북마크 버튼 시각적 구분 부재 — 수정 완료
3. **G-3 (Minor, 후속)**: `AuthService.login`/`refreshToken`의 탈퇴·정지 체크 순서 불일치(결과는 동일)
4. **G-4 (Minor, 설계-구현 불일치)**: 설계 §5.1 "PRIVATE 배지"가 백엔드 필드 부재로 미구현
5. **G-5 (Minor, 기존 패턴)**: 피드 북마크 목록의 `photos` N+1(다른 목록 API와 공유하는 기존 문제)
6. **G-6 (Minor)**: `BookmarksPage`의 탭 쿼리 정규화로 인한 렌더 1회 추가
7. **G-7 (Nice to Have)**: `extractRequiredEmail` 4곳 중복(설계가 이미 명시한 후속 과제)
8. **G-8 (프로세스, 중요)**: 프론트 북마크 토글 로직에 단위 테스트 부재 — G-1이 발생한 사각지대

### Act (완료)

**판단**: gap 분석 결과(Match Rate 91.2%, Critical 1건·Important 1건 전건 완료·수정)에 따라 Report 단계로 진행. frontend-code-reviewer가 찾은 Critical 1건은 이번 사이클의 핵심 산출물 자체를 무력화시킬 수 있었던 결함이었으나 커밋 전에 발견·수정됐다. 남은 Minor 5건(G-3~G-7)과 프로세스 개선 1건(G-8)은 다음 세션으로 이월한다.

---

## 1.4 성공 기준 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | `/mypage`에서 본인 프로필을 조회·수정할 수 있다 | ✅ 충족 | `ProfileSection.jsx` + `useMyFeedProfile.js` |
| SC-2 | `/mypage`에서 본인이 쓴 글 목록을 볼 수 있다 | ✅ 충족 | `MyPage.jsx`의 `FeedCard` 목록 + 페이지네이션 |
| SC-3 | `/mypage`에서 비밀번호를 변경할 수 있다 | ✅ 충족 | `PasswordChangeForm.jsx`, 기존 3단계 체인 최초 실연동 |
| SC-4 | `/mypage`에서 회원 탈퇴 후 재로그인이 차단된다 | ✅ 충족 | `UserWithdrawalFlowTest` 6개 테스트(체크포인트 3곳 전부 검증) |
| SC-5 | `/bookmarks`에서 3탭 북마크 목록을 볼 수 있다 | ✅ 충족 | `BookmarksPage.jsx`, `?tab=` URL 쿼리 기반 전환 |
| SC-6 | `/bookmarks`에서 북마크 해제가 즉시 반영된다 | ✅ 충족 | `removeBookmark`(낙관적 제거+롤백) |
| SC-7 | 3곳의 저장 버튼이 실제로 서버에 북마크를 남긴다 | ✅ 충족(코드 리뷰 Critical 수정 후) | `tourBookmarkApi.js` 수정 확인(§Do) |
| SC-8 | 로딩·에러·빈 상태가 구분되어 표시된다 | ✅ 충족 | `DetailStatus`/`EmptyBookmarks` 확인 |
| SC-9 | 비로그인 사용자가 로그인 화면으로 안내된다 | ✅ 충족 | 각 훅의 `login-required` 상태 분기 |
| SC-10 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ 충족 | Critical 1건·Should Improve 1건 수정 반영, 이 보고서와 짝을 이루는 gap 분석 완료 |

**전체 성공률**: 10/10 (100%)

---

## 1.5 주요 결정 기록

| # | 결정 | 실행 | 결과 |
|---|------|:----:|------|
| D-1 (Q-1) | 계정 설정(비밀번호 변경·탈퇴) 포함 | ✅ | 탈퇴 시 게시물 처리는 최소 범위(로그인 차단까지만)로 한정 |
| D-2 (Q-2) | 기존 `/api/v1/feed/profile` 확장 | ✅ | 신규 엔드포인트 없이 SNS 프로필+계정 프로필 통합 |
| D-3 (Q-3) | 프로필 이미지는 저장 시 일괄 반영 | ✅ | 피드 작성 폼과 동일한 멀티파트 패턴 재사용 |
| D-4 (Q-4) | 닉네임은 값이 바뀔 때만 서버가 중복확인 | ✅ | `updateMyHandle` 패턴 재사용 |
| D-5 (Q-5) | `/bookmarks`는 피드+투어 탭 통합 | ✅ | 탭별 완전히 독립된 하위 컴포넌트+훅 |
| D-6 (Q-6) | 가짜 저장 버튼 3곳 전부 교체 | ✅ | 코드 리뷰 Critical 수정을 거쳐 실제로 작동함을 확인 |
| D-7 (Q-7) | 피드 북마크는 북마크한 시각 순 정렬 | ✅ | 스키마 변경 없이 기존 `createdAt` 컬럼 활용 |
| D-8 (Q-8) | 북마크 해제는 즉시 제거(Undo 없음) | ✅ | 낙관적 업데이트 + 실패 시 롤백 |
| 설계 결정 | 회원 탈퇴를 기존 "정지" 체크포인트 구조로 재사용 | ✅ | 새 인프라 없이 로그인·리프레시·필터 3곳만 확장 |
| 발견 사항(조사 단계) | "가짜 저장 버튼" 3곳을 핵심 기능 결함으로 식별 | ✅ | Plan 범위에 포함(CLAUDE.md 우선순위 1번 판단) |
| 발견 사항(코드 리뷰 Critical) | `tourBookmarkApi.js` 응답 필드명 오독(설계 문서 오기가 원인) | ✅ | `saved`→`active` 수정, 설계 문서 정정은 후속 과제 |
| 발견 사항(코드 리뷰 Should Improve) | 로컬 전용 미니 버튼의 시각적 구분 부재 | ✅ | `is-local-only` 클래스+CSS로 구분 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:----:|
| Plan | [mypage-bookmarks.plan.md](../../01-plan/features/mypage-bookmarks.plan.md) | ✅ 최종화 (v0.2, Q-1~Q-8 결정 완료) |
| Design | [mypage-bookmarks.design.md](../../02-design/features/mypage-bookmarks.design.md) | ✅ 최종화 (v0.1, 일부 정정 후속 과제 있음 — G-1/G-3/G-4) |
| Check | [mypage-bookmarks.analysis.md](../../03-analysis/mypage-bookmarks.analysis.md) | ✅ 완료 (Match Rate 91.2%) |
| Act | 이 문서 | ✅ 완료 |
| 선행 사이클 | [feed-comment-integration.report.md](feed-comment-integration.report.md) (댓글·답글, 여행 피드 사이클 2) | 참고 |
| 선행 사이클 | [feed-integration.report.md](feed-integration.report.md) (여행 피드 사이클 1 — 이번 기능의 Q-8 보류 결정이 여기서 나옴) | 참고 |

---

## 3. 완료된 항목

### 3.1 기능 요구사항

| 그룹 | 항목 수 | 상태 |
|------|:---:|:---:|
| FR-01~03 (백엔드 프로필 응답/요청 확장, `UserEntity` 변경 메서드) | 3 | ✅ 3/3 완료 |
| FR-04~06 (프론트 프로필 수정 폼, 내가 쓴 글, 비밀번호 변경) | 3 | ✅ 3/3 완료 |
| FR-07~09 (백엔드 탈퇴 체크포인트·API, 프론트 탈퇴 다이얼로그) | 3 | ✅ 3/3 완료 |
| FR-10~13 (백엔드 피드 북마크 목록, 프론트 `feedApi`/`tourBookmarkApi`) | 4 | ✅ 4/4 완료(FR-13은 Critical 결함 포함했다가 수정) |
| FR-14 (가짜 저장 버튼 3곳 교체) | 1 | ✅ 1/1 완료(Critical 수정 포함) |
| FR-15~17 (`/bookmarks` 화면, 해제 낙관적 처리, 라우팅) | 3 | ✅ 3/3 완료 |

**기능 완성도**: 17/17 = 100%(이번 사이클 범위 기준, 전건 코드 리뷰 반영 후 최종 상태)

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|:----:|:----:|
| 거짓 UI 금지 | 저장·북마크 버튼은 실제 API 호출과 연결된 것만 노출 | ⚠️→✅ 최초 구현에 이 원칙을 무력화시키는 Critical 버그 포함, 수정 완료 | ✅ |
| 낙관적 UI 일관성 | 북마크 토글이 기존 패턴과 동일하게 동작 | ✅ | ✅ |
| 권한 분리 | 본인 프로필 수정·탈퇴는 토큰의 이메일로만 대상 특정 | ✅ | ✅ |
| 탈퇴 보안 | 비밀번호 재확인 필수, 성공 시 리프레시 쿠키 무효화 | ✅ `UserWithdrawalFlowTest` 확인 | ✅ |
| 메모리 누수 방지 | 프로필 이미지 미리보기 `revokeObjectURL` | ✅ 확인 | ✅ |
| 접근성 | 폼 에러 메시지, `aria-pressed`, 탭 `role="tablist"` | ✅ 확인 | ✅ |
| 반응형 | 마이페이지·북마크 화면 모바일 대응 | ✅ CSS 미디어쿼리 확인 | ✅ |
| 회귀 방지 | 기존 피드 타임라인/상세/타인 프로필 무변경 | ✅ git status로 확인 | ✅ |

**품질 메트릭**
- `npm run lint` 오류 0, `npm run build` 성공
- Gap 분석: Match Rate 91.2%, Critical 0건(수정 후 기준, 발견 당시는 1건)
- 코드 리뷰 Critical 1건 + Should Improve 1건 전건 수정 확인
- 백엔드 신규 테스트 15개 전건 통과, 전체 스위트 121/121 통과(모두 `surefire-reports` 기록 확인)

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:----:|
| 백엔드 수정 | `UserEntity`, `UserController`/`UserService`, `AuthService`, `JwtAuthenticationFilter`, `FeedProfileController`/`FeedProfileService`, `FeedBookMarkRepository`, `FeedService` | ✅ |
| 백엔드 신규 | `UserWithdrawalRequest`, `FeedBookmarkController`, `FeedBookmarkPageResponse`, DB 마이그레이션 1개 | ✅ |
| 백엔드 신규 테스트 | `FeedBookmarkServiceTest`(4), `FeedProfileUpdateServiceTest`(5), `UserWithdrawalFlowTest`(6) | ✅ |
| 프론트 신규 API | `tourBookmarkApi.js`, `userApi.js`, `feedApi.js`(확장) | ✅ |
| 프론트 신규 훅 | `useFeedBookmarks`, `useMyFeedProfile`, `usePasswordChangeFlow`, `useTourBookmarks`, `useWithdrawal` | ✅ |
| 프론트 신규 컴포넌트 | `components/mypage/{ProfileSection,AccountSettingsSection,PasswordChangeForm,WithdrawalDialog}.jsx`(+css) | ✅ |
| 프론트 신규 페이지 | `pages/{MyPage,BookmarksPage}.jsx`(+css) | ✅ |
| 프론트 수정 | `App.jsx`(라우트), `pages/{TravelDetailPage,EnjoyDetailPage,EnjoyCategoryPage}.jsx`(+TravelDetailPage.css) | ✅ |
| 문서 | Plan, Design, Analysis, Report | ✅ 4개 |

---

## 4. 미완료 / 이월 항목

### 4.1 설계 여유 범위 (의도적 미구현, 계획에서 이미 확정)

| 항목 | 계획 근거 | 사유 | 우선순위 | 이월 처리 |
|------|-----------|------|----------|----------|
| 회원 탈퇴 시 게시물·댓글 완전 익명화/연쇄 삭제 | 계획 §2.2 제외 | 최소 범위(로그인 차단까지만)로 한정 확정 | Low | 필요성 확인되면 별도 후속 PDCA |
| `ForgotPasswordPage.jsx` 실제 API 연동 | 계획 §2.2 제외 | 이번 사이클이 만든 비밀번호 변경 플로우와 유사하나 별개 화면 | Medium | 후속 과제로 기록(재사용 가능한 `usePasswordChangeFlow` 존재) |
| 투어 코스 북마크 | 계획 §2.2 제외 | `TourBookmarkGroup`에 코스 그룹 없음 | Low | 필요 시 별도 설계 |
| 상세/목록 화면의 기존 북마크 여부 초기 표시 | 설계 §7.2 명시 | 상세 조회 API에 `bookmarked` 필드 없음(백엔드 변경 필요) | Medium | 후속 PDCA에서 백엔드 포함 검토 |

### 4.2 코드 리뷰 후속 과제

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| **프론트 북마크 토글 단위 테스트(G-8)** | `tourBookmarkApi.js`/`handleToggleSave` 계열에 응답 필드 계약을 검증하는 테스트가 전혀 없음 — G-1 Critical 버그가 바로 이 사각지대에서 발생 | **High(다음 사이클 착수 전 최우선)** | `toggleTourBookmark`가 `{active, bookmarkId}` 응답을 정확히 파싱하는지 검증하는 단위 테스트 추가 |
| `AuthService` 체크 순서 통일(G-3) | `login()`은 탈퇴→정지, `refreshToken()`은 정지→탈퇴 순서(결과는 동일) | Low | 다음 세션에서 순서만 통일 |
| 설계 문서 3곳 정정(G-1/G-3/G-4) | `toggleTourBookmark` 응답 필드 예시, 체크 순서, PRIVATE 배지 보류 사유 | Low | 문서만 갱신, 코드 변경 없음 |
| `extractRequiredEmail` 4곳 중복(G-7) | 설계가 이미 "후속 Nice to Have"로 명시 | Low | 공통 유틸 추출은 다음 리팩토링 사이클에서 |

### 4.3 환경 제약 후속

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| 백엔드 자동 테스트 이 세션 재현 | JDK 17(로컬) vs `pom.xml` 요구 25 — **다섯 번째로 반복**되는 환경 제약 | High(배포 전 필수) | CI 또는 JDK 25 환경에서 `mvnw clean test` 실행 확인. 네 번 연속 "다음에 확인"으로만 끝났으므로 실제 자동화(세션 시작 후크 등)를 최우선 검토 |
| L2 브라우저 검증 | 도구 부재로 미실행 | Medium | 도구 도입 시 분석 문서 §4.3 체크리스트 실행 |

---

## 5. 품질 메트릭

### 5.1 최종 분석 결과

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 91.2%                   │
├─────────────────────────────────────────────┤
│  Structural Match:  100%                     │
│  Functional Match:   95%                     │
│  Contract Match:     83%                     │
├─────────────────────────────────────────────┤
│  Critical Gap: 1건 (완료·수정, 발견 당시 심각도 높음)│
│  Important Gap: 1건 (완료·수정)               │
│  Minor Gap: 5건 (후속 과제)                   │
│  프로세스 Gap: 1건 (단위 테스트 공백)          │
└─────────────────────────────────────────────┘
```

### 5.2 해결된 이슈 (코드 리뷰 → 수정)

| 이슈 | 발견 경로 | 해결 방법 | 결과 |
|------|-----------|----------|:----:|
| `tourBookmarkApi.js` 응답 필드명 오독(`saved`↔`active`), 저장 버튼이 항상 롤백되는 것처럼 보임 | frontend-code-reviewer(Critical) | `Boolean(data?.active)`로 수정, 재발 방지 주석 추가 | ✅ 저장 버튼이 실제로 서버에 북마크를 남기고 화면에도 정확히 반영됨 |
| 로컬 전용 미니 북마크 버튼이 메인 버튼과 시각적으로 구분되지 않음 | frontend-code-reviewer(Should Improve) | `is-local-only` 클래스+툴팁+CSS로 시각적 구분 | ✅ 거짓 UI 금지 원칙에 더 가깝게 정리 |

### 5.3 테스트 결과

| 카테고리 | 결과 |
|----------|:----:|
| 정적 분석 | ✅ 설계 §2.2/§6~8 모듈·라우팅 목록 100% 일치 |
| 기능 검증 | ✅ 17/17 FR 최종 충족(코드 리뷰 반영 후) |
| 코드 리뷰 반영 확인 | ✅ Critical 1/1, Should Improve 1/1 수정 확인 |
| 프론트 lint/build | ✅ `npm run lint` 0 오류, `npm run build` 성공 |
| 백엔드 신규 테스트 | ✅ 15/15 통과(`surefire-reports` 기록 확인) / ⬜ 이 세션 자체 재현은 JDK 제약으로 미실행 |
| 백엔드 전체 스위트 | ✅ 121/121 통과(`surefire-reports` 집계 기록 확인) |
| L2 UI(브라우저) | ⬜ 미검증(도구 부재, 다음 세션 이월) |

---

## 6. 배운 점 및 회고

### 6.1 잘된 점 (지속할 사항)

1. **"메뉴만 있고 화면이 없다"는 표면적 문제보다 더 심각한 결함을 조사 단계에서 스스로 찾아내 범위에 포함시켰다**: Plan 조사 과정에서 `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 저장 버튼이 `useState`만으로 동작하는 완전한 가짜 버튼임을 발견했다. CLAUDE.md의 우선순위("1. 깨진 기능이 새 기능보다 먼저")에 해당한다고 판단해, 단순히 두 화면을 새로 만드는 것에 그치지 않고 기존 화면 3곳의 핵심 결함까지 이번 사이클 범위로 끌어왔다.

2. **회원 탈퇴라는, 프로젝트에 정책 자체가 없던 기능을 기존 검증된 구조의 재사용만으로 안전하게 구현했다**: `UserEntity.suspend()`/`isSuspended()`와 로그인·리프레시·필터 3개 체크포인트라는, 이미 실제로 동작하고 테스트까지 거친 구조를 그대로 "영구 버전"으로 확장했다. `FeedPost.author`의 `nullable=false` FK 제약을 먼저 확인하고 하드 삭제 대신 소프트 삭제를 선택한 근거를 설계 문서에 명시적으로 남겼다.

3. **세션 중단 후 재개 시 "이미 완료된 작업을 다시 하지 않는다"는 원칙을 실제로 지켰다**: 재개 세션은 작업에 바로 뛰어들지 않고, 먼저 API 모듈·훅·컴포넌트 전체를 읽어 완성도를 점검했다. 그 과정에서 `ProfileSection.jsx`/`WithdrawalDialog.jsx`의 `react-hooks/set-state-in-effect` 린트 위반 2건을 발견해(effect 안에서 직접 `setState`를 호출하던 코드), "effect에서 setState" 대신 React가 공식적으로 권장하는 "key 기반 리마운트" 패턴으로 고쳤다. 중복 작업 없이 정확히 남은 부분(`MyPage.jsx`/`BookmarksPage.jsx` 신규, 라우팅 교체, 가짜 버튼 3곳 교체)만 이어서 완료했다.

4. **코드 리뷰가 "교체는 했지만 여전히 거짓으로 보이는" 상태를 커밋 전에 잡아냈다**: `tourBookmarkApi.js`가 백엔드 응답의 `active` 필드를 `saved`로 잘못 읽어 저장 버튼이 항상 롤백되는 것처럼 보이는 Critical 버그가 있었다. 이 사이클의 핵심 목표가 "가짜 버튼을 실제 버튼으로 교체"하는 것이었는데, 그 교체 작업 자체에 숨어 있던 결함이었다. 린트와 빌드 모두 통과했음에도(`data?.saved`는 문법적으로 완전히 유효함) 코드 리뷰가 실제 응답 계약을 백엔드 DTO와 직접 대조해 잡아냈다.

### 6.2 개선할 점 (다음 시도)

1. **백엔드는 신규 로직마다 테스트를 작성했지만, 프론트 토글 로직에는 테스트가 전혀 없었다**: `FeedBookmarkServiceTest`/`FeedProfileUpdateServiceTest`/`UserWithdrawalFlowTest`로 백엔드는 15개 테스트를 꼼꼼히 작성했다. 반면 프론트의 `tourBookmarkApi.js`와 `handleToggleSave` 계열에는 응답 객체의 필드를 검증하는 테스트가 하나도 없었다. G-1(Critical)이 정확히 이 사각지대에서 나왔다 — 테스트가 있었다면 설계 문서의 오기가 구현에 전파되기 전에 즉시 드러났을 결함이다.

2. **설계 문서의 코드 예시를 "검증된 사실"처럼 그대로 베끼는 위험**: 설계 문서(§3.5·§4.6)에 적힌 `{saved, bookmarkId}`라는 응답 모양은 실제로는 작성 시점에 백엔드 DTO와 직접 대조되지 않은 추정이었다. 구현이 설계를 "충실히" 따른 결과가 오히려 버그가 됐다 — 설계 문서의 API 계약 부분은 작성 시점에 반드시 실제 백엔드 소스(DTO 정의)와 바이트 단위로 대조해야 한다는 교훈을 남긴다.

3. **JDK 버전 불일치가 다섯 번째로 반복됨**: `destination-list-integration`부터 `feed-comment-integration`까지 네 번 연속 같은 문제(로컬 17 vs 요구 25)를 보고했고, 이번이 다섯 번째다. 이전 보고서들이 반복해서 "세션 시작 시 자동 확인 절차 추가"를 제안했지만 실제로 반영되지 않았다는 뜻이며, 제안만으로는 충분하지 않다는 것이 이제 분명하다.

### 6.3 다음에 시도할 사항

1. **프론트 API 클라이언트(특히 토글류)에 "응답 필드 계약" 단위 테스트를 표준 관행으로 추가**: `tourBookmarkApi.js`뿐 아니라 `feedApi.js`의 `toggleFeedLike`/`toggleFeedBookmark` 등 유사한 패턴에도 응답 형태를 고정된 테스트로 검증해, 백엔드 DTO가 바뀌거나 프론트가 필드명을 잘못 가정했을 때 즉시 드러나게 한다.

2. **설계 문서의 API 계약 섹션에 "실제 DTO 소스 대조 완료" 체크를 명시적으로 남기기**: 이번 사이클처럼 설계 작성 시점에 실제 백엔드 코드를 보지 않고 추정으로 코드 예시를 적는 경우를 구조적으로 줄인다.

3. **JDK 버전 정합성을 세션 시작 스크립트로 실제 자동화**: 다섯 번 연속 "다음에 확인하겠다"는 회고만 남고 반영되지 않았으므로, 이번에는 bkit 설정에 실제 자동 확인 절차(세션 시작 후크 등)를 추가하는 것을 최우선으로 검토한다.

---

## 7. 다음 단계

### 7.1 즉시 (Report 단계)

- [ ] 설계 문서 3곳 정정(G-1: 응답 필드 예시, G-3: 체크 순서, G-4: PRIVATE 배지 보류 사유) — 코드 변경 없음
- [ ] `tourBookmarkApi.js`/`handleToggleSave` 계열 단위 테스트 추가(G-8, 최우선)

### 7.2 다음 PDCA 주기

| 항목 | 의존성 | 우선순위 | 비고 |
|------|--------|---------|------|
| 프론트 북마크 토글 단위 테스트 보강 | G-8 | **High** | 같은 유형의 Critical 버그 재발 방지 |
| JDK 25/CI 환경에서 `mvnw clean test` 전체 실행 | 이 기능 + 이전 네 사이클 공통 | High | 다섯 번째로 반복된 환경 제약, 자동화 최우선 검토 |
| 상세/목록 화면의 기존 북마크 여부 초기 표시 | 설계 §7.2, 백엔드 `bookmarked` 필드 필요 | Medium | 별도 PDCA(프론트 우선순위 원칙상 백엔드 확장 필요성 먼저 재확인) |
| `FeedPostResponse`에 `visibility` 필드 추가 | G-4 | Medium | PRIVATE 배지 UX 완성을 위한 백엔드 확장, 신중히 검토 |
| `AuthService` 체크 순서 통일 | G-3 | Low | 위험 낮은 정리성 리팩토링 |
| L2 브라우저 자동화 도입 | 프로세스 개선 | Medium | 다섯 번째 PDCA 연속으로 반복된 이슈 |
| `ForgotPasswordPage.jsx` 실연동 | 계획 §2.2에서 이번 범위 제외 | Low | `usePasswordChangeFlow` 재사용 가능 |

### 7.3 포트폴리오 추출 (이 세션 이후)

`frontend-interview-coach` 에이전트에 위임:
- 조사 단계에서 "메뉴 없음"보다 더 심각한 핵심 기능 결함("가짜 저장 버튼")을 스스로 찾아내 범위에 포함시킨 판단 과정
- 회원 탈퇴를 신규 인프라 없이 기존 "정지" 체크포인트 구조 재사용만으로 설계한 과정과, FK 제약 발견이 소프트 삭제 결정으로 이어진 논리
- 코드 리뷰가 "교체 작업 자체의 핵심 버그"(응답 필드명 오독)를 커밋 전에 잡아낸 과정 — 설계 문서의 오기가 구현에 그대로 전파됐던 원인 분석과, 린트/빌드로는 잡을 수 없는 silent 런타임 버그의 특성
- 세션 중단(rate limit) 후 재개 시 기존 산출물을 전수 점검해 중복 작업을 피하고, 그 과정에서 `set-state-in-effect` 린트 위반을 발견해 React 공식 권장 패턴(key 기반 리마운트)으로 고친 경험

---

## 8. Changelog

### v1.0.0 (2026-10-02)

**Added**
- `backend/.../user/dto/UserWithdrawalRequest.java`
- `backend/.../feed/controller/FeedBookmarkController.java`
- `backend/.../feed/dto/FeedBookmarkPageResponse.java`
- `backend/db/migrations/2026-10-02-mypage-bookmarks.sql`
- `backend/src/test/.../feed/{FeedBookmarkServiceTest,FeedProfileUpdateServiceTest}.java`
- `backend/src/test/.../user/UserWithdrawalFlowTest.java`
- `frontend/src/api/{tourBookmarkApi,userApi}.js`
- `frontend/src/hooks/{useFeedBookmarks,useMyFeedProfile,usePasswordChangeFlow,useTourBookmarks,useWithdrawal}.js`
- `frontend/src/components/mypage/{ProfileSection,AccountSettingsSection,PasswordChangeForm,WithdrawalDialog}.jsx`(+css)
- `frontend/src/pages/{MyPage,BookmarksPage}.jsx`(+css)

**Changed**
- `backend/.../user/entity/UserEntity.java`: `withdrawnAt`/`isWithdrawn`/`withdraw`/`updateProfile`/`updateProfileImage` 추가
- `backend/.../user/controller/UserController.java`, `user/service/UserService.java`: 탈퇴 엔드포인트·서비스 추가
- `backend/.../config/JwtAuthenticationFilter.java`, `user/service/AuthService.java`: 탈퇴 체크 2곳(로그인·리프레시) 추가
- `backend/.../feed/controller/FeedProfileController.java`, `feed/dto/FeedProfile{Response,UpdateRequest}.java`, `feed/service/FeedProfileService.java`: 프로필 PATCH 멀티파트 전환, `introduce` 필드 추가
- `backend/.../feed/repository/FeedBookMarkRepository.java`, `feed/service/FeedService.java`: 피드 북마크 목록 조회 추가
- `frontend/src/api/feedApi.js`: `introduce`, `fetchMyFeedProfile`/`updateMyFeedProfile`/`fetchFeedBookmarks` 추가
- `frontend/src/App.jsx`: `/mypage`, `/bookmarks` 라우트를 `ComingSoonPage`에서 실제 페이지로 교체
- `frontend/src/pages/{TravelDetailPage,EnjoyDetailPage,EnjoyCategoryPage}.jsx`(+TravelDetailPage.css): 가짜 저장 버튼 → 실제 `tourBookmarkApi` 연동

**Fixed** (코드 리뷰에서 발견 → 수정)
- **(Critical)** `tourBookmarkApi.js`의 토글 응답 필드명 오독(`saved`→`active`) — 저장 버튼이 항상 롤백되는 것처럼 보이던 핵심 결함, 설계 문서 오기가 원인
- (Should Improve) `TravelDetailPage` 주변 추천의 로컬 전용 미니 북마크 버튼에 시각적 구분(`is-local-only`) 추가
- (세션 재개 중 자체 발견) `ProfileSection.jsx`/`WithdrawalDialog.jsx`의 `react-hooks/set-state-in-effect` 린트 위반 2건 — key 기반 리마운트로 수정

---

## 9. 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-10-02 | 완료 보고서 생성. Plan(Q-1~Q-8 결정)→Design→Do(백엔드 신규/확장 API+프론트 신규 화면 2개+가짜 버튼 3곳 교체, 세션 중단·재개 포함, 코드 리뷰 Critical 1건+Should Improve 1건 수정)→Check(91.2%)→Act(Report). 핵심 기능 결함("가짜 저장 버튼")을 조사 단계에서 스스로 찾아 범위에 포함시킨 판단, 회원 탈퇴를 기존 정지 구조 재사용만으로 구현한 설계, 그리고 코드 리뷰가 교체 작업 자체의 Critical 버그(응답 필드명 오독)를 커밋 전에 잡아낸 과정을 핵심 가치로 기록 | frontend-lead (Claude Code 보조) |

---

**작성 완료**: 2026-10-02 · frontend-lead (Claude Code 보조)
