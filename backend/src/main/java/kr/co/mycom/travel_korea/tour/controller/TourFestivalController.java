package kr.co.mycom.travel_korea.tour.controller;

import kr.co.mycom.travel_korea.tour.dto.request.FestivalSearchRequest;
import kr.co.mycom.travel_korea.tour.dto.response.TourFestivalListResponse;
import kr.co.mycom.travel_korea.tour.service.TourFestivalService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/festivals")
@RequiredArgsConstructor
public class TourFestivalController {
    private final TourFestivalService service;

    @GetMapping
    public TourFestivalListResponse getFestivals(@ModelAttribute FestivalSearchRequest request) {
        return service.getFestivals(
                request.page(), request.size(), request.lDongRegnCd(), request.lDongSignguCd(),
                request.status(), request.arrange()
        );
    }
}
