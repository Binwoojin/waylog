package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiCourseDetailItem (
        String contentid,
        String contenttypeid,
        String subcontentid,
        String subdetailalt,
        String subdetailimg,
        String subdetailoverview,
        String subname,
        Integer subnum
){
}
