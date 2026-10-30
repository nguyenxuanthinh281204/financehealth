package com.financehealth.note;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface NoteRepository extends JpaRepository<Note, Long> {

    List<Note> findByUserIdOrderByPositionAscIdDesc(Long userId);

    Optional<Note> findByIdAndUserId(Long id, Long userId);

    @Query("select coalesce(min(n.position), 0) from Note n where n.userId = :userId")
    long minPosition(long userId);

    @Modifying
    @Query(value = "DELETE FROM notes WHERE user_id = :userId AND trashed_at IS NOT NULL AND trashed_at < :before",
            nativeQuery = true)
    int purgeTrashed(long userId, Instant before);

    @Modifying
    @Query(value = "DELETE FROM notes WHERE user_id = :userId AND trashed_at IS NOT NULL", nativeQuery = true)
    int emptyTrash(long userId);

    /** Cặp (note_id, label_id) của mọi ghi chú của người dùng, lấy một lần thay vì từng ghi chú. */
    @Query(value = """
            SELECT l.note_id, l.label_id FROM note_label_links l
            JOIN notes n ON n.id = l.note_id
            WHERE n.user_id = :userId""", nativeQuery = true)
    List<Object[]> labelLinks(long userId);

    @Query(value = "SELECT label_id FROM note_label_links WHERE note_id = :noteId ORDER BY label_id", nativeQuery = true)
    List<Long> labelIdsOf(long noteId);

    @Modifying
    @Query(value = "DELETE FROM note_label_links WHERE note_id = :noteId", nativeQuery = true)
    void clearLabels(long noteId);

    @Modifying
    @Query(value = "INSERT INTO note_label_links (note_id, label_id) VALUES (:noteId, :labelId) ON CONFLICT DO NOTHING",
            nativeQuery = true)
    void addLabel(long noteId, long labelId);
}
