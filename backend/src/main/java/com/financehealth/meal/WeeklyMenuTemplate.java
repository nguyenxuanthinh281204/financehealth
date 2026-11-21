package com.financehealth.meal;

import com.financehealth.food.Food;
import com.financehealth.food.Food.Meal;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Xếp 7 nguyên liệu luộc cố định vào 3 bữa. Ngày chẵn/lẻ đổi cà rốt với bí đỏ
 * để cả tuần không lặp y hệt. Xúc xích đã bỏ khỏi thực đơn (2026-11-21), món vẫn
 * còn trong bảng foods để thực đơn cũ hiển thị được.
 */
final class WeeklyMenuTemplate {

    static final List<String> KEYS = List.of("EGG", "CHICKEN", "RICE", "CARROT", "PUMPKIN", "APPLE", "BREAD");

    private WeeklyMenuTemplate() {}

    /** dayIndex: 0 = thứ Hai ... 6 = Chủ nhật */
    static List<MealPlanner.Selection> forDay(int dayIndex, Map<String, Food> staples) {
        boolean even = dayIndex % 2 == 0;
        List<MealPlanner.Selection> out = new ArrayList<>();
        add(out, staples, Meal.BREAKFAST, "BREAD", "EGG", "APPLE");
        add(out, staples, Meal.LUNCH, "RICE", "CHICKEN", even ? "CARROT" : "PUMPKIN");
        add(out, staples, Meal.DINNER, "RICE", "CHICKEN", even ? "PUMPKIN" : "CARROT");
        return out;
    }

    private static void add(List<MealPlanner.Selection> out, Map<String, Food> staples, Meal meal, String... keys) {
        for (String k : keys) out.add(new MealPlanner.Selection(staples.get(k), meal));
    }
}
