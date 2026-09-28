# destination-list-integration Analysis Report

> **Analysis Type**: Gap Analysis (설계 대비 구현)
>
> **Project**: WayLog (React + Spring Boot 국내 여행 SNS)
> **Analyst**: bkit gap-detector + WOOJIN (Claude Code 보조)
> **Date**: 2026-09-28
> **Design Doc**: [destination-list-integration.design.md](../02-design/features/destination-list-integration.design.md)
> **Plan Doc**: [destination-list-integration.plan.md](../01-plan/features/destination-list-integration.plan.md)

PRD 문서는 없다(이 기능은 PM 단계 없이 바로 Plan부터 시작함). PRD Alignment 섹션은 생략한다.

---

## Context Anchor

> Design 문서에서 복사했다.

| Key | Value |
|-----|-------|
| **WHY** | 목록과 검색이 목업이라 검색 → 목록 → 상세 흐름이 실제 데이터로 이어지지 않고, 필터 상태가 뒤로 가기에서 사라진다 |
| **WHO** | 지역·유형으로 여행지를 찾는 방문자, 상세를 보고 목록으로 돌아오는 사용자, 공유된 목록 URL로 들어오는 사용자 |
| **RISK** | TourAPI 일일 1,000회 한도 / 목업 탭과 API 분류 체계 불일치 / 늦게 도착한 응답이 최신 결과를 덮어씀 / 목업에 의존하는 상세 "주변 장소" 섹션 |
| **SUCCESS** | 카탈로그·검색 결과가 실제 API 데이터와 totalCount를 표시 / 필터·페이지가 URL에 반영되고 뒤로 가기로 복원 / 로딩·에러·빈 상태 구분 / 카드 → 상세 제목 일치 / 빠른 조건 변경에도 마지막 조건의 결과만 표시 |
| **SCOPE** | 프론트: client.js signal, tourApi 목록 함수·view model, useTourList, 공통 목록 컴포넌트, DestinationCatalogPage(관광지·문화), DestinationSearchResultsPage, SearchModal/TravelSearchModal, DestinationsPage 지역 카드 링크 / 백엔드: 중분류 조회 호출량 방어, arrange 검증 |

---

## Success Criteria Status (계획 §4.1 완료 조건)

| # | 조건 | 상태 | 근거 |
|---|------|:----:|------|
| 1 | 카탈로그가 실제 API와 totalCount 표시 | ✅ | 정적 확인 + L1 #1·#2 실측(local-mock) |
| 2 | 탭·지역·정렬·페이지가 URL에 반영되고 뒤로 가기로 복원 | ⚠️ 정적만 | push/replace 정책은 코드로 확인. 뒤로 가기 시 스크롤 위치 복원은 브라우저 미검증 |
| 3 | URL 직접 입력·공유, 정규화 | ✅ | `parseTourListQuery`/`serializeTourListQuery`/replace 확인 |
| 4 | 모달에서 실제 조건을 골라 전체 새로고침 없이 이동 | ⚠️ 정적만 | `navigate()` 사용 확인. 네트워크 탭 기준 문서 요청 없음은 브라우저 미검증 |
| 5 | 로딩·에러·빈 상태 구분 | ✅ | `TourListView`, `ListStatus` |
| 6 | 카드와 상세 제목 일치 | ⚠️ 정적만 | contentId·경로 규칙 일치. 합성 상세 L1 #12 미실행 |
| 7 | 빠른 조건 변경 시 마지막 결과만 표시 | ⚠️ 정적만 | AbortController + isActive 이중 방어 확인. Slow 3G 실측 없음 |
| 8 | 랜딩 지역 카드가 목록으로 이동 | ✅ | `DestinationsPage` 지역 카드 8개 링크 확인 |
| 9 | `/destinations/courses`와 상세 목업 분기에 회귀 없음 | ✅ | `git diff e951693 8bd1991 -- <수정 금지 파일 8개>` 결과 없음(직접 확인) |

**Success Rate**: 5/9 완전 충족, 4/9 정적 확인만(브라우저 미검증) — Critical 미충족 없음.

---

## 1. 분석 개요

### 1.1 목적

Do 단계(module-1~6)에서 구현한 코드가 설계 문서(설계안 B)와 계획 문서의 요구사항을 얼마나 충족하는지 확인하고, Report 단계로 넘어가도 되는지 판단한다.

### 1.2 범위

