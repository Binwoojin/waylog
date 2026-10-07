# feed-comment-integration 설계 문서

> **요약**: 계획 8장 Q-1~Q-4가 전부 사용자 결정(2026-09-30, 전부 권장안 채택)으로 확정되면서, `feed-integration.design.md` §3.4~3.5(엔티티·DTO)·§4.3(API)·§8(UI)에 "사이클 2 사전 설계"로만 남아 있던 초안을 **이 문서가 확정 설계로 공식화**한다. 재설계가 아니라 사전 설계 검토·확정이라, 스키마·API 시그니처는 사전 설계와 거의 동일하다. 이 문서가 새로 구체화하는 것은 (1) `useFeedComments` 훅의 상태 모양(페이지 단위 누적, 무한 스크롤 아님), (2) `FeedDetailPage`에 인라인으로 통합하는 UI 구조, (3) 낙관적 업데이트를 쓰지 않는 "요청 완료 후 갱신" 흐름(Q-4), (4) `SecurityConfig` 변경이 필요 없다는 재확인이다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-09-30
> **상태**: Approved
> **계획 문서**: `docs/01-plan/features/feed-comment-integration.plan.md` (FR-19 ~ FR-33, FR-34 결번, 사용자 결정 Q-1 ~ Q-4)
> **선행 설계**: `docs/02-design/features/feed-integration.design.md` §3.4~3.5(`FeedComment` 엔티티·DTO 사전 설계), §4.3(댓글 API 사전 설계), §8(댓글·답글 UI 사전 설계), §13(PDCA 사이클 분리 근거)

---

## Context Anchor

> 계획 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | 게시물 상세의 "댓글 N개" 표시가 사이클 1부터 항상 0으로 고정돼 있다. 백엔드에 댓글 엔티티 자체가 없어 만들지 않으면 영구히 빈 기능으로 남는다 |
| **WHO** | 게시물에 의견을 남기는 사용자, 댓글에 답글로 반응하는 사용자, 본인 댓글을 정리하고 싶은 사용자 |
| **RISK** | 자기 참조 엔티티에서 답글의 답글을 막는 로직 / 최상위 댓글 삭제 시 답글 cascade와 `commentCount` 계산 정합성 / (해소됨) 사이클 1의 `SecurityConfig` 누락(G-1) 재발 |
| **SUCCESS** | 댓글·답글(1단계) 작성·조회·삭제가 모두 동작, 답글의 답글은 서버가 거부, 게시물 삭제 시 댓글 cascade 정리, 로딩·에러·빈 상태 구분, 회귀 없음 |
| **SCOPE** | 백엔드: `FeedComment` 신규, `FeedPost` 필드 추가, 댓글 API 3종 / 프론트: `feedCommentApi.js`, `useFeedComments`, `FeedCommentList`/`FeedCommentForm`, `FeedDetailPage` 통합 |

---

## 계획 대비 변경 (사용자 결정 반영, 2026-09-30)

| # | 항목 | 계획의 결정 | 설계에서 구체화한 내용 |
|---|------|-------------|------------------------|
| D-1 | 알림 (Q-1) | 제외 확정 | 댓글 관련 코드 어디에도 알림 발행 로직을 두지 않는다. `FeedCommentService.create()`는 댓글 저장과 `commentCount` 증가만 수행한다(§4.3) |
| D-2 | 댓글 삭제 방식 (Q-2) | 하드 삭제 확정 | `FeedCommentRepository.delete()`로 행 자체를 제거. 최상위 댓글 삭제 시 `replies`가 `orphanRemoval = true`로 함께 삭제된다(§3.1). 소프트 삭제 컬럼(`deletedAt` 등)을 `FeedComment`에 추가하지 않는다 |
| D-3 | 답글 표시 방식 (Q-3) | 기본 항상 펼침 확정 | `FeedCommentList`가 각 댓글의 `replies` 배열을 조건 없이 그대로 렌더링한다. 접기/펼치기 토글 상태(`expanded` 등)를 컴포넌트에 두지 않는다(§6.2) |
| D-4 | 낙관적 업데이트 (Q-4) | 미적용 확정 | 댓글 작성·삭제는 API 요청이 완료(`await`)된 뒤에만 로컬 상태를 갱신한다. 실패 시 롤백 로직 자체가 필요 없다 — 애초에 성공 응답을 받기 전에는 상태를 바꾸지 않기 때문이다(§7) |

이 표 외에 설계 단계에서 재확인한 사항:

