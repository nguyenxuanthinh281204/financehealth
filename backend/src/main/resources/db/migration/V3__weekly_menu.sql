-- Thực đơn tuần: 8 nguyên liệu luộc cố định, mỗi tuần tạo 1 lần.
ALTER TABLE foods ADD COLUMN staple_key VARCHAR(20) UNIQUE;
-- Bước làm tròn khối lượng (ví dụ 1 quả trứng ~ 50g); NULL = làm tròn 5g
ALTER TABLE foods ADD COLUMN unit_g    INT;
ALTER TABLE foods ADD COLUMN unit_name VARCHAR(20);

UPDATE foods SET staple_key = 'EGG', name = 'Trứng gà luộc', unit_g = 50, unit_name = 'quả', min_g = 50, max_g = 200
 WHERE owner_id IS NULL AND name = 'Trứng gà';
UPDATE foods SET staple_key = 'CHICKEN', name = 'Ức gà luộc'
 WHERE owner_id IS NULL AND name = 'Ức gà (chín)';
UPDATE foods SET staple_key = 'RICE', max_g = 600 WHERE owner_id IS NULL AND name = 'Cơm trắng';
UPDATE foods SET staple_key = 'BREAD', max_g = 250 WHERE owner_id IS NULL AND name = 'Bánh mì';
UPDATE foods SET staple_key = 'APPLE' WHERE owner_id IS NULL AND name = 'Táo';

INSERT INTO foods (name, category, kcal, protein, carbs, fat, default_serving_g, min_g, max_g, meal_tags, staple_key) VALUES
('Xúc xích luộc', 'PROTEIN', 250, 12.0, 6.0, 20.0, 50, 25, 100, 'BREAKFAST,LUNCH,DINNER', 'SAUSAGE'),
('Cà rốt luộc',   'VEGGIE',   35,  0.8, 8.2,  0.2, 100, 50, 250, 'LUNCH,DINNER', 'CARROT'),
('Bí đỏ luộc',    'VEGGIE',   20,  0.7, 4.9,  0.1, 150, 50, 300, 'LUNCH,DINNER', 'PUMPKIN');

CREATE TABLE weekly_menus (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    week_start DATE        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
);
