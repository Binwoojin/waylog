package kr.co.mycom.travel_korea.user.repository;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity,Long> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByNickname(String NickName);
    boolean existsByEmail(String email);
}
