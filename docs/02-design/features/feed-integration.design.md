# feed-integration 설계 문서

> **요약**: 계획 8장 Q-1~Q-9가 전부 결정되면서 기능 전체는 (1) 이미 있는 피드 CRUD API를 연결하는 화면, (2) 무한 스크롤을 위한 커서 기반 목록 API 신설, (3) 댓글+답글 전면 신규 백엔드, (4) 타인 프로필 조회 신규 API, 네 갈래로 커졌다. **규모상 두 개의 PDCA 사이클로 나누는 것이 확정됐다(13장)** — 이 문서는 **사이클 1**(댓글 제외: 커서 목록·상세·작성·삭제·좋아요·북마크·타인 프로필·버그 정리)만 구현 대상으로 설계한다. (3) 댓글+답글 관련 스키마·API·UI 설계(§2.1 구성도 일부, §2.2 모듈 표 일부, §3.4~3.5, §4.3, §8, §11 일부)는 **후속 `feed-comment-integration` 사이클을 위한 사전 설계 초안**으로 남겨 두었을 뿐, 이번 사이클의 Do 단계 구현 대상이 아니다(각 절에 표시). 설계 도중 계획 문서의 조사 하나를 정정했다 — `FeedExceptionHandler`의 죽은 메서드는 실제로는 무해했다(1.3절 "정정" 참고).
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-09-30
> **상태**: Approved — **PDCA 사이클 분리 확정**(2026-09-30). 이 문서는 사이클 1만 구현 범위로 다룬다
> **버전**: 0.2
> **계획 문서**: `docs/01-plan/features/feed-integration.plan.md` (FR-01 ~ FR-18, 사용자 결정 Q-1 ~ Q-9)
> **선행 기능**: `docs/02-design/features/admin-dashboard.design.md` §3.4(피드 모더레이션 스키마 출처), `docs/02-design/features/tour-course-list-integration.design.md`(재사용 패턴·N+1 회피 집계 쿼리 선례)

---

## Context Anchor

> 계획 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | `/feed`는 네비게이션에 이미 노출된 메뉴지만 `ComingSoonPage`뿐이다. 백엔드 CRUD는 완성돼 있어 프론트만 없는 상태를 방치할 이유가 없다 |
| **WHO** | 여행 사진·글을 올리는 사용자, 무한 스크롤로 피드를 훑어보는 방문자, 댓글·답글로 소통하는 사용자, 타인의 피드 프로필을 구경하는 사용자 |
| **RISK** | 댓글·답글 전면 신규 개발 / 무한 스크롤 최초 도입(오프셋 방식은 스크롤 중 삽입으로 중복·누락 위험) / 타인 프로필 API 부재 |
| **SUCCESS** | 무한 스크롤 타임라인·상세·작성·삭제·좋아요·북마크·댓글(+답글)·타인 프로필 조회가 모두 동작, 로딩·에러·빈 상태 구분, 관리자 화면 회귀 없음 |
| **SCOPE** | 프론트: `feedApi.js`, `feedCommentApi.js`, 무한 스크롤 훅, 타임라인·작성·상세·댓글·타인 프로필 화면, `TourReferencePicker` 이동 / 백엔드: 커서 목록 API, `FeedComment` 신규, 타인 프로필 API, `FeedExceptionHandler` 정리 |

---

## 계획 대비 변경 (사용자 결정 반영, 2026-09-30)

| # | 항목 | 계획의 결정 | 설계에서 구체화한 내용 |
|---|------|-------------|------------------------|
| P-1 | 댓글+답글 (Q-1) | "포함, 답글까지" | 기능 자체는 확정됐으나 **PDCA 사이클 분리 확정**에 따라 이번 사이클 구현 대상에서 제외, 후속 `feed-comment-integration`으로 이관. 아래 스키마(`FeedComment` 신규 엔티티, 자기 참조 `parent`, 답글 **1단계 제한** — 부모가 이미 답글이면 추가 답글 생성 거부. 최상위 댓글은 페이지네이션, 답글은 댓글당 전체를 함께 반환, §8)는 **그 사이클을 위한 사전 설계 초안**이다 |
| P-2 | 게시물 수정 (Q-2) | "기존 유지, 삭제만" | 코드 변경 없음. `FeedController`/`FeedService`의 주석 처리된 `update`는 그대로 둔다 |
| P-3 | 무한 스크롤 (Q-3) | "신규 도입" | `id` 기반 커서 파라미터(`cursor`)를 `GET /api/v1/feed/posts`에 추가. `id`는 `IDENTITY` 채번이라 생성 순서와 완전히 일치하므로 `createdAt` 동시각 충돌 문제 없이 정렬 키로 쓸 수 있다(§7.1) |
| P-4 | 위치 태깅 (Q-4) | "`TourReferencePicker` 재사용" | `components/admin/` → `components/common/`으로 이동. 내부의 `AdminPagination` 상대 경로 import는 **의도적으로 그대로 둔다**(§5.2에서 이유 설명) |
| P-5 | 이미지 업로드 (Q-5) | "미리보기 + 드래그 순서변경" | 새 드래그 라이브러리를 추가하지 않고 HTML5 네이티브 드래그(`draggable`)를 쓰되, 마우스 전용이라는 한계를 보완하는 키보드 접근 가능한 "앞으로/뒤로 이동" 버튼을 항상 노출한다(§6) |
| P-6 | 타인 프로필 (Q-6) | "포함" | `GET /api/v1/feed/profile/{userId}`(공개, PUBLIC 게시물만) 신규. `FeedProfileResponse`를 재사용하되 "받은 좋아요 수" 등 개인정보성 데이터는 노출 범위를 좁힌다(§9) |
| P-7 | 태그 검색 (Q-7) | "제외" | 변경 없음 |
| P-8 | 마이페이지 경계 (Q-8) | "`/feed`만" | `GET /api/v1/feed/profile`(내 프로필)은 이번 기능에서 호출하지 않는다. 프론트 코드에 이 엔드포인트 호출을 추가하지 않는다 |
| P-9 | 버그 수정 (Q-9) | "고침, 방법은 설계에서 정정" | `GlobalExceptionHandler`가 이미 검증 오류를 올바르게 처리하고 있음을 확인. "애너테이션 추가"가 아니라 "죽은 `handleValidation` 메서드 삭제"로 수정 |

이 표 외에 설계 단계에서 새로 드러난 사항:

| # | 항목 | 내용 |
|---|------|------|
| P-10 | 기존 `FeedPageResponse` 폐기 | 커서 방식으로 바뀌면서 `page`/`totalPages`/`totalElements` 개념이 무의미해진다. `FeedPageResponse.java`는 `FeedService.getFeed`/`FeedController.getFeed` 외에 다른 호출부가 없음을 확인했으므로(grep 검증) 삭제하고 `FeedTimelineResponse`로 교체한다 |
| P-11 | 댓글 목록은 무한 스크롤이 아니다 | Q-3의 "무한 스크롤" 결정은 계획 문서 맥락상 **피드 타임라인**을 가리킨다. 댓글은 한 게시물 안에 수십 개 수준으로 훨씬 적고, 상세 화면 안의 보조 UI라 "더 보기" 버튼(페이지 단위)이 무한 스크롤보다 구현·리뷰 비용이 낮다. 댓글에는 기존 `AdminPagination`류가 아닌 간단한 "댓글 더 보기" 버튼만 둔다 |

---

## 1. 개요

### 1.1 설계 목표

