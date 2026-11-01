package com.financehealth.vocab;

import com.financehealth.common.CurrentUser;
import com.financehealth.vocab.VocabDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/vocab")
public class VocabController {

    private final VocabService service;

    public VocabController(VocabService service) {
        this.service = service;
    }

    /** Các bộ thẻ kèm số thẻ mới/đang học/đến hạn, số thẻ đã ôn hôm nay và chuỗi ngày học. */
    @GetMapping
    public Overview overview() {
        return service.overview(CurrentUser.id());
    }

    @PostMapping("/decks")
    public Overview createDeck(@Valid @RequestBody DeckRequest req) {
        return service.createDeck(CurrentUser.id(), req);
    }

    @PatchMapping("/decks/{id}")
    public Overview updateDeck(@PathVariable long id, @Valid @RequestBody DeckRequest req) {
        return service.updateDeck(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/decks/{id}")
    public Overview deleteDeck(@PathVariable long id) {
        return service.deleteDeck(CurrentUser.id(), id);
    }

    @GetMapping("/decks/{id}/cards")
    public DeckCards cards(@PathVariable long id) {
        return service.deckCards(CurrentUser.id(), id);
    }

    @PostMapping("/decks/{id}/cards")
    public CardView createCard(@PathVariable long id, @Valid @RequestBody CardRequest req) {
        return service.createCard(CurrentUser.id(), id, req);
    }

    @PostMapping("/decks/{id}/cards/bulk")
    public BulkResult bulk(@PathVariable long id, @Valid @RequestBody BulkRequest req) {
        return service.bulkCreate(CurrentUser.id(), id, req);
    }

    @PatchMapping("/cards/{id}")
    public CardView updateCard(@PathVariable long id, @Valid @RequestBody UpdateCardRequest req) {
        return service.updateCard(CurrentUser.id(), id, req);
    }

    @DeleteMapping("/cards/{id}")
    public ResponseEntity<Void> deleteCard(@PathVariable long id) {
        service.deleteCard(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/cards/{id}/reset")
    public CardView resetCard(@PathVariable long id) {
        return service.resetCard(CurrentUser.id(), id);
    }

    /** Hàng đợi ôn tập; không truyền deckId là học tất cả các bộ. */
    @GetMapping("/study")
    public Study study(@RequestParam(required = false) Long deckId) {
        return service.study(CurrentUser.id(), deckId);
    }

    /** Chấm một thẻ (1 Quên, 2 Khó, 3 Được, 4 Dễ) rồi trả về hàng đợi mới. */
    @PostMapping("/cards/{id}/review")
    public Study review(@PathVariable long id, @Valid @RequestBody ReviewRequest req) {
        return service.review(CurrentUser.id(), id, req);
    }
}
