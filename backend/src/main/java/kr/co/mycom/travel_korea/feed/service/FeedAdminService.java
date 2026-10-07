package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.feed.domain.FeedPhoto;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminDeleteRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminListItemResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedAdminPostResponse;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.service.UserSuspensionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * 관리자 피드 목록/상세/삭제를 처리한다.
 *
 * Design Ref: admin-dashboard 설계 §2.4, §3.4, §4.1.
 * FeedService의 기존 공개 delete(postId, email)은 손대지 않는다(일반 사용자 본인 삭제
 * 동작 회귀 방지). 이 서비스는 소유권 검사 없이 feedPostRepository.findById 계열로
 * 조회한 뒤 소프트/하드 삭제를 처리한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedAdminService {

    private static final String TYPE_NORMAL = "NORMAL";
    private static final String TYPE_POLICY_VIOLATION = "POLICY_VIOLATION";

    private final FeedPostRepository feedPostRepository;
    private final StorageService storageService;
    private final UserSuspensionService userSuspensionService;

    /**
     * 관리자 피드 목록(삭제 포함). deletedAt 조건 없이 전체를 최신순으로 조회한다(설계 §3.4.2).
     *
     * 프론트 페이지 번호는 1부터 시작한다(FeedController.getFeed와 동일한 관례).
     */
    public FeedAdminPageResponse list(int page, int size) {
        int safePage = Math.max(0, page - 1);
        int safeSize = Math.min(Math.max(1, size), 50);

        Pageable pageable = PageRequest.of(safePage, safeSize);
        Page<FeedPost> result = feedPostRepository.findAllByOrderByCreatedAtDesc(pageable);

        List<FeedAdminListItemResponse> items = result.getContent().stream()
                .map(FeedAdminListItemResponse::from)
                .toList();

        return new FeedAdminPageResponse(items, page, size, result.getTotalElements());
    }

    /**
     * 관리자 피드 상세(삭제 포함). 기존 findWithDetailsById를 그대로 재사용한다(설계 §3.4.2).
     */
    public FeedAdminPostResponse getOne(Long postId) {
        FeedPost post = findAnyPost(postId);
        return FeedAdminPostResponse.from(post, this::toReadableImageUrl);
    }

    /**
     * 관리자 삭제 API의 진입점. type에 따라 소프트/하드 삭제로 분기한다(설계 §3.4.3).
     *
     * currentAdminEmail은 UserAdminService.suspend(targetUserId, currentAdminEmail, ...)와
     * 동일한 패턴으로 컨트롤러(FeedAdminController.currentAdminEmail())가 SecurityContext에서
     * 가져와 넘겨준다(FR-U06 자기 자신 대상 차단, 서비스 계층 테스트에서도 그대로 값 주입 가능).
     */
    @Transactional
    public void delete(Long postId, FeedAdminDeleteRequest request, String currentAdminEmail) {
        String type = normalizeType(request.type());

        if (TYPE_POLICY_VIOLATION.equals(type)) {
            FeedPost post = findAnyPost(postId);
            Long authorId = post.getAuthor().getId();

            if (Boolean.TRUE.equals(request.suspendAuthor())) {
                ensureNotSelf(post.getAuthor(), currentAdminEmail);
            }

            hardDelete(post);

            if (Boolean.TRUE.equals(request.suspendAuthor())) {
                int days = requireSuspensionDays(request.suspensionDays());
                userSuspensionService.suspend(authorId, days, request.reason());
            }
            return;
        }

        FeedPost post = findAnyPost(postId);
        post.softDelete(request.reason());
    }

    /*
     * 정책위반 삭제 시 "작성자 정지" 체크박스가 켜져 있으면, 정지 대상이 현재 로그인한
     * 관리자 자신인지 확인한다(UserAdminService.ensureNotSelf와 동일한 패턴, FR-U06).
     * 자기 자신이면 UserSuspensionService.suspend까지 도달하지 못하도록 여기서 막는다
     * (UserSuspensionService 자체에는 self-check가 없음).
     */
    private void ensureNotSelf(UserEntity author, String currentAdminEmail) {
        if (author.getEmail().equals(currentAdminEmail)) {
            throw new AccessDeniedException("본인 계정은 대상으로 지정할 수 없습니다.");
        }
    }

    private void hardDelete(FeedPost post) {
        List<String> imageKeys = post.getPhotos().stream()
                .map(FeedPhoto::getImageUrl)
                .filter(Objects::nonNull)
                .filter(key -> !key.isBlank())
                .toList();

        feedPostRepository.delete(post);

        imageKeys.forEach(storageService::delete);
    }

    private FeedPost findAnyPost(Long postId) {
        return feedPostRepository.findWithDetailsById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
    }

    private String normalizeType(String type) {
        if (type == null) {
            throw new IllegalArgumentException("삭제 유형은 NORMAL 또는 POLICY_VIOLATION만 가능합니다.");
        }

        String normalized = type.trim().toUpperCase();

        if (!normalized.equals(TYPE_NORMAL) && !normalized.equals(TYPE_POLICY_VIOLATION)) {
            throw new IllegalArgumentException("삭제 유형은 NORMAL 또는 POLICY_VIOLATION만 가능합니다.");
        }

        return normalized;
    }

    private int requireSuspensionDays(Integer suspensionDays) {
        if (suspensionDays == null) {
            throw new IllegalArgumentException("작성자를 정지하려면 정지 기간을 입력해야 합니다.");
        }

        return suspensionDays;
    }

    /*
     * FeedService.toReadableImageUrl과 동일한 규칙(objectKey -> presigned URL,
     * 기존 완성 URL은 그대로 반환)을 관리자 응답에도 적용한다.
     */
    private String toReadableImageUrl(String imageValue) {
        if (imageValue == null || imageValue.isBlank()) {
            return null;
        }

        if (imageValue.startsWith("http://") || imageValue.startsWith("https://")) {
            return imageValue;
        }

        return storageService.createReadUrl(imageValue);
    }
}