- 피드 타임라인이 스크롤 도중 새 글이 추가되어도 항목이 중복되거나 빠지지 않는다.
- 댓글+답글이 과도하게 복잡해지지 않도록 답글 깊이를 1단계로 제한한다(무제한 중첩은 SNS 화면에서도 드물고 UI 복잡도만 키운다).
- 이미 검증된 관리자 화면(`AdminCourseFormPage`, 관리자 피드 모더레이션)에 회귀를 만들지 않는다.
- 새 프론트 의존성(드래그 라이브러리 등)을 추가하지 않는다.
- 규모가 커진 기능을 한 번에 구현·리뷰하지 않고, 독립적으로 검증 가능한 단위로 나눈다(13장).

### 1.2 설계 원칙

- **fail-closed**: 커서 응답, 댓글 응답 모두 필수 필드가 없으면 성공으로 보지 않는다(destination-list-integration·tour-course-list-integration과 동일 원칙).
- **거짓 UI 금지**: 답글이 없는 댓글에는 "답글 보기" 토글을 만들지 않는다. 좌표 없는 위치 태그에는 지도 딥링크를 만들지 않는다(이번 범위에는 지도 연동 자체가 없으므로 해당 없음, 참고용 원칙).
- **이미 검증된 코드는 건드리지 않는다**: `AdminCourseFormPage.jsx`, 관리자 피드 모더레이션 코드는 이번 기능이 수정하는 지점(TourReferencePicker 이동)을 제외하면 손대지 않는다.
- **최소 변경**: `FeedExceptionHandler`의 무해한 중복(`handleBadRequest`)은 이번 범위에서 함께 고치지 않는다(관련 없는 회귀 위험 회피, 계획 1.2절 "정정" 참고).

### 1.3 정정 — `FeedExceptionHandler` (Q-9)

계획 문서는 `FeedExceptionHandler.handleValidation(MethodArgumentNotValidException)`에 `@ExceptionHandler` 애너테이션이 없는 것을 "프론트 에러 처리에 영향을 주는 버그"로 분류했다. 설계 단계에서 `backend/.../common/exception/GlobalExceptionHandler.java`를 확인한 결과:

```java
// GlobalExceptionHandler.java (기존, 이미 등록됨)
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
    String message = exception.getBindingResult().getFieldErrors().stream()
            .findFirst().map(FieldError::getDefaultMessage).orElse("입력값을 확인해 주세요.");
    return ResponseEntity.badRequest().body(Map.of("message", message));
}
```

이 메서드가 **이미** `MethodArgumentNotValidException`을 프론트가 기대하는 `{message: string}` 형식으로 올바르게 처리하고 있다. `FeedExceptionHandler.handleValidation()`은 애너테이션이 없어 스프링이 아예 호출하지 않는 완전한 죽은 코드이지만, 그 자리를 `GlobalExceptionHandler`가 대신 채우고 있어 **실제 요청 흐름에는 영향이 없다.**

**수정 방향**: 애너테이션을 추가하지 않는다. 두 개의 전역 `@RestControllerAdvice`가 동시에 `MethodArgumentNotValidException`을 처리하게 되면, 어느 빈의 핸들러가 우선하는지가 스프링의 내부 정렬(선언 순서 등)에 암묵적으로 의존하게 되어 유지보수 시 예측하기 어려워진다. 대신 **죽은 메서드를 삭제**한다.

```diff
 @RestControllerAdvice
 public class FeedExceptionHandler {

     @ExceptionHandler(IllegalArgumentException.class)
     public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException exception) {
         return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
     }

-    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
-        String message = exception.getBindingResult()
-                .getFieldErrors()
-                .stream()
-                .findFirst()
-                .map(error -> error.getDefaultMessage())
-                .orElse("입력값을 확인해 주세요.");
-
-        return ResponseEntity.badRequest().body(Map.of("message", message));
-    }
 }
```

`handleBadRequest(IllegalArgumentException)`은 `GlobalExceptionHandler.handleIllegalArgument`와 내용이 완전히 동일하게 중복되지만, 오래 전부터 정상 동작 중이던 기존 코드이고 이번 기능과 직접 관련이 없으므로 건드리지 않는다(최소 변경 원칙).

---

## 2. 아키텍처

### 2.1 구성도

```
                         피드 타임라인(/feed)                              게시물 상세(/feed/posts/:id)
                                │                                                │
                    useFeedInfiniteList(size)                              useFeedDetail(id)
                    ├ 누적 items, nextCursor                                       │
                    ├ IntersectionObserver 센티널                          ┌───────┴───────┐
                    ├ AbortController(교체 아님, 요청마다 새로)              ▼               ▼
                    └ fetchFeedTimeline({cursor,size})           useFeedComments(postId)      좋아요·북마크 토글
                              │                                  (사이클 2, 이번 범위 아님)     (useFeedDetail 내부)
                              │                                     ├ 최상위 댓글 페이지네이션
                              ▼                                     └ 댓글별 replies 전체 포함
              GET /api/v1/feed/posts?cursor=&size=                            │
              { posts, nextCursor, hasNext }                                 ▼
                                                    ┌─── 아래 댓글 API 3종은 사이클 2 사전 설계입니다 ───┐
                                                    │ GET /api/v1/feed/posts/{postId}/comments?page=&size= │
                                                    │ POST .../comments { content, parentCommentId }       │
                                                    │ DELETE .../comments/{commentId}                      │
                                                    └───────────────────────────────────────────────────────┘

작성 폼(FeedComposer)                              타인 프로필(/feed/users/:userId)
  ├ 내용, 태그, 공개범위                                    │
  ├ 이미지 미리보기 + 순서변경(§6)                      useFeedUserProfile(userId)
  └ 위치 태깅: TourReferencePicker(재사용) + 자유 텍스트         │
        │                                                    ▼
        ▼                                    GET /api/v1/feed/profile/{userId}
POST /api/v1/feed/posts (multipart)
```

### 2.2 모듈과 분리 근거

| 모듈 | 역할 | 분리 근거 |
|------|------|-----------|
| `api/feedApi.js` | 타임라인·상세·작성·삭제·좋아요/북마크, view model | `courseApi.js`와 동일 원칙(fail-closed, API 필드 은닉) |
| `api/feedCommentApi.js` | 댓글 목록·작성·삭제 | 댓글은 게시물과 독립적으로 재사용되는 화면 단위(상세에서만 쓰임)라 별도 모듈로 분리해 `feedApi.js`가 비대해지지 않게 한다 |
| `hooks/useFeedInfiniteList.js` | 무한 스크롤 상태 머신(누적, 커서, 로딩/추가로딩/에러 구분) | `useTourList`류(교체형)와 근본적으로 다른 상태 모양(누적형)이라 새 파일로 분리 |
| `hooks/useFeedDetail.js` | 상세 데이터 + 좋아요/북마크 로컬 상태 | `useCourseDetail`/`useTourDetail`과 같은 패턴(loading/success/not-found/error) |
| `hooks/useFeedComments.js` **(사이클 2)** | 댓글 목록(페이지네이션) + 작성/삭제 후 목록 갱신 | 상세 화면에서만 쓰이는 보조 상태, `useFeedDetail`과 생명주기가 같지만 API가 달라 분리 |
| `components/feed/FeedComposer.jsx` | 작성 폼(내용·이미지·태그·공개범위·위치 태깅) | 화면 전체를 차지하는 복잡한 폼이라 페이지 컴포넌트에서 분리 |
| `components/feed/FeedImageEditor.jsx` | 이미지 미리보기 + 순서 변경 + 개별 삭제 | 재사용 가능한 단위(작성 폼 전용이지만 로직이 복잡해 별도 컴포넌트로 분리, §6) |
| `components/common/TourReferencePicker.jsx`(이동) | 여행지 검색해서 위치 태깅 | 관리자 폼과 피드 작성 폼이 공유. 공개 API(`fetchTourList`)만 쓰므로 `components/common/`이 적절한 위치 |
| `components/feed/FeedCommentList.jsx`, `FeedCommentForm.jsx` **(사이클 2)** | 댓글·답글 렌더링, 작성 입력 | 댓글 트리 렌더링(최상위+답글)과 입력 폼을 분리해 각각 단순하게 유지 |
| `pages/FeedPage.jsx` | 타임라인 페이지 | |
| `pages/FeedDetailPage.jsx` | 상세 페이지(이번 사이클은 댓글 없이 게시물 상세만) | |
| `pages/FeedUserProfilePage.jsx` | 타인 프로필 페이지 | |
| `feed/domain/FeedComment.java`(백엔드, 신규) **(사이클 2)** | 댓글·답글 엔티티(자기 참조) | §8. 이번 사이클에서는 생성하지 않는다 |
| `feed/controller/FeedCommentController.java`(신규) **(사이클 2)** | 댓글 CRUD | 기존 `FeedController`/`FeedProfileController`와 같은 컨트롤러당 단일 리소스 원칙 유지. 이번 사이클에서는 생성하지 않는다 |

