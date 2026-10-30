package com.financehealth.note;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface NoteLabelRepository extends JpaRepository<NoteLabel, Long> {

    List<NoteLabel> findByUserIdOrderByNameAsc(Long userId);

    Optional<NoteLabel> findByIdAndUserId(Long id, Long userId);

    List<NoteLabel> findByUserIdAndIdIn(Long userId, Collection<Long> ids);

    boolean existsByUserIdAndNameIgnoreCase(Long userId, String name);

    long countByUserId(Long userId);
}
