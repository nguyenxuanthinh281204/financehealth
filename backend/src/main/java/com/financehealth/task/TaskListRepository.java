package com.financehealth.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

    List<TaskList> findByUserIdOrderByPositionAscIdAsc(Long userId);

    Optional<TaskList> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
