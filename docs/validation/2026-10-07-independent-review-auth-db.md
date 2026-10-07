# 독립 리뷰 기록: 인증·DB 최종 변경분

> **대상 커밋**: `1ed8a00`(인증 티켓 용도 분리), `84cf5e0`(유니크 제약), `4f91276`(제한 원자화)
> **리뷰 범위**: `backend/src/main/java/.../user/` 인증·제한·유니크 처리, `backend/db/migrations/2026-10-07-users-unique-keys.sql`, `backend/db/checks/readonly-precheck.sql`, 프론트 `userApi.js`·`ForgotPasswordPage.jsx`·`SignupPage.jsx`의 인증 요청
> **리뷰 방식**: 읽기 전용 리뷰 에이전트. 리뷰 중 코드는 수정하지 않았고, 발견 사항은 메인 세션에서 처리했다.
> **리뷰 상태**: **완료** (실패 없이 결과를 받았다). Must 1건과 Should 6건이 나왔고, 아래 표의 처리 결과대로 반영했다.

---

## 1. 리뷰 중 실행한 검증

| 항목 | 결과 |
|---|---|
| 백엔드 전체 테스트 (리뷰 시점, 4f91276) | 192 통과, 실패 0, 오류 0 |
| 마이그레이션 실제 적용 | 하지 않음 (H2 기준 리뷰, MySQL 미검증) |

## 2. 발견 사항과 처리

| 번호 | 등급 | 내용 | 처리 |
|---|---|---|---|
| M-1 | **Must** | 마이페이지 비밀번호 변경이 항상 실패. 확인 요청에 `purpose`가 빠졌고, 발송이 `SIGNUP`으로 고정돼 있었다 | **수정함.** `userApi.js`가 `password-reset-requests`로 발송하고, 확인에 `RESET_PASSWORD`를 보낸다. 실서버 S7에서 통과 |
| S-1 | Should | 메일 발송 실패 경로(`releaseSend`)를 검증하는 HTTP 테스트가 없었다 | **수정함.** `VerificationMailFailureHttpFlowTest`: 첫 발송 실패 → 500, 즉시 재요청 → 200, 그 뒤 간격 제한 → 429 |
| S-2 | Should | 발송 예약 단계에서 시도 횟수를 초기화해, 메일 실패 시 기존 인증번호의 시도 한도가 리셋될 수 있었다 | **수정함.** 초기화를 `recordSent`로 옮겨, 새 인증번호가 실제 저장된 뒤에만 초기화. `VerificationLimiterTest.failedSendDoesNotResetAttemptsOfTheStillValidCode` |
| S-3 | Should | 제한 카운터 캐시(최대 10,000개)에서 퇴출되면 한도가 리셋될 수 있다 | **문서화만 함.** 정책 문서 8장에 명시. 공유 저장소 도입 때 함께 해결 |
| S-4 | Should | 인증번호 불일치 401에 본문이 없어 프론트에 "요청에 실패했습니다 (HTTP 401)"이 표시됐다 | **수정함.** `{ "message": "인증번호가 일치하지 않습니다." }` |
| S-5 | Should | 발송은 경로로, 확인은 body의 `purpose`로 용도를 정해 방식이 달랐다. 가입 화면의 발송 body `purpose`는 무시된다 | **부분 처리.** M-1의 계약 불일치는 해결했다. 발송 방식을 body 기반으로 통일하는 것은 엔드포인트 계약 변경이므로 후속으로 남긴다 |
| S-6 | Should | 유니크 제약 마이그레이션의 두 ALTER가 별도 문장이라 중간 부분 적용이 가능했다 | **수정함.** 한 문장의 `ALTER TABLE ... ADD CONSTRAINT ..., ADD CONSTRAINT ...`로 묶었다 |
| N-1 | Nit | 제약 이름의 부분 문자열 매칭이 값에 제약 이름이 들어가면 오분류할 수 있다 | 미처리. 닉네임은 최대 30자이고 경쟁 상황에서만 발생. 후속 |
| N-2 | Nit | 동시 가입에서 패배한 요청은 티켓을 이미 소모한 뒤 실패한다 | 미처리. 드문 경쟁. 인증을 다시 해야 하는 불편으로 남음. 후속 |
| N-3 | Nit | 동시 가입 테스트가 DB 제약 경로를 강제하지 않는다 (대부분 사전 검사에서 걸림). 이메일 쪽 경쟁 메시지 테스트 없음 | 미처리. 후속 |
| N-4 | Nit | 만료 테스트가 `Thread.sleep(900)`에 의존 | 미처리. 느린 환경에서 흔들릴 수 있음. 후속 |
| N-5 | Nit | 값 타입 정리, raw `ResponseEntity` 제네릭, 메일 발송 뒤 캐시 저장 실패 시 쿨다운 해제 | 미처리. 영향 낮음 |

## 3. 리뷰가 확인한 사항 (유지할 결정)

- 제한 임계 구역(`synchronized`)에는 I/O가 없고 잠금이 하나뿐이라 교착이 없다. 메일 발송은 잠금 밖에서 한다.
- 확인 시도는 비교 전에 예약한다. 동시 20건 중 정확히 5건만 비교된다(`VerificationConcurrencyHttpFlowTest`).
- 티켓 소모는 `asMap().remove(key, value)`로 원자적이고, 용도가 다르면 키가 달라 소모되지 않는다.
- 티켓 없음·만료·용도 불일치에 같은 메시지를 쓰는 것은 계정·용도 노출을 줄이는 의도다.
- 중복 검사는 티켓 소모 전에 한다. 실패해도 티켓을 재사용할 수 있다(`DuplicateSignupHttpFlowTest`).
- `saveAndFlush`는 `AuthService`의 클래스 레벨 트랜잭션 안에서 호출되고, 예외는 `IllegalArgumentException`으로 바뀌어 롤백된다.
- 제약 이름 `uk_users_email`, `uk_users_nickname`은 엔티티, 마이그레이션, 테스트에서 일치한다.
- `readonly-precheck.sql`은 SELECT만 있다. DDL과 DML 키워드가 없다.
- `ForgotPasswordPage.jsx`, `SignupPage.jsx`의 용도 전달은 계약과 맞다.

## 4. 수정 후 실서버 확인

- S7 마이페이지 비밀번호 변경 (로그인 → 재설정 용도 인증번호 발송 → 확인 → 새 비밀번호 저장 → 새 비밀번호 로그인 200): **통과**. M-1 수정 후 로컬 H2 프로필에서 실행했다.
- 백엔드 전체 테스트 194개 통과, 프론트 lint·build·테스트 182개 통과.

## 5. 이 리뷰로 확인하지 못한 것

- MySQL에서의 유니크 제약 동작, 콜레이션에 따른 대소문자·끝 공백 판정 (H2 기준 리뷰)
- 운영 DB 스키마와 마이그레이션 적용 여부
- 다중 인스턴스 환경의 제한 공유 (메모리 카운터의 구조적 한계)
- 운영 SMTP 발송 안정성
