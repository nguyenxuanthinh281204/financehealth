package com.financehealth.food;

import com.financehealth.common.ApiException;
import com.financehealth.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/foods")
public class FoodController {

    public record FoodView(long id, String name, Food.Category category, BigDecimal kcal, BigDecimal protein,
                           BigDecimal carbs, BigDecimal fat, int defaultServingG, int minG, int maxG,
                           Set<Food.Meal> meals, boolean custom) {
        public static FoodView of(Food f) {
            return new FoodView(f.getId(), f.getName(), f.getCategory(), f.getKcal(), f.getProtein(), f.getCarbs(),
                    f.getFat(), f.getDefaultServingG(), f.getMinG(), f.getMaxG(), f.meals(), f.getOwnerId() != null);
        }
    }

    public record FoodRequest(
            @NotBlank @Size(max = 120) String name,
            @NotNull Food.Category category,
            @NotNull @DecimalMin("0") @DecimalMax("900") BigDecimal kcal,
            @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal protein,
            @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal carbs,
            @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal fat,
            @Min(1) @Max(1000) Integer defaultServingG,
            @Min(0) @Max(1000) Integer minG,
            @Min(1) @Max(2000) Integer maxG,
            Set<Food.Meal> meals) {}

    private final FoodRepository foods;

    public FoodController(FoodRepository foods) {
        this.foods = foods;
    }

    @GetMapping
    public List<FoodView> list() {
        return foods.findVisible(CurrentUser.id()).stream().map(FoodView::of).toList();
    }

    @PostMapping
    public FoodView create(@Valid @RequestBody FoodRequest req) {
        int serving = req.defaultServingG() == null ? 100 : req.defaultServingG();
        int min = req.minG() == null ? 0 : req.minG();
        int max = req.maxG() == null ? Math.max(serving * 3, 100) : req.maxG();
        if (min > max) throw ApiException.badRequest("Khối lượng tối thiểu phải nhỏ hơn tối đa");
        Set<Food.Meal> meals = req.meals() == null || req.meals().isEmpty() ? EnumSet.allOf(Food.Meal.class) : req.meals();
        Food f = new Food(CurrentUser.id(), req.name().trim(), req.category(), req.kcal(), req.protein(),
                req.carbs(), req.fat(), serving, min, max, meals);
        return FoodView.of(foods.save(f));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id) {
        Food f = foods.findByIdAndOwnerId(id, CurrentUser.id())
                .orElseThrow(() -> ApiException.notFound("món ăn do bạn tạo"));
        foods.delete(f);
        return ResponseEntity.noContent().build();
    }
}
