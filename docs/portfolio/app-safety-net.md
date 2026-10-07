# app-safety-net 포트폴리오·면접 자료

> **기능**: app-safety-net (앱 안전망: ErrorBoundary, 404·준비 중 화면, 반응 없는 링크 정리, 모바일 메뉴 드로어)
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **목표 직무**: 프론트엔드 개발자
> **작성일**: 2026-09-24
> **근거 자료**: 계획 `docs/01-plan/features/app-safety-net.plan.md`, 설계 `docs/02-design/features/app-safety-net.design.md`(v1.0), 분석 `docs/03-analysis/app-safety-net.analysis.md`(v0.2), 완료 보고서 `docs/04-report/features/app-safety-net.report.md`, 커밋 `98922ee`, 그리고 실제 코드(`frontend/src/components/common/ErrorBoundary.jsx`, `components/layout/{Layout,Header,MobileNav,Footer}.jsx`, `Header.css`, `components/home/HomeSections.css`, `pages/{NotFoundPage,ComingSoonPage,EnjoyCategoryPage,EnjoyDetailPage,DestinationsPage}.jsx`, `data/navigation.js`, `App.jsx`)

> **사실 범위 메모 (이 문서 전체에 적용)**
> - 성능 수치(로딩 시간, 렌더 횟수 등)와 사용자 지표는 측정하지 않았다. 이 문서에는 그런 수치가 없다.
> - 브라우저 확인은 **사람이 한 것이 아니다.** 메인 세션이 헤드리스 Chrome 153을 CDP로 조작해 측정한 "자동 L2"다(2026-09-24, 기준 커밋 `68e140b`, 백엔드 꺼짐). 측정한 항목은 전부 통과했고 실패는 0건이다.
> - **미확인 항목**: 로그인 상태가 필요한 #3, #9 ~ #9-3(백엔드 필요), 코드를 임시로 고쳐 throw해야 하는 #11, #11-1(ErrorBoundary 복구의 런타임 확인). 사용자 수동 L2는 아직 수행하지 않았다.
> - 검증된 것: `npm run build` 성공, `npx eslint .` 오류 0, 코드 리뷰 1차 "조건부 머지" → Act-1 수정 6건 → 재리뷰 "머지 가능"(Must Fix 0, Should 0, Nice 4), bkit gap 분석 정적 Match Rate 97.3% → 99.0%.
> - "반응 없는 링크 0개" 성공 기준은 Check 이후 **범위를 조정했다**(Layout 안 페이지 + 헤더·푸터·공지). 제외 페이지(로그인·회원가입·비밀번호 찾기)에 반응 없는 링크 13개가 남아 있다.
> - 백엔드 변경은 없다.

---

## Overview

없는 경로, 렌더 오류, 미구현 메뉴, 잘못된 카테고리 URL에서 흰 화면이나 앱 전체 크래시가 나던 상태를, **"없음(404) / 아직 없음(준비 중) / 오류(ErrorBoundary)"** 세 가지 화면으로 구분해 어떤 상황에서도 헤더를 통해 이동할 수 있게 만들었다. ErrorBoundary는 새 의존성 없이 class 컴포넌트로 직접 구현해 페이지 영역과 최상위 두 곳에 두었고, 760px 이하에서 사라지던 헤더 메뉴는 햄버거 버튼 + 접근성 있는 드로어로 대체했다.

## Background

- `App.jsx`에 `path="*"` 라우트가 없고, `frontend/src` 전체에 ErrorBoundary가 없었다(계획 1.2).
- 선행 기능 auth-token-flow로 로그인이 동작하면서 회원 메뉴의 `/bookmarks`, `/mypage` 링크가 사용자에게 보이기 시작했지만 대응 라우트가 없었다(MF-N1).
- `EnjoyDetailPage.jsx`의 `categoryFacts[category].map`이 없는 카테고리에서 크래시했다. `EnjoyCategoryPage`는 `enjoyConfigs[category] || enjoyConfigs.festivals`로 없는 카테고리를 조용히 축제 목록으로 바꿔 보여 줬다(커밋 `98922ee` diff).
- 헤더의 `/#feed`, 푸터의 `#feed`·`#notice`·`#faq`·`#contact`·`#terms`·`#privacy`·`#location`, 공지 섹션의 `#notice`는 대상이 없어 눌러도 반응이 없었다.
- `Header.css`는 760px 이하에서 `.site-header__nav`를 숨기고 대체 메뉴가 없었다(MF-6). 모바일에서는 다른 섹션으로 이동할 방법이 없었다.

---

## 1. 포트폴리오 프로젝트 설명용 문단

WayLog는 React와 Spring Boot로 만든 국내 여행 SNS입니다. 없는 경로나 렌더 오류에서 헤더도 없는 흰 화면이 나오고, 모바일에서는 메뉴가 사라지던 문제를 "앱 안전망" 작업으로 정리했습니다. 새 의존성 없이 class 컴포넌트로 ErrorBoundary를 직접 만들어 페이지 영역과 최상위 두 곳에 두었고, 페이지 경계는 `location.key`가 바뀌면 `getDerivedStateFromProps`에서 오류 상태를 풀어 다른 메뉴로 이동하면 바로 복구되게 했습니다. "페이지 없음", "기능 준비 중", "오류 발생"을 서로 다른 공통 화면으로 나눴고, URL 파라미터를 설정 객체 키로 쓰는 곳은 `Object.hasOwn`으로 판별해 `/enjoy/constructor` 같은 프로토타입 키도 404로 보냈습니다. 760px 이하에는 body 포털 드로어를 추가하고, 열린 동안 `#root`에 `inert`를 걸고 수동 포커스 트랩을 함께 둬서 키보드·스크린리더 사용자가 가려진 페이지로 빠지지 않게 했습니다. 코드 리뷰 1차 "조건부 머지"를 받은 뒤 6건을 고쳐 재리뷰에서 "머지 가능" 판정을 받았습니다.

---

## 2. 이력서 bullet

- 새 의존성 없이 **class 컴포넌트 ErrorBoundary를 페이지 영역·최상위 두 곳에 설계**하고 `location.key`를 초기화 키로 사용해, 렌더 오류가 나도 헤더·푸터가 남고 다른 메뉴로 이동하면 자동 복구되도록 구성 (404·준비 중·오류 화면을 공통 컴포넌트로 분리해 상세 페이지 not-found 작업에서 재사용 예정)
- 760px 이하에서 사라지던 헤더 메뉴를 **body 포털 드로어**로 대체하고 `#root` `inert` + 수동 포커스 트랩, 6가지 닫힘 경로의 단일 cleanup, `aria-modal`·`aria-current`·조건부 `aria-controls`를 적용 (헤드리스 Chrome 자동 확인에서 Tab·Shift+Tab 각 20회 반복 시 드로어 밖 이탈 0회)
- 코드 리뷰(조건부 머지)와 설계 대비 gap 분석 결과를 받아 **드로어 포커스 누수, 프로토타입 키 URL 크래시(`Object.hasOwn`), 푸터 텍스트 대비(약 3.9:1 → 5.52:1)** 등 6건을 수정해 재리뷰 "머지 가능"(Must Fix 0), 정적 Match Rate 97.3% → 99.0% 달성

