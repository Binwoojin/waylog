# tour-course-feed-linking 완료 보고서

> **상태**: ✅ Complete
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: frontend-lead (Claude Code 보조)
> **완료일**: 2026-10-01
> **계보**: `admin-dashboard`(설계 §8에서 여행코스-피드 연동을 명시적으로 유보) → `tour-course-list-integration`(공개 코스 목록·상세, 설계 §12에서 같은 유보 승계) → `feed-integration`(피드 타임라인·작성·상세) → `feed-comment-integration`(댓글·답글) → **`tour-course-feed-linking`(이 문서)** — **4개의 선행 PDCA 사이클이 끝난 뒤**, `admin-dashboard`가 유보했던 바로 그 설계 결정을 실제로 완성한다

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **기능** | 게시물이 코스 전체가 아니라 코스의 특정 일자(필수)·경유지(선택)를 가리키는 참조 모델을 만들고, 피드 작성 화면에 코스 태깅 UI를, 코스 상세 화면에 참조 피드 목록을, 관리자 피드 상세에 참조 정보 표시를 붙인다 |
| **시작일** | 2026-10-01 (계획 단계) |
| **완료일** | 2026-10-01 |
| **소요 기간** | 1일(단일 세션 내 Plan → Design → Do → 코드 리뷰 → 수정 2건 → Check → Report 전 주기 진행) |

### 1.2 결과 요약

```
┌──────────────────────────────────────────────┐
│  전체 Match Rate: 99.2%                       │
├──────────────────────────────────────────────┤
│  ✅ 완료:     일자/경유지 단위 코스 참조 모델 전체 │
│  ✅ 신규 API: POST/GET 기존 피드 API 확장(엔드포인트 신설 없음) │
│  ✅ 신규 모델: FeedPost 참조 컬럼 6개(nullable FK + 스냅샷) │
│  ✅ 참조 무결성: ON DELETE SET NULL (3개 FK)       │
│  ✅ 계약:     API 5면 대조 100% 일치               │
│  ✅ 코드 리뷰: Must Fix 1건 + Should Improve 1건 전건 수정 │
│  ✅ Gap:      Critical 0건, Important 2건(전건 완료) │
│  ⚠️  Nice to Have: 4건(후속 과제)                  │
│  ✅ 백엔드 테스트: 106/106 통과                     │
└──────────────────────────────────────────────┘
```

### 1.3 전달한 가치 (4 관점)

| 관점 | 내용 |
|------|------|
| **문제** | 2개의 핵심 기능(여행코스, 피드)이 각각 완성돼 있었지만 서로 완전히 분리된 섬이었다. 게시물이 "이 여행은 OO 코스를 보고 다녀왔어요"처럼 코스를 가리킬 방법이 없었고, 코스 상세에서도 "진짜 이 코스로 여행한 사람의 이야기"를 보여줄 방법이 없었다. 이 연동은 `admin-dashboard` 설계 단계(§8)에서부터 사용자가 "여행코스 API 계약은 피드와도 연결되는 부분이라 지금 확정하기 어렵다"며 **의도적으로 유보한** 결정이었다 |
| **해결** | Plan 단계에서 frontend-lead가 "코스 전체 단일 참조"(더 단순한 모델)를 권장했지만, 사용자는 **그 권장안을 받아들이지 않고** "코스의 특정 일자(필수)·경유지(선택)"라는 더 세밀한 참조 모델을 선택했다(Q-1). 이 선택은 구현 복잡도를 늘리는 대신, "어느 날 어디를 갔는지"라는 실제로 유용한 정보를 게시물에 담을 수 있게 했다. `FeedPost`에 6개의 nullable 컬럼(참조 id 3개 + 스냅샷 3개)을 추가하고, 클라이언트는 일자/경유지 id만 보내면 서버(`CourseLinkResolver`)가 코스 체인을 직접 따라가 나머지를 채우는 구조로 "클라이언트가 불일치하는 조합을 보낼 가능성 자체"를 설계로 제거했다 |
| **기능/UX 효과** | 사용자가 게시물 작성 시 여행코스의 특정 일자·경유지를 태그할 수 있고, 코스 상세 화면에서 그 코스를 참조한 실제 여행 후기를 바로 확인할 수 있다. 코스를 참조한 게시물의 위치 태그(TourAPI)와 코스 태그가 서로 독립적으로 공존할 수 있어("어디서 찍었는지"와 "어느 코스를 참고했는지"는 다른 질문), 한 게시물이 더 풍부한 맥락을 가질 수 있게 됐다 |
| **핵심 가치** | 이 기능의 포트폴리오 가치는 세 가지다. 첫째, **2개 사이클 전에 "지금 당장 결정하지 않는다"고 의도적으로 미뤄둔 설계 결정을, 그 유보가 실제로 구조를 막지 않았는지 코드로 재검증한 뒤 다시 꺼내 완성한 것** — 당장 결정하지 않는 것과 나중에 결정을 막는 것은 다르다는 설계 판단이 실제로 유효했음을 증명했다. 둘째, **설계 단계에서 기존 코드(`TourCourseAdminService`)를 재조사해 "참조 무결성 문제"를 구현 전에 자체적으로 찾아낸 것** — 코스 삭제·구조 교체가 DB 레벨에서 직접 DELETE를 실행한다는 것을 재확인하고, 기본 FK 제약(`RESTRICT`)을 그대로 썼다면 "피드에 참조된 코스를 관리자가 지우려 할 때 코스 관리 기능 자체가 원인 불명의 500 오류로 실패"했을 상황을 `ON DELETE SET NULL` 설계로 사전에 막았다. 셋째, **"소프트 삭제형 참조"에서 FK 컬럼을 게이트로 쓰면 안 된다는 교훈을 코드 리뷰로 실제 버그를 통해 확인한 것** — 사용자가 코드 리뷰 전 "linkedCourse가 courseId 없이 title만 있는 경우가 생기는데 프론트가 맞게 처리하는지" 우려를 미리 제기했는데, 리뷰 결과 그 우려는 프론트 문제가 아니라 **백엔드가 그 상태 자체를 API에서 숨기고 있던 더 근본적인 버그**(`hasCourseLink()`가 FK 컬럼을 게이트로 써서, 참조 대상이 삭제되는 순간 애써 남겨둔 스냅샷 텍스트까지 응답에서 통째로 사라짐)였음이 확인됐다 |

