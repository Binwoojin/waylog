# app-safety-net 분석 보고서

> **분석 유형**: Gap Analysis (설계 대비 구현, 정적) + 코드 리뷰 통합 + 자동 브라우저 확인
>
> **프로젝트**: WayLog
> **분석자**: bkit gap-detector, frontend-code-reviewer (WOOJIN 요청)
> **작성일**: 2026-09-24 (1차 2026-09-23)
> **상태**: Check 2회차 (Act-1 반영)
> **기준 커밋**: `68e140b`
> **계획**: [app-safety-net.plan.md](../01-plan/features/app-safety-net.plan.md)
> **설계**: [app-safety-net.design.md](../02-design/features/app-safety-net.design.md) (설계안 C)

> 1차 Check(v0.1)에서 gap 분석과 코드 리뷰를 병렬로 실행했고, 리뷰 결과로 재판정했다. Act-1에서 MF-1, SI-1 ~ SI-3, G-03, NH-2를 수정한 뒤 gap-detector 2회차와 재리뷰를 다시 실행했다. 이 문서의 수치와 판정은 2회차 기준이다. 1차 값은 비교가 필요한 곳에만 남긴다.

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 흰 화면·크래시·반응 없는 링크·모바일 메뉴 부재로 사용자가 길을 잃고, 로그인 직후 결함이 바로 보인다 |
| **WHO** | 모든 WayLog 방문자 (특히 로그인 사용자, 모바일 사용자) |
| **RISK** | ErrorBoundary가 오류 후 복구되지 않음, 404 라우트가 기존 라우트를 가림, 드로어 접근성·스크롤 잠금 문제, 홈(Layout 밖)과 Layout 페이지의 헤더 동작 차이 |
| **SUCCESS** | 없는 경로·미구현 메뉴·잘못된 카테고리에서 헤더가 있는 안내 화면 / 렌더 오류 시 페이지 영역만 대체되고 이동하면 복구 / 반응 없는 링크 0개(Layout 안 페이지와 헤더·푸터·공지 기준, 설계 §12) / 760px 이하에서 모든 주요 메뉴 접근 |
| **SCOPE** | 공통 컴포넌트 → App 라우트 → EnjoyDetail·EnjoyCategory 방어 → Header·Footer·NoticeSection 링크 → 모바일 드로어 |

---

## 요약

| 항목 | 1차 (v0.1) | 2차 (v0.2) |
|------|------|------|
| 정적 Match Rate | 97.3% | **99.0%** (구조 100 / 기능 100 / 계약 97.6) |
| FR-01 ~ FR-09 | 완전 8, 부분 1 | **완전 9** |
| 코드 리뷰 판정 | 조건부 머지 (Must Fix 1) | **머지 가능** (Must Fix 0, Should 0, Nice 4) |
| Gap Critical / Important / Minor | 0 / 2 / 8 | 미해소 0 / 1(G-02) / 2(G-05, G-09). 문서 gap G-07·G-10과 신규 Minor N-1 ~ N-4는 이번 문서 갱신으로 처리 |
| 정적 검증 | lint 0, build 성공 | lint 0, build 성공 (JS 354.72 kB, gzip 103.48 kB, CSS 108.41 kB) |
| 런타임 | 구현 측 headless Chrome만 | **자동 L2** 통과 (헤드리스 Chrome, 백엔드 꺼짐). 로그인 항목·개발용 throw 항목 미확인. 사용자 L2 미수행 |

---

## 1. 점수

| 축 | 점검 | 1차 일치 | 2차 일치 | 2차 점수 |
|----|:---:|:---:|:---:|:---:|
| 구조 (파일·배치) | 18 | 18 | 18 | 100% |
| 기능 (Page UI Checklist, §5.1, §6, §7, §3.2, FR-07, §8.1) | 34 | 32.5 | 34 | 100% |
| 계약 (라우트 표, props, 메뉴 데이터 공유 규칙) | 21 | 20.5 | 20.5 | 97.6% |