### 2.3 상태의 원천과 데이터 흐름

| 상태 | 위치 | 이유 |
|------|------|------|
| 타임라인 누적 항목·커서 | `useFeedInfiniteList` 내부 state | 서버 상태, 스크롤 위치를 URL로 표현하지 않는 SNS 관례 |
| 게시물 상세·좋아요/북마크 상태 | `useFeedDetail` 내부 state | `key={id}`로 재마운트, id 변경 시 항상 loading부터(`useTourDetail`과 동일 전제) |
| 댓글·답글 목록 | `useFeedComments` 내부 state | 상세 화면 전용 |
| 작성 폼 입력값(내용·이미지·태그·공개범위·위치) | `FeedComposer` 내부 state | 로컬 UI 상태, 다른 화면과 공유하지 않음 |
| 타인 프로필 데이터 | `useFeedUserProfile` 내부 state | `key={userId}`로 재마운트 |

Context·전역 store는 쓰지 않는다.

---

## 3. 데이터 모델

### 3.1 `FeedCard` (타임라인 카드 view model)

`toFeedCard(item)`:

| 필드 | 원천 | 규칙 |
|------|------|------|
| `id` | `id` | 문자열 변환 |
| `author` | `author.{id,nickname,profileImageUrl}` | `author.id`가 없으면 카드를 버린다(fail-closed) |
| `contentPreview` | `content` | 미리보기 길이로 자름(예: 120자, `…` 표기) |
| `images` | `images` | 배열, 첫 장을 대표 이미지로 사용 |
| `tags` | `tags` | 표시만(Q-7 결정, 클릭 검색 없음) |
| `likeCount`, `commentCount` | `likeCount`, `commentCount` | 정수 |
| `liked`, `bookmarked` | `liked`, `bookmarked` | boolean, 비로그인 조회 시 항상 false |
| `createdAt` | `createdAt` | 상대 시간 표기는 화면에서 변환 |
| `detailPath` | `id`로 계산 | `/feed/posts/{id}` |

### 3.2 `FeedTimelineResult`

```js
{ items: FeedCard[], nextCursor: string | null, hasNext: boolean }
```

fail-closed: `posts`가 배열이 아니면 `Error`. `nextCursor`는 서버가 내려주는 값을 그대로 문자열화해서 다음 요청의 `cursor` 파라미터로 그대로 되돌려 보낸다(프론트가 커서 값의 의미를 해석하지 않는다 — opaque cursor 취급, 서버가 나중에 커서 인코딩 방식을 바꿔도 프론트 로직이 깨지지 않게 하는 원칙).

### 3.3 `FeedComment` view model

```js
// FeedCommentThread
{
  id, author: { id, nickname, profileImageUrl }, content, createdAt,
  replies: FeedCommentThread[]   // 항상 1단계 깊이까지만 채워짐(서버가 보장)
}
```

### 3.4 백엔드 엔티티 — `FeedComment` (신규) **[사이클 2 사전 설계 — 이번 사이클 구현 대상 아님]**

> 아래 엔티티·`FeedPost` 필드 추가(`comments` 컬렉션, `increaseCommentCount`/`decreaseCommentCount`)는 후속 `feed-comment-integration` 사이클에서 만든다. **이번 사이클에서는 댓글을 이유로 `FeedPost.java`를 수정하지 않는다.** 미리 스키마를 구체화해 두는 이유는 사이클 1이 만드는 카드의 "댓글 수" 표시(FR-07, 항상 0)가 나중에 실제 값으로 자연스럽게 바뀔 수 있도록 인터페이스 모양을 미리 맞춰 두기 위함이다.

```java
package kr.co.mycom.travel_korea.feed.domain;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "feed_comment", indexes = {
        @Index(name = "idx_feed_comment_post_id", columnList = "feed_post_id"),
        @Index(name = "idx_feed_comment_parent_id", columnList = "parent_comment_id")
})
public class FeedComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "feed_comment_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feed_post_id", nullable = false)
    private FeedPost feedPost;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity author;

    /*
     * null이면 최상위 댓글, 값이 있으면 답글입니다.
     * "답글의 답글"을 막기 위해 서비스 계층에서 parent.getParent() != null을 검증합니다(1단계 제한).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    private FeedComment parent;

    /*
     * 답글은 부모 댓글이 삭제되면 함께 삭제됩니다(고아 객체 제거).
     * commentCount 갱신은 서비스 계층에서 삭제 전 개수를 세어 처리합니다(§8.3).
     */
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<FeedComment> replies = new ArrayList<>();

    @Column(name = "content", nullable = false, length = 500)
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public FeedComment(FeedPost feedPost, UserEntity author, FeedComment parent, String content) {
        this.feedPost = feedPost;
        this.author = author;
        this.parent = parent;
        this.content = content;
    }

    public boolean isReply() {
        return parent != null;
    }

    @PrePersist
    private void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }
}
```

**`FeedPost`에 추가**(기존 파일 수정, `photos`/`tags` 컬렉션 옆에 병렬로 추가):

```java
@OneToMany(mappedBy = "feedPost", cascade = CascadeType.ALL, orphanRemoval = true)
private List<FeedComment> comments = new ArrayList<>();

public void increaseCommentCount(long amount) {
    commentCount += amount;
}

public void decreaseCommentCount(long amount) {
    commentCount = Math.max(0, commentCount - amount);
}
```

이 관계 덕분에 기존 `FeedService.delete`(게시물 하드 삭제)가 **코드 변경 없이** 댓글까지 함께 정리한다 — `feedPostRepository.delete(post)` 호출 시 JPA가 `comments` 컬렉션의 `cascade = ALL`을 따라 `feed_comment` 행도 함께 삭제한다. 이미지(S3)처럼 별도 외부 스토리지 정리가 필요 없는 순수 DB 데이터라 이 자동 cascade만으로 충분하다.

### 3.5 DTO (신규) **[사이클 2 사전 설계 — 이번 사이클 구현 대상 아님]**

