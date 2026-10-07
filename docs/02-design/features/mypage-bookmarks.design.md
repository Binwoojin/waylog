# mypage-bookmarks 설계 문서

> Plan 문서(`docs/01-plan/features/mypage-bookmarks.plan.md`) 8장 사용자 결정(Q-1~Q-8)을 반영해 API 응답 모양, 컴포넌트 구조, 라우팅을 구체화한다. 이 문서는 **설계 단계만** 다루며, 구현은 이 문서 완료 이후 별도로 진행한다.

**프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
**버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
**작성자**: WOOJIN (Claude Code 보조, frontend-lead)
**작성일**: 2026-10-01
**상태**: 설계 완료 — 구현 대기
**근거**: Plan 문서 1.2절 코드 조사 + 이번 설계 단계 추가 확인(`JwtAuthenticationFilter`, `AuthService`, `FeedService`, `UserRepository` 등 직접 확인)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | `/mypage`, `/bookmarks` 메뉴는 이미 노출돼 있지만 화면이 없다. Plan 문서에서 범위가 확정됐으므로 이번 설계에서 API 계약과 화면 구조를 구체화한다 |
| **WHO** | 로그인한 사용자 본인 |
| **RISK** | 회원 탈퇴 데이터 정책이 프로젝트에 전혀 없었음 / 비밀번호 변경 플로우를 실제로 연동하는 최초 사례 / 북마크 두 도메인 통합 |
| **SUCCESS** | Plan 문서 4장 성공 기준과 동일 |
| **SCOPE** | 이 문서가 구체화하는 범위: (1) 회원 프로필 확장 API (2) 비밀번호 변경 연동 (3) 회원 탈퇴 신규 API(최소 범위) (4) 피드 북마크 목록 신규 API (5) 투어 북마크 프론트 연동 (6) `/mypage`, `/bookmarks` 화면 (7) 가짜 저장 버튼 3곳 교체 |

---

## 계획 대비 변경 (설계 단계에서 추가로 확인한 사실)

Plan 문서 작성 이후 설계 단계에서 코드를 더 깊이 확인하며 두 가지를 추가로 발견했다. 둘 다 범위나 FR을 바꾸지는 않지만, 설계 방향에 직접 영향을 준다.

1. **`ForgotPasswordPage.jsx`는 `apiClient` 호출이 전혀 없는 완전히 정적인 화면이다.** 즉 이메일 인증 코드 발송(`POST /api/v1/auth/email-verification`) → 인증 확인(`POST /api/v1/auth/email-verification/confirm`) → 비밀번호 변경(`PUT /api/v1/auth/password`)으로 이어지는 백엔드 체인은 지금까지 **어떤 프론트 코드도 실제로 호출한 적이 없다**. 마이페이지의 비밀번호 변경 기능이 이 체인의 **최초 실제 소비자**가 된다. 참고로 `AuthService.refreshToken()`의 기존 주석("토큰이 유효해도 그 사이 탈퇴 등으로 회원이 없을 수 있습니다")에 "탈퇴"라는 단어가 이미 등장하는데, 이는 "회원 테이블에서 완전히 삭제"를 전제한 주석으로 보인다. 그러나 `FeedPost.author` FK가 `nullable = false`라 회원을 실제로 삭제(hard delete)하면 그 회원이 쓴 게시물이 있는 경우 FK 제약 위반이 난다. 이 모순 때문에 아래 §3.3에서 **소프트 삭제(계정 비활성 플래그)** 방식을 선택한 이유를 명시한다.
2. **`UserEntity`의 기존 "정지" 구현(`suspendedUntil`/`isSuspended()`/`suspend()`/`liftSuspension()`)과 로그인·리프레시·`JwtAuthenticationFilter` 3개 체크포인트 구조**를 그대로 "탈퇴"에 재사용할 수 있음을 확인했다(§3.3, §4.4).

---

## 1. 개요

### 1.1 설계 목표

- 기존 `/api/v1/feed/profile`을 확장해 "SNS 프로필"과 "계정 프로필"을 하나의 응답으로 통합한다(Q-2)
- 지금까지 아무도 호출하지 않았던 비밀번호 변경 체인을 마이페이지에서 실제로 연동한다
- 회원 탈퇴를 기존 정지(suspend) 구조를 재사용해 안전하게(FK 위반 없이) 최소 범위로 구현한다
- 피드 북마크 목록 조회를 신규로 추가하고, 이미 완성된 투어 북마크 API를 프론트에 처음으로 연결한다
- `TravelDetailPage`/`EnjoyCategoryPage`/`EnjoyDetailPage`의 가짜 저장 버튼을 실제 토글로 교체해 "거짓 UI"를 제거한다

### 1.2 설계 원칙

- **기존 컨벤션 재사용 우선**: 새 패턴을 만들기보다 `FeedProfileService.updateMyHandle`(값이 바뀐 경우만 검사), `UserEntity.suspend()`(상태 플래그), `FeedController.create()`(멀티파트), `FeedService.getFeed()`(배치 liked/bookmarked 조회)를 그대로 재사용한다
- **거짓 UI 금지**: 저장 버튼은 실제 API 응답을 받은 뒤에만 "저장됨"으로 표시한다
- **최소 범위 탈퇴**: 회원 탈퇴는 "재로그인 차단"까지만 다루고, 게시물·댓글의 연쇄 처리는 후속 과제로 명시해 범위 폭주를 막는다
- **하위 호환**: 기존 `FeedProfileResponse`/`FeedUserProfilePage`가 쓰는 필드는 그대로 두고 필드를 추가만 한다

---

## 2. 아키텍처

### 2.1 구성도

