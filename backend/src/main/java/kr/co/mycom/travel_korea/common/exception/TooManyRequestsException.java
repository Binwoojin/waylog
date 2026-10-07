package kr.co.mycom.travel_korea.common.exception;

/**
 * 인증번호 발송이나 확인 시도가 제한을 넘었을 때 던집니다.
 * GlobalExceptionHandler가 이 예외를 429와 { "message": "..." } 형식으로 변환합니다.
 */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
