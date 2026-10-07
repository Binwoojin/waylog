package kr.co.mycom.travel_korea.common.exception;

/**
 * 로그인은 되어 있지만 해당 리소스를 변경할 권한이 없을 때 던집니다(예: 타인의 게시물·댓글 수정·삭제).
 * GlobalExceptionHandler가 이 예외를 403과 { "message": "..." } 형식으로 변환합니다.
 *
 * 입력값 오류는 IllegalArgumentException(400)을 그대로 사용하고, 권한 오류만 이 예외로 구분합니다.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