```
/mypage                                    /bookmarks
  ├─ 프로필 섹션(조회/수정)                    ├─ 탭: 피드 | 여행지 | 즐길거리
  │   └─ useMyFeedProfile ──► GET/PATCH         │   ├─ useFeedBookmarks   ──► GET /api/v1/feed/bookmarks
  │        /api/v1/feed/profile                 │   └─ useTourBookmarks   ──► GET /api/v1/tour-bookmarks?group=
  ├─ 내가 쓴 글 목록(기존 posts 필드 재사용)      └─ 탭 공통: 해제 버튼
  └─ 계정 설정 섹션                                   ├─ 피드: toggleFeedBookmark(기존)
      ├─ usePasswordChangeFlow                        └─ 투어: tourBookmarkApi.toggle(신규 연결)
      │   ├─ POST /api/v1/auth/email-verification
      │   ├─ POST /api/v1/auth/email-verification/confirm
      │   └─ PUT  /api/v1/auth/password
      └─ useWithdrawal ──► DELETE /api/v1/users/me

TravelDetailPage / EnjoyCategoryPage / EnjoyDetailPage
  └─ (기존 useState 가짜 저장 버튼 제거) → tourBookmarkApi.toggle 연결
```

### 2.2 모듈과 분리 근거

| 모듈 | 책임 | 분리 근거 |
|------|------|-----------|
| `useMyFeedProfile` | 내 프로필 조회/수정 상태 | `useFeedUserProfile`과 달리 인증 필요 + PATCH 보유 + PRIVATE 글 포함이라 별도 훅 |
| `usePasswordChangeFlow` | 이메일 인증 3단계 상태 머신 | 재사용 가능하도록 폼 컴포넌트와 분리(후속 `ForgotPasswordPage` 실연동 시 재사용 여지) |
| `useWithdrawal` | 탈퇴 확인 다이얼로그 상태 | 별도 관심사(파괴적 동작이라 독립된 확인 플로우) |
| `useFeedBookmarks` / `useTourBookmarks` | 북마크 탭별 목록 + 해제 | 탭 전환 시 완전히 독립된 상태(상태 공유 없음, Plan §7.2) |
| `tourBookmarkApi.js` | `tour-bookmarks` API 호출 + view model 변환 | `feedApi.js`와 대칭되는 신규 모듈, 3개 화면(마이페이지 북마크 탭, 상세 3곳)에서 공유 |

### 2.3 상태의 원천과 데이터 흐름

| 데이터 | 원천 | 비고 |
|--------|------|------|
| 내 프로필(닉네임·소개·이미지·@핸들) | 서버(`/api/v1/feed/profile`) | 폼은 서버 응답으로 초기화, 로컬 draft는 제출 전까지만 유지 |
| 북마크 목록 | 서버(탭별 API) | 탭 전환 시 재조회, 캐시하지 않음(Plan에서 전역 store 배제) |
| 탈퇴 여부 | 서버(JWT당 매 요청 검증) | 탈퇴 즉시 다음 요청부터 401 — 별도 토큰 무효화 리스트 불필요(§4.4) |

---

## 3. 데이터 모델

### 3.1 `UserEntity` 변경

```java
// UserEntity.java — 추가
@Column(name = "WITHDRAWN_AT")
private LocalDateTime withdrawnAt;

/**
 * 탈퇴 여부를 판단한다. suspendedUntil처럼 "현재 시각과 비교"하는 계산이 아니라
 * withdrawnAt이 null이 아니면 무조건 탈퇴 상태다(탈퇴는 기간제가 아니라 영구적이므로
 * isSuspended()와 달리 시각 비교가 필요 없다).
 */
public boolean isWithdrawn() {
    return withdrawnAt != null;
}

/**
 * 회원 탈퇴를 처리한다. suspend()와 달리 되돌리는 메서드(liftWithdrawal)를 두지 않는다
 * — 탈퇴는 사용자가 직접 요청한 영구적 조치이고, 관리자가 임의로 푸는 기능은
 * 이번 범위에 없다(필요해지면 후속 관리자 기능에서 별도로 설계).
 */
public void withdraw(LocalDateTime withdrawnAt) {
    this.withdrawnAt = withdrawnAt;
}

/**
 * 마이페이지 프로필 수정 — 닉네임·소개만 변경한다. 프로필 이미지는
 * updateProfileImage()로 분리한다(이미지 업로드 실패와 텍스트 저장 실패를
 * 같은 트랜잭션에서 섞지 않기 위함 — §4.2 참고).
 */
public void updateProfile(String nickname, String introduce) {
    this.nickname = nickname;
    this.introduce = introduce;
}

public void updateProfileImage(String profileImageUrl) {
    this.profileImageUrl = profileImageUrl;
}
```

**왜 `suspendedUntil`과 다른 모양인가**: 정지는 "기간이 끝나면 자동으로 해제"되어야 해서 `isSuspended()`가 매번 현재 시각과 비교하는 계산값이다. 탈퇴는 자동으로 되돌아가는 경우가 없으므로 `withdrawnAt != null` 하나로 충분하다 — 불필요한 복잡도를 추가하지 않는다.

### 3.2 `FeedProfileResponse` / `FeedProfileUpdateRequest` 확장

```java
// FeedProfileResponse.java — 필드 추가(순서 유지, introduce만 추가)
public record FeedProfileResponse(
        String nickname,
        String introduce,       // 신규
        String feedHandle,
        String profileImageUrl,
        long postCount,
        long receiveLikeCount,
        List<FeedPostResponse> posts,
        int currentPage,
        int totalPages,
        boolean hasNext
) {
    public static FeedProfileResponse of(UserEntity user, FeedProfile profile, long postCount,
            long receivedLikeCount, List<FeedPostResponse> posts, int currentPage, int totalPages, boolean hasNext) {
        return new FeedProfileResponse(
                user.getNickname(),
                user.getIntroduce(),  // 신규
                profile.getFeedHandle(),
                user.getProfileImageUrl(),
                postCount, receivedLikeCount, posts, currentPage, totalPages, hasNext
        );
    }
}
```

