# PR #1 비교 결과와 후속 과제

> **비교 대상**: PR #1 (`WayLog_ClaudeCode` → `main`, 34개 파일, 커밋 4개) ↔ `WayLog_Renewal`
> **기준**: 커밋 해시가 아니라 기능과 코드. 해시가 달라도 같은 기능이 있으면 누락으로 보지 않았다.
> **상태**: PR #1은 열려 있다. 병합, 종료, 브랜치 삭제는 하지 않았다.

---

## 1. 비교 방법

- 두 브랜치의 공통 조상은 `9b652a7`이다. `WayLog_Renewal`은 그 이후 42개 커밋으로 갈라졌고, 전체 diff는 429개 파일이라 전체 비교는 의미가 없었다.
- PR #1이 실제로 바꾼 34개 파일을 기준으로 기능을 나눠 확인했다. 파일별 내용은 리뉴얼 구조가 달라서 대부분 다르다. 그래서 각 기능이 리뉴얼에 있는지를 코드 위치와 테스트로 확인했다.
- `main`은 PR 브랜치의 조상이라 뒤처진 상태가 아니다. PR 브랜치에만 있는 커밋은 4개다.

## 2. 기능별 판정

| PR #1 기능 (커밋) | 리뉴얼 상태 | 근거 |
|---|---|---|
| 중복 확인 API 익명 허용 (`a040915`) | 있음 | `SecurityConfig` GET permitAll, `UserController` `users/check-email`·`check-nickname` |
| `checkEmail` 응답 필드 수정 (`88503e3`) | 있음 | `SignupPage.jsx`의 `typeof data.available !== 'boolean'` 검사 |
| 로그인 토큰 저장, 401 재발급, 서버 로그아웃 (`a040915`) | 있음 | `client.js`의 `refreshPromise`, `authApi.logout` |
| 비밀번호 찾기 실제 API 흐름 (`67ff87d`) | 있음 | `ForgotPasswordPage`가 실 API 3단계 사용 |
| 상세 페이지 목업 대체 제거 (`67ff87d`) | 있음 | 리뉴얼에서 `allDestinationMocks`, `destinationItems` 참조 0건 |
| 피드·댓글 핵심 기능 (`84e77f1`) | 있음 (구조 변경) | PR의 별도 작성 페이지는 리뉴얼에서 작성 모달로 대체됨. 실서버 검증 S4 통과 |
| 404 페이지, 마이페이지·북마크 라우트 | 있음 | `App.jsx`의 `/mypage`, `/bookmarks`, `NotFoundPage` |
| **가입 시 서버 중복 검사 (`a040915`)** | **없었음 → `3ae69f1`에서 반영** | 가입 요청이 직접 호출되면 중복 계정을 만들 수 있었다 |
| 이메일·닉네임 DB 유니크 제약 (`a040915`) | **반영 안 함, 후속 과제 (P1)** | 아래 3장 |
| 인증 티켓 용도 구분 (`a040915`) | **반영 안 함, 후속 과제 (P1)** | 아래 4장. 테스트로 현재 정책을 확인함 |

## 3. DB 유니크 제약 (후속 과제, 우선순위 P1)

- **문제**: `UserEntity`의 `EMAIL`, `NICKNAME`은 `nullable = false`만 있고 유니크 제약이 없다. 서버 중복 검사는 요청 처리 순서에 의존하므로, 두 가입 요청이 동시에 들어오면 둘 다 검사를 통과해 같은 이메일이나 닉네임이 두 번 저장될 수 있다.
- **이번에 한 것**: 읽기 전용 점검 SQL(`backend/db/checks/readonly-precheck.sql`) 8장에 중복 행 조회와 `users`의 현재 유니크 인덱스 조회를 추가했다. 운영 DB는 변경하지 않았다.
- **유니크 제약을 추가하기 전 필요한 것**
  1. 운영 DB에서 8장의 중복 조회가 0행인지 확인한다. 행이 나오면 중복 행을 먼저 정리한다.
  2. 마이그레이션 SQL을 만든다(`ALTER TABLE users ADD UNIQUE ...`). `ddl-auto: none`이므로 수동 적용이다.
  3. 중복으로 유니크 위반이 나면 `DataIntegrityViolationException`이 기존 핸들러에서 어떤 상태로 바뀌는지 확인하고, 가입 응답을 중복 메시지로 맞춘다.
  4. 동시 가입 테스트를 추가해 두 요청 중 하나만 성공하는지 확인한다.
- **이유**: 서버 검사만으로는 동시성을 막을 수 없다. 정합성은 DB 제약이 마지막 방어선이다.

## 4. 인증 티켓 용도 구분 (후속 과제, 우선순위 P1)

### 4.1 확인된 현재 정책 (코드)

