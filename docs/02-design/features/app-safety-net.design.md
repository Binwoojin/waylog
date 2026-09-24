# app-safety-net 설계 문서

> **요약**: 설계안 C(실용 균형). 직접 구현한 ErrorBoundary를 페이지 영역과 최상위 두 곳에 두고, 공통 스타일을 공유하는 NotFound·ComingSoon 페이지로 흰 화면을 없앤다. 헤더와 모바일 드로어는 `data/navigation.js` 메뉴 데이터를 공유한다.
>
> **프로젝트**: WayLog
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-23 (v0.3 갱신 2026-09-24)
> **상태**: Complete
> **계획 문서**: `docs/01-plan/features/app-safety-net.plan.md`

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 흰 화면·크래시·반응 없는 링크·모바일 메뉴 부재로 사용자가 길을 잃고, 로그인 직후 결함이 바로 보인다 |
| **WHO** | 모든 WayLog 방문자 (특히 로그인 사용자, 모바일 사용자) |
| **RISK** | ErrorBoundary가 오류 후 복구되지 않음, 404 라우트가 기존 라우트를 가림, 드로어 접근성·스크롤 잠금 문제, 홈(Layout 밖)과 Layout 페이지의 헤더 동작 차이 |
| **SUCCESS** | 없는 경로·미구현 메뉴·잘못된 카테고리에서 헤더가 있는 안내 화면 / 렌더 오류 시 페이지 영역만 대체되고 이동하면 복구 / 반응 없는 링크 0개(Layout 안 페이지와 헤더·푸터·공지 기준. 로그인·회원가입·비밀번호 찾기의 13개는 후속, §8.1) / 760px 이하에서 모든 주요 메뉴 접근 |
| **SCOPE** | 공통 컴포넌트 → App 라우트 → EnjoyDetail·EnjoyCategory 방어 → Header·Footer·NoticeSection 링크 → 모바일 드로어 |

---

## 1. 개요

### 1.1 설계 목표

- 어떤 URL과 렌더 오류에서도 사용자가 헤더를 통해 이동할 수 있게 한다.
- "없음"(404), "아직 없음"(준비 중), "오류"(ErrorBoundary)를 서로 다른 화면으로 구분해 사용자에게 정확히 알린다.
- 이후 MF-4(상세 페이지 not-found)와 신규 기능이 재사용할 수 있는 공통 화면을 만든다.

### 1.2 설계 원칙

- **새 의존성 없음**: ErrorBoundary는 React class 컴포넌트로 직접 구현한다.
- **중복 제거는 필요한 곳만**: 데스크톱 헤더와 모바일 드로어는 같은 메뉴를 보여 줘야 하므로 데이터를 공유한다. 푸터는 구성이 달라 공유하지 않는다.
- **기존 동작 유지**: auth-token-flow의 헤더 동작(복원 중 placeholder, 로그아웃 실패 알림)을 드로어에서도 그대로 쓴다.

---

## 2. 설계안

### 2.0 설계안 비교

| 기준 | A. 최소 변경 | B. 클린 아키텍처 | C. 실용 균형 |
|------|:---:|:---:|:---:|
| 신규 파일 | 1 | 약 8 | 약 5 |
| 수정 파일 | 약 8 | 약 9 | 약 8 |
| 메뉴 중복 | 3곳 하드코딩 | 전부 통합 | 헤더·드로어만 통합 |
| 복잡도 | 낮음 | 높음 | 중간 |
| 위험 | 중간 (Header 비대) | 중간 (과설계) | 낮음 |

**선택: C. 실용 균형** (사용자 선택, 2026-09-23)

### 2.1 구성도

