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
| 확인 시도 제한 | 인증번호 하나당 확인 요청 **5회**(맞춤 여부와 무관). 6회째부터는 맞아도 429 | `VerificationLimiter.MAX_FAILED_ATTEMPTS` |
| 확인 응답 | 틀린 번호는 401, 제한 초과는 429 `인증 시도 횟수를 초과했습니다.` | `AuthService`, `GlobalExceptionHandler` |

## 5. 발송 제한

| 항목 | 값 | 설정 |
|---|---|---|
| 재발송 간격 | 같은 용도·이메일은 **60초**에 한 번 | `auth.send-cooldown-millis` (기본 60000, 0이면 끔) |
| 발송 횟수 | 같은 용도·이메일은 **1시간에 5회** | `VerificationLimiter.MAX_SENDS_PER_HOUR` |
| 제한 초과 응답 | 429 (`잠시 후 다시 인증번호를 요청해 주세요.` 또는 `인증번호 발송 횟수를 초과했습니다...`) | |

- 1시간 창은 **마지막 발송 시점부터** 센다. 제한에 걸린 요청은 창을 늘리지 않는다.
- 발송 검사와 기록은 한 번에 처리한다. 메일 발송이 실패하면 예약을 되돌려 횟수와 간격을 소모하지 않는다.

## 6. 초기화 정책 (재발송·성공 시)

| 사건 | 확인 시도 횟수 | 발송 횟수 | 설명 |
|---|---|---|---|
| 재발송 (새 번호 발급) | **0으로 초기화** | 유지 (+1) | 새 번호이므로 이전 시도를 이어받지 않는다. 발송 횟수는 줄이지 않는다. |
| 인증 성공 (티켓 발급) | **0으로 초기화** | **유지** | 성공 직후 다시 발급받아 제한을 우회하는 것을 막는다. |
| 티켓 소모 (가입·비밀번호 변경) | 해당 없음 | 유지 | 티켓은 한 번만 쓸 수 있다. |
| 만료 | 캐시 TTL과 함께 사라짐 | 1시간 뒤 사라짐 | |

## 7. 티켓

- 인증번호가 맞으면 용도·이메일 키로 티켓을 발급한다. 유효 시간은 10분이다 (`auth.ticket-expiration-millis`, 기본 600000).
- 소모는 **값이 일치할 때만 원자적으로 제거**한다(`ConcurrentMap.remove(key, value)`). 같은 티켓을 동시에 제시해도 한 요청만 통과한다.
- 소모에 실패하면 400 `이메일 인증이 필요합니다.`를 반환한다.
- 소모 후 같은 티켓을 다시 쓰면 실패한다. (`VerificationPurposeHttpFlowTest.ticketCannotBeReusedAfterSuccess`)

## 8. 알려진 한계

- **동시성 (해결됨)**: 발송 예약과 확인 시도는 `VerificationLimiter`의 임계 구역에서 검사와 기록을 한 번에 한다. 동시 발송과 동시 오답 확인에서도 한도를 넘지 않는다(`VerificationLimiterTest`, `VerificationConcurrencyHttpFlowTest`).
- **메모리 카운터 (남은 한계)**: 제한 카운터는 이 프로세스의 메모리 캐시다.
  - 서버를 재시작하면 모든 카운터가 초기화된다. 재시작 직후 한도가 다시 열린다.
  - 인스턴스가 여러 개이면 각 인스턴스가 따로 센다. 한도는 인스턴스 수만큼 느슨해진다.
  - 해결하려면 공유 저장소(예: Redis)나 DB 기반 카운터가 필요하다. 이는 후속 과제다(이슈 #2 잔여 과제).
- **캐시 퇴출**: 제한 카운터는 최대 10,000개 키의 캐시다. 많은 이메일로 요청이 몰려 항목이 퇴출되면 해당 키의 제한이 리셋될 수 있다. 자주 쓰이는 키는 남지만 보장하지 않는다. 고정 상한 대신 공유 저장소로 옮길 때 함께 해결한다.
- **임계 구역의 범위**: `synchronized`는 이 제한 객체 전체를 잠근다. 요청량이 많아지면 키별 잠금으로 바꾸는 것을 검토한다.
- **이메일 정규화**: 이메일은 대소문자와 공백을 정리하지 않은 채 키로 쓴다. 비교 정책은 `docs/development/users-unique-keys.md`를 본다.
- 발송 자체의 안정성(SMTP 시간 초과로 첫 발송이 500이 되는 현상)은 이 정책의 범위 밖이다.

## 9. 관련 테스트

| 테스트 | 확인 내용 |
|---|---|
| `VerificationLimiterTest` | 재발송 간격, 시간당 5회, 예약 실패 시 되돌림, 시도 횟수 초기화, 성공 후 발송 횟수 유지, 인증번호 범위, 동시 발송·동시 시도 한도 |
| `VerificationConcurrencyHttpFlowTest` | 실제 확인 엔드포인트에 동시 오답 20건: 비교는 5회까지, 나머지는 429, 한도 도달 후 맞는 번호도 429 |
| `TicketPurposeHttpFlowTest` | 교차 사용 거부 (A, B), 이메일 바인딩 (C) |
| `VerificationPurposeHttpFlowTest` | 같은 용도의 정상 흐름, 덮어쓰기 방지, 재사용 거부, 용도 누락·알 수 없는 값, 시도 5회 후 429 |
| `VerificationExpiryHttpFlowTest` | 인증번호 만료, 티켓 만료 (짧은 TTL로 실행) |
