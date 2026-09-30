# feed-integration 계획 문서

> **요약**: `/feed`(여행 피드) 라우트는 현재 `ComingSoonPage`이고 실제 화면이 없다. 백엔드 `feed` 패키지는 목록·상세·작성(멀티파트 이미지 업로드)·삭제·좋아요·북마크 토글·"내 프로필" 조회가 이미 동작하는 상태다. 사용자 결정(8장, Q-1 ~ Q-9)에 따라 기능 전체는 **댓글+답글, 무한 스크롤, 타인 프로필 조회**까지 포함하는 것으로 확정됐지만, 규모가 admin-dashboard의 개별 리소스 하나보다 커진다는 점을 고려해 **2개의 PDCA 사이클로 분리하는 것이 확정**됐다(설계 문서 §13).
>
> **이번 `feed-integration` 사이클의 최종 범위**: 무한 스크롤 타임라인·상세·작성(이미지 순서변경·위치태깅 포함)·삭제·좋아요·북마크·타인 프로필·`FeedExceptionHandler` 죽은 코드 정리. **댓글+답글은 이번 사이클 범위에서 완전히 제외**하며, 후속 PDCA(가칭 `feed-comment-integration`)에서 별도 Plan 문서 작성부터 다시 시작한다.
>
> 설계 단계에서 계획 문서의 발견 하나를 **정정**했다: `FeedExceptionHandler.handleValidation()`이 애너테이션 누락으로 죽어 있는 것은 맞지만, 이미 존재하는 `common.exception.GlobalExceptionHandler`가 `MethodArgumentNotValidException`을 동일한 `{message}` 형식으로 이미 처리하고 있어 **실제 동작에는 문제가 없다.** 계획 문서가 "긴급 버그"로 분류했던 것은 "죽은 중복 코드 정리"로 하향 조정한다(자세한 내용 1.2절, 정정 내역은 버전 기록 0.2 참고).
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-09-30
> **상태**: Approved / **PDCA 사이클 분리 확정**(2026-09-30) — 이 문서는 사이클 1(`feed-integration`, 댓글 제외)만 다룬다 / 설계 문서 작성 완료(`feed-integration.design.md`)
> **근거**: `backend/.../feed/**` 코드 직접 확인, `docs/02-design/features/admin-dashboard.design.md` §3.4(피드 모더레이션 설계), `docs/01-plan/features/tour-course-list-integration.plan.md`(재사용 패턴·문서 스타일 참고)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | `/feed`가 `ComingSoonPage`뿐이라 일반 사용자는 여행 SNS 기능을 전혀 쓸 수 없다. 백엔드는 목록·상세·작성·삭제·좋아요·북마크·내 프로필까지 구현돼 있지만, 무한스크롤·타인 프로필 조회는 백엔드에도 전혀 없다. (댓글은 이번 사이클 범위 밖 — 아래 "범위 분리" 참고) |
| **해결** | 기존 공개 피드 API를 연결하는 프론트 화면 일체(`feedApi.js`, `useFeedInfiniteList`/`useFeedDetail` 등)를 만들고, 사용자 결정에 따라 신규 백엔드 2종(커서 기반 무한스크롤 목록 API, 타인 프로필 조회 API)을 추가한다 |
| **기능/UX 효과** | 사용자가 여행 사진·글을 올리고, 무한 스크롤로 피드를 훑어보고, 좋아요·북마크를 남기고, 다른 사용자의 피드 프로필을 구경하고, 본인 게시물을 지울 수 있게 된다 |
| **범위 분리** | 댓글+답글은 사용자 결정(Q-1)으로 "포함"이 확정됐지만, 기능 전체를 한 사이클로 묶기에는 규모가 너무 커진다는 점(전면 신규 엔티티+API+UI)을 근거로 **2개 PDCA 사이클 분리가 확정**됐다. 이 Plan 문서와 대응하는 Design 문서는 **사이클 1**(댓글 제외)만 구현 범위로 다루며, 댓글+답글은 **사이클 2**(`feed-comment-integration`, 후속)에서 별도 Plan/Design 문서로 처음부터 다시 진행한다 |
| **핵심 가치** | "이미 있는 API를 연결하는 부분"과 "신규 개발이 필요한 부분"을 코드 조사로 구분하고, 기능 하나가 너무 커졌을 때 완결 지어 릴리스 가능한 단위(댓글 없이도 SNS 핵심 기능은 성립)로 사이클을 쪼갠 근거를 설명할 수 있다. 오프셋 페이지네이션에서 무한 스크롤로 전환할 때 생기는 "새 글 삽입으로 인한 중복/누락" 문제를 커서 기반 조회로 해결한 것, 설계 단계에서 스스로 발견한 조사 오류(죽은 코드 vs 실제 버그)를 바로잡은 것 모두 면접에서 설명 가능한 소재다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | `/feed`는 네비게이션에 "여행 피드" 메뉴로 이미 노출돼 있지만 `ComingSoonPage`만 보인다. 백엔드 CRUD는 완성돼 있어 프론트만 없는 상태를 방치할 이유가 없다 |
| **WHO** | 여행 사진·글을 올리는 사용자, 무한 스크롤로 피드를 훑어보는 방문자(비로그인도 공개 글 조회 가능), 다른 사용자의 피드 프로필을 구경하는 사용자. (댓글로 소통하는 사용자는 사이클 2 대상) |
| **RISK** | 무한 스크롤은 이 프로젝트 최초 도입이라 검증된 패턴이 없음 / 오프셋 페이지네이션을 그대로 무한 스크롤에 쓰면 스크롤 도중 새 글이 생겨 목록이 밀리면서 항목 중복·누락이 생길 수 있음 → 커서 기반 API 신설로 해소 / 타인 프로필 조회 API가 없어 신규 필요 |
| **SUCCESS** | `/feed`에서 무한 스크롤 타임라인·상세·작성·삭제·좋아요·북마크·타인 프로필 조회가 모두 동작 / 로딩·에러·빈 상태 구분 / 관리자 피드 모더레이션에 회귀 없음 |
| **SCOPE** | 프론트: `feedApi.js`, 무한 스크롤 훅, 피드 카드·작성 폼·상세·타인 프로필 화면, `TourReferencePicker` 공용 경로 이동 / 백엔드: 커서 기반 목록 API, 타인 프로필 API, `FeedExceptionHandler` 죽은 코드 정리. **댓글 관련 엔티티·API·UI는 이 SCOPE에 포함되지 않는다**(사이클 2) |

