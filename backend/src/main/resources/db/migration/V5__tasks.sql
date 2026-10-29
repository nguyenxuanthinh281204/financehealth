-- Việc cần làm kiểu Google Tasks: nhiều danh sách, mỗi việc có thể có việc con (một cấp).
CREATE TABLE task_lists (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       VARCHAR(60) NOT NULL,
    position   INT         NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_lists_user ON task_lists (user_id);

CREATE TABLE tasks (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    list_id      BIGINT       NOT NULL REFERENCES task_lists (id) ON DELETE CASCADE,
    -- NULL là việc chính; khác NULL là việc con của một việc chính cùng danh sách
    parent_id    BIGINT REFERENCES tasks (id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    notes        VARCHAR(2000),
    due_date     DATE,
    starred      BOOLEAN      NOT NULL DEFAULT false,
    -- Thứ tự trong cùng cấp (cùng danh sách và cùng việc cha), nhỏ đứng trước
    position     INT          NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_user ON tasks (user_id);
CREATE INDEX idx_tasks_list ON tasks (list_id);
CREATE INDEX idx_tasks_parent ON tasks (parent_id);