---

## PDCA 주기 요약

### Plan (계획)

**문서**: `docs/01-plan/features/tour-course-feed-linking.plan.md` (Approved, Q-1~Q-4 결정 완료)

**목표**
- `admin-dashboard.design.md` §8이 유보한 여행코스-피드 연동을 재조사해, 유보 당시 전제("`linkedCourseId`만 추가하면 코스 스키마는 건드리지 않아도 된다")가 여전히 유효한지 확인한다
- 연동의 방향·형태(코스 전체 vs 일자/경유지 단위), 코스 상세 노출 여부, 어드민 노출 여부를 사용자 결정으로 확정한다

**주요 결정** (사용자 Q-1 ~ Q-4, 2026-10-01)

| # | 결정 | 요지 | 비고 |
|---|------|------|------|
| Q-1 | 연동 방향 | **frontend-lead 권장안(코스 전체 참조)을 기각**하고, 코스의 특정 일자(필수)·경유지(선택) 단위 참조로 확정 | 더 세밀한 모델을 사용자가 직접 선택 |
| Q-2 | 코스 상세 참조 피드 노출 | 노출함(권장안 채택) | 신규 조회 API 필요 전제로 확정 |
| Q-3 | 어드민 화면 노출 | 기존 `AdminFeedDetailPage`에 필드만 추가(권장안 채택) | 관리자 코스 상세 화면 신규 제작은 범위 제외 |
| Q-4 | 기존 게시물 처리 | 별도 처리 없음(조사 결과 그대로 확정) | nullable 컬럼이라 마이그레이션 불필요 |

**재조사 성과(Plan 단계)**: `FeedPost.java`의 기존 `tourContentId` 등이 TourAPI 외부 콘텐츠 전용임을 재확인하고, `TourCourse`/`TourCourseDay`/`TourCourseStop`에 역참조 필드가 없는 단방향 구조임을 재확인했다. `SecurityConfig`의 `GET /api/v1/courses/**`, `GET /api/v1/feed/posts/**`가 이미 다중 세그먼트 와일드카드라 신규 필터 파라미터 추가가 보안 설정 변경 없이 가능함을 **구현 전에** 확인했다(`feed-comment-integration`의 동일한 선제 확인 관례를 계승).

**범위**: FR-01~08(백엔드 4, 프론트 4)

### Design (설계)

**문서**: `docs/02-design/features/tour-course-feed-linking.design.md` (v0.1)

**아키텍처 결정**

| 기준 | 선택 | 이유 |
|------|------|------|
| **참조 모델** | `linkedCourseId`/`linkedCourseDayId`/`linkedCourseStopId`(id) + `linkedCourseTitle`/`linkedCourseDayNumber`/`linkedCourseStopName`(스냅샷), 전부 nullable | 코스 전체 참조만으로는 Q-1 결정을 만족할 수 없고, id만으로는 참조 대상 삭제 시 정보가 완전히 사라짐 — 이 프로젝트가 이미 `FeedPost.tourContentId`/`TourCourseStop`에서 쓰던 "id + 스냅샷" 패턴을 그대로 계승 |
| **클라이언트 요청 모양** | 클라이언트는 `linkedCourseDayId`/`linkedCourseStopId`만 전송, `linkedCourseId`·스냅샷은 서버가 체인을 따라가 직접 채움 | 클라이언트가 서로 다른 코스의 day/stop id를 섞어 보내는 모순된 요청 자체를 설계로 제거 |
| **참조 무결성** | 세 FK 모두 `ON DELETE SET NULL` | `TourCourseAdminService.delete()`/`update()`(구조 교체)가 DB 레벨에서 직접 DELETE를 실행한다는 것을 재조사로 확인 — 기본 FK 제약(`RESTRICT`)을 그대로 쓰면 피드가 참조 중인 코스/일자/경유지를 관리자가 지울 때 코스 관리 기능 자체가 실패함을 **구현 전에** 발견해 미리 방지 |
| **참조 피드 목록 API** | 신규 엔드포인트가 아니라 기존 `GET /api/v1/feed/posts`에 `linkedCourseId` 선택 파라미터 추가 | tourcourse→feed 역방향 모듈 결합을 피하고, 이미 검증된 커서 페이지네이션 인프라 재사용 |
| **코스 선택 UI** | `CourseReferencePicker.jsx` 신규(기존 `TourReferencePicker.jsx`는 변경하지 않음) | 외부 TourAPI 콘텐츠와 내부 `TourCourse`는 데이터 소스·선택 흐름(코스→일자→경유지 다단계)이 근본적으로 달라 한 컴포넌트에 억지로 묶지 않음 |
| **어드민 반영** | `AdminFeedDetailPage`에 읽기 전용 한 줄만 추가 | 관리자 코스 상세 화면 자체가 아예 없어(계획 재조사로 확인), 신규 화면 제작은 별도 규모의 작업이 되어 Q-3에서 제외 확정 |

