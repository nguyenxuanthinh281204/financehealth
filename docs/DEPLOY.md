# Hướng dẫn deploy FinanceHealth lên AWS + tên miền riêng

Tài liệu này đi từ tài khoản AWS trống tới khi app chạy ở `https://ten-mien-cua-ban.com` và cài được lên điện thoại.
Trong toàn bộ hướng dẫn, thay `ten-mien-cua-ban.com` bằng tên miền thật của bạn.
Muốn dùng nhà cung cấp Việt Nam (một VPS, đơn giản hơn) thì xem [DEPLOY-VN.md](DEPLOY-VN.md).

## 0. Kiến trúc

```
Điện thoại / trình duyệt
   │
   ├── https://ten-mien-cua-ban.com ───► CloudFront ──► S3 (frontend React đã build)
   │
   └── https://api.ten-mien-cua-ban.com ─► EC2 (Docker)
                                             ├─ Caddy  (HTTPS tự động, Let's Encrypt)
                                             └─ Spring Boot API ──► RDS PostgreSQL
                                                        └────────► S3 (ảnh hóa đơn, ảnh/video khoảnh khắc)
```

Region khuyên dùng: **ap-southeast-1 (Singapore)**, gần Việt Nam nhất.

Chi phí tham khảo mỗi tháng (giá on-demand, kiểm tra lại trên [AWS Pricing Calculator](https://calculator.aws/)):

| Thành phần | Cấu hình | Ước tính |
|---|---|---|
| EC2 | t4g.small (2 vCPU, 2 GB) + 20 GB gp3 | ~15 USD |
| Public IPv4 (Elastic IP) | 1 địa chỉ | ~3,6 USD |
| RDS PostgreSQL | db.t4g.micro, 20 GB | ~15 USD |
| S3 + CloudFront | dùng cá nhân | < 1 USD |
| Route 53 | 1 hosted zone | 0,5 USD |

Muốn rẻ hơn (~20 USD/tháng): bỏ RDS, chạy PostgreSQL ngay trên EC2 (xem mục 3B). Tài khoản AWS mới thường có free tier hoặc credit, hãy xem mục Billing của bạn.

> Mẹo: vào **Billing → Budgets** tạo một budget 30 USD/tháng có cảnh báo email để không bị bất ngờ.

---

## 1. Chuẩn bị

1. Cài [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) trên máy bạn, chạy `aws configure` (nhập Access Key của một IAM user có quyền admin, region `ap-southeast-1`). Không dùng tài khoản root để làm việc hằng ngày.
2. Đưa DNS của tên miền về **Route 53** (khuyên dùng, vì CloudFront cần bản ghi ALIAS cho tên miền gốc):
   - Route 53 → **Hosted zones → Create hosted zone** → nhập `ten-mien-cua-ban.com`, loại *Public*.
   - Mở hosted zone vừa tạo, copy 4 dòng **NS** (dạng `ns-123.awsdns-45.com`).
   - Đăng nhập trang quản lý tên miền nơi bạn mua (Mắt Bão, PA Vietnam, Nhân Hòa, Namecheap, GoDaddy...) → mục **Nameserver / DNS** → đổi sang 4 nameserver trên.
   - Chờ 15 phút tới vài giờ. Kiểm tra: `dig NS ten-mien-cua-ban.com +short` ra các `awsdns`.

   Nếu bạn muốn giữ DNS ở nhà đăng ký: vẫn làm được, xem ghi chú ở mục 6 và 7.

---

## 2. Bucket S3 lưu ảnh/video

```bash
BUCKET=financehealth-media-<ten-ban>   # tên bucket phải là duy nhất toàn cầu
aws s3api create-bucket --bucket $BUCKET --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Bucket để **private**. API tạo link có chữ ký (hết hạn sau 60 phút) để app hiển thị ảnh, nên không ai xem được file nếu không đăng nhập.

---

## 3A. Database RDS PostgreSQL (khuyên dùng)

Trên AWS Console → **RDS → Create database**:

- Engine: **PostgreSQL 16**, template **Free tier** (nếu có) hoặc **Dev/Test**.
- DB instance identifier: `financehealth-db`. Master username: `financehealth`, đặt mật khẩu mạnh và lưu lại.
- Instance: **db.t4g.micro**, Storage 20 GB gp3, tắt *Storage autoscaling* nếu muốn chặn chi phí.
- Connectivity: **Public access: No**. VPC security group: tạo mới tên `financehealth-db-sg` (sẽ mở cho EC2 ở bước 5).
- Additional configuration → **Initial database name: `financehealth`**. Bật *Automated backups* 7 ngày.

Tạo xong, copy **Endpoint** (dạng `financehealth-db.xxxx.ap-southeast-1.rds.amazonaws.com`).

## 3B. (Tùy chọn tiết kiệm) PostgreSQL chạy trên EC2

Bỏ qua RDS. Ở bước 5 chạy compose với `--profile local-db` và đặt `DB_URL=jdbc:postgresql://db:5432/financehealth`.
Khi đó bạn tự lo sao lưu, ví dụ thêm cron hằng ngày:

```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U financehealth financehealth | gzip > ~/backup-$(date +%F).sql.gz
aws s3 cp ~/backup-$(date +%F).sql.gz s3://$BUCKET/backups/
```

---

## 4. IAM role cho EC2 (để API ghi được vào S3)

IAM → **Roles → Create role** → Trusted entity: **AWS service / EC2** → bỏ qua chọn policy → đặt tên `financehealth-ec2-role` → Create.
Mở role vừa tạo → **Add permissions → Create inline policy → JSON**:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::financehealth-media-<ten-ban>/*"
  }]
}
```

Nhờ role này, server không cần lưu access key nào.

---

## 5. Máy chủ EC2 chạy API

### 5.1 Tạo máy

EC2 → **Launch instance**:

- Name: `financehealth-api`. AMI: **Amazon Linux 2023 (64-bit Arm)**. Instance type: **t4g.small**.
- Key pair: tạo mới, tải file `.pem` về giữ cẩn thận.
- Network: security group mới `financehealth-api-sg` với các rule inbound:
  - SSH 22 — Source: **My IP**
  - HTTP 80 — Anywhere
  - HTTPS 443 — Anywhere
- Storage: 20 GB gp3.
- Advanced details → **IAM instance profile**: chọn `financehealth-ec2-role`.

Sau khi tạo:

- EC2 → **Elastic IPs → Allocate** → **Associate** với instance vừa tạo. Ghi lại IP này.
- Nếu dùng RDS: vào security group `financehealth-db-sg` → Edit inbound → thêm **PostgreSQL 5432**, Source = security group `financehealth-api-sg`.

### 5.2 Cài Docker và chạy API

```bash
ssh -i financehealth.pem ec2-user@<ELASTIC_IP>

# Docker + compose + git
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Thêm 2 GB swap để build Maven không thiếu RAM
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

exit   # thoát rồi ssh lại để nhận quyền nhóm docker
```

```bash
ssh -i financehealth.pem ec2-user@<ELASTIC_IP>
git clone https://github.com/nguyenxuanthinh281204/financehealth.git
cd financehealth/deploy
cp .env.example .env
nano .env        # điền API_DOMAIN, DB_*, JWT_SECRET, CORS_ORIGINS, PUBLIC_BASE_URL, S3_BUCKET
```

Tạo `JWT_SECRET` bằng lệnh `openssl rand -base64 48`.

**Chưa chạy compose vội**, làm bước 6 (trỏ DNS) trước để Caddy xin được chứng chỉ HTTPS.

---

## 6. Trỏ tên miền cho API

Route 53 → hosted zone → **Create record**:

- Record name: `api` · Type: **A** · Value: `<ELASTIC_IP>` · TTL 300.

Kiểm tra: `dig api.ten-mien-cua-ban.com +short` ra đúng Elastic IP. Sau đó trên EC2:

```bash
cd ~/financehealth/deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml logs -f api     # Ctrl+C để thoát
```

Lần đầu build mất vài phút. Flyway tự tạo bảng và nạp sẵn ~30 món ăn Việt. Kiểm tra:

```bash
curl https://api.ten-mien-cua-ban.com/actuator/health
# {"status":"UP",...}
```

> Giữ DNS ở nhà đăng ký? Tạo bản ghi **A** `api` → Elastic IP trong trang quản lý DNS của họ, kết quả như nhau.

---

## 7. Frontend: S3 + CloudFront + HTTPS

### 7.1 Chứng chỉ HTTPS (ACM)

CloudFront chỉ dùng chứng chỉ ở **us-east-1**. Đổi region góc phải Console sang **N. Virginia (us-east-1)**:

ACM → **Request certificate → Public** → Domain names: `ten-mien-cua-ban.com` và `www.ten-mien-cua-ban.com` → **DNS validation** → Request.
Mở chứng chỉ → **Create records in Route 53** → chờ trạng thái **Issued** (vài phút).

### 7.2 Bucket chứa frontend

```bash
WEB_BUCKET=financehealth-web-<ten-ban>
aws s3api create-bucket --bucket $WEB_BUCKET --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
```

Giữ nguyên chặn public. CloudFront sẽ đọc qua OAC.

### 7.3 CloudFront

CloudFront → **Create distribution**:

- Origin domain: chọn bucket `financehealth-web-...`. Origin access: **Origin access control settings (recommended)** → Create new OAC.
- Viewer protocol policy: **Redirect HTTP to HTTPS**. Cache policy: *CachingOptimized*.
- Web Application Firewall: *Do not enable* (dùng cá nhân).
- Alternate domain names (CNAME): `ten-mien-cua-ban.com`, `www.ten-mien-cua-ban.com`. Custom SSL certificate: chọn chứng chỉ vừa tạo.
- Default root object: `index.html`.
- Create. Console hiện thông báo **copy policy** cho bucket: bấm Copy → vào S3 bucket → Permissions → Bucket policy → dán → Save.

Sau khi tạo, vào tab **Error pages** tạo 2 custom error response để React Router hoạt động khi tải lại trang:

| HTTP error code | Customize | Response page path | Response code |
|---|---|---|---|
| 403 | Yes | `/index.html` | 200 |
| 404 | Yes | `/index.html` | 200 |

### 7.4 Trỏ tên miền về CloudFront

Route 53 → hosted zone → Create record (làm 2 lần, record name trống và `www`):
Type **A** → bật **Alias** → *Alias to CloudFront distribution* → chọn distribution.

> Giữ DNS ở nhà đăng ký? Tạo **CNAME** `www` → `dxxxxxxxx.cloudfront.net`. Tên miền gốc (không www) thường không CNAME được, hãy dùng tính năng *chuyển hướng tên miền* của nhà đăng ký từ `ten-mien-cua-ban.com` sang `https://www.ten-mien-cua-ban.com`.

### 7.5 Build và upload (lần đầu, làm trên máy bạn)

```bash
cd frontend
npm ci
VITE_API_URL=https://api.ten-mien-cua-ban.com npm run build
aws s3 sync dist s3://$WEB_BUCKET --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude index.html --exclude sw.js --exclude registerSW.js --exclude "workbox-*.js" --exclude manifest.webmanifest
cd dist && for f in index.html sw.js registerSW.js manifest.webmanifest workbox-*.js; do
  aws s3 cp "$f" "s3://$WEB_BUCKET/$f" --cache-control "no-cache"; done; cd ..
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

Mở `https://ten-mien-cua-ban.com`, đăng ký tài khoản và dùng thử.

### 7.6 (Tùy chọn) Tự deploy frontend mỗi khi push

Repo có sẵn `.github/workflows/deploy-frontend.yml`. Để bật:

1. IAM → **Identity providers → Add provider** → OpenID Connect, URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. Tạo role `financehealth-github-deploy` (trusted entity: Web identity, provider vừa tạo, audience `sts.amazonaws.com`, GitHub organization `nguyenxuanthinh281204`, repository `financehealth`, branch `main`). Gắn inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::financehealth-web-<ten-ban>" },
       { "Effect": "Allow", "Action": ["s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::financehealth-web-<ten-ban>/*" },
       { "Effect": "Allow", "Action": ["cloudfront:CreateInvalidation"], "Resource": "*" }
     ]
   }
   ```
3. GitHub repo → **Settings → Secrets and variables → Actions**:
   - Secret `AWS_DEPLOY_ROLE_ARN` = ARN của role trên.
   - Variables: `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `AWS_REGION` (`ap-southeast-1`), `API_URL` (`https://api.ten-mien-cua-ban.com`).

Từ đó mỗi lần push thay đổi trong `frontend/` lên `main`, GitHub tự build và upload.

---

## 8. Bật quét hóa đơn bằng AI

1. Tạo API key tại [console.anthropic.com](https://console.anthropic.com/) (cần nạp credit; mỗi lần quét tốn khoảng 1.000đ với model mặc định `claude-opus-5-5`, đổi được qua biến `RECEIPT_MODEL`).
2. Trên EC2: `nano ~/financehealth/deploy/.env` → điền `ANTHROPIC_API_KEY=sk-ant-...`.
3. `docker compose -f docker-compose.prod.yml --env-file .env up -d` để áp dụng.

Không có key thì nút chụp hóa đơn vẫn lưu ảnh, chỉ là bạn tự nhập số tiền.

---

## 9. Cài lên điện thoại như app

- **iPhone (Safari)**: mở trang → nút **Chia sẻ** → **Thêm vào MH chính**.
- **Android (Chrome)**: mở trang → menu ⋮ → **Cài đặt ứng dụng** / **Thêm vào màn hình chính**.

App chạy toàn màn hình, có icon riêng, dùng được camera để chụp hóa đơn và quay video 5 giây. Camera chỉ hoạt động qua HTTPS, vì vậy cần hoàn tất bước 6–7.

---

## 10. Cập nhật phiên bản mới

```bash
# Backend (trên EC2)
cd ~/financehealth && git pull
cd deploy && docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# Frontend: lặp lại mục 7.5, hoặc để GitHub Actions tự làm (mục 7.6)
```

Thay đổi database luôn đi qua file migration Flyway mới trong `backend/src/main/resources/db/migration` (V3__..., V4__...), không sửa file cũ.

---

## 11. Xử lý sự cố

| Hiện tượng | Cách kiểm tra |
|---|---|
| `curl https://api...` lỗi chứng chỉ | DNS `api` chưa trỏ đúng IP hoặc port 80/443 chưa mở. Xem `docker compose ... logs caddy`. |
| API không khởi động | `docker compose ... logs api`. Thường do sai `DB_URL`/mật khẩu hoặc RDS chưa cho security group EC2 vào cổng 5432. |
| Web báo "Không kết nối được máy chủ" | `VITE_API_URL` lúc build sai, hoặc `CORS_ORIGINS` thiếu đúng tên miền web (có `https://`, không có `/` cuối). |
| Tải lại trang ra lỗi 403/404 | Chưa tạo custom error response ở mục 7.3. |
| Ảnh không hiện | `S3_BUCKET` sai hoặc EC2 chưa gắn IAM role ở mục 4. |
| Upload báo file quá lớn | Ảnh/video tối đa 20 MB, video tối đa 5 giây. |
| Web không thấy bản mới | Service worker đang giữ bản cũ: đóng hẳn app/tab rồi mở lại. |

Chạy local (không cần AWS) xem `README.md`.
