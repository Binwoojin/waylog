package kr.co.mycom.travel_korea.tour.service;

import kr.co.mycom.travel_korea.tour.client.TourApiClient;
import kr.co.mycom.travel_korea.tour.data.LocalClassificationCatalog;
import kr.co.mycom.travel_korea.tour.dto.request.FestivalStatus;
import kr.co.mycom.travel_korea.tour.dto.response.TourFestivalItemResponse;
import kr.co.mycom.travel_korea.tour.dto.response.TourFestivalListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class TourFestivalService {
    private static final DateTimeFormatter TOUR_DATE = DateTimeFormatter.BASIC_ISO_DATE;
    private final TourApiClient tourApiClient;
    private final LocalClassificationCatalog classificationCatalog;

    @Cacheable(
            cacheNames = "tourLists",
            key = "'festivals:' + #page + ':' + #size + ':' + #lDongRegnCd + ':' + " +
                    "#lDongSignguCd + ':' + #status + ':' + #arrange",
            sync = true
    )
    public TourFestivalListResponse getFestivals(
            int page, int size, Integer lDongRegnCd, Integer lDongSignguCd, FestivalStatus status, String arrange
    ) {
        LocalDate today = LocalDate.now();
        LocalDate start;
        LocalDate end;

        switch (status) {
            case ONGOING -> { start = today; end = today; }
            case STARTS_THIS_WEEK -> {
                start = today;
                int untilSunday = DayOfWeek.SUNDAY.getValue() - today.getDayOfWeek().getValue();
                end = today.plusDays(Math.max(untilSunday, 0));
            }
            case UPCOMING -> { start = today.plusDays(1); end = today.plusDays(90); }
            default -> { start = today.withDayOfYear(1); end = today.plusYears(1).withDayOfYear(1).minusDays(1); }
        }

        var response = tourApiClient.getFestivals(
                page, size, lDongRegnCd, lDongSignguCd,
                start.format(TOUR_DATE), end.format(TOUR_DATE), arrange
        );
        var items = response.items().stream().map(item -> {
            var classification = classificationCatalog.findByCodes(
                    item.lclsSystm1(), item.lclsSystm2(), item.lclsSystm3()
            ).orElse(null);

            return new TourFestivalItemResponse(
                    item.contentid(), item.contenttypeid(), item.title(),
                    joinAddress(item.addr1(), item.addr2()), item.firstimage(), item.firstimage2(),
                    item.lDongRegnCd(), item.lDongSignguCd(),
                    parseDouble(item.mapy()), parseDouble(item.mapx()),
                    item.eventstartdate(), item.eventenddate(),
                    item.lclsSystm1(),
                    classification == null ? null : classification.lclsSystm1Nm(),
                    item.lclsSystm2(),
                    classification == null ? null : classification.lclsSystm2Nm(),
                    item.lclsSystm3(),
                    classification == null ? null : classification.lclsSystm3Nm()
            );
        }).toList();

        return new TourFestivalListResponse(
                items, response.pageNo(), response.numOfRows(), response.totalCount()
        );
    }

    private String joinAddress(String first, String second) {
        if (first == null || first.isBlank()) return second;
        if (second == null || second.isBlank()) return first;
        return first + " " + second;
    }

    private Double parseDouble(String value) {
        try { return value == null || value.isBlank() ? null : Double.valueOf(value); }
        catch (NumberFormatException ignored) { return null; }
    }
}
