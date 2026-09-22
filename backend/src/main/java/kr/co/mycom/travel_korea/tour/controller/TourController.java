package kr.co.mycom.travel_korea.tour.controller;


import kr.co.mycom.travel_korea.tour.dto.request.TourSearchRequest;
import kr.co.mycom.travel_korea.tour.dto.response.TourListResponse;
import kr.co.mycom.travel_korea.tour.service.TourService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TourController {
    private final TourService service;

    @GetMapping("/search")
    public TourListResponse getTours(@ModelAttribute TourSearchRequest request){
        if (request.regionGroup() != null && !request.regionGroup().isBlank()) {
            return service.getToursByRegionGroup(
                    request.page(),
                    request.size(),
                    request.regionGroup(),
                    request.contentTypeId(),
                    request.arrange()
            );
        }

        return service.getTours(
                request.page(),
                request.size(),
                request.lDongRegnCd(),
                request.lDongSignguCd(),
                request.contentTypeId(),
                request.arrange(),
                request.lclsSystm1(),
                request.lclsSystm2()
        );
    }


}
