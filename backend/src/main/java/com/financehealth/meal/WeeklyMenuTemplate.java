package com.financehealth.meal;

import com.financehealth.food.Food;
import com.financehealth.food.Food.Meal;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Xếp 8 nguyên liệu luộc cố định vào 3 bữa. Ngày chẵn/lẻ đổi cà rốt với bí đỏ,
 * xúc xích và táo để cả tuần không lặp y hệt.
 */
final class WeeklyMenuTemplate {

    static final List<String> KEYS = List.of("EGG", "CHICKEN", "RICE", "SAUSAGE", "CARROT", "PUMPKIN", "APPLE", "BREAD");

    private WeeklyMenuTemplate() {}

    /** dayIndex: 0 = thứ Hai ... 6 = Chủ nhật */
    static List<MealPlanner.Selection> forDay(int dayIndex, Map<String, Food> staples) {
        boolean even = dayIndex % 2 == 0;
        List<MealPlanner.Selection> out = new ArrayList<>();
        add(out, staples, Meal.BREAKFAST, "BREAD", "EGG", even ? "APPLE" : "SAUSAGE");
        add(out, staples, Meal.LUNCH, "RICE", "CHICKEN", even ? "CARROT" : "PUMPKIN");
        // Đồ luộc ít béo: xúc xích mỗi ngày một bữa để bù chất béo và calo
        if (even) add(out, staples, Meal.DINNER, "RICE", "CHICKEN", "PUMPKIN", "SAUSAGE");
        else add(out, staples, Meal.DINNER, "RICE", "CHICKEN", "CARROT", "APPLE");
        return out;
    }

    private static void add(List<MealPlanner.Selection> out, Map<String, Food> staples, Meal meal, String... keys) {
        for (String k : keys) out.add(new MealPlanner.Selection(staples.get(k), meal));
    }
}
