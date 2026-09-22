package kr.co.mycom.travel_korea.tour.controller;

import kr.co.mycom.travel_korea.tour.dto.response.TourDistrictResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourRegionResponse;
import kr.co.mycom.travel_korea.tour.service.TourRegionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/regions")
@RequiredArgsConstructor
public class TourRegionController {
    private final TourRegionService service;

    @GetMapping
    public List<TourRegionResponse> getRegions() {
        return service.getRegions();
    }

    @GetMapping("/districts")
    public List<TourDistrictResponse> getDistricts(
            @RequestParam(required = false) Integer lDongRegnCd,
            @RequestParam(required = false) String regionGroup
    ) {
        return service.getDistricts(lDongRegnCd, regionGroup);
    }
}