---

## 1. 개요

### 1.1 목적

네비게이션에 이미 노출된 "여행 피드" 메뉴가 실제로 동작하도록 `/feed`를 만든다. 사용자가 여행 사진과 글을 올리고, 무한 스크롤로 다른 사람의 공개 게시물을 보고, 좋아요·북마크를 남기고, 다른 사용자의 피드 프로필을 구경하고, 본인 게시물을 지울 수 있는 화면을 갖춘다. (댓글·답글을 통한 소통은 이번 사이클에 포함하지 않는다 — 후속 `feed-comment-integration`에서 다룬다)

### 1.2 배경 (코드 확인 결과)

**백엔드 `feed` 패키지 — 실제로 존재하는 API**

| 엔드포인트 | 인증 | 설명 | 비고 |
|-----------|------|------|------|
| `GET /api/v1/feed/posts` | 선택(비로그인 가능) | 공개(`visibility=PUBLIC`, 소프트 삭제 제외) 목록. `page`(1-based, 기본 1) · `size`(기본 10, 최대 30), 오프셋 방식 | 무한 스크롤(Q-3) 도입에 따라 설계 단계에서 커서 파라미터를 추가한다(§4 설계 문서 참고) |
| `GET /api/v1/feed/posts/{id}` | 선택 | 단건 상세. `PRIVATE`는 작성자 본인만, 소프트 삭제된 글은 일반 사용자에게 404 취급 | |
| `POST /api/v1/feed/posts` (multipart) | 필수 | 작성. 이미지 최대 5장, 장당 5MB, jpeg/png/webp만 허용 | S3 업로드 실패 시 이미 올린 파일 자동 정리 |
| `PUT /api/v1/feed/posts/{id}` | — | **주석 처리되어 비활성화됨.** Q-2 결정: 이 상태를 유지(수정 기능 추가하지 않음) | |
| `DELETE /api/v1/feed/posts/{id}` | 필수(작성자만) | 하드 삭제. DB 행 + S3 이미지까지 정리 | |
| `POST /api/v1/feed/posts/{id}/likes` | 필수 | 좋아요 토글 | |
| `POST /api/v1/feed/posts/{id}/bookmarks` | 필수 | 북마크 토글 | |
| `GET /api/v1/feed/profile` | 필수 | **"내" SNS 프로필** + 내가 쓴 글 목록 | Q-6 결정에 따라 "타인 프로필" 조회 API를 별도로 신설(§4 설계 문서) |
| `PATCH /api/v1/feed/profile` | 필수 | `@피드아이디` 변경 | |

**백엔드에 없던 것 (조사로 확인, 사용자 결정으로 처리 방향 확정)**

