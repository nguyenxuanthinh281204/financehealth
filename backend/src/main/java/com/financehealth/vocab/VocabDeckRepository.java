package com.financehealth.vocab;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VocabDeckRepository extends JpaRepository<VocabDeck, Long> {

    List<VocabDeck> findByUserIdOrderByCreatedAtAscIdAsc(Long userId);

    Optional<VocabDeck> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
