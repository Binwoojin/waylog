# app-safety-net 계획 문서

> **요약**: 흰 화면·크래시·반응 없는 링크를 없애는 앱 안전망(404, ErrorBoundary, 준비 중 화면)을 만들고, 모바일 헤더 메뉴를 추가한다.
>
> **프로젝트**: WayLog (React + Spring Boot 국내 여행 SNS)
> **버전**: frontend 0.0.0
> **작성자**: WOOJIN (Claude Code 보조)
> **작성일**: 2026-09-23
> **상태**: Draft
> **출처**: Must Fix 점검(2026-09-23, frontend-lead) MF-N1, MF-5, MF-6 / `docs/development/waylog-renewal.md` 3장 Must Fix 5·6

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **문제** | 로그인 후 회원 메뉴(북마크·마이페이지), 없는 경로, 잘못된 카테고리 URL에서 헤더도 없는 흰 화면이나 앱 전체 크래시가 난다. 헤더·푸터·공지의 여러 링크는 눌러도 반응이 없고, 760px 이하에서는 헤더 메뉴가 사라져 다른 섹션으로 이동할 방법이 없다. |
| **해결** | 페이지 영역 ErrorBoundary + 최상위 ErrorBoundary, Layout 안의 404 라우트, 공통 "준비 중" 페이지를 만든다. 미구현 메뉴와 목적지 없는 링크는 "준비 중"으로 연결하거나 표시한다. 모바일에는 햄버거 버튼과 드로어 메뉴를 추가한다. |
| **기능/UX 효과** | 어떤 URL·오류에서도 헤더와 돌아갈 길이 남는다. 사용자는 기능이 없다는 사실을 명확히 안내받고, 모바일에서도 모든 주요 메뉴에 접근할 수 있다. |
| **핵심 가치** | 로그인 직후 가장 먼저 보이는 결함을 없애고, 이후 상세 페이지(MF-4) not-found 처리와 신규 기능 화면이 재사용할 공통 컴포넌트를 마련한다. ErrorBoundary 범위 설계와 접근성 있는 드로어는 면접에서 설명 가능한 포인트다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 흰 화면·크래시·반응 없는 링크·모바일 메뉴 부재로 사용자가 길을 잃고, 로그인 직후 결함이 바로 보인다 |
| **WHO** | 모든 WayLog 방문자 (특히 로그인 사용자, 모바일 사용자) |
| **RISK** | ErrorBoundary가 오류 후 복구되지 않음, 404 라우트가 기존 라우트를 가림, 드로어 접근성·스크롤 잠금 문제, 홈(Layout 밖)과 Layout 페이지의 헤더 동작 차이 |
| **SUCCESS** | 없는 경로·미구현 메뉴·잘못된 카테고리에서 헤더가 있는 안내 화면 / 렌더 오류 시 페이지 영역만 대체되고 이동하면 복구 / 반응 없는 링크 0개 / 760px 이하에서 모든 주요 메뉴 접근 |
| **SCOPE** | 공통 컴포넌트(ErrorBoundary, NotFound, ComingSoon) → App 라우트 → EnjoyDetail 방어 → Header·Footer·NoticeSection 링크 → Header 모바일 메뉴 |

---

## 1. 개요

### 1.1 목적

어떤 경로와 오류 상황에서도 사용자가 흰 화면을 보지 않고, 헤더를 통해 다른 곳으로 이동할 수 있게 한다.

### 1.2 배경

- `App.jsx`에 `path="*"` 라우트가 없고, `frontend/src` 전체에 ErrorBoundary가 없다.
- 인증 흐름(auth-token-flow)이 완성되면서 회원 메뉴의 `/bookmarks`, `/mypage` 링크가 사용자에게 노출됐지만 대응 라우트가 없다(MF-N1).
- `EnjoyDetailPage.jsx:27`의 `categoryFacts[category].map`이 없는 카테고리에서 크래시한다.
- `Header.jsx:85` `/#feed`, `Footer.jsx`의 `#feed`·`#notice`·`#faq`·`#contact`·`#terms`·`#privacy`·`#location`, `NoticeSection.jsx`의 `#notice`는 대상이 없다.
- `Header.css`에서 760px 이하일 때 `.site-header__nav`를 숨기고 대체 메뉴가 없다(MF-6).
- 홈(`/`)은 Layout 밖에서 `HeroSection`이 `Header`를 직접 렌더링한다. 로그인·회원가입·비밀번호 찾기도 Layout 밖이다.

### 1.3 관련 문서

- 진단: `docs/development/waylog-renewal.md` 3장
- 선행 기능: `docs/04-report/features/auth-token-flow.report.md`
- 작업 규칙: `CLAUDE.md`

---

## 2. 범위

### 2.1 포함