```java
public record FeedCommentCreateRequest(
        @NotBlank(message = "댓글 내용을 입력해 주세요.")
        @Size(max = 500, message = "댓글은 500자 이내로 입력해 주세요.")
        String content,

        // null = 최상위 댓글. 값이 있으면 그 댓글의 답글로 등록합니다.
        Long parentCommentId
) {}

public record FeedCommentResponse(
        Long id,
        AuthorResponse author,
        String content,
        LocalDateTime createdAt,
        List<FeedCommentResponse> replies
) {
    public record AuthorResponse(Long id, String nickname, String profileImageUrl) {}

    public static FeedCommentResponse from(FeedComment comment) {
        return new FeedCommentResponse(
                comment.getId(),
                new AuthorResponse(comment.getAuthor().getId(), comment.getAuthor().getNickname(), comment.getAuthor().getProfileImageUrl()),
                comment.getContent(),
                comment.getCreatedAt(),
                comment.getReplies().stream().map(FeedCommentResponse::fromLeaf).toList()
        );
    }

    // 답글은 답글을 가질 수 없으므로(1단계 제한) replies를 항상 빈 리스트로 고정합니다.
    private static FeedCommentResponse fromLeaf(FeedComment reply) {
        return new FeedCommentResponse(
                reply.getId(),
                new AuthorResponse(reply.getAuthor().getId(), reply.getAuthor().getNickname(), reply.getAuthor().getProfileImageUrl()),
                reply.getContent(),
                reply.getCreatedAt(),
                List.of()
        );
    }
}

public record FeedCommentPageResponse(
        List<FeedCommentResponse> comments,
        int currentPage,
        int pageSize,
        int totalPages,
        long totalElements,
        boolean hasNext
) {
    public static FeedCommentPageResponse from(Page<FeedComment> page, List<FeedCommentResponse> comments) {
        return new FeedCommentPageResponse(
                comments, page.getNumber() + 1, page.getSize(), page.getTotalPages(), page.getTotalElements(), page.hasNext()
        );
    }
}
```

---

## 4. API 명세

### 4.1 신규/변경 엔드포인트 요약

| 메서드 | 경로 | 설명 | 인증 | 사이클 |
|--------|------|------|------|--------|
| GET | `/api/v1/feed/posts?cursor=&size=` | **변경** — 무한 스크롤용 커서 목록(P-3) | 선택 | **1(이번)** |
| GET | `/api/v1/feed/profile/{userId}` | 신규 — 타인 프로필(PUBLIC 게시물만) | 선택 | **1(이번)** |
| GET | `/api/v1/feed/posts/{postId}/comments?page=&size=` | 신규 — 최상위 댓글 페이지네이션(답글 포함) | 선택 | 2(후속, 사전 설계) |
| POST | `/api/v1/feed/posts/{postId}/comments` | 신규 — 댓글/답글 작성 | 필수 | 2(후속, 사전 설계) |
| DELETE | `/api/v1/feed/posts/{postId}/comments/{commentId}` | 신규 — 본인 댓글(+답글) 삭제 | 필수(작성자만) | 2(후속, 사전 설계) |

### 4.2 커서 기반 타임라인 (P-3)

**리포지토리 — 신규 메서드 2개, 기존 `findByVisibilityAndDeletedAtIsNull`은 그대로 둔다(관리자 등 다른 용도로 재사용 가능성 대비)**

```java
// FeedPostRepository.java
@EntityGraph(attributePaths = "author")
List<FeedPost> findFirstByVisibilityAndDeletedAtIsNullOrderByIdDesc(String visibility, Pageable pageable);
// 사실 위는 아래로 대체(첫 페이지도 커서 있는 것과 같은 쿼리 형태로 통일하기 위함) — 실제로는 아래 한 메서드만 추가한다.

@EntityGraph(attributePaths = "author")
List<FeedPost> findByVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc(String visibility, Long cursorId, Pageable pageable);
```

**왜 `id` 커서인가**: `createdAt`은 초 단위 정밀도라 짧은 시간에 여러 글이 등록되면 동시각 충돌이 생겨 정렬이 불안정해질 수 있다. `id`는 `GenerationType.IDENTITY`(auto-increment)라 생성 순서와 항상 정확히 일치하고, 별도 복합 커서(예: `createdAt`+`id` 튜플 인코딩)를 만들 필요 없이 **정수 하나만으로 안전한 커서**가 된다. `idx_feed_post_created_at` 인덱스 대신 PK(`id`)를 정렬·필터 키로 쓰므로 별도 인덱스 추가도 필요 없다.

```java
// FeedService.java — getFeed 교체
public FeedTimelineResponse getFeed(String loginEmail, Long cursor, int size) {
    int pageSize = Math.min(Math.max(size, 1), 30);
    // 다음 페이지 존재 여부를 별도 COUNT 쿼리 없이 알기 위해 1개를 더 조회한다(tour-course-list-integration의
    // N+1 회피 집계 쿼리와 같은 "쿼리 수를 늘리지 않는" 원칙의 연장).
    Pageable pageable = PageRequest.of(0, pageSize + 1);

    List<FeedPost> fetched = (cursor == null)
            ? feedPostRepository.findByVisibilityAndDeletedAtIsNullOrderByIdDesc("PUBLIC", pageable) // 기존 메서드명 유지, 신규 1개
            : feedPostRepository.findByVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc("PUBLIC", cursor, pageable);

    boolean hasNext = fetched.size() > pageSize;
    List<FeedPost> pageItems = hasNext ? fetched.subList(0, pageSize) : fetched;

    // ... liked/bookmarked 조회는 기존과 동일 ...

    Long nextCursor = pageItems.isEmpty() ? null : pageItems.get(pageItems.size() - 1).getId();
    List<FeedPostResponse> responses = pageItems.stream()
            .map(post -> toResponse(post, likedPostIds.contains(post.getId()), bookmarkedPostIds.contains(post.getId())))
            .toList();

    return new FeedTimelineResponse(responses, nextCursor, hasNext);
}
```

```java
// FeedTimelineResponse.java (신규, FeedPageResponse.java 대체 — P-10)
public record FeedTimelineResponse(List<FeedPostResponse> posts, Long nextCursor, boolean hasNext) {}
```

```java
// FeedController.java — getFeed 시그니처 변경
@GetMapping
public ResponseEntity<FeedTimelineResponse> getFeed(
        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
        @RequestParam(required = false) Long cursor,
        @RequestParam(defaultValue = "10") int size) {
    return ResponseEntity.ok(feedService.getFeed(extractOptionalEmail(authorization), cursor, size));
}
```

이 엔드포인트를 현재 호출하는 프론트 코드가 없음을 확인했으므로(`grep`으로 검증), `page` 파라미터를 제거하고 `cursor`로 대체하는 것은 하위 호환을 깨지 않는다. `FeedProfileService`의 "내가 쓴 글" 페이지네이션(`GET /api/v1/feed/profile`)은 완전히 다른 메서드(`findByAuthor_Id`)를 쓰므로 이번 변경의 영향을 받지 않는다.

### 4.3 댓글 API (P-1) **[사이클 2 사전 설계 — 이번 사이클 구현 대상 아님]**

```java
// FeedCommentController.java (신규)
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed/posts/{postId}/comments")
public class FeedCommentController {

    private final FeedCommentService feedCommentService;
    private final JwtConfig jwtConfig;   // FeedController와 동일한 인증 추출 패턴

    @GetMapping
    public FeedCommentPageResponse list(@PathVariable Long postId,
                                         @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        return feedCommentService.list(postId, page, size);
    }

    @PostMapping
    public ResponseEntity<FeedCommentResponse> create(@PathVariable Long postId,
                                                       @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
                                                       @Valid @RequestBody FeedCommentCreateRequest request) {
        FeedCommentResponse response = feedCommentService.create(postId, extractRequiredEmail(authorization), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long postId, @PathVariable Long commentId,
                                        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        feedCommentService.delete(postId, commentId, extractRequiredEmail(authorization));
        return ResponseEntity.noContent().build();
    }

    private String extractRequiredEmail(String authorization) { /* FeedController와 동일 로직 복제 */ }
}
```

