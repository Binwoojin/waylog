# tour-course-feed-linking 설계 문서

> **요약**: `admin-dashboard`가 2개 사이클 전(§8)에 유보한 여행코스 ↔ 피드 연동을 설계한다. 계획 문서 Q-1 결정에 따라 게시물은 **코스 전체가 아니라 코스의 특정 일자(필수)·특정 경유지(선택)**를 가리킨다 — `FeedPost`에 `linkedCourseId`/`linkedCourseDayId`/`linkedCourseStopId`(전부 nullable FK, 단순 컬럼) + 스냅샷 컬럼(코스명/일자 번호/경유지명)을 추가하고, 세 FK 모두 `ON DELETE SET NULL`로 걸어 코스 관리자가 구조를 바꾸거나 코스를 지워도 피드 게시물이 깨지지 않게 한다. 코스 상세에는 참조 피드 목록을, 관리자 피드 상세에는 참조 정보를 표시한다. 신규 엔드포인트 대신 기존 피드 타임라인 API에 선택적 필터 파라미터를 추가해 모듈 결합을 최소화한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-10-01
> **상태**: Draft (계획 8장 Q-1 ~ Q-4 사용자 결정 반영 완료, 구현 전)
> **버전**: 0.1
> **계획 문서**: `docs/01-plan/features/tour-course-feed-linking.plan.md` (FR-01 ~ FR-08, 사용자 결정 Q-1 ~ Q-4)
> **선행 기능**: `docs/02-design/features/admin-dashboard.design.md` §8(유보 근거), `docs/02-design/features/tour-course-list-integration.design.md`(코스 공개 API·`courseApi.js` 출처), `docs/02-design/features/feed-integration.design.md`(피드 타임라인·작성 출처), `docs/02-design/features/feed-comment-integration.design.md`(SecurityConfig 와일드카드 선례)

---

## Context Anchor

> 계획 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | `admin-dashboard.design.md` §8이 명시적으로 유보한 연동을, 두 기능이 각각 완성된 지금 시점에 실제로 설계할 차례가 됐다 |
| **WHO** | 여행코스를 보고 실제로 여행을 떠난 뒤 후기를 남기고 싶은 사용자 / 코스 상세에서 "진짜 이 코스로 여행한 사람이 있는지" 확인하고 싶은 사용자 / 신고된 게시물이 어느 코스를 가리키는지 확인하려는 관리자 |
| **RISK** | 코스 관리자가 구조를 바꾸거나(일자·경유지 삭제) 코스 자체를 삭제할 때, 그걸 참조하는 피드 게시물이 있으면 기본 FK 제약이 그 삭제를 막아 **코스 관리 기능에 500 오류**를 일으킬 수 있음(§5) |
| **SUCCESS** | 사용자가 게시물 작성 시 코스의 일자·경유지를 태그할 수 있다 / 코스 상세에서 참조 피드 목록을 볼 수 있다 / 코스 구조 변경·삭제가 피드에 영향을 주지 않는다 / 관리자가 `AdminFeedDetailPage`에서 참조 정보를 확인할 수 있다 |
| **SCOPE** | 백엔드: `FeedPost` 참조 컬럼 6개, `FeedCreateRequest`/`FeedPostResponse`/`FeedAdminPostResponse` 확장, `FeedController`/`FeedService` 필터 확장, 리포지토리 2개 신규 / 프론트: `CourseReferencePicker.jsx` 신규, `FeedComposer.jsx`/`TourCourseDetailPage.jsx`/`AdminFeedDetailPage.jsx` 수정 |

---

## 계획 대비 변경 (사용자 결정 반영, 2026-10-01)

계획 문서 8장의 Q-1 ~ Q-4는 모두 결정됐다. 설계 단계에서 그 결정을 구체적인 구조로 바꾼 지점을 정리한다.

| # | 항목 | 계획의 결정 | 설계에서 구체화한 내용 |
|---|------|-------------|------------------------|
| D-1 | 참조 레벨 (Q-1) | "코스 전체가 아니라 특정 일자 또는 특정 경유지" | **2단 nullable 참조**로 구체화: `linkedCourseDayId`가 설정되면(필수 최소 단위) `linkedCourseId`도 항상 함께 채워지고(일자→코스 체인에서 서버가 직접 파생), `linkedCourseStopId`는 그 일자 소속일 때만 추가로 설정 가능하다. "코스 id만 있고 일자가 없는" 상태는 서비스 계층이 거부한다(§3.2) |
| D-2 | 클라이언트 요청 모양 (Q-1 부가 결정) | (계획에는 없음, 설계에서 새로 결정) | 클라이언트는 `linkedCourseDayId`/`linkedCourseStopId` **둘만** 보낸다. `linkedCourseId`와 스냅샷(코스명/일자 번호/경유지명)은 서버가 일자→코스 체인을 직접 조회해 채운다 — 클라이언트가 불일치하는 조합(예: 서로 다른 코스의 day/stop id)을 보낼 가능성 자체가 없다(§3.2, §4.2) |
| D-3 | 참조 무결성 (Q-1이 낳은 신규 리스크) | (계획 §5 위험표에서 "신규"로 식별만 해 둠) | 세 FK 컬럼 모두 `ON DELETE SET NULL`로 설계한다. 코스/일자/경유지가 삭제돼도 피드 게시물은 그대로 남고 참조 id만 `NULL`이 된다. 스냅샷 텍스트는 FK와 무관하게 남아 "참조했던 코스가 이후 삭제/변경됨"을 보여줄 수 있다(§5) |
| D-4 | 코스 참조 피드 목록 API (Q-2) | "노출함" | 신규 엔드포인트(`GET /api/v1/courses/{id}/feed-posts`)를 만들지 않고, 기존 `GET /api/v1/feed/posts`에 `linkedCourseId` 선택 쿼리 파라미터를 추가한다 — tourcourse 모듈이 feed 모듈에 의존하는 역방향 결합을 피하고, 이미 검증된 커서 페이지네이션 인프라를 그대로 재사용한다(§4.3) |
| D-5 | 코스/일자/경유지 선택 UI (Q-1 부가) | (계획 §7.1에서 "B안 확정"까지만 결정) | `CourseReferencePicker.jsx`를 2단계 모달(코스 검색 목록 → 코스 상세 트리에서 일자/경유지 선택)로 구체화한다. `TourReferencePicker.jsx`는 한 줄도 수정하지 않는다(§6) |
| D-6 | 어드민 화면 반영 (Q-3) | "`AdminFeedDetailPage`에 필드만 추가" | `FeedAdminPostResponse`에 `linkedCourse` 중첩 객체를 추가하고, 화면에는 읽기 전용 텍스트 한 줄("OO코스 · 2일차 · 전망대")로 표시한다. 별도 링크·네비게이션은 만들지 않는다(어차피 관리자 코스 상세 화면이 없음, §7.2) |
| D-7 | 기존 게시물 처리 (Q-4) | "별도 처리 없음" | 마이그레이션 SQL은 `ALTER TABLE ... ADD COLUMN ... NULL`만 포함하고 데이터 이관 구문은 없다(§10) |

