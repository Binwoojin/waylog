package kr.co.mycom.travel_korea.tour.mapper;

import kr.co.mycom.travel_korea.tour.dto.external.TourApiItem;
import kr.co.mycom.travel_korea.tour.dto.response.TourSummaryResponse;
import kr.co.mycom.travel_korea.tour.data.LocalClassificationCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;
import java.util.stream.Stream;


 // TourAPI 원본 필드를 WayLog 프론트엔드 응답 필드로 변환
@Component
@RequiredArgsConstructor
public class TourMapper {
    private final LocalClassificationCatalog classificationCatalog;

    public TourSummaryResponse toSummary (TourApiItem item) {
        var classification = classificationCatalog.findByCodes(
                item.lclsSystm1(), item.lclsSystm2(), item.lclsSystm3()
        ).orElse(null);

        return new TourSummaryResponse(
                item.contentid(),
                item.contenttypeid(),
                item.title(),
                combineAddress(item.addr1(), item.addr2()),
                emptyToNull(item.firstimage()), // 일반 이미지
                emptyToNull(item.firstimage2()), // 썸네일 이미지
                item.lDongRegnCd(),
                item.lDongSignguCd(),
                parseDouble(item.mapy()),
                parseDouble(item.mapx()),
                item.lclsSystm1(),
                classification == null ? null : classification.lclsSystm1Nm(),
                item.lclsSystm2(),
                classification == null ? null : classification.lclsSystm2Nm(),
                item.lclsSystm3(),
                classification == null ? null : classification.lclsSystm3Nm()
        );
    }

    // addr1과 addr2 중 값이 존재하는 부분만 결합
    private String combineAddress(String addr1, String addr2) {
        return Stream.of(addr1, addr2).filter(value -> value != null && !value.isBlank()).collect(Collectors.joining(" "));
    }

    // TourAPI의 빈 문자열을 프론트엔드 응답에서는 null로 변환
    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

     /**
      * TourAPI 좌표 문자열을 Double로 변환합니다.
      *
      * 값이 없거나 숫자로 변환할 수 없으면 null을 반환합니다.
      *
      * TODO(팀원 A):
      * 실제 TourAPI에서 mapx와 mapy가 항상 문자열로 내려오는지 확인해 주세요.
      */
    private Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