| 항목 | 확인 내용 | 결정(8장) | 이번 사이클 반영 |
|------|-----------|-----------|-------------------|
| 댓글·답글 | `FeedPost.commentCount`는 어디서도 증가되지 않는 죽은 필드. 유일한 `Comment` 엔티티(`board.entity.Comment`)는 커뮤니티 게시판 전용 FK가 고정돼 있어 재사용 불가. 답글 구조도 없음 | **Q-1: 포함**(답글 1단계) | **이번 사이클(feed-integration)에서는 제외.** 사이클 분리 확정에 따라 후속 `feed-comment-integration`에서 전면 신규 개발(엔티티·API·UI 전부) |
| 게시물 수정 | `FeedController`/`FeedService`의 수정 코드가 "SNS는 보통 수정 기능을 제공하지 않는다"는 주석과 함께 통째로 비활성화 | **Q-2: 제외.** 기존 백엔드 판단 유지, 삭제만 지원 | 해당 없음 |
| 무한 스크롤 대비 커서 | 목록 API는 offset 기반 `page`/`size`뿐 | **Q-3: 무한 스크롤 도입.** 커서 기반 API 신설(§4 설계 문서) | 이번 사이클 포함 |
| 위치 태깅 검색 UI | `TourReferencePicker`가 이미 있으나 `components/admin/` 경로 | **Q-4: 재사용.** 공용 경로로 이동(설계 §5) | 이번 사이클 포함 |
| 이미지 업로드 순서 변경 | 프론트에 다중 이미지 업로드 UI 자체가 없음 | **Q-5: 미리보기+순서변경까지 포함**(진행률 표시는 제외) | 이번 사이클 포함 |
| 타인 프로필 조회 | `FeedProfileController`는 "내 프로필" 하나뿐 | **Q-6: 포함.** 신규 공개 API 필요 | 이번 사이클 포함 |
| 태그 검색 | 태그는 저장·표시만 되고 검색 API 없음 | **Q-7: 제외** | 해당 없음 |
| `/mypage`, `/bookmarks` | 둘 다 `ComingSoonPage`, `FeedProfileController`가 사실상 "내 피드" 데이터 제공 | **Q-8: 이번 범위 제외.** `/feed`만 다룸 | 해당 없음 |

**발견 사항의 정정 — `FeedExceptionHandler` (Q-9)**

계획 초안은 `FeedExceptionHandler.handleValidation(MethodArgumentNotValidException)`에 `@ExceptionHandler` 애너테이션이 빠져 있는 것을 "프론트 에러 처리에 영향을 주는 버그"로 분류했다. 설계 단계에서 `backend/.../common/exception/GlobalExceptionHandler.java`를 추가로 확인한 결과, **이 전역 핸들러가 `MethodArgumentNotValidException`을 이미 동일한 `{message: string}` 형식으로 처리하고 있다.** 즉:

- `FeedExceptionHandler.handleValidation()`은 애너테이션이 없어 스프링이 호출하지 않는 **완전히 죽은 메서드**다(맞는 관찰).
- 하지만 `@Valid` 검증 실패는 `GlobalExceptionHandler.handleValidation()`이 대신 처리하므로 **실제 응답 형식은 이미 프론트가 기대하는 `{message}` 그대로 내려간다.** 계획이 우려했던 "형식 불일치"는 발생하지 않는다.
- 애초 제안했던 "누락된 애너테이션을 그대로 추가"하는 수정은 오히려 **위험하다**: `MethodArgumentNotValidException`에 대해 두 개의 전역 `@RestControllerAdvice`가 동시에 `@ExceptionHandler`를 갖게 되어, 어떤 빈이 우선하는지가 스프링의 내부 정렬 순서(선언 순서/빈 이름)에 암묵적으로 의존하게 된다. 지금은 우연히 문제가 없어 보여도 향후 유지보수 시 예측하기 어려운 동작이 된다.
- **수정된 방향**: 애너테이션을 추가하는 대신, 아무 동작도 하지 않는 `handleValidation()` 죽은 메서드 자체를 **삭제**한다(코드 정리, 기능적 변화 없음). `FeedExceptionHandler.handleBadRequest(IllegalArgumentException)`은 `GlobalExceptionHandler.handleIllegalArgument`와 내용이 동일하게 중복되지만, 이미 오래 전부터 동작 중이던 기존 코드라 이번 범위에서 함께 건드리지 않는다(최소 변경 원칙, 관련 없는 회귀 위험 회피).

### 1.3 관련 문서

