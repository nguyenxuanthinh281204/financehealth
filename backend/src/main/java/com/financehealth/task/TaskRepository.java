package com.financehealth.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByUserIdOrderByPositionAscIdAsc(Long userId);

    Optional<Task> findByIdAndUserId(Long id, Long userId);

    List<Task> findByParentId(Long parentId);

    List<Task> findByUserIdAndIdIn(Long userId, List<Long> ids);

    @Query("select coalesce(min(t.position), 0) from Task t where t.listId = :listId and t.parentId is null")
    int minTopPosition(long listId);

    @Query("select coalesce(max(t.position), 0) from Task t where t.parentId = :parentId")
    int maxChildPosition(long parentId);

    /** Xóa các việc đã xong trong danh sách; việc con đi theo việc cha nhờ ON DELETE CASCADE. */
    @Modifying
    @Query(value = "DELETE FROM tasks WHERE list_id = :listId AND completed_at IS NOT NULL", nativeQuery = true)
    int deleteCompleted(long listId);
}