```java
// FeedCommentRepository.java (신규)
public interface FeedCommentRepository extends JpaRepository<FeedComment, Long> {
    @EntityGraph(attributePaths = {"author", "replies", "replies.author"})
    Page<FeedComment> findByFeedPost_IdAndParentIsNullOrderByCreatedAtAsc(Long feedPostId, Pageable pageable);
}
```

```java
// FeedCommentService.java (신규)
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedCommentService {

    private final FeedCommentRepository feedCommentRepository;
    private final FeedPostRepository feedPostRepository;
    private final UserRepository userRepository;

    public FeedCommentPageResponse list(Long postId, int page, int size) {
        int pageIndex = Math.max(page - 1, 0);
        int pageSize = Math.min(Math.max(size, 1), 30);
        Pageable pageable = PageRequest.of(pageIndex, pageSize);

        Page<FeedComment> result = feedCommentRepository.findByFeedPost_IdAndParentIsNullOrderByCreatedAtAsc(postId, pageable);
        List<FeedCommentResponse> responses = result.getContent().stream().map(FeedCommentResponse::from).toList();
        return FeedCommentPageResponse.from(result, responses);
    }

    @Transactional
    public FeedCommentResponse create(Long postId, String loginEmail, FeedCommentCreateRequest request) {
        UserEntity author = findUser(loginEmail);
        FeedPost post = findVisiblePost(postId);

        FeedComment parent = null;
        if (request.parentCommentId() != null) {
            parent = feedCommentRepository.findById(request.parentCommentId())
                    .orElseThrow(() -> new IllegalArgumentException("답글을 달 댓글을 찾을 수 없습니다."));

            // 답글의 답글 금지 — 1단계 제한(설계 원칙 1.1).
            if (parent.isReply()) {
                throw new IllegalArgumentException("답글에는 답글을 달 수 없습니다.");
            }
            if (!parent.getFeedPost().getId().equals(postId)) {
                throw new IllegalArgumentException("잘못된 댓글 요청입니다.");
            }
        }

        FeedComment comment = new FeedComment(post, author, parent, request.content().trim());
        FeedComment saved = feedCommentRepository.save(comment);

        post.increaseCommentCount(1);

        return FeedCommentResponse.from(saved);
    }

    @Transactional
    public void delete(Long postId, Long commentId, String loginEmail) {
        FeedComment comment = feedCommentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("댓글을 찾을 수 없습니다."));

        if (!comment.getFeedPost().getId().equals(postId)) {
            throw new IllegalArgumentException("잘못된 댓글 요청입니다.");
        }
        if (!comment.getAuthor().getEmail().equals(loginEmail)) {
            throw new IllegalArgumentException("본인 댓글만 삭제할 수 있습니다.");
        }

        // 최상위 댓글을 지우면 replies도 orphanRemoval로 함께 삭제되므로, 감소량은 1 + 답글 수.
        long removedCount = 1 + comment.getReplies().size();

        feedCommentRepository.delete(comment);
        comment.getFeedPost().decreaseCommentCount(removedCount);
    }

    private UserEntity findUser(String email) { /* FeedService와 동일 */ }
    private FeedPost findVisiblePost(Long postId) { /* FeedService.findVisiblePost와 동일, 소프트 삭제·PRIVATE 제외 */ }
}
```

**답글 삭제(리프 댓글) 시 `removedCount`는 항상 1**이 된다(리프는 `replies`가 비어 있으므로). 이 로직은 최상위/답글 구분 없이 동일하게 동작한다.

### 4.4 타인 프로필 API (P-6) **[사이클 1 — 이번 사이클 구현 대상]**

```java
// FeedProfileController.java에 추가
@GetMapping("/{userId}")
public ResponseEntity<FeedProfileResponse> getUserProfile(
        @PathVariable Long userId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "12") int size) {
    return ResponseEntity.ok(feedProfileService.getUserProfile(userId, page, size));
}
```

```java
// FeedProfileService.java에 추가
public FeedProfileResponse getUserProfile(Long userId, int page, int size) {
    UserEntity user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("회원 정보를 찾을 수 없습니다."));
    FeedProfile profile = feedProfileRepository.findByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("피드 프로필을 찾을 수 없습니다."));

    int pageIndex = Math.max(page - 1, 0);
    int pageSize = Math.min(Math.max(size, 1), 30);
    Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

    // 타인 프로필은 PUBLIC 게시물만 노출한다(getMyProfile은 본인 것이라 visibility 구분 없이 전부 보여주는 것과 대비).
    Page<FeedPost> postPage = feedPostRepository.findByAuthor_IdAndVisibilityAndDeletedAtIsNull(userId, "PUBLIC", pageable);

    List<FeedPostResponse> posts = postPage.getContent().stream()
            .map(post -> FeedPostResponse.from(post, false, false, this::toReadableImageUrl)).toList();

    long receivedLikeCount = feedLikeRepository.countByFeedPost_Author_Id(userId);

    return FeedProfileResponse.of(user, profile, postPage.getTotalElements(), receivedLikeCount, posts,
            postPage.getNumber() + 1, postPage.getTotalPages(), postPage.hasNext());
}
```

```java
// FeedPostRepository.java에 추가
@EntityGraph(attributePaths = "author")
Page<FeedPost> findByAuthor_IdAndVisibilityAndDeletedAtIsNull(Long userId, String visibility, Pageable pageable);
```

**노출 범위 결정**: `liked`/`bookmarked`는 타인 프로필에서는 항상 `false`로 고정한다(로그인한 조회자 기준으로 좋아요 여부를 계산하려면 목록 API와 같은 추가 조회가 필요한데, 이번 범위에서는 "둘러보기" 목적이 우선이라 생략 — 필요해지면 `getFeed`의 liked/bookmarked 조회 로직을 그대로 옮겨오면 된다). `receiveLikeCount`(받은 좋아요 총합)는 공개 정보로 취급해 그대로 노출한다(기존 `getMyProfile`과 동일 계산식 재사용).

**URL 경로 주의**: `FeedProfileController`의 기존 매핑은 `@RequestMapping("/api/v1/feed/profile")`이고 `getMyProfile()`이 `@GetMapping`(경로 없음)이다. `getUserProfile`을 `@GetMapping("/{userId}")`로 추가하면 두 메서드가 공존하며 스프링이 `/api/v1/feed/profile`(정확히 일치, 인증 필요)과 `/api/v1/feed/profile/{userId}`(경로 변수, 인증 불필요)를 올바르게 구분한다 — 경로 세그먼트 수가 다르므로 라우팅 충돌이 없다.

---

## 5. 위치 태깅 (Q-4)

### 5.1 폼 구성

```
[여행지에서 검색해서 태그하기] 버튼 → TourReferencePicker 모달
              또는
[직접 입력] 장소명 / 주소 텍스트 입력 (좌표 없음)
```

`FeedComposer`는 `TourReferencePicker`가 선택을 반환하면 `{tourContentId, tourContentTypeId, locationName: picked.name, address, latitude, longitude}`를 폼 상태에 채우고, 사용자가 직접 텍스트로 입력하면 `tourContentId`/`tourContentTypeId`/좌표를 모두 `null`로 두고 `locationName`/`address`만 채운다. 백엔드 `FeedCreateRequest`가 이미 이 두 경우를 모두 받아들이는 구조라(모든 위치 필드가 optional) 백엔드 변경이 필요 없다.