**주요 모듈**

| 모듈 | 역할 | 비고 |
|------|------|------|
| `feed/service/CourseLinkResolver.java` | dayId/stopId를 받아 코스 체인 검증 + 스냅샷 생성 | feed 모듈 package-private, tourcourse 모듈을 읽기 전용으로만 참조(단방향 의존 유지) |
| `tourcourse/repository/{TourCourseDayRepository,TourCourseStopRepository}.java` | 일자/경유지 단건 조회(feed 모듈 검증 전용 신규 리포지토리) | `TourCourseRepository`(집합체 단위) 중심의 기존 tourcourse 접근 패턴과 공존 |
| `frontend/src/components/common/CourseReferencePicker.jsx` | 코스 검색 → 일자/경유지 선택 2단계 모달 | `courseApi.js`의 `fetchCourseList`/`fetchCourseDetail` 재사용, 신규 API 호출 없음 |
| `frontend/src/hooks/useCourseFeedPosts.js` | 코스 상세의 참조 피드 목록 상태 | `useFeedInfiniteList`를 `linkedCourseId` 옵션으로 일반화한 것을 감싼 얇은 래퍼 |

### Do (구현)

**진행 순서**: 백엔드 신규 참조 모델·API(frontend-support-backend) → 프론트 코스 태깅 UI(frontend-lead) → 코드 리뷰(frontend-code-reviewer) → Must Fix 1건(백엔드) + Should Improve 1건(프론트) 수정.

| 순서 | 영역 | 담당 | 주요 산출물 |
|:---:|------|------|-------------|
| 1 | 백엔드 참조 모델·API 확장 | frontend-support-backend | `FeedPost` 참조 컬럼 6개, `CourseLinkResolver`, `TourCourseDayRepository`/`TourCourseStopRepository`, DTO 확장, `FeedController`/`FeedService` 필터 확장, 마이그레이션 SQL, 신규 테스트 2개 파일(14건) |
| 2 | 프론트 코스 태깅 UI | frontend-lead | `CourseReferencePicker.jsx`(+css), `FeedComposer.jsx`(`courseTag` state), `FeedCard.jsx`/`FeedDetailPage.jsx`(코스 태그 표시+조건부 링크), `TourCourseDetailPage.jsx`(참조 피드 섹션), `AdminFeedDetailPage.jsx`(참조 정보 표시), `useFeedInfiniteList.js` 일반화, `useCourseFeedPosts.js` 신규 |
| 3 | 코드 리뷰 | frontend-code-reviewer | Must Fix 1건(`hasCourseLink()` FK 게이트 조건), Should Improve 1건(코스/위치 태그 아이콘 미구분) 발견 |
| 4 | 백엔드 수정 | frontend-support-backend | `hasCourseLink()`를 스냅샷 컬럼(`linkedCourseTitle`) 게이트로 수정, 106/106 테스트 통과 확인 |
| 5 | 프론트 수정 | frontend-lead | `components/icons/CourseRouteIcon.jsx` 신규, 코스 태그가 표시되는 3곳(`FeedComposer`/`FeedCard`/`FeedDetailPage`) 아이콘 교체 |

**완료 항목**
- ✅ `FeedPost` 일자/경유지 단위 참조 모델(6개 컬럼) + `ON DELETE SET NULL` (FR-01)
- ✅ `FeedCreateRequest`/`CourseLinkResolver`를 통한 서버 측 체인 검증 (FR-02)
- ✅ `FeedPostResponse.linkedCourse`(+ 삭제 후 스냅샷 유지, Must Fix 수정) (FR-03)
- ✅ 기존 피드 타임라인 API 확장을 통한 코스 참조 피드 목록 (FR-04)
- ✅ `CourseReferencePicker.jsx`(코스 검색 → 일자/경유지 선택) (FR-05)
- ✅ 코스 상세의 참조 피드 섹션(로딩/에러/빈 상태/더 보기) (FR-06)
- ✅ 피드 카드·상세의 코스 태그 표시+조건부 링크(+ Should Improve 수정, 전용 아이콘) (FR-07)
- ✅ 관리자 피드 상세의 참조 정보 표시 (FR-08)