```java
// FeedProfileUpdateRequest.java — 전면 교체(기존 feedHandle 단일 필드 → 3개 필드)
public record FeedProfileUpdateRequest(
        @NotBlank(message = "닉네임을 입력해주세요.")
        @Size(min = 2, max = 30, message = "닉네임은 2~30자로 입력해주세요.")
        String nickname,

        @Size(max = 200, message = "소개는 200자 이내로 입력해주세요.")
        String introduce,

        @NotBlank(message = "피드 아이디를 입력해주세요.")
        @Size(min = 3, max = 20, message = "피드 아이디는 3~20자로 입력해주세요.")
        String feedHandle
) {}
```

> 닉네임 길이 제약(2~30자)은 `SignupPage.jsx`의 기존 프론트 검증(2자 이상)과 `UserEntity.NICKNAME` 컬럼 길이(30자)를 그대로 따른 것이다 — 새 규칙을 만들지 않았다.

`introduce`가 `FeedUserProfilePage.jsx`(타인 프로필)에도 자연스럽게 함께 노출된다(같은 레코드를 공유하므로). 이번 사이클에서 그 화면의 레이아웃을 바꾸지는 않지만, 원한다면 간단히 추가할 수 있다는 점만 남겨둔다(§8 남은 열린 사항).

### 3.3 회원 탈퇴 — 데이터 정책 (최소 범위)

| 항목 | 정책 | 근거 |
|------|------|------|
| `UserEntity` | 행을 삭제하지 않고 `withdrawnAt`만 채운다(소프트 삭제) | `FeedPost.author`가 `nullable = false` FK라 하드 삭제 시 FK 위반 또는 연쇄 삭제가 강제됨. 둘 다 이번 범위에서 다루기엔 과도함(Plan §5 위험) |
| 로그인 | 탈퇴한 이메일로 로그인 시도 시 차단(기존 `isSuspended()` 체크포인트 1과 같은 자리에 추가) | 재사용 |
| 토큰 리프레시 | 탈퇴한 회원은 체크포인트 2에서 차단(재발급 실패로 처리 → 프론트가 즉시 로그아웃 처리) | 재사용 |
| 매 요청(`JwtAuthenticationFilter`) | 탈퇴한 회원은 체크포인트 3에서 인증 정보 미설정(401) | 재사용 — 이미 발급된 Access Token도 다음 요청부터 즉시 무효화됨(별도 토큰 블랙리스트 불필요) |
| 기존 게시물·댓글·좋아요·북마크 | **이번 범위에서는 그대로 둔다.** 작성자 닉네임도 탈퇴 이전 값 그대로 표시됨 | 이번 사이클은 "로그인 차단"까지만(Plan §2.2 제외). 익명화("탈퇴한 사용자")·연쇄 삭제 정책은 후속 과제 |
| 재가입 | 탈퇴한 이메일로 재가입 가능 여부 | **이번 범위에서 다루지 않음**(현재 `existsByEmail`이 `withdrawnAt`을 구분하지 않으므로 기존 하드 유니크 제약과 동일하게 재가입은 막힘 — 변경 없음) |

### 3.4 피드 북마크 목록 — 신규 DTO

```java
// FeedBookmarkPageResponse.java (신규)
// FeedProfileResponse와 같은 offset 페이지네이션 모양을 그대로 따른다(마이페이지/북마크
// 화면 전체의 페이지네이션 방식을 하나로 통일 — 메인 피드 타임라인의 커서 방식과는
// 별개 영역이라 혼용해도 일관성 문제가 없다, Plan §1.2.2).
public record FeedBookmarkPageResponse(
        List<FeedPostResponse> posts,
        int currentPage,
        int totalPages,
        boolean hasNext
) {}
```

### 3.5 투어 북마크 — 프론트 view model (신규)

```js
// tourBookmarkApi.js에서 사용할 view model (백엔드 TourBookmarkResponse를 그대로 옮김)
{
  bookmarkId: string,
  contentId: string,
  contentTypeId: number,
  title: string,
  imageUrl: string | null,
  address: string | null,
  categoryName: string | null,
  categoryGroup: 'DESTINATION' | 'ENJOY',
  createdAt: string,       // 북마크한 시각(ISO) — 이미 서버가 이 기준으로 정렬해 내려준다
  detailPath: string,      // contentTypeId로 /destinations/detail 또는 /enjoy 경로를 조립(아래 §7.1)
}
```

---

## 4. API 명세

### 4.1 신규/변경 엔드포인트 요약

| 메서드 | 경로 | 설명 | 인증 | 변경 유형 |
|--------|------|------|------|-----------|
| GET | `/api/v1/feed/profile` | **변경** — 응답에 `introduce` 추가 | 필수 | 확장(하위 호환) |
| PATCH | `/api/v1/feed/profile` | **변경** — 멀티파트로 전환, 닉네임·소개·프로필이미지·@핸들 동시 수정 | 필수 | 확장(계약 변경) |
| POST | `/api/v1/auth/email-verification` | 기존 — 마이페이지가 최초로 실제 호출 | 필수(로그인 상태에서 본인 이메일로) | 재사용 |
| POST | `/api/v1/auth/email-verification/confirm` | 기존 — 동일 | 필수 | 재사용 |
| PUT | `/api/v1/auth/password` | 기존 — 동일 | 필수(티켓 제시) | 재사용 |
| DELETE | `/api/v1/users/me` | 신규 — 회원 탈퇴(비밀번호 재확인) | 필수 | 신규 |
| GET | `/api/v1/feed/bookmarks?page=&size=` | 신규 — 내 피드 북마크 목록(북마크 시각 내림차순) | 필수 | 신규 |
| GET | `/api/v1/tour-bookmarks?group=&page=&size=` | 기존 — 프론트 최초 연결 | 필수 | 재사용(변경 없음) |
| POST | `/api/v1/tour-bookmarks/toggle` | 기존 — 프론트 최초 연결 | 필수 | 재사용(변경 없음) |