> bullet의 수치는 모두 문서에 기록된 값이다. 마지막 bullet의 "6건"은 MF-1, SI-1, SI-2, SI-3, G-03, NH-2다(보고서 5.3).

---

## 3. 기술적 의사결정

### 3.1 ErrorBoundary를 페이지 영역 + 최상위 두 곳에 둠 (대안: 최상위 하나)

```
App
└─ AuthProvider
   └─ BrowserRouter
      └─ ErrorBoundary variant="app"        ← 홈·로그인(Layout 밖)과 Header 자체의 오류
         └─ Routes
            ├─ /, /login, /signup, /forgot-password
            └─ Layout (Header, Footer)
               └─ ErrorBoundary variant="page" resetKey={location.key}
                  └─ Outlet                  ← 페이지 본문만 대체
```

| 선택지 | 오류 시 화면 | 복구 방법 |
|--------|-------------|-----------|
| 최상위 하나만 | 헤더까지 사라진 전체 오류 화면 | 새로고침 |
| **페이지 + 최상위 (선택)** | Layout 페이지 오류는 본문만 대체, 헤더·푸터 유지 | 헤더로 다른 메뉴 이동 → 자동 복구 |

- **근거**: 계획 7.2 "오류 시에도 헤더로 이동 가능, 라우트 이동으로 복구. 사용자 확인".
- **두 경계의 역할 분리** (`ErrorBoundary.jsx:55-84`)
  - `page`: "다시 시도"(오류 상태만 초기화)와 `<Link to="/">`.
  - `app`: 라우터 상태를 신뢰할 수 없으므로 `Link` 대신 `<a href="/">`(전체 새로고침)와 `window.location.reload()`를 쓴다.
  - app 경계는 링크를 렌더하므로 `BrowserRouter` **안**에 둔다(`App.jsx:269-274` 주석).
- **class 컴포넌트를 쓴 이유**: 계획 7.2 "새 의존성 금지 원칙, 설명 가능성". 오류 경계는 Hook으로 만들 수 없어 class가 필요하다(코드 주석 `ErrorBoundary.jsx:8-9`). `react-error-boundary`는 쓰지 않았다.
- **보안**: 오류 메시지·스택은 화면에 표시하지 않고 `componentDidCatch`에서 `console.error`로만 남긴다(설계 §7).
- **면접에서 정직하게 말할 한계**: ErrorBoundary는 렌더링·생명주기 오류만 잡는다. 이벤트 핸들러와 비동기(fetch 등) 오류는 잡지 못하고, 이 사실을 코드 주석(`ErrorBoundary.jsx:11-15`)과 설계 §2.2에 적었다. 또 app 경계는 새로고침으로만 복구된다(리뷰 NH-3).

### 3.2 `resetKey={location.key}`와 `getDerivedStateFromProps`

- **문제**: 오류 경계는 한 번 오류 상태가 되면 계속 오류 화면을 보여 준다. 사용자가 헤더로 다른 메뉴를 눌러도 같은 경계 인스턴스가 살아 있어 복구되지 않는다(계획 5장 위험 1순위).
- **초기화 키 선택 과정**
  1. 1차 구현은 `pathname`이었다. gap 분석 G-08과 리뷰 SI-2가 "쿼리만 바뀌는 이동과 같은 링크 재클릭에서는 pathname이 그대로라 초기화되지 않는다"고 지적했다.
  2. Act-1에서 `location.key`로 바꿨다(`Layout.jsx:113`). `location.key`는 이동마다 새로 만들어지므로 두 경우 모두 초기화된다.
  3. 오류가 없을 때는 `getDerivedStateFromProps`가 `hasError: false`를 다시 넣을 뿐이라 페이지 상태에는 영향이 없다(설계 §2.1).
- **왜 `getDerivedStateFromProps`인가** (`ErrorBoundary.jsx:31-41` 주석): `componentDidUpdate`에서 초기화하면 오류가 난 커밋 직후 한 번 더 렌더를 시도하게 된다. 렌더 **전에** 실행되는 `getDerivedStateFromProps`에서 이전 키와 비교해 바로 `hasError: false`로 바꾼다.
- **대안: `<Outlet key={pathname} />`로 서브트리를 다시 마운트** — 쓰지 않았다. 같은 페이지 컴포넌트 안의 파라미터 이동(`/enjoy/food` → `/enjoy/stay`)에서도 페이지 상태를 매번 초기화해 기존 동작을 바꾸기 때문이다(코드 주석). 리뷰 Keep 항목에도 "Outlet에 key를 주지 않은 이유"가 들어갔다(분석 7.2).
- **검증 한계**: 실제로 throw해서 복구되는지 보는 L2 #11은 코드 임시 수정이 필요해 **아직 확인하지 않았다.** 현재 근거는 코드 리뷰와 정적 분석이다.

### 3.3 "없음 / 아직 없음 / 오류"를 서로 다른 화면으로

| 상황 | 화면 | 구현 |
|------|------|------|
| 정의되지 않은 경로 | `NotFoundPage` (헤더·푸터 유지, 홈·여행지·여행 즐기기 링크) | Layout 안 `<Route path="*">` |
| 없는 enjoy 카테고리 | `NotFoundPage` | `Object.hasOwn` 판별 후 반환 |
| 메뉴는 있지만 미구현 | `ComingSoonPage title="…"` | `/feed`, `/bookmarks`, `/mypage`, `/notices` |
| 목적지 없는 푸터 항목 | 링크가 아닌 텍스트 + "준비 중" 배지 | `PendingFooterItem` (`Footer.jsx:11-18`) |
| 렌더 오류 | ErrorBoundary 오류 화면 | 3.1 |

