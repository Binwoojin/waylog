# feed-comment-integration 계획 문서

> **요약**: `feed-integration`(PDCA 사이클 1, 무한 스크롤 타임라인·상세·작성·삭제·좋아요·북마크·타인 프로필)이 완료됐다(Match Rate 98.8%, Critical 0건). 규모상 분리하기로 확정했던 **사이클 2**가 이 문서다 — 게시물에 댓글과 답글(1단계)을 붙인다.
>
> 엔티티 구조(`FeedComment` 자기 참조), 답글 1단계 제한, API 3종의 초안은 이미 `docs/02-design/features/feed-integration.design.md` §3.4~3.5·§4.3·§8에 "사이클 2 사전 설계"로 구체화돼 있다. 이 Plan 문서는 그 사전 설계를 처음부터 다시 설계하는 것이 아니라, **재조사로 코드 변경 여부를 확인하고 이번 사이클의 범위·우선순위·미해결 질문을 공식화**하는 것이 목적이다.
>
> 재조사 결과, 사전 설계가 전제로 삼았던 코드(`FeedPost.java`, `FeedController.java`, `FeedService.java`, `FeedPostRepository.java`, `SecurityConfig.java`)는 사이클 1 완료 후에도 **사전 설계 당시와 완전히 동일**하다 — `FeedPost`에는 아직 `comments`/`increaseCommentCount`가 없고, 커서 기반 목록 API·타인 프로필 API만 추가된 상태다. 사전 설계 그대로 얹어도 안전하다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-09-30
> **상태**: Approved — 8장 Q-1~Q-4 사용자 결정 완료(2026-09-30, 전부 권장안 채택). Design 문서 작성 단계로 진행
> **근거**: `backend/.../feed/**` 코드 재확인(2026-09-30), `backend/.../config/SecurityConfig.java` 확인, `backend/.../board/entity/Comment.java` 확인(재사용 불가 재확인), `docs/02-design/features/feed-integration.design.md` §3.4~3.5·§4.3·§8(사전 설계), `docs/01-plan/features/feed-integration.plan.md`(사이클 분리 결정 근거), `docs/03-analysis/feed-integration.analysis.md`·`docs/04-report/features/feed-integration.report.md`(사이클 1 마무리 상태·이월 항목)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 게시물 상세(`FeedDetailPage.jsx`)는 "댓글 N개"를 숫자로만 보여주고(거짓 UI 금지 원칙, 사이클 1에서 의도적으로 링크로 만들지 않음), 실제 댓글을 읽거나 쓸 방법이 없다. 답글로 소통하는 SNS 핵심 기능이 통째로 빠져 있다 |
| **해결** | 사전 설계된 `FeedComment`(자기 참조, 답글 1단계 제한) 엔티티와 댓글 API 3종을 구현하고, 게시물 상세 화면에 댓글 목록(최상위 페이지네이션 "더 보기")·답글 인라인 작성·본인 댓글 삭제를 붙인다 |
| **기능/UX 효과** | 사용자가 게시물에 댓글을 남기고, 댓글에 답글(1단계까지)을 달고, 본인 댓글을 지울 수 있게 된다. 사이클 1이 항상 0으로 보여주던 "댓글 N개" 표시가 **코드 변경 없이** 실제 값으로 바뀐다(사이클 1 설계 §13 "연결 지점") |
| **범위 경계** | 댓글·답글의 엔티티·API·UI만 다룬다. 실시간 알림, 댓글 좋아요, 댓글 수정, 무제한 중첩 답글은 범위 밖이다(2장) |
| **핵심 가치** | 자기 참조 엔티티로 트리형 데이터를 답글 1단계 제한을 서비스 계층에서 강제하며 설계하는 것, "이미 있는 공개 GET permitAll 패턴이 새 하위 경로까지 자동으로 포함하는지"를 코드로 직접 검증해 사이클 1에서 실제로 발생했던 SecurityConfig 누락(G-1)을 재발시키지 않은 것, 게시물 삭제 cascade가 이미 설계된 연관관계 덕분에 코드 변경 없이 댓글까지 정리되는 것 — 모두 면접에서 설명 가능한 소재다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 게시물 상세의 "댓글 N개" 표시가 사이클 1부터 항상 0으로 고정돼 있다. 백엔드에 댓글 엔티티 자체가 없어(`FeedPost.commentCount`는 누구도 증가시키지 않는 죽은 필드) 만들지 않으면 영구히 빈 기능으로 남는다 |
| **WHO** | 게시물에 의견을 남기는 사용자, 댓글에 답글로 반응하는 사용자, 본인 댓글을 정리하고 싶은 사용자 |
| **RISK** | 자기 참조 엔티티에서 답글의 답글을 막는 로직을 서버가 확실히 강제하지 못하면 무제한 중첩으로 화면이 망가질 수 있음 / 최상위 댓글 삭제 시 답글까지 cascade로 사라지는 것과 `commentCount` 감소 계산이 어긋나면 카운트 오차가 생길 수 있음 / 사이클 1의 G-1(새 공개 API의 `SecurityConfig` 등록 누락)이 반복될 위험 |
| **SUCCESS** | 게시물 상세에서 댓글·답글(1단계) 작성·조회·삭제가 모두 동작 / 답글의 답글은 서버가 거부 / 게시물 삭제 시 댓글이 고아 레코드 없이 자동 정리됨 / 로딩·에러·빈 상태 구분 / 사이클 1 화면·관리자 모더레이션에 회귀 없음 |
| **SCOPE** | 백엔드: `FeedComment` 신규 엔티티, `FeedPost`에 `comments`/카운트 증감 메서드 추가, 댓글 API 3종(`FeedCommentController`/`Service`/`Repository`), DTO 3종 / 프론트: `api/feedCommentApi.js`, `hooks/useFeedComments.js`, `components/feed/{FeedCommentList,FeedCommentForm}.jsx`, `FeedDetailPage.jsx`에 댓글 섹션 연결 |

