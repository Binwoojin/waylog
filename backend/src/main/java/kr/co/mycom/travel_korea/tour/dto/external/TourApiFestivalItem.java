package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** searchFestival2 결과 중 목록 화면에서 사용하는 필드입니다. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiFestivalItem(
        String contentid,
        String contenttypeid,
        String title,
        String addr1,
        String addr2,
        String firstimage,
        String firstimage2,
        String lDongRegnCd,
        String lDongSignguCd,
        String mapx,
        String mapy,
        String eventstartdate,
        String eventenddate,
        String lclsSystm1,
        String lclsSystm2,
        String lclsSystm3
) {
    /** 기존 목 클라이언트와 테스트용 생성 형식을 유지합니다. */
    public TourApiFestivalItem(
            String contentid,
            String contenttypeid,
            String title,
            String addr1,
            String addr2,
            String firstimage,
            String firstimage2,
            String lDongRegnCd,
            String lDongSignguCd,
            String mapx,
            String mapy,
            String eventstartdate,
            String eventenddate
    ) {
        this(
                contentid, contenttypeid, title, addr1, addr2,
                firstimage, firstimage2, lDongRegnCd, lDongSignguCd,
                mapx, mapy, eventstartdate, eventenddate,
                null, null, null
        );
    }
}
