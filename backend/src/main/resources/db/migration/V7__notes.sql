-- Ghi chú kiểu Google Keep: ghi chú chữ hoặc danh sách đánh dấu, màu, ghim, lưu trữ, thùng rác, nhãn.
CREATE TABLE notes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL DEFAULT '',
    body       TEXT         NOT NULL DEFAULT '',
    -- true: ghi chú dạng danh sách, nội dung nằm ở items [{id, text, checked}]
    checklist  BOOLEAN      NOT NULL DEFAULT false,
    items      JSONB        NOT NULL DEFAULT '[]',
    color      VARCHAR(20)  NOT NULL DEFAULT 'default',
    pinned     BOOLEAN      NOT NULL DEFAULT false,
    archived   BOOLEAN      NOT NULL DEFAULT false,
    -- Khác NULL là đang ở thùng rác, tự xóa hẳn sau 7 ngày
    trashed_at TIMESTAMPTZ,
    -- Thứ tự hiển thị, nhỏ đứng trước (ghi chú mới lên đầu)
    position   BIGINT       NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_user ON notes (user_id);

CREATE TABLE note_labels (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_note_labels_user_name ON note_labels (user_id, lower(name));

CREATE TABLE note_label_links (
    note_id  BIGINT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    label_id BIGINT NOT NULL REFERENCES note_labels (id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, label_id)
);
CREATE INDEX idx_note_label_links_label ON note_label_links (label_id);
