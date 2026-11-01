package com.financehealth.vocab;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VocabCardRepository extends JpaRepository<VocabCard, Long> {

    List<VocabCard> findByDeckIdOrderByIdAsc(Long deckId);

    Optional<VocabCard> findByIdAndUserId(Long id, Long userId);

    long countByDeckId(Long deckId);

    /** Thẻ đang học hoặc đến hạn ôn (trước mốc until), sớm nhất trước. */
    @Query("""
            select c from VocabCard c where c.deckId in :deckIds and c.state <> com.financehealth.vocab.Scheduler.State.NEW
            and c.dueAt <= :until order by c.dueAt asc, c.id asc""")
    List<VocabCard> findDue(Collection<Long> deckIds, Instant until);

    /** Thẻ mới của một bộ theo thứ tự thêm vào. */
    List<VocabCard> findByDeckIdAndStateOrderByIdAsc(Long deckId, Scheduler.State state, Limit limit);
}
