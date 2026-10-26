package com.financehealth.meal;

import com.financehealth.food.Food;
import com.financehealth.food.Food.Category;
import com.financehealth.food.Food.Meal;

import java.util.*;

/**
 * Chia các món người dùng chọn vào 3 bữa rồi tìm số gram cho từng món sao cho tổng
 * kcal/protein/carb/fat của mỗi bữa sát với phần mục tiêu của bữa đó.
 *
 * Bài toán gram là bình phương tối thiểu có ràng buộc hộp [minG, maxG], giải bằng
 * coordinate descent (hàm lồi nên hội tụ). Có thêm một số hạng nhỏ kéo về khẩu phần
 * mặc định để rau củ, gia vị không bị đẩy về 0 hoặc lên trần.
 */
public class MealPlanner {

    public static final Map<Meal, Double> MEAL_SHARE = Map.of(
            Meal.BREAKFAST, 0.30, Meal.LUNCH, 0.40, Meal.DINNER, 0.30);

    public record Targets(double kcal, double protein, double carbs, double fat) {
        Targets scale(double f) {
            return new Targets(kcal * f, protein * f, carbs * f, fat * f);
        }
    }

    /** meal == null nghĩa là để hệ thống tự xếp bữa. */
    public record Selection(Food food, Meal meal) {}

    public record PlannedItem(Meal meal, Food food, int grams) {}

    private static final double W_KCAL = 2.0, W_PROTEIN = 1.5, W_CARBS = 1.0, W_FAT = 1.0;
    private static final double REGULARIZATION = 0.03;
    private static final int ITERATIONS = 300;

    public List<PlannedItem> plan(Targets day, List<Selection> selections) {
        if (selections.isEmpty()) return List.of();
        Map<Meal, List<Food>> byMeal = assign(selections);

        // Bữa không có món nào thì dồn phần mục tiêu sang các bữa còn lại
        double activeShare = byMeal.entrySet().stream().filter(e -> !e.getValue().isEmpty())
                .mapToDouble(e -> MEAL_SHARE.get(e.getKey())).sum();

        List<PlannedItem> out = new ArrayList<>();
        for (Meal meal : Meal.values()) {
            List<Food> foods = byMeal.get(meal);
            if (foods.isEmpty()) continue;
            Targets t = day.scale(MEAL_SHARE.get(meal) / activeShare);
            int[] grams = solveGrams(t, foods);
            for (int i = 0; i < foods.size(); i++) {
                if (grams[i] > 0) out.add(new PlannedItem(meal, foods.get(i), grams[i]));
            }
        }
        return out;
    }

    Map<Meal, List<Food>> assign(List<Selection> selections) {
        Map<Meal, List<Food>> byMeal = new EnumMap<>(Meal.class);
        for (Meal m : Meal.values()) byMeal.put(m, new ArrayList<>());

        List<Food> unassigned = new ArrayList<>();
        for (Selection s : selections) {
            if (s.meal() != null) addOnce(byMeal.get(s.meal()), s.food());
            else unassigned.add(s.food());
        }

        // Món nặng (protein, carb) xếp trước để rải đều giữa các bữa
        unassigned.sort(Comparator.comparingInt(f -> priority(f.getCategory())));
        for (Food f : unassigned) {
            Set<Meal> allowed = f.meals().isEmpty() ? EnumSet.allOf(Meal.class) : f.meals();
            Meal best = allowed.stream().min(Comparator
                            .comparingLong((Meal m) -> countCategory(byMeal.get(m), f.getCategory()))
                            .thenComparingInt(m -> byMeal.get(m).size())
                            .thenComparingInt(Enum::ordinal))
                    .orElseThrow();
            addOnce(byMeal.get(best), f);
        }

        // Bữa chính thiếu nguồn protein hoặc tinh bột thì mượn món phù hợp đã chọn
        List<Food> all = selections.stream().map(Selection::food).distinct().toList();
        List<Food> flexible = selections.stream().filter(s -> s.meal() == null).map(Selection::food).distinct().toList();
        for (Meal m : Meal.values()) {
            List<Food> foods = byMeal.get(m);
            if (foods.isEmpty() && m != Meal.BREAKFAST) {
                // Bữa trưa/tối trống: lấy các món chưa ghim bữa mà cho phép ở bữa này
                flexible.stream().filter(f -> f.meals().contains(m)).forEach(f -> addOnce(foods, f));
                continue;
            }
            if (foods.isEmpty()) continue;
            for (Category needed : List.of(Category.PROTEIN, Category.CARB)) {
                if (countCategory(foods, needed) == 0) {
                    all.stream().filter(f -> f.getCategory() == needed && f.meals().contains(m))
                            .findFirst().ifPresent(f -> addOnce(foods, f));
                }
            }
        }
        return byMeal;
    }