### 5.2 `TourReferencePicker` 이동

```
components/admin/TourReferencePicker.jsx  →  components/common/TourReferencePicker.jsx
components/admin/TourReferencePicker.css  →  components/common/TourReferencePicker.css
```

**내부 import 처리**: `TourReferencePicker.jsx`는 `./AdminPagination`을 상대 경로로 import한다. 이동 후에도 **의도적으로 `../admin/AdminPagination`을 그대로 참조**한다(폴더를 넘는 import). 이유:

- `AdminPagination`은 관리자 화면 톤(`admin-*` CSS 클래스)에 맞춘 컴포넌트이고, `TourReferencePicker` 모달 자체는 관리자 폼(`AdminCourseFormPage`)과 피드 작성 폼(공개 화면) 양쪽에서 쓰인다. 모달 안의 페이지네이션 UI는 원래부터 모달 자체의 톤(작은 팝업, 중립적 스타일)을 따르고 있어 "관리자 색"이 크게 드러나지 않는다.
- `AdminCourseFormPage`는 이미 리뷰·gap 분석이 끝난 화면이다. 페이지네이션 컴포넌트를 `components/tour-list/Pagination.jsx`(공개용)로 바꾸면 관리자 폼의 기존 시각적 출력이 미세하게 달라져 "이미 검증된 코드는 건드리지 않는다" 원칙에 어긋난다.
- 폴더를 넘는 import 자체는 사소한 구조적 흠이지만, "새 컴포넌트를 만들거나 기존 화면을 바꾸는 비용"보다 작다고 판단했다. 이 트레이드오프를 코드 주석으로 남긴다.

```diff
- import AdminPagination from './AdminPagination'
+ // 의도적으로 관리자 폴더의 컴포넌트를 그대로 참조합니다. 이 모달은 관리자 폼(AdminCourseFormPage)과
+ // 피드 작성 폼(공개 화면) 양쪽에서 쓰이지만, 모달 내부 페이지네이션은 원래도 중립적인 톤이라
+ // 별도 공개용 컴포넌트를 새로 만들기보다 기존 AdminCourseFormPage의 시각적 출력을 그대로 유지하는
+ // 쪽을 선택했습니다(feed-integration.design.md §5.2).
+ import AdminPagination from '../admin/AdminPagination'
```

`AdminCourseFormPage.jsx`의 import만 아래처럼 바뀐다:

```diff
- import TourReferencePicker from '../../components/admin/TourReferencePicker'
+ import TourReferencePicker from '../../components/common/TourReferencePicker'
```

---

## 6. 이미지 업로드 UX — 미리보기 + 순서 변경 (Q-5)

### 6.1 상태 모양

```js
// FeedComposer 내부, FeedImageEditor에 전달
// images: [{ localId, file, previewUrl }]  (localId는 crypto.randomUUID() 또는 증가 카운터)
```

파일 선택 시 `URL.createObjectURL(file)`로 미리보기 URL을 만들고, 폼 언마운트 또는 이미지 제거 시 `URL.revokeObjectURL`로 정리한다(메모리 누수 방지, 계획 3.2 비기능 요구사항).

### 6.2 순서 변경 — 드래그 + 키보드 접근 가능한 버튼

새 드래그 라이브러리를 추가하지 않고 HTML5 네이티브 드래그(`draggable`, `onDragStart`/`onDragOver`/`onDrop`)로 구현한다. 다만 네이티브 드래그는 마우스 전용이라 키보드·스크린리더 사용자가 순서를 바꿀 수 없다 — 그래서 각 썸네일에 **항상 보이는** "왼쪽으로 이동"/"오른쪽으로 이동" 아이콘 버튼을 함께 둔다(호버 시에만 나타나는 숨김 버튼은 키보드 포커스로 발견하기 어려워 지양).

```jsx
function FeedImageEditor({ images, onReorder, onRemove }) {
  function moveBy(index, delta) {
    const target = index + delta
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    onReorder(next)
  }

  return (
    <ul className="feed-image-editor" aria-label="첨부한 사진 순서">
      {images.map((image, index) => (
        <li
          key={image.localId}
          className="feed-image-editor__item"
          draggable
          onDragStart={event => event.dataTransfer.setData('text/plain', String(index))}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            const from = Number(event.dataTransfer.getData('text/plain'))
            const next = [...images]
            const [moved] = next.splice(from, 1)
            next.splice(index, 0, moved)
            onReorder(next)
          }}
        >
          <img src={image.previewUrl} alt="" />
          <div className="feed-image-editor__controls">
            <button type="button" aria-label="앞으로 이동" disabled={index === 0} onClick={() => moveBy(index, -1)}>◀</button>
            <button type="button" aria-label="뒤로 이동" disabled={index === images.length - 1} onClick={() => moveBy(index, 1)}>▶</button>
            <button type="button" aria-label="사진 삭제" onClick={() => onRemove(image.localId)}>✕</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

최대 5장, 장당 5MB, jpeg/png/webp만 허용하는 검사를 파일 선택 즉시 클라이언트에서 먼저 수행해(서버 제한과 동일한 값 재사용) 실패를 업로드 전에 알린다. 최종 제출 시 `images` 배열의 현재 순서 그대로 `FormData`에 append한다(백엔드가 파트 도착 순서를 `sortOrder`로 사용하므로 — `FeedService.create`의 `sortOrder++` 로직 확인됨).

---

## 7. 무한 스크롤 (Q-3)

### 7.1 `useFeedInfiniteList`

```js
export function useFeedInfiniteList(size = 10) {
  const [state, dispatch] = useReducer(reducer, initialState)   // { items: [], nextCursor: null, hasNext: true, status: 'loading' }
  const loadingRef = useRef(false)   // 중복 트리거 방지(경쟁 조건 방어의 핵심)

  const load = useCallback(async (cursor, { isInitial }) => {
    if (loadingRef.current) return
    loadingRef.current = true
    dispatch({ type: isInitial ? 'INIT_START' : 'MORE_START' })

    const controller = new AbortController()
    try {
      const result = await fetchFeedTimeline({ cursor, size }, { signal: controller.signal })
      dispatch({ type: isInitial ? 'INIT_SUCCESS' : 'MORE_SUCCESS', payload: result })
    } catch (error) {
      if (!isAbortError(error)) dispatch({ type: isInitial ? 'INIT_ERROR' : 'MORE_ERROR' })
    } finally {
      loadingRef.current = false
    }
    return () => controller.abort()
  }, [size])

  useEffect(() => { load(null, { isInitial: true }) }, [load])   // 최초 1회

  const loadMore = useCallback(() => {
    if (!state.hasNext || state.status === 'loading-more') return
    load(state.nextCursor, { isInitial: false })
  }, [load, state.hasNext, state.nextCursor, state.status])

  const retry = useCallback(() => load(null, { isInitial: true }), [load])
  const retryMore = useCallback(() => load(state.nextCursor, { isInitial: false }), [load, state.nextCursor])

  return { ...state, loadMore, retry, retryMore }
}
```

**리듀서 상태 전이**: `loading`(최초) → `success` | `error`. `success` 상태에서 `loadMore` 호출 시 `loading-more`로 전이하고 성공하면 `items`에 append, 실패하면 `error-more`(기존 items는 유지, 하단에 재시도 버튼만 표시 — 전체 화면 에러로 덮지 않는다).

**경쟁 조건 방어**: `loadingRef`(동기 플래그)로 `IntersectionObserver`가 스크롤 관성으로 콜백을 여러 번 발사해도 중복 요청을 만들지 않는다. `useTourList`류의 "요청 key 비교로 늦게 온 응답 무시" 패턴과 달리, 애초에 진행 중인 요청이 있으면 새 요청 자체를 시작하지 않는 **선제적 차단** 방식을 쓴다(누적형 상태라 "이전 요청 결과를 버린다"는 개념이 없고, 대신 "동시에 두 요청이 items를 동시에 append하면 순서가 꼬인다"는 문제를 막아야 하기 때문).

### 7.2 센티널 컴포넌트

```jsx
function FeedTimelineSentinel({ onIntersect, disabled }) {
  const ref = useRef(null)

  useEffect(() => {
    if (disabled || !ref.current) return undefined
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) onIntersect()
    }, { rootMargin: '200px' })   // 실제로 화면에 닿기 전에 미리 로드해 스크롤이 끊기지 않게 함
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onIntersect, disabled])

  return <div ref={ref} aria-hidden="true" />
}
```

`FeedPage`는 `hasNext`가 `false`이거나 `status === 'error-more'`일 때 센티널을 비활성화(`disabled`)하고, 에러 상태에서는 센티널 대신 "다시 시도" 버튼을 보여준다(무한 스크롤이 계속 실패 요청을 반복하지 않도록).

### 7.3 데이터 정합성(위험 대응)

오프셋(`page`/`size`) 방식이었다면, 사용자가 1페이지를 본 뒤 다른 사람이 새 글을 올리고 2페이지를 요청하는 순간 "새 글이 밀어낸 만큼" 오프셋이 밀려 1페이지의 마지막 항목이 2페이지에 중복 등장한다. 커서(`id < cursor`) 방식은 "내가 마지막으로 본 항목보다 오래된 것"만 요청하므로, 그 사이 새 글이 몇 개 생기든 이미 본 항목이 다시 나타나거나 건너뛰어지지 않는다. 이 차이를 gap 분석·코드 리뷰에서 확인 항목으로 남긴다(계획 4.1 완료 조건 "스크롤 중 새 글이 생겨도 중복·누락이 생기지 않는다").

---

## 8. 댓글·답글 UI (Q-1) **[사이클 2 사전 설계 — 이번 사이클 구현 대상 아님]**

### 8.1 왜 답글을 1단계로 제한하는가

댓글에 무제한 중첩을 허용하면(답글의 답글의 답글...) 프론트는 재귀 렌더링과 들여쓰기 깊이 제한을 함께 설계해야 하고, 사용자도 어느 댓글에 답하는지 헷갈리기 쉽다. 인스타그램·트위터 등 주요 SNS도 실질적으로 "댓글 + 답글" 2단 구조를 쓴다. 이번 설계는 그 관례를 따르고, 서버가 `parent.isReply()`를 검증해 API 계층에서부터 무제한 중첩을 원천 차단한다(프론트가 실수로 답글에 "답글 달기" 버튼을 노출해도 서버가 거부).

### 8.2 화면 구성

```
[게시물 상세]
─────────────
댓글 3개                              ← commentCount 그대로 사용(최상위+답글 합산)
  ○ 사용자A: 우와 여기 좋네요!  [답글]
      ↳ 사용자B: 저도 가보고 싶어요        ← 들여쓰기 1단, [답글] 버튼 없음(리프)
  ○ 사용자C: 위치 정보 감사합니다  [답글]
