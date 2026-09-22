package kr.co.mycom.travel_korea.tour.controller;

import kr.co.mycom.travel_korea.tour.dto.response.HomeTourResponse;
import kr.co.mycom.travel_korea.tour.service.HomeTourService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * WayLog 메인 페이지에서 사용하는 API입니다.
 */
@RestController
@RequestMapping("/api/v1/home")
@RequiredArgsConstructor
public class HomeTourController {

    private final HomeTourService homeTourService;

    /**
     * 메인 페이지 데이터를 반환합니다.
     *
     * GET http://localhost:8080/api/home
     */
    @GetMapping
    public HomeTourResponse getHomeTours() {
        return homeTourService.getHomeTours();
    }
}