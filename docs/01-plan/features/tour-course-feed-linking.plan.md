# tour-course-feed-linking 계획 문서

> **요약**: `admin-dashboard` 설계 단계(§8)에서 사용자가 "여행코스 API 계약은 피드(SNS)와도 연결되는 부분이라 지금 확정하기 어렵다"며 **여행코스 ↔ 피드 연동을 명시적으로 유보**했다. `tour-course-list-integration` 설계(§12)에도 같은 유보가 "막지는 않되 확정하지 않는다"로 이어졌다. 이 문서는 그 유보를 실제로 풀어보는 첫 Plan이다.
>
> 재조사 결과, 유보 당시 남겨둔 전제("`FeedPost`에 `linkedCourseId` 하나만 추가하면 여행코스 스키마는 건드릴 필요가 없다")는 지금도 그대로 유효하다. **8장 Q-1~Q-4는 2026-10-01 사용자 결정으로 모두 확정됐다** — 요지만 먼저 밝히면: 연동은 frontend-lead 권장안(코스 전체 참조)과 **반대로 "코스의 특정 일자 또는 특정 경유지" 단위**로 확정됐고(Q-1), 코스 상세 참조 피드 노출(Q-2)·관리자 `AdminFeedDetailPage` 필드 추가(Q-3)·기존 게시물 무처리(Q-4, nullable이라 마이그레이션 불필요)는 모두 권장안대로 확정됐다. 상세 결정 내용과 근거는 8장 참고.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0 / backend Spring Boot 4.1.0
> **작성자**: WOOJIN (Claude Code 보조, frontend-lead)
> **작성일**: 2026-10-01
> **상태**: Approved — 8장 Q-1~Q-4 사용자 결정 완료(2026-10-01). Design 문서(`tour-course-feed-linking.design.md`) 작성 완료
> **근거**: `docs/02-design/features/admin-dashboard.design.md` §8, `docs/02-design/features/tour-course-list-integration.design.md` §12 확인 / `backend/.../feed/domain/FeedPost.java`, `backend/.../tourcourse/domain/{TourCourse,TourCourseDay,TourCourseStop}.java` 재확인 / `backend/.../tourcourse/controller/TourCoursePublicController.java`, `backend/.../tourcourse/service/TourCoursePublicService.java` 확인(참조 피드 조회 API 없음 확인) / `backend/.../feed/repository/FeedPostRepository.java`, `backend/.../feed/dto/{FeedCreateRequest,FeedPostResponse}.java` 확인 / `backend/.../config/SecurityConfig.java` 확인(`GET /api/v1/courses/**`, `GET /api/v1/feed/posts/**` permitAll 와일드카드 확인) / `backend/.../tourcourse/service/TourCourseAdminService.java` 확인(코스/일자/경유지 하드 삭제·구조 교체 시 cascade 동작 확인 — 참조 무결성 설계의 근거) / `frontend/src/components/common/TourReferencePicker.jsx`, `frontend/src/components/feed/FeedComposer.jsx` 확인(TourAPI 콘텐츠만 태깅 가능, 코스 선택 불가 확인) / `frontend/src/pages/TourCourseDetailPage.jsx` 확인(참조 피드 섹션 없음 확인) / `frontend/src/pages/admin/*`, `backend/.../feed/dto/FeedAdminPostResponse.java` 확인(관리자 여행코스 **상세** 화면 자체가 아직 없음, `AdminFeedDetailPage`는 존재 확인) / `frontend/src/api/{feedApi.js,courseApi.js}` 확인(view model 변환 패턴) / `backend/db/migrations/2026-09-30-admin-dashboard.sql` 확인(수동 SQL 마이그레이션 관례)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 피드 게시물이 "이 여행은 OO 코스를 보고 다녀왔어요"처럼 여행코스를 직접 가리킬 방법이 없다. 반대로 여행코스 상세에서도 "이 코스로 실제로 여행한 사람들의 이야기"를 보여줄 방법이 없다. `admin-dashboard` 설계 때부터 유보돼 온 이 연결 고리가 두 기능(여행코스, 피드)을 완성된 사이클 2개로 만들어 놓고도 서로 섬처럼 분리된 상태로 남겨두고 있다 |
| **해결** | `FeedPost`에 코스의 **일자(필수) 및 경유지(선택)** 단위까지 가리킬 수 있는 nullable 참조 컬럼을 추가해(Q-1 결정) 게시물이 "코스 전체"가 아니라 "그 코스의 2일차" 혹은 "그 코스의 2일차 OO 전망대"처럼 구체적으로 참조할 수 있게 하고, 피드 작성 화면에 "여행코스에서 선택" 옵션을 추가하며, 코스 상세 화면 하단에 "이 코스를 다녀온 사람들의 이야기"(참조 피드 목록)를 노출한다(Q-2) |
| **기능/UX 효과** | 사용자가 게시물 작성 시 여행코스의 특정 일자·경유지를 태그할 수 있고, 코스 상세 화면에서 그 코스를 참조한 실제 여행 후기를 바로 확인할 수 있다 — 여행코스(계획)와 피드(경험담)가 서로의 신뢰도를 보강하는 구조가 된다 |
| **범위 경계** | 이번 Plan은 **"게시물 1개 ↔ 코스의 일자 1개(+선택적으로 경유지 1개)" 참조**를 다룬다(Q-1, 2026-10-01 확정 — 코스 전체 단일 참조가 아님). 코스 쪽 엔티티 스키마 변경, 관리자 코스 CRUD 변경, 관리자 코스 **상세 화면 신규 제작**은 포함하지 않는다(Q-3) |
| **핵심 가치** | 2개 사이클 전(`admin-dashboard`)에 "지금 확정하기 어렵다"며 **의도적으로 미룬 설계 결정**을, 그 유보가 실제로 구조를 막지 않았는지 코드로 재검증한 뒤 다시 꺼내 든 것. 게다가 사용자가 frontend-lead의 권장안(코스 전체 참조, 더 단순한 쪽)을 **그대로 받아들이지 않고 더 세밀한 모델(일자/경유지 단위)을 선택**해, "단순함"과 "실제 사용자 가치(어느 날 어디를 갔는지가 진짜 유용한 정보)" 중 후자를 택한 과정 자체가 면접에서 설명 가능한 소재다 — 코스의 구조 변경(일자·경유지 재배열/삭제)이 이 참조를 깨뜨리지 않도록 FK `ON DELETE SET NULL` + 스냅샷 컬럼으로 방어한 설계(Design §3, §5)도 함께 설명 가능하다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | `admin-dashboard.design.md` §8이 명시적으로 유보한 연동을, `tour-course-list-integration`과 `feed-comment-integration` 두 사이클이 끝난 지금 다시 꺼내 설계할 차례가 됐다. 더 미루면 두 기능이 영구히 분리된 채로 "포트폴리오 완성도"에서 손해를 본다 |
| **WHO** | 여행코스를 보고 실제로 여행을 떠난 뒤 후기를 남기고 싶은 사용자 / 코스 상세에서 "진짜 이 코스로 여행한 사람이 있는지" 확인하고 싶은 사용자 |
| **RISK** | 연동 방향(게시물→코스 전체 vs 특정 일자/경유지)을 잘못 고르면 이후 UI·쿼리를 다시 설계해야 함 / 코스 쪽에서 피드를 끌어오는 신규 조회 쿼리가 N+1이나 과도한 조인을 유발할 수 있음 / 기존 `TourReferencePicker`(TourAPI 콘텐츠 전용)에 코스 선택을 억지로 끼워 넣으면 두 데이터 소스(외부 TourAPI vs 내부 TourCourse)가 섞여 컴포넌트가 비대해질 수 있음 |
| **SUCCESS** | 사용자가 게시물 작성 시 여행코스를 선택해 태그할 수 있다 / 코스 상세에 그 코스를 참조한 피드 목록이 노출된다(Q-2 결정에 따라) / 기존 TourAPI 위치 태깅, 코스 CRUD, 피드 타임라인에 회귀가 없다 |
| **SCOPE** | 백엔드: `FeedPost`에 일자/경유지 단위 참조 컬럼(nullable FK + 스냅샷) 추가, 코스 참조 피드 조회 API 신규(기존 피드 타임라인 엔드포인트 확장, Design §4) / 프론트: 피드 작성 화면의 코스/일자/경유지 선택 UI(`CourseReferencePicker` 신규), 코스 상세 화면의 참조 피드 섹션, `AdminFeedDetailPage`에 참조 정보 표시 |

