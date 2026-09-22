package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * TourAPI detailIntro 응답입니다.
 *
 * 콘텐츠 유형에 따라 채워지는 필드가 다르므로,
 * 사용하지 않는 필드는 null로 들어올 수 있습니다.
 */

@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiDetailIntroItem(
        // 관광지(12)
        String infocenter,
        String restdate,
        String usetime,
        String parking,

        // 문화시설(14)
        String infocenterculture,
        String restdateculture,
        String usetimeculture,
        String usefee,
        String parkingculture,

        // 축제·행사(15)
        String eventstartdate,
        String eventenddate,
        String eventplace,
        String playtime,
        String spendtimefestival,
        String sponsor1,
        String sponsor1tel,
        String program,

        // 레포츠(28)
        String openperiod,
        String usetimeleports,
        String usefeeleports,
        String reservation,
        String restdateleports,
        String parkingleports,

        // 숙박(32)
        String checkintime,
        String checkouttime,
        String roomcount,
        String reservationlodging,
        String reservationurl,
        String parkinglodging,
        String foodplace,

        // 쇼핑(38)
        String opentime,
        String fairday,
        String saleitem,
        String saleitemcost,
        String parkingshopping,
        String infocentershopping,

        // 음식점(39)
        String firstmenu,
        String treatmenu,
        String opentimefood,
        String restdatefood,
        String reservationfood,
        String parkingfood,
        String infocenterfood
) {
}