---

## 1. 개요

### 1.1 설계 목표

- 게시물이 "코스를 다녀왔다"가 아니라 "그 코스의 2일차를, 혹은 2일차의 OO 전망대를 다녀왔다"처럼 구체적으로 참조할 수 있게 한다(Q-1).
- 코스 관리자가 평소처럼 코스 구조를 수정·삭제해도(이미 완성된 `TourCourseAdminService`의 동작은 전혀 바꾸지 않는다) 피드 쪽에서 참조 무결성 오류가 나지 않게 한다.
- 신규 엔드포인트·신규 모듈 의존을 최소화한다 — 기존 피드 타임라인 API, 기존 코스 공개 API, 기존 `AdminFeedDetailPage`를 확장하는 선에서 끝낸다.
- `FeedPost`의 기존 TourAPI 위치 태깅(`tourContentId` 등)과 이번에 추가하는 코스 참조는 서로 다른 목적의 완전히 독립된 필드로 설계해, 한 게시물이 둘 다 가질 수도, 하나만 가질 수도, 둘 다 없을 수도 있게 한다.

### 1.2 설계 원칙

- **체인은 서버가 책임진다**: 클라이언트는 "어느 일자, 어느 경유지"만 말하고, "그 일자가 어느 코스 소속인지"는 서버가 엔티티 관계를 따라가 직접 채운다(D-2). 클라이언트가 courseId까지 직접 보내게 하면 courseId와 dayId가 서로 다른 코스를 가리키는 모순된 요청을 서버가 추가로 검증해야 한다 — 애초에 그런 요청을 만들 수 없는 API 모양을 택한다.
- **스냅샷 우선, 조인 지양**: `FeedPost.tourContentId`(TourAPI 참조)가 이미 "name/address를 스냅샷으로 저장해 매번 외부 API를 부르지 않는다"는 패턴을 쓰고 있고, `TourCourseStop.tourContentId`도 같은 패턴을 쓴다(코드 주석에 "FeedPost.tourContentId와 동일한 패턴"이라고 명시). 이번 참조도 동일하게 코스명·일자 번호·경유지명을 스냅샷으로 저장해, 피드 목록을 읽을 때마다 `TourCourse`를 조인하지 않는다.
- **참조가 깨져도 게시물은 안전해야 한다**: 코스·일자·경유지는 피드와 무관하게 관리자가 자유롭게 수정·삭제할 수 있는 리소스다. 피드 게시물이 그 삭제를 막아서는 안 된다(`ON DELETE SET NULL`, §5).
- **모듈 결합 최소화**: tourcourse 모듈은 feed 모듈을 전혀 모른다(기존과 동일하게 유지). feed 모듈만 "일자/경유지 id가 유효한지" 확인하기 위해 tourcourse 모듈의 리포지토리를 읽기 전용으로 참조한다(단방향 의존, §2).
- **이미 검증된 코드는 건드리지 않는다**: `TourReferencePicker.jsx`, `TourCourseAdminService.java`, 피드 좋아요·북마크·댓글 로직은 수정하지 않는다.

---

## 2. 아키텍처

### 2.1 모듈 경계

```
tourcourse 모듈                          feed 모듈
┌─────────────────────┐                 ┌──────────────────────────┐
│ TourCourse            │                 │ FeedPost                   │
│ TourCourseDay         │  <--- 읽기 전용 참조 ---  │  linkedCourseId            │
│ TourCourseStop        │       (검증·스냅샷용)     │  linkedCourseDayId         │
│                       │                 │  linkedCourseStopId        │
│ (피드를 전혀 모름,     │                 │  linkedCourseTitle 등 스냅샷│
│  설계 §8 그대로 유지) │                 │                           │
└─────────────────────┘                 └──────────────────────────┘
        ▲                                           │
        │ ON DELETE SET NULL (DB가 자동 처리)        │
        └───────────────────────────────────────────┘
```

- 의존 방향은 **feed → tourcourse 단방향**이다. `FeedService`가 작성 시 검증을 위해 `TourCourseDayRepository`/`TourCourseStopRepository`(신규, 읽기 전용)를 참조하지만, tourcourse 패키지의 어떤 클래스도 feed 패키지를 참조하지 않는다 — admin-dashboard 설계 §8이 "코스 쪽은 자신을 참조하는 존재를 몰라도 되는 단방향 관계"라고 전제했던 것을 그대로 지킨다.
- DB 레벨의 `ON DELETE SET NULL`은 애플리케이션 코드 없이 코스 쪽 삭제가 피드 쪽 참조를 자동으로 정리하게 한다(§5). 즉 "코스가 삭제됐다"는 사실이 feed 모듈에 이벤트로 전파되는 게 아니라, DB 제약이 알아서 처리한다 — 가장 약한 결합.

### 2.2 데이터 흐름 (게시물 작성 시)

```
FeedComposer (dayId, stopId? 선택)
   → POST /api/v1/feed/posts { ..., linkedCourseDayId, linkedCourseStopId }
     → FeedService.create()
        → CourseLinkResolver.resolve(dayId, stopId)   // 신규
           → TourCourseDayRepository.findById(dayId)      // 체인 1단계: day → course
           → (stopId 있으면) TourCourseStopRepository.findById(stopId)로 소속 검증
           → CourseLinkSnapshot(courseId, courseTitle, dayId, dayNumber, stopId, stopName) 반환
        → FeedPost 생성자 호출 후 post.linkCourse(snapshot)
        → feedPostRepository.save(post)
```

### 2.3 데이터 흐름 (코스 상세의 참조 피드 목록)

```
TourCourseDetailPage
   → useCourseFeedPosts(courseId)
      → fetchFeedTimeline({ linkedCourseId: courseId, cursor, size })  // 기존 함수 확장
         → GET /api/v1/feed/posts?linkedCourseId={courseId}&cursor=&size=
            → FeedService.getFeed(..., linkedCourseId)
               → linkedCourseId가 있으면 FeedPostRepository의 "linked 전용" 커서 쿼리 사용
               → 없으면 기존 전체 타임라인 쿼리 사용(분기, 기존 동작 100% 보존)
```

---

## 3. 데이터 모델

### 3.1 `FeedPost` 신규 컬럼