---

## 1. 개요

### 1.1 목적

`admin-dashboard` 설계 단계에서 "여행코스 API 계약은 피드와도 연결되는 부분이라 지금 확정하기 어렵다"고 유보했던 여행코스 ↔ 피드 연동을, 두 기능이 각각 완성된 지금 시점에 실제로 설계·구현하기 위한 범위·요구사항·미해결 질문을 정리한다.

### 1.2 배경 재조사 — 유보 당시 전제가 지금도 유효한가

`admin-dashboard.design.md` §8은 다음 세 가지를 확인한 뒤 연동 자체는 의도적으로 설계하지 않았다.

> "`FeedPost`에 향후 `linkedCourseId`(nullable FK, `TourCourse.id` 참조) 하나를 추가하는 정도로는 이번 여행코스 스키마를 변경할 필요가 없다(코스 쪽은 자신을 참조하는 존재를 몰라도 되는 단방향 관계이기 때문)."

이 Plan 작성을 위해 그 전제를 다시 코드로 확인했다.

| 확인 대상 | 유보 당시 전제 | 재조사 결과(2026-10-01) | 판정 |
|-----------|----------------|--------------------------|------|
| `feed/domain/FeedPost.java` | `linkedCourseId` 필드 없음, 추가해도 기존 필드에 영향 없음 | 실제로 없음. `tourContentId`/`tourContentTypeId`/`locationName`/`address`/`latitude`/`longitude`는 **TourAPI 외부 콘텐츠 전용**(REFERENCE 스냅샷 패턴, "TourAPI 데이터를 매번 호출하지 않고도 장소를 식별"하기 위한 필드라고 주석에 명시). `TourCourse`(내부 엔티티)를 가리키는 필드는 전혀 없어, 지금 구조로는 게시물이 내부 코스를 참조할 방법이 없다 | 전제 유효. 추가는 신규 컬럼 하나로 끝나는 additive 변경 |
| `tourcourse/domain/TourCourse.java` | 코스 쪽은 자신을 참조하는 존재를 몰라도 되는 단방향 관계 | 코드 주석에 "이번 범위에는 피드(SNS) 연동 필드를 추가하지 않는다(설계 §8, 의도적으로 유보됨)"가 그대로 남아 있음. `TourCourse`/`TourCourseDay`/`TourCourseStop` 중 어디에도 피드 역참조 필드 없음 | 전제 유효. 코스 쪽 스키마는 건드릴 필요 없음(단방향 FK로 충분) |
| `tourcourse/controller/TourCoursePublicController.java`, `tourcourse/service/TourCoursePublicService.java` | (당시 미확인) | `GET /api/v1/courses`(목록), `GET /api/v1/courses/{id}`(상세) 두 엔드포인트만 존재. "이 코스를 참조한 피드 목록" 같은 조회는 어디에도 없음 — **신규 확인**, 예상대로 아직 없음 | 신규 API가 필요함을 확인 |
| `config/SecurityConfig.java` | (당시 미확인) | `.requestMatchers(HttpMethod.GET, "/api/v1/courses", "/api/v1/courses/**").permitAll()`가 이미 다중 세그먼트 와일드카드(`**`)다. 코스 참조 피드 목록을 `GET /api/v1/courses/{id}/feed-posts`처럼 이 경로 아래에 추가하면 **별도 SecurityConfig 변경 없이 자동으로 permitAll에 포함된다**(`feed-comment-integration` 설계 때 동일한 패턴으로 확인했던 것과 같은 구조) | `feed-comment-integration`의 G-1(SecurityConfig 누락) 재발 위험 사전 해소 |
| `components/common/TourReferencePicker.jsx` | (당시 미확인) | `fetchTourList`(TourAPI 공개 목록 API)만 호출한다. `kind` 상태는 `TOUR_LIST_CONFIGS`(관광지/문화시설 등 TourAPI `contentTypeId` 기반)만 순회하므로, **여행코스(`TourCourse`)는 이 선택 UI에 전혀 나타나지 않는다** | 코스 선택 UI는 이 컴포넌트를 확장하거나 별도로 만들어야 함(7장) |
| `pages/TourCourseDetailPage.jsx` | (당시 미확인) | 코스 통계(일정·일자·지점 수·테마)와 일자별 경유지 카드만 렌더링한다. "참조 피드" 섹션이 들어갈 자리 자체가 없음 | 신규 섹션 추가 필요(Q-2 결정에 따라) |
| `pages/admin/*` | (당시 미확인) | 관리자 여행코스 화면은 **목록(`AdminCourseListPage`)과 폼(`AdminCourseFormPage`)뿐**이고, 상세 전용 화면(`AdminCourseDetailPage` 같은 것)이 아예 없다. 반대로 `AdminFeedDetailPage`(피드 상세)는 이미 존재한다 | "코스→피드" 방향의 어드민 노출은 코스 상세 화면을 **새로 만들어야** 하지만, "피드→코스" 방향(이 게시물이 참조한 코스 표시)은 기존 `AdminFeedDetailPage`에 필드 하나 더 보여주는 수준으로 가능 — 비용이 크게 다름(8장 Q-3) |