```
Match Rate = 100×0.2 + 100×0.4 + 97.6×0.4 = 99.0%
```

- 기능 +1.5: §8.1은 §12에서 조정한 범위로 충족(G-01, +1), 프로토타입 키 카테고리 404(G-03, +0.5)
- 계약 감점 유지: MobileNav `activePage` prop이 설계 §2.3에 없음(D-8). 이번 설계 갱신으로 반영한다
- 설계 §12 항목까지 점검 대상에 넣으면 98.3%다(기능 39/39, 계약 22/23). 감점 1은 `SectionHeading` prop이 설계 `to`, 구현 `moreTo`+`moreLabel`인 부분 일치(N-2)

---

## 2. FR 판정

| ID | 판정 | 근거 | 비고 |
|----|:---:|------|------|
| FR-01 | ✅ | `Layout.jsx` Outlet만 감쌈, `ErrorBoundary.jsx` 본문 오류 화면·다시 시도·홈 Link | 헤더·푸터는 경계 밖 |
| FR-02 | ✅ | `Layout.jsx:27` `resetKey={location.key}` | 1차 G-08 해소. 쿼리만 바뀌는 이동과 같은 링크 재클릭도 초기화 |
| FR-03 | ✅ | `App.jsx` app 경계, `ErrorBoundary.jsx` reload와 `<a href="/">` | Header 오류도 app 경계가 받음 |
| FR-04 | ✅ | `App.jsx` Layout 안 `*`, `NotFoundPage.jsx` | 자동 L2 #1 |
| FR-05 | ✅ | `App.jsx`, `ComingSoonPage.jsx` 인증 상태 미참조 | 비로그인 자동 L2 #3-1. 로그인 진입(#3)은 미확인 |
| FR-06 | ✅ | `EnjoyCategoryPage.jsx:13`, `EnjoyDetailPage.jsx:19` `Object.hasOwn` | 1차 부분 → 충족(G-03). 자동 L2 #2-2 |
| FR-07 | ✅ | `Header.jsx`, `Footer.jsx`, `NoticeSection.jsx` | 헤더·푸터·공지 범위에서 대상 없는 링크 0 |
| FR-08 | ✅ | `Header.css:233-248`, `MobileNav.jsx` | 비로그인 자동 L2 #7. 로그인 상태 드로어는 L2 #9 미확인 |
| FR-09 | ✅ | `MobileNav.jsx:45-48` 스크롤 잠금, `:52-53,102` inert, `:56` 초기 포커스, `:58-84` Esc·트랩, `:153-155` `aria-expanded`·열린 동안만 `aria-controls`, `:105` 포커스 복귀 | 1차 SI-1·G-06 해소. 리사이즈·링크 이동 닫힘 시 포커스는 후속(G-05) |

---

## 3. 성공 기준 (계획 4장)

| 기준 | 1차 | 2차 | 근거 |
|------|:---:|:---:|------|
| FR-01 ~ FR-09 구현 | ⚠️ | ✅ | 2장 |
| build 성공, lint 0 | ✅ | ✅ | 메인 세션 `68e140b` 기준 재확인 |
| 리뷰 Must Fix 0건 | ❌ | ✅ | Act-1 재리뷰 머지 가능 (7장) |
| Match Rate 90% 이상 | ✅ | ✅ | 99.0% |
| 브라우저 확인 (항목별 기록) | ⚠️ | ⚠️ | 자동 L2 통과, 백엔드 항목 미확인 (8장). 사람이 직접 한 L2는 아직 없음 |
| 반응 없는 `href="#"` 0개 | ❌ / ✅ | ✅ (조정 범위) | 4장. 조정 범위(계획 4.2, 설계 §12) 안에서 0개. 제외 페이지 13개는 후속 |
| 기존 라우트 회귀 없음 | ⚠️ | ✅ (렌더 기준) | 자동 L2 #6: 14개 라우트 h1 렌더, 흰 화면·Uncaught 0. 백엔드가 꺼진 상태라 데이터 표시는 확인하지 않음 |

