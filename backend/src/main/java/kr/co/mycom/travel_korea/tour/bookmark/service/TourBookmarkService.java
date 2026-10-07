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

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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
     * 상세 조회 화면에서 현재 로그인 사용자의 북마크 여부를 단건 확인합니다.
     *
     * 비로그인 사용자(loginEmail == null)는 항상 false입니다. 상세 조회 자체는 인증 없이도
     * 가능해야 하므로(SecurityConfig permitAll), 이 메서드는 로그인 여부로 분기만 하고
     * 예외를 던지지 않습니다.
     */
    public boolean isBookmarked(String loginEmail, String contentId, Integer contentTypeId) {
        if (loginEmail == null || loginEmail.isBlank()) {
            return false;
        }

        return userRepository.findByEmail(loginEmail)
                .map(user -> tourBookmarkRepository.existsByUser_IdAndContentIdAndContentTypeId(
                        user.getId(), contentId, contentTypeId
                ))
                .orElse(false);
    }

    /**
     * 목록 조회 화면에서 여러 콘텐츠의 북마크 여부를 한 번에 확인합니다(N+1 방지).
     *
     * 반환값은 {@link #bookmarkKey}로 만든 "contentId:contentTypeId" 키 집합입니다.
     * 비로그인 사용자이거나 조회할 콘텐츠가 없으면 빈 집합을 돌려줍니다.
     */
    public Set<String> findBookmarkedKeys(String loginEmail, List<String> contentIds) {
        if (loginEmail == null || loginEmail.isBlank() || contentIds == null || contentIds.isEmpty()) {
            return Set.of();
        }

        return userRepository.findByEmail(loginEmail)
                .map(user -> tourBookmarkRepository.findByUser_IdAndContentIdIn(user.getId(), contentIds)
                        .stream()
                        .map(bookmark -> bookmarkKey(bookmark.getContentId(), bookmark.getContentTypeId()))
                        .collect(Collectors.toSet()))
                .orElse(Set.of());
    }

    /**
     * findBookmarkedKeys가 돌려주는 키와 같은 형식으로 비교용 키를 만듭니다.
     * 호출하는 쪽(컨트롤러)이 콘텐츠의 contentId·contentTypeId로 같은 키를 만들어 contains로 비교합니다.
     */
    public static String bookmarkKey(String contentId, Integer contentTypeId) {
        return contentId + ":" + contentTypeId;
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