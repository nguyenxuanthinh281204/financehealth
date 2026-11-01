package com.financehealth.vocab;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Lịch ôn lặp lại ngắt quãng theo SM-2 như Anki (bản mặc định, không ngẫu nhiên hóa):
 * thẻ mới đi qua các bước học 1 phút → 10 phút, thuộc rồi thì ôn theo ngày với khoảng cách nhân hệ số dễ.
 */
public final class Scheduler {

    public enum State { NEW, LEARNING, REVIEW, RELEARNING }

    /** 1 Quên, 2 Khó, 3 Được, 4 Dễ. */
    public enum Rating {
        AGAIN, HARD, GOOD, EASY;

        public static Rating of(int value) {
            if (value < 1 || value > 4) throw new IllegalArgumentException("rating 1..4");
            return values()[value - 1];
        }
    }

    /** Trạng thái lịch ôn của một thẻ. ease là hệ số dễ x1000 (2500 = 2.5). */
    public record Srs(State state, int step, int intervalDays, int ease, int reps, int lapses, Instant dueAt) {
        public static Srs fresh() {
            return new Srs(State.NEW, 0, 0, START_EASE, 0, 0, null);
        }
    }

    static final List<Duration> LEARN_STEPS = List.of(Duration.ofMinutes(1), Duration.ofMinutes(10));
    static final List<Duration> RELEARN_STEPS = List.of(Duration.ofMinutes(10));
    static final int GRADUATING_DAYS = 1;
    static final int EASY_DAYS = 4;
    static final int START_EASE = 2500;
    static final int MIN_EASE = 1300;
    static final double HARD_FACTOR = 1.2;
    static final double EASY_BONUS = 1.3;
    static final int MAX_INTERVAL = 36500;

    private final ZoneId zone;

    public Scheduler(ZoneId zone) {
        this.zone = zone;
    }

    public Srs answer(Srs s, Rating r, Instant now) {
        LocalDate today = LocalDate.ofInstant(now, zone);
        return switch (s.state()) {
            case NEW, LEARNING -> learn(s, r, now, today, LEARN_STEPS, false);
            case RELEARNING -> learn(s, r, now, today, RELEARN_STEPS, true);
            case REVIEW -> review(s, r, now, today);
        };
    }

    private Srs learn(Srs s, Rating r, Instant now, LocalDate today, List<Duration> steps, boolean relearning) {
        State learning = relearning ? State.RELEARNING : State.LEARNING;
        int step = Math.min(s.step(), steps.size() - 1);
        int reps = s.reps() + (r == Rating.AGAIN ? 0 : 1);
        return switch (r) {
            case AGAIN -> new Srs(learning, 0, s.intervalDays(), s.ease(), reps, s.lapses(), now.plus(steps.get(0)));
            case HARD -> new Srs(learning, step, s.intervalDays(), s.ease(), reps, s.lapses(), now.plus(hardDelay(steps, step)));
            case GOOD -> step + 1 < steps.size()
                    ? new Srs(learning, step + 1, s.intervalDays(), s.ease(), reps, s.lapses(), now.plus(steps.get(step + 1)))
                    : graduate(s, relearning ? Math.max(1, s.intervalDays()) : GRADUATING_DAYS, reps, today);
            case EASY -> graduate(s, relearning ? Math.max(1, s.intervalDays()) + 1 : EASY_DAYS, reps, today);
        };
    }

    /** Khó ở bước đầu: trung bình hai bước đầu (1 và 10 phút → 6 phút); chỉ có một bước thì gấp rưỡi. */
    private static Duration hardDelay(List<Duration> steps, int step) {
        if (step == 0) {
            long secs = steps.size() > 1
                    ? (steps.get(0).toSeconds() + steps.get(1).toSeconds()) / 2
                    : Math.round(steps.get(0).toSeconds() * 1.5);
            return Duration.ofSeconds(Math.round(secs / 60.0) * 60);
        }
        return steps.get(step);
    }

    private Srs graduate(Srs s, int days, int reps, LocalDate today) {
        int ivl = clamp(days);
        return new Srs(State.REVIEW, 0, ivl, s.ease(), reps, s.lapses(), dayStart(today.plusDays(ivl)));
    }

    private Srs review(Srs s, Rating r, Instant now, LocalDate today) {
        int ivl = Math.max(1, s.intervalDays());
        LocalDate dueDay = s.dueAt() == null ? today : LocalDate.ofInstant(s.dueAt(), zone);
        long late = Math.max(0, ChronoUnit.DAYS.between(dueDay, today));
        if (r == Rating.AGAIN) {
            int ease = Math.max(MIN_EASE, s.ease() - 200);
            // Quên: học lại 10 phút, sau đó ôn lại từ 1 ngày
            return new Srs(State.RELEARNING, 0, 1, ease, s.reps(), s.lapses() + 1, now.plus(RELEARN_STEPS.get(0)));
        }
        int hard = clamp(Math.max(ivl + 1, (int) Math.round(ivl * HARD_FACTOR)));
        int good = clamp(Math.max(hard + 1, (int) Math.round((ivl + late / 2.0) * s.ease() / 1000.0)));
        int easy = clamp(Math.max(good + 1, (int) Math.round((ivl + late) * s.ease() / 1000.0 * EASY_BONUS)));
        int ease = switch (r) {
            case HARD -> Math.max(MIN_EASE, s.ease() - 150);
            case EASY -> s.ease() + 150;
            default -> s.ease();
        };
        int next = switch (r) {
            case HARD -> hard;
            case EASY -> easy;
            default -> good;
        };
        return new Srs(State.REVIEW, 0, next, ease, s.reps() + 1, s.lapses(), dayStart(today.plusDays(next)));
    }

    /** Nhãn thời gian ôn tiếp theo hiện trên nút: "1 ph", "10 ph", "4 ngày", "1,5 th", "2,1 năm". */
    public String preview(Srs s, Rating r, Instant now) {
        Srs next = answer(s, r, now);
        if (next.state() == State.REVIEW) return days(next.intervalDays());
        long minutes = Math.max(1, Math.round(Duration.between(now, next.dueAt()).toSeconds() / 60.0));
        if (minutes < 60) return minutes + " ph";
        if (minutes < 1440) return trim(minutes / 60.0) + " giờ";
        return days((int) (minutes / 1440));
    }

    static String days(int d) {
        if (d < 30) return d + " ngày";
        if (d < 365) return trim(d / 30.0) + " th";
        return trim(d / 365.0) + " năm";
    }

    private static String trim(double v) {
        double r = Math.round(v * 10) / 10.0;
        return r == Math.floor(r) ? String.valueOf((long) r) : String.valueOf(r).replace('.', ',');
    }

    private Instant dayStart(LocalDate d) {
        return d.atStartOfDay(zone).toInstant();
    }

    private static int clamp(int days) {
        return Math.min(MAX_INTERVAL, Math.max(1, days));
    }
}
