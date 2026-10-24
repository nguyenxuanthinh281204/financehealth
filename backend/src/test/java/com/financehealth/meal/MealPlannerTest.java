package com.financehealth.meal;

import com.financehealth.food.Food;
import com.financehealth.food.Food.Category;
import com.financehealth.food.Food.Meal;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class MealPlannerTest {

    private final MealPlanner planner = new MealPlanner();

    private static Food food(String name, Category c, double kcal, double p, double carb, double f,
                             int serving, int min, int max, EnumSet<Meal> meals) {
        return new Food(null, name, c, BigDecimal.valueOf(kcal), BigDecimal.valueOf(p), BigDecimal.valueOf(carb),
                BigDecimal.valueOf(f), serving, min, max, meals);
    }

    private final Food chicken = food("Ức gà", Category.PROTEIN, 165, 31, 0, 3.6, 150, 50, 350, EnumSet.of(Meal.LUNCH, Meal.DINNER));
    private final Food rice = food("Cơm", Category.CARB, 130, 2.7, 28.2, 0.3, 150, 50, 400, EnumSet.of(Meal.LUNCH, Meal.DINNER));
    private final Food egg = food("Trứng", Category.PROTEIN, 155, 13, 1.1, 11, 100, 50, 250, EnumSet.allOf(Meal.class));
    private final Food oats = food("Yến mạch", Category.CARB, 389, 16.9, 66.3, 6.9, 50, 20, 120, EnumSet.of(Meal.BREAKFAST));
    private final Food broccoli = food("Bông cải", Category.VEGGIE, 34, 2.8, 6.6, 0.4, 150, 50, 300, EnumSet.of(Meal.LUNCH, Meal.DINNER));
    private final Food oil = food("Dầu ô liu", Category.FAT, 884, 0, 0, 100, 10, 0, 25, EnumSet.of(Meal.LUNCH, Meal.DINNER));

    @Test
    void spreadsFoodsAcrossThreeMealsAndFillsGaps() {
        var byMeal = planner.assign(List.of(
                new MealPlanner.Selection(chicken, null), new MealPlanner.Selection(rice, null),
                new MealPlanner.Selection(egg, null), new MealPlanner.Selection(oats, null),
                new MealPlanner.Selection(broccoli, null)));

        assertThat(byMeal.get(Meal.BREAKFAST)).contains(egg, oats);
        assertThat(byMeal.get(Meal.LUNCH)).contains(chicken, rice);
        assertThat(byMeal.get(Meal.DINNER)).contains(chicken, rice);
    }

    @Test
    void respectsUserChosenMeal() {
        var byMeal = planner.assign(List.of(new MealPlanner.Selection(egg, Meal.DINNER),
                new MealPlanner.Selection(rice, Meal.DINNER)));
        assertThat(byMeal.get(Meal.DINNER)).containsExactly(egg, rice);
        assertThat(byMeal.get(Meal.BREAKFAST)).isEmpty();
    }

    @Test
    void dayTotalsLandCloseToTargets() {
        var targets = new MealPlanner.Targets(2400, 150, 270, 75);
        var items = planner.plan(targets, List.of(
                new MealPlanner.Selection(chicken, null), new MealPlanner.Selection(rice, null),
                new MealPlanner.Selection(egg, null), new MealPlanner.Selection(oats, null),
                new MealPlanner.Selection(broccoli, null), new MealPlanner.Selection(oil, null)));

        double kcal = 0, protein = 0, carbs = 0, fat = 0;
        for (var i : items) {
            double f = i.grams() / 100.0;
            kcal += i.food().getKcal().doubleValue() * f;
            protein += i.food().getProtein().doubleValue() * f;
            carbs += i.food().getCarbs().doubleValue() * f;
            fat += i.food().getFat().doubleValue() * f;
            assertThat(i.grams()).isBetween(i.food().getMinG(), i.food().getMaxG());
            assertThat(i.grams() % 5).isZero();
        }
        assertThat(kcal).isBetween(2400 * 0.9, 2400 * 1.1);
        assertThat(protein).isBetween(150 * 0.85, 150 * 1.15);
        assertThat(carbs).isBetween(270 * 0.85, 270 * 1.15);
        // Chỉ có 25g dầu trong một bữa nên fat khó chạm mục tiêu, kcal bù bằng carb/protein
        assertThat(fat).isBetween(75 * 0.7, 75 * 1.2);

        Map<Meal, Long> perMeal = items.stream().collect(Collectors.groupingBy(MealPlanner.PlannedItem::meal, Collectors.counting()));
        assertThat(perMeal).containsKeys(Meal.BREAKFAST, Meal.LUNCH, Meal.DINNER);
    }

    @Test
    void singleMealGetsWholeDayTarget() {
        var items = planner.plan(new MealPlanner.Targets(600, 40, 60, 20),
                List.of(new MealPlanner.Selection(oats, null), new MealPlanner.Selection(egg, Meal.BREAKFAST)));
        assertThat(items).allMatch(i -> i.meal() == Meal.BREAKFAST);
        double kcal = items.stream().mapToDouble(i -> i.food().getKcal().doubleValue() * i.grams() / 100).sum();
        assertThat(kcal).isBetween(450.0, 700.0);
    }
}