---

## 1. 개요

### 1.1 목적

게시물 상세 화면에 댓글·답글 기능을 붙여, 사이클 1이 완성한 "볼 수 있는 피드"를 "소통할 수 있는 피드"로 완결시킨다. 답글은 인스타그램·트위터 등 주요 SNS와 같은 방식으로 1단계까지만 허용한다(무제한 중첩은 렌더링 복잡도와 사용자 혼란만 키운다는 사이클 1 설계 단계의 판단을 그대로 따른다).

### 1.2 배경 (재조사 결과)

**사전 설계가 전제로 삼은 코드가 사이클 1 완료 후에도 그대로인지 확인**

| 파일 | 사전 설계 당시 가정 | 재조사 결과(2026-09-30) | 판정 |
|------|---------------------|--------------------------|------|
| `feed/domain/FeedPost.java` | `comments` 컬렉션, `increaseCommentCount`/`decreaseCommentCount` **없음**(사이클 2에서 추가 예정) | 실제로 없음. `commentCount` 필드는 존재하지만 어디서도 증가되지 않는 죽은 필드(계획 §1.2, 사이클 1과 동일) | 사전 설계 그대로 유효 |
| `feed/controller/FeedController.java` | 커서 파라미터(`cursor`/`size`)만 있고 댓글 라우트 없음 | 사이클 1 그대로(`FeedPageResponse` → `FeedTimelineResponse` 교체 완료), 댓글 관련 코드 없음 | 사전 설계 그대로 유효 |
| `feed/service/FeedService.java` | `delete()`가 `feedPostRepository.delete(post)`로 하드 삭제, 댓글 cascade는 `FeedPost.comments`의 `cascade=ALL`에 위임 | `delete()` 로직 동일 확인. 게시물 삭제는 여전히 코드 변경 없이 댓글까지 함께 정리될 수 있는 구조 | 사전 설계 그대로 유효 |
| `feed/repository/FeedPostRepository.java` | `findWithDetailsById`/`findWithDetailsByIdAndDeletedAtIsNull`이 `@EntityGraph(attributePaths = {"author", "photos"})`만 즉시 로딩(`comments` 추가해도 지연 로딩 유지) | 두 메서드 모두 `attributePaths = {"author", "photos"}`로 확인, `comments`를 추가해도 여기 영향 없음(설계 §14 O-1 검증 그대로 유효) | 사전 설계 그대로 유효 |
| `config/SecurityConfig.java` | 사전 설계 문서 작성 시점에는 미확인 영역 | **재조사로 신규 확인**: `.requestMatchers(HttpMethod.GET, "/api/v1/feed/posts/**").permitAll()`가 이미 다중 세그먼트 와일드카드(`**`)라 `GET /api/v1/feed/posts/{postId}/comments`도 **추가 설정 없이 자동으로 permitAll에 포함된다.** 댓글 작성·삭제(POST/DELETE)는 이 규칙에 해당하지 않아 `anyRequest().authenticated()`로 자동 인증 요구된다 | **사이클 1의 G-1(SecurityConfig 갱신 누락) 재발 위험 없음 — 이번 사이클은 SecurityConfig 변경 자체가 불필요하다는 것을 구현 전에 미리 확인함** |
| `board/entity/Comment.java` | 게시판(`board`) 전용, `Post` FK가 고정돼 재사용 불가 | 재확인: `@JoinColumn(name = "post_id")`가 `board.entity.Post`에 고정, `author`도 `String`(닉네임 텍스트)일 뿐 `UserEntity` 연관관계가 아님 | 재사용 불가 재확인, `FeedComment` 신규 엔티티가 유일한 선택지 |
| `user/entity/UserEntity.java` | `nickname`, `profileImageUrl`, `email` 필드로 `FeedCommentResponse.AuthorResponse` 구성 | 세 필드 모두 존재 확인(`FeedPostResponse.AuthorResponse`가 이미 동일한 필드로 작성자 정보를 구성 중이라 패턴이 검증돼 있음) | 사전 설계 그대로 유효 |

