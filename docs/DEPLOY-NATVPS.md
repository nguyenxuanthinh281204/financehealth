# Deploy Hatchi lên NAT VPS (qua Cloudflare Tunnel)

NAT VPS rẻ nhưng **không có IP riêng** và **không mở được cổng 80/443**: nhiều máy dùng chung một IP, mỗi máy chỉ được chuyển tiếp vài cổng (ví dụ 20 cổng để SSH). Vì vậy không tự cấp HTTPS được như VPS thường.

Cách giải: **Cloudflare Tunnel** (miễn phí). Trên VPS chạy thêm một container `cloudflared`, container này chủ động kết nối ra Cloudflare. Người dùng vào `https://ten-mien-cua-ban.com`, Cloudflare lo HTTPS rồi chuyển yêu cầu vào VPS qua kết nối đó. **Không cần mở cổng nào.**

Thay `ten-mien-cua-ban.com` bằng tên miền thật của bạn.

## 0. Mô hình và yêu cầu

```
Điện thoại ──HTTPS──► Cloudflare ◄──── tunnel (VPS tự kết nối ra) ────┐
                                                                      │
NAT VPS (Docker) ─────────────────────────────────────────────────────┤
   ├─ tunnel : cloudflared ───────────────────────────────────────────┘
   ├─ web    : Caddy + trang React (HTTP nội bộ)  ── /api, /files ──► api
   ├─ api    : Spring Boot (image build sẵn trên GitHub)
   └─ db     : PostgreSQL 16
```

**Yêu cầu NAT VPS:**

| | Tối thiểu | Khuyên dùng |
|---|---|---|
| RAM | 1 GB | 2 GB |
| Ổ đĩa | 10 GB | 20 GB (hoặc lưu ảnh/video trên Object Storage, mục 6) |
| CPU | 1 vCPU, amd64 hoặc arm64 | |
| Ảo hóa | **KVM** | |
| Hệ điều hành | Ubuntu 22.04/24.04 hoặc Debian 12 | |

> **Quan trọng:** NAT VPS loại **OpenVZ/LXC** thường **không chạy được Docker**. Hỏi nhà cung cấp hoặc xem mô tả gói, phải là **KVM**.
> Với 512 MB RAM thì không đủ cho Java + PostgreSQL.

Image Docker được **GitHub tự build sẵn** (workflow `Docker images`), nên VPS không phải build Java/Node nặng, chỉ tải về chạy.

---

## 1. Chuyển DNS tên miền sang Cloudflare