---

## 4. `href="#"` 판정

| 위치 | 앵커 수 | 1차 | 2차 | 화면 |
|------|:---:|------|------|------|
| `DestinationsPage.jsx` "더보기" | 4 | 반응 없음 | **해소**. `:74-78` `SectionHeading`의 `moreTo`·`moreLabel`, 호출 `:101,103,105,107` | `/destinations` |
| `ForgotPasswordPage.jsx` | 4 | 반응 없음 | 유지 (제외 페이지) | `/forgot-password` |
| `LoginPage.jsx` | 3 | 반응 없음 | 유지 (제외 페이지) | `/login` |
| `SignupPage.jsx` | 6 | 반응 없음 | 유지 (제외 페이지) | `/signup` |
| `TravelCourseDetailPage.jsx` `#course-route` | 1 | 정상 (페이지 내 앵커) | 정상 | 코스 상세 |

반응 없는 앵커는 17개에서 13개로 줄었다. 남은 13개는 모두 계획 2.2에서 제외한 로그인·회원가입·비밀번호 찾기 페이지에 있다. 조정한 성공 기준(Layout 안 페이지와 헤더·푸터·공지)은 충족한다.

grep에 안 잡히는 잠재 코드 `TravelEnjoyPage.jsx:74` 기본값 `href = '#more'`는 그대로 있다. 현재 이 기본값으로 렌더되는 곳은 없다(G-09, 후속).

더보기 4개의 목적지는 주제별 → `/destinations/attractions`, 문화 → `/destinations/culture`, 코스 → `/destinations/courses`, "여행지 더보기" → `/destinations/attractions`다. 마지막 섹션에는 문화시설도 섞여 있어 목적지와 의미가 완전히 같지 않다. `/destinations/search`를 조건 없이 열면 "선택한 조건으로" 배너가 오해를 주므로 관광지 목록을 골랐다(설계 §12, D-17).

---

## 5. 설계와 다른 구현

모두 설계 문서 v0.3에 반영했다.

| # | 항목 | 구현 | 설계 반영 위치 |
|---|------|------|------|
| D-1 | 760px 이하 로그인·회원가입·회원 메뉴는 드로어로, 헤더엔 햄버거만 | `Header.css:233-248`. 320px 폭 제약 | §5.1 |
| D-2 | 드로어 `createPortal(document.body)`, 최상위 선택자, z-index 1100 | `MobileNav.jsx:169`, `Header.css:180`. `.site-header`의 transform·backdrop-filter | §2.1, §5.1 |
| D-3 | 푸터 스타일을 `HomeSections.css`에 | `HomeSections.css:153-154`. 기존 푸터 스타일 위치 | §9, §11.1 |
| D-4 | `/feed` activePage | `Layout.jsx:9` | §3.1 |
| D-5 | 현재 메뉴 `aria-current="page"` | `Header.jsx:85`, `MobileNav.jsx:185` | §5.1 |
| D-6 | 데스크톱 회원 드롭다운 항목 클릭 시 닫힘 | `Header.jsx:104` | §5.1 |
| D-7 | EnjoyDetail은 `enjoyConfigs`·`categoryFacts` 모두 판별 | `EnjoyDetailPage.jsx:19` | §6 |
| D-8 | MobileNav `activePage` prop | `MobileNav.jsx:21` | §2.3 |
| D-9 | 열리면 첫 항목 포커스, Tab 트랩, `role="dialog"`·`aria-modal`·`aria-label="전체 메뉴"` | `MobileNav.jsx:56,58-84,172` | §5.1, §5.3 |
| D-10 | 761px 이상(matchMedia change)이면 닫힘 + CSS 숨김 | `MobileNav.jsx:7,87`, `Header.css:218` | §5.1, §5.3 |
| D-11 | 드로어 제목 "메뉴", 닫기 버튼 `aria-label="메뉴 닫기"` | `MobileNav.jsx:174-175` | §5.1 |
| D-12 | 성공 기준 범위: Layout 안 페이지 + 헤더·푸터·공지. 제외 페이지 13개는 후속 | 4장 | §8.1, Context Anchor SUCCESS |
| D-13 | 기존 라우트 14개 | `App.jsx` 선언 14개, 자동 L2 #6 | §8.2 #6, 계획 3.2 |
| D-14 | 드로어 열림 동안 `#root` inert. cleanup 한 곳에서 해제(닫힘·라우트 이동·언마운트 공통), 해제 후 햄버거 포커스 복귀. `!drawer.contains(activeElement)` 분기는 방향에 따라 처음/끝. Header는 라우트당 하나라는 전제 | `MobileNav.jsx:52-53,71-77,100-105` | §5.1, §5.3, §12 |
| D-15 | page ErrorBoundary `resetKey={location.key}` | `Layout.jsx:27` | §2.1, §6 |
| D-16 | URL 파라미터를 설정 키로 쓸 때 `Object.hasOwn` | `EnjoyCategoryPage.jsx:13`, `EnjoyDetailPage.jsx:19` | §6 |
| D-17 | `SectionHeading` `moreTo`/`moreLabel`. `moreLabel`은 `aria-label`(Label in Name), `moreTo` 없으면 링크 없음 | `DestinationsPage.jsx:74-78` | §12 |
| D-18 | 푸터 준비 중 텍스트·배지 불투명도 .6, 대비 5.52:1 | `HomeSections.css:153-154` | §3.2, §12 |
| D-19 | 닫힌 상태에서 `aria-controls` 생략 | `MobileNav.jsx:155` | §5.1 |

