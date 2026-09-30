package kr.co.mycom.travel_korea.user.service;

import kr.co.mycom.travel_korea.user.entity.UserEntity;
import kr.co.mycom.travel_korea.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 회원 활동 정지(기간제 로그인 차단)를 적용/해제하는 공용 서비스.
 *
 * Design Ref: admin-dashboard 설계 §2.4, §3.2.2 — AdminUserController뿐 아니라
 * 이후 FeedAdminService(정책위반 삭제 시 작성자 정지)에서도 재사용하므로
 * 컨트롤러에 로직을 두지 않고 이 서비스로 분리한다.
 */
@Service
@RequiredArgsConstructor
public class UserSuspensionService {

    private static final int MIN_DAYS = 1;
    private static final int MAX_DAYS = 365;

    private final UserRepository repo;

    /**
     * 활동 정지를 적용한다. 과거 정지 이력은 남기지 않고 항상 최신 상태로 덮어쓴다.
     *
     * Design Ref: §3.2.2 — days는 1~365 범위만 서버가 검증한다(고정값 아님).
     */
    @Transactional
    public UserEntity suspend(Long userId, int days, String reason) {
        if (days < MIN_DAYS || days > MAX_DAYS) {
            throw new IllegalArgumentException("정지 기간은 " + MIN_DAYS + "일에서 " + MAX_DAYS + "일 사이여야 합니다.");
        }

        UserEntity user = findUser(userId);
        LocalDateTime now = LocalDateTime.now();
        user.suspend(now.plusDays(days), reason, now);
        return user;
    }

    /**
     * 활동 정지를 조기 해제한다.
     */
    @Transactional
    public UserEntity lift(Long userId) {
        UserEntity user = findUser(userId);
        user.liftSuspension();
        return user;
    }

    private UserEntity findUser(Long userId) {
        return repo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 회원을 찾을 수 없습니다."));
    }
}
