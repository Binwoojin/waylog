package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedLike;
import kr.co.mycom.travel_korea.feed.domain.FeedLikeId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FeedLikeRepository extends JpaRepository<FeedLike, FeedLikeId> {

    boolean existsByFeedPost_IdAndUser_Id(Long feedPostId, Long userId);

    /*
     * 피드 목록에 표시되는 여러 게시글의 좋아요 여부를 한 번에 조회합니다.
     * 게시글마다 exists 쿼리를 실행하는 호출 낭비를 줄이기 위한 메서드입니다.
     */
    List<FeedLike> findByUser_IdAndFeedPost_IdIn(Long userId, Collection<Long> feedPostIds);

    /**
     * 특정 회원이 작성한 모든 게시글이 받은 좋아요 수를 조회합니다.
     */
    long countByFeedPost_Author_Id(Long userId);
}