### 4.2 회원 프로필 조회/수정 확장 (Q-2, Q-3, Q-4)

**컨트롤러 — PATCH를 멀티파트로 전환, `FeedController.create()`와 동일한 `@RequestPart` 패턴**

```java
// FeedProfileController.java
@PatchMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public ResponseEntity<FeedProfileResponse> updateMyProfile(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @Valid @RequestPart("profile") FeedProfileUpdateRequest request,
        @RequestPart(value = "profileImage", required = false) MultipartFile profileImage) {
    return ResponseEntity.ok(
        feedProfileService.updateMyProfile(extractRequiredEmail(authorization), request, profileImage)
    );
}
```

**서비스 — `updateMyHandle`을 대체. 닉네임·@핸들 둘 다 "값이 바뀐 경우만 중복확인"(Q-4)**

```java
// FeedProfileService.java
@Transactional
public FeedProfileResponse updateMyProfile(String loginEmail, FeedProfileUpdateRequest request, MultipartFile profileImage) {
    UserEntity user = findUser(loginEmail);
    FeedProfile profile = findOrCreateProfile(user);

    String normalizedNickname = request.nickname().trim();
    // Q-4: 값이 실제로 바뀐 경우에만 중복확인 — updateMyHandle의 feedHandle 처리와 동일한 원칙.
    if (!normalizedNickname.equals(user.getNickname()) && userRepository.existsByNickname(normalizedNickname)) {
        throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
    }

    String normalizedHandle = normalizeHandle(request.feedHandle());
    boolean isHandleChanged = !normalizedHandle.equals(profile.getFeedHandle());
    if (isHandleChanged && feedProfileRepository.existsByFeedHandle(normalizedHandle)) {
        throw new IllegalArgumentException("이미 사용 중인 피드 아이디입니다.");
    }

    user.updateProfile(normalizedNickname, request.introduce());
    profile.updateHandle(normalizedHandle);

    // Q-3: 이미지는 "저장" 시점에 텍스트 필드와 함께 한 번에 반영(피드 작성 폼과 동일한 멀티파트 패턴).
    if (profileImage != null && !profileImage.isEmpty()) {
        String previousImageKey = user.getProfileImageUrl();
        StorageService.StoredObject stored = storageService.upload(profileImage);
        user.updateProfileImage(stored.objectKey());

        // 기존 이미지가 S3 objectKey였던 경우에만 정리한다(완성된 http(s) URL이면 외부 리소스이므로 삭제하지 않음
        // — FeedProfileService.toReadableImageUrl이 이미 같은 구분을 쓰고 있다).
        if (previousImageKey != null && !previousImageKey.startsWith("http")) {
            storageService.delete(previousImageKey);
        }
    }

    return FeedProfileResponse.of(user, profile, 0, 0, List.of(), 1, 0, false);
}
```

**프론트 — `UserRepository`에 신규 메서드 불필요(`existsByNickname`은 이미 있음). 신규로 필요한 것은 `UserRepository`를 `FeedProfileService`에 주입하는 것뿐**(현재 `UserRepository`가 아니라 `userRepository` 필드로 이미 주입돼 있음, `getUserProfile`에서 쓰는 중이므로 추가 변경 없음).

```js
// feedApi.js — toFeedProfile에 introduce 추가, updateMyFeedProfile 함수 신규
function toFeedProfile(data) {
  // ...기존 필드...
  introduce: typeof data.introduce === 'string' ? data.introduce : '',
}

export async function fetchMyFeedProfile({ page = 1, size = 12 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  const data = await apiClient.get(`${FEED_PROFILE_PATH}?${params}`, { signal })
  return toFeedProfile(data)
}

export async function updateMyFeedProfile({ nickname, introduce, feedHandle, profileImageFile }) {
  const payload = { nickname, introduce: introduce || '', feedHandle }
  const formData = new FormData()
  formData.append('profile', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  if (profileImageFile) formData.append('profileImage', profileImageFile)

  const data = await apiClient.patch(FEED_PROFILE_PATH, formData)
  return toFeedProfile(data)
}
```

`apiClient.patch`는 이미 존재하고(`client.js`), `FormData` 바디도 피드 작성 폼에서 이미 검증된 경로라 `client.js` 변경이 필요 없다.

### 4.3 계정 설정 — 비밀번호 변경 (Q-1)

백엔드 변경 없음. 지금까지 실제로 호출된 적 없는 3단계 체인을 프론트에서 최초로 연결한다.

```js
// userApi.js (신규) — 기존 API 그대로, 신규 엔드포인트 없음
export function sendMyEmailCode(email) {
  return apiClient.post('/api/v1/auth/email-verification', { email })
}

export async function confirmMyEmailCode(email, authCode) {
  // { verificationToken } 반환 — changePassword에 그대로 전달
  return apiClient.post('/api/v1/auth/email-verification/confirm', { email, authCode })
}

export function changeMyPassword({ email, password, verificationToken }) {
  return apiClient.put('/api/v1/auth/password', { email, password, verificationToken })
}
```

