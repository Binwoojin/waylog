package kr.co.mycom.travel_korea.user.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.nimbusds.jose.JOSEException;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import jakarta.transaction.Transactional;
import kr.co.mycom.travel_korea.config.JwtConfig;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.user.dto.MailRequest;
import kr.co.mycom.travel_korea.user.dto.UserRequest;
import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;
import java.util.Random;

@Service
@Transactional
@RequiredArgsConstructor
public class AuthService {

    private final JwtConfig jwt;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository repo;
    private final JavaMailSender emailSender;
    private final Cache<String, Integer> emailVerificationCache;

    public UserEntity signup(UserRequest userInput) {
        UserEntity rep = new UserEntity(
                userInput.getEmail(),
                passwordEncoder.encode(userInput.getPassword()),
                userInput.getNickname(),
                "user"
        );
        return repo.save(rep);
    }

    public ResponseEntity login(@RequestBody UserRequest request) throws JOSEException {
        UserEntity dbUser = repo.findByEmail(request.getEmail()).orElse(null);
        if (dbUser ==null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
        }
        if (passwordEncoder.matches(request.getPassword(), dbUser.getPassword())) {
            JwtConfig.TokenResponse tokens = jwt.createTokenPair(dbUser.getEmail());
            ResponseCookie refreshCookie = jwt.createRefreshTokenCookie(tokens.refreshToken());

            /*
             * 헤더에는 닉네임이 필요하지만 비밀번호가 포함된 UserEntity 전체를
             * 반환하면 안 되므로 화면에 필요한 안전한 회원 정보만 전달합니다.
             */
            Map<String, Object> member = Map.of(
                    "memberId", dbUser.getId(),
                    "email", dbUser.getEmail(),
                    "nickname", dbUser.getNickname(),
                    "role", dbUser.getGrade()
            );

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                    .body(Map.of(
                            "accessToken", tokens.accessToken(),
                            "member", member
                    ));

        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
    }

    public ResponseCookie logout() {
//        엑세스 토큰 삭제
        return jwt.deleteToken();
    }

    public ResponseEntity<?> refreshToken(String refreshTokenCookie) {
    // 엑세스 토큰 리프레시
        try {
            if (refreshTokenCookie == null || refreshTokenCookie.isBlank()) {
                throw new IllegalArgumentException("Refresh Token이 존재하지 않습니다.");
            }

            // 서명 검증 및 만료 여부 확인
            JwtConfig.RefreshTokenValidationResult result = jwt.validateRefreshTokenWithExpirationCheck(refreshTokenCookie);
            String email = result.email();

            // 1) Refresh Token이 만료된 경우 -> 두 토큰 모두 재발급 후 쿠키 업데이트
            if (result.isExpired()) {
                JwtConfig.TokenResponse newTokenPair = jwt.createTokenPair(email);
                ResponseCookie newCookie = jwt.createRefreshTokenCookie(newTokenPair.refreshToken());

                return ResponseEntity.ok()
                        .header(HttpHeaders.SET_COOKIE, newCookie.toString())
                        .body(Map.of(
                                "accessToken", newTokenPair.accessToken(),
                                "message", "Refresh Token이 만료되어 전체 토큰이 재발급되었습니다."
                        ));
            }

            // 2) Refresh Token이 만료되지 않고 유효한 경우 -> Access Token만 재발급
            String newAccessToken = jwt.createAccessToken(email);
            return ResponseEntity.ok(Map.of("accessToken", newAccessToken));

        } catch (Exception e) {
            // 서명이 조작되었거나 올바르지 않은 타입일 경우 쿠키 삭제 후 에러 반환
            ResponseCookie deleteCookie = jwt.deleteToken();
            return ResponseEntity.badRequest()
                    .header(HttpHeaders.SET_COOKIE, deleteCookie.toString())
                    .body(Map.of("error", e.getMessage()));
        }
    }

    private void createEmailForm(String toEmail,
                                        String title,
                                        String text) throws MessagingException {
        MimeMessage message = emailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(toEmail);
        helper.setSubject(title);
        helper.setText(text,true);
        emailSender.send(message);
    }



    public ResponseEntity emailVerificationConfirm(MailRequest request) {
//        이메일 인증번호 확인
        Integer verifiedCode = emailVerificationCache.getIfPresent(request.getEmail());
        if (verifiedCode != null && verifiedCode.equals(request.getAuthCode())) {
            emailVerificationCache.invalidate(request.getEmail());
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    public void changePassword(UserRequest request) {
        UserEntity user = repo.findByEmail(request.getEmail()).orElseThrow(() -> new IllegalArgumentException("해당 이메일의 회원을 찾을 수 없습니다."));
        user.changePassword(passwordEncoder.encode(request.getPassword()));
        repo.save(user);
    }

    public void sendCodeToEmail(String email) {
        // 확인코드 담긴 이메일 발송
        String title = "Waylog 이메일 인증 번호";
        Random random = new Random();
        int checkNum = random.nextInt(888888) + 111111;
        String content =
                "<!DOCTYPE html>"
                        + "<html>"
                        + "<head><meta charset='UTF-8'></head>"
                        + "<body style='margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif;'>"
                        + "  <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background-color: #f4f6f8; padding: 40px 0;'>"
                        + "    <tr>"
                        + "      <td align='center'>"
                        + "        <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='max-width: 500px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;'>"
                        // 브랜드 헤더
                        + "          <tr>"
                        + "            <td style='background-color: #2563eb; padding: 24px; text-align: center;'>"
                        + "              <h1 style='color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;'>Waylog</h1>"
                        + "            </td>"
                        + "          </tr>"
                        // 본문 콘텐츠
                        + "          <tr>"
                        + "            <td style='padding: 40px 32px; text-align: center;'>"
                        + "              <h2 style='color: #1e293b; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;'>이메일 인증 번호</h2>"
                        + "              <p style='color: #64748b; margin: 0 0 28px 0; font-size: 14px; line-height: 1.5;'>Waylog를 이용해 주셔서 감사합니다.<br>아래의 인증 번호를 홈페이지 인증 창에 입력해 주세요.</p>"
                        // 인증코드 강조 박스
                        + "              <div style='background-color: #f1f5f9; border-radius: 8px; padding: 16px 24px; display: inline-block; margin-bottom: 24px;'>"
                        + "                <span style='color: #2563eb; font-size: 32px; font-weight: 800; letter-spacing: 6px; font-family: monospace;'>" + checkNum + "</span>"
                        + "              </div>"
                        + "              <p style='color: #ef4444; margin: 0; font-size: 13px; font-weight: 500;'>※ 본 인증번호는 3분 동안만 유효합니다.</p>"
                        + "            </td>"
                        + "          </tr>"
                        // 푸터
                        + "          <tr>"
                        + "            <td style='background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;'>"
                        + "              <p style='color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;'>본 메일은 발신 전용 메일이므로 회신되지 않습니다.<br>© Waylog. All rights reserved.</p>"
                        + "            </td>"
                        + "          </tr>"
                        + "        </table>"
                        + "      </td>"
                        + "    </tr>"
                        + "  </table>"
                        + "</body>"
                        + "</html>";
        try {
            createEmailForm(email, title, content);
            // 인증번호 관련 정보를 캐시에 저장
            emailVerificationCache.put(email, checkNum);
        } catch (Exception e) {
            // 또는 로거를 사용하여 상세한 예외 정보 로깅
            throw new RuntimeException("Unable to send email in sendCodeToEmail", e); // 원인 예외를 포함시키기
        }
    }

}
