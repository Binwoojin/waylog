# feed-comment-integration 완료 보고서

> **상태**: ✅ Complete (PDCA 사이클 2 — 댓글+답글)
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: frontend-lead (Claude Code 보조)
> **완료일**: 2026-09-30
> **PDCA 주기**: #5. `admin-dashboard`(피드 스키마·모더레이션 출처) → `feed-integration`(사이클 1, 타임라인·상세·작성·삭제·좋아요·북마크·타인 프로필) → **`feed-comment-integration`(사이클 2, 이 문서)** 순으로 이어진 여행 피드 관련 3개 연속 PDCA 사이클의 마지막 단계다. 이 문서로 계획했던 여행 피드 기능(사이클 1 + 사이클 2) 전체가 완료된다

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **기능** | 사이클 1이 항상 0으로 표시하던 게시물 상세의 "댓글 N개"에 실제 댓글·답글(1단계) 기능을 붙인다. `FeedComment`(자기 참조 엔티티) 신규, 댓글 API 3종(목록·작성·삭제), 게시물 상세에 인라인 댓글 섹션 |
| **시작일** | 2026-09-30 (계획 단계, `feed-integration` 완료 직후) |
| **완료일** | 2026-09-30 |
| **소요 기간** | 1일(단일 세션 내 Plan → Design → Do → 코드 리뷰 → 수정 2건 → Check → Report 전 주기 진행) |

### 1.2 결과 요약

```
┌──────────────────────────────────────────────┐
│  전체 Match Rate: 99.2%                       │
├──────────────────────────────────────────────┤
│  ✅ 완료:     댓글·답글 작성/조회/삭제 게시물 상세 통합 │
│  ✅ 신규 API: 댓글 목록·작성·삭제 3종             │
│  ✅ 신규 엔티티: FeedComment(자기 참조, 답글 1단계) │
│  ✅ 계약:     API 5면 대조 100% 일치(계약 변경 1건 포함) │
│  ✅ 코드 리뷰: Must Fix 2건 + Should Improve 2건 전건 수정 │
│  ✅ Gap:      Critical 0건, Important 4건(전건 완료) │
│  ⚠️  Minor:    1건(문서 주석 후속 과제)           │
└──────────────────────────────────────────────┘
```

### 1.3 전달한 가치 (4 관점)

| 관점 | 내용 |
|------|------|
| **문제** | 사이클 1이 완료된 뒤에도 게시물 상세의 "댓글 N개" 표시는 항상 0이었다. 댓글로 소통하는 SNS의 핵심 기능이 통째로 빠져 있었고, 자기 참조 엔티티로 답글(1단계)까지 표현하는 것 자체가 이 프로젝트에 처음 도입하는 구조였다 |
| **해결** | `FeedComment` 자기 참조 엔티티(`parent`)와 서비스 계층의 `parent.isReply()` 검증으로 답글의 답글을 원천 차단했다. 댓글 목록은 "최상위 댓글 페이지네이션 + 답글 항상 포함"이라는 구조를 택해, 무한 스크롤도 단일 객체 교체도 아닌 "페이지 번호 기반 누적 + 버튼 클릭 트리거"라는 세 번째 상태 훅(`useFeedComments`)을 새로 설계했다. 낙관적 업데이트는 의도적으로 적용하지 않기로 결정해(Q-4), 사이클 1에서 이미 3곳에 서로 다르게 구현돼 후속 과제로 남아 있던 패턴(G-6)을 이번 사이클에서는 더 늘리지 않았다 |
| **기능/UX 효과** | 사용자가 게시물에 댓글·답글을 남기고, 본인 댓글을 확인 모달을 거쳐 지울 수 있게 됐다. 사이클 1이 항상 0으로 보여주던 "댓글 N개"가 **코드 변경 없이** 실제 값으로 바뀌었다(사이클 1 설계가 미리 준비해 둔 "연결 지점"이 그대로 실현된 사례) |
| **핵심 가치** | 이 사이클의 포트폴리오 가치는 세 가지다. 첫째, **겉보기엔 정상 동작하는 코드에 숨어 있던 성능 버그를 SQL 로그로 직접 확인해 잡아낸 것** — `@OneToMany` 컬렉션(bag) fetch join과 `Pageable`(LIMIT/OFFSET)을 함께 쓰면 Hibernate가 SQL 페이지네이션을 포기하고 게시물의 최상위 댓글+답글 전체를 메모리로 읽은 뒤 애플리케이션에서 자르는, 겉으로는 응답이 정상으로 보이는 미묘한 문제였다. 둘째, **동시성 문제를 필드 증감에서 원자적 UPDATE 쿼리로 근본적으로 해결하는 과정에서 두 번째 함정까지 발견한 것** — `@Modifying(clearAutomatically = true)`가 flush되지 않은 삭제 예약까지 영속성 컨텍스트와 함께 지워버려 "댓글이 삭제된 것처럼 응답하지만 실제로는 남아 있는" 잠재적 버그를 로컬 테스트로 미리 잡았다. 셋째, **admin-dashboard → feed-integration → feed-comment-integration으로 이어진 3개 연속 PDCA 사이클을 완결 지은 것** — 하나의 큰 기능을 무리하게 한 사이클로 밀어붙이지 않고, 완결 지어 릴리스 가능한 단위로 나누어 각 사이클마다 뚜렷한 면접 소재(모더레이션 스키마 설계, 커서 기반 무한 스크롤, 자기 참조 엔티티와 JPA 페이지네이션 함정)를 남겼다 |