```java
// feed/domain/FeedPost.java — 기존 필드(tourContentId 등) 바로 아래 병렬 추가

/*
 * 여행코스 참조(tour-course-feed-linking 설계 §3). TourAPI 참조(tourContentId)와
 * 완전히 독립된 필드다 — 한 게시물이 TourAPI 위치와 코스 참조를 모두 가질 수도,
 * 하나만 가질 수도, 둘 다 없을 수도 있다.
 *
 * "코스 전체만" 가리키는 상태는 허용하지 않는다(설계 §3.2) — linkedCourseDayId가
 * null이 아니면 linkedCourseId도 항상 함께 채워진다(서버가 일자→코스 체인으로 직접
 * 채우므로 둘이 따로 노는 상태 자체가 만들어지지 않는다). linkedCourseStopId는
 * linkedCourseDayId가 있을 때만 추가로 설정될 수 있다.
 *
 * ON DELETE SET NULL(DB 레벨, 마이그레이션 §10)로 코스/일자/경유지가 삭제되면 이
 * 세 id는 자동으로 null이 된다. 스냅샷 컬럼(제목/일자 번호/경유지명)은 FK가 아니라
 * 일반 컬럼이라 삭제의 영향을 받지 않고 그대로 남는다 — "참조했던 코스가 이후
 * 삭제/변경됨"을 사용자에게 보여줄 수 있는 근거가 된다(TourCourseStop.tourContentId가
 * REFERENCE 대상이 바뀌어도 name/address 스냅샷은 그대로 남기는 것과 같은 패턴).
 */
@Column(name = "linked_course_id")
private Long linkedCourseId;

@Column(name = "linked_course_title", length = 200)
private String linkedCourseTitle;

@Column(name = "linked_course_day_id")
private Long linkedCourseDayId;

@Column(name = "linked_course_day_number")
private Integer linkedCourseDayNumber;

@Column(name = "linked_course_stop_id")
private Long linkedCourseStopId;

@Column(name = "linked_course_stop_name", length = 150)
private String linkedCourseStopName;
```

```java
// FeedPost에 추가하는 메서드 — replaceTags/replacePhotos와 같은 레벨의 post-construction mutator.
// 생성자(이미 9개 매개변수)에 더 얹지 않고, replaceTags처럼 생성 직후 별도 호출로 분리한다.

public void linkCourse(Long courseId, String courseTitle, Long dayId, Integer dayNumber, Long stopId, String stopName) {
    this.linkedCourseId = courseId;
    this.linkedCourseTitle = courseTitle;
    this.linkedCourseDayId = dayId;
    this.linkedCourseDayNumber = dayNumber;
    this.linkedCourseStopId = stopId;
    this.linkedCourseStopName = stopName;
}

public boolean hasCourseLink() {
    return linkedCourseDayId != null;
}
```

**왜 `@ManyToOne` 연관관계가 아니라 단순 `@Column`인가**: `FeedPost.tourContentId`(TourAPI 참조)도 이미 같은 방식(연관관계가 아닌 단순 식별자 컬럼)을 쓰고 있어 프로젝트 관례와 일치한다. 더 중요하게는, JPA `@ManyToOne`으로 연결하면 Hibernate가 `TourCourseDay` 엔티티를 프록시로 로딩하려 시도하면서 feed 모듈 코드에 tourcourse 모듈의 엔티티 클래스를 import해야 한다(모듈 결합 증가). 단순 `Long` 컬럼이면 feed 모듈은 tourcourse의 **엔티티 클래스를 몰라도** 되고, 검증이 필요한 시점(작성 시)에만 리포지토리로 잠깐 조회한다.

### 3.2 참조 상태와 검증 규칙

세 가지 유효한 상태만 허용한다(서비스 계층 검증, `FeedService.create`):

| 상태 | `linkedCourseDayId` | `linkedCourseStopId` | 의미 |
|------|----------------------|------------------------|------|
| 미태그 | `null` | `null` | 코스 참조 없음(기존 게시물 전부 이 상태, Q-4) |
| 일자 단위 | 설정됨 | `null` | "이 코스의 N일차"까지만 참조 |
| 경유지 단위 | 설정됨 | 설정됨, 그 일자 소속이어야 함 | "이 코스 N일차의 OO"까지 참조 |

**허용하지 않는 상태**: `linkedCourseDayId == null && linkedCourseStopId != null`(일자 없이 경유지만) — 요청 자체를 거부한다(`IllegalArgumentException`, 400). 이 조합은 Q-1 결정("코스 전체만"은 허용하지 않되, 반대로 "일자 없이 경유지만"도 데이터 모델상 모순이므로 함께 막는다)에 따른 자연스러운 귀결이다.

```java
// feed/service/CourseLinkResolver.java (신규, feed 패키지 소속 — tourcourse를 읽기 전용으로만 참조)

@Component
@RequiredArgsConstructor
class CourseLinkResolver {

    private final TourCourseDayRepository tourCourseDayRepository;
    private final TourCourseStopRepository tourCourseStopRepository;

    /**
     * dayId/stopId를 받아 코스 체인을 검증하고 스냅샷을 만든다.
     * 둘 다 null이면 "미태그" 스냅샷(전부 null)을 반환한다.
     */
    CourseLinkSnapshot resolve(Long dayId, Long stopId) {
        if (dayId == null && stopId == null) {
            return CourseLinkSnapshot.empty();
        }

        if (dayId == null) {
            // 일자 없이 경유지만 지정 — 허용하지 않는 상태(설계 §3.2).
            throw new IllegalArgumentException("여행코스를 태그하려면 일자를 함께 선택해야 합니다.");
        }

        TourCourseDay day = tourCourseDayRepository.findById(dayId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 여행코스 일자입니다."));
        TourCourse course = day.getCourse();

        if (stopId == null) {
            return new CourseLinkSnapshot(course.getId(), course.getTitle(), day.getId(), day.getDayNumber(), null, null);
        }

        TourCourseStop stop = tourCourseStopRepository.findById(stopId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 여행코스 경유지입니다."));

        if (!stop.getDay().getId().equals(day.getId())) {
            throw new IllegalArgumentException("선택한 경유지가 해당 일자 소속이 아닙니다.");
        }

        return new CourseLinkSnapshot(course.getId(), course.getTitle(), day.getId(), day.getDayNumber(), stop.getId(), stop.getName());
    }

    record CourseLinkSnapshot(Long courseId, String courseTitle, Long dayId, Integer dayNumber, Long stopId, String stopName) {
        static CourseLinkSnapshot empty() {
            return new CourseLinkSnapshot(null, null, null, null, null, null);
        }
    }
}
```

`TourCourseDayRepository`/`TourCourseStopRepository`는 각각 `JpaRepository<TourCourseDay, Long>`/`JpaRepository<TourCourseStop, Long>`만 상속하는 최소 인터페이스로 신규 추가한다(둘 다 이미 `@Entity`라 Spring Data가 바로 인식한다). tourcourse 모듈 자체는 지금도 이 엔티티들을 집합체(`TourCourse`) 내부 컬렉션으로만 다루지만, 이 리포지토리는 feed 모듈의 검증 전용으로 추가하는 것이라 tourcourse의 기존 저장/조회 흐름(`TourCourseRepository`를 통한 집합체 단위 접근)에는 전혀 영향이 없다.

