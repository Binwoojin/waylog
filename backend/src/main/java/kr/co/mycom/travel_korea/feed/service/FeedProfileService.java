package kr.co.mycom.travel_korea.feed.service;

import kr.co.mycom.travel_korea.board.storage.StorageService;
import kr.co.mycom.travel_korea.board.storage.StoredObject;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.feed.domain.FeedLike;
import kr.co.mycom.travel_korea.feed.domain.FeedPost;
import kr.co.mycom.travel_korea.feed.domain.FeedProfile;
import kr.co.mycom.travel_korea.feed.dto.FeedPostResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileUpdateRequest;
import kr.co.mycom.travel_korea.feed.repository.FeedLikeRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedPostRepository;
import kr.co.mycom.travel_korea.feed.repository.FeedProfileRepository;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedProfileService {

    private final UserRepository userRepository;
    private final FeedProfileRepository feedProfileRepository;
    private final FeedPostRepository feedPostRepository;
    private final FeedLikeRepository feedLikeRepository;
    private final StorageService  storageService;

    /**
     * 로그인 회원의 SNS 프로필과 작성 게시글을 반환합니다.
     *
     * SNS 프로필이 아직 없으면 최초 조회 시 기본 아이디를 자동 생성합니다.
     */

    @Transactional
    public FeedProfileResponse getMyProfile(String loginEmail, int page, int size) {
        UserEntity user = findUser(loginEmail);
        FeedProfile profile = findOrCreateProfile(user);

        int pageIndex = Math.max(page - 1, 0);
        int pageSize = Math.min(Math.max(size, 1), 30);

        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<FeedPost> postPage = feedPostRepository.findByAuthor_Id(user.getId(), pageable);

        /*
         * 내 프로필의 게시글은 모두 내가 작성한 것이므로
         * liked/bookmarked 여부는 우선 false로 반환합니다.
         *
         * 필요하면 FeedService에서 구현한 좋아요·북마크 조회 로직을
         * 같은 방식으로 추가할 수 있습니다.
         */
        List<FeedPostResponse> posts = postPage.getContent().stream()
                .map(post -> FeedPostResponse.from(post, false, false, this::toReadableImageUrl)).toList();

        long receivedLikeCount = feedLikeRepository.countByFeedPost_Author_Id(user.getId());

        return FeedProfileResponse.of(user, profile, postPage.getTotalElements(), receivedLikeCount, posts, postPage.getNumber() + 1, postPage.getTotalPages(), postPage.hasNext());
    }

    /**
     * feed-integration 설계 §4.4(P-6): 다른 사용자의 SNS 프로필과 그가 작성한
     * PUBLIC 게시물만 조회합니다(본인 프로필과 달리 PRIVATE 게시물은 노출하지 않음).
     *
     * liked/bookmarked는 조회자와 무관하게 항상 false로 단순화합니다(설계 §4.4
     * 노출 범위 결정 — "둘러보기" 목적이 우선이라, 로그인 사용자 기준 좋아요 여부
     * 계산이 필요해지면 getFeed의 조회 로직을 그대로 옮겨오면 된다).
     */
    public FeedProfileResponse getUserProfile(Long userId, int page, int size) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("회원 정보를 찾을 수 없습니다."));
        FeedProfile profile = findOrCreateProfile(user);

        int pageIndex = Math.max(page - 1, 0);
        int pageSize = Math.min(Math.max(size, 1), 30);

        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        // 타인 프로필은 PUBLIC 게시물만 노출한다(getMyProfile은 본인 것이라 전부 보여주는 것과 대비).
        Page<FeedPost> postPage = feedPostRepository.findByAuthor_IdAndVisibilityAndDeletedAtIsNull(userId, "PUBLIC", pageable);

        List<FeedPostResponse> posts = postPage.getContent().stream()
                .map(post -> FeedPostResponse.from(post, false, false, this::toReadableImageUrl)).toList();

        long receivedLikeCount = feedLikeRepository.countByFeedPost_Author_Id(userId);

        return FeedProfileResponse.of(user, profile, postPage.getTotalElements(), receivedLikeCount, posts,
                postPage.getNumber() + 1, postPage.getTotalPages(), postPage.hasNext());
    }

    /**
     * 마이페이지 프로필(닉네임·소개·@피드아이디·프로필이미지)을 한 번에 수정합니다.
     *
     * mypage-bookmarks 설계 §4.2(Q-2~Q-4): 기존 updateMyHandle을 대체한다. 닉네임·@핸들
     * 둘 다 "값이 실제로 바뀐 경우에만" 중복확인하므로, 본인의 기존 값을 그대로 다시
     * 제출해도 중복 에러가 나지 않는다.
     */
    @Transactional
    public FeedProfileResponse updateMyProfile(String loginEmail, FeedProfileUpdateRequest request, MultipartFile profileImage) {
        UserEntity user = findUser(loginEmail);
        FeedProfile profile = findOrCreateProfile(user);

        String normalizedNickname = request.nickname().trim();

        /*
         * Q-4: 값이 실제로 바뀐 경우에만 중복확인 — 아래 feedHandle 처리와 동일한 원칙.
         * 본인의 기존 닉네임을 그대로 다시 제출해도 "사용 중"으로 걸리지 않는다.
         */
        boolean isNicknameChanged = !normalizedNickname.equals(user.getNickname());
        if (isNicknameChanged && userRepository.existsByNickname(normalizedNickname)) {
            throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
        }

        String normalizedHandle = normalizeHandle(request.feedHandle());

        /*
         * 내 기존 아이디와 같은 값으로 저장하는 것은 허용합니다.
         * 다른 회원이 사용 중인 경우에만 막습니다.
         */
        boolean isHandleChanged = !normalizedHandle.equals(profile.getFeedHandle());

        if (isHandleChanged && feedProfileRepository.existsByFeedHandle(normalizedHandle)) {
            throw new IllegalArgumentException("이미 사용 중인 피드 아이디입니다.");
        }

        user.updateProfile(normalizedNickname, request.introduce());
        profile.updateHandle(normalizedHandle);

        /*
         * Q-3: 이미지는 "저장" 시점에 텍스트 필드와 함께 한 번에 반영한다
         * (FeedController.create()와 동일한 멀티파트 패턴). 보내지 않으면 기존 이미지를 유지한다.
         */
        if (profileImage != null && !profileImage.isEmpty()) {
            String previousImageKey = user.getProfileImageUrl();
            StoredObject stored = storageService.upload(profileImage);
            user.updateProfileImage(stored.objectKey());

            /*
             * 기존 이미지가 S3 objectKey였던 경우에만 정리한다(완성된 http(s) URL이면
             * 외부 리소스이므로 삭제하지 않음 — toReadableImageUrl이 이미 같은 구분을 쓰고 있다).
             */
            if (previousImageKey != null && !previousImageKey.isBlank() && !previousImageKey.startsWith("http")) {
                storageService.delete(previousImageKey);
            }
        }

        /*
         * 프론트는 수정 후 프로필 관련 필드만 사용하지만,
         * 응답 형식을 통일하기 위해 빈 게시글 목록을 반환합니다.
         */
        return FeedProfileResponse.of(user, profile, 0, 0, List.of(), 1, 0, false);
    }

    private UserEntity findUser(String email) {
        return userRepository.findByEmail(email).orElseThrow(() ->
            new IllegalArgumentException("회원 정보를 찾을 수 없습니다."));
    }

    private FeedProfile findOrCreateProfile(UserEntity user) {
        return feedProfileRepository.findByUserId(user.getId()).orElseGet(() -> {
            /*
             * 닉네임은 중복될 수 있으므로 기본 피드 아이디에
             * 회원 ID를 붙여 항상 고유하게 생성합니다.
             *
             * 예: travel_12
             */
            String defaultHandle = "travel_" + user.getId();

            return feedProfileRepository.save(new FeedProfile(user.getId(),  defaultHandle));
        });
    }

    private String normalizeHandle(String feedHandle) {
        String normalized = feedHandle.trim().replaceFirst("^@+", "").toLowerCase();

        /*
         * 영문 소문자, 숫자, 언더바만 허용합니다.
         * 발표용으로 규칙을 단순하게 유지하는 방식입니다.
         */
        if (!normalized.matches("^[a-z0-9_]{3,20}$")) {
            throw new IllegalArgumentException("피드 아이디는 영문 소문자, 숫자, 언더바로 3~20자만 입력할 수 있습니다.");
        }
        return normalized;
    }

    /**
     * DB에 저장된 S3 objectKey를 브라우저에서 열 수 있는
     * Presigned URL로 변환합니다.
     *
     * 기존 데이터가 완성된 http URL인 경우에는 그대로 반환합니다.
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