---

## PDCA 주기 요약

### Plan (계획)

**문서**: `docs/01-plan/features/feed-comment-integration.plan.md` (v0.2, Q-1~Q-4 결정 완료)

**목표**
- 사이클 1이 "연결 지점"으로 남겨 둔 "댓글 N개"(항상 0) 표시를 실제 값으로 채운다
- `FeedComment` 자기 참조 엔티티 + 답글 1단계 제한 도입
- 사전 설계(`feed-integration.design.md` §3.4~3.5·§4.3·§8)를 재조사로 검증하고, 재설계 대신 확정 설계로 공식화

**주요 결정** (사용자 Q-1 ~ Q-4, 2026-09-30 — 전부 frontend-lead 권장안 채택)

| # | 결정 | 요지 | 실행 |
|---|------|------|:----:|
| D-1 (Q-1) | 댓글 작성 알림 | 제외 확정 — 백엔드에 알림 시스템 자체가 없음을 grep으로 확인 | ✅(미구현이 완료 조건) |
| D-2 (Q-2) | 댓글 삭제 방식 | 하드 삭제 확정 — 게시물 삭제 정책과 일관 | ✅ |
| D-3 (Q-3) | 답글 표시 방식 | 기본 항상 펼침 확정 — 접기/펼치기 토글 UI 없음 | ✅ |
| D-4 (Q-4) | 낙관적 업데이트 적용 여부 | 미적용 확정 — 서버 응답 대기 후 갱신, 사이클 1의 G-6(패턴 3곳 중복)을 네 번째로 늘리지 않기 위함 | ✅ |

**재조사 성과(Plan 단계)**: 사전 설계가 전제로 삼았던 `FeedPost.java`/`FeedController.java`/`FeedService.java`/`FeedPostRepository.java`가 사이클 1 완료 후에도 그대로임을 확인했고, 기존 `SecurityConfig`의 `GET /api/v1/feed/posts/**` permitAll이 다중 세그먼트 와일드카드라 댓글 목록 GET을 이미 포함한다는 것을 **구현 전에** 확인해, 사이클 1의 실제 결함(G-1, 타인 프로필 API의 permitAll 누락)이 재발하지 않도록 사전에 방지했다.

**범위**: FR-19~33(백엔드+프론트). FR-34(알림)는 Q-1 결정에 따라 배정하지 않고 결번 처리

### Design (설계)

**문서**: `docs/02-design/features/feed-comment-integration.design.md` (v0.1)

**아키텍처 결정**

| 기준 | 선택 | 이유 |
|------|------|------|
| **답글 깊이 제한** | 1단계(부모가 이미 답글이면 추가 답글 거부) | 인스타그램·트위터 등 주요 SNS의 실질적 관례를 따르고, 서버가 `parent.isReply()`로 API 계층부터 차단해 프론트가 실수로 버튼을 노출해도 안전 |
| **댓글 삭제 방식** | 하드 삭제(Q-2) | 게시물 자체의 사용자 삭제 정책(하드 삭제)과 일관, 최상위 댓글 삭제 시 답글은 `orphanRemoval`로 함께 정리 |
| **댓글 목록 로드 방식** | 페이지 번호 기반 "더 보기" 버튼(무한 스크롤 아님) | 댓글은 게시물당 수십 개 수준으로 타임라인보다 훨씬 적어, 상세 화면 안의 보조 UI로는 페이지 단위가 구현·리뷰 비용이 낮음(사이클 1 설계가 이미 이 방향을 예고) |
| **낙관적 업데이트** | 미적용(Q-4) | 사이클 1의 G-6(3곳이 서로 다른 낙관적 업데이트 패턴)을 네 번째로 늘리지 않기 위해, 댓글 작성·삭제는 서버 응답 완료 후에만 상태 갱신 |
| **`useFeedComments` 상태 모양** | `useFeedInfiniteList`(스크롤 자동 트리거 커서 누적)도 `useFeedDetail`(단일 객체 교체)도 아닌 세 번째 모양 | 페이지 번호 기반 누적 + 버튼 클릭 트리거라는, 기존 두 훅과 구분되는 새로운 상태 전이가 필요했음 |
| **`SecurityConfig` 변경 여부** | 변경 없음(D-5) | 기존 `GET /api/v1/feed/posts/**` permitAll이 댓글 목록 GET을 이미 포함, POST/DELETE는 `anyRequest().authenticated()`로 자동 인증 요구 |

**주요 모듈**

| 모듈 | 역할 | 비고 |
|------|------|------|
| `feed/domain/FeedComment.java` | 댓글·답글 자기 참조 엔티티 | `parent`(nullable), `replies`(cascade+orphanRemoval), `isReply()` |
| `feed/repository/FeedCommentRepository.java` | 최상위 댓글 페이지 조회 + 답글 별도 조회 | Do 단계에서 2단계 쿼리로 재설계(아래 Do 참고) |
| `feed/service/FeedCommentService.java` | 목록/작성/삭제, 답글 1단계 검증, 댓글 수 증감 | Do 단계에서 원자적 UPDATE로 재설계(아래 Do 참고) |
| `frontend/src/hooks/useFeedComments.js` | 댓글 목록 상태(페이지 기반 누적) | 이 프로젝트 세 번째 상태 모양의 훅 |
| `frontend/src/components/feed/FeedCommentForm.jsx` | 최상위 댓글·인라인 답글 입력 겸용 | 코드 리뷰로 `isReply` prop 분리(아래 Do 참고) |

