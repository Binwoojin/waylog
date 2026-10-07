# feed-comment-integration Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현) — **PDCA 사이클 2**(feed-integration 후속, 댓글+답글)
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: frontend-lead (Claude Code 보조)
> **Date**: 2026-09-30
> **Design Doc**: [feed-comment-integration.design.md](../02-design/features/feed-comment-integration.design.md) (v0.1)
> **Plan Doc**: [feed-comment-integration.plan.md](../01-plan/features/feed-comment-integration.plan.md) (v0.2, Q-1~Q-4 결정 완료)

PRD 문서는 없다(이전 세 사이클과 동일하게 PM 단계 없이 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

**사이클 경계 고지**: `feed-integration.design.md` §3.4~3.5·§4.3·§8은 이번 사이클을 위한 "사전 설계 초안"이었다. `feed-comment-integration.design.md`가 이를 확정 설계로 공식화했고, 이 gap 분석은 **확정 설계 대 실제 구현**을 대조한다. 사전 설계 시점의 스케치(예: `FeedPost.increaseCommentCount`/`decreaseCommentCount` 인스턴스 메서드)가 코드 리뷰를 거치며 더 나은 방식(원자적 UPDATE 쿼리)으로 바뀐 것은 감점 대상이 아니라 "완료(수정됨)"로 분류한다(3장).

---

## Context Anchor

> 계획·설계 문서에서 복사했다(사이클 2 관점으로 재확인).

| Key | Value |
|-----|-------|
| **WHY** | 게시물 상세의 "댓글 N개" 표시가 사이클 1부터 항상 0으로 고정돼 있었다. 백엔드에 댓글 엔티티 자체가 없어 만들지 않으면 영구히 빈 기능으로 남는 상태였다 |
| **WHO** | 게시물에 의견을 남기는 사용자, 댓글에 답글로 반응하는 사용자, 본인 댓글을 정리하고 싶은 사용자 |
| **RISK** | 답글의 답글을 막는 로직 / 최상위 댓글 삭제 시 답글 cascade와 `commentCount` 계산 정합성 / 사이클 1의 `SecurityConfig` 누락(G-1) 재발 |
| **SUCCESS** | 게시물 상세에서 댓글·답글(1단계) 작성·조회·삭제가 모두 동작 / 답글의 답글은 서버가 거부 / 게시물 삭제 시 댓글이 고아 레코드 없이 자동 정리 / 로딩·에러·빈 상태 구분 / 회귀 없음 |
| **SCOPE** | 백엔드: `FeedComment` 신규 엔티티, `FeedPost` 필드 추가, 댓글 API 3종 / 프론트: `feedCommentApi.js`, `useFeedComments`, `FeedCommentList`/`FeedCommentForm`, `FeedDetailPage` 통합 |

---

## Success Criteria Status (계획 §4.1 완료 조건)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | 게시물 상세에서 최상위 댓글 목록("더 보기")과 답글(1단계, 항상 펼쳐짐)을 볼 수 있다 | ✅ | `FeedCommentList.jsx`가 `replies`를 토글 없이 그대로 렌더링, `hasNext`일 때 "댓글 더 보기" 버튼 노출 확인 |
| SC-2 | 로그인한 사용자가 댓글과 답글을 작성할 수 있다 | ✅ | `FeedCommentForm`(최상위)·인라인 답글 폼(댓글별) → `createFeedComment` → `FeedCommentService.create` 확인 |
| SC-3 | 답글에는 답글을 달 수 없다(UI에 버튼이 없고, 서버도 거부) | ✅ | `FeedCommentList.jsx`의 `CommentRow`가 답글에는 `onReply` 자체를 전달받지 않아 `[답글]` 버튼 미렌더링 + `FeedCommentServiceTest.replyToReplyIsRejected`가 서버 거부를 검증 |
| SC-4 | 작성자 본인이 자신의 댓글(및 그 답글)을 삭제할 수 있다 | ✅ | `CommentRow`가 `isOwner`일 때만 삭제 버튼 노출, `FeedConfirmDialog` 확인 모달 경유, `FeedCommentServiceTest.deletingOthersCommentIsRejected`로 타인 삭제 거부 확인 |
| SC-5 | 게시물을 삭제하면 그 댓글·답글도 고아 레코드 없이 함께 삭제된다 | ✅ | `FeedPost.comments`(cascade=ALL, orphanRemoval) 연관관계 확인, `FeedCommentServiceTest.deletingPostCascadesComments`가 실제로 검증(설계 §12가 이번 사이클 필수 항목으로 예고한 테스트) |
| SC-6 | `FeedCard`/`FeedDetailPage`의 "댓글 N개" 표시가 실제 값으로 바뀐다(코드 변경 없이) | ✅ | `FeedCommentService.create`/`delete`가 `FeedPostRepository.adjustCommentCount`를 호출해 `FeedPost.commentCount`를 갱신 → `FeedPostResponse.commentCount`가 그대로 읽어 반환. `FeedCard.jsx`/`FeedDetailPage.jsx`는 코드 변경 없이 실제 값을 표시(연결 지점 실현 확인). 단, `FeedCard.jsx`의 관련 주석이 "commentCount는 항상 0"이라는 사이클 1 시점 문구로 남아 있음(§3 G-5, Minor) |
| SC-7 | 로딩·에러(재시도)·빈 상태(댓글 없음)가 구분되어 표시된다 | ✅ | `CommentSection`(`FeedDetailPage.jsx`)이 `status`(loading/error/success)를 분기, `FeedCommentList`가 `comments.length === 0`일 때 빈 상태 문구 표시 |
| SC-8 | 사이클 1 화면과 관리자 피드 모더레이션에 회귀가 없다 | ✅ | `git status`에 `FeedPage.jsx`/`FeedUserProfilePage.jsx`/`FeedAdminController`/`FeedAdminService`/`AdminFeedListPage`/`AdminFeedDetailPage` 미표시(미변경) 확인. `FeedPost.java`는 `comments` 필드 추가만(기존 필드·메서드 무변경) |
| SC-9 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ | 코드 리뷰 Must Fix 2건 + Should Improve 2건 전건 수정 확인(§3), 이 문서가 gap 분석 |

**Success Rate**: 9/9 완전 충족.

---

## 1. 분석 개요

### 1.1 목적

`feed-comment-integration` 사이클의 구현(백엔드 신규 API 3종 + 프론트 댓글 UI)과 그 이후의 코드 리뷰 수정 사항이, 확정 설계(`feed-comment-integration.design.md`) 및 계획(`feed-comment-integration.plan.md` FR-19~33)의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/feed-comment-integration.design.md`(§1~§12, v0.1)
- **구현 경로**: `backend/.../feed/{domain/FeedComment.java, dto/FeedComment*.java, repository/FeedCommentRepository.java, service/FeedCommentService.java, controller/FeedCommentController.java}`, `backend/.../feed/domain/FeedPost.java`(수정), `backend/.../feed/repository/FeedPostRepository.java`(수정), `frontend/src/{api/feedCommentApi.js, hooks/useFeedComments.js, components/feed/FeedComment{List,Form}.jsx(+css), pages/FeedDetailPage.jsx(+css)}`
- **분석 일자**: 2026-09-30
- **분석 방식**: 정적 분석(전체 파일 정독, `git status` 기준 신규/변경 파일 대조) + 코드 리뷰 Must Fix 2건·Should Improve 2건 반영 확인 + `npm run lint`/`npm run build` 실행 확인 + 백엔드 신규 테스트 2개 파일(11개 테스트) 정독 + 백엔드 자동 테스트 실행 재시도(환경 제약 재확인, §4.2)

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 대조 (설계 §4.2, §4.4 ↔ 서버 ↔ 클라이언트)

| # | 엔드포인트 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------------|:----:|:----:|:----------:|:----:|
| 1 | `GET /api/v1/feed/posts/{postId}/comments?page=&size=` | ✅ 최상위 댓글 페이지 + 답글 포함 | ✅ `FeedCommentController.list` → `FeedCommentService.list`(2단계 쿼리, 아래 G-1) | ✅ `fetchFeedComments` → `toFeedCommentPageResult`(fail-closed) | PASS |
| 2 | `POST /api/v1/feed/posts/{postId}/comments` | ✅ `{content, parentCommentId}`, 답글의 답글 거부 | ✅ `FeedCommentService.create`(`parent.isReply()` 검증) | ✅ `createFeedComment` → `toFeedComment` | PASS |
| 3 | `DELETE /api/v1/feed/posts/{postId}/comments/{commentId}` | 설계 초안: `204 No Content` | **변경(코드 리뷰 Should Improve)**: `200 OK` + `{removedCount}`(`FeedCommentDeleteResponse`) | ✅ `deleteFeedComment`가 응답 바디를 그대로 반환, `FeedDetailPage.jsx`가 `result.removedCount`를 우선 사용(폴백 포함) | 완료(계약 변경, 문서·구현·클라이언트 3면 일치) — §3 G-3 |
| 4 | `SecurityConfig` — 댓글 GET/POST/DELETE 인가 | ✅(설계 §4.4, D-5) 기존 `GET /api/v1/feed/posts/**` permitAll에 이미 포함, `SecurityConfig.java` 변경 불필요 | ✅ `SecurityConfig.java`는 `git status`에 나타나지 않음(미변경) | 실제 HTTP 요청으로 재검증 | PASS — `SecurityConfigFeedCommentAccessTest` 3종(비로그인 GET 200, POST 401, DELETE 401) 전부 통과 확인(§4.2) |
| 5 | `FeedCommentResponse.replies` | ✅ 답글은 항상 빈 리스트(1단계 제한) | ✅ `fromLeaf`가 `replies`를 `List.of()`로 고정 | ✅ `toFeedComment`가 재귀 호출하되 서버가 항상 빈 배열을 보장 | PASS |

**Contract Match Rate**: 5/5 = 100%(3번 항목은 구현 도중 계약이 바뀌었으나, 설계·서버·클라이언트 3면이 최종적으로 완전히 일치해 감점 대상이 아니다)

### 2.2 구조적 일치 (설계 §2.2, §9 모듈·의존성 목록)

| 구분 | 설계 명시 | 실제 | 결과 |
|------|-----------|------|:----:|
| 백엔드 신규 | `FeedComment`, `FeedCommentCreateRequest`, `FeedCommentResponse`, `FeedCommentPageResponse`, `FeedCommentRepository`, `FeedCommentService`, `FeedCommentController` | 전 파일 존재, 클래스·필드명 설계와 일치 | PASS |
| 백엔드 신규(설계에 없었음) | - | `FeedCommentDeleteResponse`(§3 G-3), `FeedPostRepository.adjustCommentCount`(§3 G-2) | 완료(계약 변경·코드 리뷰로 추가, 감점 아님) |
| 백엔드 수정 | `FeedPost`에 `comments` 컬렉션 + `increaseCommentCount`/`decreaseCommentCount` | `comments` 컬렉션은 설계 그대로 추가됨. `increaseCommentCount`/`decreaseCommentCount` **인스턴스 메서드는 추가되지 않음** — 대신 `FeedPostRepository.adjustCommentCount`(원자적 UPDATE)로 대체 | 완료(수정됨) — §3 G-2, 설계보다 안전한 구현으로 대체 |
| 백엔드 변경 없음(계획·설계가 명시) | `FeedController`/`FeedService`/`FeedProfileController`/`FeedProfileService`/`SecurityConfig` | `git status`에 전혀 나타나지 않음(미변경 확인) | PASS |
| 백엔드 신규 테스트(설계에 파일 목록 없음) | - | `FeedCommentServiceTest`(8개 테스트), `SecurityConfigFeedCommentAccessTest`(3개 테스트) | 완료(설계보다 견고한 구현) |
| 프론트 신규 | `api/feedCommentApi.js`, `hooks/useFeedComments.js`, `components/feed/{FeedCommentList,FeedCommentForm}.jsx`(+css) | 전 파일 존재, 함수·컴포넌트명 설계와 일치 | PASS |
| 프론트 수정 | `FeedDetailPage.jsx`(+css)에 댓글 섹션 연결 | `CommentSection`을 `FeedDetailContent`와 같은 파일에 로컬 컴포넌트로 추가(설계 모듈 표에 별도 파일로 명시되지 않았으므로 co-location 방식 선택) | PASS |
| 프론트 변경 없음(계획이 명시) | `FeedPage.jsx`, `FeedUserProfilePage.jsx`, `useFeedInfiniteList.js`, `useFeedDetail.js`, `useFeedUserProfile.js` | `git status`에 나타나지 않음(미변경 확인) | PASS |

**Structural Match Rate**: 100%(설계에 없던 `FeedCommentDeleteResponse`/`adjustCommentCount` 추가는 코드 리뷰로 발견된 문제를 고치는 과정에서 생긴 것이라 감점 대상이 아니다)

### 2.3 기능 요구사항(FR-19~33) 충족 여부 및 코드 리뷰 반영 확인

FR-34(알림)는 계획 §3.1이 "결번 안내"로 명시한 대로 Q-1 결정(제외 확정)에 따라 배정되지 않았다. 이번 사이클 FR은 15개(FR-19~33)다.

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-19 (`FeedComment` 엔티티) | ✅ | 자기 참조 `parent`, `replies`(orphanRemoval), `isReply()` 확인 |
| FR-20 (`FeedPost.comments` + 댓글 수 증감) | ✅(구현 방식 변경) | `comments` 컬렉션은 설계대로 추가. 증감은 인스턴스 메서드 대신 원자적 UPDATE(`adjustCommentCount`)로 대체(§3 G-2) |
| FR-21 (DTO 3종) | ✅ | `FeedCommentCreateRequest`(`@NotBlank`/`@Size(max=500)`), `FeedCommentResponse`(+`AuthorResponse`), `FeedCommentPageResponse` 확인 |
| FR-22 (`FeedCommentRepository`) | ✅(구현 방식 변경) | 설계 초안은 `replies`까지 한 번에 fetch join하는 단일 메서드였으나, 실제로는 `findByFeedPost_IdAndParentIsNullOrderByCreatedAtAsc`(author만 EntityGraph) + `findByParent_IdInOrderByCreatedAtAsc`(답글 별도 IN 쿼리)로 2단계 분리(§3 G-1) |
| FR-23 (`FeedCommentService`) | ✅ | `list`(2단계 쿼리 조합), `create`(답글 1단계 검증, 게시물/댓글 소속 검증), `delete`(작성자 검증, `removedCount` 반환) 확인 |
| FR-24 (`FeedCommentController`) | ✅ | `GET`/`POST`/`DELETE` 3종 매핑, `extractRequiredEmail`이 `FeedController`와 동일 패턴 복제 |
| FR-25 (게시물 삭제 cascade 테스트) | ✅ | `FeedCommentServiceTest.deletingPostCascadesComments`가 `feedPostRepository.delete()` + `flush()` 후 댓글·답글 모두 조회 불가함을 검증 |
| FR-26 (답글 1단계 제한 + 카운트 감소 테스트) | ✅ | `replyToReplyIsRejected`, `deletingTopLevelCommentCascadesRepliesAndDecreasesCount`, `deletingLeafReplyDecreasesCountByOne` 3종이 각각 검증 |
| FR-27 (`api/feedCommentApi.js`) | ✅ | `fetchFeedComments`/`createFeedComment`/`deleteFeedComment`, `toFeedComment` fail-closed(`id`·`author.id` 없으면 폐기) 확인 |
| FR-28 (`useFeedComments`) | ✅ | 페이지 번호 기반 누적(`INIT_SUCCESS`는 교체, `MORE_SUCCESS`는 append), `addComment`/`removeComment`(호출부가 API 성공 후에만 호출), `AbortController` 취소 확인 |
| FR-29 (`FeedCommentList.jsx`) | ✅ | 답글 토글 없이 항상 렌더링(Q-3), 답글 행에 `onReply` 미전달로 `[답글]` 버튼 미노출, "댓글 더 보기" 버튼 확인 |
| FR-30 (`FeedCommentForm.jsx`) | ✅(코드 리뷰로 구조 개선) | 최상위·인라인 답글 입력 겸용 확인. 최초 구현은 답글 모드 판별을 `onCancel` prop 존재 여부로 암묵 결합했으나, 코드 리뷰 Should Improve로 `isReply` 명시적 prop 분리(§3 G-4) |
| FR-31 (`FeedDetailPage.jsx` 통합) | ✅ | 기존 "댓글 N개" 표시 지점 바로 아래 `CommentSection` 연결, `applyLocalUpdate` 재사용으로 `commentCount` 갱신 확인 |
| FR-32 (삭제 확인 다이얼로그) | ✅ | `FeedConfirmDialog` 재사용, 답글 있는 댓글은 "답글도 함께 삭제됩니다" 문구 분기 확인 |
| FR-33 (비로그인 로그인 유도) | ✅ | `FeedCommentForm.handleSubmit`과 `CommentSection.handleStartReply`가 `requireLogin()` 호출 확인(좋아요·북마크와 동일 "클릭 시점 확인" 패턴) |

**코드 리뷰에서 발견되고 실제로 고쳐진 이슈 — 완료(수정됨)**

| # | 이슈 | 발견 단계 | 수정 내용 | 확인 근거 |
|---|------|-----------|-----------|-----------|
| G-1 | (Must Fix) 댓글 목록 조회가 겉보기엔 정상 동작하지만, `replies`(`@OneToMany` bag) fetch join과 `Pageable`(LIMIT/OFFSET)을 함께 쓰면 Hibernate가 SQL 페이지네이션을 포기하고 해당 게시물의 최상위 댓글+답글 **전체를 메모리로 읽은 뒤** 애플리케이션에서 잘라낸다(SQL 로그로 실측 확인된 문제 — 댓글이 많은 게시물일수록 `size` 파라미터가 사실상 무의미해짐) | frontend-code-reviewer | `FeedCommentRepository`를 2단계 쿼리로 분리: 최상위 댓글은 `author`만 `EntityGraph`로 페이지 조회, 답글은 최상위 댓글 id 목록으로 별도 `IN` 쿼리 1회(`findByParent_IdInOrderByCreatedAtAsc`) 실행. `FeedCommentResponse.from(comment, replies)` 오버로드로 조립 | `FeedCommentRepository.java` 주석, `FeedCommentService.list()`, `FeedCommentResponse.from` 오버로드 |
| G-2 | (Must Fix) `commentCount` 필드를 `increaseCommentCount()`/`decreaseCommentCount()`로 증감하고 dirty checking으로 flush하는 방식은, 같은 게시물에 여러 요청이 동시에 댓글을 쓰거나 지우면 나중에 flush된 트랜잭션이 앞선 변경을 덮어써 lost update가 발생할 수 있다 | frontend-code-reviewer | `FeedPostRepository.adjustCommentCount(postId, delta)`(`@Modifying @Query("UPDATE FeedPost p SET p.commentCount = p.commentCount + :delta WHERE p.id = :postId")`)로 대체해 DB 레벨 원자적 단일 UPDATE로 처리. **수정 과정에서 2차 부작용 발견**: 처음에 `@Modifying(clearAutomatically = true)`로 작성했더니, `FeedCommentService.delete()`가 `feedCommentRepository.delete(comment)`(영속성 컨텍스트에 삭제 예약만 하고 아직 flush 전)를 호출한 직후 이 원자적 UPDATE가 실행되면서 `clearAutomatically`가 영속성 컨텍스트를 통째로 비워 **flush되지 않은 삭제 예약까지 함께 사라져 댓글이 실제로는 삭제되지 않는 문제**를 로컬 테스트로 발견. `clearAutomatically`를 끄는 것으로 우회(이 UPDATE 자체는 이미 DB 단일 문장이라 원자성에는 영향 없음) | `FeedPostRepository.java`의 `adjustCommentCount` 주석(부작용 발견 경위 기록), `FeedCommentServiceTest`의 4개 카운트 검증 테스트 |
| G-3 | (Should Improve) 댓글 삭제 API가 `204 No Content`만 반환하면, 프론트가 삭제 확인 모달이 열린 시점의 로컬 state(`1 + comment.replies.length`)로 감소량을 추정해야 했다. 모달이 열려 있는 동안 다른 사용자가 그 댓글에 답글을 추가하면 추정치가 실제와 어긋날 수 있음 | frontend-code-reviewer | 응답을 `200 OK` + `FeedCommentDeleteResponse{removedCount}`로 변경. `FeedCommentService.delete()`가 서버가 실제로 삭제한 개수를 반환하도록 시그니처 변경(`void` → `long`). 프론트(`FeedDetailPage.jsx`)는 서버 값을 우선 사용하고, 응답 형식이 예상과 다를 때만 로컬 추정치로 폴백(fail-closed) | `FeedCommentDeleteResponse.java`, `FeedCommentController.delete`, `FeedDetailPage.jsx`의 `handleConfirmDelete` |
| G-4 | (Should Improve) `FeedCommentForm.jsx`가 "답글 모드 여부"를 `onCancel` prop의 존재 여부로 암묵적으로 판별(`rows={onCancel ? 2 : 3}`, `{onCancel && <button>취소</button>}`) — "취소 버튼 노출"과 "답글 모드인지"라는 서로 다른 두 의미가 하나의 prop에 겹쳐 있어, 나중에 최상위 입력에도 취소 버튼이 필요해지면 이 결합이 깨짐 | frontend-code-reviewer | `isReply`(boolean) prop을 신규 추가해 답글 모드 여부를 명시적으로 판단하도록 분리. `onCancel`은 순수하게 "취소 버튼 클릭 핸들러"로만 사용. 호출부(`FeedCommentList.jsx`의 인라인 답글 폼)가 `isReply`를 명시적으로 전달하도록 수정 | `FeedCommentForm.jsx`, `FeedCommentList.jsx` |

**완료(문서만, 후속 과제)**

| # | 항목 | 내용 |
|---|------|------|
| G-5 | Minor | `FeedCard.jsx`의 주석("commentCount는 항상 0이다(백엔드에 댓글 작성 경로가 아직 없음)")이 사이클 1 시점 그대로 남아 있음. 기능상 문제는 없다(실제 값이 정상 표시됨, SC-6) — 주석만 사실과 달라진 상태 |

**Functional Match Rate**: 98%(FR 15/15 전부 충족, Must Fix 2건·Should Improve 2건 전건 수정 완료. 감점 사유는 G-5의 문서 주석 미갱신 1건과 아래 §4의 백엔드 자동 테스트 재현 제약·L2 미검증)

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
│  코드 리뷰 Must Fix 2건 + Should Improve 2건  │
│  전건 반영 확인                                │
│  백엔드 신규 테스트 11개(코드 정독 확인)        │
│  백엔드 자동 테스트 — 이 세션에서는 미실행      │
│  (§4.2, JDK 버전 제약 재현)                    │
│  L2(브라우저 UI)/L3(E2E) — 미검증(도구 부재)  │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical 없음. Important(Must Fix/Should Improve 대응) 4건은 전부 "완료(수정됨)". 나머지는 Minor 1건뿐이다.

| # | 등급 | 항목 | 설계 | 구현 | 분류 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|------|-----------|:--:|
| G-1 | Important(완료, 수정됨) | to-many fetch join + Pageable 조합으로 인한 SQL 페이지네이션 무력화 | 설계 §4.2가 단일 `EntityGraph`로 `replies`까지 fetch join하는 리포지토리 메서드 1개를 초안으로 제시 | Hibernate가 컬렉션 fetch join과 LIMIT/OFFSET을 함께 만나면 메모리 페이지네이션으로 전환한다는 것을 SQL 로그로 확인 → 2단계 쿼리(최상위 페이지 조회 + 답글 IN 조회)로 분리 | 완료(Must Fix, 수정됨) | Design 문서 §4.2의 리포지토리 코드 예시를 실제 구현(2단계 쿼리)으로 갱신 | 100% |
| G-2 | Important(완료, 수정됨) | `commentCount` 필드 증감의 동시성 미보호(lost update) | 설계 §3.1이 `increaseCommentCount(long)`/`decreaseCommentCount(long)` 인스턴스 메서드로 초안 제시 | 동시 요청 시 dirty checking 방식은 나중에 flush된 트랜잭션이 이전 변경을 덮어쓸 수 있음 → 원자적 UPDATE(`adjustCommentCount`)로 대체, 그 과정에서 `clearAutomatically=true`의 2차 부작용까지 발견·우회 | 완료(Must Fix, 수정됨) | Design 문서 §3.1의 인스턴스 메서드 코드 예시를 실제 구현(리포지토리 원자적 UPDATE)으로 갱신 | 100% |
| G-3 | Important(완료, 수정됨) | 댓글 삭제 API의 `removedCount` 미제공 | 설계 §4.2 초안은 `204 No Content` | 프론트가 로컬 state로 감소량을 추정해야 했던 부정확성 → `200 OK` + `{removedCount}`로 계약 변경 | 완료(Should Improve, 수정됨) | Design 문서 §4.2·§7.2를 새 응답 계약(200 + removedCount)으로 갱신 | 100% |
| G-4 | Important(완료, 수정됨) | `FeedCommentForm`의 `onCancel`/답글 모드 암묵적 결합 | 설계에 prop 상세 명시 없음(구현 세부사항) | `onCancel` 존재로 답글 모드를 암묵 판별 → `isReply` prop 분리 | 완료(Should Improve, 수정됨) | 없음 | 100% |
| G-5 | Minor(후속 과제) | `FeedCard.jsx`의 사이클 1 시점 주석이 갱신되지 않음 | 설계에 명시 없음(구현 세부사항) | "commentCount는 항상 0"이라는 주석이 실제로는 사실이 아니게 됨(기능은 정상 동작) | 후속 과제(문서 정리) | 주석을 "commentCount는 이제 실제 값을 반영한다(feed-comment-integration)"로 갱신 | 100% |

**감점 없는 참고 사항**: 계획 §2.2가 명시적으로 제외한 항목(알림, 댓글 좋아요, 댓글 수정, 무제한 중첩 답글, 댓글 검색/필터, 댓글 무한 스크롤, 낙관적 업데이트 패턴 통합)은 전부 미구현 상태 그대로이며, 이는 설계 의도와 완전히 일치하므로 gap이 아니다.

---

## 4. Runtime Verification

### 4.1 정적 분석 + 빌드

| 카테고리 | 결과 |
|----------|:----:|
| `npm run lint` | ✅ 오류 0건 |
| `npm run build` | ✅ 성공(258 modules, 이번 변경과 무관한 기존 CSS 경고 1건은 사이클 1과 동일하게 그대로) |
| API 계약 대조 | ✅ 5/5(계약 변경 1건 포함 3면 일치 확인) |
| 코드 리뷰 Must Fix·Should Improve 반영 확인 | ✅ 4/4 코드 근거로 재확인(§2.3) |
| 수정 금지 파일 회귀 | ✅ `FeedController`/`FeedService`/`FeedProfileController`/`FeedProfileService`/`SecurityConfig`/`FeedPage`/`FeedUserProfilePage`/관리자 피드 모더레이션 전부 `git status` 미표시로 미변경 확인 |

### 4.2 백엔드 자동 테스트 — 실행 시도 결과

`./mvnw -Dtest=FeedCommentServiceTest,SecurityConfigFeedCommentAccessTest test`를 이 세션에서 재시도했으나, `JAVA_HOME`(JDK 17.0.0.1)이 `pom.xml`의 `<java.version>25</java.version>`을 지원하지 않아 이전 두 사이클(tour-course-list-integration, feed-integration)과 **동일한 환경 제약**으로 컴파일 단계에서 실패했다(코드 결함이 아니다). 이번 사이클에서 새로 확인한 것:

- `target/surefire-reports/`에 이미 존재하던 과거 실행 기록을 확인한 결과, `SecurityConfigFeedCommentAccessTest`는 **3/3 전건 통과**로 기록돼 있었다(비로그인 GET 200, POST 401, DELETE 401)
- `FeedCommentServiceTest`의 기존 기록은 **8개 테스트 메서드 중 1개만 실행된 부분 실행 흔적**(디버깅 중 특정 메서드만 지정해 실행한 결과로 추정)이라, 이 세션에서는 "8개 전부 통과"의 직접 증거로 삼지 않았다. 코드 정독으로 8개 테스트의 시나리오·단언문을 전부 확인했으며(§2.3 FR-25, FR-26), 로직상 설계·계획의 요구사항과 일치한다
- frontend-support-backend가 별도 환경(JDK 25)에서 전체 스위트 92/92 통과를 보고했다는 점은 이 문서의 분석 근거로 인용하되, 이 세션 자체에서 재현 검증하지는 못했다(아래 개선 과제 참고)

### 4.3 L2 UI(브라우저)/L3 E2E — 미검증

이전 세 PDCA 주기와 동일하게 이 환경에 브라우저 자동화 도구가 없어 미실행이다. 우선순위가 높은 후속 검증 항목:

| 항목 | 관련 완료 조건 |
|------|----------------|
| 답글 인라인 입력창이 실제로 한 번에 하나만 열리고, 다른 댓글의 `[답글]`을 누르면 이전 것이 닫히는지 | SC-2 |
| 삭제 확인 모달이 열려 있는 동안 실제로 다른 브라우저 탭에서 답글을 추가했을 때 `removedCount` 처리가 올바른지(G-3 시나리오 실측) | SC-4 |
| 댓글이 많은 게시물에서 "더 보기"를 여러 번 눌렀을 때 실제 응답 시간이 페이지 크기와 무관하게 느려지지 않는지(G-1 수정 확인) | SC-1 |
| 모바일 폭에서 인라인 답글 입력창·1단 들여쓰기 레이아웃이 깨지지 않는지 | 계획 §3.2 반응형 |

---

## 5. 관리자 코드·사이클 1 회귀 확인 (계획 §2.1 "이미 검증된 코드는 건드리지 않는다" 원칙 검증)

```
M  backend/.../feed/domain/FeedPost.java                  (comments 컬렉션 추가, 기존 필드·메서드 무변경)
M  backend/.../feed/repository/FeedPostRepository.java    (adjustCommentCount 추가, 기존 메서드 무변경)
M  frontend/src/pages/FeedDetailPage.jsx                  (CommentSection 연결, 기존 좋아요/북마크/삭제 로직 무변경)
M  frontend/src/pages/FeedDetailPage.css                  (댓글 섹션 스타일 추가)

A  backend/.../feed/controller/FeedCommentController.java
A  backend/.../feed/domain/FeedComment.java
A  backend/.../feed/dto/FeedComment{CreateRequest,DeleteResponse,PageResponse,Response}.java
A  backend/.../feed/repository/FeedCommentRepository.java
A  backend/.../feed/service/FeedCommentService.java
A  backend/src/test/.../config/SecurityConfigFeedCommentAccessTest.java
A  backend/src/test/.../feed/FeedCommentServiceTest.java
A  frontend/src/api/feedCommentApi.js
A  frontend/src/hooks/useFeedComments.js
A  frontend/src/components/feed/FeedComment{List,Form}.jsx(+css)
```

`FeedController.java`, `FeedService.java`, `FeedProfileController.java`, `FeedProfileService.java`, `SecurityConfig.java`, `FeedExceptionHandler.java`, `FeedAdminController.java`, `FeedAdminService.java`, `frontend/src/pages/{FeedPage,FeedUserProfilePage}.jsx`, `frontend/src/hooks/{useFeedInfiniteList,useFeedDetail,useFeedUserProfile}.js`는 `git status`에 전혀 나타나지 않아 **단 한 줄도 수정되지 않았음**을 확인했다.

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
│  Important Gap: 4건(전건 완료·수정됨)          │
│  Minor Gap: 1건(후속 과제, 문서 주석)          │
└─────────────────────────────────────────────┘
```

Match Rate가 계획 §4.2 목표(90% 이상)를 크게 상회한다. Critical gap이 없고, Important 4건(SQL 페이지네이션 무력화, commentCount 동시성, 삭제 응답 계약, FeedCommentForm prop 결합)은 코드 리뷰를 거쳐 전건 수정 완료됐다. 남은 Minor 1건은 기능에 영향 없는 문서 주석 정리다.

---

## 7. 권장 조치

### 7.1 코드 수정

없음. Important 4건 모두 이미 수정 완료됐다(§2.3, §3).

### 7.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-1: 설계 §4.2의 리포지토리 코드 예시를 2단계 쿼리 방식으로 갱신
- G-2: 설계 §3.1의 `increaseCommentCount`/`decreaseCommentCount` 인스턴스 메서드 예시를 `adjustCommentCount` 원자적 UPDATE 방식으로 갱신, `clearAutomatically` 부작용 발견 경위를 설계 문서에도 남기는 것을 검토
- G-3: 설계 §4.2·§7.2를 `200 OK` + `{removedCount}` 계약으로 갱신
- G-5: `FeedCard.jsx`의 사이클 1 시점 주석을 실제 동작에 맞게 갱신

### 7.3 후속 과제 (다음 세션 또는 다음 PDCA)

- G-5: `FeedCard.jsx` 주석 갱신(낮은 위험, 문서성 수정)
- JDK 25 환경(또는 CI)에서 `mvnw clean test` 전체 실행으로 92/92 통과를 이 세션 기준으로도 재현·확정(§4.2 — tour-course-list-integration, feed-integration에 이어 **세 번째로 반복되는 환경 제약**)
- 브라우저 자동화 환경에서 §4.3 L2 체크리스트 실행
- 사이클 1 보고서가 남긴 G-6(낙관적 업데이트 오버레이 패턴 3곳 중복)는 이번 사이클이 댓글에 낙관적 업데이트를 적용하지 않기로 결정(Q-4)해 네 번째 변형은 생기지 않았으나, 기존 3곳의 통합 자체는 여전히 미해결 후속 과제로 남아 있음

---

## 8. Next Steps

- [x] Critical gap 없음 확인
- [x] Important gap 4건(G-1~G-4) 전건 수정 확인
- [x] 코드 리뷰 Must Fix 2건·Should Improve 2건 반영 확인
- [ ] Completion Report 작성(`feed-comment-integration.report.md`)
- [ ] 후속: JDK 25(또는 CI) 환경에서 `mvnw clean test` 전체 실행, 이 세션 기준으로도 재현
- [ ] 후속: 브라우저 자동화 환경에서 L2 체크리스트 실행
- [ ] 후속: `FeedCard.jsx` 주석 갱신(G-5)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-30 | 최초 gap 분석(사이클 2). Match Rate 99.2%, Critical 0건, Important 4건(전건 완료). 코드 리뷰 Must Fix 2건(SQL 페이지네이션 무력화, commentCount 동시성)과 Should Improve 2건(삭제 응답 계약, FeedCommentForm prop 결합)을 완료로, `FeedCard.jsx` 주석 미갱신 1건을 Minor 후속 과제로 분류. 백엔드 자동 테스트는 이전 두 사이클과 동일한 JDK 버전 제약으로 이 세션에서 재현하지 못했으나, 기존 실행 기록과 코드 정독으로 로직을 확인 | frontend-lead (Claude Code 보조) |
