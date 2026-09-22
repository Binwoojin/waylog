package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedComment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeedCommentRepository extends JpaRepository<FeedComment, Long> {
    @EntityGraph(attributePaths = "author")
    List<FeedComment> findByFeedPost_IdOrderByCreatedAtAsc(Long feedPostId);
}