### Do (구현)

**진행 순서**: 백엔드 신규 API(frontend-support-backend) → 프론트 댓글 UI(frontend-lead) → 코드 리뷰(frontend-code-reviewer) → Must Fix 2건·Should Improve 2건 수정 → 삭제 API 응답 계약 변경에 따른 프론트 재연동.

| 순서 | 영역 | 담당 | 주요 산출물 |
|:---:|------|------|-------------|
| 1 | 백엔드 댓글 엔티티·API 3종 | frontend-support-backend | `FeedComment`, DTO 3종, `FeedCommentRepository`/`Service`/`Controller`, `FeedPost.comments` 추가, 신규 테스트 2개 파일 |
| 2 | 프론트 댓글 UI | frontend-lead | `feedCommentApi.js`, `useFeedComments`, `FeedCommentList`/`FeedCommentForm`(+css), `FeedDetailPage`에 `CommentSection` 연결 |
| 3 | 코드 리뷰 | frontend-code-reviewer | Must Fix 2건(SQL 페이지네이션 무력화, commentCount 동시성), Should Improve 2건(삭제 응답 계약, `FeedCommentForm` prop 결합) 발견 |
| 4 | 백엔드 수정 | frontend-support-backend | Must Fix 2건 + 삭제 응답 계약(200 + `removedCount`) 수정, 92/92 테스트 통과 확인(자체 환경) |
| 5 | 프론트 수정(1) | frontend-lead | Should Improve(`FeedCommentForm`의 `isReply` prop 분리) 수정 |
| 6 | 프론트 수정(2) | frontend-lead | 삭제 API 응답 계약 변경에 맞춰 `FeedDetailPage.jsx`의 `handleConfirmDelete`가 서버의 실제 `removedCount`를 사용하도록 재연동(폴백 포함) |

**완료 항목**
- ✅ 댓글·답글(1단계) 작성·조회·삭제, 게시물 상세 인라인 통합 (FR-19~24, 27~32)
- ✅ 게시물 하드 삭제 시 댓글·답글 cascade 정리 검증 테스트 (FR-25)
- ✅ 답글 1단계 제한·댓글 수 증감 검증 테스트 (FR-26)
- ✅ 페이지 기반 누적 상태 훅, "더 보기" 버튼 (FR-28~29)
- ✅ 비로그인 로그인 유도 (FR-33)

**코드 품질**
- 백엔드 신규 테스트 2개 파일(11개 테스트): `FeedCommentServiceTest`(8개), `SecurityConfigFeedCommentAccessTest`(3개)
- 백엔드 92/92 테스트 통과(frontend-support-backend 확인) — 이 세션은 이전 두 사이클과 동일한 JDK 버전 제약(로컬 17 vs `pom.xml` 요구 25)으로 직접 재현하지 못함(분석 문서 §4.2)
- `npm run lint` 오류 0, `npm run build` 성공(수정 3회 각각 확인)
- frontend-code-reviewer 독립 리뷰: Must Fix 2건 + Should Improve 2건 발견, 전건 수정 반영 확인

**발견·수정된 이슈** (포트폴리오 소재)

| # | 이슈 | 발견 경로 | 근본 원인 | 수정 |
|---|------|-----------|-----------|------|
| 1 | 댓글 목록 조회가 겉보기엔 정상 응답하지만, `replies`(`@OneToMany` bag) fetch join과 `Pageable`을 함께 쓰면 Hibernate가 SQL 페이지네이션을 포기하고 게시물의 최상위 댓글+답글 **전체를 메모리로 읽은 뒤** 애플리케이션에서 자름 | frontend-code-reviewer(Must Fix 1, SQL 로그로 실측 확인) | to-many 컬렉션 fetch join과 LIMIT/OFFSET을 함께 쓰면 안 된다는 JPA/Hibernate의 잘 알려진 제약을 초기 설계가 반영하지 못함 | `FeedCommentRepository`를 2단계 쿼리로 분리: 최상위 댓글은 `author`만 `EntityGraph`로 페이지 조회, 답글은 최상위 댓글 id 목록으로 별도 `IN` 쿼리 1회 실행 |
| 2 | `commentCount` 필드를 인스턴스 메서드(`increaseCommentCount`/`decreaseCommentCount`)로 증감하는 방식은 동시에 댓글이 작성/삭제될 때 lost update가 발생할 수 있음 | frontend-code-reviewer(Must Fix 2) | dirty checking 기반 필드 증감은 동시성 보호가 없음 | `FeedPostRepository.adjustCommentCount`(원자적 UPDATE 쿼리)로 대체. **수정 도중 2차 문제 발견**: `@Modifying(clearAutomatically = true)`로 작성했더니, 댓글 삭제 시 `feedCommentRepository.delete(comment)`(flush 전 삭제 예약)를 호출한 직후 이 UPDATE가 실행되며 영속성 컨텍스트가 통째로 비워져 **flush되지 않은 삭제 예약까지 함께 사라지는** 부작용을 로컬 테스트로 발견 → `clearAutomatically`를 끄는 것으로 우회 |
| 3 | 댓글 삭제 API가 `204 No Content`만 반환해, 프론트가 삭제 확인 모달이 열린 시점의 로컬 state로 감소량을 추정해야 했음(다른 사용자가 그 사이 답글을 추가하면 어긋날 수 있음) | frontend-code-reviewer(Should Improve) | 삭제 API의 응답 계약이 클라이언트가 필요로 하는 정보(실제 삭제 개수)를 제공하지 않음 | `200 OK` + `FeedCommentDeleteResponse{removedCount}`로 계약 변경, `FeedCommentService.delete()`가 실제 삭제 개수를 반환하도록 수정. 프론트는 서버 값을 우선 쓰고 예상과 다른 응답이면 로컬 추정치로 폴백 |
| 4 | `FeedCommentForm.jsx`가 "답글 모드 여부"를 `onCancel` prop의 존재 여부로 암묵적으로 판별(`rows={onCancel ? 2 : 3}`) | frontend-code-reviewer(Should Improve) | "취소 버튼 노출"과 "답글 모드인지"라는 서로 다른 두 의미가 하나의 prop에 겹쳐 있었음 | `isReply`(boolean) prop을 신규 추가해 분리, `onCancel`은 순수 "취소 버튼 클릭 핸들러"로만 사용 |

