package com.financehealth.meal;

import com.financehealth.food.Food;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class MealDtos {

    private MealDtos() {}

    public record SelectionRequest(@NotNull Long foodId, Food.Meal meal) {}

    public record GenerateRequest(@NotNull LocalDate date,
                                  @NotEmpty @Size(max = 30) List<@Valid SelectionRequest> selections) {}

    public record UpdateItemRequest(@NotNull @Min(0) @Max(2000) Integer grams) {}

    public record Macros(BigDecimal kcal, BigDecimal protein, BigDecimal carbs, BigDecimal fat) {
        static final Macros ZERO = new Macros(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        Macros plus(Macros o) {
            return new Macros(kcal.add(o.kcal), protein.add(o.protein), carbs.add(o.carbs), fat.add(o.fat));
        }
    }

    public record ItemView(long id, long foodId, String foodName, Food.Category category, int grams, Macros macros) {}

    public record MealView(Food.Meal meal, Macros target, Macros total, List<ItemView> items) {}

    public record PlanView(long id, LocalDate date, Macros target, Macros total, List<MealView> meals) {}
}
