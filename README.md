# WayLog

WayLog는 국내 여행지를 탐색하고 기록하는 서비스입니다. 이 저장소는 백엔드(Spring Boot)와 프론트엔드(React)를 하나의 모노레포로 관리합니다.

```
waylog/
├── backend/    Spring Boot 4 (Java 17) REST API
└── frontend/   React 19 + Vite 웹 클라이언트
```

## Backend (`backend/`)

Spring Boot 4 / Java 17 / Spring Data JPA / Spring Security 기반 REST API입니다.

```bash
cd backend
./mvnw clean test   # 테스트 실행
./mvnw spring-boot:run   # 로컬 실행
```

실행 시 아래 환경변수가 필요합니다 (`src/main/resources/application.yaml` 참고):

- `JWT_SECRET` — JWT 서명에 사용할 비밀키 (Base64 인코딩된 값을 새로 발급해 사용하세요)
- `DB_URL`, `DB_USER`, `DB_PW` — MySQL 접속 정보
- `MAIL_USERNAME`, `MAIL_PW` — 이메일 인증 발송용 SMTP 계정
- `TOUR_API` — 한국관광공사 TourAPI 서비스키
- `FRONTEND_ORIGEN` — CORS 허용 오리진 (프론트엔드 주소)
- `STORAGE_TYPE`, `S3_BUCKET`, `AWS_REGION` — 게시글 이미지 저장에 사용하는 S3 설정
- `SERVER_PORT` — 서버 포트

테스트는 `application-test.yaml`의 H2 인메모리 DB와 더미 값을 사용하므로 별도 환경변수 없이 `./mvnw clean test`로 바로 실행할 수 있습니다.

## Frontend (`frontend/`)

React 19 + Vite + react-router-dom 기반 SPA입니다.

```bash
cd frontend
npm install
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
npm run lint    # ESLint 검사
```

## 이번 재구축 범위

기존 기능·화면·디자인은 그대로 유지하면서 구조·보안·코드 품질을 개선했습니다. 새로운 기능 추가나 mock 데이터의 실제 API 연동은 이번 작업 범위에 포함되지 않습니다.

### Backend
- 아무 데서도 참조되지 않던 빈 엔티티/레포지토리/컨트롤러 스텁을 삭제했습니다.
- `user` 관련 클래스(엔티티, 레포지토리, 컨트롤러, 서비스, DTO)를 `user/` 기능 패키지로 재구성했습니다.
- `UserEntity`를 `@Data` + snake_case 필드에서 `@Getter` + camelCase 필드로 통일하고, board 패키지의 `Post`/`PostImage`/`Comment` 엔티티도 동일한 스타일(`@Getter` + 명시적 생성자/메서드)로 정리했습니다.
- **보안**: JWT 시크릿을 소스에 하드코딩하지 않고 `JWT_SECRET` 환경변수로 분리했습니다. **저장소에 노출되었던 기존 시크릿 값은 폐기되었으므로 운영 환경에서는 새 값을 발급해 사용해야 합니다.**
- **보안**: 이메일 인증코드를 `HttpSession`에 저장하던 방식을 Caffeine 캐시(만료시간 기반)로 교체했습니다.
- **보안**: 프론트엔드 주소를 하드코딩한 컨트롤러별 `@CrossOrigin`을 제거하고, 전역 `WebConfig`의 CORS 설정만 사용하도록 정리했습니다.
- 미사용 `spring-security-jwt`(레거시), `spring-security-oauth2-client`(미완성 카카오 로그인 스캐폴딩) 의존성과 관련 설정을 제거했습니다.
- 빌드 산출물(`target/`)을 `.gitignore`에 추가하고 git 추적에서 제외했습니다.

### Frontend
- `node_modules/`, `dist/` 등 빌드 산출물을 `.gitignore`에 추가하고 git 추적에서 제외했습니다.
- `window.location.pathname` 기반 분기 처리를 `react-router-dom`의 `Routes`/`Route` 구조로 전환했습니다.
- 로그인 상태를 `AuthContext`로 통일했습니다. (기존에는 로그인 시 `sessionStorage`에 `member` 키로 저장하고 헤더는 `waylogMember` 키를 읽어, 로그인해도 헤더가 갱신되지 않는 버그가 있었습니다.)
- 페이지마다 중복 렌더링되던 `Header`/`Footer`를 공용 `Layout` 컴포넌트로 통합했습니다.
- 완전히 동일한 로직의 `TravelSearchModal`/`EnjoySearchModal`을 공용 `SearchModal` 컴포넌트 기반으로 통합했습니다.
- 공용 `apiClient`(`src/api/client.js`)를 도입해 페이지마다 중복되던 raw `fetch` 호출을 정리했습니다.
- 어디서도 사용되지 않던 `EditorPickSection` 컴포넌트를 삭제했습니다.