### Check (검증)

**문서**: `docs/03-analysis/feed-comment-integration.analysis.md`

**Gap 분석 결과**

```
Overall Match Rate: 99.2%
├ Structural:  100% (설계 §2.2/§9 모듈 목록과 실제 파일 구성 완전 일치)
├ Functional:   98% (FR-19~33 전체 충족 + 발견분 4건 수정 확인, 감점은 문서 주석 1건)
└ Contract:   100%  (API 5면 대조 5/5, 계약 변경 1건 포함 3면 일치)
```

**Success Criteria** (계획 §4.1, 9개 항목) — 9/9 완전 충족

**Gap 목록** (Critical 0, Important 4건 전건 완료, Minor 1건)
1. **G-1 (Important, 완료)**: to-many fetch join + Pageable로 인한 SQL 페이지네이션 무력화 — Must Fix 1 수정(2단계 쿼리)
2. **G-2 (Important, 완료)**: `commentCount` 필드 증감의 동시성 미보호 — Must Fix 2 수정(원자적 UPDATE), `clearAutomatically` 부작용도 함께 발견·우회
3. **G-3 (Important, 완료)**: 댓글 삭제 응답에 `removedCount` 없음 — Should Improve 수정(200 + removedCount 계약 변경)
4. **G-4 (Important, 완료)**: `FeedCommentForm`의 `onCancel`/답글 모드 암묵적 결합 — Should Improve 수정(`isReply` prop 분리)
5. **G-5 (Minor, 후속 과제)**: `FeedCard.jsx`의 사이클 1 시점 주석 미갱신(기능 영향 없음)

### Act (완료)

**판단**: gap 분석 결과(Match Rate 99.2%, Critical 0건, Important 4건 전건 완료·수정)에 따라 Report 단계로 진행. frontend-code-reviewer가 찾은 Must Fix 2건과 Should Improve 2건은 모두 이번 PDCA 사이클 내에서 수정 완료됐다. 남은 Minor 1건(문서 주석)은 다음 세션으로 이월한다.

---

## 1.4 성공 기준 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | 게시물 상세에서 최상위 댓글 목록("더 보기")과 답글(1단계, 항상 펼쳐짐)을 볼 수 있다 | ✅ 충족 | `FeedCommentList.jsx`, `useFeedComments` 페이지 기반 누적 확인 |
| SC-2 | 로그인한 사용자가 댓글과 답글을 작성할 수 있다 | ✅ 충족 | `FeedCommentForm` 최상위·인라인 답글 겸용, `isReply` prop 분리(G-4) |
| SC-3 | 답글에는 답글을 달 수 없다 | ✅ 충족 | UI에 버튼 미노출 + `FeedCommentServiceTest.replyToReplyIsRejected` |
| SC-4 | 작성자 본인이 자신의 댓글(및 그 답글)을 삭제할 수 있다 | ✅ 충족 | `FeedConfirmDialog` 확인 모달, 서버 실제 `removedCount` 반영(G-3) |
| SC-5 | 게시물을 삭제하면 그 댓글·답글도 고아 레코드 없이 함께 삭제된다 | ✅ 충족 | `FeedCommentServiceTest.deletingPostCascadesComments` |
| SC-6 | "댓글 N개" 표시가 실제 값으로 바뀐다(코드 변경 없이) | ✅ 충족 | `adjustCommentCount` → `FeedPostResponse.commentCount` → `FeedCard`/`FeedDetailPage`가 무변경으로 실제 값 표시 |
| SC-7 | 로딩·에러(재시도)·빈 상태가 구분되어 표시된다 | ✅ 충족 | `CommentSection` 상태 분기 확인 |
| SC-8 | 사이클 1 화면·관리자 피드 모더레이션에 회귀가 없다 | ✅ 충족 | git status로 무변경 확인 |
| SC-9 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ 충족 | Must Fix 2건·Should Improve 2건 수정 반영, 이 보고서와 짝을 이루는 gap 분석 완료 |

