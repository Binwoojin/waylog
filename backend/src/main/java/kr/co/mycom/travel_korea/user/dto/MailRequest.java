package kr.co.mycom.travel_korea.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MailRequest {
    @NotBlank(message = "이메일을 입력해 주세요.")
    String email;

    @NotNull(message = "인증번호를 입력해 주세요.")
    Integer authCode;
}
