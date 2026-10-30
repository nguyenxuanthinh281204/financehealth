package com.financehealth.meal;

import com.financehealth.common.CurrentUser;
import com.financehealth.food.Food;
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

    /** Thêm một nguyên liệu cố định vào bữa của ngày date. */
    @PostMapping("/{date}/meals/{meal}/items")
    public PlanView addItem(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                            @PathVariable Food.Meal meal, @Valid @RequestBody AddItemRequest req) {
        return service.addItem(CurrentUser.id(), date, meal, req.foodId(), req.grams());
    }

    /** Bỏ tất cả món của một bữa. */
    @DeleteMapping("/{date}/meals/{meal}")
    public PlanView clearMeal(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                              @PathVariable Food.Meal meal) {
        return service.clearMeal(CurrentUser.id(), date, meal);
    }

    @DeleteMapping("/items/{itemId}")
    public PlanView removeItem(@PathVariable long itemId) {
        return service.updateItem(CurrentUser.id(), itemId, 0);
    }

    @PatchMapping("/items/{itemId}")
    public PlanView updateItem(@PathVariable long itemId, @Valid @RequestBody UpdateItemRequest req) {
        return service.updateItem(CurrentUser.id(), itemId, req.grams());
    }
}
