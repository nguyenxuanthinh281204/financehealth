-- Cài đặt giao diện theo tài khoản + phiên bản token để đổi mật khẩu thì đăng xuất các thiết bị khác
ALTER TABLE users
    ADD COLUMN theme_mode    VARCHAR(10) NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN accent_color  VARCHAR(20) NOT NULL DEFAULT 'green',
    ADD COLUMN token_version INT         NOT NULL DEFAULT 0;
