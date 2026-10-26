package com.financehealth.meal;

import com.financehealth.food.Food;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class MealDtos {

    private MealDtos() {}

    public record UpdateItemRequest(@NotNull @Min(0) @Max(2000) Integer grams) {}

    public record Macros(BigDecimal kcal, BigDecimal protein, BigDecimal carbs, BigDecimal fat) {
        static final Macros ZERO = new Macros(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        Macros plus(Macros o) {
            return new Macros(kcal.add(o.kcal), protein.add(o.protein), carbs.add(o.carbs), fat.add(o.fat));
        }
    }

    public record ItemView(long id, long foodId, String foodName, Food.Category category, int grams,
                           Integer unitG, String unitName, Macros macros) {}

    public record MealView(Food.Meal meal, Macros target, Macros total, List<ItemView> items) {}

    public record PlanView(long id, LocalDate date, Macros target, Macros total, List<MealView> meals) {}

    /** Tổng khối lượng (đã luộc chín) một nguyên liệu cần cho cả tuần */
    public record ShoppingItem(String foodName, Food.Category category, int grams, Integer unitG, String unitName) {}

    public record WeekView(LocalDate weekStart, LocalDate weekEnd, boolean created, boolean canCreate,
                           List<String> ingredients, List<PlanView> days, List<ShoppingItem> shopping) {}
}