    int[] solveGrams(Targets t, List<Food> foods) {
        int n = foods.size();
        double[][] a = new double[4][n]; // dinh dưỡng trên 1 gram
        double[] lo = new double[n], hi = new double[n], def = new double[n], g = new double[n];
        for (int i = 0; i < n; i++) {
            Food f = foods.get(i);
            a[0][i] = f.getKcal().doubleValue() / 100;
            a[1][i] = f.getProtein().doubleValue() / 100;
            a[2][i] = f.getCarbs().doubleValue() / 100;
            a[3][i] = f.getFat().doubleValue() / 100;
            lo[i] = f.getMinG();
            hi[i] = Math.max(f.getMaxG(), f.getMinG());
            def[i] = Math.min(Math.max(f.getDefaultServingG(), lo[i]), hi[i]);
            g[i] = def[i];
        }
        double[] target = {t.kcal(), t.protein(), t.carbs(), t.fat()};
        descend(a, target, lo, hi, def, g);
        // Món đã chọn ít chất béo (đồ luộc) thì không thể đạt mục tiêu béo: chuyển phần calo
        // béo còn thiếu sang tinh bột rồi giải lại, để tổng kcal vẫn đủ.
        double fat = 0;
        for (int i = 0; i < n; i++) fat += a[3][i] * g[i];
        if (fat < target[3] * 0.9) {
            target[2] += (target[3] - fat) * 9 / 4;
            target[3] = fat;
            descend(a, target, lo, hi, def, g);
        }
        int[] grams = new int[n];
        for (int i = 0; i < n; i++) {
            Integer unit = foods.get(i).getUnitG();
            int step = unit != null && unit > 0 ? unit : 5;
            int rounded = (int) (Math.round(g[i] / step) * step);
            // Làm tròn theo đơn vị (quả trứng) có thể lệch khỏi khoảng; ép lại theo bội số của step
            int min = (int) Math.ceil(lo[i] / step) * step, max = (int) Math.floor(hi[i] / step) * step;
            grams[i] = max >= min ? Math.min(max, Math.max(min, rounded)) : (int) lo[i];
        }
        return grams;
    }

    private static void descend(double[][] a, double[] target, double[] lo, double[] hi, double[] def, double[] g) {
        int n = g.length;
        double[] w = new double[4];
        double[] importance = {W_KCAL, W_PROTEIN, W_CARBS, W_FAT};
        for (int k = 0; k < 4; k++) {
            // Chuẩn hóa theo bình phương mục tiêu để sai số tương đối giữa các chất cân bằng
            w[k] = importance[k] / Math.max(target[k] * target[k], 1);
        }
        double[] reg = new double[n];
        for (int i = 0; i < n; i++) reg[i] = REGULARIZATION / Math.max(def[i] * def[i], 100);

        double[] r = new double[4];
        for (int k = 0; k < 4; k++) {
            r[k] = -target[k];
            for (int i = 0; i < n; i++) r[k] += a[k][i] * g[i];
        }
        for (int it = 0; it < ITERATIONS; it++) {
            for (int i = 0; i < n; i++) {
                double grad = reg[i] * (g[i] - def[i]);
                double curv = reg[i];
                for (int k = 0; k < 4; k++) {
                    grad += w[k] * a[k][i] * r[k];
                    curv += w[k] * a[k][i] * a[k][i];
                }
                double next = Math.min(hi[i], Math.max(lo[i], g[i] - grad / curv));
                double delta = next - g[i];
                if (delta != 0) {
                    for (int k = 0; k < 4; k++) r[k] += a[k][i] * delta;
                    g[i] = next;
                }
            }
        }
    }

    private static int priority(Category c) {
        return switch (c) {
            case PROTEIN -> 0;
            case CARB -> 1;
            case FAT, DAIRY -> 2;
            default -> 3;
        };
    }

    private static long countCategory(List<Food> foods, Category c) {
        return foods.stream().filter(f -> f.getCategory() == c).count();
    }

    private static void addOnce(List<Food> foods, Food f) {
        if (!foods.contains(f)) foods.add(f);
    }
}
