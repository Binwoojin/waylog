package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FeedProfileRepository extends JpaRepository<FeedProfile, Long> {

    /**
     * 회원 ID로 SNS 프로필을 찾습니다.
     */
    Optional<FeedProfile> findByUserId(Long userId);

    /**
     * 다른 사용자가 이미 같은 피드 아이디를 사용 중인지 확인합니다.
     */
    boolean existsByFeedHandle(String feedHandle);
}
