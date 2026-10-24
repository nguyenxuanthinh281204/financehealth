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

    @PostMapping("/generate")
    public PlanView generate(@Valid @RequestBody GenerateRequest req) {
        return service.generate(CurrentUser.id(), req);
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

    @DeleteMapping("/{date}")
    public ResponseEntity<Void> delete(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        service.delete(CurrentUser.id(), date);
        return ResponseEntity.noContent().build();
    }
}