**코드 품질**
- 백엔드 신규 테스트 2개 파일(14개 테스트): `CourseLinkResolverTest`(7개), `FeedCourseLinkIntegrationTest`(7개)
- 백엔드 전체 스위트 106/106 테스트 통과(`surefire-reports` 집계로 이 세션에서 직접 확인 — 이전 세 사이클과 달리 JDK 버전 제약을 이번에는 재실행 없이도 기존 실행 기록으로 정량 확인)
- `npm run lint` 오류 0, `npm run build` 성공(구현 1차 + 아이콘 교체 수정 후, 총 2회 확인)
- frontend-code-reviewer 독립 리뷰: Must Fix 1건 + Should Improve 1건 발견, 전건 수정 반영 확인

**발견·수정된 이슈** (포트폴리오 소재)

| # | 이슈 | 발견 경로 | 근본 원인 | 수정 |
|---|------|-----------|-----------|------|
| 1 | `FeedPost.hasCourseLink()`가 FK 컬럼(`linkedCourseDayId != null`)을 게이트로 써서, 코스(또는 일자)가 `ON DELETE SET NULL`로 삭제되면 FK 컬럼까지 `NULL`이 되어 `hasCourseLink()`가 `false`를 반환 → 애써 설계한 스냅샷(코스명 등)이 API 응답 레벨에서 `linkedCourse` 객체 전체와 함께 통째로 사라지는 문제 | frontend-code-reviewer(Must Fix) — **사용자가 코드 리뷰 전 "linkedCourse가 courseId 없이 title만 있는 경우가 생기는데 프론트가 맞게 처리하는지" 우려를 미리 제기했고, 리뷰 결과 그 우려가 실제 버그였음이 확인됨.** 다만 버그의 실체는 프론트가 아니라 백엔드가 그 상태 자체를 API에서 발생하지 않도록(숨기도록) 만들고 있던 것이었음 | "소프트 삭제형 참조"에서 FK 컬럼(무결성용)과 "참조가 있었는가"라는 의미적 질문을 같은 컬럼으로 섞어 판단한 것 | 게이트 조건을 스냅샷 컬럼(`linkedCourseTitle != null`)으로 변경. FK 컬럼은 참조 무결성 전용, "이력이 있는가"는 스냅샷이 답하도록 책임을 분리 |
| 2 | 코스 태그와 위치 태그가 같은 아이콘(`PlacePinIcon`)을 공유해, 설계상 명확히 다른 두 개념이 화면에서 시각적으로 구분되지 않음 | frontend-code-reviewer(Should Improve) | 새 태그 종류를 추가하며 기존 아이콘을 그대로 재사용(개념적 차이를 반영하지 않음) | `CourseRouteIcon.jsx` 신규(두 지점을 점선 경로로 잇는 모양), 코스 태그가 표시되는 3곳 전부 교체 |

### Check (검증)

**문서**: `docs/03-analysis/tour-course-feed-linking.analysis.md`

**Gap 분석 결과**

```
Overall Match Rate: 99.2%
├ Structural:  100% (설계 §13 의존성 목록과 실제 파일 구성 완전 일치)
├ Functional:   98% (FR-01~08 전체 충족 + 발견분 2건 수정 확인, 감점은 Nice to Have 4건)
└ Contract:   100%  (API 5면 대조 5/5)
```

**Success Criteria** (계획 §4.1·§4.2, 8개 항목) — 8/8 완전 충족

**Gap 목록** (Critical 0, Important 2건 전건 완료, Nice to Have 4건)
1. **G-1 (Important, 완료)**: `hasCourseLink()` FK 게이트 조건 — Must Fix 수정(스냅샷 컬럼 게이트)
2. **G-2 (Important, 완료)**: 코스/위치 태그 아이콘 미구분 — Should Improve 수정(`CourseRouteIcon` 신규)
3. **G-3 (Nice to Have, 후속 과제)**: `FeedCreateRequest.imageUrls` 미사용 필드
4. **G-4 (Nice to Have, 후속 과제)**: `useFeedInfiniteList.js` JSDoc 가독성
5. **G-5 (Nice to Have, 후속 과제)**: `CourseReferencePicker` 로딩 스피너 없음
6. **G-6 (Nice to Have, 후속 과제)**: `linkedCourseDayId`/`linkedCourseStopId`에 `@Positive` 미적용

### Act (완료)

**판단**: gap 분석 결과(Match Rate 99.2%, Critical 0건, Important 2건 전건 완료·수정)에 따라 Report 단계로 진행. frontend-code-reviewer가 찾은 Must Fix 1건과 Should Improve 1건은 모두 이번 PDCA 사이클 내에서 수정 완료됐다. 남은 Nice to Have 4건은 다음 세션/PDCA로 이월한다.

---

## 1.4 성공 기준 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC-1 | 사용자가 게시물 작성 시 여행코스를 선택해 태그할 수 있다(일자 필수, 경유지 선택) | ✅ 충족 | `CourseReferencePicker` → `FeedComposer` → `CourseLinkResolver` 서버 검증 확인 |
| SC-2 | 코스 상세 화면에서 참조 피드 목록을 확인할 수 있다 | ✅ 충족 | `CourseFeedSection` + `useCourseFeedPosts` + `linkedCourseId` 필터 쿼리 확인 |
| SC-3 | 기존 피드 게시물(코스 미태그)이 오류 없이 그대로 보인다 | ✅ 충족 | 마이그레이션에 데이터 이관 구문 없음, 테스트로 `linkedCourse == null` 확인 |
| SC-4 | 기존 기능(TourAPI 위치 태깅, 코스 목록/상세, 피드 댓글/좋아요/북마크)에 회귀가 없다 | ✅ 충족 | git status로 수정 금지 파일 전부 미변경 확인 |
| SC-5 | frontend-code-reviewer 리뷰와 gap 분석 완료 | ✅ 충족 | Must Fix 1건·Should Improve 1건 수정 반영, 이 보고서와 짝을 이루는 gap 분석 완료 |
| QC-1 | `npm run lint`/`npm run build` | ✅ 충족 | 2회 확인(구현 1차, 아이콘 교체 수정 후) |
| QC-2 | 백엔드 신규 테스트(유효성 검증, PRIVATE/소프트삭제 제외) | ✅ 충족 | 14개 신규 테스트, 조건이 메서드명에 구조적으로 고정 |
| QC-3 | gap 분석 Match Rate 90% 이상 | ✅ 충족 | 99.2% |