```
App
└─ AuthProvider
   └─ BrowserRouter
      └─ ErrorBoundary variant="app"          ← 최상위: 홈·로그인·헤더 자체 오류
         └─ Routes
            ├─ /            HomePage (HeroSection → Header)
            ├─ /login, /signup, /forgot-password
            └─ Layout (Header forceLight, Footer)
               └─ ErrorBoundary variant="page" resetKey={location.key}   ← 페이지 영역
                  └─ Outlet
                     ├─ 기존 /enjoy*, /destinations* 라우트
                     ├─ /feed, /bookmarks, /mypage, /notices → ComingSoonPage
                     └─ *  → NotFoundPage

Header ── data/navigation.js ── MobileNav (≤760px 드로어)
                                    └─ createPortal → document.body (#root와 형제)
```

- page 경계의 `resetKey`는 `location.key`다. pathname과 달리 쿼리만 바뀌는 이동과 같은 링크 재클릭에도 값이 바뀌어 오류 상태가 초기화된다. 오류가 없을 때는 아무 일도 하지 않으므로 페이지 상태에는 영향이 없다.
- 드로어는 `document.body`로 포털한다. `.site-header`에 `transform`·`backdrop-filter`가 있어 그 안의 `position: fixed`가 뷰포트가 아니라 헤더 기준으로 잡히기 때문이다. 스타일은 헤더 하위가 아닌 최상위 선택자(`.mobile-nav`)로 쓰고 z-index는 1100이다.

### 2.2 오류·404·준비 중 흐름

```
없는 경로            → Layout 안의 * 라우트 → NotFoundPage (헤더·푸터 유지)
없는 enjoy 카테고리  → EnjoyCategoryPage / EnjoyDetailPage가 NotFoundPage 반환
미구현 기능 메뉴     → ComingSoonPage (기능명 표시)
Layout 페이지 렌더 오류 → page ErrorBoundary → 본문만 오류 화면, 다른 경로로 이동하면 자동 초기화
그 밖의 렌더 오류     → app ErrorBoundary → 전체 오류 화면 (새로고침·홈 링크)
```

ErrorBoundary는 **렌더링 중 오류**만 잡는다. 이벤트 핸들러와 비동기 오류는 대상이 아니다(React 제약). 이 한계는 코드 주석과 보고서에 명시한다.

### 2.3 의존성

| 컴포넌트 | 의존 대상 |
|----------|-----------|
| App | ErrorBoundary, ComingSoonPage, NotFoundPage |
| Layout | ErrorBoundary, `useLocation` |
| EnjoyCategoryPage, EnjoyDetailPage | NotFoundPage, `enjoyConfigs` |
| Header | `data/navigation.js`, MobileNav, `useAuth` |
| MobileNav | `data/navigation.js` (props로 member·isRestoring·activePage·onLogout 전달받음) |

MobileNav는 `useAuth`를 직접 쓰지 않고 Header에서 props로 받는다. 로그아웃 실패 알림(R-4) 상태를 Header 한 곳에서만 관리하기 위해서다. `activePage`도 Header가 받은 값을 그대로 넘겨 데스크톱과 드로어의 현재 메뉴 표시를 맞춘다.

---

## 3. 데이터

### 3.1 `src/data/navigation.js` (신규)

```js
// 데스크톱 헤더와 모바일 드로어가 공유하는 메뉴
export const mainNavItems = [
  { key: 'destinations', label: '여행지', to: '/destinations' },
  { key: 'enjoy', label: '여행 즐기기', to: '/enjoy' },
  { key: 'feed', label: '여행 피드', to: '/feed' },
]

export const memberMenuItems = [
  { label: '북마크', to: '/bookmarks' },
  { label: '마이 페이지', to: '/mypage' },
]
```

`activePage` 판별은 기존 Layout의 `resolveActivePage`를 유지하고, `key`와 비교한다. `/feed`로 시작하는 경로는 `'feed'`를 돌려주도록 추가한다.

### 3.2 "준비 중" 대상

| 경로 | 화면 제목 | 진입점 |
|------|-----------|--------|
| `/feed` | 여행 피드 | 헤더·드로어 메뉴, 푸터 |
| `/bookmarks` | 북마크 | 회원 메뉴 |
| `/mypage` | 마이 페이지 | 회원 메뉴 |
| `/notices` | 공지사항 | 푸터, 홈 공지 섹션 "전체 보기"·각 항목 |

