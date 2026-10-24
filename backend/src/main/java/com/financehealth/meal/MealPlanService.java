package com.financehealth.meal;

import com.financehealth.body.BodyService;
import com.financehealth.body.MacroCalculator;
import com.financehealth.common.ApiException;
import com.financehealth.food.Food;
import com.financehealth.food.FoodRepository;
import com.financehealth.meal.MealDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MealPlanService {

    private final MealPlanRepository plans;
    private final FoodRepository foods;
    private final BodyService body;
    private final MealPlanner planner = new MealPlanner();

    public MealPlanService(MealPlanRepository plans, FoodRepository foods, BodyService body) {
        this.plans = plans;
        this.foods = foods;
        this.body = body;
    }

    @Transactional
    public PlanView generate(long userId, GenerateRequest req) {
        MacroCalculator.Result m = body.requireMacros(userId);

        Set<Long> ids = req.selections().stream().map(SelectionRequest::foodId).collect(Collectors.toSet());
        Map<Long, Food> found = foods.findVisibleByIds(userId, ids).stream()
                .collect(Collectors.toMap(Food::getId, Function.identity()));
        if (found.size() != ids.size()) throw ApiException.badRequest("Có món ăn không tồn tại");

        List<MealPlanner.Selection> selections = req.selections().stream()
                .map(s -> new MealPlanner.Selection(found.get(s.foodId()), s.meal())).toList();
        List<MealPlanner.PlannedItem> planned = planner.plan(
                new MealPlanner.Targets(m.kcal(), m.protein(), m.carbs(), m.fat()), selections);

        plans.findByUserIdAndPlanDate(userId, req.date()).ifPresent(old -> {
            plans.delete(old);
            plans.flush();
        });
        MealPlan plan = new MealPlan(userId, req.date(), bd(m.kcal()), bd(m.protein()), bd(m.carbs()), bd(m.fat()));
        int pos = 0;
        for (MealPlanner.PlannedItem p : planned) {
            plan.addItem(new MealPlanItem(p.meal(), p.food(), p.grams(), pos++));
        }
        return toView(plans.save(plan));
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
    public void delete(long userId, LocalDate date) {
        plans.findByUserIdAndPlanDate(userId, date).ifPresent(plans::delete);
    }

    private PlanView toView(MealPlan p) {
        Macros dayTarget = new Macros(p.getTargetKcal(), p.getTargetProtein(), p.getTargetCarbs(), p.getTargetFat());
        Map<Food.Meal, List<MealPlanItem>> grouped = p.getItems().stream()
                .collect(Collectors.groupingBy(MealPlanItem::getMeal, () -> new EnumMap<>(Food.Meal.class), Collectors.toList()));

        double activeShare = grouped.keySet().stream().mapToDouble(MealPlanner.MEAL_SHARE::get).sum();
        List<MealView> meals = new ArrayList<>();
        Macros dayTotal = Macros.ZERO;
        for (var e : grouped.entrySet()) {
            List<ItemView> items = e.getValue().stream()
                    .sorted(Comparator.comparingInt(MealPlanItem::getPosition))
                    .map(i -> new ItemView(i.getId(), i.getFood().getId(), i.getFood().getName(),
                            i.getFood().getCategory(), i.getGrams(),
                            new Macros(i.getKcal(), i.getProtein(), i.getCarbs(), i.getFat())))
                    .toList();
            Macros total = items.stream().map(ItemView::macros).reduce(Macros.ZERO, Macros::plus);
            double share = MealPlanner.MEAL_SHARE.get(e.getKey()) / activeShare;
            meals.add(new MealView(e.getKey(), scale(dayTarget, share), total, items));
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