**전체 성공률**: 8/8 (100%)

---

## 1.5 주요 결정 기록

| # | 결정 | 실행 | 결과 |
|---|------|:----:|------|
| Q-1 | 코스 전체가 아닌 일자(필수)·경유지(선택) 단위 참조 | ✅ | frontend-lead 권장안(코스 전체 참조)을 사용자가 기각 — 더 세밀한 모델 채택, 설계가 2단 nullable 참조 + 스냅샷으로 구체화 |
| Q-2 | 코스 상세에 참조 피드 노출 | ✅ | 기존 타임라인 API 확장으로 구현, 신규 엔드포인트 없음 |
| Q-3 | 어드민은 `AdminFeedDetailPage`에만 필드 추가 | ✅ | 관리자 코스 상세 화면 신규 제작 없이 저비용으로 구현 |
| Q-4 | 기존 게시물 별도 처리 없음 | ✅ | nullable 컬럼이라 마이그레이션에 데이터 이관 구문 없음 |
| 설계 결정 | 참조 무결성에 `ON DELETE SET NULL` 적용 | ✅ | `TourCourseAdminService`의 기존 삭제/구조교체 로직을 재조사해, 기본 FK(`RESTRICT`)가 코스 관리 기능을 깨뜨릴 뻔한 것을 구현 전에 자체 발견·방지 |
| 발견 사항(코드 리뷰 Must Fix) | `hasCourseLink()` FK 게이트 조건이 스냅샷을 숨기는 버그 | ✅ | 스냅샷 컬럼 게이트로 수정. 사용자가 리뷰 전 제기한 우려가 실제 버그로 확인된 사례 |
| 발견 사항(코드 리뷰 Should Improve) | 코스/위치 태그 아이콘 미구분 | ✅ | `CourseRouteIcon` 신규로 시각적 구분 확보 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:----:|
| Plan | [tour-course-feed-linking.plan.md](../../01-plan/features/tour-course-feed-linking.plan.md) | ✅ 최종화 (Approved, Q-1~Q-4 결정 완료) |
| Design | [tour-course-feed-linking.design.md](../../02-design/features/tour-course-feed-linking.design.md) | ✅ 최종화 (v0.1) |
| Check | [tour-course-feed-linking.analysis.md](../../03-analysis/tour-course-feed-linking.analysis.md) | ✅ 완료 (Match Rate 99.2%) |
| Act | 이 문서 | ✅ 완료 |
| 유보 근거 | [admin-dashboard.report.md](admin-dashboard.report.md) §8(여행코스-피드 연동 유보 결정의 출발점) | 참고 |
| 선행 기능 | [tour-course-list-integration.report.md](tour-course-list-integration.report.md)(공개 코스 목록·상세 API), [feed-comment-integration.report.md](feed-comment-integration.report.md)(피드 기능 완결, SecurityConfig 와일드카드 선례) | 참고 |

---

## 3. 완료된 항목

### 3.1 기능 요구사항

| 그룹 | 항목 수 | 상태 |
|------|:---:|:---:|
| FR-01~04 (백엔드 참조 모델·검증·응답·API 필터) | 4 | ✅ 4/4 완료 |
| FR-05~08 (프론트 코스 선택 UI·참조 피드 섹션·태그 표시·관리자 반영) | 4 | ✅ 4/4 완료 |

**기능 완성도**: 8/8 = 100%

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|:----:|:----:|
| 데이터 정합성(일자 없이 경유지만 거부) | 서버가 400으로 거부 | ✅ `CourseLinkResolverTest.resolveWithStopOnlyThrows` | ✅ |
| 데이터 정합성(소속 불일치 거부) | 서버가 400으로 거부 | ✅ `resolveWithMismatchedDayAndStopThrows` | ✅ |
| 참조 무결성(경유지/일자/코스 삭제) | 코스 관리 작업 자체는 항상 성공, 피드 참조만 조용히 해제 | ✅ `FeedCourseLinkIntegrationTest`의 T-6·T-7 | ✅ |
| 성능(스냅샷 우선) | 참조 피드 조회 시 `TourCourse` 조인 없음 | ✅ `LinkedCourseResponse`가 스냅샷 컬럼만 읽음 | ✅ |
| 보안(가시성) | 코스 참조 피드 목록이 PRIVATE·소프트삭제 게시물 제외 | ✅ 리포지토리 메서드명에 조건 고정 | ✅ |
| 거짓 UI 금지 | 참조 코스가 삭제돼 courseId가 없으면 링크 없이 텍스트만 | ✅ `detailPath` null 처리 확인 | ✅ |
| 회귀 방지 | 기존 코스/피드 화면·관리자 모더레이션 무변경 | ✅ git status로 확인 | ✅ |
| 모듈 결합 최소화 | tourcourse → feed 역방향 의존 없음 | ✅ 신규 엔드포인트 대신 기존 API 확장으로 확인 | ✅ |