```js
// usePasswordChangeFlow.js (신규) — 상태 머신: idle → code-sent → verified → done
// AuthContext의 member.email을 그대로 써서 "본인 이메일"만 인증하도록 고정한다
// (ForgotPasswordPage처럼 임의 이메일을 입력받지 않음 — 이미 로그인된 사용자이므로).
```

> **UX 트레이드오프(문서화, 추가 결정 불필요)**: 이미 로그인한 사용자인데도 이메일 인증을 다시 거쳐야 한다. "현재 비밀번호 확인"만으로 바로 바꾸는 더 간단한 플로우가 일반적이지만, 그러려면 신규 백엔드 엔드포인트가 필요하다. Q-1이 "포함"으로 결정됐을 뿐 플로우 방식까지 재논의 대상은 아니었으므로, **기존 백엔드를 그대로 재사용**하는 이 방식을 채택했다. 더 나은 UX가 필요해지면 후속 과제로 "현재 비밀번호 확인 방식" 엔드포인트를 추가하면 된다.

### 4.4 계정 설정 — 회원 탈퇴 (Q-1)

**엔티티/리포지토리는 §3.1, §3.3 참고. 체크포인트 3곳에 탈퇴 확인 추가**

```java
// AuthService.login() — 체크포인트 1, 기존 isSuspended() 분기 바로 위에 추가
if (dbUser.isWithdrawn()) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
    // 탈퇴 사실을 노출하지 않는다(정지와 달리 "탈퇴된 계정입니다" 같은 안내가 계정 존재 여부를
    // 추측하게 해줄 수 있어, 로그인 실패와 동일한 메시지로 응답한다).
}
```

```java
// AuthService.refreshToken() — 체크포인트 2, 기존 isSuspended() 분기 바로 아래 추가
if (user.get().isWithdrawn()) {
    log.debug("Refresh Token 재발급 실패: 탈퇴한 회원");
    return Optional.empty(); // 기존 "회원 없음"과 같은 401 분기를 그대로 탄다
}
```

```java
// JwtAuthenticationFilter.doFilterInternal() — 체크포인트 3, 기존 isSuspended() 분기 옆에 추가
if (user.isWithdrawn()) {
    throw new IllegalArgumentException("탈퇴한 계정입니다.");
}
```

**신규 컨트롤러/서비스**

```java
// UserWithdrawalRequest.java (신규)
public record UserWithdrawalRequest(
        @NotBlank(message = "비밀번호를 입력해주세요.")
        String password
) {}
```

```java
// UserController.java — 추가
@DeleteMapping("users/me")
public ResponseEntity<Void> withdraw(
        @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
        @Valid @RequestBody UserWithdrawalRequest request) {
    String email = extractRequiredEmail(authorization); // FeedProfileController와 동일한 패턴(§9 참고)
    ResponseCookie expiredCookie = service.withdraw(email, request.password());

    return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
            .build();
}
```

```java
// UserService.java — 추가(PasswordEncoder, AuthService 주입 필요)
@Transactional
public ResponseCookie withdraw(String email, String rawPassword) {
    UserEntity user = findUserInfo(email);

    if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
        throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
    }

    user.withdraw(LocalDateTime.now());
    // 리프레시 쿠키 즉시 만료 — AuthService.logout()이 이미 만드는 Max-Age=0 쿠키를 그대로 재사용.
    return authService.logout();
}
```

**프론트**

```js
// userApi.js — 추가
export function withdrawMyAccount(password) {
  return apiClient.delete('/api/v1/users/me', { body: { password }, credentials: 'include' })
}
```

> `client.js`에 `delete`가 바디를 지원하는지 구현 단계에서 확인 필요(현재 `patch`/`post`/`get`은 확인됨). 지원하지 않으면 `request(path, { method: 'DELETE', body, credentials: 'include' })` 형태로 직접 호출하도록 구현에서 조정한다(§8 남은 열린 사항).

### 4.5 피드 북마크 목록 (Q-5, Q-7)

**리포지토리 — 북마크 시각(`createdAt`) 내림차순, 원글이 소프트 삭제된 북마크는 제외**

```java
// FeedBookMarkRepository.java — 추가
@EntityGraph(attributePaths = {"feedPost", "feedPost.author"})
Page<FeedBookMark> findByUser_IdAndFeedPost_DeletedAtIsNullOrderByCreatedAtDesc(Long userId, Pageable pageable);
```

**서비스 — `FeedService`에 추가(좋아요 배치 조회는 `getFeed`의 기존 패턴을 그대로 재사용, 북마크는 이 목록 자체가 "북마크된 것"이므로 항상 true)**

```java
// FeedService.java — 추가
public FeedBookmarkPageResponse getMyBookmarks(String loginEmail, int page, int size) {
    UserEntity user = findUser(loginEmail);
    int pageIndex = Math.max(page - 1, 0);
    int pageSize = Math.min(Math.max(size, 1), 30);
    Pageable pageable = PageRequest.of(pageIndex, pageSize);

    Page<FeedBookMark> bookmarkPage = feedBookMarkRepository
            .findByUser_IdAndFeedPost_DeletedAtIsNullOrderByCreatedAtDesc(user.getId(), pageable);

    List<Long> postIds = bookmarkPage.getContent().stream()
            .map(bookmark -> bookmark.getFeedPost().getId()).toList();

    // 이 화면의 게시물은 전부 "내가 북마크한 것"이므로 bookmarked는 상수 true.
    // liked만 getFeed와 동일한 배치 조회 원칙으로 계산한다(N+1 방지).
    Set<Long> likedPostIds = new HashSet<>();
    if (!postIds.isEmpty()) {
        feedLikeRepository.findByUser_IdAndFeedPost_IdIn(user.getId(), postIds)
                .forEach(like -> likedPostIds.add(like.getFeedPost().getId()));
    }

    List<FeedPostResponse> posts = bookmarkPage.getContent().stream()
            .map(bookmark -> toResponse(bookmark.getFeedPost(), likedPostIds.contains(bookmark.getFeedPost().getId()), true))
            .toList();

    return new FeedBookmarkPageResponse(posts, bookmarkPage.getNumber() + 1, bookmarkPage.getTotalPages(), bookmarkPage.hasNext());
}
```