**결론**: 사전 설계(엔티티 스키마, DTO, API 시그니처, 서비스 로직)는 재조사 결과 **수정 없이 그대로 구현 대상으로 채택**한다. 유일하게 사전 설계 문서가 다루지 않았던 `SecurityConfig` 영향은 이번 재조사로 "변경 불필요"임을 미리 확인해, 사이클 1에서 실제로 있었던 실수(G-1)를 이번에는 설계 단계 이전에 방지했다.

### 1.3 관련 문서

- 사전 설계: `docs/02-design/features/feed-integration.design.md` §3.4~3.5(`FeedComment` 엔티티·DTO), §4.3(댓글 API), §8(댓글·답글 UI), §11(의존성), §12(회귀 체크리스트) — 전부 "사이클 2 사전 설계" 표시가 돼 있으며, 이 Plan 문서가 그 내용을 이번 사이클의 구현 대상으로 공식 채택한다
- 사이클 1 계획: `docs/01-plan/features/feed-integration.plan.md`(Q-1 "댓글+답글 포함 확정, 답글 1단계", §9 "사이클 1 완료 후 이 문서 작성부터 재시작")
- 사이클 1 분석·보고서: `docs/03-analysis/feed-integration.analysis.md`(G-1 SecurityConfig 누락 사례, G-6 낙관적 업데이트 패턴 미통합 이월), `docs/04-report/features/feed-integration.report.md`(§6.3 "새 엔드포인트 추가 시 SecurityConfig 체크리스트화" 개선 과제, §7.2 "낙관적 업데이트 패턴 통합을 사이클 2 착수 전에 결정" 권고)

---

## 2. 범위

### 2.1 포함 (이번 `feed-comment-integration` 사이클)

- [ ] 백엔드: `FeedComment` 신규 엔티티(자기 참조 `parent`, 답글 1단계 제한) — 설계 §3.4
- [ ] 백엔드: `FeedPost`에 `comments` 컬렉션(cascade+orphanRemoval) 및 `increaseCommentCount`/`decreaseCommentCount` 추가 — 설계 §3.4
- [ ] 백엔드: DTO 3종(`FeedCommentCreateRequest`, `FeedCommentResponse`, `FeedCommentPageResponse`) — 설계 §3.5
- [ ] 백엔드: `FeedCommentRepository`(최상위 댓글 페이지네이션, 답글 fetch join) — 설계 §4.3
- [ ] 백엔드: `FeedCommentService`(목록/작성/삭제, 답글 1단계 검증, 댓글 수 증감) — 설계 §4.3
- [ ] 백엔드: `FeedCommentController`(GET 목록·POST 작성·DELETE 삭제) — 설계 §4.3
- [ ] 프론트: `api/feedCommentApi.js`(목록·작성·삭제, view model 변환, fail-closed)
- [ ] 프론트: `hooks/useFeedComments.js`(최상위 페이지네이션 상태 + 작성/삭제 후 목록 갱신)
- [ ] 프론트: `components/feed/FeedCommentList.jsx`(댓글+답글 렌더링, "더 보기" 버튼, 답글에는 "답글" 버튼 미노출)
- [ ] 프론트: `components/feed/FeedCommentForm.jsx`(최상위 댓글 입력창, 댓글별 인라인 답글 입력)
- [ ] 프론트: `FeedDetailPage.jsx`에 댓글 섹션 연결(현재 "댓글 N개" 숫자만 표시하던 지점 바로 아래)
- [ ] 프론트: 본인 댓글 삭제 확인 다이얼로그(`FeedConfirmDialog` 재사용, "답글이 있는 댓글을 삭제하면 답글도 함께 삭제됩니다" 안내 문구 포함 — 설계 §8.3)
- [ ] 프론트: 비로그인 사용자가 댓글·답글 작성/삭제를 시도할 때 로그인 유도(사이클 1과 동일한 `requireLogin()` 패턴 재사용)
- [ ] 검증: 게시물 하드 삭제 시 댓글이 cascade로 함께 삭제되는지(고아 레코드 없음) 테스트로 확인 — 설계 §12가 예고한 "사이클 2 착수 시 추가할 체크리스트"