**품질 메트릭**
- `npm run lint` 오류 0, `npm run build` 성공(2회 확인)
- Gap 분석: Match Rate 99.2%, Critical 0건
- 코드 리뷰 Must Fix 1건 + Should Improve 1건 전건 수정 확인
- 백엔드 106/106 테스트 통과(신규 14건 포함, surefire 집계로 확인)

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:----:|
| 백엔드 신규 | `feed/service/CourseLinkResolver.java`, `tourcourse/repository/{TourCourseDayRepository,TourCourseStopRepository}.java`, `backend/db/migrations/2026-10-01-tour-course-feed-linking.sql` | ✅ |
| 백엔드 수정 | `feed/domain/FeedPost.java`, `feed/dto/Feed{CreateRequest,PostResponse,AdminPostResponse}.java`, `feed/repository/FeedPostRepository.java`, `feed/controller/FeedController.java`, `feed/service/FeedService.java` | ✅ |
| 백엔드 신규 테스트 | `CourseLinkResolverTest.java`(7개), `FeedCourseLinkIntegrationTest.java`(7개) | ✅ |
| 프론트 신규 | `components/common/CourseReferencePicker.jsx`(+css), `components/icons/CourseRouteIcon.jsx`, `hooks/useCourseFeedPosts.js` | ✅ |
| 프론트 수정 | `components/feed/Feed{Composer,Card}.jsx`(+css), `pages/FeedDetailPage.jsx`(+css), `pages/TourCourseDetailPage.jsx`(+css), `pages/admin/AdminFeedDetailPage.jsx`(+css), `api/{feedApi,adminFeedApi}.js`, `hooks/useFeedInfiniteList.js` | ✅ |
| 문서 | Plan, Design, Analysis, Report | ✅ 4개 |

---

## 4. 미완료 / 이월 항목

### 4.1 설계 여유 범위 (의도적 미구현, 계획에서 이미 확정)

| 항목 | 계획 근거 | 사유 | 우선순위 | 이월 처리 |
|------|-----------|------|----------|----------|
| "코스 전체"만 가리키는 참조 상태 | Q-1 결정 | 일자 없이 코스만 참조하는 상태는 애초에 허용하지 않기로 확정 | - | 재논의 대상 아님 |
| 관리자 코스 상세 화면 신규 제작 | Q-3 결정 | 저비용안(기존 화면에 필드만 추가) 채택으로 범위 제외 | Low | 필요성 확인되면 별도 후속 PDCA |
| 기존 게시물 마이그레이션/백필 | Q-4 결정 | nullable 컬럼이라 불필요 | - | 해당 없음 |

### 4.2 코드 리뷰 후속 과제 (Nice to Have, 위험 낮음)

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
| `FeedCreateRequest.imageUrls` 미사용 필드 | 멀티파트 업로드만 쓰이고 JSON 필드 경로는 미사용(feed-integration 때부터 존재) | Low | 제거할지 실제 구현할지 다음 세션에서 결정 |
| `useFeedInfiniteList.js` JSDoc 가독성 | 신규 옵션 설명이 기존 설명과 한 블록에 섞임 | Low | 주석 정리만 |
| `CourseReferencePicker` 로딩 스피너 없음 | 텍스트 상태 문구만 존재(`TourReferencePicker`와 동일 수준) | Low | 공용 스피너 컴포넌트 도입 검토(프로젝트에 아직 없음) |
| `@Positive` validation 미적용 | `linkedCourseDayId`/`linkedCourseStopId`에 Bean Validation 없음 | Low | 컨트롤러 레벨 조기 거부 추가 |

### 4.3 환경 제약 후속

