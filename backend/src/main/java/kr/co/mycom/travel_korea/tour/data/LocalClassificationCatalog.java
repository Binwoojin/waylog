package kr.co.mycom.travel_korea.tour.data;

import kr.co.mycom.travel_korea.tour.dto.response.TourClassificationResponse;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Optional;

@Component
public class LocalClassificationCatalog {
    private final List<TourClassificationResponse>
            classifications;

    public LocalClassificationCatalog(
            ObjectMapper objectMapper
    ) {
        ClassPathResource resource =
                new ClassPathResource(
                        "tour/classification-codes.json"
                );

        try (InputStream inputStream =
                     resource.getInputStream()) {

            this.classifications =
                    List.copyOf(
                            objectMapper.readValue(
                                    inputStream,
                                    new TypeReference<
                                            List<TourClassificationResponse>
                                            >() {
                                    }
                            )
                    );
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "분류체계 로컬 데이터를 읽지 못했습니다.",
                    exception
            );
        }
    }

    public List<TourClassificationResponse> getAll() {
        return classifications;
    }

    /**
     * TourAPI 목록에 포함된 분류 코드와 일치하는 로컬 분류 항목을 찾습니다.
     * 가장 구체적인 소분류부터 비교하여 불필요한 외부 API 호출 없이 명칭을 제공합니다.
     */
    public Optional<TourClassificationResponse> findByCodes(
            String lclsSystm1,
            String lclsSystm2,
            String lclsSystm3
    ) {
        if (isBlank(lclsSystm1) && isBlank(lclsSystm2) && isBlank(lclsSystm3)) {
            return Optional.empty();
        }

        return classifications.stream()
                .filter(item -> isBlank(lclsSystm1)
                        || lclsSystm1.equals(item.lclsSystm1Cd()))
                .filter(item -> isBlank(lclsSystm2)
                        || lclsSystm2.equals(item.lclsSystm2Cd()))
                .filter(item -> isBlank(lclsSystm3)
                        || lclsSystm3.equals(item.lclsSystm3Cd()))
                .findFirst();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

}