푸터의 자주 묻는 질문·문의하기·이용약관·개인정보처리방침·위치기반서비스는 **링크가 아닌 텍스트**로 바꾸고 옆에 "준비 중" 배지를 붙인다(`aria-disabled`가 아닌 일반 텍스트로, 포커스 대상에서 제외).

텍스트와 배지 글자는 흰색 불투명도 .6으로, 배경 `#14345f` 대비 5.52:1(WCAG AA 4.5:1 이상)이다. 링크(.68)보다 흐리게 두되 "준비 중" 구분은 색이 아니라 배지로 한다. 스타일은 기존 푸터 스타일이 있는 `components/home/HomeSections.css`에 둔다.

---

## 4. API

변경 없음. 백엔드 작업 없음.

---

## 5. UI/UX

### 5.1 화면

**NotFoundPage** (Layout 안, 본문만)
- 제목 "페이지를 찾을 수 없습니다", 설명 한 줄
- 버튼: 홈으로, 여행지 보기, 여행 즐기기 (Link)
- props: `title`, `description`(선택). MF-4에서 "콘텐츠를 찾을 수 없습니다"로 재사용

**ComingSoonPage** (Layout 안, 본문만)
- props: `title`(기능명)
- 문구 "{title} 기능을 준비하고 있습니다", 홈으로 버튼
- 로그인 여부와 무관하게 같은 화면

**ErrorBoundary 오류 화면**
- `variant="page"`: 본문 영역에 "화면을 표시하는 중 문제가 발생했습니다", 다시 시도(오류 상태 초기화), 홈으로(Link)
- `variant="app"`: 전체 화면. 라우터 상태를 신뢰할 수 없으므로 `<a href="/">`(전체 새로고침)와 새로고침 버튼 사용
- 오류는 `componentDidCatch`에서 `console.error`로 남긴다

**공통 스타일**: 세 화면이 `src/pages/StatusPage.css` 하나를 공유한다(가운데 정렬 카드, 기존 브랜드 색상·버튼 스타일 재사용).

**Header 공통**
- 현재 메뉴에는 `aria-current="page"`를 붙인다(데스크톱 헤더, 드로어 모두)
- 데스크톱 회원 드롭다운은 항목(북마크·마이 페이지)을 누르면 닫는다

**MobileNav** (≤760px)
- 760px 이하에서는 헤더에 로고와 햄버거 버튼만 둔다. 로그인·회원가입·회원 메뉴는 드로어로 옮긴다(320px 폭에서 로고 + 버튼 두 개 + 햄버거가 한 줄에 들어가지 않음). 로그아웃 실패 알림은 헤더에 그대로 표시
- 761px 이상에서는 CSS로 버튼·드로어를 숨기고, 열린 채로 761px 이상이 되면(`matchMedia` change) 드로어를 닫는다
- 드로어는 `document.body`로 포털(§2.1), `role="dialog"`, `aria-modal="true"`, `aria-label="전체 메뉴"`
- 드로어 머리에 제목 "메뉴"와 닫기 버튼(×, `aria-label="메뉴 닫기"`)
- 햄버거 버튼: `aria-expanded`, `aria-controls`는 열린 동안에만 둔다(닫힌 상태에서는 가리킬 요소가 DOM에 없음)
- 드로어 내용: 메인 메뉴(`mainNavItems`) → 구분선 → 로그인 영역
  - 비로그인: 로그인, 회원가입
  - 로그인: 닉네임, `memberMenuItems`, 로그아웃
  - 복원 중이고 member가 없으면 로그인 영역을 비워 둔다(R-3과 같은 규칙)
- 로그아웃은 Header의 `requestLogout`을 호출해 R-4 실패 알림을 그대로 사용
- 홈(투명 헤더)과 Layout(흰 헤더)에서 버튼 아이콘이 보이도록 두 모드 색상 처리

