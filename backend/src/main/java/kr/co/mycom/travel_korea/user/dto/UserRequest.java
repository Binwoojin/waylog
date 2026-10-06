package kr.co.mycom.travel_korea.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserRequest {

    /*
     * 엔드포인트마다 필수 필드가 다르므로 검증 그룹을 나눕니다.
     * 컨트롤러는 @Validated(그룹) 으로 해당 그룹의 제약만 검사합니다.
     * (UserRequest는 여러 API가 공유하므로 필드에 @NotBlank를 무조건 붙이면 안 됩니다.)
     */
    public interface Signup {}
    public interface Login {}
    public interface SendCode {}
    public interface PasswordChange {}

    private Long id;

    @NotBlank(message = "이메일을 입력해 주세요.",
            groups = {Signup.class, Login.class, SendCode.class, PasswordChange.class})
    private String email;

    @NotBlank(message = "비밀번호를 입력해 주세요.",
            groups = {Signup.class, Login.class, PasswordChange.class})
    private String password;

    @NotBlank(message = "닉네임을 입력해 주세요.", groups = Signup.class)
    private String nickname;

    private String grade;
    private LocalDateTime created_at;

    @NotBlank(message = "이메일 인증을 완료해 주세요.", groups = {Signup.class, PasswordChange.class})
    private String verificationToken;

    /*
     * 로그인 화면의 "로그인 상태 유지" 체크 여부입니다.
     *
     * Boolean(래퍼)을 쓰는 이유: 값을 보내지 않는 기존 클라이언트는 null이 되고,
     * 이 경우 기존 동작(7일 유지 쿠키)으로 처리해 하위 호환을 지킵니다.
     */
    private Boolean rememberLogin;
}
