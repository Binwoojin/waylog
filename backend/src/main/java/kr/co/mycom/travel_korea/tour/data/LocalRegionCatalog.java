package kr.co.mycom.travel_korea.tour.data;

import kr.co.mycom.travel_korea.tour.dto.response.TourDistrictResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourRegionResponse;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class LocalRegionCatalog {
    private final List<TourRegionResponse> regions;
    /**
     * 광역지역 코드를 key로 하고 해당 지역의 시군구 목록을
     * value로 갖는 Map입니다.
     */
    private final Map<String, List<TourDistrictResponse>> districtsByRegion;

    public LocalRegionCatalog(ObjectMapper objectMapper) {
        this.regions = loadRegions(objectMapper);

        List<TourDistrictResponse> districts = loadDistricts(objectMapper);

        /*
         * 전체 시군구 배열을 lDongRegnCd 기준으로 묶습니다.
         *
         * 예:
         * "11" → 서울의 25개 구
         * "26" → 부산의 구·군
         */
        this.districtsByRegion = districts.stream().collect(Collectors.groupingBy(TourDistrictResponse::lDongRegnCd));

    }

    /**
     * 전국 광역지역 목록을 반환합니다.
     */
    public List<TourRegionResponse> getRegions() {
        return regions;
    }

    /**
     * 선택한 광역지역의 시군구 목록을 반환합니다.
     */
    public List<TourDistrictResponse> getDistricts(Integer lDongRegnCd) {
        if (lDongRegnCd == null) {
            return List.of();
        }

        return districtsByRegion.getOrDefault(String.valueOf(lDongRegnCd), List.of());
    }

    private List<TourRegionResponse> loadRegions(ObjectMapper objectMapper) {
        ClassPathResource resource = new ClassPathResource("tour/regions.json");

        try (InputStream inputStream = resource.getInputStream()) {

            return List.copyOf(objectMapper.readValue(inputStream, new TypeReference<List<TourRegionResponse>>() {
            }));
        } catch (IOException exception) {
            throw new IllegalStateException("로컬 광역지역 파일을 읽지 못했습니다.", exception);
        }
    }

    private List<TourDistrictResponse> loadDistricts(ObjectMapper objectMapper) {
        ClassPathResource resource = new ClassPathResource("tour/districts.json");

        try (InputStream inputStream = resource.getInputStream()) {

            return List.copyOf(objectMapper.readValue(inputStream, new TypeReference<List<TourDistrictResponse>>() {
            }));
        } catch (IOException exception) {
            throw new IllegalStateException("로컬 시군구 파일을 읽지 못했습니다.", exception);
        }
    }

}