**결론**: 유보 당시의 핵심 전제("`linkedCourseId`만 추가하면 코스 스키마는 그대로 둬도 된다")는 재조사로 재확인됐다. 다만 유보됐던 세 가지 질문(§8 원문 인용) 중 어느 것도 아직 답이 없으므로, 이번 Plan은 그 답을 **결정하는 것이 아니라 결정에 필요한 선택지와 근거를 제시**하는 데 집중한다.

### 1.3 관련 문서

- 유보 근거: `docs/02-design/features/admin-dashboard.design.md` §8 "미해결 사항"
- 유보 승계: `docs/02-design/features/tour-course-list-integration.design.md` §12(간접 — O-1~O-3는 다른 주제이지만 같은 "낮은 위험, 나중에 확인" 태도를 유지)
- 선행 기능: `docs/01-plan/features/tour-course-list-integration.plan.md`(공개 코스 목록·상세 API), `docs/01-plan/features/feed-integration.plan.md`(피드 타임라인·작성·상세), `docs/01-plan/features/feed-comment-integration.plan.md`(SecurityConfig 와일드카드 패턴 선례)

### 1.4 사용자 결정 반영 (2026-10-01)

8장 Q-1~Q-4가 모두 결정되어, 이 문서의 범위·FR·위험을 아래 요지에 맞춰 갱신했다(세부 근거와 전체 선택지는 8장에 그대로 남겨 결정 이력을 보존한다).

| # | 결정 | 이 Plan에 미친 영향 |
|---|------|----------------------|
| Q-1 | **B안 채택(frontend-lead 권장 A안 대신)** — 게시물은 코스 전체가 아니라 **코스의 특정 일자**를 반드시 참조하고, **특정 경유지**까지는 선택적으로 더 좁혀 참조할 수 있다 | §2 범위, §3 FR, §7 아키텍처 전반을 "코스 전체 단일 FK" 전제에서 "일자 필수 + 경유지 선택"의 2단 참조 모델로 다시 작성 |
| Q-2 | **A안 채택(권장안)** — 코스 상세에 참조 피드 목록을 노출한다 | FR-04/FR-06이 확정 항목(Pending이 아닌 확정)으로 전환 |
| Q-3 | **B안 채택(권장안)** — 관리자 코스 상세 화면은 신규 제작하지 않고, 기존 `AdminFeedDetailPage`에 "참조한 코스/일자/경유지" 필드만 추가한다 | FR-08이 확정 항목으로 전환, "관리자 코스 상세 신규 제작"은 범위에서 완전히 제외 |
| Q-4 | **A안 확정(조사 그대로)** — `nullable` 컬럼이라 기존 게시물은 모두 자동으로 "코스 미태그" 상태로 남고 별도 마이그레이션·백필이 필요 없다 | 변경 없음, 그대로 확정 |

---

## 2. 범위

### 2.1 포함 (이번 `tour-course-feed-linking` 사이클)

