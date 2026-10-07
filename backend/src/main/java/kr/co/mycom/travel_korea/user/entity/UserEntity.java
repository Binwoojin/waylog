package kr.co.mycom.travel_korea.user.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(name = "uk_users_email", columnNames = {"EMAIL"}),
        @UniqueConstraint(name = "uk_users_nickname", columnNames = {"NICKNAME"})
})
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "USER_ID")
    private Long id;
    @Column(name = "EMAIL",nullable = false)
    private String email;
    @Column(name = "NICKNAME",nullable = false, length = 30)
    private String nickname;
    @Column(name = "PASSWORD_HASH",nullable = false,  length = 128)
    private String password;
    @Column(name = "INTRODUCE", length = 200)
    private String introduce;
    @Column(name = "PROFILE_IMAGE")
    private String profileImageUrl;
    @Column(name = "GENDER", length = 10)
    private String gender;
    @Column(name = "GRADE")
    private String grade;
    @Column(nullable = false, name = "CREATED_AT")
    private LocalDateTime createdAt;

    /*
     * 활동 정지(기간제 로그인 차단, admin-dashboard 설계 §3.2.1)
     *
     * boolean 플래그를 두지 않고 만료 시각만 저장한다.
     * "정지 중"인지는 저장된 상태가 아니라 isSuspended()가 매번 현재 시각과 비교해 계산하는 값이라,
     * 정지가 끝났을 때 별도 배치나 스케줄러로 상태를 되돌릴 필요가 없다.
     */
    @Column(name = "SUSPENDED_UNTIL")
    private LocalDateTime suspendedUntil;
    @Column(name = "SUSPENSION_REASON", length = 255)
    private String suspensionReason;
    @Column(name = "SUSPENDED_AT")
    private LocalDateTime suspendedAt;

    /*
     * 회원 탈퇴(mypage-bookmarks 설계 §3.1, §3.3)
     *
     * FeedPost.author가 nullable=false FK라 하드 삭제가 불가능해 소프트 삭제(계정 비활성)로
     * 처리한다. suspendedUntil과 달리 "현재 시각과 비교"하는 계산이 아니다 — 탈퇴는 기간제가
     * 아니라 영구적인 조치이므로 withdrawnAt이 null이 아니면 무조건 탈퇴 상태다.
     */
    @Column(name = "WITHDRAWN_AT")
    private LocalDateTime withdrawnAt;

    public UserEntity(String email, String password, String nickname, String grade) {
        this.email = email;
        this.password = password;
        this.nickname = nickname;
        this.grade = grade;
        this.createdAt = LocalDateTime.now();
    }

    public void changePassword(String password) {
        this.password = password;
    }

    public void changeGrade(String grade) {
        this.grade = grade;
    }

    /**
     * 현재 시각 기준으로 정지 중인지 판단한다.
     *
     * Design Ref: §3.2.1, §4.2 — suspendedUntil이 null이거나 과거면 정지 아님,
     * 미래 시각이면 정지 중. 로그인·리프레시·JwtAuthenticationFilter 세 지점이
     * 모두 이 메서드 하나를 호출해 판정 기준을 한 곳에 둔다.
     */
    public boolean isSuspended() {
        return suspendedUntil != null && suspendedUntil.isAfter(LocalDateTime.now());
    }

    /**
     * 활동 정지를 적용한다. 과거 정지 이력은 남기지 않고 세 필드를 덮어쓴다.
     *
     * Design Ref: §3.2.2 — PATCH .../suspension은 항상 최신 정지 상태만 유지한다.
     */
    public void suspend(LocalDateTime suspendedUntil, String suspensionReason, LocalDateTime suspendedAt) {
        this.suspendedUntil = suspendedUntil;
        this.suspensionReason = suspensionReason;
        this.suspendedAt = suspendedAt;
    }

    /**
     * 활동 정지를 조기 해제한다. 세 필드를 모두 null로 되돌린다.
     *
     * Design Ref: §3.2.2 — DELETE .../suspension
     */
    public void liftSuspension() {
        this.suspendedUntil = null;
        this.suspensionReason = null;
        this.suspendedAt = null;
    }

    /**
     * 탈퇴 여부를 판단한다. suspendedUntil처럼 "현재 시각과 비교"하는 계산이 아니라
     * withdrawnAt이 null이 아니면 무조건 탈퇴 상태다(탈퇴는 기간제가 아니라 영구적이므로
     * isSuspended()와 달리 시각 비교가 필요 없다).
     *
     * Design Ref: mypage-bookmarks 설계 §3.1
     */
    public boolean isWithdrawn() {
        return withdrawnAt != null;
    }

    /**
     * 회원 탈퇴를 처리한다. suspend()와 달리 되돌리는 메서드(liftWithdrawal)를 두지 않는다
     * — 탈퇴는 사용자가 직접 요청한 영구적 조치이고, 관리자가 임의로 푸는 기능은
     * 이번 범위에 없다(필요해지면 후속 관리자 기능에서 별도로 설계).
     *
     * Design Ref: mypage-bookmarks 설계 §3.1, §3.3(최소 범위 — 재로그인 차단까지만)
     */
    public void withdraw(LocalDateTime withdrawnAt) {
        this.withdrawnAt = withdrawnAt;
    }

    /**
     * 마이페이지 프로필 수정 — 닉네임·소개만 변경한다. 프로필 이미지는
     * updateProfileImage()로 분리한다(이미지 업로드 실패와 텍스트 저장 실패를
     * 같은 트랜잭션에서 섞지 않기 위함).
     *
     * Design Ref: mypage-bookmarks 설계 §3.1
     */
    public void updateProfile(String nickname, String introduce) {
        this.nickname = nickname;
        this.introduce = introduce;
    }

    public void updateProfileImage(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }
}
