# Deploy FinanceHealth lên VPS Việt Nam

Hướng dẫn này đưa toàn bộ app lên **một VPS Ubuntu** của nhà cung cấp trong nước (BizFly Cloud, VNG Cloud, Vietnix, AZDIGI, Tino...), chạy ở `https://ten-mien-cua-ban.com`.
Thay `ten-mien-cua-ban.com` bằng tên miền thật của bạn. Muốn dùng AWS thì xem [DEPLOY.md](DEPLOY.md).

## 0. Mô hình

```
Điện thoại / trình duyệt
   │  https://ten-mien-cua-ban.com
   ▼
VPS Ubuntu (Docker)
   ├─ web  : Caddy, HTTPS tự động + trang React     (cổng 80/443)
   │          ├─ /api/*, /files/*  ──► api
   │          └─ còn lại            ──► web tĩnh
   ├─ api  : Spring Boot
   ├─ db   : PostgreSQL 16
   └─ ổ đĩa: ảnh hóa đơn, ảnh/video khoảnh khắc (hoặc Object Storage chuẩn S3)
```

Web và API chạy chung một tên miền nên không phải cấu hình CORS hay tên miền phụ.

**Cấu hình VPS nên mua:** 2 vCPU, 4 GB RAM, SSD 40–60 GB, **Ubuntu 24.04**, có IP public.
Dùng 2 GB RAM vẫn chạy được nhưng nên bật swap (bước 3).

---

## 1. Tạo VPS

Ở trang quản trị của nhà cung cấp:

1. Tạo Cloud Server / VPS với cấu hình trên, hệ điều hành **Ubuntu 24.04**, vị trí Hà Nội hoặc TP.HCM.
2. Đăng nhập: thêm **SSH key** (khuyên dùng) hoặc đặt mật khẩu root.
   - Chưa có SSH key: trên máy bạn chạy `ssh-keygen -t ed25519`, rồi dán nội dung file `~/.ssh/id_ed25519.pub` vào ô SSH key.
3. Tường lửa / Security group (nếu nhà cung cấp có): mở **22, 80, 443**.
4. Ghi lại **IP public** của VPS.

---

## 2. Trỏ tên miền về VPS

Vào trang quản lý DNS nơi bạn mua tên miền (hoặc Route 53 nếu đã chuyển DNS sang AWS), tạo 2 bản ghi:

| Loại | Tên (Host) | Giá trị | TTL |
|---|---|---|---|
| A | `@` | IP của VPS | 300 |
| A | `www` | IP của VPS | 300 |

Kiểm tra trên máy bạn: `ping ten-mien-cua-ban.com` phải ra đúng IP VPS (có thể mất 5–30 phút).

---

## 3. Cài đặt VPS

```bash
ssh root@<IP_VPS>         # hoặc ssh ubuntu@<IP_VPS>, tùy nhà cung cấp

# Cập nhật hệ thống và bật tường lửa
apt update && apt upgrade -y
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Cài Docker (kèm docker compose) và git
curl -fsSL https://get.docker.com | sh
apt install -y git

# Swap 2 GB, giúp build không bị thiếu RAM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Nếu đăng nhập bằng user thường (không phải root), thêm `sudo` trước các lệnh trên và chạy `sudo usermod -aG docker $USER`, rồi thoát ra SSH lại.

---

## 4. Chạy app

```bash
git clone https://github.com/nguyenxuanthinh281204/financehealth.git
cd financehealth/deploy-vps
cp .env.example .env
nano .env
```

Điền ít nhất:

- `DOMAIN=ten-mien-cua-ban.com`
- `DB_PASSWORD=` một mật khẩu mạnh tự đặt
- `JWT_SECRET=` kết quả của lệnh `openssl rand -base64 48`

Lưu file (Ctrl+O, Enter, Ctrl+X) rồi chạy:

```bash
docker compose up -d --build
docker compose logs -f api        # chờ dòng "Started FinanceHealthApplication", Ctrl+C để thoát
```

Lần đầu build mất 5–10 phút. Database tự tạo bảng và nạp sẵn khoảng 30 món ăn Việt.
Mở `https://ten-mien-cua-ban.com`, đăng ký tài khoản và dùng. Caddy tự xin chứng chỉ HTTPS trong lần truy cập đầu.

Không dùng `www`? Xóa khối `www.{$DOMAIN}` cuối file `deploy-vps/Caddyfile` rồi `docker compose restart web`.

---

## 5. Sao lưu hằng ngày (quan trọng)

Database và ảnh/video đều nằm trên VPS, nên cần sao lưu:

```bash
crontab -e
# thêm dòng sau (sửa đường dẫn cho đúng), sao lưu lúc 3 giờ sáng, giữ 14 ngày:
0 3 * * * /root/financehealth/deploy-vps/backup.sh >> /root/backup.log 2>&1
```

File sao lưu nằm ở `~/backups`. Nên chép ra ngoài VPS định kỳ, ví dụ từ máy bạn:

```bash
scp -r root@<IP_VPS>:~/backups ./financehealth-backups
```