- **설계 문서**: `docs/02-design/features/destination-list-integration.design.md` (§2~§11)
- **구현 경로**: `frontend/src/{lib,data,hooks,components/tour-list,components/search,pages}`, `backend/src/main/java/.../tour/`
- **분석 일자**: 2026-09-28
- **분석 방식**: 정적 분석(gap-detector, 전체 파일 정독) + 실측 L1 API(local-mock 서버에 curl) + `mvnw clean test`. 브라우저 조작(L2/L3)은 이 환경에 자동화 도구가 없어 미실행.

---

## 2. Gap 분석 (설계 vs 구현)

### 2.1 API 계약 3면 대조 (설계 §4 ↔ 서버 ↔ 클라이언트)

| # | 엔드포인트 | 설계 | 서버 | 클라이언트 | 결과 |
|---|------------|:----:|:----:|:----------:|:----:|
| 1 | `GET /api/v1/search` | ✅ | ✅ `TourController` → `TourSearchRequest` → `{items,page,size,totalCount}` | ✅ `toTourApiParams`/`toTourList` | PASS |
| 2 | `GET /api/v1/regions` | ✅ | ✅ | ✅ `fetchRegions` (Promise 캐시) | PASS |
| 3 | `GET /api/v1/regions/districts` | ✅ | ✅ | ✅ `fetchDistricts` (코드별 캐시) | PASS |
| 4 | `GET /api/v1/classifications` | 사용 안 함 (P-3) | 존재 | 호출 없음 | PASS (설계 의도와 일치) |

**Contract Match Rate**: 4/4 = 100%

### 2.2 구조적 일치 (설계 §11.1 파일 목록)

프론트 신규 19개, 수정 12개, 백엔드 5개 파일이 모두 존재하고 명세한 변경이 반영되어 있다(gap-detector 전수 확인). **Structural Match Rate: 100%**

### 2.3 기능 요구사항(FR-01~FR-18) 충족 여부

18개 FR 전부 ✅. placeholder·TODO·console.log 잔여 0건. 상세 근거는 §7 Gap 목록과 함께 아래 표로 정리한다.

| FR | 판정 | 핵심 근거 |
|----|:--:|-----------|
| FR-01 (signal 전달) | ✅ | `client.js` `request`가 signal을 fetch·재시도 경로에 전달, `refreshSession`에는 전달 안 함(single-flight 보호) |
| FR-02 (fetchTourList 변환) | ✅ | `toTourList`가 요청 size 기준 totalPages 계산, fail-closed |
| FR-03 (toTourCard) | ✅ | id·제목·detailPath 없으면 카드 폐기, 빈 주소 대체 문구 |
| FR-04 (useTourList) | ✅ | requestKey 파생 + AbortController + isActive 이중 방어 |
| FR-05 (URL 상태) | ✅ | `useListSearchParams`의 정규 URL replace, `applyQueryPatch` |
| FR-06 (탭 재구성) | ✅ | `tourListConfigs`(NA/HS/EX/VE, VE06~09) |
| FR-07 (정렬 2종) | ✅ | `SORT_OPTIONS` Q·O만 |
| FR-08 (상태별 화면) | ✅ | `TourListView`/`ListStatus` |
| FR-09 (페이지네이션) | ✅ | `getPageWindow`, 범위 초과 replace 보정 |
| FR-10 (카드) | ✅ | lazy 이미지, 비율 고정, 북마크 없음 |
| FR-11 (검색 결과 공유) | ✅ | `DestinationSearchResultsPage` + `TourListView` |
| FR-12 (검색 모달) | ✅ (정적) | `TravelSearchModal`: API 지역 + 정적 분류, 코드 쿼리, `navigate`, 25 비활성 |
| FR-13 (지역 캐시) | ✅ | Promise 캐시 + 동기 조회 |
| FR-14 (랜딩 카드) | ✅ | 8개 대표 코드 링크 |
| FR-15 (백엔드 보정·상한) | ✅ | BE-1 compact constructor, BE-2 `MAX_SOURCE_PAGES=30` |
| FR-16 (arrange 검증) | ✅ | `ALLOWED_ARRANGES` → 400 |
| FR-17 (no-query) | ✅ | query null이면 API 호출 없이 `ListStatus` |
| FR-18 (local-mock 개선) | ✅ | 유형별 합성 데이터, 페이지 자르기 |

**Functional Match Rate**: 96% (포커스 트랩 미구현(여유 범위), 400 오류 버튼 라벨 이슈(구현 중 발견·수정됨) 등 경미한 감점)