**컨트롤러 — 신규 `FeedBookmarkController`**(`FeedController`의 `/api/v1/feed/posts/{postId}` 패턴과 경로가 겹치지 않도록 별도 컨트롤러로 분리)

```java
// FeedBookmarkController.java (신규)
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feed/bookmarks")
public class FeedBookmarkController {
    private final FeedService feedService;
    private final JwtConfig jwtConfig;

    @GetMapping
    public ResponseEntity<FeedBookmarkPageResponse> getMyBookmarks(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(feedService.getMyBookmarks(extractRequiredEmail(authorization), page, size));
    }
    // extractRequiredEmail: FeedProfileController/TourBookmarkController와 동일한 패턴(§9 참고)
}
```

`SecurityConfig`에 별도 `permitAll` 규칙을 추가하지 않는다 — 인증 필요 API 기본값(= 토큰 없으면 401)을 그대로 따른다.

**프론트**

```js
// feedApi.js — 추가
export async function fetchFeedBookmarks({ page = 1, size = 12 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  const data = await apiClient.get(`/api/v1/feed/bookmarks?${params}`, { signal })
  if (!data || !Array.isArray(data.posts)) throw new Error('북마크 응답 형식이 올바르지 않습니다.')
  return {
    items: data.posts.map(toFeedPost).filter(Boolean),
    currentPage: Number.isInteger(data.currentPage) && data.currentPage > 0 ? data.currentPage : 1,
    totalPages: toNonNegativeInt(data.totalPages),
    hasNext: Boolean(data.hasNext),
  }
}
```

### 4.6 투어 북마크 연동 (Q-5, Q-6)

백엔드 변경 없음(§1.2.3 확인). `tourBookmarkApi.js`만 신규 작성한다.

```js
// tourBookmarkApi.js (신규)
import { apiClient } from './client'
import { getTourDetailPath } from './tourApi'

const TOUR_BOOKMARKS_PATH = '/api/v1/tour-bookmarks'

function toTourBookmark(item) {
  if (!item || item.bookmarkId == null || item.contentId == null) return null
  return {
    bookmarkId: String(item.bookmarkId),
    contentId: String(item.contentId),
    contentTypeId: item.contentTypeId,
    title: typeof item.title === 'string' ? item.title : '',
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : null,
    address: typeof item.address === 'string' ? item.address : null,
    categoryName: typeof item.categoryName === 'string' ? item.categoryName : null,
    categoryGroup: item.categoryGroup,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : null,
    detailPath: getTourDetailPath(item.contentId, item.contentTypeId),
  }
}

// group: 'DESTINATION' | 'ENJOY'
export async function fetchTourBookmarks(group, { page = 1, size = 9 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ group, page: String(page), size: String(size) })
  const data = await apiClient.get(`${TOUR_BOOKMARKS_PATH}?${params}`, { signal })
  return {
    items: (data.content ?? []).map(toTourBookmark).filter(Boolean),
    currentPage: page,
    totalPages: data.totalPages ?? 0,
    hasNext: !data.last,
  }
}

// 카드/상세 공통 — 서버가 toggle 결과로 { saved: boolean, bookmarkId } 형태를 돌려준다(TourBookmarkToggleResponse).
export async function toggleTourBookmark({ contentId, contentTypeId, title, imageUrl, address, categoryName }) {
  const data = await apiClient.post(`${TOUR_BOOKMARKS_PATH}/toggle`, {
    contentId: String(contentId), contentTypeId, title, imageUrl, address, categoryName,
  })
  return Boolean(data?.saved)
}
```

> `GET /api/v1/tour-bookmarks`는 Spring Data의 `Page<T>` 직렬화(`content`, `totalPages`, `last` 등)를 그대로 내려준다 — 다른 피드 API들의 커스텀 레코드 응답과 필드명이 다르므로 `tourBookmarkApi.js`가 이 차이를 전담해서 흡수한다(`feedApi.js`의 "백엔드 필드명 흡수" 원칙과 동일).

---

## 5. 마이페이지 화면 설계

### 5.1 레이아웃 — `FeedUserProfilePage` 재사용 방안

| `FeedUserProfilePage` 요소 | `MyPage`에서 |
|---|---|
| 아바타·닉네임·`@핸들`·통계(게시물 수/받은 좋아요) | 동일 구조 유지, 아바타 아래에 "프로필 수정" 버튼 추가 |
| 게시물 그리드 + offset 페이지네이션 | 동일(단, `PRIVATE` 글도 섞여서 내려오므로 카드에 비공개 배지 추가) |
| `useFeedUserProfile(userId, page)` | **재사용하지 않음** — `useMyFeedProfile(page)`로 신규 작성(인증 필요, PATCH 보유, `userId` 파라미터 없음) |
| 좋아요/북마크 토글 | 동일 패턴(`toggleFeedLike`/`toggleFeedBookmark` + 낙관적 업데이트) |

### 5.2 수정 모드