- **미구현 메뉴를 숨기지 않은 이유**: 계획 7.2 "메뉴 구조 유지, 나중에 기능만 교체". 기능이 완성되면 `App.jsx`의 해당 라우트 element만 바꾸면 된다(`ComingSoonPage.jsx` 주석).
- **`*` 라우트가 기존 라우트를 가리지 않는가**: React Router는 경로 점수로 매칭하므로 명시한 라우트(`/login` 등 Layout 밖 포함)가 우선한다(`App.jsx:300-303` 주석). 자동 L2 #6에서 기존 라우트 14개가 모두 h1을 렌더하고 흰 화면·Uncaught 0이었다. 단, 백엔드가 꺼진 상태라 데이터 표시는 확인하지 않았다.
- **없는 카테고리를 404로 바꾼 UX 이유**: 기존 `EnjoyCategoryPage`는 없는 카테고리를 축제 목록으로 대신 보여 줬다. 사용자는 주소가 잘못됐다는 것을 알 수 없다(`EnjoyCategoryPage.jsx` 주석).
- **재사용 설계**: `NotFoundPage`는 `title`, `description`을 props로 받아 다음 작업(MF-4 상세 페이지 not-found)에서 "콘텐츠를 찾을 수 없습니다"로 재사용할 수 있다. 세 화면은 `StatusPage.css` 하나를 공유한다.

### 3.4 Hook 규칙을 지키려고 판별 컴포넌트와 본문 컴포넌트를 나눔

- **문제**: `EnjoyCategoryPage`는 본문에서 `useState`를 여러 개 쓴다. 없는 카테고리일 때 `return <NotFoundPage />`를 Hook 호출 **앞에** 두면, 카테고리에 따라 Hook 호출 순서가 달라진다.
- **구현** (커밋 `98922ee` diff): 바깥 `EnjoyCategoryPage`는 URL 판별만 하고, 상태를 쓰는 본문은 `EnjoyCategoryContent`로 분리했다. `EnjoyDetailPage` → `EnjoyDetailContent`도 같은 구조다.
- **부수 관찰(범위 밖)**: 1차 리뷰에서 `EnjoyCategoryPage`는 탭(카테고리)을 바꿔도 지역·페이지·저장 상태가 유지돼 "총 0건" 빈 그리드가 나올 수 있다는 기존 문제가 발견됐다. 후보 해결책은 `<EnjoyCategoryContent key={category} />`이며, 후속 과제로 남겼다(분석 7.2).

### 3.5 드로어를 `document.body`로 포털

- **이유** (설계 §2.1, `MobileNav.jsx` 주석): `.site-header`에 `transform: translateX(-50%)`(`Header.css:13`)와 스크롤 시 `backdrop-filter`(`Header.css:25`)가 있다. 이런 속성이 있는 요소는 자손의 `position: fixed` 기준(containing block)이 되므로, 헤더 안에 드로어를 두면 뷰포트가 아니라 헤더 기준으로 배치된다.
- **구현**: `createPortal(…, document.body)`, 스타일은 헤더 하위가 아닌 최상위 선택자 `.mobile-nav`, `z-index: 1100`(헤더 1000보다 위).
- **포털이 가져온 이점**: 드로어가 `#root`의 **형제**가 되므로, `#root` 전체에 `inert`를 걸어도 드로어 자신은 영향을 받지 않는다(3.6).
- **기록 범위**: 이 결정은 설계 초안에 없었고 구현 중 추가된 것이다(분석 D-2). 브라우저에서 먼저 어긋난 것을 보고 바꿨는지는 문서에 기록이 없으므로, 면접에서는 "헤더에 transform이 있어서 fixed 기준이 바뀌는 문제를 피하려고 포털을 썼다"까지만 말한다.

### 3.6 드로어 접근성: `#root` inert + 수동 포커스 트랩 2중 방어

| 장치 | 막는 것 | 위치 |
|------|---------|------|
| `role="dialog"` + `aria-modal="true"` + `aria-label="전체 메뉴"` | 대화상자임을 보조기술에 알림 | `MobileNav.jsx:291` |
| `#root`에 `inert` | 가려진 페이지(헤더·본문·푸터)를 Tab 순서·클릭·스크린리더 탐색에서 제외 | `:171-172` |
| 수동 Tab 트랩 | 처음/끝에서 순환, 포커스가 드로어 밖이면 Tab → 처음, Shift+Tab → 마지막 | `:183-202` |
| 초기 포커스 | 열리면 드로어 첫 항목으로 | `:175` |
| 스크롤 잠금 | 열린 동안 `body`·`html` `overflow: hidden`, 이전 값을 저장했다가 복원 | `:164-167`, `:215-216` |

- **왜 2중인가**: 코드 주석은 "`aria-modal`만으로는 일부 스크린리더가 가려진 페이지를 읽는다"고 적었다. `inert`가 1차 방어다. 그래도 패널의 빈 곳을 클릭하면 포커스가 `body`로 빠질 수 있어서, 트랩에 `!drawer.contains(document.activeElement)` 분기를 추가해 방향에 맞게 되돌린다.
- **닫힘 경로 6가지를 cleanup 한 곳으로**: Esc, 배경 클릭, ×, 메뉴 링크 이동, 뒤로 가기, 761px 이상으로 리사이즈(`matchMedia` change). 모두 `isOpen`이 `false`가 되어 같은 effect cleanup(`:214-225`)을 거치므로 스크롤 잠금·`inert`·이벤트 리스너 해제가 빠지지 않는다.
- **경로 변경 시 닫기를 effect가 아닌 렌더 중에**: `openedPathname !== pathname`이면 렌더 중에 바로 상태를 조정한다(`:150-153`). effect에서 `setState`하면 렌더가 한 번 더 일어나기 때문이다(코드 주석).
- **순서 제약**: 3.6의 핵심 세부는 4.1 트러블슈팅 참고.
- **그 밖의 ARIA**: 햄버거 버튼 `aria-expanded`, `aria-controls`는 **열린 동안에만** 둔다(`:274`). 닫힌 상태에서는 드로어가 DOM에 없어 존재하지 않는 id를 가리키게 되기 때문이다(리뷰 NH-2). 현재 메뉴에는 데스크톱·드로어 모두 `aria-current="page"`.
- **`prefers-reduced-motion`**: 드로어 슬라이드·페이드 애니메이션을 끈다(`Header.css`).
- **자동 L2 결과**: #8 Esc·배경·× 세 경로 닫힘과 포커스 복귀, #8-1 열린 동안 `#root[inert]` 확인 + 빈 곳 클릭 뒤 Tab 20회·Shift+Tab 20회 드로어 밖 이탈 0/0, #8-2 `history.back()`으로 닫힘, #8-3 800px·761px 리사이즈 닫힘과 해제.

### 3.7 헤더·드로어 메뉴 데이터 공유와 상태 소유권

- **설계안 비교** (설계 §2.0)

| 기준 | A. 최소 변경 | B. 클린 아키텍처 | **C. 실용 균형 (선택)** |
|------|:---:|:---:|:---:|
| 신규 파일 | 1 | 약 8 | 약 5 |
| 메뉴 중복 | 3곳 하드코딩 | 전부 통합 | 헤더·드로어만 통합 |
| 위험 | 중간 (Header 비대) | 중간 (과설계) | 낮음 |