### 2.2 제외

- **실시간 알림**(댓글·답글 작성 시 알림) — **제외 확정(Q-1, 2026-09-30)**. 백엔드에 알림 엔티티·서비스 자체가 전혀 없음을 재확인(grep, 1.2절). 포함하면 알림 시스템 전체를 새로 설계해야 해 이번 사이클 범위를 다시 admin-dashboard 개별 리소스 이상으로 키운다. 알림은 완전히 별도의 후속 기능으로 다룬다
- **댓글 좋아요** — 계획·사전 설계 어디에도 언급되지 않은 완전히 새로운 기능. `FeedLike`가 게시물 전용 구조라 재사용하려면 별도 설계가 필요
- **댓글 수정** — 게시물 자체도 "SNS는 보통 수정 기능을 제공하지 않는다"는 판단으로 삭제만 지원한다(사이클 1 Q-2). 댓글도 동일한 원칙을 유지해 수정 기능을 만들지 않는다
- **무제한 중첩 답글** — 설계 §8.1이 이미 근거와 함께 1단계로 확정(재논의 대상 아님)
- **댓글 검색/필터** — 사이클 1의 태그 검색 제외(Q-7)와 같은 이유로 범위 밖
- **댓글 무한 스크롤** — 설계 §2.2 P-11이 이미 "최상위 댓글은 페이지 단위 '더 보기'가 무한 스크롤보다 구현·리뷰 비용이 낮다"고 확정(재논의 대상 아님)
- **낙관적 업데이트 오버레이 패턴 통합**(G-6) — 사이클 1 보고서가 "사이클 2 착수 전에 결정 권장"으로 남긴 이월 과제이지만, 이 자체를 사이클 2의 구현 항목으로 묶지는 않는다. 댓글 작성·삭제에 낙관적 업데이트를 적용할지 여부만 이번 사이클에서 결정한다(8장 Q-4). 기존 3곳(`FeedPage`/`FeedDetailPage`/`FeedUserProfilePage`)의 패턴을 통합하는 리팩터링은 여전히 별도 후속 과제로 남긴다

---

## 3. 요구사항

### 3.1 기능 요구사항

> FR 번호는 `feed-integration.plan.md`가 결번 처리한 FR-13·FR-14를 재사용하지 않고, 그 문서의 마지막 번호(FR-18) 다음부터 이어서 부여한다(같은 `/feed` 기능 계열의 연속된 FR 이력을 유지하기 위함).

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-19 | 백엔드: `FeedComment` 엔티티(자기 참조 `parent`, `replies`, `isReply()`) — 설계 §3.4 | High | frontend-support-backend | Pending |
| FR-20 | 백엔드: `FeedPost`에 `comments` 컬렉션(cascade=ALL, orphanRemoval) + `increaseCommentCount`/`decreaseCommentCount` 추가 | High | frontend-support-backend | Pending |
| FR-21 | 백엔드: DTO 3종(`FeedCommentCreateRequest`/`FeedCommentResponse`/`FeedCommentPageResponse`) — 설계 §3.5 | High | frontend-support-backend | Pending |
| FR-22 | 백엔드: `FeedCommentRepository.findByFeedPost_IdAndParentIsNullOrderByCreatedAtAsc`(답글 fetch join 포함) | High | frontend-support-backend | Pending |
| FR-23 | 백엔드: `FeedCommentService.list/create/delete`(답글의 답글 거부, 게시물/댓글 소속 검증, 댓글 수 증감) — 설계 §4.3 | High | frontend-support-backend | Pending |
| FR-24 | 백엔드: `FeedCommentController`(`GET`·`POST`·`DELETE /api/v1/feed/posts/{postId}/comments[/{commentId}]`) | High | frontend-support-backend | Pending |
| FR-25 | 백엔드 테스트: 게시물 하드 삭제 시 댓글·답글 cascade 정리 검증(고아 레코드 없음) — 설계 §12 이월 체크리스트 | High | frontend-support-backend | Pending |
| FR-26 | 백엔드 테스트: 답글의 답글 생성 시도 시 거부, 최상위 댓글 삭제 시 답글 수만큼 `commentCount` 정확히 감소 | High | frontend-support-backend | Pending |
| FR-27 | 프론트: `api/feedCommentApi.js` — `fetchFeedComments(postId, {page,size}, {signal})`/`createFeedComment(postId, {content, parentCommentId})`/`deleteFeedComment(postId, commentId)`, view model 변환(fail-closed) | High | frontend-lead | Pending |
| FR-28 | 프론트: `hooks/useFeedComments.js` — 최상위 댓글 페이지네이션 상태(loading/success/error/loading-more), 작성·삭제 후 목록 갱신 | High | frontend-lead | Pending |
| FR-29 | 프론트: `components/feed/FeedCommentList.jsx` — 댓글+답글(1단 들여쓰기) 렌더링, 답글에는 "답글" 버튼 미노출, "더 보기" 버튼 | High | frontend-lead | Pending |
| FR-30 | 프론트: `components/feed/FeedCommentForm.jsx` — 최상위 댓글 입력창(화면 하단 고정) + 댓글별 인라인 답글 입력 | High | frontend-lead | Pending |
| FR-31 | 프론트: `FeedDetailPage.jsx`에 댓글 섹션 연결(기존 "댓글 N개" 숫자 표시 아래) | High | frontend-lead | Pending |
| FR-32 | 프론트: 본인 댓글 삭제 확인 다이얼로그(`FeedConfirmDialog` 재사용), 답글 있는 댓글 삭제 시 안내 문구 | High | frontend-lead | Pending |
| FR-33 | 프론트: 비로그인 사용자의 댓글·답글 작성/삭제 시도 시 로그인 유도 | Medium | frontend-lead | Pending |