---

## 4. API 명세

### 4.1 `FeedCreateRequest` 확장

```java
public record FeedCreateRequest(
        @NotBlank @Size(max = 2000) String content,
        @Size(max = 150) String locationName,
        @Size(max = 255) String address,
        BigDecimal latitude,
        BigDecimal longitude,
        String tourContentId,
        Integer tourContentTypeId,

        // 신규 — 여행코스 참조(§3.2). 클라이언트는 이 둘만 보낸다.
        Long linkedCourseDayId,
        Long linkedCourseStopId,

        String visibility,
        @Size(max = 10) List<String> tags,
        @Size(max = 5) List<String> imageUrls
) {
}
```

### 4.2 `FeedService.create` 변경

```java
// FeedPost 생성 직후 추가(기존 post.replaceTags(...) 바로 앞 또는 뒤, 순서 무관)

CourseLinkResolver.CourseLinkSnapshot snapshot =
        courseLinkResolver.resolve(request.linkedCourseDayId(), request.linkedCourseStopId());

post.linkCourse(
        snapshot.courseId(), snapshot.courseTitle(),
        snapshot.dayId(), snapshot.dayNumber(),
        snapshot.stopId(), snapshot.stopName()
);
```

기존 생성자 호출(`new FeedPost(author, content, locationName, ..., visibility)`)은 전혀 변경하지 않는다 — 코스 참조는 생성자 밖에서 별도로 붙는다(§3.1에서 설명한 "replaceTags와 같은 레벨" 원칙).

### 4.3 `FeedPostResponse` 확장 — `linkedCourse` 중첩 객체

```java
public record FeedPostResponse(
        Long id,
        AuthorResponse author,
        String content,
        String location,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        String tourContentId,
        Integer tourContetTypeId,
        LinkedCourseResponse linkedCourse,   // 신규, null이면 코스 미태그
        List<String> images,
        List<String> tags,
        long likeCount,
        long commentCount,
        boolean liked,
        boolean bookmarked,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record LinkedCourseResponse(
            Long courseId, String courseTitle,
            Long dayId, Integer dayNumber,
            Long stopId, String stopName
    ) {
        static LinkedCourseResponse from(FeedPost post) {
            if (!post.hasCourseLink()) return null;
            return new LinkedCourseResponse(
                    post.getLinkedCourseId(), post.getLinkedCourseTitle(),
                    post.getLinkedCourseDayId(), post.getLinkedCourseDayNumber(),
                    post.getLinkedCourseStopId(), post.getLinkedCourseStopName()
            );
        }
    }

    public static FeedPostResponse from(FeedPost post, boolean liked, boolean bookmarked, Function<String, String> imageUrlResolver) {
        return new FeedPostResponse(
                post.getId(), /* ...기존 필드... */
                LinkedCourseResponse.from(post),
                /* ...나머지 기존 필드... */
        );
    }
}
```

스냅샷 컬럼을 그대로 읽어서 만드므로 `TourCourse`를 조인하지 않는다 — 피드 타임라인·상세 조회 성능에 영향이 없다(1.2절 "스냅샷 우선" 원칙).

### 4.4 코스 참조 피드 목록 — 기존 엔드포인트 확장(D-4)

```java
// FeedController.java

@GetMapping
public ResponseEntity<FeedTimelineResponse> getFeed(
        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
        @RequestParam(required = false) Long cursor,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(required = false) Long linkedCourseId   // 신규
) {
    String email = extractOptionalEmail(authorization);
    return ResponseEntity.ok(feedService.getFeed(email, cursor, size, linkedCourseId));
}
```

```java
// FeedService.java — getFeed에 linkedCourseId 매개변수 추가, 분기만 추가(기존 로직 변경 없음)

public FeedTimelineResponse getFeed(String loginEmail, Long cursor, int size, Long linkedCourseId) {
    int pageSize = Math.min(Math.max(size, 1), 30);
    Pageable pageable = PageRequest.of(0, pageSize + 1);

    List<FeedPost> fetched;
    if (linkedCourseId != null) {
        fetched = (cursor == null)
                ? feedPostRepository.findByLinkedCourseIdAndVisibilityAndDeletedAtIsNullOrderByIdDesc(linkedCourseId, "PUBLIC", pageable)
                : feedPostRepository.findByLinkedCourseIdAndVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc(linkedCourseId, "PUBLIC", cursor, pageable);
    } else {
        fetched = (cursor == null)
                ? feedPostRepository.findByVisibilityAndDeletedAtIsNullOrderByIdDesc("PUBLIC", pageable)
                : feedPostRepository.findByVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc("PUBLIC", cursor, pageable);
    }

    // ...이하 liked/bookmarked 조회, toResponse 매핑, nextCursor 계산은 기존과 완전히 동일...
}
```

`linkedCourseId`가 `null`일 때의 분기는 **기존 쿼리·기존 동작을 한 글자도 바꾸지 않는다** — 기존 피드 타임라인(메인 피드)에는 회귀 위험이 없다.

```java
// FeedPostRepository.java — 기존 메서드 패턴 그대로 2개 추가

@EntityGraph(attributePaths = "author")
List<FeedPost> findByLinkedCourseIdAndVisibilityAndDeletedAtIsNullOrderByIdDesc(Long linkedCourseId, String visibility, Pageable pageable);

@EntityGraph(attributePaths = "author")
List<FeedPost> findByLinkedCourseIdAndVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc(Long linkedCourseId, String visibility, Long cursorId, Pageable pageable);
```

**권한**: `GET /api/v1/feed/posts`는 이미 `SecurityConfig`에서 `permitAll`이다(쿼리 파라미터는 매처 대상이 아니므로 `linkedCourseId` 추가가 보안 설정에 영향을 주지 않는다) — **SecurityConfig 변경이 전혀 필요 없다.**

### 4.5 `FeedAdminPostResponse` 확장 (Q-3 / D-6)

```java
public record FeedAdminPostResponse(
        Long id, Long authorId, String authorNickname, String content,
        String locationName, String address, BigDecimal latitude, BigDecimal longitude,
        FeedPostResponse.LinkedCourseResponse linkedCourse,   // 신규, 공개 응답과 같은 타입 재사용
        List<String> images, List<String> tags,
        long likeCount, long commentCount,
        String status, LocalDateTime deletedAt, String deleteReason,
        LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static FeedAdminPostResponse from(FeedPost post, Function<String, String> imageUrlResolver) {
        return new FeedAdminPostResponse(
                post.getId(), /* ...기존 필드... */,
                FeedPostResponse.LinkedCourseResponse.from(post),
                /* ...나머지 기존 필드... */
        );
    }
}
```

`FeedPostResponse.LinkedCourseResponse`를 그대로 재사용한다(공개 응답과 관리자 응답이 같은 모양의 코스 참조 정보를 필요로 하므로 별도 타입을 만들지 않는다).

