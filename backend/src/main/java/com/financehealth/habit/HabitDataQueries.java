package com.financehealth.habit;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.*;

/**
 * Đếm số lần đạt mỗi ngày của từng thói quen bằng SQL thuần: thói quen tự động đọc thẳng
 * bảng chi tiêu / khoảnh khắc / cân nặng, thói quen tick tay đọc habit_checks.
 */
@Repository
public class HabitDataQueries {

    private static final String AUTO_SQL = """
            SELECT 'EXPENSE' AS kind, spent_on AS d, COUNT(*) AS n FROM expenses
             WHERE user_id = :userId AND spent_on BETWEEN :from AND :to GROUP BY spent_on
            UNION ALL
            SELECT 'MOMENT', taken_on, COUNT(*) FROM moments
             WHERE user_id = :userId AND taken_on BETWEEN :from AND :to GROUP BY taken_on
            UNION ALL
            SELECT 'WEIGHT', log_date, COUNT(*) FROM weight_logs
             WHERE user_id = :userId AND log_date BETWEEN :from AND :to GROUP BY log_date
            """;

    private static final String CHECKS_SQL = """
            SELECT c.habit_id, c.check_date, COUNT(*) AS n
              FROM habit_checks c JOIN habits h ON h.id = c.habit_id
             WHERE h.user_id = :userId AND c.check_date BETWEEN :from AND :to
             GROUP BY c.habit_id, c.check_date
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public HabitDataQueries(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String DEFAULTS_SQL = """
            INSERT INTO habits (user_id, kind, name, emoji, frequency, daily_target, position, start_date)
            SELECT u.id, v.kind, v.name, v.emoji, v.frequency, v.target, v.position,
                   CASE WHEN v.kind = 'MEAL' THEN :today ELSE (u.created_at AT TIME ZONE :zone)::date END
              FROM users u,
                   (VALUES ('EXPENSE', 'Ghi chi tiêu', '💸', 'DAILY', 1, 1),
                           ('MOMENT', 'Chụp khoảnh khắc', '📸', 'DAILY', 1, 2),
                           ('WEIGHT', 'Cân mỗi tuần', '⚖️', 'WEEKLY', 1, 3),
                           ('MEAL', 'Ăn theo thực đơn', '🥗', 'DAILY', 3, 4))
                   AS v (kind, name, emoji, frequency, target, position)
             WHERE u.id = :userId
            ON CONFLICT (user_id, kind) WHERE kind <> 'CUSTOM' DO NOTHING
            """;

    /**
     * Tạo các thói quen mặc định. Thói quen tự động tính từ ngày tạo tài khoản vì dữ liệu đã có sẵn,
     * thói quen thực đơn tính từ hôm nay vì trước đó chưa tick được.
     */
    public void insertDefaults(long userId, LocalDate today, String zone) {
        jdbc.update(DEFAULTS_SQL, new MapSqlParameterSource().addValue("userId", userId)
                .addValue("today", today).addValue("zone", zone));
    }

    /** Số lần đạt theo ngày cho từng thói quen trong khoảng [from, to]. */
    public Map<Long, Map<LocalDate, Integer>> dailyCounts(long userId, List<Habit> habits, LocalDate from, LocalDate to) {
        var params = new MapSqlParameterSource().addValue("userId", userId).addValue("from", from).addValue("to", to);

        Map<Habit.Kind, Map<LocalDate, Integer>> auto = new EnumMap<>(Habit.Kind.class);
        if (habits.stream().anyMatch(h -> h.getKind().auto())) {
            jdbc.query(AUTO_SQL, params, rs -> {
                auto.computeIfAbsent(Habit.Kind.valueOf(rs.getString("kind")), k -> new HashMap<>())
                        .put(rs.getObject("d", LocalDate.class), rs.getInt("n"));
            });
        }
        Map<Long, Map<LocalDate, Integer>> manual = new HashMap<>();
        jdbc.query(CHECKS_SQL, params, rs -> {
            manual.computeIfAbsent(rs.getLong("habit_id"), k -> new HashMap<>())
                    .put(rs.getObject("check_date", LocalDate.class), rs.getInt("n"));
        });

        Map<Long, Map<LocalDate, Integer>> result = new HashMap<>();
        for (Habit h : habits) {
            Map<LocalDate, Integer> counts = h.getKind().auto() ? auto.get(h.getKind()) : manual.get(h.getId());
            result.put(h.getId(), counts == null ? Map.of() : counts);
        }
        return result;
    }

    public void setCheck(long habitId, LocalDate date, int slot, boolean done) {
        var params = new MapSqlParameterSource().addValue("id", habitId).addValue("d", date).addValue("s", slot);
        if (done) {
            jdbc.update("INSERT INTO habit_checks (habit_id, check_date, slot) VALUES (:id, :d, :s) ON CONFLICT DO NOTHING", params);
        } else {
            jdbc.update("DELETE FROM habit_checks WHERE habit_id = :id AND check_date = :d AND slot = :s", params);
        }
    }

    /** Ô đã tick hôm nay của nhiều thói quen, để hiển thị bữa nào đã ăn. */
    public Map<Long, List<Integer>> slotsOn(Collection<Long> habitIds, LocalDate date) {
        Map<Long, List<Integer>> result = new HashMap<>();
        if (habitIds.isEmpty()) return result;
        jdbc.query("SELECT habit_id, slot FROM habit_checks WHERE habit_id IN (:ids) AND check_date = :d ORDER BY slot",
                new MapSqlParameterSource().addValue("ids", habitIds).addValue("d", date),
                rs -> { result.computeIfAbsent(rs.getLong("habit_id"), k -> new ArrayList<>()).add(rs.getInt("slot")); });
        return result;
    }
}