| # | 항목 | 내용 |
|---|------|------|
| D-5 | `SecurityConfig` 변경 불필요 재확인 | 계획 §1.2에서 코드로 확인한 바를 이 설계에서도 그대로 채택한다: 기존 `.requestMatchers(HttpMethod.GET, "/api/v1/feed/posts/**").permitAll()`가 `GET /api/v1/feed/posts/{postId}/comments`를 이미 포함한다. `POST`/`DELETE` 댓글 엔드포인트는 이 규칙에 해당하지 않아 `anyRequest().authenticated()`로 자동 인증 요구된다. `config/SecurityConfig.java`는 이번 사이클에서 **한 줄도 수정하지 않는다**(§4.4) |
| D-6 | 댓글 수 표시와 `useFeedDetail` 연결 | `FeedDetailPage`가 이미 갖고 있는 `useFeedDetail().applyLocalUpdate`를 재사용해, 댓글 작성·삭제 성공 시 `post.commentCount`를 갱신한다(신규 훅이나 state를 추가하지 않는다, §6.1) |

---

## 1. 개요

### 1.1 설계 목표

- 사전 설계(엔티티·API 스키마)를 재설계하지 않고 그대로 확정해, 불필요한 재작업을 만들지 않는다.
- 댓글 목록·답글 상태를 `useFeedInfiniteList`(누적+커서)와도 `useFeedDetail`(단일 객체)과도 다른, "페이지 단위로 눌러서 이어붙이는" 세 번째 상태 모양으로 명확히 설계한다.
- 낙관적 업데이트를 쓰지 않기로 한 결정(Q-4)을 "단순히 안 만든다"가 아니라, 요청 상태(`pending`)를 명시적으로 노출해 사용자가 처리 중임을 알 수 있게 한다.
- 답글의 답글을 막는 책임을 서버(1차)와 UI(2차, 리프에는 답글 버튼 자체를 렌더링하지 않음)에 이중으로 둔다.

### 1.2 설계 원칙

- **fail-closed**: 댓글 응답도 필수 필드(`id`, `author.id`, `content`)가 없으면 성공으로 보지 않는다(사이클 1과 동일 원칙).
- **거짓 UI 금지**: 답글이 없는 댓글에 빈 "답글 보기" 토글을 만들지 않는다(사이클 1 원칙 계승). 답글에는 애초에 `[답글]` 버튼을 렌더링하지 않는다.
- **이미 검증된 코드는 건드리지 않는다**: `FeedController`/`FeedService`/`FeedProfileController`/`FeedProfileService`/`SecurityConfig`는 이번 사이클에서 수정하지 않는다(D-5).
- **최소 변경**: `FeedPost`에 댓글 관련 필드를 추가할 때도 기존 `photos`/`tags` 컬렉션 옆에 병렬로 추가하고, 기존 생성자·메서드는 손대지 않는다.

---

## 2. 아키텍처

### 2.1 구성도

```
                              게시물 상세(/feed/posts/:id) — 라우트 변경 없음, 기존 화면에 인라인 통합
                                              │
                          FeedDetailPage.jsx (사이클 1, 기존)
                          ├ useFeedDetail(id)            ← 기존, 변경 없음
                          │   └ applyLocalUpdate({ commentCount })  ← 댓글 작성/삭제 시 재사용
                          │
                          └ CommentSection (신규, FeedDetailPage 내부에 추가)
                                  │
                                  useFeedComments(postId)   ← 신규 훅
                                  ├ topLevelComments[], currentPage, totalPages, hasNext
                                  ├ status: 'loading' | 'success' | 'error'
                                  ├ loadMoreStatus: 'idle' | 'loading' | 'error'
                                  └ addComment(saved) / removeComment(commentId, parentId?)  ← 로컬 상태 반영(요청 완료 후에만 호출)
                                              │
                                              ▼
                          GET /api/v1/feed/posts/{postId}/comments?page=&size=
                          { comments: [{ id, author, content, createdAt, replies: [...] }], currentPage, totalPages, totalElements, hasNext }
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
     FeedCommentList.jsx (표시)                              FeedCommentForm.jsx (입력)
     ├ 최상위 댓글 + 답글(항상 펼침, Q-3)                        ├ 최상위 댓글 입력(섹션 하단)
     ├ "더 보기" 버튼(무한 스크롤 아님, P-11)                     └ 댓글별 인라인 답글 입력
     └ 답글에는 [답글] 버튼 미노출(리프)                                  │
                    │                                                   ▼
                    ▼                                    POST /api/v1/feed/posts/{postId}/comments
        [삭제] 버튼(본인 댓글만) → FeedConfirmDialog 재사용         { content, parentCommentId }
                    │                                                   │
                    ▼                                                   ▼
        DELETE .../comments/{commentId}                    요청 완료(await) 후에만 로컬 상태 반영(Q-4, 낙관적 업데이트 없음)
```

### 2.2 모듈과 분리 근거

