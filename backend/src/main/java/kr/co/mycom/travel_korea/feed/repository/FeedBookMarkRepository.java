package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedBookMark;
import kr.co.mycom.travel_korea.feed.domain.FeedBookMarkId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FeedBookMarkRepository extends JpaRepository<FeedBookMark, FeedBookMarkId> {
    boolean existsByFeedPost_IdAndUser_Id(Long feedPostId, Long userId);

    List<FeedBookMark> findByUser_IdAndFeedPost_IdIn(Long userId, Collection<Long> feedPostIds);
}