- 재사용 대상 패턴: `docs/01-plan/features/tour-course-list-integration.plan.md`(문서 스타일, view-model 변환 원칙), `docs/02-design/features/destination-list-integration.design.md`(URL 상태·요청 취소 패턴)
- 피드 스키마 출처: `docs/02-design/features/admin-dashboard.design.md` §3.4(피드 모더레이션 설계)
- 설계 문서: `docs/02-design/features/feed-integration.design.md`(커서 페이지네이션, 무한 스크롤 훅, 타인 프로필 API 구체화. 댓글 스키마는 §3.4/§4.3/§8에 **사이클 2를 위한 사전 설계 초안**으로만 남아 있으며 이번 사이클 구현 대상이 아니다)
- 후속 문서(미작성): `docs/01-plan/features/feed-comment-integration.plan.md` — 댓글+답글 전용, 별도로 처음부터 작성 예정

---

## 2. 범위

### 2.1 포함 (이번 `feed-integration` 사이클)

- [ ] 백엔드: `FeedExceptionHandler`의 죽은 `handleValidation` 메서드 삭제(코드 정리)
- [ ] 백엔드: 피드 목록 API에 커서 기반 무한 스크롤 파라미터 추가(설계 §7)
- [ ] 백엔드: 타인 프로필 조회 신규 공개 API(`GET /api/v1/feed/profile/{userId}`, PUBLIC 게시물만)
- [ ] 프론트: `api/feedApi.js` — 목록(커서)·상세·작성·삭제·좋아요/북마크 토글, view-model 변환
- [ ] 프론트: `hooks/useFeedInfiniteList` — 무한 스크롤 상태 머신(IntersectionObserver 기반)
- [ ] 프론트: `hooks/useFeedDetail`
- [ ] 프론트: 피드 타임라인 화면(`/feed`) — 무한 스크롤, 좋아요·북마크 토글
- [ ] 프론트: 피드 작성 화면/모달 — 내용, 이미지 업로드(최대 5장, 미리보기+순서변경), 태그(최대 10개), 공개범위, 위치 태깅(`TourReferencePicker` 재사용 + 자유 텍스트)
- [ ] 프론트: 게시물 삭제(작성자 본인) 확인 다이얼로그
- [ ] 프론트: 타인 프로필 화면(`/feed/users/:userId`, 작성자 닉네임 클릭 시 이동)
- [ ] 프론트: `TourReferencePicker.jsx`/`.css`를 `components/admin/`에서 `components/common/`으로 이동, `AdminCourseFormPage.jsx`의 import 경로 수정
- [ ] 프론트: `ComingSoonPage`로 남아 있는 `/feed` 라우트를 실제 화면으로 교체(`App.jsx`)
- [ ] 프론트: 비로그인 사용자가 좋아요/북마크/작성/삭제를 시도할 때 로그인 유도

### 2.2 제외

- **댓글+답글 전체** — Q-1 결정으로 기능 자체는 "포함"이 확정됐으나, **2개 PDCA 사이클 분리 확정**에 따라 이번 `feed-integration` 사이클에서는 완전히 범위 밖이다. `FeedComment` 엔티티, 댓글 API, 댓글 UI, `commentCount` 갱신 로직 전부를 후속 `feed-comment-integration` 사이클로 이관한다. 그 사이클은 이번 계획·설계 문서와 별개로 처음부터(Plan → Design → Do) 다시 진행한다
- 게시물 수정(Q-2, 기존 백엔드 판단 유지)
- 태그 검색/필터(Q-7)
- `/mypage`, `/bookmarks` 전용 화면(Q-8) — `GET /api/v1/feed/profile`(내 프로필)은 이번 범위에서 호출하지 않는다(사용 여부는 마이페이지 후속 기능에서 결정)
- 이미지 업로드 진행률 표시(Q-5)
- 여행코스-피드 연동(admin-dashboard report §8, 이전 기능들에서 이미 유보)
- 지도 API 연동(좌표 선택 UI). CUSTOM 형태의 자유 위치 입력은 좌표 없이 텍스트만 저장
- 관리자 피드 모더레이션 화면 변경(`AdminFeedListPage`/`AdminFeedDetailPage`/`FeedAdminController`)
- 실시간 알림, 팔로우/팔로잉 — 백엔드 스키마 자체가 없고 이번 요청 범위에도 없음

---

## 3. 요구사항

