package kr.co.mycom.travel_korea.tour.controller;

import kr.co.mycom.travel_korea.tour.dto.response.TourClassificationResponse;
import kr.co.mycom.travel_korea.tour.service.TourClassificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("api/v1/classifications")
@RequiredArgsConstructor
public class TourClassificationController {
    private final TourClassificationService service;

    @GetMapping
    public List<TourClassificationResponse>
    getClassifications(
            @RequestParam(required = false)
            Integer contentTypeId
    ) {
        return service.getClassifications(
                contentTypeId
        );
    }
}