- [ ] 백엔드: `FeedPost`에 **일자 단위(필수) + 경유지 단위(선택)** 참조 컬럼 추가(`linkedCourseId`/`linkedCourseDayId`/`linkedCourseStopId` + 스냅샷 컬럼들, Q-1 결정 반영 — 전부 nullable, 코스 전체만 가리키는 상태는 허용하지 않음). 구체 컬럼 설계는 Design 문서로 넘긴다
- [ ] 백엔드: `FeedCreateRequest`/`FeedPostResponse`에 일자/경유지 참조 필드 반영(클라이언트는 `linkedCourseDayId`/`linkedCourseStopId`만 보내고, `linkedCourseId`·스냅샷은 서버가 체인을 따라가 직접 채운다 — Design §3)
- [ ] 백엔드: 코스 참조 피드 목록 조회 API 신규(Q-2 확정) — 기존 피드 타임라인 엔드포인트(`GET /api/v1/feed/posts`)에 선택적 필터를 추가하는 방식으로 확장(신규 엔드포인트를 따로 만들지 않음, 근거는 Design §4)
- [ ] 프론트: 피드 작성 화면(`FeedComposer.jsx`)에 "여행코스에서 선택" 옵션 추가 — 코스 검색 → 일자 선택(필수) → 경유지 선택(선택)의 단계형 선택 UI(`CourseReferencePicker.jsx` 신규, 7.1 참고)
- [ ] 프론트: `FeedComposer`에서 선택한 일자/경유지를 게시물 작성 요청에 포함
- [ ] 프론트: 코스 상세 화면(`TourCourseDetailPage.jsx`)에 참조 피드 섹션 추가(Q-2 확정)
- [ ] 프론트: 피드 카드/상세에 코스 태그가 있으면 "OO코스 · N일차" 또는 "OO코스 · N일차 · 경유지명" 형태로 표시하고 코스 상세로 이동하는 링크 제공(위치 태그가 TourAPI 콘텐츠일 때 여행지 상세로 링크하는 기존 패턴과 대칭)
- [ ] 프론트: 관리자 피드 상세(`AdminFeedDetailPage.jsx`)에 "참조한 여행코스" 필드 추가(Q-3 확정, 저비용안)
- [ ] 검증: 기존 TourAPI 위치 태깅과 코스 태그가 한 게시물에 동시에 존재할 수 있음(서로 다른 목적의 독립 필드, Design §6.3), 기존 피드 타임라인·코스 목록·상세·관리자 화면에 회귀 없음
- [ ] 검증: 코스 관리자가 코스 구조를 수정/삭제해도(일자·경유지 삭제, 코스 자체 삭제) 참조하던 게시물이 오류 없이 유지되는지(Design §5 참조 무결성 설계)

### 2.2 제외

- **"코스 전체"만 가리키는 참조 상태** — Q-1 결정(특정 일자/경유지 단위)에 따라, 일자를 지정하지 않고 코스 자체에만 거는 참조는 애초에 허용하지 않는다(서버 검증으로 차단, Design §3)
- **여행코스 스키마 변경(`TourCourse`/`TourCourseDay`/`TourCourseStop`에 피드 역참조 필드 추가)** — 1.2절 재조사로 불필요함을 재확인(단방향 FK로 충분)
- **관리자 여행코스 상세 화면 신규 제작** — Q-3에서 "기존 `AdminFeedDetailPage`에 필드만 추가"로 확정됐으므로 범위에서 완전히 제외
- **기존 피드 게시물 마이그레이션/백필** — 전부 nullable이라 기존 행은 모두 `NULL`로 남고 "코스 미태그 게시물"로 그대로 동작한다(Q-4 확정)
- **알림, 코스-피드 상호 추천 알고리즘** 등 연동을 발판 삼은 2차 기능 — 전부 범위 밖

---

## 3. 요구사항

### 3.1 기능 요구사항

> 이번 Plan은 새 기능 계열이므로 FR 번호를 FR-01부터 새로 시작한다(기존 `/feed`·`/courses` 계열 FR 이력과 섞지 않음). Q-1~Q-4가 모두 결정되어(1.4절) 아래 FR은 더 이상 잠정이 아니라 확정이다. 구체적인 컬럼명·API 시그니처는 Design 문서(`tour-course-feed-linking.design.md`)에서 확정했다.

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | 백엔드: `FeedPost`에 `linkedCourseId`/`linkedCourseDayId`/`linkedCourseStopId`(전부 nullable FK, 단순 `@Column` — JPA 연관관계 아님) + 스냅샷 컬럼(코스명/일자 번호/경유지명) 추가. FK는 `ON DELETE SET NULL`로 걸어 코스 쪽 구조 변경(일자/경유지 삭제, 코스 삭제)이 피드 게시물에 오류를 일으키지 않게 한다 — Design §3, §5 | High | frontend-support-backend | Design 완료 |
| FR-02 | 백엔드: `FeedCreateRequest`에 `linkedCourseDayId`(선택, 지정 시 필수로 유효성 검증)/`linkedCourseStopId`(선택, 지정 시 그 일자 소속인지 검증) 추가. `FeedService.create`가 일자→코스 체인을 따라가 `linkedCourseId`·스냅샷을 서버에서 직접 채운다(클라이언트가 불일치하는 조합을 보낼 가능성 자체를 제거) | High | frontend-support-backend | Design 완료 |
| FR-03 | 백엔드: `FeedPostResponse`에 `linkedCourse`(nullable 중첩 객체 — courseId/courseTitle/dayId/dayNumber/stopId/stopName) 반영. 스냅샷 컬럼을 그대로 쓰므로 조회 시 `TourCourse`를 조인하지 않는다(성능 영향 없음) | High | frontend-support-backend | Design 완료 |
| FR-04 | 백엔드: 코스 참조 피드 목록 — 신규 엔드포인트가 아니라 기존 `GET /api/v1/feed/posts`에 `linkedCourseId` 선택 쿼리 파라미터를 추가해 커서 페이지네이션 그대로 재사용(Q-2 확정, 신규 엔드포인트 대비 모듈 간 결합 최소화) | High | frontend-support-backend | Design 완료 |
| FR-05 | 프론트: 피드 작성 화면에 "여행코스에서 선택" UI 추가 — `CourseReferencePicker.jsx` 신규(코스 검색 → 일자 선택 → 경유지 선택(선택) 단계형), `TourReferencePicker.jsx`는 변경하지 않고 별도 컴포넌트로 분리 | High | frontend-lead | Design 완료 |
| FR-06 | 프론트: 코스 상세 화면에 참조 피드 섹션(목록, 로딩/에러/빈 상태 구분, "더 보기") 추가 — Q-2 확정 | High | frontend-lead | Design 완료 |
| FR-07 | 프론트: 피드 카드·상세에서 코스 태그를 "OO코스 · N일차[ · 경유지명]"으로 표시하고 `getCourseDetailPath`(기존 `courseApi.js`)로 코스 상세 링크 제공 | Medium | frontend-lead | Design 완료 |
| FR-08 | 프론트: 관리자 피드 상세(`AdminFeedDetailPage.jsx`)에 "참조한 여행코스" 표시 추가(Q-3 확정, 저비용안 — 신규 화면 없음) | Medium | frontend-lead | Design 완료 |

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 데이터 정합성 | 존재하지 않는 일자/경유지 id, 또는 서로 소속이 맞지 않는 일자-경유지 조합으로는 참조를 설정할 수 없음(서버 검증, 일자 없이 경유지만 지정하는 요청도 거부) | 백엔드 테스트 |
| 참조 무결성 | 코스 관리자가 참조 중인 일자·경유지를 삭제하거나 코스 자체를 삭제해도, 연결된 피드 게시물이 오류 없이 유지되고 해당 참조만 자동으로 해제됨(`ON DELETE SET NULL`) | 백엔드 테스트(Design §5, §11) |
| 성능 | 코스 참조 피드 목록 조회가 페이지당 고정된 쿼리 수로 동작(코스 목록 집계 때와 같은 원칙, `TourCoursePublicService.list`의 "검색 1 + 집계 2" 패턴 참고), 스냅샷 컬럼 덕분에 `TourCourse` 조인 없이 응답 가능 | 코드 리뷰 |
| 거짓 UI 금지 | 참조 피드가 0건인 코스 상세에 빈 섹션을 어색하게 보여주지 않고, "아직 이 코스로 남긴 이야기가 없어요" 같은 명시적 빈 상태를 보여줌(프로젝트 전반의 "거짓 UI 금지" 원칙 계승) | 코드 리뷰 |
| 회귀 방지 | 기존 TourAPI 위치 태깅(`tourContentId`/`tourContentTypeId`), 코스 CRUD, 피드 타임라인·좋아요·북마크·댓글에 영향 없음 | 수동 확인 + git status |
| 보안 | 코스 참조 피드 목록 API가 비공개(PRIVATE) 게시물·소프트 삭제된 게시물을 노출하지 않음(기존 `findByVisibilityAndDeletedAtIsNull` 조건과 동일하게 적용) | 코드 리뷰 |

