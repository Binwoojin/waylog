package kr.co.mycom.travel_korea.tour.dto.external;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TourApiCourseIntroItem(
        String contentid,
        String contenttypeid,
        String distance,
        String infocentertourcourse,
        String schedule,
        String taketime,
        String theme
) {
}
