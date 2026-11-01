-- Học từ vựng kiểu Anki/Quizlet: bộ thẻ, thẻ (từ/nghĩa/ví dụ) và lịch ôn lặp lại ngắt quãng (SM-2 như Anki).
CREATE TABLE vocab_decks (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(300),
    -- Mã ngôn ngữ của mặt "từ", dùng để đọc phát âm trên trình duyệt (en-US, ja-JP, ...)
    language    VARCHAR(10)  NOT NULL DEFAULT 'en-US',
    -- Số thẻ mới tối đa được đưa vào học mỗi ngày
    new_per_day INT          NOT NULL DEFAULT 20,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_vocab_decks_user ON vocab_decks (user_id);

CREATE TABLE vocab_cards (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    deck_id          BIGINT        NOT NULL REFERENCES vocab_decks (id) ON DELETE CASCADE,
    term             VARCHAR(200)  NOT NULL,
    meaning          VARCHAR(500)  NOT NULL,
    pronunciation    VARCHAR(100),
    example          VARCHAR(1000),
    -- NEW: chưa học; LEARNING: đang học lần đầu; REVIEW: đã thuộc, ôn theo ngày; RELEARNING: quên, học lại
    state            VARCHAR(10)   NOT NULL DEFAULT 'NEW',
    -- Bước học hiện tại khi LEARNING/RELEARNING
    step             INT           NOT NULL DEFAULT 0,
    interval_days    INT           NOT NULL DEFAULT 0,
    -- Hệ số dễ x1000 như Anki (2500 = 2.5)
    ease_factor      INT           NOT NULL DEFAULT 2500,
    reps             INT           NOT NULL DEFAULT 0,
    lapses           INT           NOT NULL DEFAULT 0,
    -- NULL với thẻ mới
    due_at           TIMESTAMPTZ,
    last_reviewed_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_vocab_cards_deck ON vocab_cards (deck_id);
CREATE INDEX idx_vocab_cards_user_due ON vocab_cards (user_id, due_at);

-- Lịch sử mỗi lần bấm Quên/Khó/Được/Dễ: đếm thẻ mới mỗi ngày, số thẻ đã ôn, chuỗi ngày học
CREATE TABLE vocab_reviews (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    card_id       BIGINT      NOT NULL REFERENCES vocab_cards (id) ON DELETE CASCADE,
    rating        SMALLINT    NOT NULL,
    -- true khi đây là lần đầu thẻ được học (tính vào giới hạn thẻ mới/ngày)
    was_new       BOOLEAN     NOT NULL DEFAULT false,
    interval_days INT         NOT NULL,
    reviewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vocab_reviews_user_time ON vocab_reviews (user_id, reviewed_at);
CREATE INDEX idx_vocab_reviews_card ON vocab_reviews (card_id);
