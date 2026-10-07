# 이메일 인증 정책 (인증번호·인증 티켓)

> **적용 범위**: `AuthService`, `VerificationLimiter`, `EmailVerificationPurpose`, `AuthController`
> **기준**: 이 문서의 수치는 코드 상수와 설정값과 같아야 한다. 값을 바꾸면 이 문서도 함께 고친다.

---

## 1. 용도 (EmailVerificationPurpose)

| 용도 | 쓰이는 흐름 | 발급 엔드포인트 | 티켓을 소모하는 엔드포인트 |
|---|---|---|---|
| `SIGNUP` | 회원가입 | `POST /auth/email-verification` | `POST /auth/signup` |
| `RESET_PASSWORD` | 비밀번호 재설정 | `POST /auth/password-reset-requests` | `PUT /auth/password` |

- 인증번호 확인 요청(`POST /auth/email-verification/confirm`)은 `purpose` 필드가 **필수**다. 없거나 알 수 없는 값이면 400으로 거부한다.
- 발급 용도는 발급 엔드포인트가 정한다. 클라이언트가 보낸 값으로 바꿀 수 없다.

## 2. 캐시 키

- 인증번호 캐시 키: `용도:이메일` (예: `SIGNUP:user@example.com`)
- 티켓 캐시 키: `용도:이메일`
- 같은 이메일이라도 용도가 다르면 키가 다르므로, 한 흐름의 발급이 다른 흐름의 인증번호나 티켓을 덮어쓰지 못한다.

## 3. 교차 사용 거부

- 가입용 티켓으로 비밀번호를 바꿀 수 없다. 재설정용 티켓으로 가입할 수 없다. (`TicketPurposeHttpFlowTest` A, B)
- 티켓은 발급받은 이메일에서만 쓸 수 있다. (`TicketPurposeHttpFlowTest` C)

## 4. 인증번호

| 항목 | 값 | 근거 |
|---|---|---|
| 생성 방식 | `SecureRandom`, 6자리 숫자 (100000–999999) | `AuthService.newCode` |
| 유효 시간 | 3분 (`spring.mail.auth-code-expiration-millis: 180000`) | `application.yaml` |
| 확인 실패 제한 | 인증번호 하나당 **5회**. 6회째부터는 맞아도 429 | `VerificationLimiter.MAX_FAILED_ATTEMPTS` |
| 확인 실패 응답 | 틀린 번호는 401, 제한 초과는 429 `인증 시도 횟수를 초과했습니다.` | `AuthService`, `GlobalExceptionHandler` |

## 5. 발송 제한

| 항목 | 값 | 설정 |
|---|---|---|
| 재발송 간격 | 같은 용도·이메일은 **60초**에 한 번 | `auth.send-cooldown-millis` (기본 60000, 0이면 끔) |
| 발송 횟수 | 같은 용도·이메일은 **1시간에 5회** | `VerificationLimiter.MAX_SENDS_PER_HOUR` |
| 제한 초과 응답 | 429 (`잠시 후 다시 인증번호를 요청해 주세요.` 또는 `인증번호 발송 횟수를 초과했습니다...`) | |

- 1시간 창은 **마지막 발송 시점부터** 센다. 제한에 걸린 요청은 창을 늘리지 않는다.

## 6. 초기화 정책 (재발송·성공 시)

| 사건 | 인증번호 실패 횟수 | 발송 횟수 | 설명 |
|---|---|---|---|
| 재발송 (새 번호 발급) | **0으로 초기화** | 유지 (+1) | 새 번호이므로 이전 실패를 이어받지 않는다. 발송 횟수는 줄이지 않는다. |
| 인증 성공 (티켓 발급) | **0으로 초기화** | **유지** | 성공 직후 다시 발급받아 제한을 우회하는 것을 막는다. |
| 티켓 소모 (가입·비밀번호 변경) | 해당 없음 | 유지 | 티켓은 한 번만 쓸 수 있다. |
| 만료 | 캐시 TTL과 함께 사라짐 | 1시간 뒤 사라짐 | |

## 7. 티켓

- 인증번호가 맞으면 용도·이메일 키로 티켓을 발급한다. 유효 시간은 10분이다 (`auth.ticket-expiration-millis`, 기본 600000).
- 소모는 **값이 일치할 때만 원자적으로 제거**한다(`ConcurrentMap.remove(key, value)`). 같은 티켓을 동시에 제시해도 한 요청만 통과한다.
- 소모에 실패하면 400 `이메일 인증이 필요합니다.`를 반환한다.
- 소모 후 같은 티켓을 다시 쓰면 실패한다. (`VerificationPurposeHttpFlowTest.ticketCannotBeReusedAfterSuccess`)

## 8. 알려진 한계

- **발송 제한과 확인 제한의 경쟁 구간**: 제한을 검사한 뒤 기록하기 전까지 짧은 틈이 있다. 같은 이메일로 여러 요청이 동시에 들어오면 제한을 한두 번 넘을 수 있다. 제한 검사와 기록을 한 번에 원자적으로 묶는 것은 후속 과제다.
- **제한은 메모리 캐시**다. 서버를 재시작하면 카운터가 초기화된다. 여러 서버로 확장하면 공유 저장소가 필요하다.
- **이메일 정규화**: 이메일은 대소문자와 공백을 정리하지 않은 채 키로 쓴다. 비교 정책은 `docs/development/users-unique-keys.md`를 본다.
- 발송 자체의 안정성(SMTP 시간 초과로 첫 발송이 500이 되는 현상)은 이 정책의 범위 밖이다.

## 9. 관련 테스트

| 테스트 | 확인 내용 |
|---|---|
| `VerificationLimiterTest` | 재발송 간격, 시간당 5회, 실패 횟수 초기화, 성공 후 발송 횟수 유지, 인증번호 범위 |
| `TicketPurposeHttpFlowTest` | 교차 사용 거부 (A, B), 이메일 바인딩 (C) |
| `VerificationPurposeHttpFlowTest` | 같은 용도의 정상 흐름, 덮어쓰기 방지, 재사용 거부, 용도 누락·알 수 없는 값, 실패 5회 후 429 |
| `VerificationExpiryHttpFlowTest` | 인증번호 만료, 티켓 만료 (짧은 TTL로 실행) |