- **공유 범위**: 데스크톱 헤더와 드로어는 같은 메뉴를 보여 줘야 하므로 `data/navigation.js`의 `mainNavItems`, `memberMenuItems`를 공유한다. 푸터는 구성(고객지원·약관)이 달라 공유하지 않는다(설계 §1.2 "중복 제거는 필요한 곳만").
- **MobileNav는 `useAuth`를 직접 쓰지 않는다**: Header가 `member`, `isRestoring`, `activePage`, `onLogout`(= `requestLogout`)을 props로 넘긴다(`Header.jsx:128`). auth-token-flow에서 만든 "로그아웃 실패 알림" 상태를 Header 한 곳에서만 관리해, 데스크톱과 모바일이 같은 알림을 쓰게 하기 위해서다(설계 §2.3).
- **모바일 헤더 배치**: 760px 이하에서는 로그인·회원가입·회원 메뉴도 드로어로 옮기고 헤더에는 로고와 햄버거만 둔다. 320px 폭에서 로고 + 버튼 두 개 + 햄버거가 한 줄에 들어가지 않기 때문이다(분석 D-1). 자동 L2 #7-1에서 320px 한 줄, `scrollWidth` 320(가로 스크롤 없음)을 확인했다.

### 3.8 URL 파라미터 키 판별은 `Object.hasOwn`으로

- 규칙(설계 §6): "URL 파라미터를 설정 객체의 키로 쓸 때는 `in`이나 `obj[key]` 존재 여부가 아니라 `Object.hasOwn`으로 판별한다."
- 배경과 과정은 4.2 트러블슈팅 참고.

### 3.9 반응 없는 링크 정리와 접근성

- **푸터**: 목적지가 없는 항목(자주 묻는 질문·문의하기·이용약관·개인정보처리방침·위치기반서비스)은 `aria-disabled` 링크가 아니라 **일반 텍스트(`span`)** + "준비 중" 배지로 바꿔 포커스 대상에서 뺐다(설계 §3.2). 목적지가 있는 "여행지", "여행 코스", "여행 피드", "공지사항"은 실제 라우트나 준비 중 화면으로 연결했다.
- **대비**: 1차 구현의 준비 중 텍스트는 리뷰에서 대비 "약 3.9:1"로 WCAG AA(4.5:1) 미달 지적을 받았다(SI-3, G-04). 흰색 불투명도를 .6으로 올려 배경 `#14345f` 위에서 5.52:1로 맞췄다. 일반 링크(.68)보다는 흐리게 두되, "준비 중" 구분은 색이 아니라 **배지 텍스트**로 한다(색에만 의존하지 않음).
- **`/destinations` "더보기" 4개**: 1차 리뷰 **Must Fix**(MF-1). `href="#more"`로 반응이 없었다. `SectionHeading`에 `moreTo`(목적지)와 `moreLabel`(접근 가능한 이름)을 받게 하고, `moreTo`가 있을 때만 `Link`를 렌더한다.
  - 화면 문구는 모두 "더보기"라 스크린리더 링크 목록에서 구분되지 않는다. 그래서 `aria-label`에 "관광지 더보기", "문화시설 더보기"처럼 **보이는 문구 "더보기"를 포함한** 이름을 붙였다(Label in Name, WCAG 2.5.3). 음성 입력 사용자가 화면에 보이는 "더보기"로 링크를 부를 수 있게 하기 위한 규칙이다. 화살표는 `aria-hidden`.
  - 목적지 선택: `/destinations/search`는 조건 없이 열면 "선택한 조건으로" 배너가 나와 오해를 주므로 쓰지 않았다. "새롭게 만나는 여행지"는 문화시설도 섞여 있어 `/destinations/attractions`와 의미가 완전히 같지 않다는 점을 한계로 기록했다(재리뷰 Nice).
- **결과**: 반응 없는 앵커 17개 → 13개. 남은 13개는 모두 계획에서 제외한 로그인·회원가입·비밀번호 찾기 페이지에 있다(분석 4장).

---

## 4. 트러블슈팅 스토리

### 4.1 드로어 포커스 누수와 "inert 해제 후 포커스 복귀" 순서 (SI-1, N-3)

#### Problem
드로어를 열어도 키보드 포커스가 가려진 페이지로 빠져나갈 수 있었고, 스크린리더가 드로어 뒤의 페이지 내용을 읽을 수 있었다. 1차 코드 리뷰에서 **Should Improve이지만 머지 조건**(SI-1)으로 분류됐다.

#### Cause
1차 구현은 `aria-modal="true"`와 수동 Tab 트랩만 있었다.
- `aria-modal`만으로는 가려진 콘텐츠를 막지 못하는 스크린리더가 있다(코드 주석).
- 수동 트랩은 "포커스가 이미 드로어 안에 있다"는 전제로 처음/끝 항목만 검사했다. 패널의 빈 곳을 클릭하면 포커스가 `body`로 빠지는데, 이 상태에서 Tab을 누르면 트랩 조건에 걸리지 않고 페이지로 이동했다.

#### Investigation
- 브라우저에서 먼저 발견한 것이 아니라 **Check 단계 코드 리뷰(frontend-code-reviewer)** 가 `MobileNav.jsx`의 트랩 코드를 읽고 "포커스가 드로어 밖에 있을 때"라는 경우가 빠졌다고 지적했다.
- 수정 방향을 설계에 반영하는 과정에서, 2차 gap 분석이 설계 문구와 구현의 차이 두 가지를 잡았다(N-3): 설계는 "첫 항목으로"라고 했지만 구현은 방향별(Tab → 처음, Shift+Tab → 마지막)이고, **inert 해제와 포커스 복귀 사이의 순서 제약**이 설계에 적혀 있지 않았다.

#### Solution
- 드로어가 열린 동안 `#root`에 `inert`를 건다. 드로어는 body 포털이라 `#root`의 형제이므로 드로어 자신은 영향을 받지 않는다(3.5와 연결).
- 트랩에 `!drawer.contains(document.activeElement)` 분기를 추가해 밖에 있던 포커스를 방향에 맞춰 처음/끝 항목으로 되돌린다.
- **순서 제약**: 닫힐 때 포커스를 햄버거 버튼으로 돌려야 하는데, 햄버거 버튼도 `#root` 안에 있다. `inert` 상태의 요소는 포커스를 받지 못하므로, cleanup에서 **반드시 `inert`를 먼저 해제한 뒤** `toggleButton.focus()`를 호출한다.

```js
// MobileNav.jsx cleanup (214-225)
appRoot?.removeAttribute('inert')   // 1) 먼저 해제
toggleButton?.focus()               // 2) 그다음 포커스 복귀
```

