package kr.co.mycom.travel_korea.tour.bookmark.repository;

import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmark;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmarkGroup;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * TourAPI 콘텐츠 북마크 저장소입니다.
 */

public interface TourBookmarkRepository extends JpaRepository<TourBookmark, Long> {

    /**
     * 같은 콘텐츠가 이미 북마크되어 있는지 확인합니다.
     */
    Optional<TourBookmark> findByUser_IdAndContentIdAndContentTypeId(
            Long userId,
            String contentId,
            Integer contentTypeId
    );

    /**
     * 북마크 페이지의 탭별 목록을 최신 저장 순으로 조회합니다.
     */
    Page<TourBookmark> findByUser_IdAndCategoryGroupOrderByCreatedAtDesc(
            Long userId,
            TourBookmarkGroup categoryGroup,
            Pageable pageable
    );

    /**
     * 목록 카드에서 현재 사용자의 북마크 여부를 확인할 때 사용합니다.
     */
    boolean existsByUser_IdAndContentIdAndContentTypeId(
            Long userId,
            String contentId,
            Integer contentTypeId
    );
}