---

## 4. 성공 기준

### 4.1 완료 조건 (Q-1~Q-4 결정 이후 확정)

- [ ] 사용자가 게시물 작성 시 여행코스를 선택해 태그할 수 있다
- [ ] (Q-2 결정에 따라) 코스 상세 화면에서 그 코스를 참조한 피드 목록을 확인할 수 있다
- [ ] 기존 피드 게시물(코스 미태그)이 오류 없이 그대로 보인다(Q-4 확인대로 마이그레이션 불필요)
- [ ] 기존 TourAPI 위치 태깅, 코스 목록/상세, 피드 타임라인/댓글/좋아요/북마크에 회귀가 없다
- [ ] frontend-code-reviewer 리뷰와 gap 분석 완료

### 4.2 품질 기준

- [ ] `npm run lint` 오류 0, `npm run build` 성공
- [ ] 백엔드 신규 테스트(유효하지 않은 코스 id 거부, 참조 피드 목록이 PRIVATE/소프트삭제 게시물을 제외하는지)
- [ ] gap 분석 Match Rate 90% 이상

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| **(신규, Q-1 확정으로 드러남)** 코스 관리자가 코스를 하드 삭제(`TourCourseAdminService.delete`)하거나 구조를 교체하며 일자/경유지를 제거(`pruneUnreferenced`)할 때, 그 일자/경유지를 참조하는 피드 게시물이 있으면 기본 FK 제약(`RESTRICT`)이 그 삭제 자체를 막아버려 **코스 관리와 무관한 기능(피드 참조)이 관리자 화면에 500 오류를 일으킬 수 있음** | **High** | Medium(참조가 늘어날수록 발생 확률 증가) | 세 FK 컬럼 모두 `ON DELETE SET NULL`로 설계한다(Design §5). 참조 대상이 삭제되면 DB가 자동으로 해당 피드 게시물의 참조 id만 `NULL`로 바꾸고, 스냅샷 텍스트(코스명/일자/경유지명)는 남겨 "참조했던 코스가 이후 삭제/변경됨"을 사용자에게 자연스럽게 보여줄 수 있다 |
| 일자 없이 경유지만 지정하거나, 서로 소속이 다른 일자-경유지 조합을 클라이언트가 보낼 경우 데이터가 꼬일 수 있음 | Medium | Low | FR-02에서 클라이언트는 `linkedCourseDayId`/`linkedCourseStopId`만 보내고 `linkedCourseId`는 서버가 일자→코스 체인으로 직접 채우도록 설계해, 클라이언트가 불일치 조합을 보낼 여지 자체를 줄인다. 경유지 지정 시 "그 일자 소속인지"는 서버가 검증한다(Design §3) |
| 코스 참조 피드 목록 조회를 새 엔드포인트로 만들면(`GET /courses/{id}/feed-posts`) tourcourse 모듈이 feed 모듈에 의존하게 되어 모듈 경계가 역방향으로 꼬일 수 있음 | Medium | Medium | 신규 엔드포인트 대신 기존 `GET /api/v1/feed/posts`에 `linkedCourseId` 선택 파라미터를 추가하는 방식을 채택한다(FR-04) — feed 모듈이 자기 자신을 필터링할 뿐 tourcourse 모듈을 참조하지 않는다 |
| `TourReferencePicker`에 코스 선택을 그대로 끼워 넣으면 TourAPI 콘텐츠(외부)와 TourCourse(내부) 두 데이터 소스가 한 컴포넌트에서 섞여 상태 관리가 복잡해짐 | Medium | Medium | **해소됨(Design 결정)** — `CourseReferencePicker.jsx`를 별도 컴포넌트로 신설하고 기존 `TourReferencePicker`는 건드리지 않는다(FR-05) |
| 관리자 코스 상세 화면이 아예 없는 상태에서 Q-3을 "어드민에도 노출"로 결정하면, 이 작업 하나가 "관리자 코스 상세 화면 신규 제작"이라는 별도 규모의 하위 작업을 끌고 들어옴 | Medium | **해소됨(Q-3 저비용안 확정)** | 기존 `AdminFeedDetailPage`에 필드만 추가하기로 확정되어 신규 화면 제작은 범위에서 제외됐다 |

