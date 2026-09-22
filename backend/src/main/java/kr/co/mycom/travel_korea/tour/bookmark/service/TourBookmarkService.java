package kr.co.mycom.travel_korea.tour.bookmark.service;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmarkGroup;
import kr.co.mycom.travel_korea.tour.bookmark.domain.TourBookmark;
import kr.co.mycom.travel_korea.tour.bookmark.dto.TourBookmarkResponse;
import kr.co.mycom.travel_korea.tour.bookmark.dto.TourBookmarkToggleRequest;
import kr.co.mycom.travel_korea.tour.bookmark.dto.TourBookmarkToggleResponse;
import kr.co.mycom.travel_korea.tour.bookmark.repository.TourBookmarkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TourBookmarkService {

    private final TourBookmarkRepository tourBookmarkRepository;
    private final UserRepository userRepository;

    /**
     * 북마크를 저장하거나 이미 저장되어 있다면 해제합니다.
     */
    @Transactional
    public TourBookmarkToggleResponse toggle(
            String loginEmail,
            TourBookmarkToggleRequest request
    ) {
        UserEntity user = findUser(loginEmail);

        return tourBookmarkRepository
                .findByUser_IdAndContentIdAndContentTypeId(
                        user.getId(),
                        request.contentId(),
                        request.contentTypeId()
                )
                .map(bookmark -> {
                    // 이미 저장된 항목이면 삭제합니다.
                    tourBookmarkRepository.delete(bookmark);
                    return new TourBookmarkToggleResponse(false, null);
                })
                .orElseGet(() -> {
                    TourBookmarkGroup group =
                            resolveCategoryGroup(request.contentTypeId());

                    TourBookmark bookmark = new TourBookmark(
                            user,
                            request.contentId(),
                            request.contentTypeId(),
                            request.title().trim(),
                            request.imageUrl(),
                            request.address(),
                            request.categoryName(),
                            group
                    );

                    TourBookmark savedBookmark =
                            tourBookmarkRepository.save(bookmark);

                    return new TourBookmarkToggleResponse(
                            true,
                            savedBookmark.getId()
                    );
                });
    }

    /**
     * 여행지 또는 여행 즐기기 탭의 북마크 목록을 조회합니다.
     */
    public Page<TourBookmarkResponse> getMyBookmarks(
            String loginEmail,
            TourBookmarkGroup categoryGroup,
            int page,
            int size
    ) {
        UserEntity user = findUser(loginEmail);

        // 프론트는 1페이지부터 시작하고, Spring Data는 0페이지부터 시작합니다.
        int pageIndex = Math.max(page - 1, 0);
        int pageSize = Math.min(Math.max(size, 1), 20);

        Pageable pageable = PageRequest.of(pageIndex, pageSize);

        return tourBookmarkRepository
                .findByUser_IdAndCategoryGroupOrderByCreatedAtDesc(
                        user.getId(),
                        categoryGroup,
                        pageable
                )
                .map(TourBookmarkResponse::from);
    }

    /**
     * 콘텐츠 유형으로 여행지/여행 즐기기 탭을 자동 분류합니다.
     */
    private TourBookmarkGroup resolveCategoryGroup(Integer contentTypeId) {
        return switch (contentTypeId) {
            case 12, 14 -> TourBookmarkGroup.DESTINATION;
            case 15, 28, 32, 38, 39 -> TourBookmarkGroup.ENJOY;
            default -> throw new IllegalArgumentException(
                    "북마크할 수 없는 콘텐츠 유형입니다. contentTypeId="
                            + contentTypeId
            );
        };
    }

    private UserEntity findUser(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new IllegalArgumentException("회원 정보를 찾을 수 없습니다.")
                );
    }
}