**MobileNav 포커스·배경 처리**
- 열리면 드로어의 첫 항목으로 포커스를 옮긴다
- 열린 동안 `#root`(헤더·본문·푸터)에 `inert`를 적용한다. 드로어는 body 포털이라 `#root`와 형제이므로 드로어 자신은 영향을 받지 않는다. 가려진 페이지를 스크린리더가 읽거나 포커스가 빠져나가는 것을 막는 1차 방어다
- 수동 Tab 트랩을 함께 둔다. 처음/끝에서 순환하고, 포커스가 드로어 밖에 있으면(`!drawer.contains(activeElement)`, 예: 패널 빈 곳 클릭 뒤) Tab은 처음, Shift+Tab은 마지막 항목으로 보낸다
- 스크롤 잠금·inert 해제·포커스 복귀는 effect cleanup 한 곳에서 한다. 닫힘(Esc·배경·×), 라우트 이동(링크·뒤로 가기), 리사이즈, 언마운트가 모두 이 cleanup을 거치므로 해제가 빠지지 않는다
- 순서 제약: 햄버거 버튼도 `#root` 안에 있어 inert 상태에서는 포커스를 받지 못한다. **inert를 해제한 뒤** 햄버거로 포커스를 돌린다
- 전제: Header(따라서 MobileNav)는 라우트당 하나만 렌더된다. 인스턴스가 둘이면 한쪽 cleanup이 다른 쪽이 건 inert를 풀 수 있다
- 한계: 리사이즈로 닫힐 때 햄버거가 CSS로 숨겨져 포커스가 BODY에 남는다. 링크 이동으로 닫힐 때도 햄버거로 돌아가는데, 새 페이지에서는 복귀하지 않는 편이 자연스럽다. 둘 다 후속(§12)

### 5.2 사용자 흐름

```
로그인 → 회원 메뉴 "북마크" → 헤더 있는 "북마크 기능을 준비하고 있습니다" → 홈으로
주소창 /abc → 헤더 있는 404 → 여행지 보기
/enjoy/abc/x → 404 (크래시 없음)
모바일 → 햄버거 → 여행 즐기기 → 드로어 닫힘 + 이동
```

### 5.3 Page UI Checklist

#### NotFoundPage
- [ ] 헤더·푸터가 보임
- [ ] 홈·여행지·여행 즐기기 링크 동작

#### ComingSoonPage
- [ ] `/feed`, `/bookmarks`, `/mypage`, `/notices` 각각 올바른 기능명
- [ ] 로그인·비로그인 모두 흰 화면 없음

#### ErrorBoundary
- [ ] page: 헤더·푸터 유지, 다른 경로로 이동하면 정상 화면
- [ ] page: 다시 시도 버튼이 상태를 초기화
- [ ] app: 전체 오류 화면, 홈 링크로 복구

#### MobileNav
- [ ] 760px 이하에서만 버튼 표시, 761px 이상이 되면 열린 드로어도 닫힘
- [ ] 열기·닫기(버튼, ×, Esc, 배경 클릭, 메뉴 선택 후 이동, 뒤로 가기)
- [ ] 열리면 첫 항목에 포커스, `role="dialog"`·`aria-modal`·`aria-label`
- [ ] Tab·Shift+Tab이 드로어 안에서만 순환 (밖에 있던 포커스는 방향에 따라 처음/끝으로)
- [ ] 열린 동안 배경 스크롤 잠금과 `#root` inert, 닫히면 둘 다 해제
- [ ] 닫히면 햄버거 버튼으로 포커스 복귀 (리사이즈 닫힘은 한계로 기록)
- [ ] 로그인 상태별 영역 표시, 로그아웃 실패 알림 동작

---

## 6. 오류 처리

