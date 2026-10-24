package com.financehealth.summary;

import com.financehealth.body.BodyService;
import com.financehealth.common.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.YearMonth;

@RestController
@RequestMapping("/api/summary")
public class SummaryController {

    private final SummaryService service;

    public SummaryController(SummaryService service) {
        this.service = service;
    }

    @GetMapping("/monthly")
    public SummaryService.MonthlySummary monthly(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        LocalDate today = LocalDate.now(BodyService.ZONE);
        return service.monthly(CurrentUser.id(), month == null ? YearMonth.from(today) : month, today);
    }
}
