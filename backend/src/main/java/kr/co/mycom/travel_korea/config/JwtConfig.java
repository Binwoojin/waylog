package kr.co.mycom.travel_korea.config;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.UUID;

@Component
public class JwtConfig {

    private final long accessExpiration;
    private final long refreshExpiration;
    private final JWSSigner signer;
    private final JWSVerifier verifier;

    public record TokenResponse(String accessToken, String refreshToken) {}
    public record RefreshTokenValidationResult(String email, boolean isExpired) {}

    public JwtConfig(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-expiration}") long accessExpiration,
            @Value("${jwt.refresh-expiration}") long refreshExpiration) throws JOSEException {
        byte[] secretKeyBytes = secret.getBytes();
        this.accessExpiration = accessExpiration;
        this.refreshExpiration = refreshExpiration;

        // 서명기 및 검증기를 인스턴스화하여 재사용 (성능 최적화)
        this.signer = new MACSigner(secretKeyBytes);
        this.verifier = new MACVerifier(secretKeyBytes);
    }

    // 1. Access Token과 Refresh Token 동시 발급
    public TokenResponse createTokenPair(String email) throws JOSEException {
        String accessToken = createAccessToken(email);
        String refreshToken = createSingleToken(email, "REFRESH", refreshExpiration, true);
        return new TokenResponse(accessToken, refreshToken);
    }

    // 2. 단일 Access Token 발급
    public String createAccessToken(String email) throws JOSEException {
        return createSingleToken(email, "ACCESS", accessExpiration, false);
    }

    // 3. Access Token 검증 및 email 추출 (API 요청 처리용)
    public String validateAccessToken(String token) throws Exception {
        JWTClaimsSet claims = parseAndVerifyToken(token);

        if (claims.getExpirationTime().before(new Date())) {
            throw new IllegalArgumentException("만료된 Access Token입니다.");
        }

        if (!"ACCESS".equals(claims.getStringClaim("type"))) {
            throw new IllegalArgumentException("올바른 Access Token 타입이 아닙니다.");
        }

        return claims.getSubject();
    }

    // 4. Refresh Token 검증후 email 추출 (만료 시 예외 처리)
    public String validateRefreshToken(String token) throws Exception {
        RefreshTokenValidationResult result = validateRefreshTokenWithExpirationCheck(token);
        if (result.isExpired()) {
            throw new IllegalArgumentException("만료된 Refresh Token입니다. 다시 로그인하세요.");
        }
        return result.email();
    }

    // 5. Refresh Token 검증 (만료 여부 함께 반환)
    public RefreshTokenValidationResult validateRefreshTokenWithExpirationCheck(String token) throws Exception {
        JWTClaimsSet claims = parseAndVerifyToken(token);

        if (!"REFRESH".equals(claims.getStringClaim("type"))) {
            throw new IllegalArgumentException("올바른 Refresh Token 타입이 아닙니다.");
        }

        boolean isExpired = claims.getExpirationTime().before(new Date());
        return new RefreshTokenValidationResult(claims.getSubject(), isExpired);
    }

    // 6. Refresh Token 쿠키 생성
    public ResponseCookie createRefreshTokenCookie(String refreshToken) {
        return ResponseCookie.from("refreshToken", refreshToken)
                .maxAge(refreshExpiration / 1000) // ms -> s 변환
                .path("/")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .build();
    }

    // 7. Token 삭제 쿠키 생성
    public ResponseCookie deleteToken() {
        return ResponseCookie.from("refreshToken", "")
                .maxAge(0)
                .path("/")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .build();
    }

    // --- Private Helper Methods (중복 로직 공통화) ---

    private String createSingleToken(String email, String type, long expirationMs, boolean includeJti) throws JOSEException {
        Date now = new Date();
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .subject(email)
                .claim("type", type)
                .issueTime(now)
                .expirationTime(new Date(now.getTime() + expirationMs));

        if (includeJti) {
            builder.jwtID(UUID.randomUUID().toString());
        }

        SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), builder.build());
        signedJWT.sign(signer);
        return signedJWT.serialize();
    }

    private JWTClaimsSet parseAndVerifyToken(String token) throws Exception {
        SignedJWT signedJWT = SignedJWT.parse(token);
        if (!signedJWT.verify(verifier)) {
            throw new IllegalArgumentException("토큰 서명이 올바르지 않습니다.");
        }
        return signedJWT.getJWTClaimsSet();
    }
}