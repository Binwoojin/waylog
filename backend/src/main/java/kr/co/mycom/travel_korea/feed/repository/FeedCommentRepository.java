package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * feed-comment-integration 설계 §4.2 — 최상위 댓글 페이지네이션 조회.
 *
 * code-review Must Fix 1: replies는 @OneToMany 컬렉션(bag)이라 Pageable(LIMIT/OFFSET)과
 * to-many fetch join을 함께 쓰면 Hibernate가 SQL 페이지네이션을 포기하고 해당 게시물의
 * 최상위 댓글+답글 전체를 메모리로 읽은 뒤 애플리케이션에서 잘라낸다. FeedPostRepository의
 * "photos와 tags를 동시에 fetch join하지 않는다" 원칙(46행 부근 주석)과 같은 이유로,
 * 여기서도 replies는 EntityGraph에서 빼고 별도 쿼리(findByParent_IdIn)로 조회한다.
 */
public interface FeedCommentRepository extends JpaRepository<FeedComment, Long> {

    @EntityGraph(attributePaths = {"author"})
    Page<FeedComment> findByFeedPost_IdAndParentIsNullOrderByCreatedAtAsc(Long feedPostId, Pageable pageable);

    /*
     * 위에서 조회한 최상위 댓글 id 목록으로 답글만 별도 조회한다(2단계 쿼리).
     * IN 절 하나로 끝나 페이지 크기와 무관하게 고정된 쿼리 수(최상위 1회 + 답글 1회)를 유지한다.
     */
    @EntityGraph(attributePaths = {"author"})
    List<FeedComment> findByParent_IdInOrderByCreatedAtAsc(List<Long> parentIds);
}