| 상황 | 처리 |
|------|------|
| 정의되지 않은 경로 | NotFoundPage |
| 없는 enjoy 카테고리 | NotFoundPage (크래시 방지). `Object.hasOwn(enjoyConfigs, category)`로 판별해 `constructor`·`__proto__` 같은 프로토타입 키도 404로 보낸다. `EnjoyDetailPage`는 `enjoyConfigs`와 `categoryFacts` 두 객체 모두 판별한다 |
| 있는 카테고리의 없는 항목 id | **변경 없음** (MF-4 범위, 다음 묶음) |
| Layout 페이지 렌더 오류 | page ErrorBoundary, `location.key` 변경 시 초기화 (쿼리만 바뀌는 이동, 같은 링크 재클릭 포함) |
| 그 밖의 렌더 오류 | app ErrorBoundary |
| 이벤트·비동기 오류 | 범위 밖 (한계로 명시) |

규칙: URL 파라미터를 설정 객체의 키로 쓸 때는 `in`이나 `obj[key]` 존재 여부가 아니라 `Object.hasOwn`으로 판별한다.

---

## 7. 보안

- 오류 화면에 오류 메시지·스택을 표시하지 않는다(개발자 콘솔에만 기록).

---

## 8. 테스트 계획

### 8.1 정적

- `npm run build`, `npx eslint .` 오류 0
- `grep -rn 'href="#' frontend/src`: Layout 안 페이지와 헤더·푸터·공지에서 반응 없는 링크 0건 (페이지 내 앵커 제외). 계획 2.2에서 제외한 로그인·회원가입·비밀번호 찾기의 13개는 후속 과제 (범위 조정, §12)

### 8.2 L2 브라우저 (사용자에게 번호별로 결과를 받는다)

| # | 동작 | 기대 결과 |
|---|------|-----------|
| 1 | `/abc` 접속 | 헤더·푸터 있는 404, 링크 3개 동작 |
| 2 | `/enjoy/abc`, `/enjoy/abc/x` | 404, 흰 화면·콘솔 Uncaught 없음 |
| 3 | 로그인 → 회원 메뉴 북마크, 마이 페이지 | 각각 "준비 중" 화면 |
| 4 | 헤더 "여행 피드", 푸터 "여행 피드"·"공지사항", 홈 공지 "전체 보기" | 각각 "준비 중" 화면 |
| 5 | 푸터 약관·문의 등 | 클릭 대상이 아니고 "준비 중" 표시 |
| 6 | 기존 라우트 14개 (홈, 로그인, 회원가입, 비밀번호 찾기, 여행지 6개, 여행 즐기기 4개) | 이전과 동일 |
| 7 | 브라우저 폭 760px 이하 → 햄버거 → 메뉴 이동 | 드로어 열림, 이동 후 닫힘 |
| 8 | 드로어에서 Esc, 배경 클릭 | 닫힘, 포커스가 버튼으로 복귀, 배경 스크롤 정상 |
| 9 | 모바일 폭에서 로그인·로그아웃 | 드로어 로그인 영역이 상태에 맞게 바뀜 |
| 10 | 홈(투명 헤더)과 여행지(흰 헤더)에서 햄버거 버튼 | 두 곳 모두 아이콘이 보임 |
| 11 (개발 모드) | 임시로 한 페이지에서 throw → 확인 후 원복 | page 오류 화면, 다른 메뉴로 이동하면 복구 |

