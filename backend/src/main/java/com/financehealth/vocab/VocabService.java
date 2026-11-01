package com.financehealth.vocab;

import com.financehealth.body.BodyService;
import com.financehealth.common.ApiException;
import com.financehealth.vocab.Scheduler.Rating;
import com.financehealth.vocab.Scheduler.State;
import com.financehealth.vocab.VocabDtos.*;
import com.financehealth.vocab.VocabStats.DeckCounts;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class VocabService {

    static final int MAX_DECKS = 100;
    static final int MAX_CARDS_PER_DECK = 10_000;
    /** Như Anki: thẻ đang học đến lượt trong 20 phút tới vẫn được học trước khi hết hàng đợi. */
    static final Duration LEARN_AHEAD = Duration.ofMinutes(20);
    static final int QUEUE_LIMIT = 200;
    static final String DEFAULT_LANGUAGE = "en-US";
    static final int DEFAULT_NEW_PER_DAY = 20;

    private final VocabDeckRepository decks;
    private final VocabCardRepository cards;
    private final VocabReviewRepository reviews;
    private final VocabStats stats;
    private final Scheduler scheduler = new Scheduler(BodyService.ZONE);

    public VocabService(VocabDeckRepository decks, VocabCardRepository cards, VocabReviewRepository reviews,
                        VocabStats stats) {
        this.decks = decks;
        this.cards = cards;
        this.reviews = reviews;
        this.stats = stats;
    }

    /* ---------- Bộ thẻ ---------- */

    @Transactional(readOnly = true)
    public Overview overview(long userId) {
        Instant now = Instant.now();
        LocalDate today = LocalDate.now(BodyService.ZONE);
        Instant dayStart = today.atStartOfDay(BodyService.ZONE).toInstant();
        return new Overview(today, stats.reviewedSince(userId, dayStart),
                stats.streak(userId, today, dayStart.minus(Duration.ofDays(400))), deckViews(userId, now));
    }

    @Transactional
    public Overview createDeck(long userId, DeckRequest req) {
        if (decks.countByUserId(userId) >= MAX_DECKS) throw ApiException.badRequest("Tối đa " + MAX_DECKS + " bộ thẻ");
        VocabDeck deck = new VocabDeck(userId, req.name().strip(),
                req.language() == null ? DEFAULT_LANGUAGE : req.language(),
                req.newPerDay() == null ? DEFAULT_NEW_PER_DAY : req.newPerDay());
        deck.setDescription(blankToNull(req.description()));
        decks.save(deck);
        return overview(userId);
    }

    @Transactional
    public Overview updateDeck(long userId, long id, DeckRequest req) {
        VocabDeck deck = findDeck(userId, id);
        deck.setName(req.name().strip());
        deck.setDescription(blankToNull(req.description()));
        if (req.language() != null) deck.setLanguage(req.language());
        if (req.newPerDay() != null) deck.setNewPerDay(req.newPerDay());
        decks.flush();
        return overview(userId);
    }

    @Transactional
    public Overview deleteDeck(long userId, long id) {
        decks.delete(findDeck(userId, id));
        decks.flush();
        return overview(userId);
    }

    @Transactional(readOnly = true)
    public DeckCards deckCards(long userId, long deckId) {
        VocabDeck deck = findDeck(userId, deckId);
        return new DeckCards(deckView(userId, deck), cards.findByDeckIdOrderByIdAsc(deckId).stream().map(VocabService::view).toList());
    }

    /* ---------- Thẻ ---------- */

    @Transactional
    public CardView createCard(long userId, long deckId, CardRequest req) {
        VocabDeck deck = findDeck(userId, deckId);
        ensureRoom(deck.getId(), 1);
        return view(cards.save(newCard(userId, deck.getId(), req)));
    }

    /** Nhập nhiều thẻ một lần (dán từ Quizlet/Anki/Excel). */
    @Transactional
    public BulkResult bulkCreate(long userId, long deckId, BulkRequest req) {
        VocabDeck deck = findDeck(userId, deckId);
        ensureRoom(deck.getId(), req.cards().size());
        cards.saveAll(req.cards().stream().map(c -> newCard(userId, deck.getId(), c)).toList());
        cards.flush();
        return new BulkResult(req.cards().size(), deckView(userId, deck));
    }

    @Transactional
    public CardView updateCard(long userId, long id, UpdateCardRequest req) {
        VocabCard card = findCard(userId, id);
        if (req.term() != null) card.setTerm(requireText(req.term(), "Từ"));
        if (req.meaning() != null) card.setMeaning(requireText(req.meaning(), "Nghĩa"));
        if (req.pronunciation() != null) card.setPronunciation(blankToNull(req.pronunciation()));
        if (req.example() != null) card.setExample(blankToNull(req.example()));
        if (req.deckId() != null && !req.deckId().equals(card.getDeckId())) {
            long target = findDeck(userId, req.deckId()).getId();
            ensureRoom(target, 1);
            card.setDeckId(target);
        }
        cards.flush();
        return view(card);
    }

    @Transactional
    public void deleteCard(long userId, long id) {
        cards.delete(findCard(userId, id));
    }

    /** Học lại từ đầu: thẻ thành thẻ mới (lịch sử ôn vẫn giữ để tính chuỗi ngày). */
    @Transactional
    public CardView resetCard(long userId, long id) {
        VocabCard card = findCard(userId, id);
        card.reset();
        cards.flush();
        return view(card);
    }

    /* ---------- Học ---------- */

    @Transactional(readOnly = true)
    public Study study(long userId, Long deckId) {
        Instant now = Instant.now();
        List<VocabDeck> scope = deckId == null
                ? decks.findByUserIdOrderByCreatedAtAscIdAsc(userId)
                : List.of(findDeck(userId, deckId));
        Map<Long, VocabDeck> byId = new HashMap<>();
        scope.forEach(d -> byId.put(d.getId(), d));
        if (scope.isEmpty()) return new Study(List.of(), 0, 0, 0, null, 0);

        LocalDate today = LocalDate.now(BodyService.ZONE);
        Instant dayStart = today.atStartOfDay(BodyService.ZONE).toInstant();
        Map<Long, Integer> introduced = stats.newIntroduced(userId, dayStart);

        List<VocabCard> dueNow = new ArrayList<>();
        List<VocabCard> ahead = new ArrayList<>();
        Instant nextAt = null;
        // Lấy cả thẻ đang học trong ngày hôm nay để biết lúc nào thẻ tiếp theo đến lượt
        for (VocabCard c : cards.findDue(byId.keySet(), dayStart.plus(Duration.ofDays(1)).minusSeconds(1))) {
            boolean learning = c.getState() == State.LEARNING || c.getState() == State.RELEARNING;
            if (!c.getDueAt().isAfter(now)) dueNow.add(c);
            else if (learning && !c.getDueAt().isAfter(now.plus(LEARN_AHEAD))) ahead.add(c);
            else if (learning && nextAt == null) nextAt = c.getDueAt();
        }
        List<VocabCard> fresh = new ArrayList<>();
        for (VocabDeck d : scope) {
            int left = d.getNewPerDay() - introduced.getOrDefault(d.getId(), 0);
            if (left > 0) fresh.addAll(cards.findByDeckIdAndStateOrderByIdAsc(d.getId(), State.NEW, Limit.of(left)));
        }

        List<VocabCard> queue = new ArrayList<>(dueNow);
        queue.addAll(fresh);
        queue.addAll(ahead);
        int learningCount = 0, reviewCount = 0;
        for (VocabCard c : queue) {
            if (c.getState() == State.REVIEW) reviewCount++;
            else if (c.getState() != State.NEW) learningCount++;
        }
        if (!queue.isEmpty()) nextAt = null;
        List<StudyCard> items = queue.stream().limit(QUEUE_LIMIT)
                .map(c -> new StudyCard(view(c), byId.get(c.getDeckId()).getLanguage(), intervals(c, now)))
                .toList();
        return new Study(items, fresh.size(), learningCount, reviewCount, nextAt, stats.reviewedSince(userId, dayStart));
    }

    @Transactional
    public Study review(long userId, long cardId, ReviewRequest req) {
        VocabCard card = findCard(userId, cardId);
        Instant now = Instant.now();
        boolean wasNew = card.getState() == State.NEW;
        card.apply(scheduler.answer(card.srs(), Rating.of(req.rating()), now), now);
        reviews.save(new VocabReview(userId, card.getId(), req.rating(), wasNew, card.getIntervalDays(), now));
        cards.flush();
        return study(userId, req.deckId());
    }

    /* ---------- Hỗ trợ ---------- */

    private List<String> intervals(VocabCard c, Instant now) {
        return Arrays.stream(Rating.values()).map(r -> scheduler.preview(c.srs(), r, now)).toList();
    }

    private List<DeckView> deckViews(long userId, Instant now) {
        Map<Long, DeckCounts> counts = stats.counts(userId, now, now.plus(LEARN_AHEAD));
        Instant dayStart = LocalDate.now(BodyService.ZONE).atStartOfDay(BodyService.ZONE).toInstant();
        Map<Long, Integer> introduced = stats.newIntroduced(userId, dayStart);
        return decks.findByUserIdOrderByCreatedAtAscIdAsc(userId).stream()
                .map(d -> deckView(d, counts.getOrDefault(d.getId(), DeckCounts.EMPTY), introduced.getOrDefault(d.getId(), 0)))
                .toList();
    }

    private DeckView deckView(long userId, VocabDeck deck) {
        return deckViews(userId, Instant.now()).stream().filter(d -> d.id() == deck.getId()).findFirst().orElseThrow();
    }

    private static DeckView deckView(VocabDeck d, DeckCounts c, int introducedToday) {
        int newCount = Math.max(0, Math.min(c.unseen(), d.getNewPerDay() - introducedToday));
        return new DeckView(d.getId(), d.getName(), d.getDescription(), d.getLanguage(), d.getNewPerDay(),
                c.total(), c.unseen(), newCount, c.learning(), c.due(), c.mature());
    }

    static CardView view(VocabCard c) {
        return new CardView(c.getId(), c.getDeckId(), c.getTerm(), c.getMeaning(), c.getPronunciation(), c.getExample(),
                c.getState(), c.getIntervalDays(), c.getDueAt(), c.getReps(), c.getLapses(), c.getEase());
    }

    private VocabCard newCard(long userId, long deckId, CardRequest req) {
        VocabCard card = new VocabCard(userId, deckId, req.term().strip(), req.meaning().strip());
        card.setPronunciation(blankToNull(req.pronunciation()));
        card.setExample(blankToNull(req.example()));
        return card;
    }

    private void ensureRoom(long deckId, int adding) {
        if (cards.countByDeckId(deckId) + adding > MAX_CARDS_PER_DECK) {
            throw ApiException.badRequest("Mỗi bộ tối đa " + MAX_CARDS_PER_DECK + " thẻ");
        }
    }

    private VocabDeck findDeck(long userId, long id) {
        return decks.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("bộ thẻ"));
    }

    private VocabCard findCard(long userId, long id) {
        return cards.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("thẻ"));
    }

    private static String requireText(String s, String field) {
        if (s.isBlank()) throw ApiException.badRequest(field + " không được để trống");
        return s.strip();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
