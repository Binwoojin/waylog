package kr.co.mycom.travel_korea.user.dto;

/**
 * 회원 등급 변경 요청 (admin-dashboard 설계 §4.1)
 */
public record UserGradeUpdateRequest(
        String grade
) {
}