**전체 성공률**: 9/9 (100%)

---

## 1.5 주요 결정 기록

| # | 결정 | 실행 | 결과 |
|---|------|:----:|------|
| D-1 (Q-1) | 댓글 작성 알림 제외 | ✅ | 알림 시스템 자체가 없어 별도 후속 기능으로 미룸 |
| D-2 (Q-2) | 댓글 하드 삭제 | ✅ | 게시물 삭제 정책과 일관, `orphanRemoval`로 답글 함께 정리 |
| D-3 (Q-3) | 답글 기본 항상 펼침 | ✅ | 접기/펼치기 토글 UI 없이 구현, 리뷰 비용 절감 |
| D-4 (Q-4) | 낙관적 업데이트 미적용 | ✅ | 서버 응답 완료 후 상태 갱신, 사이클 1 G-6 패턴을 네 번째로 늘리지 않음 |
| 설계 결정 | `useFeedComments`를 페이지 기반 누적 + 버튼 트리거로 신규 설계 | ✅ | `useFeedInfiniteList`/`useFeedDetail`과 구분되는 세 번째 상태 모양 |
| 발견 사항(코드 리뷰 Must Fix 1) | to-many fetch join + Pageable의 SQL 페이지네이션 무력화 | ✅ | 2단계 쿼리로 분리, SQL 로그로 실측 확인 |
| 발견 사항(코드 리뷰 Must Fix 2) | `commentCount` 동시성 미보호 + `clearAutomatically` 2차 부작용 | ✅ | 원자적 UPDATE로 전환, `clearAutomatically` 비활성화로 우회 |
| 발견 사항(코드 리뷰 Should Improve) | 삭제 응답에 `removedCount` 없음, `FeedCommentForm` prop 결합 | ✅ | 응답 계약 변경(200+removedCount), `isReply` prop 분리 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:----:|
| Plan | [feed-comment-integration.plan.md](../../01-plan/features/feed-comment-integration.plan.md) | ✅ 최종화 (v0.2, Q-1~Q-4 결정 완료) |
| Design | [feed-comment-integration.design.md](../../02-design/features/feed-comment-integration.design.md) | ✅ 최종화 (v0.1) |
| Check | [feed-comment-integration.analysis.md](../../03-analysis/feed-comment-integration.analysis.md) | ✅ 완료 (Match Rate 99.2%) |
| Act | 이 문서 | ✅ 완료 |
| 선행 사이클 | [feed-integration.report.md](feed-integration.report.md) (사이클 1 — 커서 기반 무한 스크롤, 타임라인·상세·작성·삭제·좋아요·북마크·타인 프로필) | 참고 |
| 선행 기능 | [admin-dashboard.report.md](admin-dashboard.report.md) (피드 스키마·모더레이션 출처, 이 3개 사이클의 시작점) | 참고 |

---

## 3. 완료된 항목

### 3.1 기능 요구사항

| 그룹 | 항목 수 | 상태 |
|------|:---:|:---:|
| FR-19~24 (백엔드 댓글 엔티티·DTO·리포지토리·서비스·컨트롤러) | 6 | ✅ 6/6 완료 |
| FR-25~26 (백엔드 cascade·1단계 제한·카운트 테스트) | 2 | ✅ 2/2 완료 |
| FR-27~29 (프론트 API·훅·목록 컴포넌트) | 3 | ✅ 3/3 완료 |
| FR-30~33 (프론트 입력 폼·상세 통합·삭제 확인·로그인 유도) | 4 | ✅ 4/4 완료 |
| FR-34 (알림, Q-1 제외 확정) | - | 결번(이번 사이클 대상 아님) |

**기능 완성도**: 15/15 = 100%(이번 사이클 범위 기준)

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|:----:|:----:|
| 데이터 정합성(답글 1단계) | 답글의 답글 서버 거부 | ✅ `FeedCommentServiceTest.replyToReplyIsRejected` | ✅ |
| 데이터 정합성(cascade) | 게시물 삭제 시 댓글 고아 레코드 없음 | ✅ `deletingPostCascadesComments` | ✅ |
| 데이터 정합성(동시성) | `commentCount` 증감이 동시 요청에도 안전 | ✅ 원자적 UPDATE로 전환(G-2) | ✅ |
| 보안(XSS) | 댓글 내용 일반 텍스트 렌더링 | ✅ 확인 | ✅ |
| 보안(인가) | 본인 댓글만 삭제 가능 | ✅ UI+서버 이중 검증 | ✅ |
| 거짓 UI 금지 | 답글 없는 댓글에 빈 토글 없음 | ✅ 확인 | ✅ |
| 회귀 방지 | 사이클 1·관리자 화면 무변경 | ✅ git status로 확인 | ✅ |
| 접근성 | 폼 레이블, 삭제 모달 `alertdialog` | ✅ 확인 | ✅ |
| 반응형 | 댓글·답글 목록 모바일 대응 | ✅ CSS 미디어쿼리 확인 | ✅ |

