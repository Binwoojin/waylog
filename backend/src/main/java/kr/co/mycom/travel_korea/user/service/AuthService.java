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
import lombok.extern.slf4j.Slf4j;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;

import java.text.ParseException;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthService {

    private static final String REFRESH_FAILED_MESSAGE = "로그인이 만료되었습니다. 다시 로그인해 주세요.";

    private final JwtConfig jwt;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository repo;
    private final JavaMailSender emailSender;
    private final Cache<String, Integer> emailVerificationCache;
    private final Cache<String, String> emailVerificationTicketCache;

    public UserEntity signup(UserRequest userInput) {
        consumeVerificationTicket(userInput.getEmail(), userInput.getVerificationToken());
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
            /*
             * "로그인 상태 유지"를 끈 경우(false)만 세션 쿠키로 발급합니다.
             * 값이 없으면(null) 기존 클라이언트와의 호환을 위해 7일 쿠키를 유지합니다.
             */
            boolean rememberLogin = !Boolean.FALSE.equals(request.getRememberLogin());
            ResponseCookie refreshCookie = jwt.createRefreshTokenCookie(tokens.refreshToken(), rememberLogin);

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                    .body(Map.of(
                            "accessToken", tokens.accessToken(),
                            "member", toMemberResponse(dbUser)
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
        UserEntity user = findRefreshSessionUser(refreshTokenCookie).orElse(null);
        if (user == null) {
            /*
             * 쿠키 없음, 파싱·서명·타입·만료 오류, 회원 없음은
             * "다시 로그인해야 해결되는 상태"이므로 401로 통일하고 쿠키를 삭제합니다.
             *
             * 예외 메시지는 내부 정보가 담길 수 있고 null이면 Map.of가 NPE를 던지므로
             * 응답에는 고정 메시지만 내보냅니다.
             */
            // Design Ref: §4.2 — 실패 400→401, body는 고정 메시지 (e.getMessage() 비노출)
            ResponseCookie deleteCookie = jwt.deleteToken();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, deleteCookie.toString())
                    .body(Map.of("message", REFRESH_FAILED_MESSAGE));
        }

        // Refresh Token이 유효한 경우에만 Access Token을 재발급합니다.
        String newAccessToken = issueAccessToken(user);

        // Design Ref: §4.2 — 새로고침 후 세션 복원 시 헤더 닉네임을 그리도록 login과 같은 member를 함께 반환
        return ResponseEntity.ok(Map.of(
                "accessToken", newAccessToken,
                "member", toMemberResponse(user)
        ));
    }

    /*
     * Refresh Token 쿠키를 검증하고 해당 회원을 찾습니다.
     *
     * 토큰·회원 검증 실패만 Optional.empty()로 돌려 401 처리 대상으로 삼습니다.
     *  - IllegalArgumentException: 쿠키 없음, 서명 불일치, 타입 불일치, 만료, 회원 없음
     *  - ParseException: JWT 형식 오류 또는 claim 형식 오류
     *  - JOSEException: 지원하지 않는 서명 알고리즘 등 검증 단계 오류
     *
     * DB 장애 같은 그 밖의 예외는 로그인 상태와 무관한 서버 오류이므로
     * 쿠키를 지우지 않고 전파해 500이 되게 합니다.
     * (프론트가 네트워크·서버 오류로 보고 로그인 상태를 유지할 수 있어야 합니다.)
     *
     * 회원 없음은 repo가 예외를 던지는 대신 빈 Optional로 판단하므로
     * @Transactional 프록시를 지나는 RuntimeException이 없어 rollback-only가 생기지 않습니다.
     */
    // Design Ref: §12 R-5 — 401 + 쿠키 삭제는 토큰·회원 검증 실패에만 한정
    private Optional<UserEntity> findRefreshSessionUser(String refreshTokenCookie) {
        if (refreshTokenCookie == null || refreshTokenCookie.isBlank()) {
            log.debug("Refresh Token 재발급 실패: 쿠키 없음");
            return Optional.empty();
        }

        String email;
        try {
            /*
             * 서명 검증 및 만료 여부 확인.
             * 만료된 Refresh Token은 재발급하지 않고 거부해야 하므로
             * 만료 시 예외를 던지는 validateRefreshToken()을 사용합니다.
             */
            email = jwt.validateRefreshToken(refreshTokenCookie);
        } catch (IllegalArgumentException | ParseException | JOSEException e) {
            log.debug("Refresh Token 재발급 실패: {}", e.toString());
            return Optional.empty();
        } catch (RuntimeException e) {
            log.error("Refresh Token 검증 중 예상하지 못한 오류", e);
            throw e;
        } catch (Exception e) {
            // validateRefreshToken()이 throws Exception으로 선언되어 있어 남은 checked 예외를 감쌉니다.
            log.error("Refresh Token 검증 중 예상하지 못한 오류", e);
            throw new IllegalStateException("Refresh Token 검증 중 서버 오류가 발생했습니다.", e);
        }

        /*
         * 토큰이 유효해도 그 사이 탈퇴 등으로 회원이 없을 수 있습니다.
         * 이 경우 새 Access Token을 발급해도 보호 API에서 다시 401이 되므로
         * 재발급 실패로 처리해 프론트가 로그인 상태를 바로 해제하게 합니다.
         * DB 조회 자체의 오류는 잡지 않고 전파합니다(500).
         */
        Optional<UserEntity> user = repo.findByEmail(email);
        if (user.isEmpty()) {
            log.debug("Refresh Token 재발급 실패: 회원 없음");
        }
        return user;
    }

    /*
     * 검증을 통과한 회원에게 Access Token을 발급합니다.
     * 서명 실패는 사용자 토큰 문제가 아니라 서버 설정 문제이므로 500으로 전파합니다.
     * (IllegalArgumentException으로 감싸면 GlobalExceptionHandler가 400으로 바꾸므로 IllegalStateException 사용)
     */
    private String issueAccessToken(UserEntity user) {
        try {
            return jwt.createAccessToken(user.getEmail());
        } catch (JOSEException e) {
            log.error("Access Token 발급 실패", e);
            throw new IllegalStateException("Access Token 발급 중 서버 오류가 발생했습니다.", e);
        }
    }

    /*
     * login과 refresh가 같은 회원 정보 형태를 반환하도록 한 곳에서 만듭니다.
     *
     * 비밀번호 해시가 포함된 UserEntity 전체를 반환하면 안 되므로
     * 화면(헤더 닉네임, 권한 분기)에 필요한 안전한 회원 정보만 전달합니다.
     *
     * Map.of는 null 값을 허용하지 않으므로 GRADE가 비어 있는 회원도
     * 응답이 깨지지 않도록 기본값 "user"를 사용합니다.
     */
    // Design Ref: §3 — member { memberId, email, nickname, role } 형태를 login·refresh 공통으로 고정
    private Map<String, Object> toMemberResponse(UserEntity user) {
        String role = user.getGrade() != null ? user.getGrade() : "user";
        return Map.of(
                "memberId", user.getId(),
                "email", user.getEmail(),
                "nickname", user.getNickname(),
                "role", role
        );
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
            /*
             * 인증 성공 시 일회용 티켓을 발급합니다.
             * signup/changePassword는 이 티켓을 제시해야만 처리되며,
             * 한 번 사용된 티켓은 즉시 무효화됩니다.
             */
            String verificationToken = UUID.randomUUID().toString();
            emailVerificationTicketCache.put(request.getEmail(), verificationToken);
            return ResponseEntity.ok(Map.of("verificationToken", verificationToken));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    public void changePassword(UserRequest request) {
        consumeVerificationTicket(request.getEmail(), request.getVerificationToken());
        UserEntity user = repo.findByEmail(request.getEmail()).orElseThrow(() -> new IllegalArgumentException("해당 이메일의 회원을 찾을 수 없습니다."));
        user.changePassword(passwordEncoder.encode(request.getPassword()));
        repo.save(user);
    }

    /**
     * 이메일 인증 티켓을 검증하고 1회성으로 소모합니다.
     *
     * 티켓이 없거나 일치하지 않으면 signup/changePassword를 진행할 수 없습니다.
     * 검증에 성공한 티켓은 재사용을 막기 위해 즉시 무효화합니다.
     */
    private void consumeVerificationTicket(String email, String verificationToken) {
        String ticket = emailVerificationTicketCache.getIfPresent(email);
        if (ticket == null || verificationToken == null || !ticket.equals(verificationToken)) {
            throw new IllegalArgumentException("이메일 인증이 필요합니다.");
        }
        emailVerificationTicketCache.invalidate(email);
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
