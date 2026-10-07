package kr.co.mycom.travel_korea.user.repository;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity,Long> {
    Optional<UserEntity> findByEmail(String email);
    boolean existsByNickname(String NickName);
    boolean existsByEmail(String email);

    /*
     * 관리자 회원 목록 검색 (admin-dashboard 설계 §4.1)
     *
     * PostRepository.search와 같은 패턴: keyword가 없으면 전체,
     * 있으면 닉네임/이메일에 대소문자 구분 없이 부분 일치.
     */
    @Query("""
    select u from UserEntity u
    where (:keyword is null or :keyword = ''
    or lower(u.nickname) like lower(concat('%', :keyword, '%'))
    or lower(u.email) like lower(concat('%', :keyword, '%')))
    """)
    Page<UserEntity> search(String keyword, Pageable pageable);
}
