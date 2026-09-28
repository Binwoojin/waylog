package kr.co.mycom.travel_korea.tour.dto.request;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Design Ref: §4.3 BE-5 — BE-1(중분류 → 대분류 보정), BE-3(arrange 허용값 검증) 단위 테스트
 */
class TourSearchRequestTest {

    private static TourSearchRequest request(String arrange, String lclsSystm1, String lclsSystm2) {
        return new TourSearchRequest(1, 9, null, null, 14, arrange, null, lclsSystm1, lclsSystm2);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  "})
    @DisplayName("arrange가 없거나 비어 있으면 Q로 채운다")
    void arrangeDefaultsToQ(String arrange) {
        assertThat(request(arrange, null, null).arrange()).isEqualTo("Q");
    }

    @Test
    @DisplayName("허용된 arrange(O)는 그대로 통과한다")
    void allowedArrangePasses() {
        assertThat(request("O", null, null).arrange()).isEqualTo("O");
    }

    @ParameterizedTest
    @ValueSource(strings = {"X", "q", "QQ"})
    @DisplayName("허용되지 않은 arrange는 대소문자까지 구분해 IllegalArgumentException(→ 400)을 던진다")
    void invalidArrangeThrows(String arrange) {
        assertThatThrownBy(() -> request(arrange, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("arrange");
    }

    @Test
    @DisplayName("중분류만 오면 앞 2자리로 대분류를 보정한다")
    void middleClassificationFillsLarge() {
        var request = request(null, null, "VE07");

        assertThat(request.lclsSystm1()).isEqualTo("VE");
        assertThat(request.lclsSystm2()).isEqualTo("VE07");
    }

    @Test
    @DisplayName("대분류가 빈 문자열이어도 중분류로 보정한다")
    void blankLargeClassificationIsFilled() {
        assertThat(request(null, "", "VE07").lclsSystm1()).isEqualTo("VE");
    }

    @Test
    @DisplayName("대분류와 중분류가 모두 있으면 그대로 둔다")
    void bothClassificationsKept() {
        var request = request(null, "VE", "VE07");

        assertThat(request.lclsSystm1()).isEqualTo("VE");
        assertThat(request.lclsSystm2()).isEqualTo("VE07");
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "ve07", "VE0701", "VE"})
    @DisplayName("중분류 형식이 아니면 보정하지 않는다")
    void invalidMiddleClassificationNotFilled(String lclsSystm2) {
        assertThat(request(null, null, lclsSystm2).lclsSystm1()).isNull();
    }
}
