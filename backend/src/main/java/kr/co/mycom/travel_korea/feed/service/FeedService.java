package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.board.storage.StoredObject;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.feed.domain.*;
import kr.co.mycom.travel_korea.feed.dto.FeedCreateRequest;
import kr.co.mycom.travel_korea.feed.dto.FeedPageResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedPostResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedUpdateRequest;
import kr.co.mycom.travel_korea.feed.repository.FeedBookMarkRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedLikeRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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


    public FeedPageResponse getFeed(String loginEmail, int page, int size) {
        /*
         * 프론트엔드는 1페이지부터 사용하지만 Spring Data는 0페이지부터 사용합니다.
         */
        int pageIndex = Math.max(page - 1, 0);
        int pageSize = Math.min(Math.max(size, 1), 30);

        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<FeedPost> postPage = feedPostRepository.findByVisibility("PUBLIC", pageable);

        List<Long> postIds = postPage.getContent().stream()
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

        List<FeedPostResponse> responses = postPage.getContent().stream()
                .map(post -> toResponse(
                        post,
                        likedPostIds.contains(post.getId()),
                        bookmarkedPostIds.contains(post.getId())
                )).toList();

        return FeedPageResponse.from(postPage, responses);
    }

    public FeedPostResponse getOne(Long postId, String loginEmail) {
        FeedPost post = findPost(postId);

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
