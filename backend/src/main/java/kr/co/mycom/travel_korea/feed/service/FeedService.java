package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.board.storage.StoredObject;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.feed.domain.*;
import kr.co.mycom.travel_korea.feed.dto.FeedCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedTimelineResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedPostResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedUpdateRequest;
import kr.co.mycom.travel_korea.feed.repository.FeedBookMarkRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedLikeRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.parameters.P;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedService {

    private final FeedPostRepository feedPostRepository;
    private final FeedLikeRepository feedLikeRepository;
    private final FeedBookMarkRepository feedBookMarkRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final CourseLinkResolver courseLinkResolver;

    // 피드 게시글 하나에 등록할 수 있는 최대 이미지 수
    private static final int MAX_IMAGE_COUNT = 5;

    // 이미지 한 장의 최대 허용 용량(5MB)
    private static final long MAX_IMAGE_SIZE = 5*1024*1024;

    // 허용할 이미지 MIME 타입 목록
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    @Transactional
    public FeedPostResponse create(String loginEmail, FeedCreateRequest request, List<MultipartFile> images) {
        UserEntity author = findUser(loginEmail);

        // 요청으로 들어온 이미지의 개수, 빈 파일, 형식, 용량을 먼저 검사
        validateImages(images);

        List<MultipartFile> safeImages = normalizeFiles(images);

        FeedPost post = new FeedPost(
                author,
                request.content().trim(),
                request.locationName(),
                request.address(),
                request.latitude(),
                request.longitude(),
                request.tourContentId(),
                request.tourContentTypeId(),
                normalizeVisibility(request.visibility())
        );

        post.replaceTags(request.tags());

        /*
         * 여행코스 참조(tour-course-feed-linking 설계 §4.2). CourseLinkResolver가
         * dayId→course 체인을 검증하고 스냅샷을 만든 뒤, post.linkCourse()로 생성자
         * 밖에서 별도로 붙인다(§3.1 "replaceTags와 같은 레벨" 원칙). 유효하지 않은
         * dayId/stopId 조합이면 여기서 IllegalArgumentException(400)이 던져진다.
         */
        CourseLinkResolver.CourseLinkSnapshot courseLinkSnapshot =
                courseLinkResolver.resolve(request.linkedCourseDayId(), request.linkedCourseStopId());

        post.linkCourse(
                courseLinkSnapshot.courseId(), courseLinkSnapshot.courseTitle(),
                courseLinkSnapshot.dayId(), courseLinkSnapshot.dayNumber(),
                courseLinkSnapshot.stopId(), courseLinkSnapshot.stopName()
        );

        /*
         * S3 업로드 도중 오류가 생기면
         * 이번 요청에서 업로드한 파일만 정리합니다.
         */

        List<String> uploadedKeys = new ArrayList<>();

        try {
            int sortOrder = 0;

            for (MultipartFile image : safeImages) {
                StoredObject stored = storageService.upload(image);

                uploadedKeys.add(stored.objectKey());

                post.addPhoto(
                        stored.objectKey(),
                        stored.originalFilename(),
                        sortOrder++
                );
            }

            FeedPost savedPost = feedPostRepository.save(post);
            return toResponse(savedPost, false, false);
        } catch (RuntimeException exception) {
            uploadedKeys.forEach(key -> {
                try {
                    storageService.delete(key);
                } catch (RuntimeException ignored) {
                    // 원래 발생한 업로드 오류를 우선 반환
                }
            });
            throw exception;
        }
    }


    /*
     * feed-integration 설계 §4.2(P-3): 오프셋(page/size) 대신 id 기준 커서로 타임라인을 조회한다.
     * id는 IDENTITY 채번이라 생성 순서와 항상 일치하므로, "cursor보다 오래된 것만" 조회하면
     * 스크롤 도중 새 글이 추가돼도 이미 본 항목이 중복되거나 건너뛰어지지 않는다.
     *
     * 이 API를 현재 호출하는 프론트 코드가 없음을 grep으로 확인했으므로
     * page 파라미터를 cursor로 대체하는 것은 하위 호환을 깨지 않는다.
     */
    public FeedTimelineResponse getFeed(String loginEmail, Long cursor, int size) {
        return getFeed(loginEmail, cursor, size, null);
    }

    /*
     * tour-course-feed-linking 설계 §4.4(D-4): linkedCourseId가 있으면 그 코스를
     * 참조한(일자/경유지 어느 단위든) 게시물만 커서 페이지네이션으로 조회한다.
     * linkedCourseId가 null일 때의 분기는 기존 쿼리·동작을 한 글자도 바꾸지 않는다
     * (메인 피드 회귀 방지).
     */
    public FeedTimelineResponse getFeed(String loginEmail, Long cursor, int size, Long linkedCourseId) {
        int pageSize = Math.min(Math.max(size, 1), 30);

        /*
         * COUNT 쿼리 없이 다음 페이지 존재 여부를 알기 위해 1개를 더 조회한다
         * (tour-course-list-integration의 N+1 회피 집계 쿼리와 같은 원칙).
         */
        Pageable pageable = PageRequest.of(0, pageSize + 1);

        List<FeedPost> fetched;

        if (linkedCourseId != null) {
            fetched = (cursor == null)
                    ? feedPostRepository.findByLinkedCourseIdAndVisibilityAndDeletedAtIsNullOrderByIdDesc(linkedCourseId, "PUBLIC", pageable)
                    : feedPostRepository.findByLinkedCourseIdAndVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc(linkedCourseId, "PUBLIC", cursor, pageable);
        } else {
            fetched = (cursor == null)
                    ? feedPostRepository.findByVisibilityAndDeletedAtIsNullOrderByIdDesc("PUBLIC", pageable)
                    : feedPostRepository.findByVisibilityAndDeletedAtIsNullAndIdLessThanOrderByIdDesc("PUBLIC", cursor, pageable);
        }

        boolean hasNext = fetched.size() > pageSize;
        List<FeedPost> pageItems = hasNext ? fetched.subList(0, pageSize) : fetched;

        List<Long> postIds = pageItems.stream()
                .map(FeedPost::getId).toList();

        Set<Long> likedPostIds = new HashSet<>();
        Set<Long> bookmarkedPostIds = new HashSet<>();

        /*
         * 비로그인 사용자도 공개 피드를 조회할 수 있습니다.
         * 로그인 이메일이 있을 때만 개인별 좋아요·저장 여부를 조회합니다.
         */
        if (loginEmail != null && !loginEmail.isBlank() && !postIds.isEmpty()) {
            UserEntity user = findUser(loginEmail);

            feedLikeRepository.findByUser_IdAndFeedPost_IdIn(user.getId(), postIds)
                    .forEach(like -> likedPostIds.add(like.getFeedPost().getId()));

            feedBookMarkRepository.findByUser_IdAndFeedPost_IdIn(user.getId(), postIds)
                    .forEach(bookmark -> bookmarkedPostIds.add(bookmark.getFeedPost().getId()));
        }

        List<FeedPostResponse> responses = pageItems.stream()
                .map(post -> toResponse(
                        post,
                        likedPostIds.contains(post.getId()),
                        bookmarkedPostIds.contains(post.getId())
                )).toList();

        Long nextCursor = pageItems.isEmpty() ? null : pageItems.get(pageItems.size() - 1).getId();

        return new FeedTimelineResponse(responses, nextCursor, hasNext);
    }

    public FeedPostResponse getOne(Long postId, String loginEmail) {
        FeedPost post = findVisiblePost(postId);
        validateVisibility(post, loginEmail);

        boolean liked = false;
        boolean bookmarked = false;

        if (loginEmail != null && !loginEmail.isBlank()) {
            UserEntity user = findUser(loginEmail);

            liked = feedLikeRepository.existsByFeedPost_IdAndUser_Id(postId, user.getId());
            bookmarked = feedBookMarkRepository.existsByFeedPost_IdAndUser_Id(postId, user.getId());
        }

        return toResponse(post, liked, bookmarked);
    }

    // Feed는 SNS 성향이 강한 페이지이기 때문에 게시물 수정 기능은 제외하는 것이 자연스러움
//    @Transactional
//    public FeedPostResponse update(Long postId, String loginEmail, FeedUpdateRequest request) {
//        FeedPost post = findPost(postId);
//        validateAuthor(post, loginEmail);
//
//        post.update(
//                request.content().trim(),
//                request.locationName(),
//                request.address(),
//                request.latitude(),
//                request.longitude(),
//                request.tourContentId(),
//                request.tourContentTypeId(),
//                normalizeVisibility(request.visibility())
//        );
//
//        post.replaceTags(request.tags());
//
//        return toResponse(post,false, false);
//    }

    /**
     * 작성자 본인의 게시글을 삭제합니다.
     * DB 게시글 및 사진 행을 지우고, S3에 남은 실제 이미지 파일도 정리합니다.
     */

    @Transactional
    public void delete(Long postId, String email) {
        FeedPost post = getOwnedPost(postId, email);

        /*
         * DB 삭제 후에는 연관된 FeedPhoto 엔티티에 접근하기 어려울 수 있으므로,
         * 삭제 전에 S3 objectKey를 별도 목록으로 확보합니다.
         */
        List<String> imageKeys = post.getPhotos().stream()
                        .map(FeedPhoto::getImageUrl)
                                .filter(Objects::nonNull)
                                        .filter(key -> !key.isBlank())
                                                .toList();

        /*
         * FeedPost - FeedPhoto 관계에 cascade = CascadeType.ALL,
         * orphanRemoval = true가 설정되어 있다면 feed_photo 행도 함께 삭제됩니다.
         */
        feedPostRepository.delete(post);

        /*
         * DB 삭제 작업이 끝난 뒤 S3에 저장된 이미지 파일을 삭제합니다.
         * delete() 내부에서 S3 삭제 실패는 로그로 남기므로,
         * S3 일시 오류 때문에 게시글 삭제가 실패하지 않습니다.
         */
        imageKeys.forEach(storageService::delete);
    }


    @Transactional
    public boolean toggleLike(Long postId, String loginEmail) {
        UserEntity user = findUser(loginEmail);
        FeedPost post = findPost(postId);
        validateVisibility(post, loginEmail);

        FeedLikeId likeId = new FeedLikeId(post.getId(), user.getId());

        if (feedLikeRepository.existsById(likeId)) {
            feedLikeRepository.deleteById(likeId);
            post.decreaseLikeCount();
            return false;
        }

        feedLikeRepository.save(new FeedLike(post, user));
        post.increaseLikeCount();
        return true;
    }

    @Transactional
    public boolean toggleBookmark(Long postId, String loginEmail) {
        UserEntity user = findUser(loginEmail);
        FeedPost post = findPost(postId);
        validateVisibility(post, loginEmail);

        FeedBookMarkId bookmarkId = new FeedBookMarkId(post.getId(), user.getId());

        if (feedBookMarkRepository.existsById(bookmarkId)) {
            feedBookMarkRepository.deleteById(bookmarkId);
            return false;
        }

        feedBookMarkRepository.save(new FeedBookMark(post, user));
        return true;
    }

    private UserEntity findUser(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }

        return userRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("회원 정보를 찾을 수 없습니다."));
    }

    private FeedPost findPost(Long postId) {

        return feedPostRepository.findWithDetailsById(postId).orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
    }

    /*
     * 공개 상세 조회 전용(admin-dashboard 설계 §3.4.2). 소프트 삭제된 게시물은
     * 일반 사용자에게 "게시글을 찾을 수 없습니다"로 보인다(관리자 상세는 findPost를 그대로 사용).
     */
    private FeedPost findVisiblePost(Long postId) {
        return feedPostRepository.findWithDetailsByIdAndDeletedAtIsNull(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
    }

    /**
     * 게시글을 조회한 뒤, 현재 로그인한 사용자가 작성자인지 검증합니다.
     * 삭제처럼 작성자에게만 허용된 기능에서 사용합니다.
     */
    private FeedPost getOwnedPost(Long postId, String loginEmail) {
        FeedPost post = findPost(postId);

        // 작성자 이메일이 다르면 삭제를 허용하지 않는다.
        validateAuthor(post, loginEmail);

        return post;
    }

    private void validateAuthor(FeedPost post, String loginEmail) {
        if (!post.getAuthor().getEmail().equals(loginEmail)) {
            throw new IllegalArgumentException("게시글 작성자만 수정하거나 삭제할 수 있습니다.");
        }
    }

    /**
     * PRIVATE 게시글은 작성자 본인만 조회·좋아요·북마크할 수 있습니다.
     * 비로그인 사용자나 다른 사용자는 접근할 수 없습니다.
     */
    private void validateVisibility(FeedPost post, String loginEmail) {
        boolean isPrivate = "PRIVATE".equalsIgnoreCase(post.getVisibility());
        boolean isAuthor = loginEmail != null && post.getAuthor().getEmail().equals(loginEmail);

        if (isPrivate && !isAuthor) {
            throw new IllegalArgumentException("비공개 게시글에 접근할 수 없습니다.");
        }
    }

    private String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "PUBLIC";
        }

        String normalized = visibility.toUpperCase();

        if (!normalized.equals("PUBLIC") && !normalized.equals("PRIVATE")) {
            throw new IllegalArgumentException("공개 범위는 PUBLIC 또는 PRIVATE만 가능합니다.");
        }

        return normalized;
    }

    /**
     * S3 업로드 전에 이미지 파일의 개수, 빈 파일 여부, 크기, 형식을 검사합니다.
     * 조건에 맞지 않는 파일은 S3에 업로드되기 전에 400 응답으로 차단됩니다.
     */
    private void validateImages(List<MultipartFile> images) {
        // 이미지 없이 텍스트만 작성하는 게시글 허용
        if (images == null || images.isEmpty()) {
            return;
        }

        // from-data에 선택된 이미지 파트만 추림
        List<MultipartFile> selectedImages = images.stream()
                .filter(Objects::nonNull)
                .toList();

        if (selectedImages.size() > MAX_IMAGE_COUNT) {
            throw new IllegalArgumentException("피드 사진은 최대 " + MAX_IMAGE_COUNT + "장까지 등록할 수 있습니다.");
        }

        for (MultipartFile image : selectedImages) {
            // 빈 파일은 이미지로 취급하지 않고 명확히 오류로 반환
            if (image.isEmpty()) {
                throw new IllegalArgumentException("빈 이미지는 업로드할 수 없습니다.");
            }

            // S3 저장 전에 파일 크기를 제한
            if (image.getSize() > MAX_IMAGE_SIZE) {
                throw new IllegalArgumentException("이미지 한 장은 5MB 이하만 업로드할 수 있습니다.");
            }

            // 브라우저/Postman이 전달한 MIME 타입 기준으로 이미지 형식을 제한
            String contentType = image.getContentType();

            if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
                throw new IllegalArgumentException("JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.");
            }
        }
    }

    /**
     * S3 objectKey를 브라우저에서 표시 가능한 URL로 변환합니다.
     *
     * 이전 데이터에 이미 완성된 URL이 저장되어 있는 경우도
     * 화면이 깨지지 않도록 그대로 반환합니다.
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


    /**
     * multipart 요청에서 실제로 선택된 파일만 남깁니다.
     */
    private List<MultipartFile> normalizeFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return List.of();
        }

        return files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .toList();
    }

    /**
     * 피드 게시글 하나에 사진은 최대 5장까지만 허용합니다.
     */
    private void validataePhotoCount(int count) {
        if (count > 5) {
            throw new IllegalArgumentException("피드 사진은 최대 5장까지 등록할 수 있습니다.");
        }
    }

    /**
     * FeedPostResponse 생성 방식을 한 곳으로 통일합니다.
     */
    private FeedPostResponse toResponse(
            FeedPost post,
            boolean liked,
            boolean bookmarked
    ) {
        return FeedPostResponse.from(
                post,
                liked,
                bookmarked,
                this::toReadableImageUrl
        );
    }


}
