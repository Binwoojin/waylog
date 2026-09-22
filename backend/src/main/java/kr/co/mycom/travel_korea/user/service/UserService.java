package kr.co.mycom.travel_korea.user.service;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository repo;

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
}