| 단계 | 구현 위치 | 용도 확인 |
|---|---|---|
| 인증번호 발급 | `AuthController`의 `/email-verification`, `/password-reset-requests` → 둘 다 `sendCodeToEmail(email)` | 없음. 같은 캐시(`email → 코드`)에 저장 |
| 인증번호 확인 | `emailVerificationConfirm` | 없음. 맞으면 티켓 발급, 실패 횟수는 세지 않음 |
| 티켓 소모 | `signup`, `changePassword` 모두 `consumeVerificationTicket` | 없음. 같은 티켓을 두 흐름이 모두 받음 |
| 계정 존재 확인 | 가입은 발급 단계에서 확인하지 않음. 비밀번호 변경은 최종 단계에서 `findByEmail` | — |

### 4.2 테스트로 확인한 결과 (`TicketPurposeHttpFlowTest`, 3개 통과)

| 테스트 | 확인한 것 | 결과 |
|---|---|---|
| A. `signupIssuedCodeCanChangePasswordOfExistingAccount` | 가입용 인증번호로 얻은 티켓으로 **기존 계정의 비밀번호를 바꿀 수 있는가** | **가능** (현재 정책) |
| B. `resetIssuedCodeCanCompleteSignupForUnregisteredEmail` | 재설정용 인증번호로 얻은 티켓으로 **계정이 없는 이메일에 가입할 수 있는가** | **가능** (현재 정책) |
| C. `ticketIssuedForOneEmailIsRejectedForAnother` | 티켓을 발급받은 이메일과 다른 이메일에 쓸 수 있는가 | **거부** (이메일 바인딩은 있음) |

A와 B는 현재 정책을 기록하는 테스트다. 용도 구분을 구현하면 A와 B는 거부로 기대값을 바꿔야 한다.

### 4.3 위험에 대한 결론

- **확정할 수 있는 것**: 가입용 인증번호로 얻은 티켓이 기존 계정의 비밀번호 변경에 쓰인다(A). 이 조합은 현재 코드에서 실제로 성립한다.
- **아직 확정하지 않는 것**: 실제 악용 가능성. A를 악용하려면 공격자가 피해자의 메일로 간 인증번호를 얻어야 한다. 예를 들어 "가입 인증번호"라고 속이는 피싱이 가능한 조건이다. 이 조건을 막는 장치는 현재 없다.
- **함께 확인된 별도 사실**
  - 인증번호 생성에 `java.util.Random`을 쓴다(`AuthService`의 `sendCodeToEmail`). 보안용 난수가 아니다.
  - 확인 실패 횟수를 세지 않는다. 인증번호 확인 요청을 제한하는 장치가 없다.
  - 인증번호는 3분(`auth-code-expiration-millis: 180000`) 동안만 유효하다.
- **그래서**: "위험이 낮다"는 결론은 내리지 않는다. 용도 구분을 권장한다. 실제 위험도는 피싱 조건과 횟수 제한까지 함께 검토해야 한다.

### 4.4 용도 구분을 구현할 때의 변경 범위

| 영역 | 변경 |
|---|---|
| 백엔드 `MailRequest` | `purpose` 필드 추가. 허용값은 `SIGNUP`, `RESET_PASSWORD` |
| 백엔드 `AuthService.sendCodeToEmail` | 용도를 인자로 받아 코드와 함께 저장 |
| 백엔드 `emailVerificationConfirm` | 용도를 티켓 값에 함께 저장 |
| 백엔드 `consumeVerificationTicket` | 호출하는 흐름의 용도와 티켓 용도가 같을 때만 소모 |
| 백엔드 `AuthController` | `/email-verification`은 `SIGNUP`, `/password-reset-requests`는 `RESET_PASSWORD`를 전달 |
| 프론트 `ForgotPasswordPage` | 발급·확인 요청에 `purpose: 'RESET_PASSWORD'` 추가. 현재 용도를 보내지 않는다 |
| 프론트 `SignupPage` | 이미 `purpose: 'SIGNUP'`을 보내므로 변경 없음. 서버가 읽도록만 바뀐다 |
| 테스트 | A·B를 거부 기대로 바꾼다. 같은 용도 흐름의 성공 테스트를 추가한다. C는 유지한다 |

## 5. 기타 후속 과제

- 인증번호 생성을 보안용 난수로 바꾼다.
- 인증번호 확인 실패 횟수를 세고, 일정 횟수 이후 해당 코드를 무효화한다.
- 기존 후속 과제(`docs/development/waylog-renewal.md` 0.4절)의 미해결 항목은 그대로 유지한다.

## 6. PR #1 종료 판단

- 기능 기준으로 PR #1의 변경은 리뉴얼에 있거나, `3ae69f1`로 반영했다.
- 남은 차이는 DB 유니크 제약과 인증 티켓 용도 구분 두 가지다. 둘 다 후속 과제로 기록했다.
- PR #1을 닫으려면 위 두 과제를 리뉴얼에서 처리하거나, 과제로 옮겼다는 사실을 PR 댓글로 남기는 것이 필요하다. 이 문서 작성 시점에는 PR을 닫지 않았다.