| 모듈 | 역할 | 분리 근거 |
|------|------|-----------|
| `api/feedCommentApi.js` | 댓글 목록·작성·삭제, view model 변환 | `feedApi.js`와 동일한 fail-closed 원칙이지만 리소스가 완전히 달라(게시물이 아니라 댓글) 별도 모듈 유지(사이클 1 설계 §2.2 그대로) |
| `hooks/useFeedComments.js` | 댓글 목록 상태(페이지 단위 누적) + 작성/삭제 결과 반영 | `useFeedInfiniteList`(스크롤 트리거 누적)와도 `useFeedDetail`(단일 객체)과도 다른 세 번째 상태 모양이라 새 파일로 분리(§5) |
| `components/feed/FeedCommentList.jsx` | 댓글+답글 렌더링, "더 보기" 버튼 | 표시 전용, 입력 로직과 분리해 각각 단순하게 유지 |
| `components/feed/FeedCommentForm.jsx` | 최상위 댓글 입력 + 댓글별 인라인 답글 입력(같은 컴포넌트 재사용, `parentCommentId` prop으로 구분) | 입력 폼 로직(글자 수 제한, pending 상태)을 한 곳에 모아 최상위/답글 입력 동작을 동일하게 유지 |
| `pages/FeedDetailPage.jsx`(기존, 수정) | 댓글 섹션을 기존 좋아요/북마크 액션 영역 아래에 연결 | 새 페이지·새 라우트를 만들지 않는다(§8) |
| `feed/domain/FeedComment.java`(백엔드, 신규) | 댓글·답글 엔티티(자기 참조) | §3.1 |
| `feed/controller/FeedCommentController.java`(신규) | 댓글 CRUD | 기존 `FeedController`/`FeedProfileController`와 같은 "컨트롤러당 단일 리소스" 원칙 유지 |

### 2.3 상태의 원천과 데이터 흐름

| 상태 | 위치 | 이유 |
|------|------|------|
| 게시물 본문·좋아요·북마크·`commentCount` | `useFeedDetail` 내부 state(기존, 변경 없음) | 사이클 1 그대로. 댓글 작성/삭제가 `commentCount`를 갱신할 때도 `applyLocalUpdate`를 통해서만 접근한다 |
| 댓글·답글 목록(페이지 단위 누적) | `useFeedComments` 내부 state(신규) | 게시물 상세에 종속되지만 API·페이지네이션 모양이 완전히 달라 별도 상태로 분리 |
| 댓글/답글 입력값 | `FeedCommentForm` 내부 state(신규) | 로컬 UI 상태, 다른 화면과 공유하지 않음 |
| "어느 댓글에 답글 입력창이 열려 있는지" | `CommentSection`(또는 `FeedCommentList`) 내부 state — 한 번에 하나만 열리도록 댓글 id 값 하나로 관리 | 로컬 UI 상태 |

Context·전역 store는 쓰지 않는다(사이클 1과 동일 원칙).

---

## 3. 데이터 모델

### 3.1 백엔드 엔티티 — `FeedComment` (신규, 확정)