1. Đăng ký tài khoản tại [dash.cloudflare.com](https://dash.cloudflare.com/) → **Add a domain** → nhập `ten-mien-cua-ban.com` → chọn gói **Free**.
2. Cloudflare cho 2 nameserver (dạng `xxx.ns.cloudflare.com`). Vào trang quản lý tên miền nơi bạn mua → đổi **Nameserver** sang 2 địa chỉ này.
3. Chờ Cloudflare báo tên miền **Active** (vài phút tới vài giờ).
4. Nếu trước đó có bản ghi A/CNAME cho `@` hoặc `www` trỏ chỗ khác, xóa đi để bước 2 tạo lại.

---

## 2. Tạo Cloudflare Tunnel

1. Cloudflare Dashboard → **Zero Trust** (lần đầu chọn gói Free, có thể phải nhập thẻ nhưng không bị trừ tiền) → **Networks → Tunnels → Create a tunnel**.
2. Chọn **Cloudflared**, đặt tên `financehealth` → Save.
3. Màn hình cài đặt: chọn **Docker**, sẽ thấy lệnh dạng `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJh...`.
   Copy **phần sau `--token`** (chuỗi dài `eyJh...`). Không cần chạy lệnh đó. Bấm Next.
4. **Public Hostname**:
   - Subdomain: để trống · Domain: `ten-mien-cua-ban.com`
   - Service Type: **HTTP** · URL: **`web:80`**
   - Save tunnel.
5. (Tùy chọn) Thêm một public hostname nữa với subdomain `www`, cũng trỏ `web:80`.

Cloudflare tự tạo bản ghi DNS cho tên miền. Trạng thái tunnel sẽ chuyển **Healthy** sau khi VPS chạy ở bước 5.

---

## 3. Cho phép VPS tải image từ GitHub

Mỗi lần code trên `main` thay đổi và CI chạy xanh, workflow **Docker images** build 2 image:

- `ghcr.io/nguyenxuanthinh281204/financehealth-api`
- `ghcr.io/nguyenxuanthinh281204/financehealth-web`

Lần đầu:

1. Vào tab **Actions** của repo, kiểm tra workflow **Docker images** chạy xanh (chưa chạy thì bấm **Run workflow**).
2. Vào `https://github.com/nguyenxuanthinh281204?tab=packages` → mở từng package → **Package settings** → **Change visibility → Public**.
   Như vậy VPS tải được mà không cần đăng nhập. Image chỉ chứa code (vốn đã public trên repo), không chứa mật khẩu hay dữ liệu nào.

Muốn để private: trên VPS chạy `docker login ghcr.io -u nguyenxuanthinh281204` với mật khẩu là một [Personal access token](https://github.com/settings/tokens) có quyền `read:packages`.

---

## 4. Cài đặt NAT VPS

Nhà cung cấp sẽ cho IP chung và **một cổng SSH riêng**:

```bash
ssh -p <CONG_SSH> root@<IP_NAT>

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y git

# Swap 1–2 GB giúp máy ít RAM không bị tắt app khi thiếu bộ nhớ
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Nếu lệnh tạo swap báo lỗi, gói VPS không cho phép swap, bỏ qua bước đó.

---

## 5. Chạy app

```bash
git clone --depth 1 https://github.com/nguyenxuanthinh281204/financehealth.git
cd financehealth/deploy-natvps
cp .env.example .env
nano .env
```

Điền:

- `DOMAIN=ten-mien-cua-ban.com`
- `CLOUDFLARE_TUNNEL_TOKEN=` chuỗi `eyJh...` ở bước 2
- `DB_PASSWORD=` mật khẩu mạnh tự đặt
- `JWT_SECRET=` kết quả `openssl rand -base64 48`
- Máy 2 GB RAM: sửa `JAVA_OPTS` theo ghi chú trong file.

```bash
docker compose pull
docker compose up -d
docker compose ps                 # 4 dịch vụ: db, api, web, tunnel đều "running"
docker compose logs -f api        # chờ "Started FinanceHealthApplication", Ctrl+C để thoát
```

Mở `https://ten-mien-cua-ban.com`, đăng ký tài khoản và dùng. Trong Cloudflare Zero Trust, tunnel hiện **Healthy**.

Với `JAVA_OPTS` mặc định, API dùng khoảng 375 MB RAM (đã đo khi chạy thử), PostgreSQL được giới hạn 192 MB, nên vừa với máy 1 GB.

---

## 6. Lưu ảnh/video trên Object Storage (khuyên dùng cho NAT VPS)

Ổ NAT VPS thường nhỏ, video sẽ làm đầy ổ nhanh. Có thể dùng một trong hai:

**Cloudflare R2** (đã có tài khoản Cloudflare, miễn phí 10 GB, không tính phí băng thông):

1. Dashboard → **R2 Object Storage** → **Create bucket** `financehealth-media` (để private).
2. **Manage R2 API Tokens → Create API token**, quyền **Object Read & Write**, giới hạn vào bucket trên. Lưu **Access Key ID**, **Secret Access Key** và **endpoint** (dạng `https://<account-id>.r2.cloudflarestorage.com`).
3. Sửa `.env`:
   ```
   STORAGE_TYPE=s3
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_BUCKET=financehealth-media
   S3_ACCESS_KEY=<access-key-id>
   S3_SECRET_KEY=<secret-access-key>
   AWS_REGION=auto
   S3_PATH_STYLE=true
   ```

**Hoặc Object Storage của nhà cung cấp Việt Nam** (BizFly, VNG, FPT): tạo bucket private và Access key/Secret key trong trang quản trị của họ, điền như trên nhưng `S3_ENDPOINT` là endpoint S3 họ cung cấp, `AWS_REGION` là region họ ghi (không có thì để `hn`).

Rồi `docker compose up -d` để áp dụng. Chọn cách lưu ngay từ đầu, vì file đã lưu trên ổ VPS không tự chuyển sang.

---

## 7. Sao lưu hằng ngày

```bash
crontab -e
0 3 * * * /root/financehealth/deploy-natvps/backup.sh >> /root/backup.log 2>&1
```

Script sao lưu database (và ảnh/video nếu đang lưu trên ổ VPS) vào `~/backups`, giữ 14 ngày. Nên định kỳ chép về máy bạn:

```bash
scp -P <CONG_SSH> -r root@<IP_NAT>:~/backups ./financehealth-backups
```

Khôi phục database từ một bản sao lưu (ghi đè dữ liệu hiện tại):

```bash
cd ~/financehealth/deploy-natvps
docker compose stop api
docker compose exec -T db psql -U financehealth -d financehealth -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c ~/backups/db-2026-10-24.sql.gz | docker compose exec -T db psql -U financehealth financehealth
docker compose start api
```

---

## 8. Cập nhật phiên bản mới (tự động)

Quy trình CI/CD:

```
push lên main ─► CI (test backend + build frontend)
                   │ xanh
                   ▼
                 Docker images (build image :latest lên GHCR, ~5 phút)
                   │
                   ▼
NAT VPS: cron chạy auto-update.sh mỗi 5 phút ─► thấy image mới thì kéo về, khởi động lại container
```

GitHub không SSH vào được NAT VPS (không có IP riêng), nên VPS **tự hỏi** GitHub có bản mới không. CI đỏ thì không có image mới, VPS giữ nguyên bản đang chạy.

Bật một lần trên VPS:

```bash
chmod +x /root/financehealth/deploy-natvps/auto-update.sh
crontab -e
*/5 * * * * /root/financehealth/deploy-natvps/auto-update.sh >> /root/auto-update.log 2>&1
```

Kiểm tra: push một thay đổi lên `main`, khoảng 10 phút sau xem `tail /root/auto-update.log`, sẽ có dòng `Đã cập nhật: ...`. Lần nào không có gì mới thì script không ghi gì và không khởi động lại app.

Script cũng `git pull` để lấy thay đổi của `docker-compose.yml`/`Caddyfile`. Đừng sửa tay các file có trong repo trên VPS (chỉ sửa `.env`), nếu không `git pull` sẽ báo lỗi.

Cập nhật thủ công (khi cần ngay):

```bash
/root/financehealth/deploy-natvps/auto-update.sh
```

Quay về bản cũ: mỗi image còn có tag là mã commit. Thêm `IMAGE_TAG=<mã commit đầy đủ>` vào `.env` rồi `docker compose up -d` (lúc này auto-update giữ nguyên bản đó). Xóa dòng `IMAGE_TAG` để quay lại tự cập nhật.

Đừng chạy `docker compose down -v`: cờ `-v` **xóa toàn bộ dữ liệu**.

---

## 9. Quét hóa đơn bằng AI, cài lên điện thoại

Chọn một trong hai bằng biến `RECEIPT_PROVIDER` trong `.env`. Không cấu hình thì nút chụp hóa đơn vẫn lưu ảnh, bạn tự nhập số tiền.

| `RECEIPT_PROVIDER` | Dịch vụ | Chi phí |
|---|---|---|
| `anthropic` (mặc định) | Claude, cần `ANTHROPIC_API_KEY` (tạo tại [console.anthropic.com](https://console.anthropic.com/)) | Nạp credit trước, khoảng 1.000đ/lần quét |
| `gemini` | Gemini trên **Vertex AI** (Google Cloud) | Trừ vào credit dùng thử 300 USD (90 ngày), sau đó ước tính dưới 100đ/lần quét |

> Chỉ **Vertex AI** mới trừ vào credit dùng thử. Key tạo ở Google AI Studio (Gemini API) **không** dùng credit này, nên app chỉ hỗ trợ Vertex AI.

### 9.1. Bật quét bằng Gemini (Vertex AI)

**Bước 1: Tạo project và nhận credit**

1. Vào [console.cloud.google.com](https://console.cloud.google.com/), đăng nhập Gmail, bấm **Start free** / **Dùng thử miễn phí**, nhập thẻ để xác minh. Google cộng 300 USD dùng trong 90 ngày.
2. Ô chọn project trên cùng → **New project** → đặt tên `financehealth` → **Create**.
3. Ghi lại **Project ID** (dạng `financehealth-123456`, xem ở trang **Dashboard** của project). Đây là giá trị cho `GCP_PROJECT_ID`, không phải tên project.

**Bước 2: Bật Vertex AI API**

Menu ☰ → **APIs & Services** → **Library** → tìm **Vertex AI API** → **Enable**. (Hoặc mở thẳng [link này](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com), nhớ chọn đúng project.)

**Bước 3: Tạo service account và file khóa**

1. Menu ☰ → **IAM & Admin** → **Service Accounts** → **Create service account**.
2. Tên: `financehealth-receipt` → **Create and continue**.
3. Role: chọn **Vertex AI User** → **Continue** → **Done**. Chỉ cấp role này, không cấp Owner/Editor.
4. Bấm vào service account vừa tạo → tab **Keys** → **Add key** → **Create new key** → **JSON** → **Create**. Trình duyệt tải về một file `.json`. Giữ kín file này như mật khẩu.

Nếu báo *Service account key creation is disabled*: tài khoản thuộc một tổ chức đang chặn tạo key. Dùng Gmail cá nhân (không thuộc tổ chức) thì không gặp.

**Bước 4: Đưa file khóa lên VPS**

Trên VPS:

```bash
mkdir -p /root/financehealth/deploy-natvps/secrets
```

Trên máy tính (thay cổng SSH, IP và tên file tải về):

```bash
scp -P <cổng-ssh> ~/Downloads/financehealth-xxxx.json root@<ip-nat-vps>:/root/financehealth/deploy-natvps/secrets/gcp-key.json
```

Hoặc trên VPS chạy `nano /root/financehealth/deploy-natvps/secrets/gcp-key.json` rồi dán nội dung file vào.

Cho container đọc được file (app chạy bằng user thường, không phải root):

```bash
chmod 644 /root/financehealth/deploy-natvps/secrets/gcp-key.json
```

Thư mục `secrets/` đã nằm trong `.gitignore`, không bị đẩy lên GitHub và không ảnh hưởng `git pull` của auto-update.

**Bước 5: Sửa `.env` và khởi động lại**

```bash
cd /root/financehealth/deploy-natvps
nano .env
```

```
RECEIPT_PROVIDER=gemini
GCP_PROJECT_ID=financehealth-123456
GCP_LOCATION=global
GEMINI_MODEL=gemini-3.6-flash
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcp-key.json
```

```bash
docker compose up -d
docker compose logs api | grep -i gemini
```

Không có dòng `Cannot create Gemini client` là được. Chụp thử một hóa đơn trong app để kiểm tra.

**Bước 6: Đặt cảnh báo ngân sách (nên làm ngay)**

1. Menu ☰ → **Billing** → **Budgets & alerts** → **Create budget**.
2. Scope: chọn project `financehealth`. Bỏ chọn **Include credits in cost** nếu muốn được báo theo số credit đã tiêu (giữ chọn thì chỉ báo khi bắt đầu tốn tiền thật).
3. Amount: **Specified amount**, ví dụ `10` USD.
4. Thresholds: 50%, 90%, 100% → email báo về Gmail → **Finish**.

Cảnh báo chỉ gửi email, **không tự chặn chi tiêu**. Khi còn ở gói dùng thử, Google không trừ tiền thẻ trừ khi bạn tự bấm **Activate full account** (nâng cấp tài khoản trả phí). Hết 90 ngày hoặc hết credit mà chưa nâng cấp thì Vertex AI ngừng chạy: app vẫn hoạt động, chỉ quét hóa đơn báo lỗi, khi đó đổi `RECEIPT_PROVIDER=anthropic` (hoặc nâng cấp tài khoản nếu muốn tiếp tục dùng Gemini).

Xem credit còn lại: **Billing** → **Credits**.

### 9.2. Cài lên điện thoại

Cài lên màn hình chính: iPhone dùng Safari → **Chia sẻ → Thêm vào MH chính**. Android dùng Chrome → **Cài đặt ứng dụng**. Camera chạy được vì Cloudflare đã cấp HTTPS.

---

## 10. Xử lý sự cố

| Hiện tượng | Cách kiểm tra |
|---|---|
| `docker compose pull` báo `denied` / `unauthorized` | Package trên GitHub đang private, xem bước 3. |
| `docker` không chạy được, lỗi cgroup/overlay | VPS là OpenVZ/LXC, cần đổi sang gói KVM. |
| Tunnel không Healthy | Sai `CLOUDFLARE_TUNNEL_TOKEN`. Xem `docker compose logs tunnel`. |
| Trang báo **502 Bad Gateway** / **Error 1033** | Public hostname chưa trỏ đúng `web:80`, hoặc `web` chưa chạy (`docker compose ps`). |
| `api` cứ khởi động lại | Thiếu RAM. Chạy `free -h`, `docker compose logs api`. Bật swap, hoặc giảm `-Xmx` trong `JAVA_OPTS`. |
| Ảnh không hiện khi dùng R2/S3 | Sai endpoint, key hoặc tên bucket. Xem `docker compose logs api`. |
| Ổ đầy | `df -h`, `docker image prune -f`, xóa bớt `~/backups`, chuyển ảnh/video sang Object Storage. |
| Quét hóa đơn bằng Gemini không chạy | `docker compose logs api \| grep -i -E "gemini\|receipt"`. `Failed to get application default credentials`: sai đường dẫn hoặc thiếu `chmod 644` file khóa (mục 9.1 bước 4). `status=403`: chưa bật Vertex AI API hoặc service account thiếu role **Vertex AI User**. `status=404`: sai `GCP_PROJECT_ID` hoặc tên `GEMINI_MODEL`. |
