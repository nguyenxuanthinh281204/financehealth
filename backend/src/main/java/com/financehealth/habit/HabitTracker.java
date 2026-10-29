package com.financehealth.habit;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;

/** Tính mức hoàn thành, chuỗi liên tiếp và tỉ lệ của một thói quen từ số lần đạt mỗi ngày. */
public final class HabitTracker {

    /** Mức của một ô trên bản đồ nhiệt. */
    public static final int NONE = 0, PARTIAL = 1, DONE = 2;

    public record Rate(int done, int total) {
        public Integer percent() {
            return total == 0 ? null : (int) Math.round(done * 100.0 / total);
        }
    }

    private final Habit.Frequency frequency;
    private final int target;
    private final LocalDate start;
    private final Map<LocalDate, Integer> counts;

    public HabitTracker(Habit.Frequency frequency, int target, LocalDate start, Map<LocalDate, Integer> counts) {
        this.frequency = frequency;
        this.target = Math.max(target, 1);
        this.start = start;
        this.counts = counts;
    }

    public static LocalDate weekStart(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public int count(LocalDate d) {
        return counts.getOrDefault(d, 0);
    }

    public int level(LocalDate d) {
        int n = count(d);
        return n >= target ? DONE : n > 0 ? PARTIAL : NONE;
    }

    /** Ngày (DAILY) hoặc tuần chứa ngày đó (WEEKLY) đã đạt chưa. */
    public boolean done(LocalDate d) {
        if (frequency == Habit.Frequency.DAILY) return level(d) == DONE;
        LocalDate w = weekStart(d);
        for (int i = 0; i < 7; i++) {
            if (level(w.plusDays(i)) == DONE) return true;
        }
        return false;
    }

    public int[] history(LocalDate from, LocalDate to) {
        int[] levels = new int[(int) ChronoUnit.DAYS.between(from, to) + 1];
        for (int i = 0; i < levels.length; i++) levels[i] = level(from.plusDays(i));
        return levels;
    }

    private int step() {
        return frequency == Habit.Frequency.DAILY ? 1 : 7;
    }

    private LocalDate firstPeriod() {
        return frequency == Habit.Frequency.DAILY ? start : weekStart(start);
    }

    /**
     * Chuỗi hiện tại tính tới hôm nay. Hôm nay (hoặc tuần này) chưa xong thì chưa làm đứt chuỗi,
     * vẫn đếm từ hôm qua (tuần trước).
     */
    public int currentStreak(LocalDate today) {
        LocalDate d = frequency == Habit.Frequency.DAILY ? today : weekStart(today);
        if (!done(d)) d = d.minusDays(step());
        int streak = 0;
        LocalDate first = firstPeriod();
        while (!d.isBefore(first) && done(d)) {
            streak++;
            d = d.minusDays(step());
        }
        return streak;
    }

    /** Chuỗi dài nhất trong khoảng [from, today]. */
    public int bestStreak(LocalDate from, LocalDate today) {
        LocalDate d = frequency == Habit.Frequency.DAILY ? from : weekStart(from);
        if (d.isBefore(firstPeriod())) d = firstPeriod();
        int best = 0, run = 0;
        for (; !d.isAfter(today); d = d.plusDays(step())) {
            run = done(d) ? run + 1 : 0;
            best = Math.max(best, run);
        }
        return best;
    }

    /**
     * Số ngày (tuần) đạt trên số ngày (tuần) cần làm trong [from, to], không tính trước ngày bắt đầu.
     * Ngày (tuần) đang diễn ra mà chưa xong thì chưa tính vào mẫu số.
     */
    public Rate rate(LocalDate from, LocalDate to, LocalDate today) {
        if (from.isBefore(start)) from = start;
        if (to.isAfter(today)) to = today;
        if (to.isBefore(from)) return new Rate(0, 0);
        LocalDate d = frequency == Habit.Frequency.DAILY ? from : weekStart(from);
        int done = 0, total = 0;
        for (; !d.isAfter(to); d = d.plusDays(step())) {
            boolean ok = done(d);
            boolean inProgress = !d.plusDays(step() - 1).isBefore(today);
            if (ok) done++;
            if (ok || !inProgress) total++;
        }
        return new Rate(done, total);
    }
}
