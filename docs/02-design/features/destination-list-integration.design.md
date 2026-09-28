# destination-list-integration 설계 문서

> **요약**: 관광지·문화시설 카탈로그와 여행지 검색 결과를 `/api/v1/search` 실제 데이터로 전환한다. 목록 조건(유형·분류·지역·시군구·정렬·페이지)은 URL을 유일한 상태 원천으로 삼는다. 순수 함수(`lib/tourListQuery`)가 URL을 파싱·정규화·직렬화하고, `useTourList`가 요청 취소와 늦은 응답 무시를 처리하며, 표시 컴포넌트(`components/tour-list/`)는 두 화면이 공유한다. 검색 모달은 공통 틀(`SearchModalFrame`)과 option 모델로 다시 만들고, 즐기기 모달은 어댑터로 기존 한글 라벨 쿼리를 그대로 유지한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-28
> **상태**: Draft (설계안 B, 사용자 결정 Q-1 ~ Q-6 반영)
> **버전**: 0.1
> **계획 문서**: `docs/01-plan/features/destination-list-integration.plan.md` (FR-01 ~ FR-16, D-1 ~ D-8)
> **이전 기능**: `docs/02-design/features/tour-detail-integration.design.md`

---

## Context Anchor

> 계획 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | 목록과 검색이 목업이라 검색 → 목록 → 상세 흐름이 실제 데이터로 이어지지 않고, 필터 상태가 뒤로 가기에서 사라진다 |
| **WHO** | 지역·유형으로 여행지를 찾는 방문자, 상세를 보고 목록으로 돌아오는 사용자, 공유된 목록 URL로 들어오는 사용자 |
| **RISK** | TourAPI 일일 1,000회 한도 (특히 중분류 필터의 전체 조회) / 목업 탭과 API 분류 체계 불일치 / 늦게 도착한 응답이 최신 결과를 덮어씀 / 목업에 의존하는 상세 "주변 장소" 섹션 |
| **SUCCESS** | 카탈로그·검색 결과가 실제 API 데이터와 totalCount를 표시 / 필터·페이지가 URL에 반영되고 뒤로 가기로 복원 / 로딩·에러·빈 상태 구분 / 카드 → 상세 제목 일치 / 빠른 조건 변경에도 마지막 조건의 결과만 표시 |
| **SCOPE** | 프론트: client.js signal, tourApi 목록 함수·view model, useTourList, 공통 목록 컴포넌트, DestinationCatalogPage(관광지·문화), DestinationSearchResultsPage, SearchModal/TravelSearchModal, DestinationsPage 지역 카드 링크 / 백엔드: 중분류 조회 호출량 방어, arrange 검증 |

---

## 계획 대비 변경

설계 단계에서 계획 문서와 달라진 점이다. 계획 문서에도 반영해야 한다(§13.2).

| # | 항목 | 계획 | 설계 | 이유 |
|---|------|------|------|------|
| P-1 | 즐기기 검색 모달 | 즐기기 전환 제외. `SearchModal` props 호환만 유지 | **`EnjoySearchModal.jsx` 수정**: option 모델 + 어댑터로 이전. `EnjoySearchResultsPage.jsx`는 수정하지 않음 | 사용자 선택 B안. 두 모달이 같은 틀·선택 로직을 쓰게 한다. 결과 페이지가 읽는 쿼리 형식은 바이트 단위로 같게 유지한다(§3.6) |
| P-2 | local-mock 목 클라이언트 | "설계 단계에서 필요성 재판단" (후속-3) | **포함 (BE-4, 최소 개선)** | Q-4 결정. 호출 한도를 쓰지 않고 페이지네이션·빈 상태·문화시설 탭을 확인할 수 있다 |
| P-3 | 분류 선택지의 출처 (FR-12, FR-13) | 모달 선택지를 `/classifications`로 만들고 캐시 | **`data/tourListConfigs.js`의 정적 정의 사용. `/classifications`는 호출하지 않음** | D-3으로 허용 분류가 고정됐다(관광지 대분류 4개, 문화시설 중분류 4개). URL 정규화는 동기 화이트리스트가 필요한데, API 응답을 기다리면 첫 렌더에서 검증할 수 없다. 같은 코드 목록을 두 곳에 두지 않기 위해 정적 정의 하나로 탭·모달·검증을 모두 처리한다. 메모리 캐시(FR-13)는 지역·시군구만 해당한다 |
| P-4 | 카드 북마크 버튼 | 제거 또는 숨김 (설계에서 결정) | **제거** | Q-1 결정. 저장되지 않는 버튼은 사용자를 속인다 |
| P-5 | 검색 모달의 "여행코스" 유형 | 언급 없음 | **비활성 + '준비 중' 표시** | Q-5 결정. D-1로 코스 목록이 목업이라 선택 조건을 적용할 수 없다 |
| P-6 | 조건 없는 `/destinations/search` | 언급 없음 | **no-query 상태**: 안내 + 모달 열기 버튼. API 호출 없음 | Q-6 결정. 의미 없는 전국 조회를 막는다 |
| P-7 | 모달 포커스 관리 | 언급 없음 (NFR 접근성은 목록 영역만) | **`SearchModalFrame`에서 처리**: 초기 포커스·닫을 때 복원(필수), Tab 순환(여유 범위) | §5.4. 두 모달에 한 번에 적용된다 |
| P-8 | 백엔드 테스트 | `mvnw clean test` 통과 | 단위 테스트 2개 추가 (`TourSearchRequestTest`, `TourClassificationSearchServiceTest`) | FR-15·FR-16 규칙을 curl 없이 고정한다 |
| P-9 | 정렬 옵션 (FR-07) | "예: 최신순 Q, 이름순 O" | **Q(기본)·O 두 개로 확정** | Q-2 결정. 둘 다 "대표 이미지 있는 항목만" 반환하므로 정렬을 바꿔도 totalCount가 같다 |
| P-10 | 중분류 조회 상한 (FR-15) | "최대 페이지 상한" | **20페이지(2,000건). 초과분은 버리고 서버 WARN 로그**. 실제 키로 문화시설 전국 건수를 확인한 뒤 확정 | Q-3 결정 |

---

## 1. 개요

### 1.1 설계 목표

- 목록은 실제 여행지와 정확한 총 건수를 보여 준다. 목업 복제나 가짜 페이지를 만들지 않는다.
- 사용자가 고른 조건은 URL에만 둔다. 상세에서 뒤로 오거나, URL을 공유하거나, 새로고침해도 같은 목록이 나온다.
- 조건을 빠르게 바꿔도 마지막 조건의 결과만 화면에 남는다.
- 카탈로그와 검색 결과, 여행지 모달과 즐기기 모달이 같은 코드를 쓰되, 각 화면이 다른 부분(상단 UI, 쿼리 형식)만 따로 가진다.

### 1.2 설계 원칙

- **URL이 유일한 원천**: 목록 조건을 `useState`에 복사하지 않는다. 매 렌더에서 URL을 파싱한 값(파생값)을 쓴다.
- **React 밖의 규칙은 순수 함수로**: 파싱·정규화·직렬화·페이지 창 계산은 React를 import하지 않는 `lib/`에 둔다. 테스트 러너가 생기면 바로 단위 테스트할 수 있다.
- **분리에는 이유가 있어야 한다**: 각 모듈마다 재사용처·테스트 용이성·변경 이유 중 하나 이상을 §2.2에 적는다. 이유가 없으면 합친다.
- **기존 동작 보존**: 즐기기 결과 페이지, 코스 목업 목록, 상세 목업 분기는 동작을 바꾸지 않는다.
- **거짓 UI 금지**: 저장되지 않는 북마크, 적용되지 않는 정렬('지역순'), 선택해도 결과가 같은 유형(여행코스)은 보여 주지 않거나 비활성으로 표시한다.
- **fail-closed**: 200이지만 형식이 다른 응답은 성공으로 보지 않는다(`client.js`는 JSON이 아닌 응답을 `{}`로 돌려준다).
- 새 의존성은 추가하지 않는다(react-query 미사용, 계획 7.2).

---

## 2. 아키텍처

### 2.0 설계안 비교와 결정

| 기준 | A. 최소 변경 | **B. 클린 아키텍처 (선택)** | C. 실용적 균형 (추천안이었음) |
|------|:---:|:---:|:---:|
| 접근 | 기존 파일 안에서 해결 | 관심사 분리 극대화: 쿼리 모듈, 목록 훅, 표시 컴포넌트, 필터 정의 설정, 모달 틀·선택 reducer | 목록 섹션 하나 공유, 모달은 틀만 추출 |
| 새 파일 / 수정 파일 (프론트) | 1 / 8 | **19 / 12** | 10 / 9 |
| 변경 규모 (프론트+백엔드) | 약 +500 / -90 | **약 +1,450 / -180** | 약 +750 / -120 |
| 상태 흐름 | URL을 페이지마다 인라인 파싱 (중복) | URL → `lib/tourListQuery` → `useListSearchParams` → `useTourList` → `TourListView` → 표시 컴포넌트 | URL → 파싱 훅 → `TourListSection` |
| 카탈로그·검색 결과 공유 | 페이지 파일끼리 import | 컨테이너 + 표시 컴포넌트 공유 | 섹션 하나 공유 |
| 즐기기 모달 | 공용 모달 안에서 variant 분기 | option 모델로 이전, 어댑터로 라벨 쿼리 유지 | 수정하지 않음 |
| 즐기기 페이지 재사용 | 낮음 | 매우 높음 (설정 항목 추가) | 높음 |
| 복잡도 | 낮음(파일 수) / 파일 안은 높음 | 높음 | 중간 |
| 유지보수성 | 낮음 | 높음 | 높음 |
| 위험 | 중간 ~ 높음 | 중간 (즐기기 모달 수정) | 낮음 |
| 포트폴리오 설명력 | 낮음 | 중간 ~ 높음 (분리 근거를 설명할 수 있으면 높음) | 높음 |

**결정: B** (사용자 선택, 2026-09-28. frontend-lead 추천은 C였다)

**B안의 위험과 대응**
- **과설계로 보일 위험**: 모든 모듈의 분리 근거를 §2.2에 한 줄씩 남긴다. 근거가 약한 분리는 설계 단계에서 합쳤다(예: `usePaginationRange` 훅 → 순수 함수 `getPageWindow`, 모달 스텝 컴포넌트 3개 → `SearchOptionGroup` 1개, `useRegions`·`useDistricts` → 파일 하나).
- **즐기기 검색 회귀**: 결과 페이지는 수정하지 않고, 어댑터가 만든 쿼리 문자열이 기존과 같은지 L2에서 확인한다(§8.3 "즐기기 검색 회귀").
- **작업량**: 모듈 단위로 세션을 나눈다(§11.3).

### 2.1 구성도

```
                         URL (?lDongRegnCd=&lDongSignguCd=&lclsSystm1|2=&arrange=&page=)
                                        │  유일한 상태 원천
       ┌────────────────────────────────┼─────────────────────────────────┐
       ▼                                ▼                                 ▼
 TourCatalogPage (12·14)       DestinationSearchResultsPage        TravelSearchModal
  탭(Link)·ListFilterBar         조건 배너·정렬                      (열릴 때 마운트, URL로 초기화)
       │                                │                                 │
       └──────── useListSearchParams(options) ─────────┘       useSearchSelection (reducer)
                    │ parseTourListQuery / serialize            useRegions / useDistricts
                    │ (lib/tourListQuery.js, 순수)                          │
                    ▼                                                       ▼
              query (파생값)                                  SearchModal (3단계 조건 폼)
                    │                                          ├ SearchModalFrame (틀·포커스)
                    ▼                                          └ SearchOptionGroup × 4
              TourListView (컨테이너)                                       │
               │ useTourList(query)                           navigate('/destinations/search?...')
               │   ├ AbortController + isActive
               │   └ fetchTourList(query, { signal }) ──▶ apiClient.get('/api/v1/search?...', { signal })
               ▼
   ┌───────────┬──────────────┬─────────────┬──────────┐
 idle       loading        refreshing      success     error
 (no-query) TourCardSkeleton TourCardGrid  TourCardGrid ListStatus
 ListStatus                 (aria-busy)    + Pagination (400 / 기타)
                                                        empty → ListStatus

 EnjoySearchModal ── 어댑터(라벨 option, 라벨 쿼리, location.href) ──▶ SearchModal (같은 폼)
                                                                         └▶ /enjoy/search?region=&district=&type=&detail=  (기존과 동일)
```

### 2.2 모듈과 분리 근거

