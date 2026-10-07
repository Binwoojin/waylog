package kr.co.mycom.travel_korea.user.service;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository repo;
    private final PasswordEncoder passwordEncoder;

    /*
     * mypage-bookmarks 설계 §4.4, §9: 탈퇴 성공 시 리프레시 쿠키를 즉시 만료시키기 위해
     * AuthService.logout()이 이미 만드는 Max-Age=0 쿠키를 재사용한다.
     * AuthService는 UserService를 참조하지 않으므로(의존 방향: UserService -> AuthService
     * 단방향) 순환 의존이 생기지 않는다.
     */
    private final AuthService authService;

    /**
     * 이메일로 회원 정보를 조회합니다.
     *
     * Repository가 Optional<UserEntity>를 반환하므로
     * 회원이 없으면 예외를 발생시키도록 처리합니다.
     */

    public UserEntity findUserInfo(String email) {
        return repo.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("해당 이메일의 회원을 찾을 수 없습니다."));

    }

    /**
     * 동일한 닉네임이 등록되어 있는지 확인합니다.
     */

    public boolean existNickname(String nickname) {
        return repo.existsByNickname(nickname);
    }

    /**
     * 동일한 이메일이 등록되어 있는지 확인합니다.
     */

    public boolean existEmail(String email) {
        return repo.existsByEmail(email);
    }

    /**
     * 회원 탈퇴를 처리합니다(mypage-bookmarks 설계 §4.4, §3.3 — 최소 범위: 재로그인 차단까지만).
     *
     * 비밀번호 재확인에 실패하면 탈퇴를 진행하지 않습니다. 성공하면 UserEntity를 소프트 삭제
     * 상태(withdrawnAt 설정)로 전환하고, 이미 발급된 리프레시 토큰도 즉시 무효화되도록
     * 만료된 쿠키를 반환합니다(로그인/리프레시/JwtAuthenticationFilter 3개 체크포인트가
     * 이후 요청에서 이 상태를 각각 검사합니다).
     */
    @Transactional
    public ResponseCookie withdraw(String email, String rawPassword) {
        UserEntity user = findUserInfo(email);

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
        }

        user.withdraw(LocalDateTime.now());

        return authService.logout();
    }
}