---

## 6. 영향 분석

### 6.1 변경 자원 (예상, Q-1~Q-4 결정 후 Design에서 확정)

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `backend/.../feed/domain/FeedPost.java` | 백엔드 수정 | `linkedCourseId`/`linkedCourseDayId`/`linkedCourseStopId` + 스냅샷 컬럼 추가(기존 `tourContentId` 등 TourAPI 필드는 변경 없음) |
| `backend/.../feed/dto/{FeedCreateRequest,FeedPostResponse}.java` | 백엔드 수정 | 일자/경유지 참조 필드(+코스 스냅샷) 추가 |
| `backend/.../feed/repository/{FeedPostRepository,TourCourseDayRepository,TourCourseStopRepository}.java` | 백엔드 수정/신규 | 코스 참조 피드 조회용 커서 쿼리 추가, 일자/경유지 단건 조회용 최소 리포지토리 신규(검증·스냅샷 해석용) |
| `backend/.../feed/controller/FeedController.java`, `.../service/FeedService.java` | 백엔드 수정 | 기존 `GET /api/v1/feed/posts`에 `linkedCourseId` 선택 파라미터 추가(신규 엔드포인트 아님, FR-04) |
| `backend/db/migrations/2026-10-01-tour-course-feed-linking.sql` | 백엔드 신규 | 수동 마이그레이션 SQL(컬럼·FK `ON DELETE SET NULL`·인덱스) |
| `frontend/src/components/feed/FeedComposer.jsx` | 프론트 수정 | 코스/일자/경유지 선택 UI 연결 |
| `frontend/src/components/common/CourseReferencePicker.jsx`(+css) | 프론트 신규 | `TourReferencePicker`는 변경하지 않고 별도 컴포넌트로 신설(FR-05) |
| `frontend/src/pages/TourCourseDetailPage.jsx`, `frontend/src/hooks/useCourseFeedPosts.js` | 프론트 수정/신규 | 참조 피드 섹션 추가 |
| `frontend/src/api/{feedApi.js,courseApi.js}` | 프론트 수정 | 일자/경유지 참조 view model 반영, 코스 필터 fetch 함수 추가 |
| `frontend/src/pages/admin/AdminFeedDetailPage.jsx`, `frontend/src/api/adminFeedApi.js` | 프론트 수정 | "참조한 여행코스" 표시(Q-3 확정) |

**이번 Plan에서 변경하지 않는 것**: `TourCourse`/`TourCourseDay`/`TourCourseStop`(엔티티 구조), `TourCourseAdminService`/`TourCourseAdminController`/`AdminCourseFormPage`(코스 CRUD), 피드 댓글·좋아요·북마크 로직.

### 6.2 현재 사용처 (영향받을 수 있는 곳)

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `FeedPost` | `FeedPostResponse.from()`, `FeedPostRepository`의 각종 `@EntityGraph` 메서드 | `linkedCourseId`는 단순 컬럼(또는 LAZY 연관관계)이라 기존 `@EntityGraph(attributePaths = {"author", "photos"})`에 영향 없음(`feed-comment-integration`에서 `comments` 컬렉션 추가 때 확인한 것과 같은 원리) |
| `TourReferencePicker` | `AdminCourseFormPage`(경유지 REFERENCE 선택), `FeedComposer`(위치 태깅) | 코스 선택 UI를 이 컴포넌트에 직접 추가하면 두 기존 사용처에도 영향이 갈 수 있어, 영향 범위를 최소화하는 방향(탭 추가 vs 별도 컴포넌트)을 Design 단계에서 신중히 결정해야 함 |
| `TourCourseDetailPage` | 공개 코스 상세 화면 | 참조 피드 섹션 추가는 기존 통계·일자별 경유지 렌더링과 독립적으로 추가되므로 영향 낮음 |

---

## 7. 프론트엔드 아키텍처 고려사항

### 7.1 피드 작성 화면의 코스/일자/경유지 선택 UI를 어떻게 넣을 것인가

`TourReferencePicker`는 현재 TourAPI 공개 목록 API(`fetchTourList`)만 호출하고, `kind` 상태도 `TOUR_LIST_CONFIGS`(TourAPI `contentTypeId` 기반 관광지/문화시설 등)만 순회한다. 내부 엔티티인 `TourCourse`는 완전히 다른 API(`courseApi.fetchCourseList`/`fetchCourseDetail`)와 완전히 다른 응답 모양을 쓰므로, 같은 선택 로직으로 묶기 어렵다. 게다가 Q-1 확정(일자 필수 + 경유지 선택)에 따라 이 선택 UI는 TourAPI 피커보다 한 단계 더 깊다(코스 검색 → 일자 선택 → 경유지 선택) — "검색해서 바로 고른다"는 `TourReferencePicker`의 단순한 흐름과 구조 자체가 다르다.