### 3.1 기능 요구사항 (이번 사이클)

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | `feedApi.js` — `fetchFeedTimeline({cursor, size}, {signal})`가 커서 기반 목록 API를 호출해 `{items, nextCursor, hasNext}` view model로 변환 | High | frontend-lead | Pending |
| FR-02 | `feedApi.js` — `fetchFeedDetail(id)` | High | frontend-lead | Pending |
| FR-03 | `feedApi.js` — `createFeedPost(formValues)`(멀티파트) | High | frontend-lead | Pending |
| FR-04 | `feedApi.js` — `deleteFeedPost(id)` | High | frontend-lead | Pending |
| FR-05 | `feedApi.js` — `toggleFeedLike(id)`/`toggleFeedBookmark(id)` | High | frontend-lead | Pending |
| FR-06 | `useFeedInfiniteList` — IntersectionObserver로 마지막 항목이 보이면 다음 커서를 요청, 누적. 초기 로딩/추가 로딩/추가 실패를 구분 | High | frontend-lead | Pending |
| FR-07 | 피드 타임라인 화면 — 카드마다 작성자 닉네임(클릭 시 타인 프로필 이동)·프로필 이미지, 대표 이미지, 내용 일부, 좋아요/댓글 수(숫자만 표시, 클릭 진입 UI는 사이클 2), 토글 버튼 | High | frontend-lead | Pending |
| FR-08 | 피드 작성 폼 — 내용, 이미지(미리보기+순서 변경, 최대 5장), 태그(최대 10개), 공개범위, 위치 태깅(`TourReferencePicker` 재사용 + 자유 텍스트) | High | frontend-lead | Pending |
| FR-09 | 게시물 삭제 확인 다이얼로그(작성자 본인만 노출) | High | frontend-lead | Pending |
| FR-10 | 비로그인 사용자의 좋아요/북마크/작성/삭제 시도 시 로그인 유도 | High | frontend-lead | Pending |
| FR-11 | `App.jsx`의 `/feed` 라우트를 `ComingSoonPage`에서 실제 화면으로 교체 | High | frontend-lead | Pending |
| FR-12 | 백엔드: 피드 목록 API에 커서 파라미터 추가(설계 §4.2에서 확정된 대로 `cursor`/`size`로 교체) | High | frontend-support-backend | Pending |
| FR-15 | 백엔드: 타인 프로필 조회 API(`GET /api/v1/feed/profile/{userId}`, PUBLIC 게시물만, 비로그인도 조회 가능) | Medium | frontend-support-backend | Pending |
| FR-16 | 프론트: 타인 프로필 화면(`/feed/users/:userId`) | Medium | frontend-lead | Pending |
| FR-17 | 백엔드: `FeedExceptionHandler`의 죽은 `handleValidation` 메서드 삭제(코드 정리, 기능 변화 없음) | Low | frontend-support-backend | Pending |
| FR-18 | 프론트: `TourReferencePicker.jsx`/`.css`를 `components/common/`으로 이동, `AdminCourseFormPage.jsx` import 경로 수정, 위치 태깅 폼에서 재사용 | Medium | frontend-lead | Pending |

> **결번 안내**: FR-13(`FeedComment` 백엔드), FR-14(댓글 프론트 UI)는 설계 초안 단계에서 부여된 번호였으나, PDCA 사이클 분리 확정에 따라 **이번 사이클에서 완전히 제외**되고 후속 `feed-comment-integration` 계획 문서에서 새 번호로 다시 정의된다. 이번 문서에서는 번호를 비워 두어 이관 이력을 남긴다.

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 보안(XSS) | 게시글 내용은 일반 텍스트로만 렌더링(`dangerouslySetInnerHTML` 금지) | 코드 리뷰 |
| 경쟁 조건 | 무한 스크롤 중 중복 요청 방지(이미 로딩 중이면 다음 트리거 무시), 언마운트 시 진행 중 요청 취소 | 코드 리뷰 + 수동 확인 |
| 데이터 정합성 | 스크롤 도중 새 글이 추가돼도 커서 기반 조회라 기존에 본 글이 중복되거나 건너뛰어지지 않는다 | 수동 확인(다른 계정으로 새 글 작성 후 스크롤 테스트) |
| 낙관적 UI 일관성 | 좋아요·북마크 토글에 낙관적 업데이트 적용 시 실패하면 반드시 롤백 | 코드 리뷰 + 수동 확인 |
| 메모리 누수 방지 | 이미지 미리보기 `URL.createObjectURL` 사용 시 `revokeObjectURL`로 정리 | 코드 리뷰 |
| 접근성 | 이미지 대체 텍스트, 좋아요/북마크 `aria-pressed`, 무한 스크롤 로딩 영역 `aria-live="polite"`, 이미지 순서 변경 버튼의 키보드 접근성 | 코드 리뷰 |
| 반응형 | 피드 카드·작성 폼·타인 프로필 화면이 모바일 폭에서 깨지지 않는다 | 브라우저 크기 조절 |
| 회귀 방지 | 관리자 피드 모더레이션 화면, `AdminCourseFormPage`의 REFERENCE 선택(TourReferencePicker 이동 후)에 변화가 없다 | 수동 확인 |

