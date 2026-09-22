package kr.co.mycom.travel_korea.user.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "users")
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "USER_ID")
    private Long id;
    @Column(name = "EMAIL",nullable = false, unique = true)
    private String email;
    @Column(name = "NICKNAME",nullable = false, length = 30, unique = true)
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
}