---

## 5. 참조 무결성 설계 (코스 쪽 구조 변경·삭제에 안전한가)

### 5.1 왜 이 설계가 필요한가 (재조사 근거)

`TourCourseAdminService.java` 재확인 결과, 코스 관리자가 다음 두 작업을 할 때 **DB 레벨에서 직접 DELETE**가 발생한다.

| 관리자 작업 | 내부 동작 | 영향받는 테이블 |
|-------------|-----------|------------------|
| `delete(courseId)` — 코스 전체 삭제 | `courseRepository.delete(course)` → JPA cascade(`CascadeType.ALL`, `orphanRemoval=true`)로 하위 전부 하드 삭제 | `tour_course`, `tour_course_day`, `tour_course_stop`, `tour_course_stop_image` |
| `update(courseId, request)` — 구조 교체 중 `pruneUnreferenced` | 요청에 다시 나타나지 않는 기존 일자·경유지를 `flush` 시점에 직접 DELETE | `tour_course_day`, `tour_course_stop`(해당 이미지 포함) |

기존 마이그레이션(`2026-09-30-admin-dashboard.sql`)이 만든 FK(`fk_tour_course_day_course`, `fk_tour_course_stop_day` 등)는 **`ON DELETE` 절이 없다** — MySQL/InnoDB 기본값은 `RESTRICT`다. 만약 `feed_post.linked_course_day_id`가 아무 조치 없이 `tour_course_day`를 참조한다면, 그 일자를 참조하는 피드 게시물이 하나라도 있는 상태에서 관리자가 그 일자를 지우려 하면 **DB가 DELETE 자체를 거부**한다 — `TourCourseAdminService.update()`는 `DataIntegrityViolationException`으로 실패하고, 관리자 입장에서는 "코스 수정이 원인 불명으로 실패한다"는 혼란스러운 장애가 된다. 코스 삭제(`delete()`)도 마찬가지다.

### 5.2 해결책 — `ON DELETE SET NULL`

세 FK(`linked_course_id`, `linked_course_day_id`, `linked_course_stop_id`) 전부 `ON DELETE SET NULL`로 선언한다(마이그레이션 SQL, §10). 효과:

- 경유지 하나만 삭제되면 → 그 경유지를 참조하던 게시물은 `linked_course_stop_id`만 `NULL`이 되고, `linked_course_id`/`linked_course_day_id`는 그대로 남는다(여전히 "그 코스 N일차"로는 유효하게 보인다). 스냅샷 컬럼(`linkedCourseStopName` 등)은 FK가 아니므로 건드려지지 않는다.
- 일자 전체가 삭제되면 → 그 일자 소속 경유지도 함께 cascade 삭제되므로, `linked_course_day_id`와 `linked_course_stop_id`가 **각각 독립적으로** `NULL`이 된다(두 FK가 참조하는 테이블이 다르므로 MySQL이 각 FK마다 별도로 처리). 결과적으로 게시물은 `linked_course_id`만 남아 "그 코스(일자 미상)"로 표시되거나, 프론트에서 "참조했던 일자가 삭제됨"으로 안내한다(§6.4).
- 코스 전체가 삭제되면 → day/stop이 cascade로 전부 삭제되며 세 FK가 모두 `NULL`이 된다. 게시물은 완전히 "코스 미태그" 상태로 돌아가되, 스냅샷 텍스트(코스명 등)는 남아 "예전에 OO코스를 참조했었음"을 보여줄 수 있다.
- 어느 경우든 **관리자의 코스 CRUD 자체는 추가 코드 없이, 에러 없이 그대로 동작한다** — `TourCourseAdminService.java`는 이번 기능을 위해 단 한 줄도 수정하지 않는다.

### 5.3 "스냅샷은 남는데 id는 null"인 상태를 프론트가 어떻게 보여줄 것인가

`FeedPostResponse.linkedCourse`는 id와 스냅샷 텍스트를 함께 내려준다. 프론트(`feedApi.js`의 `toFeedPost`)는 다음 규칙으로 view model을 만든다.

```js
// feedApi.js에 추가할 변환 로직(의사 코드)
courseTag: item.linkedCourse ? {
  courseId: item.linkedCourse.courseId,       // null일 수 있음(코스 자체가 삭제된 경우)
  courseTitle: item.linkedCourse.courseTitle, // 스냅샷, 항상 있음(태그가 있었다면)
  dayNumber: item.linkedCourse.dayNumber,     // null일 수 있음(일자가 삭제된 경우)
  stopName: item.linkedCourse.stopName,       // null일 수 있음(경유지가 삭제됐거나 애초에 일자 단위 참조)
} : null,
```

UI 표시 규칙: `courseId`가 있으면(아직 유효한 코스) 클릭 가능한 링크로, 없으면(코스 자체가 삭제됨) 링크 없이 흐리게 텍스트만("OO코스 · (삭제된 일정)") 표시한다 — 거짓 UI 금지 원칙(없는 링크를 누를 수 있는 것처럼 보여주지 않는다).

---

## 6. 프론트엔드 설계 — 피드 작성의 코스/일자/경유지 선택

### 6.1 `CourseReferencePicker.jsx` (신규)

2단계 모달. `TourReferencePicker.jsx`를 참고하되 완전히 독립된 파일로 작성한다(D-5).

```
1단계: 코스 검색
  - courseApi.fetchCourseList(keyword)로 검색(기존 함수 그대로 재사용)
  - AdminPagination 재사용(기존 TourReferencePicker와 동일 패턴)
  - 코스 카드 클릭 → 2단계로 전환

2단계: 일자 · 경유지 선택
  - courseApi.fetchCourseDetail(courseId)로 선택한 코스의 전체 구조 조회(기존 함수 재사용)
  - 일자별 탭 또는 아코디언으로 day 목록 렌더링
  - 각 일자 헤더에 "이 일자로 태그" 버튼(day만 선택, stop은 null)
  - 각 일자 안의 경유지 목록에 "이 경유지로 태그" 버튼(day+stop 모두 선택)
  - 선택 즉시 onSelect 콜백 호출 후 모달 닫힘
```

```jsx
// onSelect 콜백 payload 모양
onSelect({
  courseId: course.id,
  courseTitle: course.title,
  dayId: day.id,
  dayNumber: day.dayNumber,
  stopId: stop?.id ?? null,
  stopName: stop?.name ?? null,
})
```

### 6.2 `FeedComposer.jsx` 연동

기존 `locationTag`(TourAPI 위치) 상태와 **나란히, 독립적으로** `courseTag` 상태를 추가한다.

```jsx
const [courseTag, setCourseTag] = useState(null)
const [coursePickerOpen, setCoursePickerOpen] = useState(false)

function handleCoursePickerSelect(picked) {
  setCourseTag(picked)
  setCoursePickerOpen(false)
}

function clearCourseTag() {
  setCourseTag(null)
}
```

