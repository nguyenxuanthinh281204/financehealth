package com.financehealth.habit;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HabitTrackerTest {

    // Thứ Năm
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 29);

    private static Map<LocalDate, Integer> days(int... daysAgo) {
        Map<LocalDate, Integer> m = new HashMap<>();
        for (int d : daysAgo) m.merge(TODAY.minusDays(d), 1, Integer::sum);
        return m;
    }

    @Test
    void dailyStreakCountsFromYesterdayWhenTodayNotDoneYet() {
        var t = new HabitTracker(Habit.Frequency.DAILY, 1, TODAY.minusDays(30), days(1, 2, 3, 5, 6));
        assertThat(t.done(TODAY)).isFalse();
        assertThat(t.currentStreak(TODAY)).isEqualTo(3);
        assertThat(t.bestStreak(TODAY.minusDays(30), TODAY)).isEqualTo(3);

        var withToday = new HabitTracker(Habit.Frequency.DAILY, 1, TODAY.minusDays(30), days(0, 1, 2, 3, 5, 6));
        assertThat(withToday.currentStreak(TODAY)).isEqualTo(4);
    }

    @Test
    void streakBrokenByMissedYesterday() {
        var t = new HabitTracker(Habit.Frequency.DAILY, 1, TODAY.minusDays(30), days(2, 3));
        assertThat(t.currentStreak(TODAY)).isZero();
        assertThat(t.bestStreak(TODAY.minusDays(30), TODAY)).isEqualTo(2);
    }

    @Test
    void partialDayIsNotDone() {
        Map<LocalDate, Integer> counts = Map.of(TODAY, 2, TODAY.minusDays(1), 3);
        var t = new HabitTracker(Habit.Frequency.DAILY, 3, TODAY.minusDays(5), counts);
        assertThat(t.level(TODAY)).isEqualTo(HabitTracker.PARTIAL);
        assertThat(t.level(TODAY.minusDays(1))).isEqualTo(HabitTracker.DONE);
        assertThat(t.done(TODAY)).isFalse();
        assertThat(t.currentStreak(TODAY)).isEqualTo(1);
        assertThat(t.history(TODAY.minusDays(2), TODAY)).containsExactly(0, 2, 1);
    }

    @Test
    void weeklyStreakAndRate() {
        // Tuần này chưa cân; 3 tuần trước liên tiếp có cân, tuần thứ 5 trước thì không
        var t = new HabitTracker(Habit.Frequency.WEEKLY, 1, TODAY.minusWeeks(6), days(5, 12, 19, 40));
        assertThat(t.done(TODAY)).isFalse();
        assertThat(t.currentStreak(TODAY)).isEqualTo(3);
        // Tháng 10/2026: tuần 28/9 trượt, tuần 5/10, 12/10, 19/10 đạt, tuần 26/10 đang diễn ra nên chưa tính
        HabitTracker.Rate r = t.rate(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), TODAY);
        assertThat(r.total()).isEqualTo(4);
        assertThat(r.done()).isEqualTo(3);
    }

    @Test
    void rateSkipsDaysBeforeStartAndTodayInProgress() {
        var t = new HabitTracker(Habit.Frequency.DAILY, 1, TODAY.minusDays(4), days(1, 2, 3, 10));
        HabitTracker.Rate r = t.rate(TODAY.minusDays(29), TODAY, TODAY);
        assertThat(r.total()).isEqualTo(4);
        assertThat(r.done()).isEqualTo(3);
        assertThat(r.percent()).isEqualTo(75);
        assertThat(t.currentStreak(TODAY)).isEqualTo(3);
    }
}