---

## 4. 성공 기준

### 4.1 완료 조건 (이번 사이클)

- [ ] `/feed`에서 무한 스크롤로 실제 공개 게시물을 볼 수 있다(비로그인 포함)
- [ ] 로그인한 사용자가 사진·글·태그·공개범위·위치 태깅을 담아 게시물을 작성할 수 있다
- [ ] 좋아요·북마크 토글이 실제로 동작한다
- [ ] 작성자 본인이 게시물을 삭제할 수 있다
- [ ] 다른 사용자의 피드 프로필(공개 게시물만)을 볼 수 있다
- [ ] 스크롤 중 새 글이 생겨도 목록에 중복·누락이 생기지 않는다(커서 기반 검증)
- [ ] 로딩·에러(재시도)·빈 상태가 구분되어 표시된다
- [ ] 관리자 피드 모더레이션 화면, `AdminCourseFormPage`에 회귀가 없다
- [ ] frontend-code-reviewer 리뷰와 gap 분석 완료
- [ ] (댓글 작성·조회·답글·삭제는 이번 사이클의 완료 조건이 아니다 — 사이클 2에서 별도 성공 기준으로 정의)

### 4.2 품질 기준

- [ ] `npm run lint` 오류 0, `npm run build` 성공
- [ ] 백엔드 `mvnw clean test` 통과
- [ ] gap 분석 Match Rate 90% 이상

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 기능 전체(댓글 포함)를 한 사이클로 진행하면 규모가 admin-dashboard 개별 리소스보다 커짐 | High | **해소됨** | 2개 PDCA 사이클(사이클 1: 이 문서, 댓글 제외 / 사이클 2: `feed-comment-integration`, 후속)로 분리 **확정**(설계 §13). 이번 사이클은 댓글 없이 완결 지어 릴리스 가능한 범위로 좁혀졌다 |
| 오프셋 페이지네이션을 그대로 무한 스크롤에 쓰면 스크롤 중 새 글 삽입으로 중복/누락 발생 | Medium | High(무한 스크롤 자체의 알려진 문제) | 커서 기반 API 신설로 해소(설계 §7) |
| `TourReferencePicker` 이동 시 `AdminCourseFormPage.jsx`의 기존 동작이 깨질 위험 | Medium | Low | import 경로만 변경, 컴포넌트 내부 로직은 수정하지 않음. 회귀 체크리스트에 명시 |
| 무한 스크롤이 이 프로젝트 최초 도입이라 검증된 패턴이 없음 | Medium | Medium | 설계 문서에서 상태 머신을 처음부터 구체적으로 설계(§7), 기존 `useTourList`류 경쟁 조건 방어 원칙을 이어받음 |
| 사이클 1에서 만드는 "댓글 수" 표시(FR-07)가 항상 0으로 보여 어색할 수 있음 | Low | High(댓글 자체가 없으므로 항상 0) | 카드에 댓글 수를 클릭 가능한 링크로 만들지 않고 단순 숫자로만 표시(거짓 UI 금지 원칙). 사이클 2에서 클릭 시 상세 댓글 영역으로 스크롤하는 동작을 추가 |

---

## 6. 영향 분석

### 6.1 변경 자원 (이번 사이클)

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `backend/.../feed/exception/FeedExceptionHandler.java` | 백엔드 | 죽은 `handleValidation` 메서드 삭제 |
| `backend/.../feed/controller/FeedController.java`, `feed/service/FeedService.java` | 백엔드 | 커서 파라미터 추가 |
| `backend/.../feed/controller/FeedProfileController.java`, `feed/service/FeedProfileService.java` | 백엔드 | 타인 프로필 조회 메서드 추가 |
| `frontend/src/api/feedApi.js` | 신규 API 모듈 | |
| `frontend/src/hooks/useFeedInfiniteList.js`, `useFeedDetail.js` | 신규 훅 | |
| `frontend/src/pages/FeedPage.jsx`, `FeedDetailPage.jsx`(가칭), `FeedUserProfilePage.jsx`(가칭) | 신규 페이지 | |
| `frontend/src/components/feed/**`(가칭) | 신규 컴포넌트 | 피드 카드, 작성 폼, 삭제 다이얼로그 (댓글 UI 컴포넌트는 사이클 2) |
| `frontend/src/components/admin/TourReferencePicker.jsx` → `components/common/TourReferencePicker.jsx` | 이동 | |
| `frontend/src/pages/admin/AdminCourseFormPage.jsx` | import 경로 수정만 | |
| `frontend/src/App.jsx` | 라우팅 | `/feed`, `/feed/users/:userId` 신규 라우트 |

