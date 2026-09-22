package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FeedPostRepository extends JpaRepository<FeedPost, Long> {
    /*
     * 작성자 정보가 LAZY이므로 피드 목록 조회 시 author를 함께 가져옵니다.
     * 사진과 태그는 컬렉션이므로 서비스 트랜잭션 안에서 조회합니다.
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByVisibility(String  visibility, Pageable pageable);

    /*
     * photos와 tags를 동시에 fetch join하면
     * 사진 수 × 태그 수만큼 조인 결과가 늘어날 수 있습니다.
     *
     * photos만 함께 조회하고, tags는 FeedService의 트랜잭션 안에서
     * 필요한 시점에 별도 조회하도록 합니다.
     */

    @EntityGraph(attributePaths = {"author", "photos"})
    Optional<FeedPost> findWithDetailsById(Long id);

    /**
     * 로그인한 회원이 작성한 게시글을 조회합니다.
     *
     * 공개/비공개 여부와 관계없이 본인 게시글은 모두 조회합니다.
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByAuthor_Id(Long userId, Pageable pageable);
}