**품질 메트릭**
- `npm run lint` 오류 0, `npm run build` 성공(수정 3회 각각 확인)
- Gap 분석: Match Rate 99.2%, Critical 0건
- 코드 리뷰 Must Fix 2건 + Should Improve 2건 전건 수정 확인
- 백엔드 92/92 테스트 통과(frontend-support-backend 확인, 이 세션은 JDK 제약으로 직접 재현하지 못함)

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:----:|
| 백엔드 신규 | `feed/domain/FeedComment.java`, `feed/dto/FeedComment{CreateRequest,Response,PageResponse,DeleteResponse}.java`, `feed/repository/FeedCommentRepository.java`, `feed/service/FeedCommentService.java`, `feed/controller/FeedCommentController.java` | ✅ |
| 백엔드 수정 | `feed/domain/FeedPost.java`(`comments` 컬렉션 추가), `feed/repository/FeedPostRepository.java`(`adjustCommentCount` 추가) | ✅ |
| 백엔드 신규 테스트 | `FeedCommentServiceTest.java`(8개), `SecurityConfigFeedCommentAccessTest.java`(3개) | ✅ |
| 프론트 신규 | `api/feedCommentApi.js`, `hooks/useFeedComments.js`, `components/feed/FeedComment{List,Form}.jsx`(+css) | ✅ |
| 프론트 수정 | `pages/FeedDetailPage.jsx`(+css) — `CommentSection` 연결 | ✅ |
| 문서 | Plan, Design, Analysis, Report | ✅ 4개 |

---

## 4. 미완료 / 이월 항목

### 4.1 설계 여유 범위 (의도적 미구현, 계획에서 이미 확정)

| 항목 | 계획 근거 | 사유 | 우선순위 | 이월 처리 |
|------|-----------|------|----------|----------|
| 댓글 작성 알림 | Q-1 제외 확정 | 알림 시스템 자체가 없음 | Low | 필요성 확인되면 별도 후속 PDCA |
| 댓글 좋아요/수정/검색/무한 스크롤 | 계획 §2.2 제외 | 범위 밖 확정 | Low | 필요성 확인되면 별도 후속 |
| 낙관적 업데이트 오버레이 패턴 통합(사이클 1 G-6) | 사이클 1 보고서 이월 과제 | 이번 사이클은 댓글에 낙관적 업데이트를 적용하지 않기로 결정해(Q-4) 네 번째 변형은 생기지 않았으나, 기존 3곳의 통합 자체는 미해결 | Medium | 다음 PDCA에서 결정 |

### 4.2 코드 리뷰 후속 과제 (Minor, 위험 낮음)

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| `FeedCard.jsx` 주석 갱신 | "commentCount는 항상 0" 문구가 사이클 1 시점 그대로 남음(기능 영향 없음) | Low | 다음 세션에서 문구만 갱신 |

### 4.3 환경 제약 후속

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| 백엔드 자동 테스트 이 세션 재현 | JDK 17(로컬) vs `pom.xml` 요구 25 — **destination-list-integration, tour-course-list-integration, feed-integration에 이어 네 번째로 반복**되는 환경 제약. frontend-support-backend가 별도 환경에서 92/92 통과를 보고했으나 이 세션 자체에서는 재현하지 못함 | High(배포 전 필수) | CI 또는 JDK 25 환경에서 `mvnw clean test` 실행 확인, 매 세션 재발하지 않도록 세션 시작 체크리스트/자동화 검토(feed-integration 보고서가 이미 같은 개선안을 제안) |
| L2 브라우저 검증 | 브라우저 자동화 도구 부재로 미실행 | Medium | 도구 도입 시 분석 문서 §4.3 체크리스트 실행 |

---

## 5. 품질 메트릭

