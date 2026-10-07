package kr.co.mycom.travel_korea.user.dto;

import kr.co.mycom.travel_korea.user.entity.UserEntity;

import java.time.LocalDateTime;

/**
 * 관리자 회원 목록/상세 응답 (admin-dashboard 설계 §3.2, §4.1)
 *
 * suspended는 서버가 계산해 내려주는 값이다(프론트가 suspendedUntil을 다시 비교하지 않도록).
 */
public record UserAdminResponse(
        Long id,
        String email,
        String nickname,
        String grade,
        LocalDateTime createdAt,
        LocalDateTime suspendedUntil,
        String suspensionReason,
        LocalDateTime suspendedAt,
        boolean suspended
) {
    public static UserAdminResponse from(UserEntity user) {
        return new UserAdminResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getGrade(),
                user.getCreatedAt(),
                user.getSuspendedUntil(),
                user.getSuspensionReason(),
                user.getSuspendedAt(),
                user.isSuspended()
        );
    }
}
