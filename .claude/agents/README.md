# WayLog 프로젝트 전용 Agent

이 디렉터리는 WayLog 프로젝트에서만 쓰는 Claude Code 커스텀 서브에이전트를 관리합니다.
여기 있는 `.md` 파일은 Claude Code가 자동으로 인식하며, git으로 팀과 공유됩니다.

- 프로젝트 Agent: `.claude/agents/` (이 디렉터리, 커밋 대상)
- 개인 Agent: `~/.claude/agents/` (모든 프로젝트에서 사용, 커밋 안 됨)
- 이름이 같으면 프로젝트 Agent가 우선합니다.

## 파일 규칙

- 파일 하나에 Agent 하나: `<agent-name>.md`
- 파일명과 frontmatter의 `name`을 같게, 소문자 kebab-case로 작성 (예: `spring-api-reviewer.md`)
- 담당 영역이 드러나도록 접두어 사용을 권장합니다: `backend-*`, `frontend-*`, `db-*`, `qa-*`
- 이 `README.md`는 Agent 정의가 아니며 frontmatter가 없어 로드되지 않습니다.

## 파일 형식

```markdown
---
name: backend-api-reviewer
description: Spring Boot 백엔드(backend/) 변경 사항을 리뷰한다. 컨트롤러·서비스·보안 설정을 수정한 뒤 사용.
tools: Read, Grep, Glob, Bash
model: sonnet
---

여기에 Agent의 시스템 프롬프트를 작성합니다.
역할, 작업 범위(backend/ 또는 frontend/), 따라야 할 규칙, 결과 보고 형식을 적습니다.
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | O | Agent 식별자 (kebab-case) |
| `description` | O | 언제 이 Agent를 쓰는지. Claude가 자동 위임 여부를 판단하는 기준이므로 구체적으로 작성 |
| `tools` | X | 허용 도구 목록. 생략하면 모든 도구 상속. 리뷰 전용 Agent는 읽기 도구만 주는 것을 권장 |
| `model` | X | `sonnet`, `opus`, `haiku`, `fable` 또는 `inherit`. 생략 시 기본값 사용 |
| `skills` | X | 에이전트 시작 시 미리 불러올 스킬 목록 (`.claude/skills/<name>/SKILL.md`의 `name`) |

## 현재 에이전트와 스킬 구성

| 에이전트 | 역할 | 사용 스킬 | 도구 |
|----------|------|-----------|------|
| `frontend-lead` | 주 개발 에이전트 (분석·구현·리팩터링) | `frontend-audit`, `documentation` | 전체 |
| `frontend-code-reviewer` | 변경 후 독립 리뷰 (수정 안 함) | `frontend-audit` | Read, Grep, Glob, Bash |
| `frontend-interview-coach` | 포트폴리오·면접 자료 추출 | `portfolio-extraction`, `troubleshooting`, `documentation` | 전체 |
| `frontend-support-backend` | 프론트엔드에 필요한 API 작업만 담당 | `troubleshooting` | 전체 |

스킬은 `.claude/skills/<스킬명>/SKILL.md`에 있으며, 파일명은 반드시 `SKILL.md`이고 맨 위에 `name`/`description` 헤더가 있어야 합니다.
에이전트의 `skills` 필드에 적힌 스킬은 해당 에이전트가 실행될 때 미리 로드되고, 메인 대화에서도 `/스킬명`으로 직접 호출할 수 있습니다.

작업 흐름 (`CLAUDE.md`의 Agent Workflow와 동일):

```
frontend-lead (분석 → 구현)
  → frontend-code-reviewer (리뷰)
  → frontend-lead (중요 수정)
  → frontend-interview-coach (포트폴리오·면접 자료 추출)
```

## 프로젝트 구조 참고

Agent 프롬프트 작성 시 참고할 저장소 구조입니다.

- `backend/` — Spring Boot (Maven, `pom.xml`, Java 25)
- `frontend/` — Vite 기반 프론트엔드 (`package.json`)
- `docs/` — 설계·진단 문서

## 사용 방법

- 생성/편집: Claude Code에서 `/agents` 실행, 또는 이 디렉터리에 파일을 직접 추가
- 호출: "backend-api-reviewer 에이전트로 리뷰해줘"처럼 이름을 지정하거나, `description`에 맞는 작업이면 자동 위임
- 파일을 직접 추가·수정한 경우 새 세션에서 반영되며, `/agents`로 로드 여부를 확인할 수 있습니다.