제출 시(`createFeedPost` 호출부)에는 `courseTag`에서 **id만** 추출해 보낸다(스냅샷 텍스트는 서버가 자체적으로 다시 채우므로 보낼 필요 없음).

```jsx
const created = await createFeedPost({
  // ...기존 필드(content, locationTag 유래 필드, tags, images 등)...
  linkedCourseDayId: courseTag?.dayId ?? null,
  linkedCourseStopId: courseTag?.stopId ?? null,
})
```

화면 구성: "위치 태그(선택)" 섹션 바로 아래에 "여행코스 태그(선택)" 섹션을 똑같은 패턴(선택 전엔 버튼, 선택 후엔 칩+삭제 버튼)으로 추가한다.

```jsx
<div className="feed-composer__field">
  <p className="feed-composer__label">여행코스 태그(선택)</p>
  {courseTag ? (
    <div className="feed-composer__location-chip">
      <span>{courseTag.courseTitle} · {courseTag.dayNumber}일차{courseTag.stopName ? ` · ${courseTag.stopName}` : ''}</span>
      <button type="button" onClick={clearCourseTag} aria-label="여행코스 태그 삭제">✕</button>
    </div>
  ) : (
    <button type="button" onClick={() => setCoursePickerOpen(true)}>여행코스에서 선택</button>
  )}
</div>

{coursePickerOpen && (
  <CourseReferencePicker open={coursePickerOpen} onCancel={() => setCoursePickerOpen(false)} onSelect={handleCoursePickerSelect} />
)}
```

`resetForm()`에 `setCourseTag(null)`을 추가하는 것도 빠뜨리지 않는다(기존 `locationTag` 리셋과 같은 자리).

### 6.3 TourAPI 위치 태그와 코스 태그의 공존

둘은 서로 다른 질문에 답한다 — "어디서 찍은 사진인가"(`locationTag`, TourAPI 좌표/주소)와 "어느 여행코스를 참고했는가"(`courseTag`, 내부 코스/일자/경유지). 상호 배타로 만들 이유가 없고, 한 게시물이 둘 다 가질 수 있다(예: "OO코스 2일차대로 다녀왔고, 사진은 여기 전망대에서 찍었어요"). UI에서도 두 섹션을 독립된 필드로 나란히 보여준다.

### 6.4 코스 상세의 참조 피드 섹션 (Q-2)

```js
// hooks/useCourseFeedPosts.js (신규, useFeedComments.js와 같은 "더 보기 누적" 패턴)
export function useCourseFeedPosts(courseId) {
  // fetchFeedTimeline({ linkedCourseId: courseId, cursor, size: 9 })를 내부에서 호출
  // status: loading | success | error | loading-more
  // loadMore(): nextCursor로 다음 페이지를 이어 붙임
}
```

`TourCourseDetailPage.jsx`의 기존 `course-detail-stops` 섹션 아래에 새 섹션을 추가한다. 빈 상태 문구: "아직 이 코스로 남긴 이야기가 없어요." 로딩/에러는 기존 `DetailStatus`류 표시 원칙을 재사용(별도 컴포넌트를 새로 만들 필요 없이 작은 인라인 상태 분기로 충분한 규모).

---

## 7. 관리자 화면 반영 (Q-3 / D-6)

### 7.1 `adminFeedApi.js` — `toFeedDetail` 확장

```js
linkedCourse: data.linkedCourse ? {
  courseId: data.linkedCourse.courseId,
  courseTitle: data.linkedCourse.courseTitle,
  dayNumber: data.linkedCourse.dayNumber,
  stopName: data.linkedCourse.stopName,
} : null,
```

### 7.2 `AdminFeedDetailPage.jsx`

기존 "내용" 카드(`admin-feed-detail__card`)의 위치 정보(`post.locationName`/`post.address`) 바로 아래에 읽기 전용 한 줄을 추가한다. 별도 네비게이션·링크는 만들지 않는다(Q-3이 "신규 화면 없음"으로 확정됐고, 관리자 코스 상세 화면 자체가 없다, 계획 1.2절 재확인).

```jsx
{post.linkedCourse && (
  <p className="admin-feed-detail__course">
    참조한 여행코스: {post.linkedCourse.courseTitle}
    {post.linkedCourse.dayNumber != null ? ` · ${post.linkedCourse.dayNumber}일차` : ''}
    {post.linkedCourse.stopName ? ` · ${post.linkedCourse.stopName}` : ''}
  </p>
)}
```

---

## 8. 오류 처리

| 상황 | 서버 응답 | 프론트 처리 |
|------|-----------|--------------|
| 존재하지 않는 `linkedCourseDayId` | 400 `IllegalArgumentException`("존재하지 않는 여행코스 일자입니다.") | `FeedComposer`가 작성 실패 메시지로 그대로 노출(기존 `ApiError` 처리 패턴 재사용) |
| `linkedCourseStopId`만 있고 `linkedCourseDayId` 없음 | 400("여행코스를 태그하려면 일자를 함께 선택해야 합니다.") | 이 조합은 UI 흐름(일자 선택 후에만 경유지 선택 가능) 상 애초에 만들어지지 않지만, 서버가 방어적으로 재검증 |
| 경유지가 선택한 일자 소속이 아님 | 400("선택한 경유지가 해당 일자 소속이 아닙니다.") | 동일하게 UI 흐름상 발생하지 않지만 서버 방어 |
| 참조하던 코스/일자/경유지가 이후 삭제됨 | 오류 아님 — FK가 자동으로 `NULL` 처리(§5) | 피드/코스 상세에서 "삭제된 일정" 식으로 조용히 표시(§5.3) |
| 코스 상세의 참조 피드 목록 조회 실패 | 기존 `fetchFeedTimeline`과 동일한 에러 형태 | `useCourseFeedPosts`가 error 상태로 구분, 재시도 버튼 제공 |

---

## 9. 보안

- `GET /api/v1/feed/posts`에 `linkedCourseId` 파라미터를 추가하는 것은 **SecurityConfig 변경이 필요 없다**(§4.4) — 기존 permitAll 규칙은 경로만 매칭하고 쿼리 파라미터는 보지 않는다.
- 비공개(PRIVATE) 게시물이나 소프트 삭제된 게시물은 코스 참조 피드 목록에도 노출되지 않는다 — 신규 리포지토리 메서드가 기존과 동일하게 `visibility = 'PUBLIC'`과 `deletedAtIsNull` 조건을 그대로 포함한다(§4.4).
- `linkedCourseDayId`/`linkedCourseStopId` 검증은 인증 여부와 무관하게 항상 수행한다(로그인한 작성자가 다른 사람의 코스를 참조하는 것 자체는 허용 — 코스는 모든 로그인 사용자가 자유롭게 열람 가능한 공개 리소스이므로 "소유권" 개념이 없다).

---