Act-1 이후 세부 항목(#2-2 프로토타입 키, #7-2 `aria-controls`, #8-1 방향별 트랩, #8-4 inert와 6가지 닫힘 경로, #12 더보기 목적지·이름 등)과 자동 확인 결과는 분석 문서 8장 체크리스트가 기준이다.

---

## 9. 구조

| 구성요소 | 위치 |
|----------|------|
| ErrorBoundary | `src/components/common/ErrorBoundary.jsx` (신규) |
| NotFoundPage, ComingSoonPage | `src/pages/NotFoundPage.jsx`, `src/pages/ComingSoonPage.jsx` (신규) |
| 공통 스타일 | `src/pages/StatusPage.css` (신규) |
| 메뉴 데이터 | `src/data/navigation.js` (신규) |
| MobileNav | `src/components/layout/MobileNav.jsx` (신규), 스타일은 `Header.css`에 추가 |
| 푸터 "준비 중" 스타일 | `src/components/home/HomeSections.css` (기존 푸터 스타일 위치) |

---

## 10. 코딩 규칙

- 기존 스타일: 세미콜론 없음, 작은따옴표, 한국어 주석
- 주요 결정 지점에 `// Design Ref: §N — 이유`
- 새 의존성 금지

---

## 11. 구현 가이드

### 11.1 파일

```
frontend/src/
├── components/common/ErrorBoundary.jsx   (신규)
├── components/layout/MobileNav.jsx       (신규)
├── components/layout/Header.jsx          (수정) navigation.js 사용, 피드 링크, MobileNav
├── components/layout/Header.css          (수정) 햄버거·드로어 스타일, 760px 규칙
├── components/layout/Layout.jsx          (수정) page ErrorBoundary
├── components/layout/Footer.jsx          (수정) 링크 정리
├── components/home/NoticeSection.jsx     (수정) /notices 링크
├── components/home/HomeSections.css      (수정) 푸터 "준비 중" 텍스트·배지
├── data/navigation.js                    (신규)
├── pages/NotFoundPage.jsx                (신규)
├── pages/ComingSoonPage.jsx              (신규)
├── pages/StatusPage.css                  (신규)
├── pages/EnjoyCategoryPage.jsx           (수정) 없는 카테고리 → NotFound
├── pages/EnjoyDetailPage.jsx             (수정) 없는 카테고리 → NotFound
├── pages/DestinationsPage.jsx            (수정, Act-1) "더보기" 4개 연결
└── App.jsx                               (수정) app ErrorBoundary, 준비 중 라우트, * 라우트
```

### 11.2 구현 순서

1. [ ] `navigation.js`, `StatusPage.css`, NotFoundPage, ComingSoonPage
2. [ ] ErrorBoundary (variant, resetKey, 다시 시도)
3. [ ] App 라우트와 app ErrorBoundary, Layout의 page ErrorBoundary
4. [ ] EnjoyCategoryPage, EnjoyDetailPage 카테고리 방어
5. [ ] Header 피드 링크·navigation.js 적용, Footer, NoticeSection 링크 정리
6. [ ] MobileNav + Header 연결 + CSS
7. [ ] build, lint, `href="#"` grep

### 11.3 세션 가이드

단일 모듈(`module-frontend`), 담당 frontend-lead, 한 세션에 진행.

---

## 12. Act-1 변경 설계 (Check 결과 반영)

근거: `docs/03-analysis/app-safety-net.analysis.md` 7장 코드 리뷰, 6장 gap. 사용자 결정으로 아래 5건을 수정했다. v0.3에서 문구를 실제 구현에 맞췄다(분석 N-2, N-3).

| ID | 변경 | 설계 |
|----|------|------|
| MF-1 (G-01) | `/destinations` "더보기" 4개 연결 | `DestinationsPage`의 `SectionHeading`이 `moreTo`(목적지 경로)와 `moreLabel`(접근 가능한 이름)을 받는다. `moreTo`가 있을 때만 `Link`를 렌더하고, 없으면 링크를 두지 않는다. `#more` 기본값을 남기지 않는다. 화면 문구는 모두 "더보기"라 스크린리더가 구분할 수 있도록 `moreLabel`을 `aria-label`로 붙이고, 보이는 문구 "더보기"를 포함하게 짓는다(Label in Name). 매핑: 주제별 → `/destinations/attractions`("관광지 더보기"), 문화 → `/destinations/culture`("문화시설 더보기"), 코스 → `/destinations/courses`("여행코스 더보기"), 새롭게 만나는 여행지 → `/destinations/attractions`("여행지 더보기"). 마지막 섹션에는 문화시설도 섞여 있어 목적지와 의미가 완전히 같지는 않다. `/destinations/search`는 조건 없이 열면 "선택한 조건으로" 배너가 나와 오해를 주므로 쓰지 않았다 |
| SI-1 | 드로어 포커스 누수 | 드로어가 열린 동안 `#root`에 `inert`를 적용한다(드로어는 body 포털이라 `#root`와 형제). 해제는 effect cleanup 한 곳에서 하고, **해제한 뒤** 햄버거로 포커스를 돌린다(햄버거도 `#root` 안). 수동 트랩에는 포커스가 드로어 밖에 있을 때 Tab은 처음, Shift+Tab은 마지막 항목으로 보내는 분기를 추가한다. Header가 라우트당 하나라는 전제를 둔다(§5.1) |
| SI-2 (G-08) | page 경계 초기화 기준 | `resetKey={location.key}`. 오류가 없을 때는 아무 일도 하지 않으므로 파라미터 이동 시 페이지 상태 유지 의도는 그대로다 |
| SI-3 (G-04) | 푸터 "준비 중" 대비 | 텍스트·배지 불투명도 .6, 배경 `#14345f` 대비 5.52:1. "준비 중" 구분은 배지로 한다(§3.2) |
| G-03 | 프로토타입 키 카테고리 | `Object.hasOwn(enjoyConfigs, category)`로 판별. `EnjoyCategoryPage`, `EnjoyDetailPage` 두 곳. `EnjoyDetailPage`는 `categoryFacts`도 함께 판별(§6) |

함께 반영한 Nice: NH-2 닫힌 상태에서 `aria-controls` 생략(§5.1).

성공 기준 조정: "반응 없는 링크 0개"는 Layout 안 페이지와 헤더·푸터·공지 기준으로 한다(Context Anchor SUCCESS, §8.1). 로그인·회원가입·비밀번호 찾기의 13개는 후속 과제.

후속 과제로 남기는 항목:

- 로그인·회원가입·비밀번호 찾기의 약관·고객센터 링크 13개
- `TravelEnjoyPage` `SectionHeading`의 `#more` 기본값(G-09)
- NH-1, NH-3 ~ NH-8 (NH-2는 Act-1에서 구현)
- `EnjoyCategoryPage` 탭 전환 시 상태 유지 문제
- Act-1 재리뷰 Nice 4건
  - `SectionHeading` 이름 관련 API 중복: 보이는 "더보기"와 `moreLabel`을 따로 받음 (분석 N-2)
  - "여행지 더보기"와 섹션 내용(문화시설 포함)의 의미 차이
  - inert가 Header 단일 인스턴스를 전제한다는 주석
  - 리사이즈로 닫힐 때 포커스 (G-05, NH-1과 같은 문제)
- 핸들러 없는 버튼: `EnjoyDetailPage` 전화 문의·정보 오류 제보·길찾기, `TravelEnjoyPage` 축제 필터
- `/enjoy` 콜라주 잘림: 761 ~ 약 800px에서 오른쪽 최대 18px, 1101 ~ 약 1266px에서 최대 154px (기존 문제, 자동 L2에서 발견)

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-23 | 초안 (설계안 C) | WOOJIN |
| 0.2 | 2026-09-23 | §12 Act-1 변경 설계, 성공 기준 범위 조정 | WOOJIN |
| 0.3 | 2026-09-24 | Check 2회차 반영: 구현 결정 D-1 ~ D-19를 §2.1·§2.3·§3.1·§3.2·§5.1·§5.3·§6·§8·§9·§11.1에 반영, 본문과 §12 불일치(N-1 ~ N-4) 해소, 기존 라우트 14개, §12 후속 목록 정정 | WOOJIN (Claude Code 보조) |
| 1.0 | 2026-09-24 | 분석 v0.2 완료로 설계 확정. Complete 상태로 변경 | WOOJIN (Claude Code 보조) |