[더 보기]                             ← 최상위 댓글 다음 페이지(페이지 단위, 무한 스크롤 아님 — P-11)
─────────────
[댓글 입력창]
```

`[답글]`을 누르면 그 댓글 바로 아래 인라인 입력창이 열리고, `FeedCommentCreateRequest.parentCommentId`에 해당 댓글 id를 담아 제출한다. 최상위 댓글 입력창은 화면 하단 고정 입력창을 그대로 쓰되 `parentCommentId: null`을 보낸다.

### 8.3 본인 댓글 삭제

작성자 본인의 댓글에만 삭제 버튼을 노출한다(`comment.author.id === 현재 로그인 사용자 id`). 최상위 댓글을 삭제하면 그 답글도 함께 사라진다는 안내를 확인 다이얼로그에 문구로 포함한다("답글이 있는 댓글을 삭제하면 답글도 함께 삭제됩니다").

---

## 9. 타인 프로필 화면 (Q-6) **[사이클 1 — 이번 사이클 구현 대상]**

### 9.1 진입 경로

피드 카드·상세 화면의 작성자 닉네임/프로필 이미지를 클릭하면 `/feed/users/:userId`로 이동한다. `userId`는 이미 `FeedPostResponse.author.id`에 포함돼 있어 추가 조회 없이 바로 링크를 구성할 수 있다.

### 9.2 화면 구성

`getMyProfile` 화면(§4.4에서 설명한 `getUserProfile`과 같은 응답 모양)과 거의 동일하지만, "@피드아이디 수정" 같은 본인 전용 UI는 숨긴다. `useFeedUserProfile(userId)`는 `useCourseDetail` 패턴(loading/success/not-found/error, `key={userId}`로 재마운트)을 그대로 따른다.

---

## 10. 라우팅

```jsx
// App.jsx
<Route path="/feed" element={<FeedPage />} />
<Route path="/feed/posts/:id" element={<FeedDetailPage />} />
<Route path="/feed/users/:userId" element={<FeedUserProfilePage />} />
```

기존 `<Route path="/feed" element={<ComingSoonPage title="여행 피드" />} />`를 교체한다. `/bookmarks`, `/mypage`는 계획 Q-8 결정에 따라 이번 범위에서 변경하지 않는다(`ComingSoonPage` 그대로 유지).

---

## 11. 의존성

| 모듈 | 의존 대상 |
|------|-----------|
| `FeedPage` | `useFeedInfiniteList`, `FeedTimelineSentinel`, 좋아요/북마크 토글(카드 안에서 직접 `feedApi` 호출) |
| `FeedDetailPage` | `useFeedDetail`, `useFeedComments`, `FeedCommentList`, `FeedCommentForm` |
| `FeedComposer` | `feedApi`(`createFeedPost`), `FeedImageEditor`, `components/common/TourReferencePicker`(이동됨) |
| `FeedUserProfilePage` | `useFeedUserProfile` → `feedApi`(`fetchFeedUserProfile`) |
| `useFeedInfiniteList` | `api/feedApi`(`fetchFeedTimeline`), `api/client`(`isAbortError`) |
| `api/feedApi` | `api/client` |
| `FeedProfileController.getUserProfile`(백엔드, 신규 메서드) | `FeedProfileService.getUserProfile`(신규 메서드) |

**사이클 2 사전 설계(이번 사이클에는 생성하지 않음)**: `useFeedComments` → `api/feedCommentApi` → `api/client` / `FeedCommentController`(백엔드) → `FeedCommentService` → `FeedCommentRepository`(신규), `FeedPostRepository`(기존), `UserRepository`(기존)

의존 방향은 기존 기능들과 동일하게 **페이지 → (훅, 표시 컴포넌트) → api → client**를 따른다.

---

## 12. 회귀 방지 체크리스트 (구현 단계에서 확인)

- [ ] 관리자 피드 모더레이션 화면(`/admin/feed`, `/admin/feed/:id`)이 기존과 동일하게 동작(댓글 신규 추가로 `FeedPost` 연관관계가 늘었으므로 `FeedAdminService`의 조회 쿼리가 의도치 않게 영향받지 않는지 확인)
- [ ] `AdminCourseFormPage`의 REFERENCE 경유지 선택(`TourReferencePicker`)이 이동 후에도 동일하게 동작(특히 `AdminPagination` cross-폴더 import가 정상 빌드되는지)
- [ ] `GET /api/v1/feed/profile`(내 프로필, 기존)이 `getUserProfile` 추가 후에도 정상 동작(경로 매핑 충돌 없음, §4.4 확인)
- [ ] 기존 `FeedPageResponse`를 참조하는 다른 코드가 없는지 삭제 전에 재확인(grep)

**사이클 2 착수 시 추가할 체크리스트 항목(이번 사이클에는 해당 없음)**: 게시물 하드 삭제 시 댓글이 실제로 함께 삭제되는지(cascade 동작 확인, 고아 레코드 방지) — `FeedComment`가 아직 존재하지 않으므로 이번 사이클에서는 확인 대상이 아니다.

---

## 13. 구현 순서 — PDCA 사이클 분리 (확정)

이번 기능은 계획 문서가 이미 지적했듯 admin-dashboard의 개별 리소스 하나보다 크다. **아래와 같이 두 개의 독립적인 PDCA 사이클로 나누는 것이 사용자 확인을 거쳐 확정됐다(2026-09-30).**

### 사이클 1 (이 설계 문서의 구현 범위) — `feed-integration`

피드 타임라인(무한 스크롤) + 상세 + 작성(이미지 순서변경·위치 태깅 포함) + 삭제 + 좋아요·북마크 + 타인 프로필 + `FeedExceptionHandler` 정리. **댓글+답글은 이 사이클에 포함되지 않는다** — §3.4, §3.5, §4.3, §8과 §2·§11·§12의 관련 항목은 사이클 2를 위해 미리 구체화해 둔 설계 초안일 뿐, 이번 Do 단계에서 구현하지 않는다.

**포함 이유**: 이 항목들은 전부 "이미 있는 API를 연결"하거나(타임라인·상세·작성·삭제·토글) "한 개의 작은 신규 API"(타인 프로필)로 끝나, 서로 강하게 얽혀 있어 따로 떼면 오히려 부자연스럽다(예: 상세 화면 없이 타임라인만 만들 수 없고, 작성 폼 없이 삭제 확인만 만들 수 없다).

### 사이클 2 (후속, 별도 Plan 문서부터 재시작) — `feed-comment-integration`

댓글+답글 전체(엔티티·API·UI). **완전히 범위 밖 — 이번 사이클 완료 후 `docs/01-plan/features/feed-comment-integration.plan.md`를 새로 작성하는 것부터 시작한다.**

**분리 이유(확정 근거)**:
- 댓글은 `FeedPost`에 기능적으로 연결돼 있을 뿐, **독립적으로 설계·구현·검증 가능한 완결된 하위 시스템**이다(자기 참조 엔티티, 별도 컨트롤러, 별도 프론트 컴포넌트 트리).
- 사이클 1이 끝나면 `/feed`가 이미 "쓸 수 있는 화면"이 된다(댓글 없이도 좋아요·북마크·작성·삭제로 SNS의 핵심 기능은 성립). 댓글을 얹지 못한 상태로 릴리스해도 사용자 가치가 있다 — tour-course-list-integration이 "여행코스-피드 연동"을 별도 후속으로 미룬 것과 같은 논리(완결 지어 릴리스 가능한 단위로 자른다).
- gap 분석·코드 리뷰 단위가 너무 커지면(엔티티 1개 + API 3개 + 커서 마이그레이션 + 컴포넌트 10여 개 + 댓글 엔티티까지) 리뷰 품질이 떨어진다. 두 사이클로 나누면 각각의 완료 보고서·포트폴리오 추출도 "무한 스크롤과 커서 페이지네이션"(사이클 1), "자기 참조 엔티티와 깊이 제한 설계"(사이클 2)로 뚜렷하게 구분되는 면접 소재가 된다.

**연결 지점**: 사이클 1은 카드의 "댓글 수" 표시를 `FeedPostResponse.commentCount`(항상 0, 사이클 2 전까지) 그대로 숫자만 보여주고 클릭 가능한 링크로 만들지 않는다(거짓 UI 금지 원칙, 계획 5장 위험 항목 참고). 사이클 2가 `FeedPost.comments`/`commentCount` 갱신 로직을 추가하면, 사이클 1이 만든 카드 표시는 코드 변경 없이 실제 값을 보여주기 시작한다.

---

## 14. 남은 열린 사항

| # | 항목 | 확인 방법 | 비고 |
|---|------|-----------|------|
| O-1 | `FeedPost`에 `comments` 컬렉션을 추가하면 기존 `findWithDetailsById`/`findWithDetailsByIdAndDeletedAtIsNull`의 `@EntityGraph(attributePaths = {"author", "photos"})`가 댓글까지 즉시 로딩하지 않는지 | 코드 확인 결과 이미 안전 — `@EntityGraph`는 명시한 경로만 즉시 로딩하므로 `comments`는 여전히 지연 로딩(상세 조회 응답에 댓글을 포함하지 않으므로 문제 없음) | 구현 단계에서 재확인 불필요, 설계로 이미 검증됨 |
| O-2 | 댓글 500자 제한이 실제 SNS 댓글 길이 관례에 적절한지 | 구현 후 수동 확인 | 게시글 2000자보다 짧게 잡음(댓글은 짧은 소통이 일반적) |
| O-3 | `IntersectionObserver`의 `rootMargin: '200px'` 값이 실제 카드 높이·이미지 로딩 속도에 적절한지 | 구현 후 실기기 테스트로 조정 | 낮은 위험, 값 하나만 조정하면 됨 |

---

## 15. 다음 단계

1. [x] 13장 PDCA 분리 확정 (사이클 1: 이 문서 / 사이클 2: `feed-comment-integration`, 후속)
2. [ ] 백엔드 구현 — 사이클 1: 커서 목록 API, 타인 프로필 API, `FeedExceptionHandler` 정리 (frontend-support-backend)
3. [ ] 프론트 구현 — 사이클 1: 타임라인·상세·작성·삭제·토글·타인 프로필, `TourReferencePicker` 이동 (frontend-lead)
4. [ ] 코드 리뷰(frontend-code-reviewer) + gap 분석 — 사이클 1
5. [ ] 완료 보고서 → 포트폴리오 추출(frontend-interview-coach) — 사이클 1
6. [ ] 사이클 1 완료 후 `docs/01-plan/features/feed-comment-integration.plan.md`부터 새로 작성해 사이클 2 시작

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-30 | 초안. 계획 Q-1~Q-9 결정 반영. 커서 기반 무한 스크롤, `FeedComment` 자기 참조 엔티티(답글 1단계), 타인 프로필 API, `TourReferencePicker` 이동, 이미지 순서 변경 UI를 구체화. `FeedExceptionHandler` 발견 사항 정정(GlobalExceptionHandler가 이미 올바르게 처리 중이었음). 규모상 2개 PDCA 사이클 분리를 권장안으로 제시 | WOOJIN |
| 0.2 | 2026-09-30 | **PDCA 사이클 분리 확정** 반영. 문서 전체에서 "권장안"→"확정" 표현으로 수정. 이 문서의 구현 범위를 사이클 1(댓글 제외)로 명확히 하고, 댓글 관련 절(§3.4, §3.5, §4.3, §8)과 관련 표 행(§2, §4.1, §11, §12)에 "사이클 2 사전 설계 — 이번 사이클 구현 대상 아님" 표시를 추가. §13 제목·내용을 확정 표현으로 재작성 | WOOJIN |
