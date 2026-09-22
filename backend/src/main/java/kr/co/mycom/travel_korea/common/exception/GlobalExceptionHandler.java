package kr.co.mycom.travel_korea.common.exception;

import org.springframework.http.ResponseEntity;
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
}