**이번 사이클에서 변경하지 않는 것(사이클 2로 이관)**: `feed/domain/FeedComment.java` 등 댓글 엔티티 일체, `feed/controller/FeedCommentController.java`, `frontend/src/api/feedCommentApi.js`, `hooks/useFeedComments.js`, 댓글 관련 컴포넌트.

### 6.2 현재 사용처 (영향받을 수 있는 곳)

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `feed` 백엔드 패키지 전체 | `FeedAdminController`/`FeedAdminService`(관리자 모더레이션) | 일반 사용자 API만 추가하고 관리자 API·서비스는 건드리지 않는다 |
| `TourReferencePicker.jsx` | `AdminCourseFormPage.jsx` | 파일 이동으로 인한 import 경로 변경. 컴포넌트 자체 로직은 변경 없음(회귀 없음 목표) |
| `data/navigation.js`의 "여행 피드" 메뉴 | `Header.jsx`, 모바일 드로어 | 이미 `/feed`로 연결돼 있어 라우트 교체만으로 동작 시작 |

### 6.3 검증

- [ ] 관리자 피드 모더레이션 화면이 기존과 동일하게 동작
- [ ] `AdminCourseFormPage`의 REFERENCE 경유지 선택 기능에 회귀 없음(파일 이동 후)

---

## 7. 프론트엔드 아키텍처 고려사항

### 7.1 기존 패턴 재사용 방안

| 기존 패턴 | 재사용 가능한가 | 근거 |
|-----------|------------------|------|
| `courseApi.js`의 view-model 변환·fail-closed 파싱 | **가능** | `feedApi.js`도 같은 원칙으로 작성 |
| `useTourList`/`useCourseList`의 렌더 중 파생 상태 머신 | **부분적** | "조건이 바뀌면 교체" 모델은 무한 스크롤(누적 append)과 다르다. 상태 전이 설계 원칙(취소, 경쟁 조건 방어)만 계승하고 `useFeedInfiniteList`는 새 모양으로 설계(설계 §7) |
| `client.js`의 FormData 지원 | **가능**, 이미 검증됨 | |
| `TourReferencePicker.jsx` | **재사용 + 이동**(Q-4) | 공개 API만 의존해 인증 문제 없음. `components/common/`으로 이동해 일반 사용자 화면에서도 자연스럽게 import |
| `ConfirmDialog.jsx`(관리자용) | **구조만 참고, 재사용 안 함** | `admin-*` CSS 클래스에 결합돼 있어 공개 화면에 그대로 쓰면 관리자 디자인이 새어 나온다. 같은 접근성 패턴(포커스 이동, Esc 닫기, `role="alertdialog"`)으로 공개 화면 전용 컴포넌트를 새로 작성 |

### 7.2 상태 관리

| 상태 | 위치 | 이유 |
|------|------|------|
| 피드 타임라인 누적 항목·커서 | `useFeedInfiniteList` 내부 state | 서버 상태, URL로 공유할 가치가 낮음(스크롤 위치는 URL로 표현하지 않는 것이 일반적인 SNS 관례) |
| 좋아요·북마크 상태 | 목록/상세 훅 내부 state | 개별 게시물 단위, 전역 캐시 불필요 |
| 작성 폼 입력값 | 폼 컴포넌트 내부 state | 로컬 UI 상태 |

새 Context나 전역 store는 만들지 않는다.

### 7.3 작업 분담 (CLAUDE.md bkit 협업 규칙, 이번 사이클)

```
frontend-lead            : FR-01~11, FR-16, FR-18 (프론트 전체)
frontend-support-backend : FR-12, FR-15, FR-17 (백엔드 신규/정리)
frontend-code-reviewer   : 구현 후 리뷰
bkit gap-detector        : 설계 대비 gap 분석
frontend-interview-coach : 완료 보고서 후 포트폴리오 자료 추출
```

댓글 관련 작업(舊 FR-13, FR-14)은 이번 작업 분담에서 제외되며, 사이클 2 착수 시 별도 계획 문서에서 새로 배정한다.

---

## 8. 사용자 결정 (결정됨, 2026-09-30)