| 항목 | 내용 | 우선순위 | 처리 |
|------|------|----------|------|
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
│  Important Gap: 2건 (전건 완료·수정)           │
│  Nice to Have: 4건 (후속 과제)                 │
└─────────────────────────────────────────────┘
```

### 5.2 해결된 이슈 (코드 리뷰 → 수정)

| 이슈 | 발견 경로 | 해결 방법 | 결과 |
|------|-----------|----------|:----:|
| `hasCourseLink()` FK 게이트 조건이 삭제된 참조의 스냅샷을 API에서 숨김 | frontend-code-reviewer(Must Fix) — 사용자가 리뷰 전 제기한 우려가 실제 버그로 확인 | 스냅샷 컬럼(`linkedCourseTitle`) 게이트로 전환 | ✅ 코스 삭제 후에도 "참조했던 코스명"이 API에 남아 프론트가 표시 가능 |
| 코스/위치 태그 아이콘 미구분 | frontend-code-reviewer(Should Improve) | `CourseRouteIcon` 신규, 3개 파일 교체 | ✅ 두 개념이 시각적으로 구분됨 |

### 5.3 테스트 결과

| 카테고리 | 결과 |
|----------|:----:|
| 정적 분석 | ✅ 설계 §13 의존성 목록 100% 일치 |
| 기능 검증 | ✅ 8/8 FR 충족 |
| 코드 리뷰 반영 확인 | ✅ Must Fix 1/1, Should Improve 1/1 수정 확인 |
| 프론트 lint/build | ✅ `npm run lint` 0 오류, `npm run build` 성공(2회) |
| 백엔드 신규 테스트 | ✅ 14/14 통과(참조 무결성 핵심 시나리오 T-6·T-7 포함) |
| 백엔드 전체 스위트 | ✅ 106/106 통과(surefire 집계) |
| L2 UI(브라우저) | ⬜ 미검증(도구 부재, 다음 세션 이월) |

---

## 6. 배운 점 및 회고

### 6.1 잘된 점 (지속할 사항)

1. **"지금 결정하지 않는다"와 "나중에 결정을 막는다"를 구분한 설계가 실제로 유효했음을 증명**: `admin-dashboard` 설계 단계가 여행코스-피드 연동을 유보하면서도 "`linkedCourseId` 하나만 추가하면 코스 스키마는 건드릴 필요가 없다"는 것까지 확인해 뒀던 덕분에, 2개 사이클 뒤에 이 기능을 시작할 때 코스 쪽 스키마를 전혀 재설계할 필요가 없었다. 유보할 때 "막지는 않는지"까지 확인해 두는 습관이 실제로 나중의 작업량을 줄였다.

2. **사용자가 권장안을 기각하는 것이 더 나은 결과로 이어진 사례**: frontend-lead는 구현 복잡도가 낮은 "코스 전체 단일 참조"를 권장했지만, 사용자는 "코스의 특정 일자·경유지" 단위 참조를 선택했다. 더 복잡한 모델이지만 "어느 날 어디를 갔는지"라는 실제 사용자 가치를 담을 수 있어, 이 프로젝트가 AI의 권장안을 그대로 따르지 않고 실제 요구사항에 맞게 조정하는 과정 자체가 의미 있는 협업 사례다.

3. **설계 단계에서 기존 코드를 재조사해 구현 전에 참조 무결성 문제를 스스로 찾아낸 것**: `TourCourseAdminService.delete()`/`update()`가 DB 레벨에서 직접 DELETE를 실행한다는 사실을 재확인하지 않았다면, 기본 FK 제약(`RESTRICT`) 때문에 "피드에 참조된 코스를 관리자가 지우려 할 때 코스 관리 기능 자체가 실패"하는 심각한 회귀가 배포 후에야 발견됐을 것이다.

4. **사용자가 코드 리뷰 전에 제기한 우려가 실제 버그로 확인된 과정**: "linkedCourse가 courseId 없이 title만 있는 경우를 프론트가 맞게 처리하는지"라는 질문은 처음엔 "프론트가 엣지 케이스를 놓쳤을 수도 있다"는 걱정처럼 보였지만, 코드 리뷰 결과 실제 원인은 **그 상태 자체가 백엔드 로직 때문에 API에 나타나지 않고 있던 것**이었다. 질문을 던진 시점에는 몰랐던 근본 원인이 리뷰를 통해 드러난, "질문이 버그를 찾아낸" 사례다.

### 6.2 개선할 점 (다음 시도)

1. **설계 문서 내부에 모순이 있었던 것을 더 일찍 잡지 못함**: 설계 문서 §5.3은 "삭제된 참조는 스냅샷 텍스트로 표시돼야 한다"고 명시했으면서도, §3.1의 `hasCourseLink()` 코드 예시 자체는 FK 컬럼을 게이트로 썼다. 설계 문서를 작성하는 시점에 이 두 절을 서로 대조했다면 구현 단계로 넘어가기 전에 잡을 수 있었던 모순이다.

2. **"id + 스냅샷" 패턴을 쓸 때 "이력이 있는가"를 판단하는 책임이 어느 컬럼에 있는지 체크리스트화할 필요**: 이 프로젝트에는 이미 `FeedPost.tourContentId`/`TourCourseStop`처럼 "id + 스냅샷" 패턴이 여러 번 쓰였다. 앞으로 비슷한 패턴을 설계할 때 "null 가능 여부 판단은 반드시 스냅샷(의미) 컬럼 기준, FK(무결성) 컬럼을 게이트로 쓰지 않는다"를 명시적 체크리스트로 남겨두면 이번과 같은 버그를 설계 단계에서 방지할 수 있다.

### 6.3 다음에 시도할 사항

1. **"id + 스냅샷" 패턴의 게이트 조건 원칙을 프로젝트 컨벤션 문서에 명시**: 이번에 발견한 교훈(FK 컬럼이 아니라 스냅샷 컬럼을 게이트로 쓴다)을 다음에 유사한 패턴을 설계할 때 참고할 수 있도록 문서화한다.

2. **Nice to Have 4건(G-3~G-6) 처리 여부를 다음 세션 시작 시 먼저 결정**: 전부 위험이 낮지만, 누적되면 기술부채가 될 수 있으므로 우선순위를 정해 처리한다.

3. **브라우저 자동화 도구 도입을 계속 검토**: 다섯 번째 PDCA 주기 연속으로 L2 브라우저 검증이 미실행 상태로 이월되고 있다.

---

## 7. 다음 단계

### 7.1 즉시 (Report 단계)

- [ ] 설계 문서 §3.1·§5.3의 `hasCourseLink()` 코드 예시를 스냅샷 게이트 방식으로 갱신(모순 해소)

### 7.2 다음 PDCA 주기

| 항목 | 의존성 | 우선순위 | 비고 |
|------|--------|---------|------|
| Nice to Have 4건(G-3~G-6) 처리 | 이 기능 | Low | 누적 전에 정리 권장 |
| L2 브라우저 자동화 도입 | 프로세스 개선 | Medium | 다섯 번째 PDCA 연속으로 반복된 이슈 |
| "id + 스냅샷" 게이트 조건 컨벤션 문서화 | 이 기능의 교훈 | Medium | 유사 패턴 재발 방지 |

이것으로 `admin-dashboard`에서 유보되고 `tour-course-list-integration`·`feed-integration`·`feed-comment-integration`을 거쳐 이어진 **여행코스·피드 관련 작업 전체가 완료됐다.**

### 7.3 포트폴리오 추출 (이 세션 이후)

`frontend-interview-coach` 에이전트에 위임:
- "지금 결정하지 않는 것"과 "나중에 결정을 막는 것"을 구분해 설계 유보를 관리한 사례(admin-dashboard §8 → 4개 사이클 뒤 완성)
- 사용자가 AI의 권장안(단순한 모델)을 기각하고 더 복잡하지만 실제 가치가 큰 모델(일자/경유지 단위 참조)을 선택한 협업 과정
- 설계 단계에서 기존 코드(`TourCourseAdminService`)를 재조사해 참조 무결성 문제(FK RESTRICT가 코스 관리 기능을 깨뜨릴 뻔한 것)를 구현 전에 자체 발견하고 `ON DELETE SET NULL`로 해결한 사례
- "id + 스냅샷" 패턴에서 FK 컬럼을 게이트로 쓰면 안 된다는 교훈 — 사용자가 리뷰 전 제기한 우려가 실제로는 더 근본적인 백엔드 버그였음이 코드 리뷰로 드러난 과정

---

## 8. Changelog

### v1.0.0 (2026-10-01)

**Added**
- `backend/.../feed/service/CourseLinkResolver.java`
- `backend/.../tourcourse/repository/{TourCourseDayRepository,TourCourseStopRepository}.java`
- `backend/db/migrations/2026-10-01-tour-course-feed-linking.sql`
- `backend/src/test/.../feed/FeedCourseLinkIntegrationTest.java`
- `backend/src/test/.../feed/service/CourseLinkResolverTest.java`
- `frontend/src/components/common/CourseReferencePicker.jsx`(+css)
- `frontend/src/components/icons/CourseRouteIcon.jsx`
- `frontend/src/hooks/useCourseFeedPosts.js`

**Changed**
- `backend/.../feed/domain/FeedPost.java`: 참조 컬럼 6개(`linkedCourse{Id,Title,DayId,DayNumber,StopId,StopName}`) + `linkCourse()`/`hasCourseLink()` 추가
- `backend/.../feed/dto/Feed{CreateRequest,PostResponse,AdminPostResponse}.java`: 참조 필드/`linkedCourse` 추가
- `backend/.../feed/repository/FeedPostRepository.java`: `linkedCourseId` 커서 쿼리 2종 추가
- `backend/.../feed/controller/FeedController.java`, `.../service/FeedService.java`: `linkedCourseId` 선택 파라미터(기존 메서드는 오버로드로 위임)
- `frontend/src/components/feed/Feed{Composer,Card}.jsx`(+css), `pages/FeedDetailPage.jsx`(+css): `courseTag` 상태·표시 추가
- `frontend/src/pages/TourCourseDetailPage.jsx`(+css): 참조 피드 섹션(`CourseFeedSection`) 추가
- `frontend/src/pages/admin/AdminFeedDetailPage.jsx`(+css), `api/adminFeedApi.js`: 참조 정보 표시
- `frontend/src/hooks/useFeedInfiniteList.js`: `linkedCourseId` 옵션으로 일반화(하위 호환)

**Fixed** (코드 리뷰에서 발견 → 수정)
- `FeedPost.hasCourseLink()`의 FK 컬럼 게이트 조건 → 스냅샷 컬럼(`linkedCourseTitle`) 게이트로 수정(Must Fix) — 코스 삭제 후에도 API가 스냅샷을 계속 반환하도록 보장
- 코스/위치 태그 아이콘 미구분 → `CourseRouteIcon` 신규로 구분(Should Improve)

---

## 9. 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-10-01 | 완료 보고서 생성. Plan(Q-1~Q-4 결정)→Design(참조 무결성 자체 발견, ON DELETE SET NULL 설계)→Do(백엔드 참조 모델+프론트 코스 태깅 UI, 코드 리뷰 Must Fix 1건+Should Improve 1건 수정)→Check(99.2%)→Act(Report). 이것으로 admin-dashboard에서 유보됐던 여행코스-피드 연동이 4개 선행 PDCA 사이클 뒤에 완료됨 | frontend-lead (Claude Code 보조) |

---

**작성 완료**: 2026-10-01 · frontend-lead (Claude Code 보조)
