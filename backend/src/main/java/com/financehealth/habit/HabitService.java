package com.financehealth.habit;

import com.financehealth.body.BodyService;
import com.financehealth.common.ApiException;
import com.financehealth.habit.HabitDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class HabitService {

    /** Bản đồ nhiệt hiển thị 26 tuần gần nhất. */
    static final int HEATMAP_WEEKS = 26;
    /** Chuỗi dài nhất tính trong một năm gần đây. */
    static final int STREAK_WINDOW_DAYS = 365;
    /** Chỉ cho tick bù trong 7 ngày gần đây. */
    static final int BACKFILL_DAYS = 6;

    private final HabitRepository habits;
    private final HabitDataQueries data;

    public HabitService(HabitRepository habits, HabitDataQueries data) {
        this.habits = habits;
        this.data = data;
    }

    private static LocalDate today() {
        return LocalDate.now(BodyService.ZONE);
    }

    @Transactional
    public Overview overview(long userId) {
        LocalDate today = today();
        data.insertDefaults(userId, today, BodyService.ZONE.getId());
        List<Habit> list = habits.findByUserIdOrderByPositionAscIdAsc(userId);
        return new Overview(today, historyStart(today), views(userId, list, today));
    }

    @Transactional
    public HabitView create(long userId, CreateRequest req) {
        int position = habits.findByUserIdOrderByPositionAscIdAsc(userId).stream()
                .mapToInt(Habit::getPosition).max().orElse(0) + 1;
        String emoji = req.emoji() == null || req.emoji().isBlank() ? "✅" : req.emoji().trim();
        Habit h = habits.save(new Habit(userId, Habit.Kind.CUSTOM, req.name().trim(), emoji,
                req.frequency() == null ? Habit.Frequency.DAILY : req.frequency(), 1, position, today()));
        return view(userId, h);
    }

    @Transactional
    public HabitView update(long userId, long id, UpdateRequest req) {
        Habit h = find(userId, id);
        if (req.name() != null) h.setName(req.name().trim());
        if (req.emoji() != null) h.setEmoji(req.emoji().trim());
        if (req.frequency() != null && req.frequency() != h.getFrequency()) {
            if (h.getKind() != Habit.Kind.CUSTOM) throw ApiException.badRequest("Không đổi được tần suất của thói quen mặc định");
            h.setFrequency(req.frequency());
        }
        if (req.archived() != null) h.setArchived(req.archived());
        return view(userId, h);
    }

    @Transactional
    public void delete(long userId, long id) {
        Habit h = find(userId, id);
        if (h.getKind() != Habit.Kind.CUSTOM) throw ApiException.badRequest("Thói quen mặc định chỉ ẩn được, không xóa được");
        habits.delete(h);
    }

    @Transactional
    public HabitView check(long userId, long id, CheckRequest req) {
        Habit h = find(userId, id);
        LocalDate today = today();
        if (h.getKind().auto()) throw ApiException.badRequest("Thói quen này tự đánh dấu từ dữ liệu của bạn");
        if (req.date().isAfter(today)) throw ApiException.badRequest("Không đánh dấu trước cho ngày chưa tới");
        if (req.date().isBefore(today.minusDays(BACKFILL_DAYS))) {
            throw ApiException.badRequest("Chỉ đánh dấu bù được trong 7 ngày gần đây");
        }
        int slot = h.getKind() == Habit.Kind.MEAL ? req.slot() : 0;
        if (h.getKind() == Habit.Kind.MEAL && slot == 0) throw ApiException.badRequest("Chọn bữa sáng, trưa hoặc tối");
        if (req.done() && req.date().isBefore(h.getStartDate())) h.setStartDate(req.date());
        data.setCheck(h.getId(), req.date(), slot, req.done());
        return view(userId, h);
    }

    /** Tỉ lệ hoàn thành các thói quen đang theo dõi trong [from, to]. */
    @Transactional(readOnly = true)
    public Monthly monthly(long userId, LocalDate from, LocalDate to, LocalDate today) {
        List<Habit> list = habits.findByUserIdOrderByPositionAscIdAsc(userId).stream().filter(h -> !h.isArchived()).toList();
        if (list.isEmpty() || from.isAfter(today)) return new Monthly(null, List.of());
        // Tuần đầu/cuối có thể lấn sang tháng bên cạnh, nên lấy dư 6 ngày mỗi phía
        Map<Long, Map<LocalDate, Integer>> counts = data.dailyCounts(userId, list, from.minusDays(6), to.plusDays(6));
        List<MonthlyItem> items = new ArrayList<>();
        int done = 0, total = 0;
        for (Habit h : list) {
            HabitTracker.Rate r = tracker(h, counts).rate(from, to, today);
            items.add(new MonthlyItem(h.getId(), h.getName(), h.getEmoji(), h.getFrequency(), r.done(), r.total(), r.percent()));
            done += r.done();
            total += r.total();
        }
        return new Monthly(new HabitTracker.Rate(done, total).percent(), items);
    }

    private Habit find(long userId, long id) {
        return habits.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("thói quen"));
    }

    static LocalDate historyStart(LocalDate today) {
        return HabitTracker.weekStart(today).minusWeeks(HEATMAP_WEEKS - 1);
    }

    private HabitView view(long userId, Habit h) {
        return views(userId, List.of(h), today()).getFirst();
    }

    private List<HabitView> views(long userId, List<Habit> list, LocalDate today) {
        LocalDate historyStart = historyStart(today);
        LocalDate windowStart = today.minusDays(STREAK_WINDOW_DAYS);
        LocalDate from = historyStart.isBefore(windowStart) ? historyStart : windowStart;
        Map<Long, Map<LocalDate, Integer>> counts = data.dailyCounts(userId, list, from, today);
        Map<Long, List<Integer>> slots = data.slotsOn(list.stream()
                .filter(h -> h.getKind() == Habit.Kind.MEAL).map(Habit::getId).toList(), today);

        return list.stream().map(h -> {
            HabitTracker t = tracker(h, counts);
            return new HabitView(h.getId(), h.getKind(), h.getName(), h.getEmoji(), h.getFrequency(),
                    h.getKind().auto(), h.getDailyTarget(), h.isArchived(),
                    t.done(today), t.count(today), slots.getOrDefault(h.getId(), List.of()),
                    t.currentStreak(today), t.bestStreak(windowStart, today),
                    t.rate(today.minusDays(29), today, today).percent(), t.history(historyStart, today));
        }).toList();
    }

    private static HabitTracker tracker(Habit h, Map<Long, Map<LocalDate, Integer>> counts) {
        return new HabitTracker(h.getFrequency(), h.getDailyTarget(), h.getStartDate(),
                counts.getOrDefault(h.getId(), Map.of()));
    }
}