| # | 결정 | 선택 | 비고 |
|---|------|------|------|
| Q-1 | 댓글(및 답글) 포함 여부 | **C) 댓글+답글(1단계) 포함**(추천안 A와 반대) | 기능 자체는 포함 확정. 단 **PDCA 사이클 분리 확정**에 따라 구현 시점은 후속 `feed-comment-integration` 사이클로 이관(이 문서는 다루지 않음) |
| Q-2 | 게시물 수정 기능 | **A) 기존 백엔드 설계 유지**(수정 없음, 삭제만, 추천안 채택) | 주석 처리된 코드 그대로 유지, 되살리지 않음 |
| Q-3 | 목록 로드 방식 | **A) 무한 스크롤 신규 도입**(추천안 B와 반대) | 커서 기반 API 신설(설계 §7) |
| Q-4 | 위치 태깅 UX | **A) `TourReferencePicker` 재사용**(추천안 C 중 A 부분 채택) | 공용 경로 이동 필요(설계 §5) |
| Q-5 | 이미지 업로드 UX | **B) 미리보기 + 드래그 순서변경**(추천안 A보다 확장) | 업로드 진행률 표시는 제외 |
| Q-6 | 타인 프로필 조회 | **B) 포함**(추천안 A와 반대) | 신규 공개 API 필요 |
| Q-7 | 태그 검색 | **A) 이번 범위 제외**(추천안 채택) | |
| Q-8 | `/mypage`, `/bookmarks` 경계 | **A) 이번 범위는 `/feed`만**(추천안 B와 다름 — "내 프로필 탭" 없이 완전 제외) | `/feed` 안에 "내가 쓴 글" 탭도 만들지 않는다 |
| Q-9 | 버그 수정 시점 | **A) 이번에 함께 고침**(추천안 채택, 단 내용은 설계 단계에서 정정 — 1.2절 참고) | "애너테이션 추가"가 아니라 "죽은 코드 삭제"로 수정 방향이 바뀜 |

**PDCA 사이클 분리 (확정, 2026-09-30)**: Design 문서 §13이 제시한 권장안(사이클 1: 댓글 제외 피드 CRUD+타임라인+타인프로필 / 사이클 2: 댓글+답글)을 사용자가 그대로 확정했다. 이 Plan 문서와 대응 Design 문서는 **사이클 1만** 구현 범위로 다룬다. 사이클 2는 이 문서의 완료 이후 `feed-comment-integration`이라는 이름으로 Plan 문서 작성부터 별도로 시작한다.

구체적인 API 응답 모양, 커서 페이지네이션 설계, 컴포넌트 구조, 라우팅은 `docs/02-design/features/feed-integration.design.md`에 구체화했다.

---

## 9. 다음 단계

1. [x] 8장 사용자 결정 (Q-1 ~ Q-9)
2. [x] 설계 문서 작성 (`feed-integration.design.md`)
3. [x] PDCA 사이클 분리 확정 (사이클 1: 이 문서 / 사이클 2: `feed-comment-integration`, 후속)
4. [ ] 백엔드 구현 (frontend-support-backend): FR-12, FR-15, FR-17
5. [ ] 프론트 구현 (frontend-lead): FR-01~11, FR-16, FR-18
6. [ ] 코드 리뷰 (frontend-code-reviewer) + gap 분석
7. [ ] 완료 보고서 → 포트폴리오 추출 (frontend-interview-coach)
8. [ ] (사이클 1 완료 후) `feed-comment-integration` Plan 문서 작성부터 재시작

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-30 | 초안. `feed` 백엔드 패키지·프론트 기존 파일 전수 조사 기반 작성. Q-1 ~ Q-9 사용자 결정 요청 정리 | WOOJIN |
| 0.2 | 2026-09-30 | 사용자 결정 반영(Q-1~Q-9, 다수 추천안과 다르게 선택 — 댓글+답글 포함, 무한스크롤 도입, 타인 프로필 포함). 범위·FR·위험·영향분석을 결정에 맞게 재작성. `FeedExceptionHandler` 관련 발견을 설계 단계에서 정정(`GlobalExceptionHandler`가 이미 검증 오류를 올바르게 처리하고 있어 실제 버그가 아니었음, 죽은 코드 삭제로 수정 방향 변경). 상태를 Approved로 변경 | WOOJIN |
| 0.3 | 2026-09-30 | **PDCA 사이클 분리 확정** 반영. 이 문서의 구현 범위를 사이클 1(댓글 제외: 타임라인·상세·작성·삭제·좋아요·북마크·타인프로필·버그정리)로 명확히 좁히고, 댓글+답글 관련 항목(舊 FR-13, FR-14, 관련 위험·영향분석·작업분담 행)을 후속 `feed-comment-integration` 사이클로 이관 처리. "권장안" 표현을 전부 "확정"으로 수정 | WOOJIN |
