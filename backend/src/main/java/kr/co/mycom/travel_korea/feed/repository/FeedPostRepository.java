package kr.co.mycom.travel_korea.feed.repository;

import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeedPostRepository extends JpaRepository<FeedPost, Long> {
    /*
     * 작성자 정보가 LAZY이므로 피드 목록 조회 시 author를 함께 가져옵니다.
     * 사진과 태그는 컬렉션이므로 서비스 트랜잭션 안에서 조회합니다.
     *
     * admin-dashboard 설계 §3.4.2: 공개 목록에서 소프트 삭제된 게시물을 제외하기 위해
     * 기존 findByVisibility(String, Pageable)를 이 메서드로 대체한다.
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByVisibilityAndDeletedAtIsNull(String  visibility, Pageable pageable);

    /*
     * feed-integration 설계 §4.2(P-3): 무한 스크롤 타임라인용 커서 기반 조회.
     * id는 GenerationType.IDENTITY라 생성 순서와 항상 일치하므로, id 하나만으로
     * "이미 본 항목보다 오래된 것만" 안전하게 조회할 수 있다(복합 커서 불필요).
     *
     * 첫 페이지(cursor 없음) 조회용.
     */
    @EntityGraph(attributePaths = "author")
    List<FeedPost> findByVisibilityAndDeletedAtIsNullOrderByIdDesc(String visibility, Pageable pageable);

    /*
     * 다음 페이지(cursor 있음) 조회용. cursor보다 id가 작은(=더 오래된) 게시물만 가져온다.
     */
    @EntityGraph(attributePaths = "author")
    List<FeedPost> findByVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc(String visibility, Long cursorId, Pageable pageable);

    /*
     * feed-integration 설계 §4.4(P-6): 타인 프로필 조회는 PUBLIC 게시물만 노출한다
     * (본인 프로필의 findByAuthor_Id는 공개/비공개 모두 보여주는 것과 대비).
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByAuthor_IdAndVisibilityAndDeletedAtIsNull(Long userId, String visibility, Pageable pageable);

    /*
     * photos와 tags를 동시에 fetch join하면
     * 사진 수 × 태그 수만큼 조인 결과가 늘어날 수 있습니다.
     *
     * photos만 함께 조회하고, tags는 FeedService의 트랜잭션 안에서
     * 필요한 시점에 별도 조회하도록 합니다.
     *
     * 관리자 상세(삭제된 게시물도 조회 가능해야 함)용으로 그대로 남겨둔다(설계 §3.4.2).
     */

    @EntityGraph(attributePaths = {"author", "photos"})
    Optional<FeedPost> findWithDetailsById(Long id);

    /*
     * 공개 상세(GET /api/v1/feed/posts/{id})에서 소프트 삭제된 게시물을 제외하기 위해
     * 추가한다(설계 §3.4.2). 기존 findWithDetailsById는 관리자 상세용으로 유지한다.
     */
    @EntityGraph(attributePaths = {"author", "photos"})
    Optional<FeedPost> findWithDetailsByIdAndDeletedAtIsNull(Long id);

    /**
     * 로그인한 회원이 작성한 게시글을 조회합니다.
     *
     * 공개/비공개 여부와 관계없이 본인 게시글은 모두 조회합니다.
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findByAuthor_Id(Long userId, Pageable pageable);

    /*
     * 관리자 목록 조회용(설계 §3.4.2). deletedAt 조건 없이 전체를 최신순으로 조회한다
     * (소프트 삭제된 글도 상태와 사유를 보여주기 위해 그대로 포함해야 하므로).
     */
    @EntityGraph(attributePaths = "author")
    Page<FeedPost> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
