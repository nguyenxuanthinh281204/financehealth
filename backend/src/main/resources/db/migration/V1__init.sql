CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE body_profiles (
    user_id          BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    sex              VARCHAR(10)  NOT NULL,
    birth_date       DATE         NOT NULL,
    height_cm        NUMERIC(5,1) NOT NULL,
    weight_kg        NUMERIC(5,1) NOT NULL,
    activity_level   VARCHAR(20)  NOT NULL,
    goal             VARCHAR(20)  NOT NULL,
    target_weight_kg NUMERIC(5,1),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE weight_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    log_date     DATE         NOT NULL,
    weight_kg    NUMERIC(5,1) NOT NULL,
    body_fat_pct NUMERIC(4,1),
    note         VARCHAR(255),
    UNIQUE (user_id, log_date)
);

CREATE TABLE foods (
    id                BIGSERIAL PRIMARY KEY,
    owner_id          BIGINT REFERENCES users (id) ON DELETE CASCADE,
    name              VARCHAR(120) NOT NULL,
    category          VARCHAR(20)  NOT NULL,
    kcal              NUMERIC(6,1) NOT NULL,
    protein           NUMERIC(5,1) NOT NULL,
    carbs             NUMERIC(5,1) NOT NULL,
    fat               NUMERIC(5,1) NOT NULL,
    default_serving_g INT          NOT NULL DEFAULT 100,
    min_g             INT          NOT NULL DEFAULT 0,
    max_g             INT          NOT NULL DEFAULT 400,
    meal_tags         VARCHAR(40)  NOT NULL DEFAULT 'BREAKFAST,LUNCH,DINNER'
);
CREATE INDEX idx_foods_owner ON foods (owner_id);

CREATE TABLE meal_plans (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan_date      DATE         NOT NULL,
    target_kcal    NUMERIC(6,1) NOT NULL,
    target_protein NUMERIC(5,1) NOT NULL,
    target_carbs   NUMERIC(5,1) NOT NULL,
    target_fat     NUMERIC(5,1) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (user_id, plan_date)
);

CREATE TABLE meal_plan_items (
    id       BIGSERIAL PRIMARY KEY,
    plan_id  BIGINT       NOT NULL REFERENCES meal_plans (id) ON DELETE CASCADE,
    meal     VARCHAR(10)  NOT NULL,
    food_id  BIGINT       NOT NULL REFERENCES foods (id),
    grams    INT          NOT NULL,
    kcal     NUMERIC(6,1) NOT NULL,
    protein  NUMERIC(5,1) NOT NULL,
    carbs    NUMERIC(5,1) NOT NULL,
    fat      NUMERIC(5,1) NOT NULL,
    position INT          NOT NULL DEFAULT 0
);
CREATE INDEX idx_meal_items_plan ON meal_plan_items (plan_id);

CREATE TABLE expenses (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    spent_on    DATE          NOT NULL,
    amount      NUMERIC(15,2) NOT NULL,
    category    VARCHAR(20)   NOT NULL,
    merchant    VARCHAR(150),
    note        VARCHAR(500),
    items_json  TEXT,
    receipt_key VARCHAR(255),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_user_date ON expenses (user_id, spent_on);

CREATE TABLE moments (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    taken_on     DATE         NOT NULL,
    media_type   VARCHAR(10)  NOT NULL,
    storage_key  VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    duration_sec NUMERIC(4,2),
    caption      VARCHAR(200),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_moments_user_date ON moments (user_id, taken_on);