- 해제는 effect cleanup **한 곳**에서만 한다. 6가지 닫힘 경로와 언마운트가 모두 이 cleanup을 거치므로 `inert`가 남아 페이지 전체가 조작 불가가 되는 상황을 막는다.

#### Result
- 재리뷰에서 SI-1 해소 확인, 판정 "머지 가능".
- 자동 L2 #8-1: 열린 동안 `#root[inert]` 존재, 패널 빈 곳 클릭 뒤 Tab 20회·Shift+Tab 20회 반복에서 드로어 밖 이탈 0/0. #8: Esc·배경·× 세 경로 모두 햄버거로 포커스 복귀.
- **남은 한계** (G-05, NH-1): 761px 이상으로 리사이즈해서 닫히면 햄버거가 CSS로 숨겨져 있어 포커스가 `BODY`에 남는다(자동 L2 #8-3에서 확인). 링크 이동으로 닫힐 때도 햄버거로 돌아가는데, 새 페이지에서는 복귀하지 않는 편이 자연스럽다. 둘 다 후속 과제.
- **전제**: Header(따라서 MobileNav)는 라우트당 하나만 렌더된다. 인스턴스가 둘이면 한쪽 cleanup이 다른 쪽이 건 `inert`를 풀 수 있다. 재리뷰는 이 전제를 주석으로 남기라고 권했다(Nice).
- **스크린리더 실기기 확인은 하지 않았다.** 헤드리스 Chrome에서 속성과 포커스 이동만 측정했다.

#### Learning
- 모달 접근성은 "포커스가 안에 있을 때"만 생각하기 쉽다. 포커스가 이미 밖으로 빠진 상태를 별도 경우로 다뤄야 한다.
- 두 방어 장치(inert, 트랩)가 서로 영향을 준다. inert는 가려진 영역을 막지만, 복귀 대상도 같은 영역 안에 있으면 해제 순서가 기능이 된다.
- 해제 로직을 닫힘 경로마다 두지 않고 cleanup 한 곳으로 모은 덕분에, 경로가 6개로 늘어도 해제 누락을 걱정하지 않아도 됐다.

### 4.2 `/enjoy/constructor`에서 404가 아니라 오류 화면이 뜨던 문제 (G-03)

#### Problem
없는 카테고리 `/enjoy/abc`는 404로 잘 처리됐지만, `/enjoy/constructor`, `/enjoy/toString`, `/enjoy/__proto__/x` 같은 URL에서는 404가 아니라 페이지 ErrorBoundary의 "화면을 표시하는 중 문제가 발생했습니다" 화면이 나왔다. 1차 gap 분석에서 Minor(G-03)로 분류됐고, FR-06 판정이 "부분 충족"이 됐다.

#### Cause
1차 구현은 `enjoyConfigs[category]`가 있는지(truthy)로 판별했다. `enjoyConfigs`는 일반 객체라 `enjoyConfigs['constructor']`는 프로토타입에서 올라온 `Object` 함수를 돌려준다. truthy이므로 판별을 통과하고, 이어서 `config.items` 같은 접근에서 TypeError가 나 렌더 오류가 됐다(`EnjoyCategoryPage.jsx` 주석: "`enjoyConfigs['constructor']`처럼 프로토타입에서 올라온 값이 통과하면 `config.items`에서 TypeError가 나므로").

#### Investigation
- 브라우저에서 우연히 본 것이 아니라 **gap 분석(bkit gap-detector)** 이 FR-06 "없는 카테고리는 크래시 없이 404"를 검사하면서, URL 값은 사용자가 마음대로 넣을 수 있다는 관점에서 프로토타입 키를 지적했다.
- 흥미로운 점은 이 경우에도 **흰 화면은 아니었다**는 것이다. 이번 작업에서 만든 페이지 ErrorBoundary가 오류를 받아 헤더·푸터를 유지했다. 안전망은 동작했지만, 사용자에게 줘야 할 답은 "오류"가 아니라 "없는 페이지"였다.

#### Solution
```js
// EnjoyCategoryPage.jsx
const config = Object.hasOwn(enjoyConfigs, category) ? enjoyConfigs[category] : null
if (!config) return <NotFoundPage />

// EnjoyDetailPage.jsx — 두 객체 모두 판별
const isKnownCategory = Object.hasOwn(enjoyConfigs, category) && Object.hasOwn(categoryFacts, category)
```
- `EnjoyDetailPage`는 `enjoyConfigs`와 `categoryFacts` 두 객체를 모두 쓰므로 둘 다 판별한다(분석 D-7).
- 규칙으로 설계 §6에 남겼다: "URL 파라미터를 설정 객체의 키로 쓸 때는 `Object.hasOwn`으로 판별한다."

#### Result
- 자동 L2 #2-2: `/enjoy/constructor`, `/enjoy/__proto__/x`, `/enjoy/toString` 모두 404, 오류 화면 없음. #2: `/enjoy/abc`, `/enjoy/abc/x` 404, Uncaught 0.
- FR-06 "부분" → "충족", 정적 Match Rate 기능 축 +0.5(분석 1장).

#### Learning
- URL 파라미터는 외부 입력이다. 일반 객체를 조회 테이블로 쓸 때는 `in`이나 truthy 검사가 프로토타입 체인까지 본다는 점을 기억해야 한다. `Map`이나 `Object.create(null)`로 데이터 구조를 바꾸는 방법도 있지만, 계획 6.2에서 `enjoyConfigs`(홈 섹션 등 여러 곳이 사용)의 데이터 구조는 바꾸지 않기로 했으므로 판별 쪽을 고쳤다. *(이 대안들을 당시 문서로 비교한 기록은 없다.)*
- 안전망(ErrorBoundary)이 있다고 입력 검증을 생략하면 안 된다. 경계는 "예상하지 못한 오류"를 위한 것이고, 예상 가능한 잘못된 입력은 명시적으로 404로 보내야 사용자가 상황을 이해한다.

---

## 5. 면접 Q&A

### Q1. ErrorBoundary를 왜 두 곳에 두었고, 오류 뒤에는 어떻게 복구되나요?

**30초 답변**
Layout 안 페이지 본문만 감싸는 page 경계와, 홈·로그인처럼 Layout 밖이나 헤더 자체 오류를 받는 app 경계를 따로 뒀습니다. 페이지에서 오류가 나도 헤더가 남아 있으니 다른 메뉴로 이동할 수 있고, page 경계는 `location.key`가 바뀌면 오류 상태를 풀어서 이동하는 순간 복구됩니다.

**1분 답변**
최상위에 하나만 두면 헤더까지 사라진 오류 화면이 나와서 사용자가 새로고침 말고는 할 수 있는 게 없습니다. 그래서 `Layout`의 `Outlet`만 page 경계로 감싸 본문만 대체하고, 헤더·푸터는 경계 밖에 뒀습니다. 복구는 `resetKey`로 합니다. 처음엔 pathname을 썼는데, 리뷰에서 쿼리만 바뀌는 이동이나 같은 링크 재클릭은 초기화되지 않는다는 지적을 받아 `location.key`로 바꿨습니다. 초기화는 `getDerivedStateFromProps`에서 이전 키와 비교해 렌더 전에 합니다. `componentDidUpdate`에서 하면 오류가 난 직후 한 번 더 렌더를 시도하기 때문입니다. app 경계는 라우터 상태를 믿을 수 없어서 `Link` 대신 `<a href="/">`와 새로고침 버튼을 씁니다.

**예상 꼬리 질문**
- *`<Outlet key={pathname} />`으로 다시 마운트하면 더 간단하지 않나요?* → `/enjoy/food` → `/enjoy/stay`처럼 같은 페이지 컴포넌트 안에서 파라미터만 바뀌는 이동에서도 페이지 상태가 매번 초기화돼 기존 동작이 바뀝니다. `resetKey`는 오류가 없을 때 아무것도 하지 않습니다.
- *이벤트 핸들러나 fetch 오류도 잡나요?* → 못 잡습니다. React 오류 경계는 렌더링·생명주기 오류만 잡습니다. 이 한계를 코드 주석과 설계에 적었고, 비동기 오류는 각 화면이 try/catch와 오류 상태로 처리해야 합니다.
- *왜 react-error-boundary를 쓰지 않았나요?* → 새 의존성을 추가하지 않는 원칙이 있었고, 직접 구현하면 동작을 설명할 수 있어서 class 컴포넌트로 만들었습니다.
- *복구가 실제로 동작하는 걸 확인했나요?* → 임시로 throw를 넣어 확인하는 항목(L2 #11)은 아직 하지 않았습니다. 지금 근거는 코드 리뷰와 정적 분석입니다. 솔직히 다음에 가장 먼저 채워야 할 검증입니다.

### Q2. 모바일 드로어의 접근성은 어떻게 처리했나요?

**30초 답변**
`role="dialog"`와 `aria-modal`을 두고, 열린 동안 `#root`에 `inert`를 걸어 가려진 페이지를 Tab·클릭·스크린리더에서 제외했습니다. 여기에 수동 포커스 트랩을 함께 둬서 포커스가 밖에 있을 때도 방향에 맞게 드로어 처음이나 끝으로 되돌립니다.

**1분 답변**
드로어는 `document.body`로 포털해서 `#root`와 형제가 되게 했습니다. 그래서 `#root` 전체에 `inert`를 걸어도 드로어는 영향을 받지 않습니다. `aria-modal`만으로는 일부 스크린리더가 뒤 페이지를 읽기 때문에 `inert`를 1차 방어로 두고, 패널 빈 곳을 클릭해 포커스가 body로 빠진 경우를 위해 트랩에 분기를 넣었습니다. 닫힘 경로가 Esc, 배경, ×, 링크 이동, 뒤로 가기, 리사이즈까지 6가지인데, 모두 `isOpen`이 false가 되어 같은 effect cleanup을 거치도록 했습니다. 여기서 순서가 중요했습니다. 햄버거 버튼도 `#root` 안에 있어서 `inert`를 먼저 풀지 않으면 포커스가 돌아가지 않습니다. 헤드리스 Chrome 자동 확인에서 Tab, Shift+Tab을 각각 20번 눌러 드로어 밖으로 나간 횟수가 0이었습니다.

**예상 꼬리 질문**
- *스크린리더로 직접 확인했나요?* → 하지 않았습니다. 헤드리스 Chrome에서 `inert` 속성과 포커스 위치만 측정했습니다.
- *남은 문제는요?* → 창을 넓혀서 닫히면 햄버거가 CSS로 숨겨져 포커스가 body에 남습니다. 링크 이동으로 닫힐 때는 새 페이지에서 햄버거로 돌아가지 않는 편이 자연스럽습니다. 둘 다 후속 과제입니다.
- *`aria-controls`는요?* → 열린 동안에만 둡니다. 닫힌 상태에서는 드로어가 DOM에 없어서 없는 id를 가리키게 되기 때문입니다.
- *Header가 두 개 렌더되면요?* → 한쪽 cleanup이 다른 쪽의 `inert`를 풀 수 있습니다. 라우트당 Header가 하나라는 전제를 두었고, 리뷰에서 이 전제를 주석으로 남기라는 권고를 받았습니다.

### Q3. 드로어를 왜 포털로 렌더했나요?

**30초 답변**
헤더에 `transform: translateX(-50%)`와 스크롤 시 `backdrop-filter`가 있어서, 그 안의 `position: fixed` 요소는 뷰포트가 아니라 헤더 기준으로 배치됩니다. 드로어를 body로 포털해서 화면 전체를 덮게 했고, 덕분에 `#root`에 `inert`를 걸 수 있는 구조도 얻었습니다.

**1분 답변**
`transform`, `filter`, `backdrop-filter` 같은 속성이 있는 요소는 자손 fixed 요소의 기준 박스가 됩니다. 헤더는 가운데 정렬 때문에 항상 `transform`을 쓰고 있어서 헤더 안에 드로어를 두면 기준이 헤더가 됩니다. 헤더 CSS를 바꾸는 대신 `createPortal`로 body 아래에 렌더했습니다. 스타일도 `.site-header` 하위 선택자로 쓰면 적용되지 않으니 최상위 `.mobile-nav` 선택자로 쓰고 z-index를 헤더(1000)보다 높은 1100으로 뒀습니다. 이 결정은 설계 초안에는 없었고 구현하면서 추가한 뒤 설계 문서에 반영했습니다.

**예상 꼬리 질문**
- *포털이면 이벤트나 Context는요?* → React 포털은 DOM 위치만 바꾸고 React 트리 위치는 그대로라 Router Context를 그대로 씁니다. 드로어 안 `Link`가 동작하는 이유입니다.
- *헤더에서 transform을 빼면 되지 않나요?* → 헤더의 `transform`은 가운데 정렬(`left: 50%` + `translateX(-50%)`)에 쓰이고 있어서, 헤더 CSS는 그대로 두고 드로어 위치만 옮기는 쪽을 택했습니다. 다만 두 방법을 표로 비교한 기록은 없어서, "기존 헤더 동작을 건드리지 않는 쪽을 골랐다" 정도로 말합니다.

### Q4. 가장 까다로웠던 버그는 무엇이었나요?

**30초 답변**
`/enjoy/constructor` 같은 URL이 404가 아니라 오류 화면으로 가는 문제였습니다. 설정 객체를 `enjoyConfigs[category]`로 조회하면 프로토타입의 `Object` 함수가 나와서 판별을 통과했고, 그다음 `config.items`에서 TypeError가 났습니다. `Object.hasOwn`으로 판별하도록 바꿨습니다.

**1분 답변**
없는 카테고리는 404로 보내도록 고쳤는데, gap 분석에서 URL은 사용자가 마음대로 넣을 수 있으니 `constructor`, `__proto__` 같은 값을 넣어 보라는 지적이 있었습니다. 일반 객체를 조회 테이블로 쓰면 프로토타입 체인까지 조회되니, `enjoyConfigs['constructor']`가 truthy가 됩니다. 재밌는 건 이때도 흰 화면은 아니었다는 점입니다. 새로 만든 page ErrorBoundary가 받아서 헤더는 남았습니다. 그래도 사용자에게 필요한 답은 "없는 페이지"라서 `Object.hasOwn`으로 바꾸고, 상세 페이지는 두 설정 객체를 모두 판별했습니다. 이 규칙은 설계 문서에 "URL 파라미터를 객체 키로 쓸 때는 hasOwn"으로 남겼습니다. 자동 확인에서 세 가지 프로토타입 키 URL이 모두 404였습니다.

**예상 꼬리 질문**
- *`Map`을 쓰면 되지 않나요?* → 가능하지만 `enjoyConfigs`는 홈 섹션 등 여러 곳이 쓰는 데이터라 이번 범위에서는 구조를 바꾸지 않고 판별만 고쳤습니다.
- *어떻게 찾았나요?* → 제가 브라우저에서 발견한 게 아니라 설계 대비 분석 단계에서 지적된 것입니다. 다음부터는 URL 입력을 검증할 때 프로토타입 키를 처음부터 테스트 케이스에 넣겠습니다.

### Q5. 구현하지 않은 메뉴는 왜 숨기지 않고 "준비 중" 화면으로 보냈나요?

**30초 답변**
메뉴를 숨기면 기능이 생길 때 헤더 구조를 다시 바꿔야 하고, 사용자는 서비스에 어떤 기능이 올지 알 수 없습니다. 메뉴는 유지하고 "준비 중" 화면으로 연결해, 기능이 완성되면 라우트 element만 바꾸도록 했습니다.

**1분 답변**
사용자가 겪는 상황을 세 가지로 나눴습니다. 주소가 틀린 "없음"은 404, 기능이 아직 없는 "아직 없음"은 준비 중 화면, 코드 문제인 "오류"는 ErrorBoundary 화면입니다. 이걸 한 화면으로 뭉치면 사용자가 자기가 잘못한 건지 서비스 문제인지 구분할 수 없습니다. 목적지가 전혀 없는 푸터의 약관·문의 항목은 링크처럼 보이지만 반응이 없던 것을 일반 텍스트와 "준비 중" 배지로 바꿔 포커스 대상에서도 뺐습니다. 리뷰에서 이 텍스트 대비가 약 3.9:1로 AA 기준에 못 미친다는 지적을 받아 5.52:1로 올렸고, 준비 중 구분은 색이 아니라 배지 텍스트로 합니다. 다만 "준비 중"이 너무 많으면 사이트가 미완성처럼 보이는 위험이 있어서, 목적지가 있는 항목은 실제 라우트로 연결했습니다.

**예상 꼬리 질문**
- *`aria-disabled` 링크로 두면 안 되나요?* → 누를 수 없는 것을 포커스 순서에 남길 이유가 없어서 텍스트로 바꿨습니다.
- *반응 없는 링크를 모두 없앴나요?* → 이번 범위(Layout 안 페이지, 헤더·푸터·공지)에서는 0개입니다. 제외했던 로그인·회원가입·비밀번호 찾기 페이지에 13개가 남아 후속 과제로 등록했습니다. 처음 목표 문구는 "0개"였는데 Check 이후 범위를 조정한 것이라, 그 점도 문서에 남겼습니다.

### Q6. 컴포넌트는 어떻게 나눴고, 상태는 누가 가지고 있나요?

**30초 답변**
메뉴 데이터는 `navigation.js`에 두고 데스크톱 헤더와 모바일 드로어가 공유합니다. 드로어는 로그인 상태를 직접 읽지 않고 Header에서 props로 받아, 로그아웃 실패 알림 상태를 Header 한 곳에서만 관리합니다.

**1분 답변**
설계안 세 가지를 비교했습니다. 메뉴를 세 곳에 하드코딩하는 A, 모두 통합하는 B, 헤더와 드로어만 통합하는 C였고 C를 골랐습니다. 푸터는 구성이 달라 억지로 공유하지 않았습니다. 이전 작업에서 Header에 "로그아웃 실패 시 다시 시도" 알림을 만들어 두었는데, 드로어가 `useAuth`로 로그아웃을 따로 처리하면 이 알림 상태를 두 곳에서 관리해야 합니다. 그래서 Header가 `requestLogout`을 `onLogout`으로 넘기고 알림은 Header에만 있습니다. 또 없는 카테고리에서 404를 반환할 때 Hook 순서가 바뀌지 않도록, 판별하는 바깥 컴포넌트와 상태를 쓰는 본문 컴포넌트를 나눴습니다.

**예상 꼬리 질문**
- *경로가 바뀔 때 드로어를 닫는 건 effect로 했나요?* → 렌더 중에 이전 pathname과 비교해 바로 상태를 바꿨습니다. effect에서 `setState`하면 렌더가 한 번 더 일어나기 때문입니다.
- *서비스가 커지면 뭘 바꾸겠나요?* → `StatusPage.css`가 `pages/`에 있는데 공통 컴포넌트가 이를 import하고 있어 위치를 옮기고 싶습니다(리뷰 NH-5). 404·준비 중 화면에서 `document.title`도 바꾸지 않고 있어 추가할 계획입니다(NH-8).

### Q7. 다시 한다면 무엇을 다르게 하겠나요?

**30초 답변**
세 가지입니다. 로그인 상태가 필요한 확인을 백엔드 없이 할 수 있게 Mock을 준비하고, ErrorBoundary 복구처럼 코드를 고쳐야 확인되는 항목은 테스트로 만들고, 범위에서 뺀 페이지가 성공 기준에 어떤 영향을 주는지 계획 단계에서 먼저 확인하겠습니다.

**1분 답변**
자동 L2에서 측정 가능한 항목은 모두 통과했지만, 로그인 상태 드로어처럼 백엔드가 필요한 항목과 임시 throw가 필요한 ErrorBoundary 복구 항목은 확인하지 못했습니다. 특히 복구는 이 기능의 핵심인데 런타임 근거가 없다는 점이 아쉽습니다. 또 "반응 없는 링크 0개"를 목표로 잡았는데, 계획에서 제외한 로그인·회원가입 페이지의 링크 13개 때문에 Check 이후 기준을 조정해야 했습니다. 제외 항목과 성공 기준이 부딪히는지 계획 단계에서 봤어야 합니다. 마지막으로 자동 L2 중에 `/enjoy` 콜라주가 일부 폭에서 잘리는 문제를 발견했는데, 이번 작업 이전 커밋과 값이 같아 기존 문제로 판단하고 후속으로 미뤘습니다. 초기 진단 때 기존 문제 목록을 만들어 두면 신규 회귀와 기존 문제를 더 쉽게 구분할 수 있습니다.

**예상 꼬리 질문**
- *왜 테스트 도구를 바로 도입하지 않았나요?* → 새 의존성이 필요해 사용자 확인이 필요한 별도 과제로 뒀습니다.

---

## 6. README용 요약

```md
### 앱 안전망 (app-safety-net)

- ErrorBoundary를 페이지 영역과 최상위 두 곳에 둡니다. 페이지 렌더 오류는 본문만 대체해 헤더·푸터가 남고,
  `location.key`가 바뀌면(다른 메뉴로 이동) 오류 상태가 초기화됩니다. 새 의존성 없이 class 컴포넌트로 구현했습니다.
- "페이지 없음"(404), "기능 준비 중", "오류"를 서로 다른 공통 화면으로 안내합니다.
- URL 파라미터를 설정 객체 키로 쓸 때는 `Object.hasOwn`으로 판별해 프로토타입 키(`constructor` 등)도 404로 보냅니다.
- 760px 이하에서는 햄버거 버튼과 body 포털 드로어로 메뉴에 접근합니다.
  열린 동안 `#root`에 `inert`를 걸고 포커스 트랩·스크롤 잠금을 적용하며, 6가지 닫힘 경로는 하나의 cleanup에서 해제합니다.
- 데스크톱 헤더와 모바일 드로어는 `data/navigation.js`의 메뉴 데이터를 공유합니다.
```

---

## 7. 알려진 한계와 개선 계획

| 항목 | 알고 있는 한계 | 개선 계획 |
|------|----------------|-----------|
| **L2 미확인 (#11, #11-1)** | ErrorBoundary가 실제 throw 뒤 복구되는지 런타임 확인이 없다. | 임시 throw 시나리오를 사용자 L2로 확인하고, 반복 가능한 테스트로 남기는 방법을 검토한다(새 의존성은 사용자 확인 필요). |
| **L2 미확인 (#3, #9 ~ #9-3, G-02)** | 로그인 상태 드로어, 드로어 로그아웃, 로그아웃 실패 알림, 복원 중 빈 자리를 런타임으로 확인하지 못했다. 백엔드 서버가 필요하다. | 백엔드 준비 후 사용자 L2. 장기적으로는 Mock/test 프로필로 프론트 단독 확인이 가능하게 한다(보고서 7.3). |
| **G-05 / NH-1 포커스** | 리사이즈로 닫히면 포커스가 `BODY`에 남고, 링크 이동으로 닫힐 때도 햄버거로 복귀한다. | 닫힘 원인에 따라 복귀 여부를 나눈다. |
| **렌더 오류만 처리** | 이벤트·비동기 오류는 ErrorBoundary 대상이 아니다. | 비동기 오류 UX는 각 화면의 오류 상태로 처리하는 방향을 후속으로 정리한다(계획 5장). |
| **NH-3 app 경계 복구** | 최상위 오류는 새로고침으로만 복구된다. | 한계로 기록. |
| **NH-4 콘솔 중복** | 개발 모드에서 오류가 콘솔에 두 번 찍힌다. | 후속. |
| **NH-5 파일 위치** | 공통 컴포넌트 `ErrorBoundary`가 `pages/StatusPage.css`를 import한다. | 공통 스타일 위치로 옮긴다. |
| **NH-8 문서 제목** | 404·준비 중 화면에서 `document.title`이 바뀌지 않는다. | 화면별 제목을 설정한다. |
| **inert 단일 인스턴스 전제** | Header가 라우트당 하나라는 전제에 의존한다. | 전제를 주석으로 명시한다(재리뷰 Nice). |
| **제외 페이지 링크 13개** | 로그인·회원가입·비밀번호 찾기에 반응 없는 `href="#"`가 남았다. | 후속-1. |
| **`TravelEnjoyPage` `#more` 기본값 (G-09)** | 지금 렌더되는 곳은 없지만 잠재 코드로 남았다. | `DestinationsPage`와 같은 `moreTo` 방식으로 정리한다. |
| **범위 밖 관찰** | `EnjoyCategoryPage` 탭 전환 시 상태 유지, 핸들러 없는 버튼(상세 페이지 전화 문의 등), `/enjoy` 콜라주 잘림(761 ~ 약 800px, 1101 ~ 약 1266px, 기존 문제). | 각각 후속 과제로 등록. |

---

## Portfolio Value

| 분류 | 자료 |
|------|------|
| README material | 6장 요약 |
| Portfolio project description | 1장 문단 |
| Troubleshooting story | 4.1 드로어 포커스 누수와 inert 해제 순서, 4.2 프로토타입 키 URL |
| Technical decision | 3.1 ~ 3.9 |
| Interview Q&A | 5장 Q1 ~ Q7 |
| Resume bullet | 2장 |

## Interview Topics

- React: class 컴포넌트 오류 경계(`getDerivedStateFromError`, `getDerivedStateFromProps`, `componentDidCatch`), 경계 배치, 렌더 중 상태 조정, Hook 순서를 지키는 컴포넌트 분리, `createPortal`, `useId`
- 라우팅: `location.key` vs `pathname`, `*` 라우트 매칭 우선순위, Layout 라우트
- 접근성: `inert`, 포커스 트랩, `aria-modal`, 조건부 `aria-controls`, `aria-current`, Label in Name(WCAG 2.5.3), 명도 대비(WCAG AA), 색에만 의존하지 않는 상태 표시, `prefers-reduced-motion`
- CSS: `transform`·`backdrop-filter`가 fixed 기준을 바꾸는 문제, 반응형 헤더 배치(320px)
- JavaScript: 프로토타입 체인과 `Object.hasOwn`
- UX: 404 / 준비 중 / 오류 구분, 미구현 메뉴를 숨기지 않는 결정
- 협업 프로세스: 리뷰 조건부 머지 → Act-1 → 재리뷰, 성공 기준 범위 조정을 문서에 남긴 것

## Follow-up Tasks

- 7장 개선 계획 참고. 보고서 8.3 기준 다음 기능은 상세 페이지 fallback(MF-4)이며, 이번에 만든 `NotFoundPage`의 `title`·`description` props를 재사용한다.
