package com.financehealth.summary;

import com.financehealth.body.BodyProfileRepository;
import com.financehealth.body.WeightLogRepository;
import com.financehealth.body.WeightLog;
import com.financehealth.finance.Expense;
import com.financehealth.finance.ExpenseRepository;
import com.financehealth.habit.HabitDtos;
import com.financehealth.habit.HabitService;
import com.financehealth.meal.MealPlan;
import com.financehealth.meal.MealPlanItem;
import com.financehealth.meal.MealPlanRepository;
import com.financehealth.moment.Moment;
import com.financehealth.moment.MomentRepository;
import com.financehealth.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SummaryService {

    public record CategoryTotal(Expense.Category category, BigDecimal amount, long count) {}
    public record DailyTotal(LocalDate date, BigDecimal amount) {}
    public record MerchantTotal(String merchant, BigDecimal amount, long count) {}
    public record WeightPoint(LocalDate date, BigDecimal weightKg) {}

    public record Spending(BigDecimal total, BigDecimal previousTotal, Double changePct, long count,
                           BigDecimal avgPerDay, List<CategoryTotal> byCategory, List<DailyTotal> daily,
                           List<MerchantTotal> topMerchants) {}

    public record Weight(BigDecimal start, BigDecimal end, BigDecimal change, BigDecimal min, BigDecimal max,
                         BigDecimal target, List<WeightPoint> points) {}

    public record Nutrition(int plannedDays, Integer avgPlannedKcal, Integer avgTargetKcal,
                            Integer avgProtein, Integer avgTargetProtein) {}

    public record Moments(long count, List<String> previewUrls) {}

    public record MonthlySummary(String month, Spending spending, Weight weight, Nutrition nutrition, Moments moments,
                                 HabitDtos.Monthly habits) {}

    private final ExpenseRepository expenses;
    private final WeightLogRepository weights;
    private final BodyProfileRepository profiles;
    private final MealPlanRepository plans;
    private final MomentRepository moments;
    private final StorageService storage;
    private final HabitService habits;

    public SummaryService(ExpenseRepository expenses, WeightLogRepository weights, BodyProfileRepository profiles,
                          MealPlanRepository plans, MomentRepository moments, StorageService storage,
                          HabitService habits) {
        this.expenses = expenses;
        this.weights = weights;
        this.profiles = profiles;
        this.plans = plans;
        this.moments = moments;
        this.storage = storage;
        this.habits = habits;
    }

    @Transactional(readOnly = true)
    public MonthlySummary monthly(long userId, YearMonth month, LocalDate today) {
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        return new MonthlySummary(month.toString(), spending(userId, month, today), weight(userId, from, to),
                nutrition(userId, from, to), moments(userId, from, to), habits.monthly(userId, from, to, today));
    }

    private Spending spending(long userId, YearMonth month, LocalDate today) {
        LocalDate from = month.atDay(1), to = month.atEndOfMonth();
        List<Expense> list = expenses.findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(userId, from, to);
        YearMonth prev = month.minusMonths(1);
        BigDecimal prevTotal = sum(expenses.findByUserIdAndSpentOnBetweenOrderBySpentOnDescIdDesc(
                userId, prev.atDay(1), prev.atEndOfMonth()));
        BigDecimal total = sum(list);

        Double changePct = prevTotal.signum() == 0 ? null
                : total.subtract(prevTotal).multiply(BigDecimal.valueOf(100))
                        .divide(prevTotal, 1, RoundingMode.HALF_UP).doubleValue();

        // Tháng hiện tại chia theo số ngày đã qua, tháng cũ chia theo cả tháng
        int days = month.equals(YearMonth.from(today)) ? today.getDayOfMonth() : month.lengthOfMonth();
        BigDecimal avg = total.divide(BigDecimal.valueOf(Math.max(days, 1)), 0, RoundingMode.HALF_UP);

        List<CategoryTotal> byCategory = list.stream()
                .collect(Collectors.groupingBy(Expense::getCategory))
                .entrySet().stream()
                .map(e -> new CategoryTotal(e.getKey(), sum(e.getValue()), e.getValue().size()))
                .sorted(Comparator.comparing(CategoryTotal::amount).reversed())
                .toList();

        Map<LocalDate, BigDecimal> perDay = list.stream().collect(Collectors.groupingBy(Expense::getSpentOn,
                TreeMap::new, Collectors.reducing(BigDecimal.ZERO, Expense::getAmount, BigDecimal::add)));
        List<DailyTotal> daily = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            daily.add(new DailyTotal(d, perDay.getOrDefault(d, BigDecimal.ZERO)));
        }

        List<MerchantTotal> merchants = list.stream().filter(e -> e.getMerchant() != null)
                .collect(Collectors.groupingBy(e -> e.getMerchant().trim()))
                .entrySet().stream()
                .map(e -> new MerchantTotal(e.getKey(), sum(e.getValue()), e.getValue().size()))
                .sorted(Comparator.comparing(MerchantTotal::amount).reversed())
                .limit(5).toList();

        return new Spending(total, prevTotal, changePct, list.size(), avg, byCategory, daily, merchants);
    }

    private Weight weight(long userId, LocalDate from, LocalDate to) {
        List<WeightLog> logs = weights.findByUserIdAndLogDateBetweenOrderByLogDateAsc(userId, from, to);
        BigDecimal target = profiles.findById(userId).map(p -> p.getTargetWeightKg()).orElse(null);
        if (logs.isEmpty()) return new Weight(null, null, null, null, null, target, List.of());

        // Điểm bắt đầu là lần cân gần nhất trước tháng (nếu có) để thấy thay đổi trọn tháng
        BigDecimal start = weights.findFirstByUserIdAndLogDateLessThanOrderByLogDateDesc(userId, from)
                .map(WeightLog::getWeightKg).orElse(logs.getFirst().getWeightKg());
        BigDecimal end = logs.getLast().getWeightKg();
        BigDecimal min = logs.stream().map(WeightLog::getWeightKg).min(BigDecimal::compareTo).orElseThrow();
        BigDecimal max = logs.stream().map(WeightLog::getWeightKg).max(BigDecimal::compareTo).orElseThrow();
        List<WeightPoint> points = logs.stream().map(w -> new WeightPoint(w.getLogDate(), w.getWeightKg())).toList();
        return new Weight(start, end, end.subtract(start), min, max, target, points);
    }

    private Nutrition nutrition(long userId, LocalDate from, LocalDate to) {
        List<MealPlan> list = plans.findByUserIdAndPlanDateBetween(userId, from, to);
        if (list.isEmpty()) return new Nutrition(0, null, null, null, null);
        double kcal = 0, targetKcal = 0, protein = 0, targetProtein = 0;
        for (MealPlan p : list) {
            for (MealPlanItem i : p.getItems()) {
                kcal += i.getKcal().doubleValue();
                protein += i.getProtein().doubleValue();
            }
            targetKcal += p.getTargetKcal().doubleValue();
            targetProtein += p.getTargetProtein().doubleValue();
        }
        int n = list.size();
        return new Nutrition(n, (int) Math.round(kcal / n), (int) Math.round(targetKcal / n),
                (int) Math.round(protein / n), (int) Math.round(targetProtein / n));
    }

    private Moments moments(long userId, LocalDate from, LocalDate to) {
        List<Moment> list = moments.findByUserIdAndTakenOnBetweenOrderByTakenOnDescCreatedAtDesc(userId, from, to);
        List<String> previews = list.stream().filter(m -> m.getMediaType() == Moment.MediaType.PHOTO)
                .limit(6).map(m -> storage.signedUrl(m.getStorageKey())).toList();
        return new Moments(list.size(), previews);
    }

    private static BigDecimal sum(List<Expense> list) {
        return list.stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