- [ ] 페이지 영역 ErrorBoundary (Layout의 Outlet 감쌈, 라우트 이동 시 자동 복구) + 최상위 ErrorBoundary
- [ ] Layout 안의 404(NotFound) 라우트 `path="*"`
- [ ] 공통 "준비 중"(ComingSoon) 페이지: `/bookmarks`, `/mypage`, 피드 등 미구현 목적지
- [ ] `EnjoyDetailPage`, `EnjoyCategoryPage`의 없는 카테고리 처리 (크래시 대신 NotFound)
- [ ] 반응 없는 링크 정리: 목적지가 있으면 실제 라우트, 없으면 "준비 중" 페이지 또는 비활성 + "준비 중" 표시
- [ ] 760px 이하 햄버거 버튼 + 드로어 메뉴 (홈과 Layout 페이지 모두)

### 2.2 제외

- 상세 페이지의 잘못된 fallback(MF-4) → 다음 묶음. 단, 이번에 만든 NotFound를 재사용할 수 있게 설계
- 북마크·마이페이지·피드·공지·약관 등 실제 기능 구현
- 오류 수집 서비스(Sentry 등) 연동
- SPA 라우팅 전환(`window.location.href`, `<a href>` 전체 새로고침) → Should Improve
- 로그인·회원가입 페이지의 레이아웃 변경

---

## 3. 요구사항

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 담당 | 상태 |
|----|----------|----------|------|------|
| FR-01 | Layout 안의 페이지에서 렌더 오류가 나면 헤더·푸터는 유지하고 본문만 오류 화면으로 대체. 다시 시도·홈으로 이동 수단 제공 | High | frontend-lead | Pending |
| FR-02 | 페이지 영역 ErrorBoundary는 라우트가 바뀌면 오류 상태를 초기화 | High | frontend-lead | Pending |
| FR-03 | Layout 밖(홈, 로그인 등)이나 헤더 자체의 렌더 오류는 최상위 ErrorBoundary가 받아 전체 오류 화면 표시 | High | frontend-lead | Pending |
| FR-04 | 정의되지 않은 경로는 헤더·푸터가 있는 404 화면 (홈·여행지·여행 즐기기로 가는 링크) | High | frontend-lead | Pending |
| FR-05 | `/bookmarks`, `/mypage`는 헤더·푸터가 있는 "준비 중" 화면 (기능명 표시, 로그인 여부와 무관하게 흰 화면 없음) | High | frontend-lead | Pending |
| FR-06 | 없는 카테고리의 `/enjoy/:category`, `/enjoy/:category/:id`는 크래시 없이 404 화면 | High | frontend-lead | Pending |
| FR-07 | 헤더·푸터·공지 섹션에 대상 없는 링크가 없음. 목적지 있는 항목은 실제 라우트, 없는 항목은 "준비 중" 페이지 또는 비활성 + "준비 중" 표시 | Medium | frontend-lead | Pending |
| FR-08 | 760px 이하에서 햄버거 버튼으로 주요 메뉴(여행지, 여행 즐기기, 여행 피드)와 로그인/회원 메뉴에 접근 | High | frontend-lead | Pending |
| FR-09 | 드로어는 `aria-expanded`·`aria-controls`, Esc·바깥 클릭·라우트 이동 시 닫힘, 열린 동안 배경 스크롤 잠금, 닫히면 버튼으로 포커스 복귀 | Medium | frontend-lead | Pending |

### 3.2 비기능 요구사항

| 분류 | 기준 | 확인 방법 |
|------|------|-----------|
| 호환성 | 기존 라우트 14개와 홈·로그인·회원가입 동작 변화 없음 | 라우트 목록 대조, 브라우저 확인 |
| 접근성 | 드로어·오류 화면 키보드 조작 가능, 스크린리더 레이블 | 코드 리뷰, 키보드 확인 |
| 유지보수 | 404·준비 중·오류 화면이 공통 컴포넌트 하나씩으로 재사용 가능 (MF-4에서 재사용) | 코드 구조 확인 |
| 의존성 | 새 의존성 추가 없음 (react-error-boundary 등 미사용) | package.json |

---

## 4. 성공 기준

### 4.1 완료 조건

- [ ] FR-01 ~ FR-09 구현
- [ ] 프론트 build 성공, lint 오류 0
- [ ] frontend-code-reviewer 리뷰 Must Fix 0건
- [ ] bkit gap 분석 Match Rate 90% 이상
- [ ] 브라우저 확인: 없는 경로, `/bookmarks`, `/mypage`, `/enjoy/abc/x`, 모든 헤더·푸터 링크, 760px 이하 메뉴 (항목별 기록)

### 4.2 품질 기준

- [ ] 반응 없는 `href="#..."` 링크 0개 (grep 확인) — **범위 조정(2026-09-23, Check 이후)**: Layout 안 페이지와 헤더·푸터·공지 기준. 계획 2.2에서 제외한 로그인·회원가입·비밀번호 찾기의 약관·고객센터 링크 13개는 후속 과제로 등록한다. `/destinations` "더보기" 4개는 Act-1에서 실제 라우트로 연결한다.
- [ ] 기존 라우트 회귀 없음

---