> **FR-34 결번 안내**: 댓글 작성 알림은 Q-1 결정(2026-09-30, 제외 확정)에 따라 이번 사이클 범위에서 완전히 빠진다. 번호를 배정하지 않고 결번으로 남긴다.

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 데이터 정합성 | 답글의 답글 생성 시도는 서버가 `IllegalArgumentException`으로 거부(프론트가 실수로 버튼을 노출해도 API 계층에서 원천 차단) | 백엔드 테스트(FR-26) |
| 데이터 정합성 | 최상위 댓글 삭제 시 답글이 orphanRemoval로 함께 삭제되고, `commentCount` 감소량이 `1 + 답글 수`와 정확히 일치 | 백엔드 테스트(FR-26) |
| 데이터 정합성 | 게시물 하드 삭제 시 댓글이 cascade로 자동 정리되어 고아 레코드가 남지 않음 | 백엔드 테스트(FR-25) |
| 보안(XSS) | 댓글 내용은 일반 텍스트로만 렌더링(`dangerouslySetInnerHTML` 금지, 사이클 1과 동일 원칙) | 코드 리뷰 |
| 보안(인가) | 본인 댓글만 삭제 가능, 다른 사용자의 댓글에는 삭제 버튼 자체를 렌더링하지 않음 + 서버도 작성자 검증 | 코드 리뷰 + 수동 확인 |
| 거짓 UI 금지 | 답글이 없는 댓글에 빈 "답글 보기" 토글을 만들지 않음(설계 §1.2 원칙 계승) | 코드 리뷰 |
| 경쟁 조건 | 댓글 "더 보기" 중복 클릭·언마운트 시 요청 취소(사이클 1의 `AbortController` 패턴 재사용) | 코드 리뷰 |
| 회귀 방지 | 사이클 1 화면(타임라인·타인 프로필)과 관리자 피드 모더레이션에 변화 없음 | 수동 확인 + git status |
| 접근성 | 댓글 입력 폼 레이블, 답글 인라인 입력의 포커스 이동, 삭제 확인 모달의 `role="alertdialog"`(사이클 1 `FeedConfirmDialog` 그대로 재사용) | 코드 리뷰 |
| 반응형 | 댓글·답글 목록, 인라인 답글 입력창이 모바일 폭에서 깨지지 않음 | 브라우저 크기 조절 |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] 게시물 상세에서 최상위 댓글 목록(페이지 단위 "더 보기")과 답글(1단계, 항상 펼쳐짐 — Q-3 확정)을 볼 수 있다
- [ ] 로그인한 사용자가 댓글과 답글을 작성할 수 있다
- [ ] 답글에는 답글을 달 수 없다(UI에 버튼이 없고, 서버도 거부)
- [ ] 작성자 본인이 자신의 댓글(및 그 답글)을 삭제할 수 있다
- [ ] 게시물을 삭제하면 그 댓글·답글도 고아 레코드 없이 함께 삭제된다
- [ ] `FeedCard`/`FeedDetailPage`의 "댓글 N개" 표시가 실제 값으로 바뀐다(코드 변경 없이, 사이클 1 설계 §13 "연결 지점" 그대로)
- [ ] 로딩·에러(재시도)·빈 상태(댓글 없음)가 구분되어 표시된다
- [ ] 사이클 1 화면(타임라인·상세·타인 프로필)과 관리자 피드 모더레이션에 회귀가 없다
- [ ] frontend-code-reviewer 리뷰와 gap 분석 완료

### 4.2 품질 기준

