package kr.co.mycom.travel_korea.feed;

import kr.co.mycom.travel_korea.feed.domain.FeedProfile;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileResponse;
import kr.co.mycom.travel_korea.feed.dto.FeedProfileUpdateRequest;
import kr.co.mycom.travel_korea.feed.repository.FeedProfileRepository;
import kr.co.mycom.travel_korea.feed.service.FeedProfileService;
import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

/**
 * mypage-bookmarks 설계 §4.2(Q-2~Q-4) — 마이페이지 프로필 수정(updateMyProfile) 회귀 테스트.
 *
 * FeedUserProfileServiceTest와 같은 스타일로 MockMvc 없이 서비스와 리포지토리를 직접 호출한다.
 * 이미지 업로드 분기는 실제 S3 연동이 필요하므로, 이 테스트는 profileImage=null(텍스트
 * 필드만 수정)인 경우만 다룬다.
 */
@SpringBootTest
@ActiveProfiles({"test", "local-mock"})
class FeedProfileUpdateServiceTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private FeedProfileRepository feedProfileRepository;
    @Autowired
    private FeedProfileService feedProfileService;

    private UserEntity createUser(String email, String nickname) {
        UserEntity user = new UserEntity(email, passwordEncoder.encode("Passw0rd!1"), nickname, "user");
        return userRepository.save(user);
    }

    // 닉네임·소개·피드아이디가 모두 새 값으로 반영되어야 한다.
    @Test
    void updatesNicknameIntroduceAndHandle() {
        UserEntity user = createUser("profile-update-ok@test.com", "수정전닉네임");

        FeedProfileResponse response = feedProfileService.updateMyProfile(
                user.getEmail(),
                new FeedProfileUpdateRequest("수정후닉네임", "안녕하세요, 소개입니다.", "pf_handle1"),
                null
        );

        assertEquals("수정후닉네임", response.nickname());
        assertEquals("안녕하세요, 소개입니다.", response.introduce());
        assertEquals("pf_handle1", response.feedHandle());
    }

    // Q-4: 본인의 기존 닉네임을 그대로 다시 제출해도 중복 에러가 나지 않아야 한다.
    @Test
    void resubmittingSameNicknameDoesNotThrow() {
        UserEntity user = createUser("profile-update-samename@test.com", "동일닉네임유지1");
        FeedProfile profile = feedProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> feedProfileRepository.save(new FeedProfile(user.getId(), "travel_" + user.getId())));

        assertDoesNotThrow(() -> feedProfileService.updateMyProfile(
                user.getEmail(),
                new FeedProfileUpdateRequest("동일닉네임유지1", "소개 수정", profile.getFeedHandle()),
                null
        ));
    }

    // 다른 회원이 이미 사용 중인 닉네임으로는 변경할 수 없어야 한다.
    @Test
    void changingToAnotherUsersNicknameThrows() {
        createUser("profile-update-taken-owner@test.com", "선점된닉네임1");
        UserEntity user = createUser("profile-update-taker@test.com", "변경시도자1");

        assertThrows(IllegalArgumentException.class, () -> feedProfileService.updateMyProfile(
                user.getEmail(),
                new FeedProfileUpdateRequest("선점된닉네임1", null, "pf_handle2"),
                null
        ));
    }

    // Q-4: 본인의 기존 피드 아이디를 그대로 다시 제출해도 중복 에러가 나지 않아야 한다(updateMyHandle과 동일한 원칙).
    @Test
    void resubmittingSameFeedHandleDoesNotThrow() {
        UserEntity user = createUser("profile-update-samehandle@test.com", "핸들유지닉네임1");

        FeedProfileResponse first = feedProfileService.updateMyProfile(
                user.getEmail(),
                new FeedProfileUpdateRequest("핸들유지닉네임1", null, "pf_handle3"),
                null
        );

        assertDoesNotThrow(() -> feedProfileService.updateMyProfile(
                user.getEmail(),
                new FeedProfileUpdateRequest("핸들유지닉네임1", "다시 저장", first.feedHandle()),
                null
        ));
    }

    // 다른 회원이 이미 사용 중인 피드 아이디로는 변경할 수 없어야 한다(기존 updateMyHandle 동작 유지).
    @Test
    void changingToAnotherUsersFeedHandleThrows() {
        UserEntity owner = createUser("profile-update-handle-owner@test.com", "핸들소유자1");
        feedProfileService.updateMyProfile(owner.getEmail(),
                new FeedProfileUpdateRequest("핸들소유자1", null, "pf_taken_handle"), null);

        UserEntity user = createUser("profile-update-handle-taker@test.com", "핸들시도자1");

        assertThrows(IllegalArgumentException.class, () -> feedProfileService.updateMyProfile(
                user.getEmail(),
                new FeedProfileUpdateRequest("핸들시도자1", null, "pf_taken_handle"),
                null
        ));
    }
}
