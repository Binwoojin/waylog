package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedBookMark;
import kr.co.mycom.travel_korea.feed.domain.FeedBookMarkId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FeedBookMarkRepository extends JpaRepository<FeedBookMark, FeedBookMarkId> {
    boolean existsByFeedPost_IdAndUser_Id(Long feedPostId, Long userId);

    List<FeedBookMark> findByUser_IdAndFeedPost_IdIn(Long userId, Collection<Long> feedPostIds);

    /*
     * mypage-bookmarks 설계 §4.5(Q-5, Q-7): 북마크 목록 조회. 북마크한 시각(createdAt)
     * 내림차순으로 정렬하고, 원글이 소프트 삭제된 북마크는 제외한다. 상세 화면과 동일하게
     * author까지 함께 페치해 N+1을 피한다.
     */
    @EntityGraph(attributePaths = {"feedPost", "feedPost.author"})
    Page<FeedBookMark> findByUser_IdAndFeedPost_DeletedAtIsNullOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