### 5.1 최종 분석 결과

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 99.2%                   │
├─────────────────────────────────────────────┤
│  Structural Match:  100%                     │
│  Functional Match:   98%                     │
│  Contract Match:    100%                     │
├─────────────────────────────────────────────┤
│  Critical Gap: 0건                            │
│  Important Gap: 4건 (전건 완료·수정)           │
│  Minor Gap: 1건 (후속 과제, 문서 주석)          │
└─────────────────────────────────────────────┘
```

### 5.2 해결된 이슈 (코드 리뷰 → 수정)

| 이슈 | 발견 경로 | 해결 방법 | 결과 |
|------|-----------|----------|:----:|
| to-many fetch join + Pageable의 SQL 페이지네이션 무력화 | frontend-code-reviewer(Must Fix 1, SQL 로그 실측) | 2단계 쿼리(최상위 페이지 + 답글 IN) 분리 | ✅ 댓글이 많은 게시물에서도 실제 SQL 레벨 페이지네이션 동작 |
| `commentCount` 동시성 미보호 + `clearAutomatically` 2차 부작용 | frontend-code-reviewer(Must Fix 2) | 원자적 UPDATE 전환, `clearAutomatically` 비활성화 | ✅ 동시 작성/삭제에도 lost update 없음, 삭제 예약도 정상 flush |
| 댓글 삭제 응답에 `removedCount` 없음 | frontend-code-reviewer(Should Improve) | `200 OK` + `{removedCount}` 계약 변경, 프론트 재연동 | ✅ 서버의 정확한 삭제 개수로 `commentCount` 갱신 |
| `FeedCommentForm`의 `onCancel`/답글 모드 암묵적 결합 | frontend-code-reviewer(Should Improve) | `isReply` prop 분리 | ✅ 두 의미가 독립적으로 확장 가능 |

### 5.3 테스트 결과

| 카테고리 | 결과 |
|----------|:----:|
| 정적 분석 | ✅ 설계 §2.2/§9 모듈 목록 100% 일치 |
| 기능 검증 | ✅ 15/15 FR 충족(이번 사이클 범위) |
| 코드 리뷰 반영 확인 | ✅ Must Fix 2/2, Should Improve 2/2 수정 확인 |
| 프론트 lint/build | ✅ `npm run lint` 0 오류, `npm run build` 성공(3회) |
| 백엔드 신규 테스트 | ✅ 92/92 통과(frontend-support-backend 확인) / ⬜ 이 세션 자체 재현은 JDK 제약으로 미실행 |
| L2 UI(브라우저) | ⬜ 미검증(도구 부재, 다음 세션 이월) |

---

## 6. 배운 점 및 회고

### 6.1 잘된 점 (지속할 사항)

1. **"정상 응답 = 정상 동작"이 아님을 SQL 로그로 직접 확인**: 댓글 목록 API는 겉보기엔 페이지 크기만큼만 응답을 반환해 정상으로 보였지만, 실제로는 to-many 컬렉션 fetch join과 `Pageable`이 함께 쓰이면 Hibernate가 SQL 페이지네이션을 포기하고 전체를 메모리로 읽어 애플리케이션에서 자르고 있었다. 응답 결과만 보고 넘어가지 않고 SQL 로그를 직접 확인하는 습관이 실제로 성능 버그를 잡아낸 사례다.

2. **동시성 문제를 근본 원인(원자성 없는 필드 증감)까지 추적해 해결**: `commentCount` 증감을 단순히 "동시 요청이 드물 것"이라고 넘기지 않고, 원자적 UPDATE 쿼리로 아키텍처 수준에서 재설계했다. 그 과정에서 `@Modifying(clearAutomatically = true)`가 flush되지 않은 변경사항까지 지워버리는 JPA의 잘 알려지지 않은 함정을 로컬 테스트로 사전에 발견해, 실제 배포 후 발생했다면 "댓글 삭제가 간헐적으로 실패하는 것처럼 보이는" 재현하기 어려운 버그가 될 뻔한 것을 막았다.

3. **API 계약이 구현 도중 바뀌어야 한다는 것을 인지하고 3면(설계·서버·클라이언트) 모두 갱신**: 코드 리뷰가 삭제 응답의 정보 부족을 지적하자, 문서·백엔드·프론트를 모두 일관되게 업데이트했다. 특히 프론트 쪽은 서버 응답을 신뢰하되 예상과 다른 형식일 때 폴백하는 fail-closed 원칙을 유지해, 계약 변경 자체가 새로운 위험을 만들지 않도록 했다.

4. **3개 연속 PDCA 사이클을 완결 지어 릴리스 가능한 단위로 나눈 전략이 실제로 유효했음을 재확인**: admin-dashboard(스키마) → feed-integration(핵심 CRUD+무한스크롤) → feed-comment-integration(댓글)으로 나눈 덕분에, 각 사이클이 감당 가능한 범위의 gap 분석·코드 리뷰를 받을 수 있었고, 이번 사이클의 리뷰가 SQL 페이지네이션 문제라는 미묘한 버그를 놓치지 않고 잡아낼 수 있었다.

### 6.2 개선할 점 (다음 시도)

1. **JDK 버전 불일치가 네 번째로 반복됨**: destination-list-integration, tour-course-list-integration, feed-integration에 이어 이번에도 동일한 문제(로컬 17 vs 요구 25)를 겪었다. feed-integration 보고서가 이미 "세션 시작 시 자동으로 확인하는 절차를 bkit 워크플로에 추가"를 제안했으나 실제로 반영되지 않았다는 뜻이다 — 제안만으로는 부족하고, 실제 자동화나 CI 게이트로 강제해야 한다.

2. **to-many fetch join + Pageable 함정을 설계 단계에서 미리 걸렀다면 더 좋았음**: 사이클 1의 `FeedPostRepository` 주석에 이미 "photos와 tags를 동시에 fetch join하지 않는다"는 동일한 원칙이 기록돼 있었는데도, 사전 설계(feed-integration.design.md §4.3)의 `FeedCommentRepository` 초안은 이를 반영하지 못했다. 기존 코드베이스에 이미 있는 원칙을 새 설계에도 체크리스트로 강제하는 절차가 필요하다.

### 6.3 다음에 시도할 사항

1. **"컬렉션 fetch join + Pageable 금지"를 프로젝트 컨벤션 문서에 명시적으로 남기기**: `FeedPostRepository`와 `FeedCommentRepository` 양쪽에서 반복된 교훈이므로, 다음에 유사한 리포지토리를 설계할 때 처음부터 참고할 수 있는 문서화가 필요하다.

2. **JDK 버전 정합성을 세션 시작 스크립트로 실제 자동화**: 세 번 연속 "다음에 확인하겠다"는 회고만 남기고 반영되지 않았으므로, 이번에는 실제 자동 확인 절차(예: 세션 시작 후크)를 bkit 설정에 추가하는 것을 최우선으로 검토한다.

3. **낙관적 업데이트 오버레이 패턴 통합(사이클 1 G-6)을 더 이상 미루지 않기**: 이번 사이클은 댓글에 낙관적 업데이트를 적용하지 않기로 결정해 문제를 회피했지만, 향후 다른 기능이 낙관적 업데이트를 필요로 하면 네 번째 변형이 생길 위험은 여전히 남아 있다.

---

## 7. 다음 단계

### 7.1 즉시 (Report 단계)

- [ ] 설계 문서 갱신(G-1: 리포지토리 2단계 쿼리, G-2: 원자적 UPDATE, G-3: 200+removedCount 계약) — 코드 변경 없음
- [ ] `FeedCard.jsx` 주석 갱신(G-5)

### 7.2 다음 PDCA 주기

| 항목 | 의존성 | 우선순위 | 비고 |
|------|--------|---------|------|
| JDK 25/CI 환경에서 `mvnw clean test` 전체 실행 | 이 기능 + 이전 3개 사이클 공통 | High | 네 번째로 반복된 환경 제약, 자동화 최우선 검토 |
| 낙관적 업데이트 오버레이 패턴 통합 | 사이클 1 G-6 | Medium | 다음 기능이 낙관적 업데이트를 필요로 하기 전에 결정 권장 |
| L2 브라우저 자동화 도입 | 프로세스 개선 | Medium | 다섯 번째 PDCA 연속으로 반복된 이슈 |
| 마이페이지/북마크 전용 화면 | 사이클 1 Q-8에서 이번 범위 제외 | Medium | 여행 피드 3개 사이클과는 별개의 신규 PDCA로 착수 |

이것으로 admin-dashboard에서 시작해 feed-integration(사이클 1)을 거쳐 feed-comment-integration(사이클 2, 이 문서)까지 이어진 **여행 피드 기능 전체가 완료됐다.**

### 7.3 포트폴리오 추출 (이 세션 이후)

`frontend-interview-coach` 에이전트에 위임:
- to-many 컬렉션 fetch join과 `Pageable`을 함께 쓸 때 발생하는 JPA/Hibernate의 숨은 성능 함정을 SQL 로그로 실측해 잡아낸 사례
- `commentCount` 증감을 원자적 UPDATE로 재설계하는 과정에서 `@Modifying(clearAutomatically=true)`가 flush 전 삭제를 지워버리는 2차 함정까지 발견·우회한 과정
- API 계약이 코드 리뷰 도중 바뀌어야 했을 때, 문서·서버·클라이언트 3면을 fail-closed 원칙 아래 일관되게 갱신한 절차
- admin-dashboard → feed-integration → feed-comment-integration으로 이어진 3개 연속 PDCA 사이클을 완결 지어 릴리스 가능한 단위로 나눈 전략과, 그 마지막 사이클을 마무리한 경험

---

## 8. Changelog

### v1.0.0 (2026-09-30)

**Added**
- `backend/.../feed/domain/FeedComment.java`
- `backend/.../feed/dto/FeedComment{CreateRequest,Response,PageResponse,DeleteResponse}.java`
- `backend/.../feed/repository/FeedCommentRepository.java`
- `backend/.../feed/service/FeedCommentService.java`
- `backend/.../feed/controller/FeedCommentController.java`
- `backend/src/test/.../config/SecurityConfigFeedCommentAccessTest.java`
- `backend/src/test/.../feed/FeedCommentServiceTest.java`
- `frontend/src/api/feedCommentApi.js`
- `frontend/src/hooks/useFeedComments.js`
- `frontend/src/components/feed/FeedComment{List,Form}.jsx`(+css)

**Changed**
- `backend/.../feed/domain/FeedPost.java`: `comments` 컬렉션 추가(cascade=ALL, orphanRemoval)
- `backend/.../feed/repository/FeedPostRepository.java`: `adjustCommentCount` 원자적 UPDATE 메서드 추가
- `frontend/src/pages/FeedDetailPage.jsx`(+css): `CommentSection` 연결, `applyLocalUpdate` 재사용으로 `commentCount` 갱신

**Fixed** (코드 리뷰에서 발견 → 수정)
- to-many fetch join + `Pageable`로 인한 SQL 페이지네이션 무력화(2단계 쿼리로 분리)
- `commentCount` 필드 증감의 동시성 미보호(원자적 UPDATE로 전환) 및 `clearAutomatically`의 flush 전 삭제 소실 부작용
- 댓글 삭제 응답에 `removedCount` 없음(200 + `{removedCount}` 계약으로 변경, 프론트 재연동)
- `FeedCommentForm`의 `onCancel`/답글 모드 암묵적 결합(`isReply` prop 분리)

---

## 9. 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-09-30 | 완료 보고서 생성(사이클 2). Plan(Q-1~Q-4 결정)→Design(확정 설계 공식화)→Do(백엔드 신규 API+프론트 댓글 UI, 코드 리뷰 Must Fix 2건+Should Improve 2건 수정)→Check(99.2%)→Act(Report). 이것으로 admin-dashboard → feed-integration → feed-comment-integration으로 이어진 여행 피드 기능 3개 연속 PDCA 사이클이 모두 완료됨 | frontend-lead (Claude Code 보조) |

---

**작성 완료**: 2026-09-30 · frontend-lead (Claude Code 보조)