- [ ] `npm run lint` 오류 0, `npm run build` 성공
- [ ] 백엔드 신규 테스트(cascade 삭제, 답글 1단계 제한, 댓글 수 증감) 작성 및 코드 정독 확인(자동 실행은 이전 두 사이클과 동일한 JDK 버전 제약이 있을 수 있음 — 가능하면 JDK 25 환경에서 실행)
- [ ] gap 분석 Match Rate 90% 이상

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 답글의 답글을 서버가 확실히 막지 못하면 무제한 중첩으로 이어짐 | Medium | Low | `parent.isReply()` 검증을 서비스 계층에 명시적으로 두고(설계 §4.3), 이를 검증하는 테스트를 FR-26으로 별도 명시 |
| 댓글 삭제 시 `commentCount` 감소 계산(`1 + 답글 수`)이 실제 삭제된 행 수와 어긋날 위험 | Medium | Low | orphanRemoval 삭제 전에 답글 수를 먼저 세어 계산하는 설계(§4.3)를 그대로 따르고, 테스트(FR-26)로 검증 |
| 새 공개 GET 엔드포인트 추가 시 `SecurityConfig` 갱신 누락(사이클 1 G-1 재발) | Medium | **해소됨(1.2절 재조사로 사전 확인)** | 기존 `GET /api/v1/feed/posts/**` permitAll이 댓글 목록 GET을 이미 포함함을 구현 전에 확인했다. 다만 구현 단계에서 실제 요청으로 재검증(체크리스트 §6.3)해, "코드로 확인했다"가 "실제로 동작한다"와 다르지 않은지 한 번 더 확인한다 |
| 낙관적 업데이트를 댓글에도 적용하면 사이클 1의 G-6(패턴 3곳 중복)에 네 번째 변형이 추가됨 | Low | **해소됨(Q-4로 미적용 확정)** | 댓글 작성·삭제는 서버 응답을 기다린 뒤 상태를 갱신한다. G-6 패턴 통합 자체는 여전히 별도 후속 과제(§2.2)로 남는다 |
| 이번 사이클도 세션 한도로 중단될 가능성(사이클 1에서 실제로 발생) | Medium | Medium | 사이클 1의 대응 절차(중단 시 `git status`로 현재 상태 점검 후 이어가기)를 그대로 적용 |

---

## 6. 영향 분석

### 6.1 변경 자원 (이번 사이클)

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `backend/.../feed/domain/FeedComment.java` | 백엔드 신규 | 자기 참조 엔티티 |
| `backend/.../feed/domain/FeedPost.java` | 백엔드 수정 | `comments` 컬렉션, 카운트 증감 메서드 추가(기존 `photos`/`tags` 옆에 병렬 추가, 기존 필드·메서드 변경 없음) |
| `backend/.../feed/dto/FeedComment{CreateRequest,Response,PageResponse}.java` | 백엔드 신규 | |
| `backend/.../feed/repository/FeedCommentRepository.java` | 백엔드 신규 | |
| `backend/.../feed/service/FeedCommentService.java` | 백엔드 신규 | |
| `backend/.../feed/controller/FeedCommentController.java` | 백엔드 신규 | |
| `frontend/src/api/feedCommentApi.js` | 프론트 신규 | |
| `frontend/src/hooks/useFeedComments.js` | 프론트 신규 | |
| `frontend/src/components/feed/FeedCommentList.jsx`, `FeedCommentForm.jsx`(+css) | 프론트 신규 | |
| `frontend/src/pages/FeedDetailPage.jsx` | 프론트 수정 | 댓글 섹션 연결(기존 좋아요·북마크·삭제 로직은 변경 없음) |

**이번 사이클에서 변경하지 않는 것**: `config/SecurityConfig.java`(1.2절 재조사로 변경 불필요 확인), `FeedController.java`/`FeedService.java`(게시물 목록·상세·작성·삭제·좋아요·북마크 로직), `FeedProfileController.java`/`FeedProfileService.java`(타인 프로필), 관리자 피드 모더레이션(`FeedAdminController`/`FeedAdminService`/`AdminFeedListPage`/`AdminFeedDetailPage`).

### 6.2 현재 사용처 (영향받을 수 있는 곳)

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `FeedPost` | `FeedPostResponse.from()`, `findWithDetailsById`/`findWithDetailsByIdAndDeletedAtIsNull`의 `@EntityGraph` | `comments` 컬렉션 추가는 지연 로딩이라 기존 `@EntityGraph(attributePaths = {"author", "photos"})`에 영향 없음(1.2절 재확인, 설계 §14 O-1 그대로 유효) |
| `FeedAdminService` | 관리자 피드 모더레이션 목록/상세 조회 | `FeedPost`에 연관관계가 하나 늘었을 뿐 관리자 조회 쿼리는 변경하지 않으므로 영향 없음(구현 후 회귀 확인 필요, 설계 §12) |
| `FeedDetailPage.jsx` | 사이클 1이 만든 좋아요·북마크·삭제 로직 | 댓글 섹션을 기존 컴포넌트 트리에 추가만 하고 기존 로직·상태(`useFeedDetail`)는 건드리지 않는다 |