프로필 섹션은 "보기"/"수정" 두 모드를 토글하는 단일 컴포넌트로 구성한다(별도 라우트 분리 없음 — 마이페이지 하나로 충분히 단순함).

- 보기 모드: 닉네임·소개·프로필이미지·`@핸들`을 정적 텍스트로 표시
- 수정 모드: 각 필드를 입력 가능한 폼으로 전환, "저장"을 누르면 `updateMyFeedProfile` 한 번 호출(§4.2) — 성공 시 보기 모드로 복귀, 실패 시 폼 유지 + 에러 메시지
- 이미지 교체는 파일 선택 시 `URL.createObjectURL`로 미리보기만 교체하고, 실제 업로드는 "저장" 클릭 시 함께 전송(Q-3). 언마운트/취소 시 `revokeObjectURL` 호출

### 5.3 계정 설정 섹션

- **비밀번호 변경**: 이메일 인증 코드 발송 → 6자리 코드 입력 → 확인 → 새 비밀번호 입력 2회(확인용) → 제출. `usePasswordChangeFlow` 상태 머신으로 단계 전환 관리(§4.3)
- **회원 탈퇴**: "탈퇴하기" 버튼 → 확인 다이얼로그(비밀번호 입력 + "이 작업은 되돌릴 수 없습니다" 경고 문구 + 체크박스 동의) → 제출 성공 시 로컬 인증 상태 정리 후 홈으로 이동 + 안내 메시지

---

## 6. 북마크 화면 설계

### 6.1 탭 UI

```
/bookmarks
┌─────────────────────────────────┐
│ [피드]  [여행지]  [즐길거리]      │  role="tablist"
├─────────────────────────────────┤
│  (선택된 탭의 목록)                │
│  - 로딩 / 에러(재시도) / 빈 상태   │
│  - 카드마다 해제 버튼(Q-8)         │
└─────────────────────────────────┘
```

- "여행지" 탭 = `fetchTourBookmarks('DESTINATION', ...)`, "즐길거리" 탭 = `fetchTourBookmarks('ENJOY', ...)`, "피드" 탭 = `fetchFeedBookmarks(...)`
- 탭 전환 시 각 탭은 완전히 독립된 하위 컴포넌트(`FeedBookmarkTab`/`TourBookmarkTab`)로 마운트/언마운트되며 상태를 공유하지 않는다(Plan §7.2)
- 비어 있는 탭은 "아직 북마크한 ○○이 없습니다 + 둘러보러 가기 링크"로 안내(거짓 UI 금지 원칙과 대칭되는 빈 상태 안내 원칙)

### 6.2 해제(Q-8: 즉시 제거, Undo 없음)

```js
// 공통 패턴 — 피드/투어 탭 모두 동일한 모양으로 구현
async function handleRemoveBookmark(item) {
  const previousItems = items
  setItems(current => current.filter(i => i.bookmarkId !== item.bookmarkId)) // 낙관적 즉시 제거

  try {
    await toggleBookmark(item) // 피드: toggleFeedBookmark(postId) / 투어: toggleTourBookmark(item)
  } catch (error) {
    console.error('북마크 해제에 실패했습니다.', error)
    setItems(previousItems) // 실패 시 롤백(되돌리기 UI 없이 원래 목록으로 즉시 복원)
  }
}
```

피드 북마크 해제는 기존 `toggleFeedBookmark(postId)`를 그대로 쓴다(이미 토글 API라 "해제"도 같은 호출). 투어 북마크 해제도 `toggleTourBookmark`가 토글이므로 동일하게 동작한다.

---

## 7. 가짜 저장 버튼 교체 (Q-6)

### 7.1 공통 패턴

세 화면 모두 아래처럼 `useState` 로컬 토글을 제거하고 `tourBookmarkApi`로 교체한다.

```diff
- const [saved, setSaved] = useState(false)
+ const [saved, setSaved] = useState(false) // 초기값은 상세 조회 API가 내려주는 bookmarked 여부로 설정(아래 §7.2)

- <button className={saved ? 'active' : ''} onClick={() => setSaved(v => !v)}>
+ <button className={saved ? 'active' : ''} aria-pressed={saved} onClick={handleToggleSave}>

+ async function handleToggleSave() {
+   if (!member) return navigate('/login')
+   const previous = saved
+   setSaved(!previous) // 낙관적 업데이트
+   try {
+     const nextSaved = await toggleTourBookmark({
+       contentId: resolved.contentId,
+       contentTypeId: resolved.contentTypeId,
+       title: detail.title,
+       imageUrl: detail.image ?? null,
+       address: detail.address ?? null,
+       categoryName: detail.typeLabel ?? null,
+     })
+     setSaved(nextSaved)
+   } catch (error) {
+     console.error('북마크 처리에 실패했습니다.', error)
+     setSaved(previous)
+   }
+ }
```

### 7.2 초기 저장 여부 표시 — 알려진 한계

현재 `GET /api/v1/tour/contents/{contentId}`(상세 조회 API, `tourApi.js`)는 북마크 여부를 내려주지 않는다(애초에 북마크 기능 자체가 연동된 적이 없었으므로). 이번 사이클에서는:

- **상세 화면 진입 시 저장 버튼은 항상 "저장 안 됨" 상태로 시작**하고, 사용자가 누르면 그 세션에서는 정확히 토글된다(기존 로컬 전용 구현보다는 나아졌지만, 완전한 정합성은 아니다)
- 상세 조회 API에 `bookmarked` 필드를 추가하는 것은 백엔드 변경(`TourBookmarkRepository`에 단건 확인 메서드 추가 + 상세 조회 서비스 수정)이 필요해 이번 사이클 범위를 벗어난다 — **후속 과제로 명시**(§8)
- `EnjoyCategoryPage.jsx`(목록 화면)도 동일한 한계: 카드마다 개별 조회는 N+1이 되므로, 후속에서 `findByUser_IdAndContentIdIn` 같은 배치 조회 API가 추가로 필요하다