| 선택지 | 장점 | 단점 |
|--------|------|------|
| A) `TourReferencePicker`에 "코스" 탭을 추가해 한 모달에서 TourAPI 콘텐츠와 코스를 모두 검색 | 사용자 입장에서 모달이 하나로 통일됨 | 컴포넌트 내부에서 두 데이터 소스(외부 TourAPI vs 내부 API)의 검색 조건·페이지네이션·응답 변환이 분기되고, Q-1 확정으로 "코스 선택 후 일자·경유지까지 더 고르는" 다단계 흐름이 추가되어 복잡도가 한층 커짐. `AdminCourseFormPage`(경유지 REFERENCE 선택 전용)에서는 "코스" 탭 자체가 의미 없어(코스 안에 코스를 넣을 수 없음) 사용처별로 탭 구성을 다르게 해야 함 |
| B) 코스 선택 전용의 별도 컴포넌트(`CourseReferencePicker.jsx`)를 새로 만들고 `FeedComposer`에서만 사용 | 기존 `TourReferencePicker`(관리자 폼에서도 쓰는 "이미 검증된 코드")를 건드리지 않아 회귀 위험이 낮음. 두 데이터 소스가 애초에 컴포넌트 레벨에서 분리되고, 다단계(코스→일자→경유지) 흐름을 이 컴포넌트 안에서만 자유롭게 설계할 수 있음 | 두 모달의 시각적 톤을 맞추는 별도 작업 필요(다만 `AdminPagination` 등 공용 하위 요소는 그대로 재사용 가능) |

**B안으로 확정한다**(기존 컴포넌트를 "회귀 없이" 재사용해 온 프로젝트 원칙 — `feed-integration.design.md` §5.2 "이미 검증된 코드는 건드리지 않는다" — 과 B안이 맞닿아 있고, Q-1 확정으로 늘어난 선택 단계를 A안으로 흡수하면 `TourReferencePicker`가 두 가지 서로 다른 흐름을 한 컴포넌트에서 관리해야 해 유지보수성이 떨어진다). 구체적인 화면 흐름(코스 검색 목록 → 코스 상세 트리에서 일자/경유지 선택)은 Design 문서에서 확정한다.

### 7.2 코스 상세의 참조 피드 섹션 (Q-2 확정)

- 위치: 기존 코스 통계(`course-detail-stats`)와 일자별 경유지 목록 아래, 별도 섹션으로 추가한다(통계·경유지 렌더링 로직과 독립).
- 로드 방식: 코스 상세 자체는 이미 `useCourseDetail`로 단건 로드하므로, 참조 피드 목록은 **별도 훅**(`useCourseFeedPosts(courseId)`)으로 분리한다 — `feed-comment-integration`이 댓글을 `useFeedComments`로 분리한 것과 같은 이유(한 화면 안에서도 API 모양이 다르면 상태를 섞지 않는다). 내부적으로는 `fetchFeedTimeline({ linkedCourseId: courseId, ... })`(FR-04로 확장된 기존 API)를 호출해, 커서 페이지네이션 인프라를 새로 만들지 않는다.
- 노출 범위: 이 코스의 **어느 일자·경유지를 참조했든** 모두 보여준다(코스 단위 집계) — 쿼리는 `linkedCourseId` 하나로 충분하며, 일자/경유지별로 필터링하지 않는다(Design §4).
- 빈 상태: 참조 피드가 0건이면 "아직 이 코스로 남긴 이야기가 없어요" 같은 명시적 문구를 보여준다(거짓 UI 금지 원칙).

### 7.3 상태 관리

| 상태 | 위치 | 이유 |
|------|------|------|
| 피드 작성 중 선택한 코스/일자/경유지(`courseTag` 후보 — courseId/courseTitle/dayId/dayNumber/stopId/stopName) | `FeedComposer` 내부 state(기존 `locationTag`와 나란히, 서로 독립) | 작성 폼 전용 로컬 상태, 다른 화면과 공유하지 않음. `locationTag`(TourAPI 위치)와 `courseTag`(내부 코스 참조)는 서로 다른 목적의 별개 필드로 동시 보유 가능(Design §6.3) |
| `CourseReferencePicker` 내부의 현재 단계(코스 검색 / 일자·경유지 선택)와 선택 중인 코스 상세 | `CourseReferencePicker` 내부 state | 모달이 닫히면 버려지는 일시적 UI 상태, `FeedComposer`와 공유하지 않고 최종 선택 결과만 콜백으로 전달 |
| 코스 상세의 참조 피드 목록 | `useCourseFeedPosts` 내부 state | `useCourseDetail`과 생명주기는 같지만(같은 courseId에 종속) API 모양이 달라 분리 |

Context·전역 store는 쓰지 않는다(기존 두 사이클과 동일 원칙 유지).

### 7.4 기존 패턴 재사용 방안

| 기존 패턴 | 재사용 가능한가 | 근거 |
|-----------|------------------|------|
| `courseApi.fetchCourseList`/`toCourseCard` | **재사용** | 코스 선택 UI 1단계(코스 검색 목록)는 공개 코스 목록 API와 완전히 동일한 데이터이므로 새로 만들 이유가 없음 |
| `courseApi.fetchCourseDetail`/`toCourseDetail` | **재사용** | 코스 선택 UI 2단계(일자·경유지 트리)는 공개 코스 상세 API가 이미 반환하는 `days[].stops[]` 구조를 그대로 쓸 수 있음 |
| `feedApi.fetchFeedTimeline` | **확장 재사용** | 코스 상세의 참조 피드 목록(FR-06)은 `linkedCourseId` 파라미터 하나만 추가해 기존 커서 페이지네이션 함수를 그대로 호출(FR-04) — 별도의 fetch 함수·페이지네이션 로직을 새로 만들지 않음 |
| `AbortController` + `isAbortError` 요청 취소 패턴 | **재사용** | 코스 선택 검색, 참조 피드 목록 로드 모두 기존 프로젝트 전역 원칙을 따른다 |
| 피드 카드의 TourAPI 위치 태그 → 여행지 상세 링크 패턴(`getTourDetailPath`) | **대칭 적용** | 코스 태그 → 코스 상세 링크는 `getCourseDetailPath`(기존 `courseApi.js`에 이미 존재)로 동일하게 구현 가능 |