### 6.3 검증 (구현 단계에서 확인)

- [ ] 관리자 피드 모더레이션 화면이 `FeedPost`에 `comments` 연관관계가 추가된 후에도 기존과 동일하게 동작
- [ ] 실제 HTTP 요청으로 `GET /api/v1/feed/posts/{postId}/comments`가 비로그인 상태에서 200(또는 정상 빈 목록)을 반환하는지 확인(1.2절의 코드 기반 판단을 실제 요청으로 재검증)
- [ ] `POST`/`DELETE` 댓글 엔드포인트가 비로그인 상태에서 401/403으로 막히는지 확인

---

## 7. 프론트엔드 아키텍처 고려사항

### 7.1 댓글 목록을 어떻게 보여줄 것인가

| 선택지 | 채택 여부 | 근거 |
|--------|-----------|------|
| 상세 페이지에 인라인으로 포함 | **채택**(설계 §2.1·§11 이미 확정) | 댓글은 게시물 상세의 일부이지 독립된 화면이 아니다. 별도 라우트(`/feed/posts/:id/comments`)를 만들면 오히려 탐색 흐름이 부자연스럽다 |
| 별도 스크롤 영역(모달/사이드 패널) | 기각 | 이 프로젝트에 그런 패턴이 없고, 모바일 폭에서 모달 안에 모달(답글 입력)을 넣는 구조가 복잡해진다 |
| 댓글 목록 로드 방식 — 무한 스크롤 vs "더 보기" 버튼 | **"더 보기" 버튼 채택**(설계 §2.2 P-11 이미 확정) | 댓글은 게시물당 수십 개 수준으로 타임라인보다 훨씬 적고, 상세 화면 안의 보조 UI라 페이지 단위가 구현·리뷰 비용이 낮다 |

### 7.2 답글 UI

- 각 최상위 댓글 아래 답글이 1단 들여쓰기로 렌더링된다(설계 §8.2 목업).
- `[답글]` 버튼은 최상위 댓글에만 보이고, 리프(답글)에는 렌더링 자체를 하지 않는다 — 서버의 `parent.isReply()` 검증과 이중으로 답글의 답글을 막는다.
- `[답글]`을 누르면 그 댓글 바로 아래 인라인 입력창이 열리고 `parentCommentId`를 담아 제출한다. 최상위 입력창(화면 하단 고정)은 항상 `parentCommentId: null`.
- **답글은 기본으로 항상 펼쳐서 보여준다(Q-3 확정, 2026-09-30)**. 접기/펼치기 토글 UI는 만들지 않는다 — 설계 §8.2 목업이 원래 가정했던 방식을 그대로 확정한 것이며, 별도의 토글 상태·아이콘·접근성 처리를 추가하지 않아도 된다.

### 7.3 상태 관리

| 상태 | 위치 | 이유 |
|------|------|------|
| 댓글·답글 목록(페이지네이션) | `useFeedComments` 내부 state | 상세 화면 전용 보조 상태, `useFeedDetail`과 생명주기는 같지만(같은 게시물 id에 종속) API 모양이 완전히 달라 분리(설계 §2.2 그대로) |
| 댓글 입력값(내용, 어느 댓글에 답글 다는 중인지) | `FeedCommentForm` 내부 state | 로컬 UI 상태, 다른 화면과 공유하지 않음 |
| 댓글 삭제 확인 다이얼로그 열림 여부 | `FeedDetailPage` 또는 `FeedCommentList` 내부 state(사이클 1의 게시물 삭제 확인 패턴과 동일하게 상세 페이지 레벨에서 관리할지, 댓글 목록 컴포넌트 레벨에서 관리할지는 구현 단계에서 컴포넌트 경계에 따라 결정) | 로컬 UI 상태 |

Context·전역 store는 쓰지 않는다(사이클 1과 동일 원칙 유지).

### 7.4 기존 패턴 재사용 방안