## 5. 위험과 대응

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| ErrorBoundary가 오류 상태에 머물러 다른 페이지로 가도 복구되지 않음 | High | Medium | 라우트 `location.key` 또는 pathname을 reset 키로 사용 |
| 이벤트 핸들러·비동기 오류는 ErrorBoundary가 잡지 못함 | Medium | High | 범위를 "렌더 오류"로 명시. 비동기 오류 UX는 후속 과제 |
| `path="*"`가 Layout 밖 라우트(`/login` 등)를 가림 | High | Low | 명시 라우트가 우선하는 React Router 규칙 확인, 라우트 목록 대조 |
| 드로어가 홈(투명 헤더)과 Layout(흰 헤더)에서 다르게 보임 | Medium | Medium | 두 헤더 모드에서 확인 |
| 드로어 스크롤 잠금이 닫힌 뒤 해제되지 않음 | Medium | Low | cleanup에서 해제, 라우트 이동 시 닫힘 |
| "준비 중" 표시가 과도해 사이트가 미완성으로 보임 | Low | Medium | 기능이 있는 항목은 실제 라우트로 연결해 "준비 중"을 최소화 |

---

## 6. 영향 분석

### 6.1 변경 자원

| 자원 | 유형 | 변경 내용 |
|------|------|-----------|
| `App.jsx` | 라우트 | 최상위 ErrorBoundary, `/bookmarks`·`/mypage`·`*` 라우트 |
| `components/layout/Layout.jsx` | 레이아웃 | Outlet을 페이지 영역 ErrorBoundary로 감쌈 |
| (신규) ErrorBoundary, NotFound, ComingSoon | 공통 컴포넌트 | 위치·이름은 설계에서 결정 |
| `pages/EnjoyDetailPage.jsx`, `EnjoyCategoryPage.jsx` | 화면 | 없는 카테고리 처리 |
| `components/layout/Header.jsx`, `Header.css` | 화면 | 피드 링크, 모바일 햄버거·드로어 |
| `components/layout/Footer.jsx` | 화면 | 링크 정리 |
| `components/home/NoticeSection.jsx` | 화면 | 공지 링크 정리 |

### 6.2 현재 사용처

| 자원 | 사용처 | 영향 |
|------|--------|------|
| `Header` | `Layout.jsx`(forceLight), `HeroSection.jsx:34`(홈, 투명 헤더) | 모바일 메뉴가 두 모드에서 동작해야 함 |
| `Header` 회원 메뉴 | 로그인 상태, auth-token-flow의 R-3 placeholder·R-4 로그아웃 실패 알림 | 드로어 안에서도 같은 상태 표시·로그아웃 동작 유지 |
| `Layout` | `/enjoy*`, `/destinations*` 라우트 | Outlet 감싸기만 추가 |
| `Footer` | `Layout.jsx`, `App.jsx`의 HomePage | 링크 변경이 두 곳에 반영 |
| `enjoyConfigs` | `EnjoyCategoryPage`, `EnjoyDetailPage`, 홈 섹션 | 데이터 구조는 변경하지 않음 |

### 6.3 검증

- [ ] 위 사용처가 변경 후에도 정상 동작
- [ ] auth-token-flow의 헤더 동작(복원 중 placeholder, 로그아웃 실패 알림) 유지

---

## 7. 아키텍처 고려사항

### 7.1 프로젝트 수준

Dynamic (프론트 + 자체 백엔드). 이번 작업은 프론트만.

### 7.2 주요 결정

| 결정 | 선택지 | 선택 | 근거 |
|------|--------|------|------|
| MF-6 포함 여부 | 포함 / 다음 묶음 | 포함 | Header를 어차피 수정. 사용자 확인 (2026-09-23) |
| 미구현 회원 메뉴 | "준비 중" 페이지 / 메뉴 숨김 | "준비 중" 페이지 | 메뉴 구조 유지, 나중에 기능만 교체. 사용자 확인 |
| 대상 없는 링크 | "준비 중" 표시 / 제거 | "준비 중" 표시 | 화면 구성 유지, 기능 있는 항목은 실제 라우트. 사용자 확인 |
| ErrorBoundary 범위 | 페이지 영역 + 최상위 / 최상위만 | 페이지 영역 + 최상위 | 오류 시에도 헤더로 이동 가능, 라우트 이동으로 복구. 사용자 확인 |
| ErrorBoundary 구현 | 직접 class 컴포넌트 / react-error-boundary | 직접 구현 | 새 의존성 금지 원칙. 설명 가능성 |

### 7.3 작업 분담

```
frontend-lead          : 전체 구현 (백엔드 변경 없음)
        ↓
frontend-code-reviewer : 코드 리뷰 (frontend-audit)
bkit gap-detector      : 설계 대비 gap 분석
        ↓
frontend-lead          : 발견된 문제 수정
        ↓
report → frontend-interview-coach
```

---

## 8. 다음 단계

1. `/pdca design app-safety-net`: 설계안 3가지 비교 후 선택
2. 구현 (frontend-lead)
3. 리뷰 + gap 분석 → 수정 → 완료 보고서

---

## 버전 기록

| 버전 | 날짜 | 변경 | 작성자 |
|------|------|------|--------|
| 0.1 | 2026-09-23 | 초안, 4.2 성공 기준 범위 조정(Check 이후) | WOOJIN |
| 0.2 | 2026-09-24 | 3.2 기존 라우트 수 12개 → 14개 정정 (분석 G-10) | WOOJIN (Claude Code 보조) |