---

## 6. Gap 목록 (gap-detector)

### Critical

없음 (1차·2차).

### 1차 gap의 Act-1 후 상태

| ID | 1차 등급 | 내용 | Act-1 후 상태 |
|----|------|------|------|
| G-01 | Important | `href="#"` 0건 미충족(문구 기준) | **해소**. 조정 범위에서 0개, "더보기" 4개 연결 |
| G-02 | Important | 로그인 상태 드로어, 로그아웃 실패 알림(R-4), 복원 중 빈 자리(R-3) 런타임 미검증 | **미해소**. 백엔드 필요 (L2 #3, #9 ~ #9-3) |
| G-03 | Minor | 프로토타입 키 카테고리 → page 오류 화면 | **해소**. `Object.hasOwn`, 자동 L2 #2-2 |
| G-04 | Minor | 푸터 "준비 중" 대비 AA 미달 | **해소**. `HomeSections.css:153-154` .6, `#14345f` 대비 5.52:1 |
| G-05 | Minor | 리사이즈·링크 이동으로 닫힐 때 포커스 | **미해소 (후속)**. 자동 L2 #8-3에서 포커스가 BODY |
| G-06 | Minor | 닫힌 상태 `aria-controls` | **해소**. `MobileNav.jsx:155` |
| G-07 | Minor | 설계 미반영 구현 결정 | **이번 문서 갱신으로 처리** (D-1 ~ D-19 → 설계 v0.3) |
| G-08 | Minor | resetKey가 pathname뿐 | **해소**. `Layout.jsx:27` `location.key` |
| G-09 | Minor | `TravelEnjoyPage.jsx:74` `#more` 기본값 잠재 코드 | **미해소 (후속)** |
| G-10 | Minor | 문서의 기존 라우트 12개 ↔ 실제 14개 | **이번 문서 갱신으로 처리** (계획 3.2, 설계 §8.2) |

### 2차 신규 Minor (모두 설계 문서 불일치, 이번 갱신으로 처리)

| ID | 내용 | 처리 |
|----|------|------|
| N-1 | 설계 본문 §2.1 구성도 `resetKey={pathname}`, §6 "pathname 변경 시", §8.1 "grep 0건", Context Anchor SUCCESS 범위 미표기가 §12와 불일치 | 본문을 §12 기준으로 고침 |
| N-2 | §12 MF-1은 `to`라 했지만 구현은 `moreTo`+`moreLabel` | §12 설계 문구를 구현 이름으로 고침 |
| N-3 | §12 SI-1 "첫 항목으로"와 달리 구현은 Tab → 처음, Shift+Tab → 마지막. inert 해제 후 포커스 복귀 순서 제약 미기재 | §12, §5.1에 반영 |
| N-4 | §12 후속 목록 "NH-1 ~ NH-8"에 이미 구현된 NH-2 포함 | "NH-1, NH-3 ~ NH-8"로 정정 |

### 범위 밖 관찰 (후속 후보)

- 핸들러 없는 버튼: `EnjoyDetailPage.jsx:40-41` 전화 문의·정보 오류 제보·길찾기, `TravelEnjoyPage.jsx:117` 축제 필터. 링크가 아니라 FR-07 범위 밖이지만 누르면 반응이 없다.

---

## 7. 코드 리뷰 결과 (frontend-code-reviewer, frontend-audit)

### 7.1 1차 리뷰와 Act-1 조치

1차 판정: **조건부 머지**. 정적 검증 lint 0, `vite build` 성공(JS 354.04 kB, gzip 103.21 kB).

| ID | 등급 | 내용 | 근거(1차) | gap 대응 | Act-1 조치 |
|----|------|------|------|----------|------|
| MF-1 | **Must Fix** | `/destinations` "더보기" 4개가 반응 없음 | `DestinationsPage.jsx:75,90-96` | G-01 | **수정**. `moreTo`·`moreLabel` (`:74-78`, `:101,103,105,107`) |
| SI-1 | Should (머지 조건) | 드로어 포커스 트랩 누수, 가려진 페이지를 스크린리더가 읽음 | `MobileNav.jsx:59-72` | 신규 | **수정**. `#root` inert + 밖 포커스 분기(방향별 처음/끝) |
| SI-2 | Should | resetKey를 `location.key`로 | `Layout.jsx:25` | G-08 | **수정**. `Layout.jsx:27` |
| SI-3 | Should | 푸터 "준비 중" 대비 약 3.9:1 | `HomeSections.css:152` | G-04 | **수정**. .6, 5.52:1 |
| NH-1 | Nice | 창 확대로 닫힐 때 숨은 햄버거에 focus 실패, 링크 이동 닫힘은 복귀하지 않는 편이 자연스러움 | `MobileNav.jsx:91` | G-05 | 후속 |
| NH-2 | Nice | `aria-controls={isOpen ? drawerId : undefined}` | `MobileNav.jsx:140` | G-06 | **수정**. `:155` |
| NH-3 | Nice | app 경계는 새로고침만으로 복구 → 한계로 기록 | `ErrorBoundary.jsx:55-69` | 신규 | 후속 (한계 기록) |
| NH-4 | Nice | 개발 콘솔 오류 2번 출력 | `ErrorBoundary.jsx:43-46` | 신규 | 후속 |
| NH-5 | Nice | common 컴포넌트가 `pages/StatusPage.css` import | `ErrorBoundary.jsx:3` | 신규 | 후속 |
| NH-6 | Nice | 공지 항목 제목도 "공지사항 준비 중"으로 이동 | `NoticeSection.jsx:24` | 신규 | 후속 |
| NH-7 | Nice | `enjoyConfigs`·`categoryFacts` 이중 기준 | `EnjoyDetailPage.jsx:22` | D-7 | 후속 |
| NH-8 | Nice | 404·준비 중 화면에서 `document.title` 미변경 | | 신규 | 후속 |

G-03(프로토타입 키)도 Act-1에서 함께 수정했다(`Object.hasOwn`).

### 7.2 Act-1 재리뷰

**판정: 머지 가능.** Must Fix 0, Should 0, Nice 4. lint 0, build 성공. 이전 MF-1, SI-1, SI-2, SI-3, G-03, NH-2 해소 확인.

| # | 등급 | 내용 | 관련 |
|---|------|------|------|
| 1 | Nice | `SectionHeading`의 이름 관련 API 중복: 보이는 문구 "더보기"와 `moreLabel`을 따로 받음 | N-2 |
| 2 | Nice | "여행지 더보기" 목적지(`/destinations/attractions`)와 섹션 내용(문화시설 포함)의 의미 차이 | D-17 |
| 3 | Nice | inert가 Header 단일 인스턴스를 전제한다는 주석 필요 | D-14 |
| 4 | Nice | 리사이즈로 닫힐 때 포커스 | G-05 |

**범위 밖 관찰(1차)**: `EnjoyCategoryPage`는 탭을 바꿔도 지역·페이지·저장 상태가 유지되어 "총 0건" 빈 그리드가 나오고 빈 상태 안내가 없다. 기존 동작이다. 다음 묶음에서 `<EnjoyCategoryContent key={category} />`로 수정 후보.

**Keep(1차)**: ErrorBoundary 복구 로직(같은 경로 재오류·다시 시도·경로 변경 시 렌더 전 초기화, Outlet에 key를 주지 않은 이유), app/page 경계 역할 분리(app은 `<a href>`·reload, page는 Link), `*` 라우트가 기존 라우트를 가리지 않음, Enjoy 분리 후에도 컴포넌트 정체성 유지, auth-token-flow R-3·R-4 회귀 없음(데스크톱·모바일이 같은 상태 공유), D-1·D-2 결정, 드로어 기본 접근성, `navigation.js` 공유 범위, 404/준비 중/오류 화면 구분과 스타일 공유, NotFoundPage의 MF-4 재사용 설계.

---

## 8. L2 브라우저 확인 체크리스트

"자동 L2" 열은 **사람이 직접 확인한 결과가 아니다.** 메인 세션이 헤드리스 Chrome 153을 CDP로 조작해 측정한 결과다(2026-09-24, `68e140b`, 백엔드 꺼짐). 사용자 L2는 이 열과 별도로 번호별 ✅/❌와 메모를 받는다.

| # | 동작 | 기대 결과 | 자동 L2 |
|---|------|-----------|------|
| 1 | `/abc` → "홈으로", "여행지 보기", "여행 즐기기" | 헤더·푸터 있는 404, 각 링크 이동 | ✅ 404, 링크 3개 클릭 이동 |
| 2 | `/enjoy/abc`, `/enjoy/abc/x` | 404, 흰 화면·Uncaught 없음 | ✅ 404, Uncaught 0 |
| 2-1 | `/enjoy/search/x`, `/destinations/detail` (id 없음) | 404 | ✅ |
| 2-2 | `/enjoy/constructor`, `/enjoy/__proto__/x`, `/enjoy/toString` | 404 (오류 화면 아님) | ✅ 404, 오류 화면 없음 |
| 3 | 로그인 → 데스크톱 회원 메뉴 "북마크", "마이 페이지" | 각 "준비 중" 화면, 드롭다운 닫힘 | 미확인 (백엔드 필요) |
| 3-1 | 로그아웃 상태에서 `/bookmarks`, `/mypage` 직접 입력 | 3과 같은 화면 | ✅ 준비 중 화면 |
| 4 | 헤더 "여행 피드"(홈·Layout), 푸터 "여행 피드"·"공지사항", 홈 공지 "전체 보기"와 항목 3개 | 각 "준비 중" 화면, `/feed`에서 헤더 활성 표시 | ✅ `/feed`, `/notices` 준비 중, `/feed`에서 `aria-current` |
| 5 | 푸터 FAQ·문의·약관·개인정보·위치기반 (홈·Layout) | 클릭·Tab 대상 아님, "준비 중" 배지, 대비 4.5:1 이상 | ✅ 5개 모두 `span`, Tab 대상 아님, 배지, 대비 5.52:1 |
| 5-1 | 푸터 "여행지", "여행 코스" | 해당 페이지로 이동 | ✅ `/destinations`, `/destinations/courses` |
| 6 | 기존 라우트 14개 (`/`, `/login`, `/signup`, `/forgot-password`, `/enjoy`, `/enjoy/search`, `/enjoy/festivals`, `/enjoy/festivals/busan-sea`, `/destinations`, `/destinations/search`, `/destinations/detail/{id}`, `/destinations/attractions`, `/destinations/culture`, `/destinations/courses`) | 이전과 같음. PageHero(`f9fa909`, `68e140b`) 검색 모달 포함 | ✅ 14개 h1 렌더, 흰 화면 없음. 콘솔 오류는 백엔드 fetch 실패(`/api/v1/auth/refresh` 502, `/api/v1/home` 502와 `App.jsx`의 의도된 `console.error`)뿐, Uncaught 0. 데이터 표시와 검색 모달 동작은 따로 측정하지 않음 |
| 7 | 375px → 햄버거 → 여행지·여행 즐기기·여행 피드 | 햄버거 44×44, 드로어 열림, 이동 후 닫힘, 현재 메뉴 `aria-current` | ✅ |
| 7-1 | 320px | 로고와 햄버거 한 줄, 가로 스크롤 없음, 로그인·회원가입은 드로어에 | ✅ 한 줄, scrollWidth 320 |
| 7-2 | 햄버거의 `aria-controls` (신규) | 닫힘: 없음, 열림: 드로어 id | 따로 기록 안 함 |
| 8 | 드로어 Esc, 배경 클릭, × | 각각 닫힘, 햄버거로 포커스 복귀, 스크롤 잠금 해제, `#root` inert 해제 | ✅ 세 경로 모두 |
| 8-1 | 드로어 안에서 Tab, Shift+Tab 반복 (패널 빈 곳 클릭 후 포함) | 드로어 안에서만 순환. 밖에 있던 포커스는 Tab → 처음, Shift+Tab → 마지막 | ✅ 열린 동안 `#root[inert]`, 빈 곳 클릭 후 Tab 20회·Shift+Tab 20회 이탈 0/0 |
| 8-2 | 드로어 연 채 브라우저 뒤로 가기 | 닫힘, 스크롤 잠금·inert 해제 | ✅ `history.back()` |
| 8-3 | 드로어 연 채 창을 761px 이상으로 | 닫힘, 스크롤 잠금·inert 해제. 포커스는 BODY (알려진 한계, G-05) | ✅ 800px·761px 닫힘·해제, 포커스 BODY |
| 8-4 | 드로어 열림 중 inert 존재, 6가지 닫힘 경로(Esc, 배경, ×, 링크 이동, 뒤로 가기, 리사이즈) 뒤 해제 (신규) | 열림 중 `#root[inert]`, 모든 경로에서 해제 | ✅ #7, #8, #8-1 ~ #8-3 결과의 합 |
| 9 | 모바일 폭 로그인 → 드로어 | 닉네임, 북마크, 마이 페이지, 로그아웃 | 미확인 (백엔드 필요) |
| 9-1 | 드로어에서 로그아웃 | 드로어 닫힘, 비로그인 전환 | 미확인 (백엔드 필요) |
| 9-2 | 로그인 후 Offline 상태로 드로어에서 로그아웃 | 헤더에 로그아웃 실패 알림과 "다시 시도" | 미확인 (백엔드 필요) |
| 9-3 | 로그인 상태로 새 탭에서 Layout 페이지 → 곧바로 드로어 | 복원 중 로그인 영역 빈 자리, 깜빡임 없음 | 미확인 (백엔드 필요) |
| 10 | 홈 최상단, 홈 스크롤 후, 여행지 페이지의 햄버거 | 세 경우 모두 아이콘이 보임 | ✅ 세 경우 44×44, opacity 1 |
| 11 (개발) | 임시 throw → 다시 시도 → 다른 메뉴 → 같은 메뉴 재클릭 → 쿼리만 바뀌는 이동 → 원복 | page 오류 화면, 다른 메뉴·같은 메뉴 재클릭·쿼리 이동 모두 복구 | 미확인 (코드 임시 수정 필요) |
| 11-1 (개발) | Header·HomePage 임시 throw → 원복 | 전체 오류 화면, 새로고침·홈 동작, 메시지·스택 미노출 | 미확인 (코드 임시 수정 필요) |
| 12 | `/destinations` "더보기" 4개 | 주제별 → `/destinations/attractions`, 문화 → `/destinations/culture`, 코스 → `/destinations/courses`, 여행지 → `/destinations/attractions`. 접근 가능한 이름 4개가 서로 다름 | ✅ href 4개, `aria-label` 4개 구분 |

- #7-2는 자동 L2 기록에 별도 항목이 없다. 코드 근거는 `MobileNav.jsx:155`.
- #8-4는 따로 측정한 항목이 아니라 #7(링크 이동)·#8·#8-2·#8-3 결과를 묶은 것이다.

### 8.1 자동 L2 중 발견한 범위 밖 문제 (기존 문제, 회귀 아님)

| 위치 | 증상 | 원인 추정 |
|------|------|------|
| `/enjoy` 761 ~ 약 800px | 콜라주가 오른쪽 밖으로 최대 18px | `TravelEnjoyPage.css:82` 태블릿 grid `420px 1fr` + 고정 폭 사진 + `scale(.82)` `right center` |
| `/enjoy` 1101 ~ 약 1266px | 그리드 최소폭 1218px 초과로 최대 154px 잘림 | `TravelEnjoyPage.css:10` |

두 값은 `98922ee`의 `.enjoy-hero__inner`와 같아 이번 기능 이전부터 있던 문제다. 후속 과제로 둔다.

---

## 9. 다음 단계

- [x] 수정 범위 결정 (Checkpoint 5)
- [x] frontend-lead 수정 → 재리뷰·재분석 (머지 가능, 99.0%)
- [x] 설계 문서 갱신 (D-1 ~ D-19, N-1 ~ N-4) → 설계 v0.3
- [x] 자동 L2 (백엔드 꺼짐)
- [ ] 완료 보고서
- [ ] 사용자 L2: 로그인 항목(#3, #9 ~ #9-3)은 백엔드 준비 후, 개발 항목(#11, #11-1)은 임시 throw로

### 후속 과제

| 항목 | 근거 |
|------|------|
| 제외 페이지(로그인·회원가입·비밀번호 찾기)의 반응 없는 `href="#"` 13개 | 4장 |
| `TravelEnjoyPage.jsx:74` `#more` 기본값 | G-09 |
| 리사이즈·링크 이동으로 닫힐 때 포커스 | G-05, NH-1 |
| NH-3 ~ NH-8 | 7.1 |
| 재리뷰 Nice: `SectionHeading` 이름 API 중복, 여행지 더보기 의미 차이, inert 단일 인스턴스 전제 주석 | 7.2 |
| 핸들러 없는 버튼 (`EnjoyDetailPage.jsx:40-41`, `TravelEnjoyPage.jsx:117`) | 6장 범위 밖 관찰 |
| `/enjoy` 761 ~ 약 800px, 1101 ~ 약 1266px 콜라주 잘림 | 8.1 |
| `EnjoyCategoryPage` 탭 전환 시 상태 유지 | 7.2 범위 밖 관찰 |

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성 |
|------|------|------|------|
| 0.1 | 2026-09-23 | 정적 gap 분석 (97.3%) + 코드 리뷰 통합 (조건부 머지) | bkit gap-detector, frontend-code-reviewer, WOOJIN (Claude Code 보조) |
| 0.2 | 2026-09-24 | Check 2회차 (99.0%), Act-1 재리뷰 (머지 가능), 자동 L2 결과, D-14 ~ D-19, N-1 ~ N-4, 후속 과제 정리 | bkit gap-detector, frontend-code-reviewer, WOOJIN (Claude Code 보조) |