> 사전 설계(`feed-integration.design.md` §3.4)를 그대로 확정한다. Q-2(하드 삭제) 결정에 따라 소프트 삭제 컬럼은 추가하지 않는다 — 사전 설계에도 애초에 없었으므로 변경 사항 없음.

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
     * "답글의 답글"을 막기 위해 서비스 계층에서 parent.getParent() != null(= parent.isReply())을 검증합니다(1단계 제한).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    private FeedComment parent;

    /*
     * 답글은 부모 댓글이 삭제되면 함께 삭제됩니다(고아 객체 제거, Q-2 하드 삭제 확정).
     * commentCount 갱신은 서비스 계층에서 삭제 전 개수를 세어 처리합니다(§4.3).
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

**`FeedPost`에 추가**(기존 파일 수정, `photos`/`tags` 컬렉션 옆에 병렬로 추가 — 계획 §1.2 재조사에서 현재 `FeedPost.java`에 아직 없음을 확인함):

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

이 관계 덕분에 기존 `FeedService.delete()`(게시물 하드 삭제, `feedPostRepository.delete(post)`)가 **코드 변경 없이** 댓글까지 함께 정리한다. 계획 §1.2가 재확인한 대로 `FeedService.java`는 이번 사이클에서 수정하지 않는다 — `FeedPost` 엔티티에 연관관계만 추가하면 기존 삭제 로직이 그대로 cascade를 따른다.

**`@EntityGraph`에 영향 없음 재확인(계획 §1.2, 설계 §14 O-1 계승)**: `FeedPostRepository.findWithDetailsById`/`findWithDetailsByIdAndDeletedAtIsNull`은 `@EntityGraph(attributePaths = {"author", "photos"})`만 명시하므로, `comments`를 추가해도 게시물 상세 조회 시 댓글을 즉시 로딩하지 않는다(지연 로딩 유지). 상세 응답(`FeedPostResponse`)은 애초에 `comments` 컬렉션을 참조하지 않으므로 N+1 위험도 없다.

### 3.2 프론트 view model — `FeedCommentThread`

```js
// feedCommentApi.js의 toFeedComment(item)
{
  id,                 // 문자열 변환
  author: { id, nickname, profileImageUrl },  // author.id 없으면 항목 폐기(fail-closed)
  content,
  createdAt,
  isReply: false,      // parentCommentId 유무로 클라이언트가 계산(서버 응답에는 없음, 응답 위치로 구분)
  replies: FeedCommentThread[]   // 항상 1단계 깊이까지만 채워짐(서버가 보장), 리프는 항상 []
}
```

```js
// FeedCommentPageResult
{ comments: FeedCommentThread[], currentPage: number, totalPages: number, hasNext: boolean }
```

fail-closed: `comments`가 배열이 아니면 `Error`. `author.id`가 없는 항목은 통째로 버린다(카드 폐기와 동일 원칙).

### 3.3 DTO (신규, 확정)

> 사전 설계(`feed-integration.design.md` §3.5)를 그대로 확정한다.

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

### 4.1 신규 엔드포인트 요약

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/v1/feed/posts/{postId}/comments?page=&size=` | 최상위 댓글 페이지네이션(답글 포함) | 선택(비로그인 조회 가능, §4.4) |
| POST | `/api/v1/feed/posts/{postId}/comments` | 댓글/답글 작성 | 필수 |
| DELETE | `/api/v1/feed/posts/{postId}/comments/{commentId}` | 본인 댓글(+답글) 하드 삭제(Q-2) | 필수(작성자만) |

### 4.2 컨트롤러·서비스·리포지토리 (확정)

> 사전 설계(`feed-integration.design.md` §4.3)를 그대로 확정한다.

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

    // extractRequiredEmail/extractOptionalEmail은 FeedController와 동일 로직(사이클 1 패턴 복제)
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

**답글 삭제(리프 댓글) 시 `removedCount`는 항상 1**이 된다(리프는 `replies`가 비어 있으므로). 최상위/답글 구분 없이 동일한 코드 경로로 동작한다.

**예외 처리**: `FeedCommentService`가 던지는 `IllegalArgumentException`은 새 예외 핸들러를 만들지 않고 기존 `common.exception.GlobalExceptionHandler.handleIllegalArgument`가 그대로 `{message: string}` 형식으로 처리한다(사이클 1이 `FeedExceptionHandler`에서 확인한 것과 같은 전역 처리 경로, 새 컨트롤러라고 별도 핸들러를 만들 필요 없음).

### 4.3 타인 프로필·게시물 API — 변경 없음

`FeedController`, `FeedService`, `FeedProfileController`, `FeedProfileService`, `FeedPostRepository`는 이번 사이클에서 수정하지 않는다(계획 §6.1). `FeedPostResponse.commentCount`는 `FeedPost.commentCount` 필드를 그대로 읽으므로, `FeedCommentService`가 `increaseCommentCount`/`decreaseCommentCount`를 호출하기 시작하면 사이클 1이 만든 타임라인 카드·상세 화면의 "댓글 N개" 표시가 **코드 변경 없이** 실제 값을 보여주기 시작한다(사이클 1 설계 §13 "연결 지점" 그대로 실현).

### 4.4 `SecurityConfig` — 변경 불필요 재확인 (D-5)

```java
// SecurityConfig.java (기존, 66행 부근 — 인용, 수정하지 않음)
.requestMatchers(HttpMethod.GET, "/api/v1/feed/posts/**").permitAll()
```

이 규칙은 `/api/v1/feed/posts` 아래 모든 깊이의 GET 경로에 적용되는 다중 세그먼트 와일드카드(`**`)다. 따라서 `GET /api/v1/feed/posts/{postId}/comments`도 **별도 설정 없이 이미 permitAll에 포함된다.** `POST`/`DELETE /api/v1/feed/posts/{postId}/comments[/{commentId}]`는 이 규칙에 해당하지 않으므로 `.anyRequest().authenticated()`로 자동으로 인증이 요구된다 — 계획 §1.2가 코드로 확인한 내용을 이 설계에서도 최종 결론으로 채택하며, **이번 사이클은 `SecurityConfig.java`를 수정하지 않는다.**

**구현 단계 검증 항목(계획 §6.3, 반드시 수행)**: 코드 분석만으로 끝내지 않고, 구현 완료 후 실제 HTTP 요청으로 (1) 비로그인 `GET .../comments`가 200을 반환하는지, (2) 비로그인 `POST`/`DELETE .../comments`가 401을 반환하는지 확인한다. 사이클 1의 G-1(코드 분석 누락)이 "재조사로 미리 막았다"에서 끝나지 않고 "실제로도 그렇다"까지 확인하기 위함이다.

---

## 5. `useFeedComments` 훅 설계

### 5.1 상태 모양 — 왜 세 번째 모양이 필요한가

| 기존 훅 | 상태 모양 | 트리거 | 댓글에 맞지 않는 이유 |
|---------|-----------|--------|------------------------|
| `useFeedInfiniteList` | 누적(append), 커서 기반 | `IntersectionObserver`(스크롤) | 댓글은 게시물당 수십 개 수준이라 스크롤 자동 트리거가 과하고, 커서 대신 이미 페이지 기반으로 설계된 API(§4.2)를 그대로 쓰는 것이 자연스럽다 |
| `useFeedDetail`/`useFeedUserProfile` | 단일 객체 교체, `key`로 재마운트 | 페이지 진입 | 댓글은 목록이고, "더 보기"로 페이지를 이어붙여야 하므로 교체형이 아니다 |
| `useFeedComments`(신규) | **누적(append), 페이지 기반**, 버튼 클릭 트리거 | `[더 보기]` 버튼 클릭 | 목록이 누적된다는 점은 무한 스크롤과 같지만, 트리거가 자동(스크롤)이 아니라 수동(클릭)이고 커서가 아니라 페이지 번호를 쓴다는 점이 다르다 |

### 5.2 구현

```js
export function useFeedComments(postId, size = 20) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'loading',        // 'loading' | 'success' | 'error'
    comments: [],
    currentPage: 0,
    totalPages: 0,
    hasNext: false,
    loadMoreStatus: 'idle',   // 'idle' | 'loading' | 'error'
  })

  const load = useCallback(async (page, { isInitial }, signal) => {
    dispatch({ type: isInitial ? 'INIT_START' : 'MORE_START' })
    try {
      const result = await fetchFeedComments(postId, { page, size }, { signal })
      dispatch({ type: isInitial ? 'INIT_SUCCESS' : 'MORE_SUCCESS', payload: result })
    } catch (error) {
      if (!isAbortError(error)) dispatch({ type: isInitial ? 'INIT_ERROR' : 'MORE_ERROR' })
    }
  }, [postId, size])

  useEffect(() => {
    const controller = new AbortController()
    load(1, { isInitial: true }, controller.signal)
    return () => controller.abort()
  }, [load])   // postId가 바뀌면(다른 게시물) 훅을 다시 마운트하는 쪽(부모의 key)에서 처리 — useFeedDetail과 동일 관례

  const loadMore = useCallback(() => {
    if (!state.hasNext || state.loadMoreStatus === 'loading') return
    load(state.currentPage + 1, { isInitial: false })
  }, [load, state.hasNext, state.currentPage, state.loadMoreStatus])

  /*
   * Q-4(낙관적 업데이트 미적용): 아래 두 함수는 API 요청이 성공적으로 끝난 뒤에만 호출된다.
   * 요청 도중에는 상태를 바꾸지 않으므로 실패 시 롤백 로직 자체가 필요 없다.
   */
  const addComment = useCallback(saved => {
    dispatch({ type: 'ADD_COMMENT', payload: saved })
  }, [])

  const removeComment = useCallback((commentId, parentId) => {
    dispatch({ type: 'REMOVE_COMMENT', payload: { commentId, parentId } })
  }, [])

  return { ...state, loadMore, addComment, removeComment }
}
```

**리듀서 요지**:
- `INIT_SUCCESS`: `comments`를 응답으로 **교체**, `currentPage`/`totalPages`/`hasNext` 갱신.
- `MORE_SUCCESS`: 응답의 `comments`를 기존 배열 뒤에 **이어붙이기**(정렬이 `createdAt ASC`라 항상 뒤에 붙이면 순서가 유지된다), `currentPage`/`hasNext` 갱신.
- `ADD_COMMENT`: `parentCommentId`가 없으면 `comments` 배열의 **맨 끝**에 새 댓글을 추가한다(정렬 기준이 `createdAt ASC`이므로, 아직 안 불러온 이후 페이지가 있어도 방금 작성한 댓글은 항상 전체에서 가장 최근이라 이미 불러온 목록의 끝에 붙이는 것이 항상 올바르다). `parentCommentId`가 있으면 해당 최상위 댓글을 찾아 그 `replies` 배열 끝에 추가한다.
- `REMOVE_COMMENT`: `parentId`가 없으면 `comments`에서 해당 id를 제거(그 답글도 함께 사라짐 — 서버가 이미 cascade로 지웠으므로 프론트도 그대로 반영). `parentId`가 있으면 해당 최상위 댓글의 `replies`에서 제거.

**요청 취소**: 초기 로드는 `AbortController`로 취소하고, `isAbortError`로 취소 오류를 무시한다(사이클 1 전역 원칙, 코드 리뷰 Must Fix 2로 강화됨). "더 보기"도 동일 패턴을 따르되, 언마운트 시점에 진행 중인 "더 보기" 요청까지 취소하려면 `load` 호출부에 컴포넌트 레벨 `AbortController`를 하나 더 두는 대신, 댓글 섹션이 상세 페이지 안에 있어 페이지 언마운트와 생명주기가 같으므로 초기 로드와 동일한 상위 `controller`를 재사용해도 무방하다(구현 단계에서 최종 확정).

---

## 6. UI 설계

### 6.1 `FeedDetailPage.jsx` 통합 지점

사이클 1이 만들어 둔 아래 지점(현재 숫자만 표시)에 댓글 섹션을 추가한다.

```jsx
{/* 기존 코드(사이클 1) — 숫자 표시는 그대로 유지 */}
<span className="feed-detail-action feed-detail-action--comment" aria-label={`댓글 ${post.commentCount}개`}>
  <span aria-hidden="true">💬</span>
  <span>댓글 {post.commentCount}</span>
