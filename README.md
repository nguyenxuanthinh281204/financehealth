# Hatchi

Web app cá nhân (dùng được như app trên điện thoại) để quản lý **chi tiêu** và **sức khỏe** mỗi ngày.

| Tính năng | Mô tả |
|---|---|
| 💸 Chi tiêu | Nhập tay hoặc **chụp hóa đơn**, AI đọc cửa hàng, ngày, tổng tiền, từng món (hỗ trợ bill tiếng Việt). Lọc theo danh mục, xem theo tháng. |
| ⚖️ Cơ thể & macro | Nhập giới tính, ngày sinh, chiều cao, cân nặng, mức tập, mục tiêu. Tính BMI (ngưỡng châu Á), BMR (Mifflin-St Jeor), TDEE, calo và protein/carb/fat mỗi ngày. Lịch sử cân nặng có biểu đồ. |
| 🥗 Thực đơn tuần | 8 nguyên liệu luộc cố định (trứng gà, ức gà, cơm trắng, xúc xích, cà rốt, bí đỏ, táo, bánh mì). **Mỗi tuần tạo một lần** cho cả 7 ngày (thứ Hai đến Chủ nhật): hệ thống xếp vào sáng/trưa/tối và **tính số gram từng món** cho sát macro, kèm danh sách cần mua cả tuần. Có thể sửa gram từng món. |
| 📸 Khoảnh khắc | Như Locket: chụp ảnh hoặc quay **video tối đa 5 giây** ngay trong app, xem lại theo ngày. |
| 📊 Tổng kết tháng | Tổng chi, so với tháng trước, chi theo danh mục và theo ngày, nơi chi nhiều nhất, cân nặng đầu/cuối tháng, số ngày có thực đơn, khoảnh khắc. |

## Công nghệ

- **Frontend**: React 19 + TypeScript + Vite, dạng **PWA** (cài lên màn hình chính iOS/Android), React Query, Recharts.
- **Backend**: Spring Boot 3.5 (Java 21), Spring Security + JWT, JPA, Flyway.
- **Database**: PostgreSQL 16.
- **Lưu file**: dịch vụ chuẩn S3 như Cloudflare R2 (hoặc ổ đĩa local).
- **Quét hóa đơn**: Claude vision (Anthropic Java SDK) hoặc Gemini trên Vertex AI (Google Gen AI SDK), trả về JSON có cấu trúc.

```
backend/    Spring Boot API
frontend/   React PWA
db/         script khởi tạo PostgreSQL cho dev (tạo database test)
deploy-natvps/ deploy NAT VPS qua Cloudflare Tunnel, dùng image build sẵn trên GitHub
docs/       DEPLOY-NATVPS.md (hướng dẫn deploy)
```

## Chạy local

Cần: Java 21, Maven, Node 22, Docker (hoặc PostgreSQL cài sẵn).

```bash
# 1. Database
docker compose up -d

# 2. Backend: http://localhost:8080
cd backend
mvn spring-boot:run
# Bật quét hóa đơn (không bắt buộc): ANTHROPIC_API_KEY=sk-ant-... mvn spring-boot:run

# 3. Frontend: http://localhost:5173
cd frontend
npm install
npm run dev
```

Mở http://localhost:5173, đăng ký tài khoản và dùng. Ở local, ảnh/video lưu trong `backend/data/uploads`.
Muốn thử trên điện thoại cùng mạng Wi-Fi: `npm run dev -- --host` rồi mở IP máy tính (camera cần HTTPS nên chỉ chụp được khi đã deploy, ở local hãy dùng nút chọn ảnh có sẵn).

## Test

```bash
cd backend && mvn verify      # unit test + integration test trên PostgreSQL (database financehealth_test)
cd frontend && npm run build  # kiểm tra kiểu TypeScript và build
```

## Biến môi trường backend

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | localhost/financehealth | Kết nối PostgreSQL |
| `JWT_SECRET` | chuỗi dev | Khóa ký token, **bắt buộc đổi** khi chạy thật (≥ 32 ký tự) |
| `CORS_ORIGINS` | `http://localhost:5173` | Domain frontend được gọi API |
| `STORAGE_TYPE` | `local` | `local` hoặc `s3` |
| `S3_BUCKET`, `AWS_REGION` | | Bucket lưu media khi dùng S3 |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | trống | Object Storage chuẩn S3 ngoài AWS (BizFly, VNG, FPT...). Để trống khi dùng AWS S3 với IAM role |
| `S3_PATH_STYLE` | `true` | Dùng địa chỉ dạng `endpoint/bucket/key` (chỉ áp dụng khi có `S3_ENDPOINT`) |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | URL công khai của API (ký link file khi lưu local) |
| `RECEIPT_PROVIDER` | `anthropic` | AI đọc hóa đơn: `anthropic` hoặc `gemini` |
| `ANTHROPIC_API_KEY` | trống | Bật quét hóa đơn bằng Claude |
| `RECEIPT_MODEL` | `claude-opus-5-5` | Model Claude dùng để đọc hóa đơn |
| `GCP_PROJECT_ID`, `GCP_LOCATION` | trống, `global` | Project Google Cloud cho Gemini trên Vertex AI |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Model Gemini dùng để đọc hóa đơn |
| `GOOGLE_APPLICATION_CREDENTIALS` | trống | Đường dẫn file JSON của service account (role Vertex AI User) |

## API chính

| Method | Đường dẫn | |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Đăng ký, đăng nhập (trả JWT) |
| GET/PUT | `/api/body/profile` | Hồ sơ cơ thể + macro tính sẵn |
| GET/POST/DELETE | `/api/body/weights` | Nhật ký cân nặng |
| GET/POST/DELETE | `/api/foods` | Danh sách món (món hệ thống + món riêng) |
| GET/POST | `/api/meal-plans/week` | Xem tuần (`?date=`), tạo thực đơn tuần hiện tại (mỗi tuần 1 lần, lần 2 trả 409) |
| GET | `/api/meal-plans/{date}` · PATCH `/api/meal-plans/items/{id}` | Xem một ngày, sửa gram |
| GET/POST/PUT/DELETE | `/api/expenses` | Chi tiêu |
| POST | `/api/expenses/scan-receipt` | Upload ảnh hóa đơn, trả thông tin đọc được |
| GET/POST/DELETE | `/api/moments` | Ảnh / video 5 giây |
| GET | `/api/summary/monthly?month=2026-10` | Tổng kết tháng |

## Deploy

**NAT VPS** (không cần IP riêng): [docs/DEPLOY-NATVPS.md](docs/DEPLOY-NATVPS.md). Cloudflare Tunnel lo HTTPS, image Docker build sẵn trên GitHub, VPS tự cập nhật khi CI xanh, ảnh/video lưu trên Cloudflare R2.
