package com.financehealth.vocab;

import com.financehealth.vocab.Scheduler.Rating;
import com.financehealth.vocab.Scheduler.Srs;
import com.financehealth.vocab.Scheduler.State;
import org.junit.jupiter.api.Test;

import java.time.*;

import static org.assertj.core.api.Assertions.assertThat;

class SchedulerTest {

    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    final Scheduler s = new Scheduler(ZONE);
    final Instant now = LocalDateTime.of(2026, 11, 1, 9, 30).atZone(ZONE).toInstant();
    final LocalDate today = LocalDate.of(2026, 11, 1);

    private Instant dayStart(LocalDate d) {
        return d.atStartOfDay(ZONE).toInstant();
    }

    @Test
    void newCardStepsThenGraduates() {
        Srs fresh = Srs.fresh();
        assertThat(s.preview(fresh, Rating.AGAIN, now)).isEqualTo("1 ph");
        assertThat(s.preview(fresh, Rating.HARD, now)).isEqualTo("6 ph");
        assertThat(s.preview(fresh, Rating.GOOD, now)).isEqualTo("10 ph");
        assertThat(s.preview(fresh, Rating.EASY, now)).isEqualTo("4 ngày");

        Srs step1 = s.answer(fresh, Rating.GOOD, now);
        assertThat(step1.state()).isEqualTo(State.LEARNING);
        assertThat(step1.step()).isEqualTo(1);
        assertThat(step1.dueAt()).isEqualTo(now.plus(Duration.ofMinutes(10)));

        Srs grad = s.answer(step1, Rating.GOOD, now);
        assertThat(grad.state()).isEqualTo(State.REVIEW);
        assertThat(grad.intervalDays()).isEqualTo(1);
        assertThat(grad.dueAt()).isEqualTo(dayStart(today.plusDays(1)));

        Srs again = s.answer(step1, Rating.AGAIN, now);
        assertThat(again.step()).isZero();
        assertThat(again.dueAt()).isEqualTo(now.plus(Duration.ofMinutes(1)));
    }

    @Test
    void reviewIntervalsGrowWithEase() {
        Srs review = new Srs(State.REVIEW, 0, 10, 2500, 3, 0, dayStart(today));
        Srs hard = s.answer(review, Rating.HARD, now);
        Srs good = s.answer(review, Rating.GOOD, now);
        Srs easy = s.answer(review, Rating.EASY, now);
        assertThat(hard.intervalDays()).isEqualTo(12);
        assertThat(hard.ease()).isEqualTo(2350);
        assertThat(good.intervalDays()).isEqualTo(25);
        assertThat(good.ease()).isEqualTo(2500);
        assertThat(easy.intervalDays()).isEqualTo(33);
        assertThat(easy.ease()).isEqualTo(2650);
        assertThat(good.dueAt()).isEqualTo(dayStart(today.plusDays(25)));
        assertThat(s.preview(review, Rating.GOOD, now)).isEqualTo("25 ngày");
        assertThat(s.preview(review, Rating.EASY, now)).isEqualTo("1,1 th");
    }

    @Test
    void lapseGoesToRelearningThenBackToReview() {
        Srs review = new Srs(State.REVIEW, 0, 30, 1400, 5, 0, dayStart(today));
        Srs lapse = s.answer(review, Rating.AGAIN, now);
        assertThat(lapse.state()).isEqualTo(State.RELEARNING);
        assertThat(lapse.lapses()).isEqualTo(1);
        assertThat(lapse.ease()).isEqualTo(Scheduler.MIN_EASE);
        assertThat(lapse.dueAt()).isEqualTo(now.plus(Duration.ofMinutes(10)));
        assertThat(s.preview(lapse, Rating.HARD, now)).isEqualTo("15 ph");

        Srs back = s.answer(lapse, Rating.GOOD, now);
        assertThat(back.state()).isEqualTo(State.REVIEW);
        assertThat(back.intervalDays()).isEqualTo(1);
    }

    @Test
    void overdueCardsGetBonus() {
        Srs late = new Srs(State.REVIEW, 0, 10, 2500, 3, 0, dayStart(today.minusDays(10)));
        // (10 + 10/2) * 2.5 = 37.5 → 38
        assertThat(s.answer(late, Rating.GOOD, now).intervalDays()).isEqualTo(38);
    }

    @Test
    void labels() {
        assertThat(Scheduler.days(1)).isEqualTo("1 ngày");
        assertThat(Scheduler.days(45)).isEqualTo("1,5 th");
        assertThat(Scheduler.days(730)).isEqualTo("2 năm");
    }
}