| 기존 패턴 | 재사용 가능한가 | 근거 |
|-----------|------------------|------|
| `useFeedDetail`의 loading/success/not-found/error 상태 모양 | **부분적** | 댓글은 페이지네이션(누적 아님, "더 보기"를 누르면 다음 페이지를 별도로 붙이는 방식)이 필요해 `useFeedInfiniteList`(누적형)와도, `useFeedDetail`(단일 객체)과도 다른 세 번째 모양이 된다. 상태 전이 원칙(로딩/에러 구분, 요청 취소)만 계승 |
| `FeedConfirmDialog.jsx` | **재사용** | 사이클 1이 이미 공개 화면 전용으로 만들어 둔 컴포넌트라 그대로 쓴다. 문구만 댓글용으로 교체 |
| `AbortController` + `isAbortError` 요청 취소 패턴 | **재사용** | `useFeedDetail`/`useFeedInfiniteList`/`useFeedUserProfile` 전부가 따르는 프로젝트 원칙(사이클 1 코드 리뷰 Must Fix 2로 강화된 원칙), `useFeedComments`도 동일하게 적용 |
| 낙관적 업데이트(좋아요·북마크) | **미적용 확정(Q-4, 2026-09-30)** | 사이클 1의 G-6(3곳이 서로 다른 모양으로 구현)이 아직 정리되지 않은 상태에서 네 번째 변형을 만들지 않기 위해, 댓글 작성·삭제는 서버 응답을 기다린 뒤 상태를 갱신한다(흐름은 Design 문서에서 구체화) |

---

## 8. 사용자 결정 (결정됨, 2026-09-30)

> 사전 설계(엔티티 구조, 답글 1단계 제한, API 시그니처, "더 보기" 방식)에서 이미 답이 나온 사항은 묻지 않았다. 아래 네 가지는 사전 설계가 다루지 않았거나 구현 방식이 여러 갈래로 갈리던 지점이며, 전부 frontend-lead 권장안대로 확정됐다.

| # | 결정 | 선택 | 비고 |
|---|------|------|------|
| Q-1 | 댓글·답글 작성 시 알림 기능 | **B) 제외**(권장안 채택) | 백엔드에 알림 시스템 자체가 전혀 없음(grep 확인, 1.2절). 알림은 완전히 별도의 후속 기능으로 다룬다. FR-34는 배정하지 않고 결번 처리(§3.1) |
| Q-2 | 댓글 삭제 방식 | **A) 하드 삭제**(권장안 채택) | 사전 설계 초안의 `feedCommentRepository.delete()`를 그대로 확정. 게시물 자체의 사용자 삭제 정책(하드 삭제)과 일관. 최상위 댓글 삭제 시 답글도 orphanRemoval로 함께 사라짐(설계 §4.3 그대로) |
| Q-3 | 답글 표시 방식 | **A) 기본 항상 펼침**(권장안 채택) | 접기/펼치기 토글 UI를 만들지 않는다. 설계 §8.2 목업 그대로 확정(§7.2) |
| Q-4 | 낙관적 업데이트 적용 여부 | **B) 미적용**(권장안 채택) | 댓글 작성·삭제는 서버 응답을 기다린 뒤 상태를 갱신한다. 사이클 1의 G-6(낙관적 업데이트 패턴이 3곳에서 각각 다르게 구현된 기술부채)를 이번 사이클에서 네 번째 변형으로 늘리지 않기 위함(§7.4) |

구체적인 API 흐름, 훅 상태 모양, 컴포넌트 구조는 `docs/02-design/features/feed-comment-integration.design.md`에 구체화한다.

---

## 9. 다음 단계

1. [x] 사전 설계 재조사 완료 — 코드 변경 여부 확인(1.2절)
2. [x] 8장 Q-1 ~ Q-4 사용자 결정(2026-09-30, 전부 권장안 채택)
3. [ ] Design 문서 작성(`feed-comment-integration.design.md`) — 사전 설계를 확정 설계로 공식화, Q-1~Q-4 결정 반영
4. [ ] 백엔드 구현(frontend-support-backend): FR-19~26
5. [ ] 프론트 구현(frontend-lead): FR-27~33 (FR-34는 결번, Q-1로 제외 확정)
6. [ ] 코드 리뷰(frontend-code-reviewer) + gap 분석
7. [ ] 완료 보고서 → 포트폴리오 추출(frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-30 | 초안. `feed-integration` 사이클 1 완료 후 사전 설계(§3.4~3.5·§4.3·§8)를 재조사로 검증(코드 변경 없음 확인, `SecurityConfig` 갱신 불필요 사전 확인)하고 이번 사이클의 범위·FR·위험·프론트 아키텍처 고려사항을 정리. Q-1~Q-4 사용자 결정 요청 | WOOJIN |
| 0.2 | 2026-09-30 | 사용자 결정 반영(Q-1~Q-4, 전부 권장안 채택 — 알림 제외, 댓글 하드 삭제, 답글 기본 펼침, 낙관적 업데이트 미적용). FR-34(알림) 결번 처리, §7.2·§7.4·§8을 확정 표현으로 수정. 상태를 Approved로 변경 | WOOJIN |
