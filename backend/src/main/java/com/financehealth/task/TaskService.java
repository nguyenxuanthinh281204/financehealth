package com.financehealth.task;

import com.financehealth.body.BodyService;
import com.financehealth.common.ApiException;
import com.financehealth.task.TaskDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class TaskService {

    static final String DEFAULT_LIST = "Việc của tôi";
    static final int MAX_LISTS = 30;

    private final TaskListRepository lists;
    private final TaskRepository tasks;

    public TaskService(TaskListRepository lists, TaskRepository tasks) {
        this.lists = lists;
        this.tasks = tasks;
    }

    @Transactional
    public Board board(long userId) {
        if (lists.countByUserId(userId) == 0) lists.save(new TaskList(userId, DEFAULT_LIST, 0));
        return snapshot(userId);
    }

    @Transactional
    public Board createList(long userId, ListRequest req) {
        List<TaskList> mine = lists.findByUserIdOrderByPositionAscIdAsc(userId);
        if (mine.size() >= MAX_LISTS) throw ApiException.badRequest("Tối đa " + MAX_LISTS + " danh sách");
        int position = mine.stream().mapToInt(TaskList::getPosition).max().orElse(0) + 1;
        lists.save(new TaskList(userId, req.name().trim(), position));
        return snapshot(userId);
    }

    @Transactional
    public Board renameList(long userId, long id, ListRequest req) {
        findList(userId, id).setName(req.name().trim());
        return snapshot(userId);
    }

    @Transactional
    public Board deleteList(long userId, long id) {
        TaskList list = findList(userId, id);
        if (lists.countByUserId(userId) <= 1) throw ApiException.badRequest("Cần giữ lại ít nhất một danh sách");
        lists.delete(list);
        return snapshot(userId);
    }

    @Transactional
    public Board clearCompleted(long userId, long listId) {
        tasks.deleteCompleted(findList(userId, listId).getId());
        return snapshot(userId);
    }

    @Transactional
    public Board createTask(long userId, CreateTaskRequest req) {
        Task task;
        if (req.parentId() != null) {
            Task parent = findTask(userId, req.parentId());
            if (parent.getParentId() != null) throw ApiException.badRequest("Việc con không có việc con được");
            // Thêm việc con chưa xong thì việc cha cũng chưa xong
            parent.setCompleted(false);
            task = new Task(userId, parent.getListId(), parent.getId(), req.title().trim(),
                    tasks.maxChildPosition(parent.getId()) + 1);
        } else {
            if (req.listId() == null) throw ApiException.badRequest("Chọn danh sách");
            long listId = findList(userId, req.listId()).getId();
            // Giống Google Tasks: việc mới nằm trên cùng
            task = new Task(userId, listId, null, req.title().trim(), tasks.minTopPosition(listId) - 1);
        }
        task.setNotes(blankToNull(req.notes()));
        task.setDueDate(req.dueDate());
        task.setStarred(Boolean.TRUE.equals(req.starred()));
        tasks.save(task);
        return snapshot(userId);
    }

    @Transactional
    public Board updateTask(long userId, long id, UpdateTaskRequest req) {
        Task task = findTask(userId, id);
        if (req.title() != null) {
            if (req.title().isBlank()) throw ApiException.badRequest("Tên việc không được để trống");
            task.setTitle(req.title().trim());
        }
        if (req.notes() != null) task.setNotes(blankToNull(req.notes()));
        if (Boolean.TRUE.equals(req.clearDue())) task.setDueDate(null);
        else if (req.dueDate() != null) task.setDueDate(req.dueDate());
        if (req.starred() != null) task.setStarred(req.starred());
        if (req.listId() != null && !req.listId().equals(task.getListId())) move(userId, task, req.listId());
        if (req.completed() != null) complete(userId, task, req.completed());
        return snapshot(userId);
    }

    @Transactional
    public Board deleteTask(long userId, long id) {
        tasks.delete(findTask(userId, id));
        return snapshot(userId);
    }

    @Transactional
    public Board reorder(long userId, ReorderRequest req) {
        List<Long> ids = req.ids();
        if (new HashSet<>(ids).size() != ids.size()) throw ApiException.badRequest("Danh sách bị trùng");
        Map<Long, Task> byId = new HashMap<>();
        for (Task t : tasks.findByUserIdAndIdIn(userId, ids)) byId.put(t.getId(), t);
        for (Long taskId : ids) {
            Task t = byId.get(taskId);
            if (t == null) throw ApiException.notFound("việc");
            if (!t.getListId().equals(req.listId()) || !Objects.equals(t.getParentId(), req.parentId())) {
                throw ApiException.badRequest("Chỉ sắp xếp được các việc cùng cấp");
            }
        }
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).setPosition(i);
        return snapshot(userId);
    }

    /** Hoàn thành việc cha thì xong luôn việc con; mở lại việc con thì việc cha cũng mở lại. */
    private void complete(long userId, Task task, boolean completed) {
        task.setCompleted(completed);
        if (task.getParentId() == null) {
            if (completed) tasks.findByParentId(task.getId()).forEach(c -> c.setCompleted(true));
        } else if (!completed) {
            findTask(userId, task.getParentId()).setCompleted(false);
        }
    }

    /** Chuyển việc chính (kèm việc con) sang danh sách khác, đặt lên đầu. */
    private void move(long userId, Task task, long listId) {
        if (task.getParentId() != null) throw ApiException.badRequest("Chỉ chuyển được việc chính sang danh sách khác");
        long target = findList(userId, listId).getId();
        task.setPosition(tasks.minTopPosition(target) - 1);
        task.setListId(target);
        tasks.findByParentId(task.getId()).forEach(c -> c.setListId(target));
    }

    private Board snapshot(long userId) {
        tasks.flush();
        List<ListView> listViews = lists.findByUserIdOrderByPositionAscIdAsc(userId).stream()
                .map(l -> new ListView(l.getId(), l.getName())).toList();
        List<TaskView> taskViews = tasks.findByUserIdOrderByPositionAscIdAsc(userId).stream()
                .map(t -> new TaskView(t.getId(), t.getListId(), t.getParentId(), t.getTitle(), t.getNotes(),
                        t.getDueDate(), t.isStarred(), t.isCompleted(), t.getCompletedAt(), t.getPosition()))
                .toList();
        return new Board(LocalDate.now(BodyService.ZONE), listViews, taskViews);
    }

    private TaskList findList(long userId, long id) {
        return lists.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("danh sách"));
    }

    private Task findTask(long userId, long id) {
        return tasks.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("việc"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