| 모듈 | 역할 | 분리 근거 (재사용처 / 테스트 / 변경 이유) |
|------|------|------------------------------------------|
| `lib/tourListQuery.js` | URL ↔ query 파싱·정규화·직렬화, API 파라미터 변환 | 재사용: 카탈로그·검색 결과·검색 모달 3곳. 테스트: React 없는 순수 함수. 변경 이유: URL 스키마가 바뀔 때만 수정 |
| `lib/pagination.js` | `getPageWindow(page, totalPages, size)` | 테스트: 경계값(1페이지, 끝 페이지, 총 3페이지)이 많은 계산. 상태가 없어 훅이 아닌 순수 함수 |
| `data/tourListConfigs.js` | 목록 종류별 contentTypeId, 분류 파라미터, 분류 목록, 문구 | 재사용: 탭·모달·URL 검증이 같은 목록을 읽음. 변경 이유: 즐기기 목록 추가 시 이 파일에 항목만 추가 |
| `hooks/useListSearchParams.js` | `useSearchParams` 래핑. query, `updateQuery`, `resetQuery`, 정규화 `replace` | 재사용: 두 목록 페이지. 변경 이유: 히스토리 정책(push/replace)을 한 곳에서 결정 |
| `hooks/useTourList.js` | 목록 조회 상태 머신, 취소, 재시도 | 재사용: 두 목록 페이지 + 이후 즐기기. 변경 이유: 비동기 정책(캐시·프리페치 도입 등)이 바뀔 때만 수정 |
| `hooks/useRegionOptions.js` | `useRegions()`, `useDistricts(code)` | 재사용: `ListFilterBar`, 검색 모달, 검색 결과 배너(코드 → 이름) 3곳 |
| `hooks/useSearchSelection.js` | 모달 선택 reducer (지역 변경 시 시군구 초기화 등) | 재사용: 여행지·즐기기 모달. 테스트: reducer는 순수 함수로 export |
| `components/tour-list/TourListView.jsx` | 컨테이너: 훅 호출, 상태별 분기, 페이지 초과 보정 | 재사용: 두 목록 페이지 (D-7). 페이지는 URL 해석, View는 데이터와 상태 UI로 경계를 나눈다 |
| `TourCardGrid.jsx` / `TourCard.jsx` | 카드 그리드·카드 | 재사용: 이후 즐기기 카테고리. 변경 이유: 카드 디자인 변경이 상태 로직에 영향 없음 |
| `TourCardSkeleton.jsx` | 첫 로딩 자리 표시 | 레이아웃 안정성 요구(NFR)를 그리드와 같은 치수로 한 곳에서 보장 |
| `ListStatus.jsx` | 오류·빈 결과·조건 없음 안내 블록 | 재사용: 두 페이지 × 4가지 상태. 포커스·`role` 규칙을 한 곳에 둠 |
| `Pagination.jsx` | 윈도잉 페이지 버튼 | 재사용: 두 페이지. 접근성 속성(`aria-current`, `aria-label`)을 한 곳에 둠 |
| `ListFilterBar.jsx` | 지역·시군구·정렬 select | 재사용: 카탈로그 2종(지역+정렬), 검색 결과(정렬만) |
| `listMessages.js` | 목록 문구 상수 | 컴포넌트 파일에서 상수를 export하면 `react-refresh/only-export-components` 경고 (이전 기능 C-2와 같은 이유) |
| `components/search/SearchModalFrame.jsx` | 오버레이·Esc·스크롤 잠금·포커스 관리·헤더·푸터 | 재사용: 두 모달. 변경 이유: 접근성 동작은 내용과 무관하게 바뀜 |
| `SearchOptionGroup.jsx` | 선택지 버튼 그룹 (로딩·오류·비활성 표시) | 재사용: 시·도, 시군구, 유형, 세부 항목 4단계 × 2모달 |
| `SearchModal.jsx` (재작성) | 3단계 조건 폼 (제어 컴포넌트) | 재사용: 두 모달이 같은 화면 구조를 씀. 데이터 출처와 쿼리 형식은 모름 |
| `TravelSearchModal.jsx` / `EnjoySearchModal.jsx` | 선택지 출처, 초기 선택값, 제출 방식 | 변경 이유가 서로 다름(코드 쿼리·navigate vs 라벨 쿼리·전체 이동) |
| `pages/TourCatalogPage.jsx` | 관광지·문화시설 카탈로그 | 코스(목업)와 훅 구성이 달라 라우트를 분리. 한 컴포넌트에서 분기하면 코스에서도 목록 훅이 실행됨 |

### 2.3 상태의 원천과 데이터 흐름

| 상태 | 위치 | 이유 |
|------|------|------|
| 목록 조건 (유형·분류·지역·시군구·정렬·페이지) | **URL** | 뒤로 가기 복원, 공유, 새로고침 유지. 백엔드 캐시 키와 일치 |
| 파싱한 query | 렌더 중 계산 (파생값, state 아님) | URL과 어긋날 수 없다 |
| 목록 요청 상태·결과 | `useTourList` 내부 state | 서버 상태. 이 목록을 보는 컴포넌트만 필요 |
| 지역·시군구 목록 | `tourApi` 모듈 Promise 캐시 + `useRegionOptions` state | 로컬 JSON API라 앱 수명 동안 변하지 않음 (FR-13) |
| 모달 선택값 | `useSearchSelection` (모달 마운트 동안만) | "검색"을 누르기 전의 임시 값. URL에 쓰면 입력 중에 목록이 바뀐다 |
| 카드 이미지 로드 실패 | `TourCard` state | 카드 하나에만 해당. `key=contentId`로 재마운트 |

Context와 전역 store는 쓰지 않는다. 목록 조건을 공유하는 컴포넌트는 모두 같은 URL을 읽기 때문이다.

**히스토리 정책**

| 동작 | 방식 | 이유 |
|------|------|------|
| 탭·지역·시군구·정렬 변경 | push | 뒤로 가기로 직전 조건에 돌아갈 수 있다 |
| 페이지 이동 | push | 상세 → 뒤로 → 같은 페이지 |
| 모달 "검색" | push (`navigate`) | 새 검색 |
| 잘못된 쿼리 정규화 | **replace** | 잘못된 URL이 히스토리에 남아 뒤로 가기가 다시 정규화되는 루프를 막는다 |
| 페이지 초과 보정 (FR-09) | **replace** | 같은 이유 |

### 2.4 `useTourList` 상태 머신과 경쟁 조건

**입력과 출력**

```js
// hooks/useTourList.js
useTourList(query)   // query: 정규화된 query 객체 또는 null (조건 없음)
// → { status, data, errorKind, retry, hasRetried }
// status: 'idle' | 'loading' | 'refreshing' | 'success' | 'error'
// data: { items: TourCard[], totalCount, page, totalPages } | null   (refreshing 중에는 이전 결과)
// errorKind: 'invalid' (400) | 'failed' (그 외) | null
```

**상태 전이**

| 현재 | 이벤트 | 다음 | 화면 |
|------|--------|------|------|
| (없음) | query = null | idle | no-query 안내 (§5.1) |
| (없음) / idle | query 있음 | loading | 스켈레톤 |
| loading | 응답 성공 | success | 그리드 (0건이면 empty) |
| loading | 응답 실패 | error | 오류 블록 |
| success | query 변경 | refreshing | 이전 카드 유지 + `aria-busy` + 흐리게 |
| refreshing | 응답 성공 | success | 새 카드 |
| refreshing | 응답 실패 | error | 오류 블록 (이전 카드는 버림: 다른 조건의 결과를 계속 보여 주면 오해를 부름) |
| error | retry | loading (이전 결과 없음) | 스켈레톤 |
| 요청 중 | query 다시 변경 | 이전 요청 abort, 같은 상태 유지 | - |

**구현 방식: 렌더 중 파생**