## 10. DB 마이그레이션 SQL

이 프로젝트는 마이그레이션 도구가 없고(`jpa.hibernate.ddl-auto: none`) 수동 SQL 스크립트 관례를 따른다(`backend/db/migrations/2026-09-30-admin-dashboard.sql` 참고). 신규 파일: `backend/db/migrations/2026-10-01-tour-course-feed-linking.sql`.

```sql
-- tour-course-feed-linking 기능이 요구하는 스키마 변경.
-- 이 프로젝트에는 마이그레이션 도구(Flyway 등)가 없고 jpa.hibernate.ddl-auto: none이므로,
-- 배포 전에 이 스크립트를 직접 검토한 뒤 대상 DB에 수동으로 실행해야 합니다.
--
-- 근거 문서: docs/02-design/features/tour-course-feed-linking.design.md §3, §5
-- 엔티티 근거: FeedPost.java(신규 컬럼), tour_course/tour_course_day/tour_course_stop
--             (기존 테이블, 2026-09-30-admin-dashboard.sql에서 생성됨 — 이 스크립트는 그 테이블들을
--             변경하지 않고 참조만 한다)
--
-- 적용 전 반드시 백업을 먼저 받으세요. 이미 실행한 환경에서 재실행하지 않도록 주의하세요.
--
-- ============================================================
-- 피드(feed_post) — 여행코스 일자/경유지 참조 컬럼 추가(설계 §3)
--
-- ON DELETE SET NULL을 쓰는 이유(설계 §5): tour_course_day/tour_course_stop를 가리키는
-- 기존 FK(fk_tour_course_day_course 등, 2026-09-30 마이그레이션)는 ON DELETE 절이 없어
-- 기본값 RESTRICT다. 이 세 FK에도 같은 기본값을 쓰면, 참조 중인 일자·경유지·코스를
-- 관리자가 지우려 할 때 DB가 삭제 자체를 거부해 TourCourseAdminService.update()/delete()가
-- 원인 불명의 오류로 실패한다. SET NULL로 지정해 "참조 대상이 사라지면 피드 쪽 참조만
-- 조용히 끊어지고, 코스 관리 작업 자체는 항상 성공"하게 만든다.
-- ============================================================
ALTER TABLE feed_post
    ADD COLUMN linked_course_id          BIGINT       NULL,
    ADD COLUMN linked_course_title       VARCHAR(200) NULL,
    ADD COLUMN linked_course_day_id      BIGINT       NULL,
    ADD COLUMN linked_course_day_number  INT          NULL,
    ADD COLUMN linked_course_stop_id     BIGINT       NULL,
    ADD COLUMN linked_course_stop_name   VARCHAR(150) NULL;

ALTER TABLE feed_post
    ADD CONSTRAINT fk_feed_post_linked_course
        FOREIGN KEY (linked_course_id) REFERENCES tour_course (tour_course_id)
        ON DELETE SET NULL,
    ADD CONSTRAINT fk_feed_post_linked_course_day
        FOREIGN KEY (linked_course_day_id) REFERENCES tour_course_day (tour_course_day_id)
        ON DELETE SET NULL,
    ADD CONSTRAINT fk_feed_post_linked_course_stop
        FOREIGN KEY (linked_course_stop_id) REFERENCES tour_course_stop (tour_course_stop_id)
        ON DELETE SET NULL;

-- 코스 상세의 "참조 피드 목록" 조회(GET /api/v1/feed/posts?linkedCourseId=)가
-- linked_course_id 단일 조건 + id 정렬로 스캔하므로 인덱스를 추가한다
-- (기존 idx_feed_post_user_id와 같은 목적의 조회 성능 인덱스).
CREATE INDEX idx_feed_post_linked_course_id ON feed_post (linked_course_id);

-- 기존 피드 게시물(연동 필드 없음)은 이 ALTER로 전부 NULL이 자동 할당된다.
-- 별도 UPDATE/백필 구문이 필요 없다(계획 Q-4 확정, 설계 D-7).

-- ============================================================
-- 검증(실행 후 확인용, 선택)
-- ============================================================
-- DESCRIBE feed_post;
-- SHOW CREATE TABLE feed_post;
-- SELECT COUNT(*) FROM feed_post WHERE linked_course_id IS NOT NULL; -- 적용 직후 0이어야 정상
```

**주의(배포 전 재확인 필요)**: `ON DELETE SET NULL`은 MySQL/InnoDB에서 FK 대상 컬럼이 `NOT NULL`이 아닐 때만 유효하다 — 위 세 컬럼은 전부 `NULL` 허용으로 선언했으므로 문제 없다. 다만 운영 DB의 실제 엔진·버전에 따라 `ADD CONSTRAINT` 문법이 다를 수 있어(예: 일부 버전은 `ALTER TABLE ... ADD CONSTRAINT`를 한 문장에 여러 개 못 묶음), 적용 전 스테이징 환경에서 먼저 실행해 문법 호환성을 확인해야 한다(기존 마이그레이션 파일의 "백업 먼저" 경고를 그대로 따른다).

---

## 11. 테스트 계획

### 11.1 백엔드 테스트 (신규)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| T-1 | `linkedCourseDayId`만 지정해 게시물 작성 | `linkedCourseId`/`linkedCourseTitle`/`linkedCourseDayNumber`가 서버에서 자동으로 채워지고, `linkedCourseStopId`는 `null` |
| T-2 | `linkedCourseDayId` + `linkedCourseStopId` 지정(정상 소속) | 모든 참조 필드가 채워짐 |
| T-3 | `linkedCourseStopId`만 지정(일자 없이) | 400, "일자를 함께 선택해야 합니다" |
| T-4 | 서로 다른 일자의 `dayId`/`stopId` 조합(소속 불일치) | 400, "해당 일자 소속이 아닙니다" |
| T-5 | 존재하지 않는 `dayId` | 400, "존재하지 않는 여행코스 일자입니다" |
| T-6 | **참조 중인 경유지를 관리자가 `update()`로 삭제(구조 교체)** | 코스 수정 자체는 성공, 해당 게시물의 `linked_course_stop_id`가 `NULL`로 바뀜(DB 레벨 확인), `linked_course_day_id`는 유지 |
| T-7 | **참조 중인 코스를 관리자가 `delete()`로 전체 삭제** | 코스 삭제 자체는 성공(예외 없음), 해당 게시물의 세 참조 id가 모두 `NULL`, 스냅샷 텍스트(`linkedCourseTitle` 등)는 유지 |
| T-8 | `GET /api/v1/feed/posts?linkedCourseId={courseId}` | 그 코스의 일자/경유지 어느 단위로 참조했든 모두 포함, PRIVATE·소프트삭제 게시물은 제외 |
| T-9 | `linkedCourseId` 없이 기존 `GET /api/v1/feed/posts` 호출(회귀 확인) | 기존 동작과 완전히 동일한 결과(쿼리·응답 모두) |

