package com.financehealth.meal;

import com.financehealth.common.CurrentUser;
import com.financehealth.meal.MealDtos.*;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/meal-plans")
public class MealPlanController {

    private final MealPlanService service;

    public MealPlanController(MealPlanService service) {
        this.service = service;
    }

    /** Tuần chứa ngày date (mặc định hôm nay), thứ Hai đến Chủ nhật. */
    @GetMapping("/week")
    public WeekView week(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.week(CurrentUser.id(), date);
    }

    /** Tạo thực đơn cho tuần hiện tại, mỗi tuần một lần. */
    @PostMapping("/week")
    public WeekView generateWeek() {
        return service.generateWeek(CurrentUser.id());
    }

    @GetMapping("/{date}")
    public ResponseEntity<PlanView> get(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.get(CurrentUser.id(), date).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PatchMapping("/items/{itemId}")
    public PlanView updateItem(@PathVariable long itemId, @Valid @RequestBody UpdateItemRequest req) {
        return service.updateItem(CurrentUser.id(), itemId, req.grams());
    }
}
