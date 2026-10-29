-- Theo dõi thói quen. Thói quen tự động (EXPENSE, MOMENT, WEIGHT) lấy dữ liệu từ bảng gốc,
-- thói quen tick tay (MEAL, CUSTOM) lưu vào habit_checks.
CREATE TABLE habits (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        VARCHAR(10) NOT NULL,
    name        VARCHAR(60) NOT NULL,
    emoji       VARCHAR(16) NOT NULL,
    frequency   VARCHAR(10) NOT NULL,
    -- Số lần tick cần trong một ngày để tính là xong (MEAL = 3 bữa)
    daily_target SMALLINT   NOT NULL DEFAULT 1,
    position    INT         NOT NULL DEFAULT 0,
    -- Ngày bắt đầu tính tỉ lệ hoàn thành
    start_date  DATE        NOT NULL,
    archived    BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_habits_user ON habits (user_id);
-- Mỗi người chỉ có một thói quen mặc định mỗi loại
CREATE UNIQUE INDEX uq_habits_user_kind ON habits (user_id, kind) WHERE kind <> 'CUSTOM';

CREATE TABLE habit_checks (
    habit_id   BIGINT   NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    check_date DATE     NOT NULL,
    -- 0 cho thói quen thường; 1..3 là bữa sáng/trưa/tối với MEAL
    slot       SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (habit_id, check_date, slot)
);
