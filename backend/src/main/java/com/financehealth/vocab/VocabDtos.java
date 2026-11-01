package com.financehealth.vocab;

import com.financehealth.vocab.Scheduler.State;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class VocabDtos {

    private VocabDtos() {}

    static final String LANG = "^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$";

    public record DeckRequest(@NotBlank @Size(max = 80) String name, @Size(max = 300) String description,
                              @Pattern(regexp = LANG) String language, @Min(0) @Max(500) Integer newPerDay) {}

    public record CardRequest(@NotBlank @Size(max = 200) String term, @NotBlank @Size(max = 500) String meaning,
                              @Size(max = 100) String pronunciation, @Size(max = 1000) String example) {}

    /** Trường nào null thì giữ nguyên; pronunciation/example rỗng là xóa. deckId để chuyển sang bộ khác. */
    public record UpdateCardRequest(@Size(min = 1, max = 200) String term, @Size(min = 1, max = 500) String meaning,
                                    @Size(max = 100) String pronunciation, @Size(max = 1000) String example,
                                    Long deckId) {}

    public record BulkRequest(@NotEmpty @Size(max = 2000) List<@Valid CardRequest> cards) {}

    /** rating: 1 Quên, 2 Khó, 3 Được, 4 Dễ. deckId: phạm vi hàng đợi trả về (null là tất cả các bộ). */
    public record ReviewRequest(@NotNull @Min(1) @Max(4) Integer rating, Long deckId) {}

    /**
     * newCount: thẻ mới còn được học hôm nay; learning: thẻ đang học đến lượt; due: thẻ đến hạn ôn;
     * unseen: tổng thẻ chưa học; mature: thẻ đã nhớ lâu (khoảng ôn từ 21 ngày).
     */
    public record DeckView(long id, String name, String description, String language, int newPerDay,
                           int total, int unseen, int newCount, int learning, int due, int mature) {}

    public record Overview(LocalDate today, int reviewedToday, int streak, List<DeckView> decks) {}

    public record CardView(long id, long deckId, String term, String meaning, String pronunciation, String example,
                           State state, int intervalDays, Instant dueAt, int reps, int lapses, int ease) {}

    public record DeckCards(DeckView deck, List<CardView> cards) {}

    /** intervals: nhãn thời gian ôn tiếp theo cho 4 nút Quên/Khó/Được/Dễ. */
    public record StudyCard(CardView card, String language, List<String> intervals) {}

    /**
     * Hàng đợi học: thẻ đang học/đến hạn trước, rồi thẻ mới, cuối cùng thẻ đang học sắp đến lượt (trong 20 phút).
     * nextAt: lúc thẻ đang học gần nhất đến lượt khi hàng đợi đã trống.
     */
    public record Study(List<StudyCard> queue, int newCount, int learningCount, int reviewCount,
                       Instant nextAt, int reviewedToday) {}

    public record BulkResult(int added, DeckView deck) {}
}
