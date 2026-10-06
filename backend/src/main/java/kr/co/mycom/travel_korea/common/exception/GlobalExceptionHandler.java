package kr.co.mycom.travel_korea.common.exception;

import kr.co.mycom.travel_korea.tourcourse.exception.TourCourseValidationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * API에서 발생하는 입력값 오류를 공통 JSON 응답으로 반환합니다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 서비스 검증 로직에서 발생한 잘못된 요청을 400으로 반환합니다.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(
                Map.of("message", exception.getMessage())
        );
    }

    /**
     * 권한이 없는 변경 요청(타인의 게시물·댓글 수정·삭제)을 403으로 반환합니다.
     * 입력값 오류(400)와 구분해 프론트가 권한 안내를 따로 표시할 수 있게 합니다.
     */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                Map.of("message", exception.getMessage())
        );
    }

    /**
     * @Valid 검증 실패(@NotBlank 등)를 admin-dashboard 설계 §4.3과 동일한
     * { "message": "..." } 형식으로 반환합니다. 이 핸들러가 없으면 @Valid를 새로
     * 붙인 요청(UserSuspensionRequest 등)의 검증 실패가 Spring 기본 형식으로 나가
     * 프론트(client.js의 data.message 파싱)가 오류 메시지를 읽지 못합니다.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .findFirst()
                .map(error -> error.getDefaultMessage())
                .orElse("입력값을 확인해 주세요.");

        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    /**
     * 여행코스 REFERENCE/CUSTOM 필드 검증 실패를 프론트가 분기할 수 있도록 code를 포함해
     * 반환한다(admin-dashboard 설계 §6 INVALID_STOP_TYPE, ACCOUNT_SUSPENDED와 같은 { code,
     * message } 응답 관례).
     */
    @ExceptionHandler(TourCourseValidationException.class)
    public ResponseEntity<Map<String, String>> handleTourCourseValidation(TourCourseValidationException exception) {
        return ResponseEntity.badRequest().body(
                Map.of("code", exception.getCode(), "message", exception.getMessage())
        );
    }

    /**
     * DB 제약(유니크/외래키 등) 위반을 원인 불명의 500 대신 다른 핸들러와 같은
     * { "message": "..." } 400 형식으로 반환한다. 특정 기능 이름은 넣지 않는다 —
     * 이 핸들러는 전역이라 어떤 엔티티의 제약이든 여기로 떨어질 수 있기 때문이다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException exception) {
        return ResponseEntity.badRequest().body(
                Map.of("message", "요청을 처리할 수 없습니다. 입력값을 확인하고 다시 시도해 주세요.")
        );
    }
}