### 2.4 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  100%                │
│  Functional Match Rate:  96%                 │
│  Contract Match Rate:    100%                │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:     98.4%               │
│  = (Structural × 0.2) + (Functional × 0.4)  │
│    + (Contract × 0.4)  [서버 정적 공식]      │
├─────────────────────────────────────────────┤
│  참고: L1 API 실측(local-mock, curl)         │
│  #1,#2,#3,#4,#5,#6,#7,#8,#10 — 9/9 PASS      │
│  #12,#13,#14 — 미실행 (아래 §4 참고)         │
│  L2(브라우저 UI)/L3(E2E) — 미검증            │
└─────────────────────────────────────────────┘
```

---

## 3. Gap 목록

Critical / Important 없음. 전부 Minor.

| # | 등급 | 항목 | 설계 | 구현 | 권장 조치 | 신뢰도 |
|---|:--:|------|------|------|-----------|:--:|
| G-1 | Minor (의도적 변경) | 검색 결과 400(invalid) 버튼 | §5.1: invalid → [조건 초기화] | `DestinationSearchResultsPage`: empty·invalid 모두 [조건 변경]으로 모달을 엶(리뷰에서 발견해 수정한 결과가 더 합리적) | 설계 §5.1 표에 "검색 결과 invalid: [조건 변경] → 모달" 추가 | 95% |
| G-2 | Minor (여유 범위) | 모달 포커스 트랩(Tab 순환) | §5.4: 여유 범위 | `SearchModalFrame.jsx`에 미구현 사유 주석 있음 | §13.1 후속 과제로 기록(이미 설계가 허용) | 100% |
| G-3 | Minor (문서 drift) | `tourApi.js` 공개 계약 시그니처 | §4.2: `toTourList(data, requestedSize)`, `toTourCard(item)` | 실제: `toTourList(data, {size,page,contentTypeId})`, `toTourCard(item, fallbackContentTypeId)` | 설계 §4.2를 코드에 맞춰 갱신 | 100% |
| G-4 | Minor (문서 drift) | `useTourList` 캐시 키 | §2.4: `serializeTourListQuery(query)` | 실제: `toTourApiParams(query)` (카탈로그 URL에 유형이 없어 키 충돌을 피하려는 의도적 선택, 주석 있음) | 설계 §2.4 갱신 | 100% |
| G-5 | Minor | 페이지 초과 보정 effect 의존성 | §5.6 | `DestinationSearchResultsPage.jsx`의 `handlePageChange`가 `useCallback`이 아님(카탈로그는 씀). 값은 같아 무해하나 렌더마다 재생성 | `useCallback`으로 감싸기(선택) | 70% |
| G-6 | Minor | 쿼리 문자열 구성 방식 | §7: `URLSearchParams`로만 | `DestinationsPage.jsx`의 지역 카드 링크가 템플릿 문자열 사용(값은 상수 코드라 실제 위험 없음) | `URLSearchParams`로 통일(선택) | 90% |
| G-7 | Minor (문서 drift) | 의존 규칙 표 | §2.6: `lib/*` 의존 없음 | 실제: `lib/tourListQuery` → `data/tourListConfigs` (P-3 결정과 일치, §9.2와도 부합) | §2.6 표 갱신 | 95% |
| G-8 | Minor (문서 stale) | BE-2/BE-5 수치 | §4.3: "첫 조회 20회" | 실제 상한 30페이지(§4.3 BE-2 본문은 이미 30으로 갱신되어 있으나 다른 단락에 20이 잔존) | 잔존 문구를 30으로 통일 | 100% |
| G-9 | Minor (문서 stale) | 계획 문서 잔존 항목 | 계획 §2.1/Executive Summary가 `fetchClassifications`/`/classifications` 언급 | P-3 결정으로 미사용 | Report 단계에서 계획 문서 정리 | 100% |

설계에 없던 추가 방어 로직(모두 설계 의도 범위 내): `toTourList`의 contentId 중복 제거, `TourListView`의 범위 초과 응답 시 스켈레톤 유지(스트레일 데이터 방지, 리뷰에서 발견·수정).

---

## 4. Runtime Verification

### 4.1 L1 API (curl, local-mock 서버 직접 기동)

| # | 요청 | 상태 |
|---|------|:----:|
| 1 | `contentTypeId=12&page=1` | ✅ PASS (9건, 첫 항목 126508, total 23) |
| 2 | `contentTypeId=12&page=3` | ✅ PASS (5건) |
| 3 | `contentTypeId=12&lDongRegnCd=31` | ✅ PASS (빈 결과) |
| 4 | `contentTypeId=14&lclsSystm2=VE07` | ✅ PASS (BE-1 보정 확인) |
| 5 | `contentTypeId=12&page=0` | ✅ PASS (400) |
| 6 | `arrange=X` / `arrange=q` | ✅ PASS (400) |
| 7 | `arrange=O` | ✅ PASS (200) |
| 8 | `/regions`, `/regions/districts` | ✅ PASS |
| 10 | `/home` | ✅ PASS (기존 3건 회귀 없음) |
| 12 | 합성 항목 상세 제목 확인 | ⬜ 미실행 |
| 13 | `lclsSystm1=VE&lclsSystm2=VE07` 조합 | ⬜ 미실행 |
| 14 | `lDongSignguCd` 단독(지역 없음) | ⬜ 미실행 |

**L1 실행분**: 9/9 PASS.

백엔드 단위 테스트: `mvnw clean test` — **19/19 PASS**, BUILD SUCCESS.

### 4.2 L2 UI (브라우저 조작) — 미검증

이 환경에 브라우저 자동화 도구(claude-in-chrome 등)가 로드되어 있지 않아, 설계 §8.3 L2 체크리스트는 코드 추적으로만 판단했고 실제 클릭·키보드 조작은 수행하지 못했다. 우선순위가 높은 미검증 항목:

| 항목 | 관련 완료 조건 |
|------|----------------|
| 페이지 이동 후 스크롤·포커스 복원, 상세→뒤로가기 스크롤 위치 | SC-2 |
| Slow 3G에서 조건 3연속 변경 시 마지막 결과만 표시 | SC-7 |
| 모달 열기/Esc/오버레이 클릭 시 포커스 이동·복원 | - |
| 검색 모달 제출 시 문서 새로고침 없음(네트워크 탭) | SC-4 |
| 즐기기(`/enjoy`) 검색 모달 회귀(가장 중요) | 계획 §5(위험) |
| 360px 반응형, 페이지네이션 7버튼 | - |

### 4.3 L3 E2E — 미검증 (테스트 러너 없음, 설계 §8.1에서 이번 범위 제외로 명시)

---

## 5. 수정 금지 파일 확인 (설계 §10)

```
git diff --name-only e951693 8bd1991 -- frontend/src/pages/EnjoySearchResultsPage.jsx \
  "frontend/src/pages/EnjoyCategoryPage.*" "frontend/src/pages/TravelDetailPage.*" \
  "frontend/src/pages/EnjoyDetailPage.*" frontend/src/data/destinationMocks.js \
  frontend/src/pages/NotFoundPage.jsx frontend/src/pages/StatusPage.css \
  frontend/src/components/home/HeroSection.jsx
```

결과: **출력 없음** — 8개 파일 모두 변경되지 않았음을 직접 확인했다.

---

## 6. Overall Score

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 98.4%                   │
├─────────────────────────────────────────────┤
│  Structural:  100%                           │
│  Functional:   96%                           │
│  Contract:    100%                           │
│  Critical Gap: 0건                            │
│  Important Gap: 0건                           │
│  Minor Gap: 9건 (문서 drift 6, 코드 개선 2,   │
│              여유 범위 미구현 1)              │
└─────────────────────────────────────────────┘
```

---

## 7. 권장 조치

### 7.1 코드 수정 (선택, frontend-lead)

| 우선순위 | 항목 | 파일 |
|:---:|------|------|
| 🟢 | G-5: `handlePageChange`를 `useCallback`으로 | `DestinationSearchResultsPage.jsx` |
| 🟢 | G-6: 지역 카드 링크를 `URLSearchParams`로 | `DestinationsPage.jsx` |

두 항목 모두 신뢰도가 낮거나(G-5 70%) 실제 위험이 없는(G-6, 상수 코드만 사용) Nice-to-Have 수준이라 **Report 단계 진행을 막지 않는다.**

### 7.2 문서 갱신 (Report 단계 또는 이후, 코드 변경 없음)

- G-1: 설계 §5.1에 "검색 결과 invalid → [조건 변경]" 반영
- G-3, G-4, G-7, G-8: 설계 §4.2/§2.4/§2.6/§4.3의 코드와 어긋난 서술 갱신
- G-9: 계획 문서의 `/classifications` 잔존 언급 정리

### 7.3 후속 검증 (다음 세션, 브라우저 자동화 가능한 환경에서)

- L2 체크리스트 전체, 특히 즐기기 검색 회귀와 모달 포커스 관리
- L1 #12~#14 (합성 상세, 조합 파라미터, 지역 없이 시군구만 보낸 요청의 400)

---

## 8. Next Steps

- [x] Critical/Important gap 없음 확인
- [ ] (선택) G-5, G-6 코드 수정
- [ ] Completion Report 작성 (`destination-list-integration.report.md`)
- [ ] 후속: 브라우저 자동화 환경에서 L2 체크리스트 실행

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-28 | 최초 gap 분석. Match Rate 98.4%, Critical/Important 0건 | bkit gap-detector + WOOJIN |
