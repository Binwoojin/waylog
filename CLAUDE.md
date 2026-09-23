# WayLog Project Direction

WayLog is being developed primarily as a frontend developer portfolio project.

The main goal is not to maximize the number of features.

The main goal is to demonstrate strong frontend engineering through:

- React architecture
- component design
- state management
- API integration
- UI/UX
- responsive design
- asynchronous UI
- maintainability
- frontend troubleshooting

## Priority Order

When deciding what to improve, use this priority:

1. Broken or incomplete core functionality
2. Frontend architecture
3. User experience
4. API integration stability
5. Responsive design
6. Code maintainability
7. Accessibility
8. Performance
9. Additional features

Do not add unnecessary features before improving existing core flows.

## Agent Workflow

Use frontend-lead as the primary development agent.

Use frontend-support-backend only when backend/API work is necessary for frontend development.

After meaningful frontend changes, use frontend-code-reviewer.

After completing a meaningful feature, refactor, or troubleshooting task,
use frontend-interview-coach to extract portfolio and interview material.

Preferred workflow:

Frontend analysis
→ Implementation
→ Code review
→ Important fixes
→ Interview/portfolio extraction

## bkit 협업 규칙

- 의미 있는 기능 개선은 bkit PDCA로 계획·설계·검증·보고한다.
- 주 구현 담당은 frontend-lead다.
- 백엔드 변경이 필요할 때만 frontend-support-backend를 사용한다.
- 구현 후 frontend-code-reviewer의 코드 리뷰와
  bkit의 설계 대비 gap 분석을 모두 수행한다.
- 발견된 문제의 수정은 기본적으로 frontend-lead가 담당한다.
- 동일 파일을 여러 구현 에이전트가 동시에 수정하지 않는다.
- 완료 보고서 작성 후 frontend-interview-coach로
  실제 작업에 근거한 포트폴리오 자료를 추출한다.
- 작은 문구·스타일 수정에는 전체 PDCA 문서화를 요구하지 않는다.