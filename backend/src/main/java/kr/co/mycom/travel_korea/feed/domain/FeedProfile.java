package kr.co.mycom.travel_korea.feed.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "feed_profile")
public class FeedProfile {

    /*
     * users.USER_ID와 같은 값을 사용합니다.
     * 회원 한 명당 SNS 프로필은 하나만 만들 수 있으므로
     * 별도의 profile_id 대신 user_id를 기본키로 사용합니다.
     */
    @Id
    @Column(name = "user_id")
    private Long userId;

    /*
     * SNS 화면에서만 사용하는 @아이디입니다.
     * DB의 UNIQUE 인덱스가 중복을 최종적으로 막아 줍니다.
     */
    @Column(name = "feed_handle", nullable = false, length = 20)
    private String feedHandle;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public FeedProfile(Long userId, String feedHandle) {
        this.userId = userId;
        this.feedHandle = feedHandle;
    }

    /**
     * SNS 피드 아이디만 변경합니다.
     * 회원 전체 닉네임은 users 테이블에서 별도로 유지됩니다.
     */
    public void updateHandle(String feedHandle) {
        this.feedHandle = feedHandle;
    }

    @PrePersist
    private void prePrePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

}
