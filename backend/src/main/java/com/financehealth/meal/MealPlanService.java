package com.financehealth.meal;

import com.financehealth.body.BodyService;
import com.financehealth.body.MacroCalculator;
import com.financehealth.common.ApiException;
import com.financehealth.food.Food;
import com.financehealth.food.FoodRepository;
import com.financehealth.meal.MealDtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MealPlanService {

    private final MealPlanRepository plans;
    private final FoodRepository foods;
    private final BodyService body;
    private final WeeklyMenuRepository weeklyMenus;
    private final MealPlanner planner = new MealPlanner();

    private static final DateTimeFormatter DAY_MONTH = DateTimeFormatter.ofPattern("dd/MM");

    public MealPlanService(MealPlanRepository plans, FoodRepository foods, BodyService body,
                           WeeklyMenuRepository weeklyMenus) {
        this.plans = plans;
        this.foods = foods;
        this.body = body;
        this.weeklyMenus = weeklyMenus;
    }

    @Transactional
    public WeekView generateWeek(long userId) {
        LocalDate weekStart = weekStart(LocalDate.now(BodyService.ZONE));
        if (weeklyMenus.existsByUserIdAndWeekStart(userId, weekStart)) {
            throw new ApiException(HttpStatus.CONFLICT, "Tuần này đã tạo thực đơn. Từ thứ Hai "
                    + DAY_MONTH.format(weekStart.plusWeeks(1)) + " mới tạo được thực đơn tuần mới.");
        }
        MacroCalculator.Result m = body.requireMacros(userId);
        Map<String, Food> staples = foods.findByOwnerIdIsNullAndStapleKeyIsNotNull().stream()
                .collect(Collectors.toMap(Food::getStapleKey, Function.identity()));
        if (!staples.keySet().containsAll(WeeklyMenuTemplate.KEYS)) {
            throw new IllegalStateException("Thiếu nguyên liệu cố định trong bảng foods");
        }
        MealPlanner.Targets targets = new MealPlanner.Targets(m.kcal(), m.protein(), m.carbs(), m.fat());

        List<MealPlan> old = plans.findByUserIdAndPlanDateBetween(userId, weekStart, weekStart.plusDays(6));
        if (!old.isEmpty()) {
            plans.deleteAll(old);
            plans.flush();
        }
        for (int d = 0; d < 7; d++) {
            List<MealPlanner.PlannedItem> planned = planner.plan(targets, WeeklyMenuTemplate.forDay(d, staples));
            MealPlan plan = new MealPlan(userId, weekStart.plusDays(d), bd(m.kcal()), bd(m.protein()), bd(m.carbs()), bd(m.fat()));
            int pos = 0;
            for (MealPlanner.PlannedItem p : planned) {
                plan.addItem(new MealPlanItem(p.meal(), p.food(), p.grams(), pos++));
            }
            plans.save(plan);
        }
        weeklyMenus.save(new WeeklyMenu(userId, weekStart));
        return week(userId, weekStart);
    }

    @Transactional(readOnly = true)
    public WeekView week(long userId, LocalDate date) {
        LocalDate today = LocalDate.now(BodyService.ZONE);
        LocalDate start = weekStart(date == null ? today : date);
        LocalDate end = start.plusDays(6);
        boolean created = weeklyMenus.existsByUserIdAndWeekStart(userId, start);
        List<MealPlan> dayPlans = plans.findByUserIdAndPlanDateBetween(userId, start, end).stream()
                .sorted(Comparator.comparing(MealPlan::getPlanDate)).toList();

        Map<Food, Integer> totals = new LinkedHashMap<>();
        for (MealPlan p : dayPlans) {
            for (MealPlanItem i : p.getItems()) totals.merge(i.getFood(), i.getGrams(), Integer::sum);
        }
        List<ShoppingItem> shopping = totals.entrySet().stream()
                .sorted(Comparator.comparing((Map.Entry<Food, Integer> e) -> e.getKey().getCategory())
                        .thenComparing(e -> -e.getValue()))
                .map(e -> new ShoppingItem(e.getKey().getName(), e.getKey().getCategory(), e.getValue(),
                        e.getKey().getUnitG(), e.getKey().getUnitName()))
                .toList();
        List<Food> stapleFoods = foods.findByOwnerIdIsNullAndStapleKeyIsNotNull().stream()
                .sorted(Comparator.comparingInt(f -> WeeklyMenuTemplate.KEYS.indexOf(f.getStapleKey())))
                .toList();
        List<StapleView> staples = stapleFoods.stream()
                .map(f -> new StapleView(f.getId(), f.getName(), f.getCategory(), defaultGrams(f),
                        f.getUnitG(), f.getUnitName(), new Macros(f.getKcal(), f.getProtein(), f.getCarbs(), f.getFat())))
                .toList();

        return new WeekView(start, end, created, !created && start.equals(weekStart(today)),
                stapleFoods.stream().map(Food::getName).toList(), staples,
                dayPlans.stream().map(this::toView).toList(), shopping);
    }

    static LocalDate weekStart(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    @Transactional(readOnly = true)
    public Optional<PlanView> get(long userId, LocalDate date) {
        return plans.findByUserIdAndPlanDate(userId, date).map(this::toView);
    }

    @Transactional
    public PlanView updateItem(long userId, long itemId, int grams) {
        MealPlanItem item = plans.findItem(userId, itemId).orElseThrow(() -> ApiException.notFound("món trong thực đơn"));
        MealPlan plan = item.getPlan();
        if (grams == 0) plan.getItems().remove(item);
        else item.setGrams(grams);
        return toView(plan);
    }

    @Transactional
    public PlanView addItem(long userId, LocalDate date, Food.Meal meal, long foodId, Integer grams) {
        MealPlan plan = plans.findByUserIdAndPlanDate(userId, date)
                .orElseThrow(() -> ApiException.notFound("thực đơn ngày này"));
        Food food = foods.findById(foodId)
                .filter(f -> f.getOwnerId() == null && f.getStapleKey() != null)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Chỉ thêm được nguyên liệu trong thực đơn tuần"));
        boolean exists = plan.getItems().stream()
                .anyMatch(i -> i.getMeal() == meal && i.getFood().getId().equals(food.getId()));
        if (exists) throw new ApiException(HttpStatus.CONFLICT, food.getName() + " đã có trong bữa này, hãy sửa số gram");
        int pos = plan.getItems().stream().mapToInt(MealPlanItem::getPosition).max().orElse(-1) + 1;
        plan.addItem(new MealPlanItem(meal, food, grams != null ? grams : defaultGrams(food), pos));
        plans.saveAndFlush(plan);
        return toView(plan);
    }

    @Transactional
    public PlanView clearMeal(long userId, LocalDate date, Food.Meal meal) {
        MealPlan plan = plans.findByUserIdAndPlanDate(userId, date)
                .orElseThrow(() -> ApiException.notFound("thực đơn ngày này"));
        plan.getItems().removeIf(i -> i.getMeal() == meal);
        return toView(plan);
    }

    /** Khẩu phần mặc định, làm tròn theo đơn vị (quả trứng) hoặc 5g, nằm trong khoảng min-max của món. */
    static int defaultGrams(Food f) {
        int step = f.getUnitG() != null && f.getUnitG() > 0 ? f.getUnitG() : 5;
        int g = Math.max(f.getMinG(), Math.min(f.getMaxG(), f.getDefaultServingG()));
        return Math.max(step, Math.round((float) g / step) * step);
    }

    private PlanView toView(MealPlan p) {
        Macros dayTarget = new Macros(p.getTargetKcal(), p.getTargetProtein(), p.getTargetCarbs(), p.getTargetFat());
        Map<Food.Meal, List<MealPlanItem>> grouped = new EnumMap<>(Food.Meal.class);
        // Luôn đủ 3 bữa, kể cả bữa đã bỏ hết món, để còn thêm món lại
        for (Food.Meal m : Food.Meal.values()) grouped.put(m, new ArrayList<>());
        p.getItems().forEach(i -> grouped.get(i.getMeal()).add(i));

        List<MealView> meals = new ArrayList<>();
        Macros dayTotal = Macros.ZERO;
        for (var e : grouped.entrySet()) {
            List<ItemView> items = e.getValue().stream()
                    .sorted(Comparator.comparingInt(MealPlanItem::getPosition))
                    .map(i -> new ItemView(i.getId(), i.getFood().getId(), i.getFood().getName(),
                            i.getFood().getCategory(), i.getGrams(), i.getFood().getUnitG(), i.getFood().getUnitName(),
                            new Macros(i.getKcal(), i.getProtein(), i.getCarbs(), i.getFat())))
                    .toList();
            Macros total = items.stream().map(ItemView::macros).reduce(Macros.ZERO, Macros::plus);
            // Tỷ lệ bữa cố định: bỏ một bữa thì cả ngày thiếu, không dồn mục tiêu sang bữa khác
            meals.add(new MealView(e.getKey(), scale(dayTarget, MealPlanner.MEAL_SHARE.get(e.getKey())), total, items));
            dayTotal = dayTotal.plus(total);
        }
        return new PlanView(p.getId(), p.getPlanDate(), dayTarget, dayTotal, meals);
    }

    private static Macros scale(Macros m, double f) {
        BigDecimal factor = BigDecimal.valueOf(f);
        return new Macros(m.kcal().multiply(factor).setScale(0, RoundingMode.HALF_UP),
                m.protein().multiply(factor).setScale(0, RoundingMode.HALF_UP),
                m.carbs().multiply(factor).setScale(0, RoundingMode.HALF_UP),
                m.fat().multiply(factor).setScale(0, RoundingMode.HALF_UP));
    }

    private static BigDecimal bd(int v) {
        return BigDecimal.valueOf(v);
    }
}