이 한계를 받아들이는 이유: 세 화면의 핵심 문제는 "저장이 전혀 안 된다"는 것이었고, 이번 교체로 그 문제는 해결된다. "새로고침해도 저장 여부가 보인다"는 추가 개선이지 거짓 UI 문제의 핵심은 아니므로, 범위를 분리해 이번 사이클을 완결 짓는다.

---

## 8. 라우팅

```jsx
// App.jsx — 교체
<Route path="/mypage" element={<MyPage />} />
<Route path="/bookmarks" element={<BookmarksPage />} />
```

두 라우트 모두 `Layout` 안(헤더·푸터 포함)에 위치해 기존 `/feed/users/:userId`와 같은 트리에 둔다. 비로그인 접근 시 처리는 기존 `FeedUserProfilePage`의 `login-required` 상태 패턴을 재사용한다(별도 `RequireAuth` 래퍼를 새로 만들지 않고, 각 화면이 자신의 훅에서 401을 구분해 처리).

---

## 9. 의존성 및 공통 관찰 사항

- `extractRequiredEmail(authorization)`이 이제 `FeedProfileController`, `TourBookmarkController`, `FeedBookmarkController`, `UserController`(탈퇴) **4곳에 동일한 코드로 중복**된다. 이번 사이클에서는 기존 컨벤션(컨트롤러별 private 메서드)을 그대로 따르고 통합하지 않는다 — 리스크 없는 개선이지만 이번 범위와 무관한 리팩토링이라 범위 폭주를 피하기 위해 손대지 않는다. **후속 "Nice to Have"로 기록**: 공통 `JwtAuthorizationExtractor` 유틸로 추출 가능
- `UserService`에 `PasswordEncoder`, `AuthService` 의존성 추가 필요(탈퇴 기능) — 순환 의존 주의(`AuthService`가 `UserService`를 참조하지 않는지 구현 단계에서 확인)
- `client.js`의 `delete`가 요청 바디를 지원하는지 구현 전 확인 필요(§4.4)

---

## 10. 회귀 방지 체크리스트 (구현 단계에서 확인)

- [ ] 기존 `FeedUserProfilePage`(타인 프로필)가 `introduce` 필드 추가 이후에도 정상 동작
- [ ] 기존 피드 타임라인/상세의 좋아요·북마크 토글에 변화 없음
- [ ] `check-nickname`/`check-email`(회원가입 화면)의 동작에 변화 없음
- [ ] `AdminUserListPage`/`AdminUserDetailPage`에서 탈퇴한 회원이 어떻게 보이는지 확인(크래시 없이 표시되는지만 — 관리자 화면 자체의 탈퇴 전용 UI는 이번 범위 아님)
- [ ] `TravelDetailPage`/`EnjoyDetailPage`의 기존 "공유" 버튼, 지도 영역 등 저장 버튼 외 나머지 기능에 변화 없음
- [ ] `EnjoyCategoryPage`의 카테고리 전환·페이지네이션 기존 동작 유지

---

## 11. 구현 순서

1. 백엔드: `UserEntity` 변경(withdrawnAt, updateProfile 등) + `FeedProfileResponse`/`FeedProfileUpdateRequest` 확장 (FR-01~03)
2. 백엔드: 탈퇴 체크포인트 3곳 + 탈퇴 API (FR-07~08)
3. 백엔드: 피드 북마크 목록 API (FR-10~11)
4. 프론트: `userApi.js`/`tourBookmarkApi.js` 신규, `feedApi.js` 확장
5. 프론트: 마이페이지(프로필 수정, 내가 쓴 글, 계정 설정) (FR-04~06, FR-09)
6. 프론트: 북마크 화면(탭, 해제) (FR-15~16)
7. 프론트: 가짜 저장 버튼 3곳 교체 (FR-14)
8. 프론트: 라우팅 교체 (FR-17)
9. 코드 리뷰 + gap 분석

---

## 12. 남은 열린 사항 (구현 전 참고, 블로킹 아님)

- `client.js`의 `delete`가 바디를 지원하는지(§9) — 구현 착수 시 바로 확인
- `UserService`/`AuthService` 간 의존 방향(순환 참조 여부) — 구현 착수 시 바로 확인
- 상세/목록 화면의 투어 북마크 초기 상태 표시(§7.2) — 후속 과제로 분리됨, 이번 사이클 블로킹 아님
- `extractRequiredEmail` 중복 제거(§9) — 후속 Nice to Have
- `FeedUserProfilePage`(타인 프로필)에 `introduce` 노출 여부/레이아웃 추가 — 이번 사이클에서는 데이터만 내려가고 화면 변경은 하지 않음, 필요 시 후속

---

## 13. 다음 단계

1. [x] Plan 문서 사용자 결정 반영
2. [x] 설계 문서 작성(이 문서)
3. [ ] 백엔드 구현 (frontend-support-backend)
4. [ ] 프론트 구현 (frontend-lead)
5. [ ] 코드 리뷰 (frontend-code-reviewer) + gap 분석
6. [ ] 완료 보고서 → 포트폴리오 추출 (frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-10-01 | 초안. Plan 문서 Q-1~Q-8 결정 반영한 API 명세·데이터 모델·화면 구조 설계. 설계 단계에서 `ForgotPasswordPage.jsx`가 정적 화면임을 추가 확인, 탈퇴 정책을 소프트 삭제(계정 비활성)로 확정하고 근거 명시 | WOOJIN |