Nhiều nhà cung cấp còn có tính năng **snapshot / backup VPS** tự động, bật thêm để yên tâm.

Khôi phục database từ một bản sao lưu (ghi đè dữ liệu hiện tại):

```bash
cd ~/financehealth/deploy-vps
docker compose stop api
docker compose exec -T db psql -U financehealth -d financehealth -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c ~/backups/db-2026-10-24.sql.gz | docker compose exec -T db psql -U financehealth financehealth
docker compose start api
```

---

## 6. (Tùy chọn) Lưu ảnh/video trên Object Storage chuẩn S3

Mặc định ảnh/video lưu trên ổ VPS. Muốn tách ra (không lo đầy ổ, khỏi phải sao lưu ảnh), dùng dịch vụ lưu trữ chuẩn S3 của nhà cung cấp, ví dụ BizFly **Simple Storage**, VNG Cloud **vStorage**, FPT **Object Storage**:

1. Tạo một **bucket private** (không bật public).
2. Tạo **Access key / Secret key**.
3. Lấy **endpoint S3** trong trang quản trị của họ (dạng `https://...`).
4. Sửa `.env`:
   ```
   STORAGE_TYPE=s3
   S3_ENDPOINT=https://<endpoint-cua-nha-cung-cap>
   S3_BUCKET=<ten-bucket>
   S3_ACCESS_KEY=<access-key>
   S3_SECRET_KEY=<secret-key>
   AWS_REGION=<region họ ghi, không có thì để hn>
   S3_PATH_STYLE=true
   ```
5. `docker compose up -d` để áp dụng.

App tạo link xem file có chữ ký, hết hạn sau 60 phút, nên bucket không cần mở public.
Ảnh/video đã lưu trên ổ VPS trước đó không tự chuyển sang, nên chọn cách lưu ngay từ đầu.

---

## 7. Bật quét hóa đơn bằng AI

1. Tạo API key tại [console.anthropic.com](https://console.anthropic.com/) (cần nạp credit; mỗi lần quét khoảng 1.000đ với model mặc định).
2. Điền `ANTHROPIC_API_KEY=sk-ant-...` vào `.env`.
3. `docker compose up -d`.

Không có key thì nút chụp hóa đơn vẫn lưu ảnh, bạn tự nhập số tiền.

---

## 8. Cài lên điện thoại

- **iPhone (Safari)**: mở trang → **Chia sẻ** → **Thêm vào MH chính**.
- **Android (Chrome)**: menu ⋮ → **Cài đặt ứng dụng**.

Camera (chụp hóa đơn, quay video 5 giây) chỉ chạy qua HTTPS, nên cần hoàn tất bước 2–4.

---

## 9. Cập nhật phiên bản mới

```bash
cd ~/financehealth && git pull
cd deploy-vps && docker compose up -d --build
```

Dữ liệu (database, ảnh/video, chứng chỉ HTTPS) nằm trong Docker volume nên không mất khi cập nhật.
Đừng chạy `docker compose down -v`: cờ `-v` sẽ **xóa toàn bộ dữ liệu**.

---

## 10. Xử lý sự cố

| Hiện tượng | Cách kiểm tra |
|---|---|
| Không vào được trang / lỗi HTTPS | Tên miền chưa trỏ đúng IP, hoặc chưa mở cổng 80/443 (cả `ufw` lẫn tường lửa của nhà cung cấp). Xem `docker compose logs web`. |
| Trang báo lỗi kết nối máy chủ | `docker compose ps` xem `api` có chạy không, rồi `docker compose logs api`. |
| `api` khởi động lỗi database | Đổi `DB_PASSWORD` sau khi đã chạy lần đầu sẽ không có tác dụng với database cũ. Đặt lại mật khẩu cũ, hoặc đổi trong Postgres. |
| Build bị dừng giữa chừng | Thiếu RAM, kiểm tra đã bật swap ở bước 3 chưa (`free -h`). |
| Ảnh không hiện khi dùng S3 | Sai `S3_ENDPOINT`, key hoặc tên bucket. Xem `docker compose logs api`. |
| Ổ đĩa đầy | `df -h`, `docker system prune` để dọn image cũ, xóa bớt file trong `~/backups`. |
| Không thấy bản mới trên điện thoại | Đóng hẳn app rồi mở lại để service worker tải bản mới. |

---

## Chuyển từ AWS sang VPS (nếu đã deploy AWS trước đó)

1. Sao lưu database cũ: `pg_dump -h <rds-endpoint> -U financehealth financehealth | gzip > db.sql.gz`.
2. Làm bước 1–4 ở trên, rồi khôi phục `db.sql.gz` theo lệnh ở cuối bước 5.
3. Ảnh/video: tải bucket S3 về (`aws s3 sync s3://<bucket> ./media`), rồi chép vào volume `uploads` của VPS, hoặc upload lên Object Storage mới (bước 6) giữ nguyên đường dẫn.
4. Đổi bản ghi DNS sang IP VPS, tắt tài nguyên AWS để không bị tính tiền.