---

## 8. 사용자 결정 (결정됨, 2026-10-01)

> `admin-dashboard.design.md` §8이 유보했던 바로 그 질문들이다. 1.2절 재조사로 "구조적으로 막혀 있지는 않다"는 것만 먼저 재확인한 뒤 frontend-lead 참고 의견과 함께 질문으로 제시했고, 아래 네 가지 모두 2026-10-01에 사용자 결정을 받았다.

| # | 결정 | 선택 | 비고 |
|---|------|------|------|
| Q-1 | 연동의 방향과 형태 | **B안 변형 — 코스의 특정 일자(필수) 또는 특정 경유지(선택)까지 참조**(frontend-lead 권장 A안인 "코스 전체 참조만"과는 반대로 결정) | 게시물은 `linkedCourseDayId`를 반드시 가지거나(일자 단위) `linkedCourseDayId`+`linkedCourseStopId`를 함께 가진다(경유지 단위). "코스 전체만" 가리키는 상태는 허용하지 않는다. 세분화 수준(코스/일자/경유지 중 어디까지)은 기존 스키마(`TourCourse`→`TourCourseDay`→`TourCourseStop`)를 그대로 따라가는 "일자 필수 + 경유지 선택"의 2단 nullable 참조로 Design §3에서 구체화했다. 코스 구조 변경·삭제에도 깨지지 않도록 FK `ON DELETE SET NULL` + 스냅샷 컬럼을 함께 설계했다(Design §5, 이 결정이 낳은 신규 리스크에 대한 대응) |
| Q-2 | 코스 상세 화면에 "이 코스를 참조한 피드 목록" 노출 | **A) 노출함**(권장안 채택) | 신규 조회 API가 필요하다는 전제대로, 기존 `GET /api/v1/feed/posts`에 `linkedCourseId` 선택 파라미터를 추가하는 방식으로 구현한다(Design §4, 신규 엔드포인트 대신 기존 커서 페이지네이션 인프라 재사용) |
| Q-3 | 어드민 화면 노출 | **B) 기존 `AdminFeedDetailPage`에 "참조한 코스/일자/경유지" 필드만 추가**(권장안 채택) | 관리자 코스 상세 화면은 이번에 신규로 만들지 않는다. "피드→코스" 방향(이 게시물이 참조한 코스/일자/경유지가 무엇인지)만 기존 화면에 표시한다(Design §7) |
| Q-4 | 기존 피드 게시물(연동 필드 없음) 처리 | **A) 별도 처리 없음**(조사 결과 그대로 확정) | 전부 nullable 컬럼이라 기존 행은 자동으로 "코스 미태그" 상태로 남는다. 마이그레이션·백필 스크립트 불필요(Design §10 마이그레이션 SQL에도 `ALTER TABLE ... ADD COLUMN ... NULL`만 있을 뿐 데이터 이관 구문은 없음) |

구체적인 컬럼 스키마, API 흐름, 컴포넌트 구조, 마이그레이션 SQL은 `docs/02-design/features/tour-course-feed-linking.design.md`에 구체화했다.

---

## 9. 다음 단계

1. [x] `admin-dashboard.design.md` §8, `tour-course-list-integration.design.md` §12 재확인
2. [x] `FeedPost`/`TourCourse` 계열 엔티티, 공개 API, `FeedComposer`/`TourReferencePicker`/`TourCourseDetailPage` 재조사 — 유보 당시 전제가 여전히 유효함을 확인(1.2절)
3. [x] 8장 Q-1~Q-4 사용자 결정(2026-10-01) — Q-1은 권장안과 반대로 일자/경유지 단위 참조로 확정, Q-2~Q-4는 권장안 채택
4. [x] Design 문서 작성(`tour-course-feed-linking.design.md`) — Q-1~Q-4 결정 반영, 엔티티·API·컴포넌트 구조·마이그레이션 SQL 구체화
5. [ ] 백엔드 구현(frontend-support-backend): FR-01~04
6. [ ] 프론트 구현(frontend-lead): FR-05~08
7. [ ] 코드 리뷰(frontend-code-reviewer) + gap 분석
8. [ ] 완료 보고서 → 포트폴리오 추출(frontend-interview-coach)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-10-01 | 초안. `admin-dashboard` §8이 유보한 여행코스-피드 연동을 재조사(엔티티·API·프론트 컴포넌트 재확인)하고, 범위·FR·위험·프론트 아키텍처 고려사항을 정리. Q-1~Q-4 사용자 결정 요청(Draft 상태, Design 착수 보류) | WOOJIN |
| 0.2 | 2026-10-01 | 사용자 결정 반영(Q-1~Q-4). Q-1은 frontend-lead 권장안(코스 전체 참조)과 반대로 "일자 필수 + 경유지 선택"의 2단 참조로 확정되어 §2·§3·§7의 데이터 모델·FR·UI 설계를 전면 재작성. Q-2(코스 상세 참조 피드 노출)·Q-3(`AdminFeedDetailPage`에만 필드 추가)·Q-4(마이그레이션 불필요)는 권장안대로 확정. FK `ON DELETE SET NULL` 참조 무결성 설계를 신규 위험으로 추가. 상태를 Approved로 변경, Design 문서 작성 완료 반영 | WOOJIN |
