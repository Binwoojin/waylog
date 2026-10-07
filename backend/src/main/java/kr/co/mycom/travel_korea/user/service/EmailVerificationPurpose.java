package kr.co.mycom.travel_korea.user.service;

/**
 * 이메일 인증번호와 인증 티켓의 용도입니다.
 *
 * 용도가 다르면 인증번호·티켓 캐시 키도 달라서 한 흐름이 다른 흐름의 값을 덮어쓰지 못하고,
 * 소모 단계에서도 발급된 용도와 같은 흐름에서만 티켓을 쓸 수 있습니다.
 */
public enum EmailVerificationPurpose {
    SIGNUP,
    RESET_PASSWORD;

    /** 요청의 문자열 용도를 해석합니다. 빈 값이나 알 수 없는 값은 거부합니다(fail-closed). */
    public static EmailVerificationPurpose from(String value) {
        if (value == null) {
            throw new IllegalArgumentException("인증 용도를 확인해 주세요.");
        }
        for (EmailVerificationPurpose purpose : values()) {
            if (purpose.name().equals(value)) {
                return purpose;
            }
        }
        throw new IllegalArgumentException("인증 용도를 확인해 주세요.");
    }

    /** 용도와 이메일을 함께 쓰는 캐시 키입니다. */
    public String keyOf(String email) {
        return name() + ":" + email;
    }
}