T-6·T-7이 이번 설계의 핵심 검증 포인트다 — `ON DELETE SET NULL`이 실제로 동작하는지는 코드 리뷰만으로 확신할 수 없고 반드시 통합 테스트(실제 DB 또는 H2 등 FK를 지원하는 테스트 DB)로 확인해야 한다.

### 11.2 프론트엔드 확인 (수동/코드 리뷰)

- `CourseReferencePicker`에서 일자 선택 → 경유지 선택 → 선택 취소 → 다시 선택이 상태 꼬임 없이 동작하는지
- `locationTag`와 `courseTag`를 동시에 설정한 뒤 게시물을 작성해도 둘 다 정상 저장되는지
- 코스 상세 화면에서 참조 피드가 0건일 때 빈 상태 문구가 보이는지, 1건 이상일 때 "더 보기"가 동작하는지
- `AdminFeedDetailPage`에서 코스 참조가 있는 게시물/없는 게시물 모두 레이아웃이 깨지지 않는지

---

## 12. 회귀 방지 체크리스트 (구현 단계에서 확인)

- [ ] 기존 `TourReferencePicker.jsx`는 한 글자도 수정하지 않았는가
- [ ] 기존 `TourCourseAdminService.java`(코스 CRUD)는 한 글자도 수정하지 않았는가 — 참조 무결성은 전적으로 DB FK(`ON DELETE SET NULL`)가 책임지고, 애플리케이션 코드 변경으로 처리하지 않는다
- [ ] `GET /api/v1/feed/posts`(`linkedCourseId` 없이 호출하는 기존 메인 피드)가 기존과 동일하게 동작하는가
- [ ] 기존 피드 게시물(코스 미태그)이 신규 `linkedCourse` 필드가 추가된 뒤에도 오류 없이 조회되는가
- [ ] `FeedAdminPostResponse`에 필드가 추가된 뒤에도 기존 관리자 피드 목록·삭제 플로우가 그대로 동작하는가

---

## 13. 의존성

| 영역 | 내용 |
|------|------|
| 백엔드 신규 | `feed/service/CourseLinkResolver.java`, `tourcourse/repository/{TourCourseDayRepository,TourCourseStopRepository}.java`, `backend/db/migrations/2026-10-01-tour-course-feed-linking.sql` |
| 백엔드 수정 | `FeedPost.java`, `FeedCreateRequest.java`, `FeedPostResponse.java`, `FeedAdminPostResponse.java`, `FeedPostRepository.java`, `FeedController.java`, `FeedService.java` |
| 프론트 신규 | `components/common/CourseReferencePicker.jsx`(+css), `hooks/useCourseFeedPosts.js` |
| 프론트 수정 | `components/feed/FeedComposer.jsx`, `pages/TourCourseDetailPage.jsx`, `pages/admin/AdminFeedDetailPage.jsx`, `api/{feedApi.js,adminFeedApi.js}` |
| 변경하지 않음 | `TourReferencePicker.jsx`, `TourCourseAdminService.java`, `TourCourseAdminController.java`, `AdminCourseFormPage.jsx`, 피드 좋아요·북마크·댓글 전체, `SecurityConfig.java` |

---

## 14. 남은 열린 사항 (구현 전 확인 권장, 낮은 위험)

이 항목들은 방향이 갈리는 결정이 아니라 구현 착수 전 짧게 확인하면 되는 사실 확인성 사항이다.

| # | 항목 | 확인 방법 |
|---|------|-----------|
| O-1 | 운영 DB(MySQL) 버전이 한 `ALTER TABLE` 문장에 여러 `ADD CONSTRAINT`를 묶어 받아들이는지 | 스테이징에서 §10 SQL을 먼저 실행해 확인. 호환되지 않으면 `ADD CONSTRAINT`마다 별도 `ALTER TABLE` 문장으로 쪼갠다 |
| O-2 | `TourCourseDay`/`TourCourseStop`에 별도 리포지토리를 추가하는 것이 기존 `TourCourseRepository` 중심 접근 패턴과 충돌하지 않는지 | 코드 리뷰 — 두 신규 리포지토리는 feed 모듈 전용 읽기 검증에만 쓰이고 tourcourse 모듈 자신은 여전히 `TourCourseRepository`(집합체 단위)만 쓴다는 것을 재확인 |
| O-3 | `CourseReferencePicker`의 "일자/경유지 트리" UI가 코스 일자·경유지 수가 많을 때(예: 7박 8일, 경유지 수십 개) 스크롤·레이아웃이 자연스러운지 | 구현 단계에서 실제 데이터로 확인 |

---

## 15. 구현 가이드 / 다음 단계

### 15.1 구현 순서

1. [ ] DB 마이그레이션 SQL 작성·스테이징 적용·검증(§10, O-1)
2. [ ] 백엔드: `FeedPost` 컬럼·메서드(§3.1), `TourCourseDayRepository`/`TourCourseStopRepository`(§3.2), `CourseLinkResolver`(§3.2), DTO 확장(§4.1, §4.3, §4.5), `FeedController`/`FeedService`/`FeedPostRepository` 확장(§4.2, §4.4) — frontend-support-backend
3. [ ] 백엔드 테스트: T-1~T-9(§11.1, 특히 T-6·T-7 참조 무결성 검증) — frontend-support-backend
4. [ ] 프론트: `CourseReferencePicker.jsx`(§6.1), `FeedComposer.jsx` 연동(§6.2~6.3), `useCourseFeedPosts.js`/`TourCourseDetailPage.jsx`(§6.4), `AdminFeedDetailPage.jsx`/`adminFeedApi.js`(§7) — frontend-lead
5. [ ] 코드 리뷰(frontend-code-reviewer) + gap 분석(bkit gap-detector) — 회귀 방지 체크리스트(§12) 포함
6. [ ] 완료 보고서 → 포트폴리오 추출(frontend-interview-coach)

### 15.2 세션 가이드

- DB 마이그레이션은 되돌리기 어려운 작업이므로, 스테이징에서 먼저 실행하고 애플리케이션 재기동 후 실제로 `ON DELETE SET NULL`이 동작하는지(§11.1 T-6·T-7) 확인한 뒤 운영에 적용한다.
- 백엔드 구현 중 `CourseLinkResolver`를 가장 먼저 작성하고 단위 테스트(T-3~T-5)로 검증한 뒤, `FeedService.create`에 연결하는 순서를 권장한다 — 검증 로직이 먼저 안정화되면 이후 DTO·컨트롤러 변경이 수월하다.

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-10-01 | 초안. 계획 문서 Q-1~Q-4 결정(2026-10-01, 일자/경유지 단위 참조 확정)을 반영해 데이터 모델·API·참조 무결성(`ON DELETE SET NULL`)·프론트 컴포넌트 구조·마이그레이션 SQL을 설계 | WOOJIN |
