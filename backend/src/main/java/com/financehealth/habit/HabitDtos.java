package com.financehealth.habit;

import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

public final class HabitDtos {

    private HabitDtos() {}

    public record CreateRequest(@NotBlank @Size(max = 60) String name, @Size(max = 16) String emoji,
                                Habit.Frequency frequency) {}

    /** Trường nào null thì giữ nguyên. Thói quen mặc định chỉ đổi được tên, emoji và ẩn/hiện. */
    public record UpdateRequest(@Size(min = 1, max = 60) String name, @Size(min = 1, max = 16) String emoji,
                                Habit.Frequency frequency, Boolean archived) {}

    /** slot: 0 với thói quen thường, 1..3 (sáng/trưa/tối) với thói quen ăn theo thực đơn. */
    public record CheckRequest(@NotNull LocalDate date, @Min(0) @Max(3) int slot, boolean done) {}

    public record HabitView(long id, Habit.Kind kind, String name, String emoji, Habit.Frequency frequency,
                            boolean auto, int dailyTarget, boolean archived,
                            /* Hôm nay (WEEKLY: tuần này) đã đạt chưa */
                            boolean done, int todayCount, List<Integer> todaySlots,
                            int currentStreak, int bestStreak, Integer rate30,
                            /* Mức 0/1/2 từng ngày, từ historyStart tới hôm nay */
                            int[] history) {}

    public record Overview(LocalDate today, LocalDate historyStart, List<HabitView> habits) {}

    public record MonthlyItem(long id, String name, String emoji, Habit.Frequency frequency,
                              int done, int total, Integer percent) {}

    public record Monthly(Integer percent, List<MonthlyItem> items) {}
}
