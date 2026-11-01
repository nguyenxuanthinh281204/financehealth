package com.financehealth.vocab;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Thống kê bằng SQL thuần: đếm thẻ theo trạng thái, thẻ mới đã học hôm nay, ngày có ôn bài. */
@Component
public class VocabStats {

    public record DeckCounts(int total, int unseen, int learning, int due, int mature) {
        static final DeckCounts EMPTY = new DeckCounts(0, 0, 0, 0, 0);
    }

    private static final String COUNTS_SQL = """
            SELECT d.id,
                   count(c.id) AS total,
                   count(c.id) FILTER (WHERE c.state = 'NEW') AS unseen,
                   count(c.id) FILTER (WHERE c.state IN ('LEARNING', 'RELEARNING') AND c.due_at <= :ahead) AS learning,
                   count(c.id) FILTER (WHERE c.state = 'REVIEW' AND c.due_at <= :now) AS due,
                   count(c.id) FILTER (WHERE c.state = 'REVIEW' AND c.interval_days >= 21) AS mature
            FROM vocab_decks d
            LEFT JOIN vocab_cards c ON c.deck_id = d.id
            WHERE d.user_id = :userId
            GROUP BY d.id
            """;

    private static final String NEW_TODAY_SQL = """
            SELECT c.deck_id, count(*) AS n
            FROM vocab_reviews r
            JOIN vocab_cards c ON c.id = r.card_id
            WHERE r.user_id = :userId AND r.was_new AND r.reviewed_at >= :dayStart
            GROUP BY c.deck_id
            """;

    private static final String DAYS_SQL = """
            SELECT DISTINCT (reviewed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d
            FROM vocab_reviews
            WHERE user_id = :userId AND reviewed_at >= :since
            ORDER BY d DESC
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public VocabStats(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<Long, DeckCounts> counts(long userId, Instant now, Instant ahead) {
        var params = new MapSqlParameterSource().addValue("userId", userId)
                .addValue("now", Timestamp.from(now)).addValue("ahead", Timestamp.from(ahead));
        Map<Long, DeckCounts> out = new HashMap<>();
        jdbc.query(COUNTS_SQL, params, rs -> {
            out.put(rs.getLong("id"), new DeckCounts(rs.getInt("total"), rs.getInt("unseen"), rs.getInt("learning"),
                    rs.getInt("due"), rs.getInt("mature")));
        });
        return out;
    }

    /** Số thẻ mới đã đưa vào học từ đầu ngày, theo từng bộ. */
    public Map<Long, Integer> newIntroduced(long userId, Instant dayStart) {
        var params = new MapSqlParameterSource().addValue("userId", userId).addValue("dayStart", Timestamp.from(dayStart));
        Map<Long, Integer> out = new HashMap<>();
        jdbc.query(NEW_TODAY_SQL, params, rs -> {
            out.put(rs.getLong("deck_id"), rs.getInt("n"));
        });
        return out;
    }

    public int reviewedSince(long userId, Instant dayStart) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM vocab_reviews WHERE user_id = :userId AND reviewed_at >= :dayStart",
                new MapSqlParameterSource().addValue("userId", userId).addValue("dayStart", Timestamp.from(dayStart)),
                Integer.class);
        return n == null ? 0 : n;
    }

    /** Chuỗi ngày liên tiếp có ôn bài, tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa ôn). */
    public int streak(long userId, LocalDate today, Instant since) {
        List<LocalDate> days = jdbc.queryForList(DAYS_SQL,
                new MapSqlParameterSource().addValue("userId", userId).addValue("since", Timestamp.from(since)),
                LocalDate.class);
        LocalDate cursor = today;
        int i = 0;
        if (!days.isEmpty() && !days.get(0).equals(today)) cursor = today.minusDays(1);
        int streak = 0;
        while (i < days.size() && days.get(i).equals(cursor)) {
            streak++;
            i++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
