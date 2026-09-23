package kr.co.mycom.travel_korea.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserRequest {
    private Long id;
    private String email;
    private String password;
    private String nickname;
    private String grade;
    private LocalDateTime created_at;
    private String verificationToken;

    /*
     * 로그인 화면의 "로그인 상태 유지" 체크 여부입니다.
     *
     * Boolean(래퍼)을 쓰는 이유: 값을 보내지 않는 기존 클라이언트는 null이 되고,
     * 이 경우 기존 동작(7일 유지 쿠키)으로 처리해 하위 호환을 지킵니다.
     */
    private Boolean rememberLogin;
}