```js
export function useTourList(query) {
  const queryKey = query ? serializeTourListQuery(query).toString() : null
  const [attempt, setAttempt] = useState(0)
  const requestKey = queryKey == null ? null : `${queryKey}#${attempt}`
  // 마지막으로 끝난 요청의 결과. 진행 중 여부는 state에 쓰지 않고 key 비교로 계산한다.
  const [settled, setSettled] = useState({ key: null, status: null, data: null, errorKind: null })

  useEffect(() => {
    if (requestKey == null) return undefined
    const controller = new AbortController()
    let isActive = true
    fetchTourList(query, { signal: controller.signal })
      .then(data => { if (isActive) setSettled({ key: requestKey, status: 'success', data, errorKind: null }) })
      .catch(error => {
        if (!isActive || isAbortError(error)) return
        const errorKind = error instanceof ApiError && error.status === 400 ? 'invalid' : 'failed'
        if (errorKind === 'failed') console.error('여행지 목록을 불러오지 못했습니다.', error)
        else console.warn('목록 요청이 400으로 거절되었습니다. URL 정규화와 백엔드 검증이 어긋났는지 확인하세요.', { query, body: error.body })
        setSettled({ key: requestKey, status: 'error', data: null, errorKind })
      })
    return () => { isActive = false; controller.abort() }
  }, [requestKey])   // query 객체가 아니라 직렬화한 문자열에 의존

  const retry = useCallback(() => setAttempt(value => value + 1), [])

  if (requestKey == null) return { status: 'idle', data: null, errorKind: null, retry, hasRetried: false }
  if (settled.key === requestKey) return { ...settled, retry, hasRetried: attempt > 0 }
  // 아직 이 key의 응답이 없음: 이전 성공 결과가 있으면 refreshing, 없으면 loading
  const previous = settled.status === 'success' ? settled.data : null
  return { status: previous ? 'refreshing' : 'loading', data: previous, errorKind: null, retry, hasRetried: attempt > 0 }
}
```

- **왜 렌더 중 파생인가**: 조건이 바뀔 때 effect 안에서 `setState({ status: 'loading' })`를 호출하면 `react-hooks/set-state-in-effect` 규칙에 걸리고, 한 프레임 동안 "새 조건 + 이전 결과(success)"가 렌더된다. `settled.key`와 현재 `requestKey`를 비교하면 조건이 바뀐 바로 그 렌더에서 loading/refreshing이 된다. 이전 기능은 key 재마운트로 같은 문제를 풀었지만, 목록은 refreshing 중 이전 결과를 유지해야 하므로 재마운트를 쓸 수 없다.
- **왜 직렬화 문자열에 의존하는가**: query 객체는 렌더마다 새로 만들어진다. 객체에 의존하면 매 렌더마다 요청한다. 직렬화 결과는 URL과 같은 정규 형식이라 같은 조건이면 같은 문자열이다.
- **경쟁 조건 (D-8)**: 두 겹으로 막는다.
  1. `controller.abort()`: 이전 요청을 실제로 취소한다. 브라우저가 연결을 끊고, 서버는 응답을 버린다(외부 TourAPI 호출이 이미 시작됐다면 그 호출은 서버에서 끝난다).
  2. `isActive`: abort 직전에 이미 응답이 도착해 `.then`이 예약된 경우를 막는다. abort만으로는 이 경우를 막지 못한다.
- **취소는 오류가 아니다 (FR-01)**: `isAbortError(error)`면 아무 상태도 바꾸지 않는다. 다음 요청의 상태가 곧 반영된다.
- **retry**: attempt를 올리면 `requestKey`가 바뀌어 같은 조건으로 다시 요청한다. retry 핸들러에서 state를 직접 바꿀 필요가 없다.
- **StrictMode**: 개발 모드에서 effect가 두 번 실행되면 첫 요청은 abort된다. 네트워크 탭에 "canceled" 1건이 보이는 것이 정상이다.
- **프론트 캐시 없음**: 같은 조건을 다시 보면 다시 요청한다. 서버 Caffeine 캐시(`tourLists`)가 TourAPI 호출을 막는다. 무효화할 수 없는 모듈 캐시를 목록에 늘리지 않는다(이전 기능 §2.4와 같은 판단).

### 2.5 요청 취소 (`client.js`, FR-01)

- `request(path, { method, body, credentials, headers, signal })`: `signal`을 `fetch`에 그대로 전달한다.
- 401 재시도 경로(`retryAfterRefresh` → `request(path, options, true)`)에도 같은 `signal`을 넘긴다. 재발급을 기다리는 동안 abort되면 재시도 fetch가 즉시 AbortError로 끝난다.
- **`refreshSession`에는 signal을 넘기지 않는다.** 재발급 Promise는 여러 요청이 공유한다(single-flight). 한 목록 요청이 취소됐다고 다른 요청의 재발급까지 끊으면 안 된다.
- `export function isAbortError(error)`: `error?.name === 'AbortError'`. 취소는 `ApiError`가 아니라 `DOMException`으로 오므로, 훅이 `ApiError` 판정 전에 먼저 걸러 낸다.
- 기존 호출(`authApi`, 홈 데이터, 상세)은 `signal`을 넘기지 않으므로 동작이 같다.
- 참고: 이전 기능에서 `client.js`는 수정 금지 파일이었다. 이번에는 계획 D-8에 따라 frontend-lead가 수정한다.

### 2.6 의존성

| 모듈 | 의존 대상 |
|------|-----------|
| `TourCatalogPage` | `useListSearchParams`, `tourListConfigs`, `TourListView`, `ListFilterBar`, `lib/tourListQuery`(탭 링크 생성) |
| `DestinationSearchResultsPage` | `useListSearchParams`, `useRegionOptions`(배너 이름), `tourListConfigs`, `TourListView`, `ListFilterBar`, `ListStatus`(no-query), `TravelSearchModal` |
| `TourListView` | `useTourList`, `TourCardGrid`, `TourCardSkeleton`, `ListStatus`, `Pagination`, `listMessages` |
| `useListSearchParams` | react-router `useSearchParams`, `lib/tourListQuery` |
| `useTourList` | `api/tourApi`(`fetchTourList`), `api/client`(`ApiError`, `isAbortError`), `lib/tourListQuery` |
| `useRegionOptions` | `api/tourApi`(`fetchRegions`, `fetchDistricts`) |
| `api/tourApi` | `api/client`, `data/tourContentTypes`(`getTourDetailPath`), `lib/tourListQuery`(`toTourApiParams`) |
| `lib/*`, `data/tourListConfigs` | 없음 (`tourListConfigs`는 `tourContentTypes`만) |
| `TravelSearchModal` | `SearchModal`, `useSearchSelection`, `useRegionOptions`, `tourListConfigs`, `lib/tourListQuery`, `travelTypes`, react-router `useNavigate`·`useSearchParams` |
| `EnjoySearchModal` | `SearchModal`, `useSearchSelection`, react-router `useSearchParams` |
| `SearchModal` | `SearchModalFrame`, `SearchOptionGroup` |

의존 방향은 **페이지 → (훅, 표시 컴포넌트) → api → client**다. `lib/`와 `data/`는 React와 네트워크를 모른다. 표시 컴포넌트(`TourCard`, `Pagination`, `SearchOptionGroup` 등)는 훅과 API를 import하지 않고 props만 받는다. `components/tour-list/`는 목업(`destinationMocks`)을 import하지 않는다.

---

## 3. 데이터 모델

### 3.1 URL 스키마

파라미터 이름은 API 파라미터 이름과 같게 한다(FR-12). URL과 API 요청을 머릿속에서 번역할 필요가 없고, 백엔드 캐시 키와도 대응한다.

| 파라미터 | 카탈로그 (`/destinations/attractions`, `/culture`) | 검색 결과 (`/destinations/search`) | 허용값 | 기본값 (URL에서 생략) |
|----------|:---:|:---:|------|------|
| `contentTypeId` | 사용 안 함 (라우트가 결정) | **필수** | `'12'`, `'14'` (문자열 비교) | 없음. 없거나 허용값이 아니면 no-query |
| `lDongRegnCd` | 선택 | 선택 | `/^\d{2,5}$/` (세종 `36110`이 5자리) | 없음 = 전국 |
| `lDongSignguCd` | 선택 | 선택 | `/^\d{1,5}$/`, `lDongRegnCd`가 있을 때만 | 없음 = 시·도 전체 |
| `lclsSystm1` | 관광지(12)만 | 유형 12일 때만 | `NA`, `HS`, `EX`, `VE` | 없음 = 전체 |
| `lclsSystm2` | 문화시설(14)만 | 유형 14일 때만 | `VE06`, `VE07`, `VE08`, `VE09` | 없음 = 전체 |
| `arrange` | 선택 | 선택 | `Q`, `O` | `Q` |
| `page` | 선택 | 선택 | `/^[1-9]\d{0,3}$/` (1 ~ 9999) | `1` |

예시
- `/destinations/attractions?lDongRegnCd=11&lDongSignguCd=110&lclsSystm1=HS&arrange=O&page=2`
- `/destinations/culture?lclsSystm2=VE07`
- `/destinations/search?contentTypeId=14&lDongRegnCd=26&lclsSystm2=VE06`

`size`는 URL에 두지 않는다. 화면 설정(9)이며, 사용자가 바꿀 수 없다.

### 3.2 정규화 규칙

`parseTourListQuery(searchParams, { contentTypeId })`가 적용한다. `contentTypeId` 옵션이 있으면 카탈로그 모드(라우트가 유형 결정), 없으면 검색 모드(URL에서 읽음).

| 순서 | 규칙 |
|:---:|------|
| 1 | 검색 모드에서 `contentTypeId`가 없거나 허용값이 아니면 `null`을 반환한다(no-query). 나머지 파라미터는 보지 않는다 |
| 2 | 허용값이 아닌 값은 버리고 기본값을 쓴다. 문자열을 그대로 비교한다. `Number()`로 바꾸지 않는다(`'0xc'`, `'12.0'`이 12가 되어 한 목록에 URL이 여러 개 생기는 문제, 이전 기능 G-01) |
| 3 | `lDongSignguCd`는 `lDongRegnCd`가 없으면 버린다(백엔드는 이 조합을 400으로 거절한다) |
| 4 | 유형에 맞지 않는 분류 파라미터는 버린다(관광지에 `lclsSystm2`, 문화시설에 `lclsSystm1`) |
| 5 | 알 수 없는 파라미터(`region`, `type` 등 예전 형식 포함)는 버린다 |
| 6 | `page` 상한(총 페이지)은 응답이 와야 알 수 있으므로 파싱 단계에서는 보지 않는다. `TourListView`가 응답 후 보정한다(§5.6) |

**정규 URL 교체**: `useListSearchParams`는 `serializeTourListQuery(query)`가 현재 쿼리 문자열과 다르면 `setSearchParams(canonical, { replace: true })`를 호출한다. 파라미터 순서는 위 표 순서로 고정하고 기본값은 생략한다. 첫 렌더부터 정규화된 query로 요청하므로, URL 교체가 요청을 한 번 더 만들지 않는다(`requestKey`가 같음).

**지역 코드의 의미 검증은 하지 않는다**: `/^\d{2,5}$/`를 통과했지만 없는 지역 코드(`99`)는 그대로 요청한다. 백엔드·TourAPI가 빈 결과 또는 400을 주면 empty 또는 invalid 상태에서 "조건 초기화"로 복구한다. 지역 목록 로딩을 기다려 검증하면 첫 요청이 늦어지고 정규화가 비동기가 되기 때문이다. select는 값이 목록에 없으면 "알 수 없는 지역" 옵션을 임시로 보여 준다(표시와 URL이 어긋나지 않게).

**`updateQuery(patch)` 규칙** (`applyQueryPatch`, 순수 함수)
- `page` 외의 값이 바뀌면 `page`는 1로 돌아간다(FR-05).
- `lDongRegnCd`가 바뀌면 `lDongSignguCd`를 지운다.
- `resetQuery()`: 카탈로그는 모든 파라미터를 지운다(유형은 라우트에 남음). 검색 결과는 `contentTypeId`만 남긴다.

**공개 계약** (`lib/tourListQuery.js`)

```js
export const DEFAULT_ARRANGE = 'Q'
export const LIST_PAGE_SIZE = 9
export function parseTourListQuery(searchParams, { contentTypeId } = {})   // → TourListQuery | null
export function serializeTourListQuery(query)                              // → URLSearchParams (정규 순서, 기본값 생략)
export function applyQueryPatch(query, patch)                              // → TourListQuery
export function toTourApiParams(query)                                     // → URLSearchParams (/api/v1/search 용, §4.2)
export function buildSearchResultsPath(query)                              // → '/destinations/search?...' (모달·랜딩에서 사용)

// TourListQuery
// { contentTypeId: 12 | 14, lDongRegnCd: string | null, lDongSignguCd: string | null,
//   category: string | null, arrange: 'Q' | 'O', page: number }
// category는 유형의 분류 파라미터(12 → lclsSystm1, 14 → lclsSystm2) 값. 이름을 통일해 화면 코드가 유형을 몰라도 되게 한다.
```

### 3.3 목록 view model

**`TourCard`** (`toTourCard(item)`, FR-03)

| 필드 | 원천 | 규칙 |
|------|------|------|
| `id` | `contentId` | 문자열. `isTourContentId`를 통과하지 못하면 카드 자체를 버린다 |
| `title` | `title` | trim. 비면 카드를 버린다(fail-closed, 빈 제목 카드 방지) |
| `address` | `address` | trim. 비면 `'주소 정보 없음'` (`tourApi.js`의 `EMPTY_ADDRESS`와 같은 상수) |
| `image` | `image ?? thumbnail` | 빈 문자열은 null로 본다. 둘 다 없으면 null → 카드가 기본 이미지 사용 |
| `category` | `lclsSystm2Nm ?? lclsSystm1Nm` | null이면 배지를 표시하지 않음 |
| `detailPath` | `getTourDetailPath(contentId, contentTypeId)` | null이면 카드를 버린다(링크 없는 카드 방지). 12·14는 `/destinations/detail/{id}?type=`, 즐기기 유형도 처리 |

카드에서 없애는 필드: 목업의 `description`, `meta`, 검색 결과의 문의·주차·운영 배지(API에 없음). 목록 응답에는 개요·휴무일이 없다.

**`TourListResult`** (`toTourList(data, requestedSize)`, FR-02)

```js
{ items: TourCard[], totalCount: number, page: number, totalPages: number }
// totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / requestedSize)
```

- **totalPages는 요청한 size로 계산한다**. 응답의 `size`는 마지막 페이지에서 남은 건수로 줄어든다(계획 1.2).
- **fail-closed**: `items`가 배열이 아니거나 `totalCount`가 0 이상의 정수가 아니면 `Error('목록 응답 형식이 올바르지 않습니다.')` → `failed`.
- 버린 카드가 있어도 `totalCount`는 서버 값을 그대로 쓴다. 한 페이지의 카드 수가 9보다 적을 수 있다(드묾, 허용).

### 3.4 목록 설정 (`data/tourListConfigs.js`)

```js
export const TOUR_LIST_CONFIGS = {
  attraction: {
    contentTypeId: 12,
    categoryParam: 'lclsSystm1',
    categories: [                    // 순서 = 탭 순서. '전체'는 컴포넌트가 앞에 붙인다
      { code: 'NA', label: '자연', fullLabel: '자연관광' },
      { code: 'HS', label: '역사', fullLabel: '역사관광' },
      { code: 'EX', label: '체험', fullLabel: '체험관광' },
      { code: 'VE', label: '문화', fullLabel: '문화관광' },
    ],
    breadcrumb: '관광지', title: '테마별 관광지', description: '관심 있는 테마를 선택하고 원하는 관광지를 둘러보세요.',
    path: '/destinations/attractions',
  },
  culture: {
    contentTypeId: 14,
    categoryParam: 'lclsSystm2',
    categories: [
      { code: 'VE06', label: '공연', fullLabel: '공연시설' },
      { code: 'VE07', label: '전시', fullLabel: '전시시설' },
      { code: 'VE08', label: '행사', fullLabel: '행사시설' },
      { code: 'VE09', label: '교육', fullLabel: '교육시설' },
    ],
    breadcrumb: '문화시설', title: '문화와 역사를 만나는 곳', description: '지역의 역사와 문화를 다양한 공간에서 만나보세요.',
    path: '/destinations/culture',
  },
}
export const SORT_OPTIONS = [ { value: 'Q', label: '최신순' }, { value: 'O', label: '이름순' } ]
export function getListConfigByContentType(contentTypeId)   // 12 | 14 → config | null
```

- `label`은 탭(짧게), `fullLabel`은 모달 세부 항목과 검색 결과 배너(API 분류명과 같게)에 쓴다. 문화시설 탭 결과가 기대와 다를 수 있다는 계획의 위험(박물관·미술관은 '전시시설')은 `fullLabel`과 카드 분류 배지로 완화한다.
- 코드와 이름은 `backend/src/main/resources/tour/classification-codes.json` 및 `TourClassificationService`(12: NA/HS/EX/VE, 14: VE06 ~ VE09)와 같다.
- 즐기기 목록을 전환할 때 `festivals: { contentTypeId: 15, ... }`처럼 항목을 추가한다.

### 3.5 option 모델과 선택 reducer

**Option**

```js
// { value: string, label: string, disabled?: boolean, badge?: string, icon?: ReactNode, description?: string }
// OptionList: { status: 'loading' | 'error' | 'ready', options: Option[], onRetry?: () => void }
```

`SearchOptionGroup`은 `OptionList`만 받는다. 선택지가 API에서 왔는지 상수인지 모른다.

**선택 reducer** (`hooks/useSearchSelection.js`)

```js
// selection: { region: string, district: string, type: string, detail: string }  ('' = 선택 안 함)
export function searchSelectionReducer(state, action) // 순수 함수, export
// 'selectRegion'   → { ...state, region: value, district: '' }
// 'selectDistrict' → { ...state, district: value }
// 'selectType'     → { ...state, type: value, detail: '' }
// 'selectDetail'   → { ...state, detail: value }
// 'reset'          → 빈 선택
export function useSearchSelection(initialSelection) // → [selection, actions]
```

지역을 바꾸면 시군구를, 유형을 바꾸면 세부 항목을 지우는 규칙은 기존 `SearchModal`의 동작(`setRegion(item); setDistrict('')`)과 같다. 이 규칙을 reducer 하나에 모아 두 모달이 공유한다.

**여행지 모달의 option 값**

| 단계 | value | label | 비고 |
|------|-------|-------|------|
| 시·도 | `''` / `lDongRegnCd` | `전국` / `name` | `useRegions()`. 첫 항목 `전국` |
| 시군구 | `''` / `lDongSignguCd` | `전체` / `name` | `useDistricts(region)`. 시·도가 `''`이면 비활성 안내 |
| 유형 | `'12'`, `'14'`, `'25'` | 관광지, 문화시설, 여행코스 | `travelTypes`의 아이콘·설명 사용. **`'25'`는 `disabled`, `badge: '준비 중'`** (Q-5) |
| 세부 항목 | `''` / 분류 코드 | `전체` / `fullLabel` | `tourListConfigs` (P-3). 유형 선택 전에는 비활성 |

- 초기 선택값: 모달 내용이 **열릴 때 마운트**되므로, 그 시점 `useSearchParams()`를 `parseTourListQuery`(검색 모드)로 읽어 채운다(FR-12). 검색 결과 페이지가 아니면 해당 파라미터가 없어 빈 선택이 된다.
- 검색 버튼: 유형을 고르기 전에는 비활성. 옆 안내 문구 "여행지 유형을 선택해 주세요."
- 제출: `navigate(buildSearchResultsPath({ contentTypeId, lDongRegnCd, lDongSignguCd, category, arrange: 'Q', page: 1 }))` 후 `onClose()`. 검색 결과 페이지에서 조건을 바꾸면 같은 라우트에서 쿼리만 바뀌고 모달이 닫힌다.

### 3.6 즐기기 어댑터 (호환 규칙)

`EnjoySearchModal`은 기존 동작을 그대로 옮긴다. **`EnjoySearchResultsPage.jsx`는 수정하지 않는다.**

| 항목 | 기존 `SearchModal` 동작 | 어댑터 동작 |
|------|--------------------------|-------------|
| 시·도 선택지 | `['전체']` 문자열 | `[{ value: '전체', label: '전체' }]` (value = 라벨) |
| 시군구 | `전체` 버튼 1개, 시·도 미선택 시 비활성 | `[{ value: '전체', label: '전체' }]`, 시·도가 `''`이면 group 전체 비활성 |
| 유형 | `enjoyTypes` 5개, 선택값 = `title` | `{ value: title, label: title, icon }` |
| 세부 항목 | `전체` 버튼 1개, 유형 미선택 시 비활성 | 같음 |
| 초기 선택값 | 페이지 마운트 시 `window.location.search`의 `region`·`district`·`type`·`detail` | **모달이 열릴 때** `useSearchParams()`의 같은 키 (즐기기는 전체 이동이라 결과는 같음) |
| 요약 | 지역은 시·도와 시군구가 **둘 다** 있을 때만 표시 | 같음 (`summaryItems`를 어댑터가 계산) |
| 쿼리 | `new URLSearchParams({ region, district, type, detail })` → 빈 값도 키 유지 (`region=&district=&type=&detail=`) | **같은 코드로 생성**. 키 순서·빈 값 유지 |
| 이동 | `window.location.href = '/enjoy/search?...'` (전체 새로고침) | **같음**. `navigate()`로 바꾸지 않는다 |
| 검색 버튼 활성 조건 | 항상 활성 | 항상 활성 |

- **왜 즐기기는 `location.href`를 유지하는가**: `EnjoySearchResultsPage`는 렌더 중 `window.location.search`를 직접 읽고, 모달 열림 state를 페이지가 가지고 있다. `navigate()`로 바꾸면 결과 페이지의 동작(모달 닫기, 재렌더)을 검증해야 하고, 결국 결과 페이지 수정으로 이어진다. 즐기기 전환은 이번 범위 밖이다(계획 2.2).
- 어댑터 함수(`toLabelOptions`, `buildEnjoySearchUrl`, `readEnjoySelection`)는 `EnjoySearchModal.jsx` 안의 모듈 수준 함수로 두고 export하지 않는다(react-refresh 규칙). 즐기기 전환 때 목록 query 모델로 교체한다.

---

## 4. API 명세

### 4.1 엔드포인트

| 메서드 | 경로 | 프론트 사용처 | 인증 | 변경 |
|--------|------|---------------|------|------|
| GET | `/api/v1/search` | `fetchTourList` | 불필요 | FR-15 중분류 보정·상한, FR-16 arrange 검증 |
| GET | `/api/v1/regions` | `fetchRegions` (캐시) | 불필요 | 없음 |
| GET | `/api/v1/regions/districts?lDongRegnCd=` | `fetchDistricts` (코드별 캐시) | 불필요 | 없음 |
| GET | `/api/v1/classifications?contentTypeId=` | **사용하지 않음** (P-3) | - | 없음 |

### 4.2 요청과 응답 처리

**`fetchTourList(query, { signal })`**

`toTourApiParams(query)`가 만드는 파라미터

| API 파라미터 | 값 |
|--------------|----|
| `page` | `query.page` |
| `size` | `9` (`LIST_PAGE_SIZE`) |
| `contentTypeId` | `12` 또는 `14` |
| `lDongRegnCd`, `lDongSignguCd` | 있을 때만 |
| `lclsSystm1` | 12: `query.category`. 14에서 category가 있으면 **category의 앞 2자리(`VE`)도 함께 보냄** |
| `lclsSystm2` | 14: `query.category` |
| `arrange` | `Q` 또는 `O` |

14에서 `lclsSystm1`을 함께 보내는 이유: 백엔드 보정(BE-1)이 없어도 중분류 조회가 대분류 범위로 좁혀지고, 백엔드 캐시 키(`classification-source:...:lclsSystm1`)가 요청 경로와 관계없이 같아진다. BE-1은 다른 호출자를 위한 방어다.

**응답 처리**

| 상태 | body | 프론트 |
|------|------|--------|
| 200 | `{ items, page, size, totalCount }` | `toTourList` → success (0건이면 empty) |
| 200 (형식 다름, `{}` 포함) | - | `Error` → error `failed` |
| 400 | `{ code: 'INVALID_REQUEST', message, timestamp }` | error `invalid` + `console.warn` |
| 502 / 500 / 네트워크 | - | error `failed` + `console.error` |
| abort | `DOMException('AbortError')` | 무시 |

프론트는 `status`로만 분기한다. `code`·`message`는 화면에 노출하지 않는다.

**`fetchRegions()` / `fetchDistricts(lDongRegnCd)`** (FR-13)

- 모듈 수준 `Map`에 **Promise**를 저장한다(키: `'regions'`, `'districts:{code}'`). 같은 키를 동시에 요청해도 네트워크 요청은 1회다.
- Promise가 실패하면 캐시에서 지운다. 다음 호출(재시도)이 다시 요청한다.
- `signal`을 받지 않는다. 캐시된 Promise는 여러 컴포넌트가 공유하므로, 한 컴포넌트의 언마운트가 요청을 취소하면 안 된다(§2.5 `refreshSession`과 같은 이유).
- 응답 검증: 배열이 아니면 `Error`. 각 항목은 `{ value: lDongRegnCd|lDongSignguCd, label: name }`으로 바꿔 돌려준다(화면이 API 필드 이름을 모르게).

**`useRegionOptions`**: `useRegions()` → `OptionList`, `useDistricts(code)` → `OptionList` (code가 null이면 `ready` + 빈 목록). 진행 상태는 `useTourList`와 같이 key 비교로 파생한다. 이미 끝난 캐시는 `getCachedRegions()`로 동기 조회해 첫 렌더부터 `ready`로 보여 준다(모달을 두 번째 열 때 깜빡임 없음).

**`tourApi.js` 공개 계약 (추가분)**

```js
export async function fetchTourList(query, { signal } = {})  // → TourListResult. 실패 시 ApiError / Error / AbortError
export function toTourList(data, requestedSize)              // 테스트 가능하게 export
export function toTourCard(item)                             // → TourCard | null
export function fetchRegions()                               // → Promise<Option[]> (캐시)
export function fetchDistricts(lDongRegnCd)                  // → Promise<Option[]> (코드별 캐시)
export function getCachedRegions()                           // → Option[] | null (끝난 캐시 동기 조회)
export function getCachedDistricts(lDongRegnCd)              // → Option[] | null
```

### 4.3 백엔드 변경 명세 (frontend-support-backend 전용)

경로 기준: `backend/src/main/java/kr/co/mycom/travel_korea/tour/`

**BE-1. 중분류만 온 요청의 대분류 보정 (FR-15) — `dto/request/TourSearchRequest.java`**

record의 compact constructor에서 보정한다.

```java
private static final Pattern MIDDLE_CLASSIFICATION = Pattern.compile("^[A-Z]{2}\\d{2}$");

if ((lclsSystm1 == null || lclsSystm1.isBlank())
        && lclsSystm2 != null && MIDDLE_CLASSIFICATION.matcher(lclsSystm2).matches()) {
    lclsSystm1 = lclsSystm2.substring(0, 2);
}
```

- **왜 서비스가 아니라 요청 record에서 하는가**: `TourService.getTours`의 `@Cacheable` 키에 `lclsSystm1`이 들어간다. 메서드 안에서 보정하면 캐시 키는 보정 전 값(null)으로 만들어져, 같은 요청이 두 캐시 항목으로 나뉜다. 컨트롤러에 들어오기 전에 보정하면 키도 보정된 값이다.
- `HomeTourService` 등 서비스를 직접 호출하는 코드는 이 record를 거치지 않으므로 영향이 없다(계획 6.2 확인 항목).
- `lclsSystm1`이 이미 있으면 건드리지 않는다. `lclsSystm1`과 `lclsSystm2` 앞 2자리가 다른 요청은 이번에 검증하지 않는다(빈 결과가 나올 뿐, 프론트 정규화가 이런 URL을 만들지 않음).

**BE-2. 중분류 전체 조회 상한 (FR-15, Q-3) — `service/TourClassificationSearchService.java`**

```java
private static final int MAX_SOURCE_PAGES = 20;   // 100건 × 20 = 2,000건

int lastPage = Math.min(totalPages, MAX_SOURCE_PAGES);
if (apiPage == 1 && totalPages > MAX_SOURCE_PAGES) {
    log.warn("중분류 원본 조회가 상한을 넘었습니다. totalCount={}, 조회 페이지={}/{}, 조건={}:{}:{}:{}:{}",
            response.totalCount(), MAX_SOURCE_PAGES, totalPages,
            lDongRegnCd, lDongSignguCd, contentTypeId, arrange, lclsSystm1);
}
// while (apiPage <= lastPage)
```

- 상한을 넘으면 앞 2,000건 안에서만 중분류를 걸러 낸다. 그 경우 화면의 totalCount는 실제보다 작다. 로그로 빈도를 확인한다.
- **수치 확정 절차**: 실제 키로 L1 #9(`contentTypeId=14&lclsSystm1=VE&size=1`)의 `totalCount`를 확인한다. 전국 문화시설 VE 건수가 2,000 이하면 상한에 걸리지 않으므로 그대로 확정한다. 크게 넘으면 분석 단계에서 상한 조정 또는 "일부 결과" 안내(Q-3 선택지 b)를 다시 검토한다. 결과는 분석 문서에 기록한다.
- 최악의 호출 수: 조건 조합(지역 × 시군구 × arrange) 1개당 첫 조회 20회, 이후는 캐시(`sync = true`로 동시 요청도 1회). 서버를 재시작하면 캐시가 사라진다는 점을 README 로컬 실행 절에 한 줄 적는다(선택).
- `@Slf4j`를 추가한다(`lombok`은 이미 사용 중).

**BE-3. `arrange` 허용값 검증 (FR-16) — `dto/request/TourSearchRequest.java`**

```java
private static final Set<String> ALLOWED_ARRANGES = Set.of("A", "C", "D", "O", "Q", "R");

arrange = arrange == null || arrange.isBlank() ? "Q" : arrange;
if (!ALLOWED_ARRANGES.contains(arrange)) {
    throw new IllegalArgumentException("arrange는 A, C, D, O, Q, R 중 하나여야 합니다.");
}
```

- 대소문자를 구분한다(`q`는 400). TourAPI 규격과 같다.
- `IllegalArgumentException`은 기존 `TourExceptionHandler`가 400 `INVALID_REQUEST`로 바꾼다. `page=0`(기존 검증)이 400을 주는지 L1 #5로 먼저 확인해 이 경로가 동작함을 보장한다.
- 파일 끝의 `TODO(본인)` 주석에서 arrange 항목을 지운다.

**BE-4. local-mock 목록 최소 개선 (Q-4) — `client/MockTourApiClient.java` (`@Profile("local-mock")`)**

| 규칙 | 내용 |
|------|------|
| 유형별 데이터 | 12: **23건** (기존 3건 경복궁 126508·비자림 126485·경포해변 125476을 맨 앞에 두고 합성 20건). 14: **11건**. 그 밖의 유형: 기존 3건(유형 값만 요청값으로) |
| 합성 항목 | `contentid` = `9{typeId}{순번 4자리}` (예: `9120004`, `9140001`). 제목 `목 관광지 04`, `목 문화시설 01`. 주소는 지역 코드에 맞는 시·도명. 이미지 null(프론트 기본 이미지 확인용) |
| 지역 | 합성 항목의 `lDongRegnCd`를 `11`, `26`, `50`, `51` 순으로 돌려 배정한다. 요청에 `lDongRegnCd`·`lDongSignguCd`가 있으면 걸러 낸다. **`31`(울산)에는 항목이 없어 항상 빈 결과** (빈 상태 확인용) |
| 분류 | 14의 합성 항목은 `lclsSystm1 = "VE"`, `lclsSystm2`를 `VE06` ~ `VE09` 순으로 배정한다(중분류 경로 `TourClassificationSearchService`가 `lclsSystm2`로 묶기 때문). 12의 대분류 필터는 적용하지 않는다(탭을 바꿔도 같은 목록, 문서화된 한계) |
| 페이지 | `page`·`size`로 잘라 `pageNo`·`numOfRows`(잘린 건수)·`totalCount`(필터 후 전체)를 돌려준다. 12 전국 size 9 → 9·9·5건 (마지막 페이지 size가 줄어드는 실제 동작 재현) |
| 상세 | `getDetailCommon`이 합성 id에도 같은 제목의 상세를 돌려준다(카드 → 상세 제목 일치 확인용). 기존 3건과 유형 검증(이전 기능 BE-4) 규칙은 유지 |

- 6개 인자 `getAreaBasedList`만 구현하면 된다. 8개 인자 버전은 인터페이스 default 메서드가 6개 인자 버전으로 위임한다(분류 인자 무시). 14의 분류는 서버 측 필터(BE-2 경로)에서 적용된다.
- 기존 홈(`/api/v1/home`) 목 응답은 12의 앞 3건을 그대로 쓰므로 바뀌지 않아야 한다(L1 #10).

**BE-5. 단위 테스트 (P-8)**

| 파일 | 케이스 |
|------|--------|
| `src/test/.../tour/dto/request/TourSearchRequestTest.java` (신규) | arrange null·빈 값 → Q / `O` 통과 / `X`, `q` → IAE / `lclsSystm2=VE07`만 → `lclsSystm1=VE` / 둘 다 있으면 그대로 / `lclsSystm2=abc` → 보정 안 함 |
| `src/test/.../tour/service/TourClassificationSearchServiceTest.java` (신규) | 가짜 `TourApiClient`(totalCount 2,500, 100건씩) → 호출 20회에서 멈춤 / totalCount 250 → 호출 3회 |

**BE-6. 검증** (JDK 25: `C:\Users\ASUS\dev\jdks\jdk-25.0.2`)
- `mvnw clean test`
- §8.2 L1 #1 ~ #8, #10 (`local-mock`). 실제 키가 있으면 #9, #11 (짧게)
- 수정 금지: `SecurityConfig`, 홈·축제·상세 API 동작, 프론트 파일 전체

---

## 5. UI/UX

### 5.1 상태별 화면

| 상태 | 컴포넌트 | 내용 | 접근성 |
|------|----------|------|--------|
| idle (no-query, 검색 결과만) | `ListStatus variant="no-query"` | 제목 "검색 조건을 선택해 주세요", 설명 "지역과 여행지 유형을 고르면 맞는 여행지를 찾아 드려요.", 버튼 [조건 선택하기] → 모달 열기. API 호출 없음 (Q-6) | 일반 영역 (`role` 없음) |
| loading | `TourCardSkeleton count={9}` | 카드와 같은 치수의 회색 블록 9개. 건수 자리는 같은 높이의 빈 줄 | 목록 영역 `aria-busy="true"`, 스켈레톤은 `aria-hidden`. 건수 영역 `role="status"`에 "여행지를 불러오는 중입니다" (시각적으로 숨김) |
| refreshing | `TourCardGrid busy` | 이전 카드 유지, `opacity: .55`, `pointer-events: none`. 건수는 이전 값 유지 | `aria-busy="true"`. 새 결과가 오면 건수 `role="status"`가 "총 N건"을 알림 |
| success | `TourCardGrid` + `Pagination` | "총 **N**건" + 카드 + 페이지 | 건수 `role="status"` |
| empty (success, 0건) | `ListStatus variant="empty"` | 카탈로그: "조건에 맞는 여행지가 없어요" / "지역이나 분류를 바꿔 보세요." / [조건 초기화]. 검색 결과: 같은 제목 / [조건 변경] → 모달 | `role="status"` |
| error `invalid` (400) | `ListStatus variant="invalid"` | eyebrow "오류", "검색 조건이 올바르지 않아요" / "주소의 조건을 확인하거나 조건을 초기화해 주세요." / [조건 초기화] | `role="alert"`, `aria-labelledby` |
| error `failed` | `ListStatus variant="error"` | eyebrow "오류", "여행지 목록을 불러오지 못했어요" / "잠시 후 다시 시도해 주세요." / [다시 시도] | `role="alert"`. **재시도 후 실패**(`hasRetried`)면 제목(`tabIndex={-1}`)으로 포커스 (이전 기능 SI-2와 같은 규칙, 첫 실패에는 옮기지 않음) |

- 문구는 `components/tour-list/listMessages.js` 상수로 둔다.
- 오류·빈 상태에서도 탭·필터 바는 그대로 보인다. 사용자가 조건을 바로 바꿔 복구할 수 있다.
- 오류 블록 높이는 스켈레톤 한 줄 정도(`min-height: 320px`)로 잡아 푸터가 튀어 오르지 않게 한다.

**`TourListView` 계약**

```js
TourListView({
  query,                 // TourListQuery | null
  onPageChange,          // (page, { replace }) => void
  onReset,               // empty·invalid의 주 버튼
  resetLabel,            // '조건 초기화' | '조건 변경'
  onRequestConditions,   // no-query 버튼 (검색 결과만)
  headingId,             // 건수 영역 id (페이지 이동 후 포커스 대상)
})
```

### 5.2 카탈로그 (`TourCatalogPage`, FR-05 ~ FR-10)

| 영역 | 내용 |
|------|------|
| 빵 부스러기·제목 | 기존 `catalog-*` 마크업 유지 (`config.breadcrumb/title/description`) |
| 탭 (FR-06) | `전체` + `config.categories`의 `label`. **`<Link>`** 로 렌더(`to`는 `serializeTourListQuery(applyQueryPatch(query, { category }))`). 활성 탭 `aria-current="true"`, `is-active`. 링크라서 새 탭 열기·뒤로 가기가 자연스럽다 |
| 필터 바 | `ListFilterBar`: 지역(select, `useRegions`) · 시군구(select, `useDistricts`, 지역 미선택 시 `disabled` + "시·도를 먼저 선택") · 정렬(select, `SORT_OPTIONS`) |
| 목록 | `TourListView` |
| 북마크 | **없음** (Q-1) |

- 지역·시군구 select가 `loading`이면 `disabled` + "불러오는 중", `error`면 옵션 "지역을 불러오지 못했어요" 1개 + 옆에 [다시 시도] 작은 버튼. 목록 조회는 지역 목록과 관계없이 진행한다(지역 API 실패가 목록을 막지 않음).
- 라우트: `App.jsx`의 `/destinations/attractions`, `/destinations/culture`를 `<TourCatalogPage kind="attraction|culture" />`로 바꾼다. `/destinations/courses`는 기존 `DestinationCatalogPage kind="course"`를 유지한다.
- 두 카탈로그 사이를 이동하면 라우트 요소 타입은 같고 prop만 바뀐다. `useTourList`는 `requestKey`로 새 요청을 하고, 이전 결과는 refreshing 동안 흐리게 보인다. 유형이 다른 카드가 잠시 보이는 것을 피하려고 `<TourCatalogPage key={kind} />`로 재마운트한다(첫 로딩 스켈레톤).

### 5.3 검색 결과 (`DestinationSearchResultsPage`, FR-11)

| 영역 | 내용 |
|------|------|
| 조건 배너 | "선택한 조건으로 여행지를 찾았어요" + 칩: `지역 {시·도} {시군구}` (이름은 `useRegions`/`useDistricts`로 코드 → 이름. 로딩 중에는 "선택한 지역", 없으면 "전국"), `유형 {관광지|문화시설}`, `상세 {fullLabel}`(있을 때). 버튼 [조건 변경] (기존 "다시 검색" 버튼은 같은 동작이라 하나로 합침) |
| 제목 | `{지역 이름 또는 전국} {유형} 검색 결과` |
| 필터 바 | `ListFilterBar`의 정렬만 (`fields={['arrange']}`) |
| 목록 | `TourListView`. 카드 마크업은 카탈로그와 같은 `catalog-card` (기존 `search-results-grid` 카드·배지 제거) |
| 안내 문구 | 기존 "운영시간, 휴무일 등 일부 정보는 제공되지 않을 수 있습니다." 유지 |
| no-query | 배너·제목 대신 `ListStatus variant="no-query"` (Q-6) |

- `window.location.search` 직접 읽기를 없애고 `useListSearchParams({ mode: 'search' })`를 쓴다.
- 모달 "검색"으로 같은 라우트에서 쿼리만 바뀌면 `ScrollToTop`은 동작하지 않는다(pathname 같음). 모달 제출 핸들러가 `window.scrollTo({ top: 0 })`을 호출한다.

### 5.4 검색 모달 (FR-12)

**`SearchModalFrame` 계약**

```js
SearchModalFrame({ titleId, title, description, closeLabel, onClose, variant, footer, children })
```

| 동작 | 처리 | 범위 |
|------|------|------|
| 오버레이 클릭·닫기 버튼·Esc | `onClose` (기존과 같음) | 필수 |
| 스크롤 잠금 | `body`·`html` `overflow: hidden`, 닫을 때 이전 값 복원 (기존 코드 이전) | 필수 |
| 초기 포커스 | 마운트 시 dialog(`tabIndex={-1}`, `aria-labelledby`)에 포커스. 스크린 리더가 제목을 읽는다. 첫 버튼(시·도 "전국")에 두지 않는 이유: 선택 버튼에 포커스가 가면 Enter 한 번으로 의도치 않은 선택이 된다 | **필수** |
| 포커스 복원 | 마운트 시 `document.activeElement`를 ref에 저장, 언마운트 시 그 요소가 문서에 남아 있으면 `focus()`. 검색으로 페이지가 바뀌어 요소가 사라졌으면 복원하지 않음 | **필수** |
| 포커스 트랩 | dialog의 `keydown`에서 Tab/Shift+Tab이 첫·마지막 포커스 가능 요소를 넘으면 반대쪽으로 순환 | **여유 범위**. 시간이 부족하면 후속 과제로 넘기고 분석 문서에 기록 |
| Esc 리스너 | `onClose`를 ref에 담아 리스너를 한 번만 등록 (부모가 매 렌더 새 함수를 넘겨도 재등록 안 함) | 필수 |

**왜 Frame에서 처리하는가**: `aria-modal="true"`는 "이 창 밖으로 포커스가 나가지 않는다"는 약속이다. 기존 모달은 이 약속을 지키지 않는다. 틀을 하나로 모았으므로 한 곳에서 고치면 두 모달이 모두 맞아진다. 트랩이 여유 범위인 이유: 배경 스크롤이 잠겨 있고 오버레이가 화면 전체를 덮어, 트랩이 없어도 마우스 사용자는 영향이 없다. 키보드 사용자만 배경으로 빠질 수 있다.

**`SearchModal` 계약 (재작성, 제어 컴포넌트)**

```js
SearchModal({
  frame,                  // SearchModalFrame에 넘길 { titleId, title, description, closeLabel, variant }
  onClose,
  steps: { step1Title, step2Title, detailHeading, detailHint },
  selection, actions,     // useSearchSelection 결과
  regionOptions, districtOptions, typeOptions, detailOptions,   // OptionList
  typeGridClassName, typeIconClassName, showTypeDescription, regionGroupClassName,  // 기존 스타일 props 유지
  summaryItems,           // [{ label, value }]
  canSubmit, submitHint,  // 검색 버튼 활성·안내
  onSubmit,
})
```

- 기존 클래스(`travel-search-modal__*`, `enjoy-search-modal__*`)를 그대로 써서 두 모달의 모양이 바뀌지 않게 한다.
- **16개 시·도와 최대 수십 개 시군구**: 기존 CSS는 버튼 몇 개를 가정했다. `.travel-search-modal__region-box`의 버튼 목록에 `display: flex; flex-wrap: wrap; gap: 8px`를 주고, 시군구 목록은 `max-height: 220px; overflow-y: auto`로 제한한다. 모바일(≤720px)에서 버튼 `min-width`를 `calc(33% - 8px)`로 3열 배치한다.
- **`SearchOptionGroup`**: 버튼에 `aria-pressed`, 비활성 버튼에 `disabled` + `badge`(예: "준비 중") 표시. 그룹은 `role="group"` + `aria-labelledby`(단계 제목). `loading`이면 버튼 대신 "불러오는 중입니다" 한 줄(높이 44px 고정), `error`면 "선택지를 불러오지 못했어요 [다시 시도]".

**`TravelSearchModal`**

```js
export default function TravelSearchModal({ isOpen, onClose }) {
  if (!isOpen) return null
  return <TravelSearchDialog onClose={onClose} />   // 열릴 때 마운트 → URL로 초기화
}
```

- `HeroSection`(홈), `DestinationsPage`, `DestinationSearchResultsPage` 세 곳의 사용 방식(`isOpen`, `onClose`)은 바뀌지 않는다.

### 5.5 여행지 랜딩 지역 카드 (FR-14)

`DestinationsPage.jsx`의 `regions` 배열에 `lDongRegnCd`를 추가하고 `<article>`을 `<Link to="/destinations/attractions?lDongRegnCd=..">`로 감싼다(유형 카드와 같은 구조).

| 카드 | 연결 코드 | 이름 (regions.json) |
|------|-----------|--------------------|
| 서울 | `11` | 서울 |
| 경기·인천 | `41` | 경기 (대표) |
| 강원 | `51` | 강원 |
| 충청 | `44` | 충남 (대표) |
| 전라도 | `12` | 전남·광주 (대표) |
| 경상도 | `47` | 경북 (대표) |
| 부산 | `26` | 부산 |
| 제주 | `50` | 제주 |

- 권역 카드는 대표 시·도로만 연결한다(D-2: 권역 조회 제외). 도착한 목록의 지역 select에 대표 시·도 이름이 보이므로 사용자는 다른 시·도로 바꿀 수 있다.
- 링크의 접근 가능한 이름: 카드 제목 + " 관광지 보기" (`aria-label`). 이미지 `alt`는 기존 값 유지.
- **코드 `12` 확인됨 (v0.2)**: `regions.json`의 `'12': '전남·광주'`는 전남과 광주가 통합된 **전남광주통합특별시** 코드다. 2026-09-28 실제 키로 `/api/v1/search`를 호출했을 때 `lDongRegnCd: "12"` 항목의 주소가 "전남광주통합특별시 순천시 …"로 왔다. 그래서 전라도 카드는 규모가 큰 `12`(전남·광주)로 연결한다.
- `DestinationsPage.css`: 링크 카드에 `:focus-visible` 윤곽선, 호버 커서.

### 5.6 페이지네이션 (FR-09)

`getPageWindow(page, totalPages, windowSize = 5)` → `number[]`

| 경우 | 결과 |
|------|------|
| totalPages ≤ 5 | 1 ~ totalPages |
| 앞쪽 (page ≤ 3) | 1 ~ 5 |
| 뒤쪽 (page ≥ totalPages − 2) | totalPages − 4 ~ totalPages |
| 가운데 | page − 2 ~ page + 2 |

- 버튼: [처음] [이전] {창} [다음] [끝]. 처음·끝은 `aria-label="첫 페이지"`/`"마지막 페이지"`, 이전·다음은 기존 `aria-label` 유지. 현재 페이지 `aria-current="page"`. 첫 페이지에서 처음·이전, 마지막 페이지에서 다음·끝은 `disabled`.
- `totalPages ≤ 1`이면 페이지네이션을 렌더하지 않는다.
- **페이지 이동 후**: 목록 상단(건수 영역)으로 스크롤하고(`prefers-reduced-motion`이면 `behavior: 'auto'`), 건수 영역(`tabIndex={-1}`)에 포커스를 옮긴다. 키보드 사용자가 페이지 하단 버튼에서 다시 올라올 필요가 없다. 기존 `goToPage`의 `offsetTop - 110`(고정 헤더 높이) 보정은 `scroll-margin-top: 110px`으로 옮긴다.
- **범위 초과 보정**: success인데 `query.page > data.totalPages`이고 `totalPages > 0`이면 `onPageChange(totalPages, { replace: true })`. `totalCount === 0`이고 `page > 1`이면 `onPageChange(1, { replace: true })`. `TourListView`의 effect에서 실행한다(URL 이동이라 set-state 규칙과 무관). 보정 후 요청이 1회 더 나간다(불가피, 직접 입력한 URL에서만 발생).

### 5.7 반응형

| 폭 | 그리드 | 필터 바 | 페이지네이션 | 모달 |
|----|--------|---------|--------------|------|
| > 900px | 3열 (기존) | 한 줄 | 버튼 48px | 기존 |
| 621 ~ 900px | 2열 (기존) | 줄바꿈 | 48px | 기존 |
| ≤ 620px | 1열 (기존) | select가 폭 100%로 세로 배치 | 버튼 40px, gap 6px, **처음·끝 버튼 숨김** (9개 → 7개, 360px에서 가로 스크롤 없음) | 시·도 3열, 시군구 목록 스크롤 |

- 탭은 기존 `flex-wrap`을 유지한다(관광지 5개, 문화시설 5개).
- 카드 이미지: `aspect-ratio: 4 / 3; width: 100%; object-fit: cover` (기존 `height: 250px` 대체). 스켈레톤도 같은 비율.

### 5.8 카드 (`TourCard`, FR-10)

- 구조: `<article className="catalog-card"><Link className="catalog-card__link" to={detailPath}>` 이미지 + 분류 배지(`catalog-card__image-tag`, category 있을 때만) + `<h2>` 제목 + 주소(`PlacePinIcon`)`</Link></article>`.
- 이미지: `loading="lazy"`, `decoding="async"`, `alt=""`(제목이 바로 옆에 있어 중복 낭독 방지), `width`/`height` 속성으로 비율 힌트.
- 이미지가 없거나 로드에 실패하면 `assets/figma/destination-jeju.png`(상세와 같은 기본 이미지). 실패는 `isImageBroken` state로 한 번만 교체한다(이전 기능 SI-4와 같은 규칙).
- 제목은 2줄 말줄임(`-webkit-line-clamp: 2`), 주소는 1줄 말줄임. 카드 높이가 제목 길이에 따라 들쭉날쭉하지 않게 한다.
- 카드 key는 `contentId`. 목업처럼 index를 섞지 않는다(중복 카드가 없음).

---

## 6. 오류 처리

| 상황 | 판정 위치 | 프론트 상태 | 사용자 행동 |
|------|-----------|-------------|-------------|
| 검색 결과에 `contentTypeId` 없음·허용값 아님 | `parseTourListQuery` | idle (no-query), 요청 0건 | 조건 선택하기 |
| 허용값이 아닌 파라미터 | `parseTourListQuery` | 기본값으로 정규화, URL `replace` | - |
| 400 `INVALID_REQUEST` (정규화를 통과했지만 서버가 거절, 예: 없는 지역 조합) | 백엔드 | error `invalid` + `console.warn` | 조건 초기화 |
| 502 / 500 / 네트워크 | 백엔드·브라우저 | error `failed` + `console.error` | 다시 시도 |
| 200인데 형식이 다름 | `toTourList` | error `failed` | 다시 시도 |
| 0건 | - | empty | 조건 초기화 / 조건 변경 |
| page가 총 페이지보다 큼 | `TourListView` | 마지막 페이지로 `replace` | - |
| 요청 취소 (조건 변경, 언마운트) | `isAbortError` | 변화 없음 | - |
| 지역·시군구 API 실패 | `useRegionOptions` | select·모달 그룹만 error, 목록은 정상 | 해당 영역 다시 시도 |
| 카드 이미지 로드 실패 | `TourCard` | 기본 이미지 | - |
| 즐기기 검색 | 기존 동작 | 변화 없음 | - |

---

## 7. 보안

- [ ] URL 파라미터는 화이트리스트·정규식을 통과한 값만 API 요청에 넣는다(§3.2). 쿼리 문자열은 `URLSearchParams`로만 만든다(문자열 이어 붙이기 금지)
- [ ] 외부 API 문자열(제목·주소·분류명)은 텍스트로만 렌더링한다(`dangerouslySetInnerHTML` 미사용)
- [ ] 카드 링크는 `getTourDetailPath`가 만든 내부 경로만 쓴다(외부 URL 링크 없음)
- [ ] 이미지 `src`는 API 값을 그대로 쓰되 `<img>`에만 넣는다(스크립트 실행 경로 없음)
- [ ] 서버 오류 `message`는 화면에 노출하지 않는다

---

## 8. 테스트 계획

### 8.1 범위

| 유형 | 대상 | 도구 | 담당 |
|------|------|------|------|
| 단위 (백엔드) | BE-5 테스트 2개 | JUnit, `mvnw clean test` | frontend-support-backend |
| L1 API | §8.2 | curl | frontend-support-backend (#9·#11은 실제 키) |
| 정적 (프론트) | build, lint | `npm run build`, `npx eslint .` | frontend-lead |
| L2 UI | §8.3 | 브라우저 + 네트워크 탭 (throttling) | frontend-lead (백엔드 완료 후) |

프론트 테스트 러너는 없다. `lib/`의 순수 함수는 설계상 단위 테스트 가능하지만 이번에는 러너를 추가하지 않는다(새 의존성 금지). 후속 과제로 둔다.

### 8.2 L1 API 시나리오

| # | 요청 | 프로필 | 기대 |
|---|------|--------|------|
| 1 | `GET /api/v1/search?contentTypeId=12&size=9&page=1` | local-mock | 200, `items` 9건, `totalCount` 23, 첫 항목 `126508` |
| 2 | `GET /api/v1/search?contentTypeId=12&size=9&page=3` | local-mock | 200, `items` 5건, `size` 5, `totalCount` 23 |
| 3 | `GET /api/v1/search?contentTypeId=12&lDongRegnCd=31` | local-mock | 200, `items` [], `totalCount` 0 |
| 4 | `GET /api/v1/search?contentTypeId=14&lclsSystm2=VE07` | local-mock | 200, 모든 항목 `lclsSystm2 == "VE07"` (BE-1 보정으로 `lclsSystm1` 없이도 동작) |
| 5 | `GET /api/v1/search?contentTypeId=12&page=0` | local-mock | 400 `INVALID_REQUEST` (기존 검증 경로 확인) |
| 6 | `GET /api/v1/search?contentTypeId=12&arrange=X` / `arrange=q` | local-mock | 400 `INVALID_REQUEST` |
| 7 | `GET /api/v1/search?contentTypeId=12&arrange=O` | local-mock | 200 |
| 8 | `GET /api/v1/regions`, `GET /api/v1/regions/districts?lDongRegnCd=11` | local-mock | 200, 16건 / 서울 시군구 |
| 9 | `GET /api/v1/search?contentTypeId=14&lclsSystm1=VE&size=1` | 기본 + 실제 키 | `totalCount` 기록 → Q-3 상한 확정 근거. `contentTypeId=14&lclsSystm2=VE07` 1회 호출 후 서버 로그에서 원본 조회 횟수(≤ 20) 확인 |
| 10 | `GET /api/v1/home` | local-mock | 200, 기존과 같은 3건 (회귀 없음) |
| 11 | `GET /api/v1/search?contentTypeId=12&lDongRegnCd=12&size=1` | 기본 + 실제 키 | 200, `totalCount > 0`, 주소가 "전남광주통합특별시"로 시작 (§5.5, 코드 유효성은 2026-09-28 확인됨) |
| 12 | `GET /api/v1/tour/contents/9120004?contentTypeId=12` | local-mock | 200, 제목 `목 관광지 04` (합성 항목 상세) |

### 8.3 L2 UI 체크리스트

**카탈로그 (local-mock)**
- [ ] `/destinations/attractions` → 스켈레톤 → 9건, "총 23건", 페이지 1 ~ 3. 가짜 45건·가짜 페이지 없음
- [ ] 3페이지 → 5건. URL `?page=3`. 건수 영역에 포커스, 목록 상단으로 스크롤
- [ ] 3페이지에서 카드 클릭 → 상세 제목이 카드와 같음 → 뒤로 가기 → 3페이지, 같은 스크롤 위치
- [ ] 지역 `제주` → URL `?lDongRegnCd=50`, page 1로 초기화. 시군구 select 활성
- [ ] 지역 `울산` → 빈 상태 → [조건 초기화] → `/destinations/attractions`
- [ ] 정렬 `이름순` → `?arrange=O`. 지역순·최근 수정순 옵션 없음
- [ ] 탭 `역사` → `?lclsSystm1=HS` (목은 같은 목록, 문서화된 한계). 탭이 링크라 새 탭으로 열 수 있음
- [ ] `/destinations/culture` → 11건. 탭 `전시` → `?lclsSystm2=VE07` → VE07 항목만
- [ ] 관광지 ↔ 문화시설 메뉴 이동 → 이전 유형 카드가 보이지 않고 스켈레톤부터 시작
- [ ] 카드에 북마크 버튼 없음
- [ ] 이미지 없는 카드 → 기본 이미지, 비율 유지

**URL 정규화**
- [ ] `?page=abc`, `?page=0`, `?arrange=Z`, `?lclsSystm1=XX`, `?lDongSignguCd=110`(지역 없음), `?region=서울` → 각각 기본값으로 `replace`. 뒤로 가기가 잘못된 URL로 돌아가지 않음. 요청은 정규화된 조건으로 1회
- [ ] `/destinations/culture?lclsSystm1=NA` → 파라미터 제거
- [ ] `?page=99` → 마지막 페이지(3)로 `replace`
- [ ] 정규화된 URL을 새 탭에 붙여 넣기 → 같은 목록

**경쟁 조건·취소**
- [ ] 네트워크 Slow 3G에서 지역을 빠르게 3번 바꿈 → 이전 요청 2건 canceled, 마지막 조건의 결과만 표시
- [ ] 조건 변경 중 refreshing: 이전 카드 흐리게, `aria-busy="true"`
- [ ] 요청 중 다른 페이지로 이동 → 콘솔 오류 없음 (abort 무시)
- [ ] 백엔드 중지 → 오류 블록 [다시 시도] → 백엔드 시작 → 다시 시도 → 성공. 재시도 후 또 실패하면 제목에 포커스
- [ ] `?lDongRegnCd=99999` → empty 또는 invalid 안내, 조건 초기화로 복구

**검색 결과·모달**
- [ ] `/destinations/search` (조건 없음) → "검색 조건을 선택해 주세요" + [조건 선택하기], `/api/v1/search` 요청 0건
- [ ] 홈 히어로 검색 → 모달: 시·도 16개 + 전국, 시군구는 시·도 선택 후 로드, 여행코스는 비활성 + "준비 중"
- [ ] 유형 선택 전 검색 버튼 비활성, 안내 문구 표시
- [ ] 서울 · 종로구 · 문화시설 · 전시시설 → 검색 → 전체 새로고침 없음(네트워크 탭에 문서 요청 없음), URL `?contentTypeId=14&lDongRegnCd=11&lDongSignguCd=110&lclsSystm2=VE07`
- [ ] 배너 칩 "지역 서울 종로구", "유형 문화시설", "상세 전시시설"
- [ ] [조건 변경] → 모달이 현재 조건으로 채워져 열림 → 지역 변경 → 검색 → 모달 닫힘, 목록 갱신, 맨 위로 스크롤
- [ ] 결과 → 카드 → 상세 → 뒤로 → 같은 조건·페이지
- [ ] 모달을 두 번째 열 때 지역 목록 로딩 없음 (`/regions` 요청 세션당 1회)
- [ ] `/regions` 차단(개발자 도구) → 모달 시·도 그룹만 오류 + 다시 시도, 목록은 정상

**모달 접근성**
- [ ] 열면 dialog에 포커스, 스크린 리더가 제목을 읽음
- [ ] Esc·닫기·오버레이 클릭 → 닫히고 여는 버튼으로 포커스 복원
- [ ] (여유 범위) Tab을 계속 누르면 모달 안에서만 순환

**즐기기 검색 회귀 (B안 필수)**
- [ ] `/enjoy` → 즐기기 검색 모달: 제목·설명·단계 제목·버튼 모양이 변경 전과 같음
- [ ] 시·도 '전체' 선택 전에는 시군구 '전체' 비활성, 유형 선택 전에는 세부 '전체' 비활성
- [ ] 전체 · 전체 · 음식점 · 전체 → 검색 → **전체 새로고침으로** `/enjoy/search?region=%EC%A0%84%EC%B2%B4&district=%EC%A0%84%EC%B2%B4&type=%EC%9D%8C%EC%8B%9D%EC%A0%90&detail=%EC%A0%84%EC%B2%B4` (키 순서 `region, district, type, detail`)
- [ ] 아무것도 고르지 않고 검색 → `/enjoy/search?region=&district=&type=&detail=` (빈 키 유지, 변경 전과 같음)
- [ ] 결과 페이지가 음식점 목업 목록을 표시 (`EnjoySearchResultsPage.jsx` 변경 없음을 `git diff`로 확인)
- [ ] 결과 페이지에서 [조건 변경] → 모달이 `type=음식점`으로 채워져 열림
- [ ] 선택 요약: 지역은 시·도와 시군구를 모두 골랐을 때만 표시

**랜딩·회귀**
- [ ] `/destinations` 지역 카드 8개가 링크. 서울 → `/destinations/attractions?lDongRegnCd=11`, 키보드 Tab·Enter로 이동 가능
- [ ] `/destinations/courses` → 기존 목업 목록과 코스 상세 그대로
- [ ] 목업 상세(`/destinations/detail/bijarim`)와 주변 장소 섹션 그대로
- [ ] 로그인·로그아웃, 토큰 갱신 후 목록 요청 정상 (signal 추가 회귀 없음)

**반응형·공통**
- [ ] 360px: 카탈로그·검색 결과·모달에 가로 스크롤 없음. 페이지네이션 7개 버튼 한 줄
- [ ] 768px: 2열 그리드, 필터 줄바꿈
- [ ] 로딩·페이지 전환 중 그리드 높이 급변 없음 (스켈레톤 = 카드 치수)
- [ ] `npm run build`, `npx eslint .` 오류 0

---

## 9. 구조

### 9.1 계층

| 계층 | 위치 | 이번 기능 모듈 | 규칙 |
|------|------|----------------|------|
| 화면 (라우트) | `src/pages/` | `TourCatalogPage`, `DestinationSearchResultsPage`, `DestinationsPage` | URL 해석과 화면 조립만. API를 직접 import하지 않음 |
| 표시 컴포넌트 | `src/components/tour-list/`, `src/components/search/` | `TourCard`, `TourCardGrid`, `TourCardSkeleton`, `ListStatus`, `Pagination`, `ListFilterBar`, `SearchModalFrame`, `SearchOptionGroup`, `SearchModal` | props만 받음. 훅·API import 금지 |
| 컨테이너 | 같은 폴더 | `TourListView`, `TravelSearchModal`, `EnjoySearchModal` | 훅을 호출해 표시 컴포넌트에 전달 |
| 훅 | `src/hooks/` | `useTourList`, `useListSearchParams`, `useRegionOptions`, `useSearchSelection` | React 상태·effect. JSX 없음 |
| API 모듈 | `src/api/` | `tourApi` (추가), `client` (signal) | 네트워크와 view model 변환 |
| 순수 로직 | `src/lib/` (신규 폴더) | `tourListQuery`, `pagination` | React·네트워크 import 금지 |
| 설정 | `src/data/` | `tourListConfigs` (신규), `tourContentTypes` (기존) | 상수와 조회 함수 |

`lib/` 폴더를 새로 만드는 이유: `data/`는 상수·목업, `api/`는 네트워크를 둔다. URL 파싱은 둘 다 아니다. `utils/`처럼 무엇이든 들어가는 이름 대신, "React 밖의 도메인 로직"이라는 규칙을 가진 폴더로 둔다.

### 9.2 의존 규칙

```
pages ─▶ components(컨테이너) ─▶ components(표시)
  │            │
  └──▶ hooks ◀─┘ ─▶ api ─▶ client
         │           │
         └──▶ lib ◀──┘      data ◀── (모든 계층에서 읽기 가능)
```

- `lib`, `data`는 다른 계층을 import하지 않는다(`tourListConfigs` → `tourContentTypes` 제외).
- 표시 컴포넌트는 `hooks`, `api`를 import하지 않는다.
- 목업(`destinationMocks`)을 import하는 새 파일은 없다.

---

## 10. 코딩 규칙

- 기존 스타일 유지: 세미콜론 없음, 작은따옴표, 한국어 주석
- 주요 결정 지점에 `// Design Ref: §N — 이유` 주석
- 새 의존성 추가 금지 (테스트 러너 포함)
- 새로 쓰는 JSX는 읽을 수 있게 줄을 나눈다. 옮기기만 하는 기존 한 줄 JSX(랜딩 섹션 등)는 재포맷하지 않는다(diff 최소화)
- 컴포넌트 파일은 컴포넌트만 export한다(`react-refresh/only-export-components`). 상수는 `listMessages.js`, 순수 함수는 `lib/`
- 스타일: 새 컴포넌트는 기존 `catalog-*` 클래스를 재사용하고, 새 규칙만 `components/tour-list/TourList.css`(`tour-list__*`)에 둔다. 페이지가 `DestinationCatalogPage.css`를 import한다. 공용 카드 스타일을 컴포넌트 폴더로 옮기는 정리는 후속 과제
- 수정 금지: `EnjoySearchResultsPage.jsx`, `EnjoyCategoryPage.*`, `TravelDetailPage.*`, `EnjoyDetailPage.*`, `destinationMocks.js`, `NotFoundPage.jsx`, `StatusPage.css`

---

## 11. 구현 가이드

### 11.1 파일별 변경 목록과 소유

두 구현 에이전트가 같은 파일을 수정하지 않도록 소유자를 나눈다.

**frontend-support-backend 소유 (백엔드만, 수정 3 · 신규 2)**

| 파일 | 구분 | 명세 |
|------|------|------|
| `tour/dto/request/TourSearchRequest.java` | 수정 | BE-1, BE-3 |
| `tour/service/TourClassificationSearchService.java` | 수정 | BE-2 |
| `tour/client/MockTourApiClient.java` | 수정 | BE-4 |
| `src/test/.../tour/dto/request/TourSearchRequestTest.java` | 신규 | BE-5 |
| `src/test/.../tour/service/TourClassificationSearchServiceTest.java` | 신규 | BE-5 |

**frontend-lead 소유 (프론트만, 신규 19 · 수정 12)**

| 파일 | 구분 | 내용 | 예상 줄 수 |
|------|------|------|:---:|
| `src/lib/tourListQuery.js` | 신규 | §3.1 ~ 3.2 | 130 |
| `src/lib/pagination.js` | 신규 | §5.6 `getPageWindow` | 25 |
| `src/data/tourListConfigs.js` | 신규 | §3.4 | 60 |
| `src/hooks/useListSearchParams.js` | 신규 | §3.2 정규 URL 교체, `updateQuery`, `resetQuery` | 50 |
| `src/hooks/useTourList.js` | 신규 | §2.4 | 70 |
| `src/hooks/useRegionOptions.js` | 신규 | §4.2 | 80 |
| `src/hooks/useSearchSelection.js` | 신규 | §3.5 | 40 |
| `src/components/tour-list/TourListView.jsx` | 신규 | §5.1 계약, 페이지 초과 보정, 이동 후 포커스 | 90 |
| `src/components/tour-list/TourCardGrid.jsx` | 신규 | 그리드, `busy` | 25 |
| `src/components/tour-list/TourCard.jsx` | 신규 | §5.8 | 45 |
| `src/components/tour-list/TourCardSkeleton.jsx` | 신규 | §5.1 | 20 |
| `src/components/tour-list/ListStatus.jsx` | 신규 | §5.1 4가지 variant | 60 |
| `src/components/tour-list/Pagination.jsx` | 신규 | §5.6 | 55 |
| `src/components/tour-list/ListFilterBar.jsx` | 신규 | §5.2 | 80 |
| `src/components/tour-list/listMessages.js` | 신규 | 문구 상수 | 30 |
| `src/components/tour-list/TourList.css` | 신규 | 스켈레톤, busy, 상태 블록, 반응형 페이지네이션, 카드 비율·말줄임 | 110 |
| `src/components/search/SearchModalFrame.jsx` | 신규 | §5.4 | 90 |
| `src/components/search/SearchOptionGroup.jsx` | 신규 | §5.4 | 55 |
| `src/pages/TourCatalogPage.jsx` | 신규 | §5.2 | 80 |
| (신규 합계 19개) | | | 약 1,195 |
| `src/api/client.js` | 수정 | §2.5 signal, `isAbortError` | +10 |
| `src/api/tourApi.js` | 수정 | §3.3, §4.2 | +120 |
| `src/App.jsx` | 수정 | 카탈로그 라우트 2개 → `TourCatalogPage key={kind}` | +3 / -2 |
| `src/pages/DestinationCatalogPage.jsx` | 수정 | course 전용: attraction·culture 설정 제거(죽은 코드). course 동작 변경 없음 | -3 |
| `src/pages/DestinationSearchResultsPage.jsx` | 수정 | §5.3 재작성 | +70 / -20 |
| `src/pages/DestinationSearchResultsPage.css` | 수정 | 쓰지 않는 `search-results-grid` 카드 규칙 제거, 배너 유지 | -25 |
| `src/components/search/SearchModal.jsx` | 수정 (재작성) | §5.4 제어 컴포넌트 | +90 / -120 |
| `src/components/search/SearchModal.css` | 수정 | 버튼 목록 wrap, 시군구 스크롤, 비활성 배지, 로딩·오류 줄 | +20 |
| `src/components/search/TravelSearchModal.jsx` | 수정 | §3.5, §5.4 | +90 / -25 |
| `src/components/search/EnjoySearchModal.jsx` | 수정 | §3.6 어댑터 | +50 / -10 |
| `src/pages/DestinationsPage.jsx` | 수정 | §5.5 | +12 / -2 |
| `src/pages/DestinationsPage.css` | 수정 | 지역 링크 카드 포커스·커서 | +3 |

- 변경 규모: 프론트 약 +1,700 / -210, 백엔드 약 +200 / -10 (테스트 포함). §2.0 표의 수치는 설계 초안 기준이며 이 표가 최신이다.
- `EnjoySearchResultsPage.jsx`, `HeroSection.jsx`는 수정하지 않는다(`TravelSearchModal`의 props가 같음).

### 11.2 구현 순서와 병렬화

**병렬 가능**: 파일이 겹치지 않고 API 계약(§4.2)이 확정되어 있다. 계획 7.3은 "백엔드 먼저"였지만, 프론트 M2·M5는 백엔드 없이 진행할 수 있다.

```
시간 →
frontend-support-backend : BE-1 → BE-3 → BE-2 → BE-4 → BE-5 → BE-6 (test, L1)
frontend-lead            : F-1 → F-2 → F-3 → F-4 → F-5 → F-6 → F-7 (build, lint)
                                                                    ↘
                                          (둘 다 완료) → F-8 L2 확인 → 리뷰 · gap 분석
```

**프론트가 백엔드에 의존하는 지점**

| 지점 | 의존 | 백엔드 완료 전 | 개발 방법 |
|------|------|----------------|-----------|
| 페이지네이션·빈 상태 확인 | BE-4 목 개선 | 목이 3건 고정 → 1페이지만, 빈 결과 불가 | 로직은 계약대로 구현, 확인은 BE-4 이후 |
| 문화시설 탭 | BE-4 (VE06 ~ 09 배정) | 목 항목에 `lclsSystm2` 없음 → 항상 빈 결과 | 동일 |
| arrange 400 | BE-3 | 잘못된 값도 200 | 프론트 정규화가 막으므로 영향 없음 |
| 로딩·오류·취소·URL 정규화·모달·즐기기 회귀 | 없음 | - | 바로 확인 가능 (백엔드 중지로 오류 재현) |

**프론트 구현 순서 (frontend-lead)**

1. [ ] F-1 `client.js` signal · `isAbortError`, `tourApi.js` 목록·지역 함수와 view model
2. [ ] F-2 `lib/tourListQuery.js`, `lib/pagination.js`, `data/tourListConfigs.js`
3. [ ] F-3 `useTourList`, `useListSearchParams`, `useRegionOptions`
4. [ ] F-4 `components/tour-list/*`, `TourCatalogPage`, `App.jsx` 라우트
5. [ ] F-5 `useSearchSelection`, `SearchModalFrame`, `SearchOptionGroup`, `SearchModal` 재작성, `EnjoySearchModal` 어댑터 → **즐기기 회귀 체크리스트 먼저 확인**
6. [ ] F-6 `TravelSearchModal`, `DestinationSearchResultsPage`, `DestinationsPage` 지역 카드
7. [ ] F-7 `npm run build`, `npx eslint .`, 백엔드 없이 확인 가능한 L2 항목
8. [ ] F-8 (백엔드 완료 후) §8.3 전체

F-5에서 즐기기 모달을 먼저 옮기는 이유: 공용 `SearchModal`을 재작성하는 순간 즐기기 모달이 영향을 받는다. 여행지 모달 기능을 붙이기 전에 즐기기 회귀가 없음을 확인해 두면, 이후 문제가 생겼을 때 원인을 여행지 쪽으로 좁힐 수 있다.

### 11.3 Session Guide

> 세션 분할은 권장 사항이다. `/pdca do destination-list-integration --scope module-N`으로 모듈 하나씩 구현한다.

#### Module Map

| Module | Scope Key | 담당 | 내용 | 파일 | 예상 턴 |
|--------|-----------|------|------|------|:---:|
| 백엔드 방어·목 개선 | `module-1` | frontend-support-backend | BE-1 ~ BE-6 | 백엔드 5개 | 25-35 |
| 목록 기반 | `module-2` | frontend-lead | F-1 ~ F-3: client signal, tourApi, lib, config, 훅 3개 | 8개 | 30-40 |
| 목록 UI·카탈로그 | `module-3` | frontend-lead | F-4: tour-list 컴포넌트 9개, TourCatalogPage, App 라우트 | 12개 | 35-45 |
| 검색 모달 공통화·즐기기 어댑터 | `module-4` | frontend-lead | F-5: selection, Frame, OptionGroup, SearchModal, EnjoySearchModal, CSS | 6개 | 30-40 |
| 검색 결과·여행지 모달·랜딩 | `module-5` | frontend-lead | F-6 ~ F-7 | 6개 | 25-35 |
| 통합 확인 | `module-6` | frontend-lead | F-8 L2 전체, 발견 문제 수정 | - | 20-30 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 (완료) | - |
| Session 2 | Do (백엔드) | `--scope module-1` | 25-35 |
| Session 3 | Do | `--scope module-2` | 30-40 |
| Session 4 | Do | `--scope module-3` | 35-45 |
| Session 5 | Do | `--scope module-4` | 30-40 |
| Session 6 | Do | `--scope module-5,module-6` | 45-60 |
| Session 7 | Check (코드 리뷰 + gap 분석) + Act | 전체 | 30-40 |
| Session 8 | Report + 포트폴리오 추출 | 전체 | 20-30 |

- Session 2는 Session 3 ~ 5와 병렬로 진행할 수 있다(파일이 겹치지 않음). Session 6의 module-6은 Session 2가 끝나야 한다.
- 각 세션 끝에 `npm run build`와 `npx eslint .`(프론트) 또는 `mvnw clean test`(백엔드)를 통과시켜 다음 세션이 깨진 상태에서 시작하지 않게 한다.

---

## 12. 이후 단계

frontend-code-reviewer 리뷰와 bkit gap 분석을 거쳐 frontend-lead가 문제를 수정한다. 완료 보고서를 쓴 뒤 frontend-interview-coach가 포트폴리오 자료를 추출한다.

---

## 13. 후속 과제와 계획 반영

### 13.1 후속 과제 (이번 범위 밖)

- 여행코스 목록·상세 API (D-1) → 모달의 여행코스 유형 활성화
- 즐기기 카테고리·검색 결과 API 전환: `tourListConfigs`에 항목 추가, `EnjoySearchResultsPage`를 `useListSearchParams`로 교체, 즐기기 모달 어댑터를 코드 쿼리·`navigate()`로 교체
- 상세 목업 분기와 `destinationMocks.js` 정리 (D-5)
- 카드 북마크: 기존 `TourBookmarkController`와 로그인 흐름 연동
- 권역(regionGroup) 조회와 백엔드 버그 (D-2) → 랜딩 권역 카드를 권역 목록으로 연결
- 모달 포커스 트랩 (F-5에서 못 하면)
- 프론트 테스트 러너 도입 후 `lib/` 단위 테스트
- 공용 카드·그리드 CSS를 `components/tour-list/`로 이동 (`DestinationCatalogPage.css` 의존 제거)
- `TourExceptionHandler`와 `GlobalExceptionHandler`의 `IllegalArgumentException` 중복 (이전 기능 후속 과제)
- local-mock 관광지 대분류 필터 (이번 목 개선에서 제외)

### 13.2 계획 문서에 반영할 변경

| 계획 위치 | 반영 내용 |
|-----------|-----------|
| 2.1 포함 | 즐기기 검색 모달 어댑터 이전(P-1), local-mock 목 최소 개선(P-2), 모달 포커스 관리(P-7), 백엔드 단위 테스트(P-8) 추가 |
| 2.2 제외 | "북마크 ... 제거하거나 숨김, 설계에서 결정" → "제거(Q-1)". 즐기기 전환 제외 문구에 "즐기기 검색 모달은 어댑터로 이전, 결과 페이지는 유지" 추가 |
| 3.1 FR-07 | 정렬 옵션을 Q(기본)·O로 확정 |
| 3.1 FR-12 | 분류 선택지 출처를 `/classifications` → `tourListConfigs` 정적 정의로 변경(P-3). 여행코스 유형 비활성(Q-5) 추가 |
| 3.1 FR-13 | 캐시 대상에서 분류 제외(지역·시군구만) |
| 3.1 FR-15 | 상한 20페이지(2,000건) + WARN 로그, 실제 키로 확정 (Q-3) |
| 3.1 FR 추가 | 조건 없는 검색 결과 진입 시 no-query 안내(Q-6) |
| 5 위험 | local-mock 위험 대응을 "BE-4로 해결"로 갱신. `regions.json` 코드 확인 위험 추가 |
| 6.1 / 6.2 | `EnjoySearchModal.jsx` 변경 자원 추가, `App.jsx` 라우트 변경 추가 |
| 7.2 | 설계안 B 선택(사용자 결정) 기록 |
| 7.3 | "백엔드 먼저" → "병렬 가능, L2 통합 확인만 백엔드 완료 후" |

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-28 | 초안. 설계안 A/B/C 비교, 사용자 선택 B, Q-1 ~ Q-6 결정 반영. URL 스키마, view model, `useTourList` 상태 머신, option 모델·즐기기 어댑터, 백엔드 BE-1 ~ BE-6, 테스트 계획, 파일 소유, Session Guide | WOOJIN |
| 0.2 | 2026-09-28 | §5.5·§8.2 #11·§13.1: 지역 코드 `12`는 전남광주통합특별시로 실제 키 응답에서 확인됨. 전라도 카드를 `52` → `12`로 변경, 후속 과제에서 제거 | WOOJIN |