</span>

{/* 이하 신규 — footer 바깥, article 안쪽 맨 아래 */}
<CommentSection postId={post.id} onCommentCountChange={delta => applyLocalUpdate({ commentCount: Math.max(0, post.commentCount + delta) })} />
```

`CommentSection`은 `useFeedComments(postId)`를 호출하고 `FeedCommentList`(표시)와 `FeedCommentForm`(최상위 입력)을 묶는 얇은 컨테이너다. 댓글 작성·삭제가 성공할 때마다 `onCommentCountChange(+1)`/`onCommentCountChange(-removedCount)`를 호출해, `useFeedDetail`의 `applyLocalUpdate`(사이클 1이 좋아요·북마크에 이미 쓰던 것과 동일한 함수)로 `post.commentCount`를 갱신한다 — **새 상태를 만들지 않고 기존 패턴을 그대로 재사용**한다.

### 6.2 댓글·답글 렌더링 (Q-3: 항상 펼침)

```jsx
function FeedCommentList({ comments, hasNext, loadMoreStatus, onLoadMore, onReply, onDelete, currentUserId }) {
  return (
    <div className="feed-comment-list">
      <ul aria-label="댓글 목록">
        {comments.map(comment => (
          <li key={comment.id} className="feed-comment">
            <CommentRow comment={comment} isOwner={comment.author.id === currentUserId}
                        onReply={() => onReply(comment.id)} onDelete={() => onDelete(comment, null)} />

            {/* Q-3: 답글은 토글 없이 항상 렌더링 */}
            {comment.replies.length > 0 && (
              <ul className="feed-comment__replies" aria-label={`${comment.author.nickname}님 댓글의 답글`}>
                {comment.replies.map(reply => (
                  <li key={reply.id} className="feed-comment feed-comment--reply">
                    {/* 리프는 onReply를 아예 전달하지 않아 [답글] 버튼 자체가 렌더링되지 않는다 */}
                    <CommentRow comment={reply} isOwner={reply.author.id === currentUserId}
                                onDelete={() => onDelete(reply, comment.id)} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {hasNext && (
        <button type="button" onClick={onLoadMore} disabled={loadMoreStatus === 'loading'}>
          {loadMoreStatus === 'loading' ? '불러오는 중…' : '댓글 더 보기'}
        </button>
      )}
      {loadMoreStatus === 'error' && <p role="alert">댓글을 더 불러오지 못했습니다.</p>}
    </div>
  )
}
```

`CommentRow`는 작성자 아바타/닉네임(클릭 시 `/feed/users/:userId`, 사이클 1 패턴 재사용), 내용(일반 텍스트, `dangerouslySetInnerHTML` 금지), 작성 시각, `onReply`가 전달된 경우에만 `[답글]` 버튼, `isOwner`인 경우에만 `[삭제]` 버튼을 렌더링하는 표시 전용 컴포넌트다.

### 6.3 댓글·답글 입력 (`FeedCommentForm.jsx`)

```jsx
function FeedCommentForm({ onSubmit, placeholder, pending, onCancel, requireLogin, isLoggedIn }) {
  const [content, setContent] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (!isLoggedIn) return requireLogin()
    const trimmed = content.trim()
    if (!trimmed) return
    onSubmit(trimmed).then(() => setContent(''))   // 성공 시에만 입력창 비움(요청 완료 후 갱신, Q-4)
  }

  return (
    <form onSubmit={handleSubmit} className="feed-comment-form">
      <label htmlFor={onCancel ? 'reply-input' : 'comment-input'} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={onCancel ? 'reply-input' : 'comment-input'}
        value={content}
        maxLength={500}
        placeholder={placeholder}
        onChange={event => setContent(event.target.value)}
        disabled={pending}
      />
      <div className="feed-comment-form__actions">
        {onCancel && <button type="button" onClick={onCancel}>취소</button>}
        <button type="submit" disabled={pending || !content.trim()}>
          {pending ? '작성 중…' : '등록'}
        </button>
      </div>
    </form>
  )
}
```

- 최상위 입력창(`CommentSection` 하단)과 인라인 답글 입력창(댓글별 `[답글]` 클릭 시 노출)이 **같은 컴포넌트**다. 답글 입력은 `onCancel`을 전달해 취소 버튼을, `onSubmit`에 `parentCommentId`를 포함시켜 구분한다.
- 답글 입력창은 한 번에 하나만 열린다 — `CommentSection`이 "현재 답글 입력이 열린 댓글 id"를 단일 값으로 관리하고, 다른 `[답글]`을 누르면 그 값을 교체한다(동시에 여러 답글 입력창을 열 필요가 없다는 사이클 1식 "필요한 만큼만" 원칙).
- 비로그인 사용자가 제출을 시도하면 `requireLogin()`(사이클 1의 `navigate('/login')` 패턴 재사용)이 호출되고, 폼 자체는 그대로 보여준다(좋아요·북마크 버튼과 동일하게 "클릭 시점에 로그인 여부를 확인"하는 방식 — 별도의 "로그인하고 댓글 쓰기" placeholder 화면을 새로 만들지 않는다).

### 6.4 댓글 삭제 확인 (Q-2: 하드 삭제)

사이클 1의 `FeedConfirmDialog`를 그대로 재사용한다(새 컴포넌트를 만들지 않는다).

```jsx
<FeedConfirmDialog
  open={Boolean(deleteTarget)}
  title="댓글을 삭제할까요?"
  description={
    deleteTarget?.replies?.length > 0
      ? '답글이 있는 댓글을 삭제하면 답글도 함께 삭제됩니다. 삭제한 댓글은 되돌릴 수 없습니다.'
      : '삭제한 댓글은 되돌릴 수 없습니다.'
  }
  pending={deleting}
  onConfirm={handleConfirmDelete}
  onCancel={() => setDeleteTarget(null)}
/>
```

`description`이 답글 존재 여부에 따라 달라지는 것은 설계 §8.3(사전 설계)이 이미 지정한 문구를 그대로 따른 것이다.

---

## 7. 낙관적 업데이트를 쓰지 않는 흐름 (Q-4)

### 7.1 작성 흐름

```
사용자가 [등록] 클릭
      │
      ▼
버튼 disabled + "작성 중…" 표시(pending=true) — 화면 목록은 아직 그대로
      │
      ▼
POST /api/v1/feed/posts/{postId}/comments  (await)
      │
      ├─ 성공 ──▶ useFeedComments.addComment(response)로 목록에 추가
      │           + onCommentCountChange(+1) → useFeedDetail.applyLocalUpdate
      │           + 입력창 비움, pending=false
      │
      └─ 실패 ──▶ 목록은 애초에 바뀐 적이 없으므로 롤백 불필요
                  입력창의 내용은 유지(사용자가 다시 시도할 수 있도록)
                  에러 메시지 표시, pending=false
```

### 7.2 삭제 흐름

```
사용자가 [삭제] → 확인 모달에서 [확인]
      │
      ▼
확인 모달 pending=true(버튼 disabled) — 화면 목록은 아직 그대로(댓글이 사라지지 않음)
      │
      ▼
DELETE /api/v1/feed/posts/{postId}/comments/{commentId}  (await)
      │
      ├─ 성공 ──▶ useFeedComments.removeComment(commentId, parentId)로 목록에서 제거
      │           + onCommentCountChange(-removedCount) → applyLocalUpdate
      │             (removedCount는 서버가 계산하므로 응답에 없다면 프론트가 1 + replies.length로 재계산 —
      │              단, 서버 응답 바디는 204 No Content이므로 프론트는 삭제 대상 댓글의 로컬 replies.length를
      │              삭제 직전 값 그대로 사용해 계산한다)
      │           + 확인 모달 닫힘
      │
      └─ 실패 ──▶ 목록은 그대로(이미 지운 적이 없으므로 복구할 것이 없음)
                  확인 모달에 에러 메시지 표시, 모달은 열린 채로 유지, pending=false
```

**왜 이 방식이 사이클 1의 좋아요/북마크(낙관적 업데이트)와 다른가**: 좋아요·북마크는 클릭 즉시 시각적 피드백이 없으면 어색한, 빈번하고 되돌리기 쉬운 토글이다. 댓글 작성·삭제는 빈도가 낮고 "되돌릴 수 없다"는 것을 사용자가 이미 인지하는 동작이라(삭제는 확인 모달을 한 번 거친다), 응답을 기다리는 짧은 지연이 좋아요만큼 어색하지 않다. 이 판단이 Q-4에서 "미적용"을 권장한 근거였고 사용자가 그대로 채택했다.

---

## 8. 라우팅

변경 없음. 댓글은 새 라우트를 만들지 않고 기존 `/feed/posts/:id`(`FeedDetailPage`) 안에 인라인으로 포함된다(계획 §7.1 "상세 페이지에 인라인으로 포함" 결정 그대로).

---

## 9. 의존성

| 모듈 | 의존 대상 |
|------|-----------|
| `FeedDetailPage`(수정) | `useFeedDetail`(기존, 변경 없음), `CommentSection`(신규) |
| `CommentSection`(신규) | `useFeedComments`, `FeedCommentList`, `FeedCommentForm`, `FeedConfirmDialog`(사이클 1, 재사용) |
| `useFeedComments` | `api/feedCommentApi`(`fetchFeedComments`, `createFeedComment`, `deleteFeedComment`), `api/client`(`isAbortError`) |
| `api/feedCommentApi` | `api/client` |
| `FeedCommentController`(백엔드, 신규) | `FeedCommentService` → `FeedCommentRepository`(신규), `FeedPostRepository`(기존, 변경 없음), `UserRepository`(기존) |

의존 방향은 기존 기능들과 동일하게 **페이지 → (훅, 표시 컴포넌트) → api → client**를 따른다.

---

## 10. 회귀 방지 체크리스트 (구현 단계에서 확인)

- [ ] 게시물 하드 삭제(`FeedService.delete`) 시 댓글·답글이 고아 레코드 없이 함께 삭제되는지(cascade 동작 확인) — 계획 §2.1이 명시한 이번 사이클 필수 검증 항목
- [ ] 답글의 답글 생성 시도가 서버에서 거부되는지(`parent.isReply()` 검증)
- [ ] 최상위 댓글 삭제 시 `commentCount` 감소량이 `1 + 답글 수`와 정확히 일치하는지
- [ ] `GET /api/v1/feed/posts/{postId}/comments`가 비로그인 상태에서 실제로 200을 반환하는지(§4.4, 코드 분석에 더해 실제 요청으로 재검증)
- [ ] `POST`/`DELETE` 댓글 엔드포인트가 비로그인 상태에서 실제로 401을 반환하는지
- [ ] 사이클 1이 만든 타임라인(`FeedPage`)·타인 프로필(`FeedUserProfilePage`) 화면이 `FeedPost`에 `comments` 연관관계가 추가된 후에도 동일하게 동작하는지
- [ ] 관리자 피드 모더레이션(`FeedAdminController`/`FeedAdminService`)이 영향받지 않는지(연관관계만 늘었을 뿐 관리자 조회 쿼리는 수정하지 않음)

---

## 11. 남은 열린 사항

| # | 항목 | 확인 방법 | 비고 |
|---|------|-----------|------|
| O-1 | 댓글 500자 제한이 실제 사용에 적절한지 | 구현 후 수동 확인 | 사전 설계 §14 O-2 그대로 이월(사용자 결정 대상이 아닌 구현 세부 조정 항목) |
| O-2 | `useFeedComments`의 "더 보기" 요청 취소를 초기 로드와 같은 `AbortController`로 공유할지, 별도로 둘지 | 구현 단계에서 결정(§5.2) | 어느 쪽이든 사용자에게 보이는 동작 차이는 없음(내부 구현 선택) |
| O-3 | 답글 삭제 시 `removedCount`를 프론트가 재계산하는 방식(§7.2)이 서버의 실제 감소량과 항상 일치하는지 | 백엔드 테스트(계획 FR-26)로 서버 쪽 계산은 이미 검증. 프론트-서버 값 불일치 시나리오(예: 삭제 사이에 다른 사용자가 답글을 추가) 발생 가능성은 낮지만 구현 후 재확인 | 낮은 위험(동시 편집 경합의 극히 일부 사례) |

---

## 12. 다음 단계

1. [x] 계획 §1.2 재조사 반영, Q-1~Q-4 결정 반영(이 문서)
2. [ ] 백엔드 구현 — `FeedComment` 엔티티, `FeedPost` 필드 추가, DTO 3종, `FeedCommentRepository`/`Service`/`Controller`(frontend-support-backend, 계획 FR-19~26)
3. [ ] 프론트 구현 — `feedCommentApi.js`, `useFeedComments`, `FeedCommentList`/`FeedCommentForm`, `FeedDetailPage` 통합(frontend-lead, 계획 FR-27~33)
4. [ ] 회귀 체크리스트(10장) 및 §4.4 실제 요청 검증 수행
5. [ ] 코드 리뷰(frontend-code-reviewer) + gap 분석
6. [ ] 완료 보고서 → 포트폴리오 추출(frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-30 | 초안. 계획 Q-1~Q-4 결정(알림 제외, 하드 삭제, 답글 기본 펼침, 낙관적 업데이트 미적용) 반영. `feed-integration.design.md`의 사전 설계(엔티티·DTO·API)를 확정 설계로 공식화하고, `useFeedComments` 훅의 페이지 기반 누적 상태 모양, `FeedDetailPage` 인라인 통합 UI, 낙관적 업데이트 없는 작성/삭제 흐름을 신규로 구체화. `SecurityConfig` 변경이 이번 사이클에서 불필요함을 재확인 | WOOJIN |
