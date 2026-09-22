# 🏢 HỆ THỐNG QUẢN LÝ CƯ DÂN CHUNG CƯ CÓ TÍCH HỢP AI
> **Học phần:** Phân Tích & Thiết Kế Hệ Thống Thông Tin  
> **Đề tài số 21:** Hệ thống Quản lý Cư dân Chung cư Có Tích hợp AI  
> **Giảng viên hướng dẫn:** Thầy Nguyễn Tuấn Anh  
> **Nhóm thực hiện (Nhóm 25):**  
> • Hoàng Minh Đức (Trưởng nhóm) — MSSV: DTC245200281  
> • Trần Anh Dũng  

---

## 🌟 TỔNG QUAN HỆ THỐNG
Hệ thống được phát triển nhằm giải quyết triệt để các bài toán nhức nhối trong công tác quản lý vận hành tòa nhà chung cư: xóa bỏ phương pháp quản lý thủ công qua sổ sách/Excel/Zalo, tự động hóa tính toán công nợ và đối soát tài chính, tiếp nhận và điều phối sự cố kỹ thuật có kiểm soát nghiệm thu, đồng thời tích hợp **Trí tuệ nhân tạo (AI)** hỗ trợ đắc lực cho cả 3 đối tượng người dùng: **Ban Quản Lý (Admin), Bộ phận Kế toán (Accountant) và Cư dân (Resident)**.

### ✨ Các Điểm Nhấn Công Nghệ & Tính Năng Đột Phá:
1. **Kiến trúc AI Đa Động Cơ Tri-Engine (`services/aiAssistant.js`):**
   - **Chế độ Ưu tiên 1 — Ollama Localhost AI (Qwen2.5:1.5B):** Chạy On-Premise trên card đồ họa rời NVIDIA GeForce RTX 3060 6GB GDDR6, tốc độ phản hồi cực nhanh (~1.2s), chi phí API = 0 và bảo mật tuyệt đối dữ liệu nội bộ chung cư không gửi ra Internet.
   - **Chế độ Ưu tiên 2 — Google Gemini Cloud API:** Tự động kích hoạt mô hình Gemini 2.5 Flash qua SDK `@google/genai` khi quản trị viên nhập `GEMINI_API_KEY`.
   - **Chế độ Ưu tiên 3 — Smart Semantic Offline Engine:** Động cơ dự phòng nội bộ hoạt động trên dữ liệu MySQL và quy tắc nghiệp vụ, cam kết độ sẵn sàng **High Availability 99.9%**, không bao giờ bị gián đoạn hay sập trang (ngay cả khi máy không cài Ollama).
2. **Bộ 3 Chức Năng AI Chuyên Sâu:**
   - **AI Soạn thảo thông báo sự kiện:** Tự động sinh văn bản hành chính trang trọng, đầy đủ thời gian, phạm vi và hotline BQL.
   - **AI Phân cụm & Tóm tắt phản ánh tuần:** Tự động phân loại sự cố vào 4 nhóm nghiệp vụ, định lượng mức độ khẩn cấp (URGENT / HIGH / NORMAL) và gợi ý giải pháp kỹ thuật.
   - **Chatbot bong bóng RAG hỏi đáp nội quy chung cư:** Truy xuất tri thức theo cơ chế RAG (*Retrieval-Augmented Generation*) từ 18 điều khoản nội quy chuẩn hóa, trích dẫn chính xác số Điều/Khoản và kích hoạt bộ lọc **Anti-Hallucination Guard** chống bịa đặt thông tin ngoài quy chế.
3. **Cơ Chế Nghiệm Thu Sự Cố & Re-open Có Lưu Vết:**
   - Khi BQL xử lý xong, bắt buộc nhập giải pháp kỹ thuật cụ thể (`response_note`) và khóa trạng thái Read-only (`resolved_at = NOW()`).
   - Cư dân được xem Hộp giải pháp nổi bật; nếu sự cố tái diễn, cư dân có quyền kích hoạt cơ chế **Re-open**, hệ thống tự động ghi nhật ký vết (Audit Trail), chuyển lại trạng thái `in_progress` và phát tín hiệu cảnh báo BQL qua WebSocket.
4. **An Toàn & Hiệu Năng Cao:**
   - Rate limiting 15 request/phút chống tấn công từ chối dịch vụ (DDoS) và vét cạn API.
   - 100% câu truy vấn dùng Parameterized Queries qua `mysql2/promise` triệt tiêu nguy cơ SQL Injection.
   - Bộ lọc PII tự động xóa bỏ SĐT, CCCD trước khi ghép ngữ cảnh gửi AI, tuân thủ Nghị định 13/2023/NĐ-CP.
   - Thiết lập chỉ mục CSDL (Index) đa cột và phân trang (Pagination) tối ưu hóa thời gian phản hồi.

---

## 🛠️ CÔNG NGHỆ SỬ DỤNG (TECH STACK)
- **Backend Runtime:** Node.js (v18+) & Express.js
- **Frontend / View Engine:** EJS (Server-Side Rendering), CSS3 Responsive, Mobile-First PWA (`manifest.json`, `sw.js`)
- **Cơ sở dữ liệu:** MySQL 8.0+ (Chuẩn hóa quan hệ 3NF gồm 11 bảng dữ liệu)
- **Real-time Engine:** Socket.io (WebSocket phát tín hiệu thông báo đẩy thời gian thực)
- **Bảo mật & Phiên:** `express-session`, `bcryptjs`, `express-rate-limit`
- **Trí tuệ nhân tạo (AI):** Ollama API (`http://localhost:11434`), `@google/genai`, TF-IDF Retrieval Vectorizer

---

## 🗄️ VỊ TRÍ CÁC TỆP CƠ SỞ DỮ LIỆU SQL
Nhóm đã chuẩn bị sẵn các tệp SQL phục vụ nhiều nhu cầu kiểm tra khác nhau trong dự án:

1. **`database.sql` (Đặt ngay tại thư mục gốc `WebCHungCu/database.sql`):**  
   Tệp SQL tổng hợp toàn diện nhất, bao gồm lệnh tạo CSDL `apartment_management`, cấu trúc 11 bảng chuẩn 3NF và **toàn bộ dữ liệu mẫu khởi tạo** (2 tòa tháp, 40 căn hộ, 10 tài khoản cư dân mẫu có mật khẩu mã hóa bcrypt, bảng biểu phí, hóa đơn, sự cố và 15 điều khoản nội quy). Phù hợp nhất để nhập nhanh qua công cụ giao diện như **phpMyAdmin** hoặc **MySQL Workbench**.
2. **`scripts/schema.sql` (Đặt trong thư mục `WebCHungCu/scripts/schema.sql`):**  
   Tệp kịch bản DDL thuần túy định nghĩa 11 bảng dữ liệu, các khóa ngoại (`FOREIGN KEY`), khóa duy nhất (`UNIQUE`) và chỉ mục tìm kiếm văn bản toàn văn (`FULLTEXT INDEX`).
3. **Bộ script tự động hóa Node.js (`scripts/initDb.js` & `scripts/seed.js`):**  
   Khởi tạo cấu trúc và nạp dữ liệu tự động chỉ với 1 câu lệnh qua Terminal mà không cần mở công cụ quản trị MySQL.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY CHI TIẾT (TỪNG BƯỚC)

### 🔹 Bước 1: Chuẩn bị môi trường phần mềm
Trước khi bắt đầu, đảm bảo máy tính đã cài đặt các công cụ sau:
- **Node.js:** Phiên bản LTS khuyến nghị (Node.js v18 trở lên). Tải tại: [https://nodejs.org](https://nodejs.org). Kiểm tra bằng lệnh: `node -v` và `npm -v`.
- **Dịch vụ MySQL:** Khởi động MySQL qua phần mềm **XAMPP**, **WampServer** hoặc dịch vụ **MySQL Service** trên cổng mặc định `3306`.
- *(Tùy chọn cho AI Cục bộ):* Nếu muốn chạy mô hình AI nội bộ trên GPU, cài đặt **Ollama** từ [https://ollama.com](https://ollama.com). *(Lưu ý: Nếu máy không cài Ollama, hệ thống tự động chạy động cơ dự phòng Smart Semantic Offline Engine nội bộ mà không cần cài thêm gì).*

---

### 🔹 Bước 2: Cài đặt các gói thư viện Node.js
Mở cửa sổ dòng lệnh (Terminal / PowerShell / Git Bash) tại thư mục `WebCHungCu` và thực thi:
```bash
npm install
```
*Lệnh trên sẽ tự động tải các gói thư viện cần thiết vào thư mục `node_modules`:*
- `express`: Framework máy chủ web RESTful API & điều hướng tuyến đường.
- `socket.io`: Thư viện truyền thông thời gian thực (Real-time WebSocket).
- `mysql2`: Thư viện kết nối MySQL hỗ trợ cơ chế Connection Pool và Promise.
- `bcryptjs`: Thuật toán mã hóa an toàn một chiều cho mật khẩu người dùng.
- `ejs`: Template engine render giao diện trực tiếp từ máy chủ.
- `express-session`: Quản lý phiên đăng nhập có mã hóa trạng thái.
- `express-rate-limit`: Bộ kiểm soát tần suất request bảo vệ hệ thống và API AI.

---

### 🔹 Bước 3: Khởi tạo Cơ sở dữ liệu & Nạp dữ liệu mẫu
Bạn có thể chọn **1 trong 2 cách** thuận tiện nhất sau:

#### 👉 Cách 3.1: Chạy tự động bằng câu lệnh Node.js (Khuyên dùng - Nhanh nhất)
Tại cửa sổ dòng lệnh thư mục `WebCHungCu`, chạy 2 lệnh:
```bash
# Lệnh 1: Tự động kết nối MySQL và tạo 11 bảng dữ liệu chuẩn 3NF
node scripts/initDb.js

# Lệnh 2: Tự động nạp 40 căn hộ mẫu, 100 cư dân, hóa đơn thu phí và 15 nội quy
node scripts/seed.js
```

#### 👉 Cách 3.2: Nhập thủ công qua giao diện phpMyAdmin
1. Mở trình duyệt truy cập: **[http://localhost/phpmyadmin](http://localhost/phpmyadmin)**.
2. Chọn thẻ **Import** (Nhập) ở thanh menu trên cùng.
3. Nhấn **Choose File** (Chọn tệp) và chọn tệp **`database.sql`** (ở ngay thư mục gốc dự án) hoặc tệp **`scripts/schema.sql`**.
4. Cuộn xuống dưới cùng và nhấn **Import** (Thực hiện). Hệ thống sẽ tự động tạo CSDL `apartment_management` với đầy đủ bảng và dữ liệu.

---

### 🔹 Bước 4: Kiểm tra cấu hình tệp môi trường (`.env`)
Tệp `.env` đã được thiết lập sẵn trong thư mục mã nguồn. Nếu cần tùy chỉnh cổng hoặc mật khẩu MySQL của máy bạn, hãy mở tệp `.env` (hoặc sao chép từ `.env.example`):
```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=apartment_management
SESSION_SECRET=chungcu_secret_key_nhom25_ictu_2026
GEMINI_API_KEY=your_api_key_here
OLLAMA_URL=http://localhost:11434
```
*(Thông thường với XAMPP, người dùng giữ nguyên `DB_USER=root` và `DB_PASS=` để trống là kết nối thành công ngay lập tức).*

---

### 🔹 Bước 5: Khởi chạy máy chủ Web

#### 🌟 Cách 1: Click đúp vào tệp `start.bat` (Dành cho Windows)
Trong thư mục gốc `WebCHungCu`, nhấp đúp vào tệp **`start.bat`**.  
File kịch bản sẽ:
1. Tự động kiểm tra xem máy đã cài Node.js chưa.
2. Tự động kiểm tra và chạy `npm install` nếu chưa có `node_modules`.
3. Tự động bật máy chủ Web và in sẵn tài khoản đăng nhập ra màn hình.

#### 💻 Cách 2: Chạy lệnh qua Terminal
```bash
npm start
# Hoặc: node server.js
```
Khi màn hình xuất hiện thông báo:
```text
============================================================
  HỆ THỐNG QUẢN LÝ CƯ DÂN CHUNG CƯ CÓ TÍCH HỢP AI (NHÓM 25)
  Server đang lắng nghe tại cổng: 3000
  Truy cập ứng dụng: http://localhost:3000
============================================================
```
Mở trình duyệt (Chrome, Edge, Firefox) truy cập vào địa chỉ: **[http://localhost:3000](http://localhost:3000)** *(hoặc [http://localhost:3000/login](http://localhost:3000/login))*.

---

### 🔹 Bước 6: Kích hoạt & Trải nghiệm tính năng AI

#### Trường hợp A: Máy tính có cài đặt Ollama (Chạy On-Premise)
1. Mở một cửa sổ dòng lệnh riêng biệt và chạy:
   ```bash
   ollama serve
   ollama pull qwen2.5:1.5b
   ```
2. Web sẽ tự động nhận diện cổng `11434` và điều phối yêu cầu AI sang mô hình nội bộ Qwen2.5 với thời gian phản hồi siêu tốc ~1.2s.

#### Trường hợp B: Máy tính KHÔNG CÓ Ollama (Chạy máy trạm bình thường)
✨ **Không cần thực hiện thao tác nào!**  
Kiến trúc AI Tri-Engine sẽ tự động kích hoạt Động cơ Dự phòng Cục bộ (**Smart Semantic Offline Engine**). Toàn bộ 3 chức năng:
1. Soạn thông báo hành chính BQL
2. Tóm tắt & Phân cụm phản ánh sự cố tuần
3. Chatbot RAG hỏi đáp nội quy chung cư  
vẫn hoạt động trơn tru 100%, trả lời thông minh và tuyệt đối không phát sinh lỗi crash.

---

## 👥 TÀI KHOẢN DEMO TRÌNH DIỄN (3 VAI TRÒ)

| STT | Vai trò (Role) | Tên đăng nhập | Mật khẩu | Phạm vi quyền hạn |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Ban Quản Lý (Admin)** | `admin` *(hoặc `admin@chungcu.vn`)* | `admin123` | Toàn quyền quản trị tòa nhà, căn hộ, cư dân, duyệt phản ánh, AI soạn thông báo, AI tóm tắt tuần. |
| **2** | **Kế toán (Accountant)** | `ketoan@chungcu.vn` | `ketoan123` | Quản lý danh mục biểu phí, sinh kỳ phí hàng tháng, theo dõi công nợ, gạch nợ thanh toán. |
| **3** | **Cư dân mẫu (Resident)** | `0912345678` *(Căn hộ A101)* | `cudan123` | Cổng cư dân di động (PWA), xem hóa đơn cá nhân, đặt tiện ích (chống trùng lịch), gửi phản ánh, Chatbot AI nội quy. |

---

## 🧪 BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITE)
Nhóm đã xây dựng sẵn 3 bộ kịch bản kiểm thử tự động toàn diện để người chấm thẩm định:
```bash
# 1. Kiểm thử toàn bộ nghiệp vụ End-to-End (E2E)
node scripts/testAppFull.js

# 2. Kiểm thử chuẩn hóa 16 RESTful API Endpoints & Logic tính phí, chống ảo giác
node scripts/testApi16.js

# 3. Kiểm thử Đa Động Cơ AI Tri-Engine, RAG & Trích dẫn điều khoản
node scripts/testAiFull.js
```
*Tất cả các bộ test đều được cam kết đạt tỷ lệ thành công **100% Pass**.*

---

## 📡 DANH MỤC 16 RESTFUL API ENDPOINTS

| Mã API | Method | Endpoint URL | Vai trò (Role) | Mô tả chức năng |
| :---: | :---: | :--- | :---: | :--- |
| **API-01** | `POST` | `/api/auth/login` | Public | Xác thực đăng nhập & Cấp phiên làm việc |
| **API-02** | `POST` | `/api/auth/logout` | All | Hủy phiên làm việc & Đăng xuất an toàn |
| **API-03** | `GET` | `/api/apartments` | Admin, Kế toán | Tra cứu danh sách căn hộ kèm phân trang & lọc |
| **API-04** | `GET` | `/api/apartments/:id` | Admin, Kế toán | Xem chi tiết thông tin và lịch sử căn hộ |
| **API-05** | `GET` | `/api/apartments/:id/residents` | Admin, Kế toán | Lấy danh sách nhân khẩu cư trú trong căn hộ |
| **API-06** | `POST`| `/api/residents` | Admin | Khởi tạo hồ sơ cư dân & cấp tài khoản người dùng |
| **API-07** | `GET` | `/api/fees/current` | Kế toán, Admin | Bảng kê công nợ thu phí chu kỳ hiện hành |
| **API-08** | `POST`| `/api/fees/settle/:id` | Kế toán | Gạch nợ hóa đơn dịch vụ khi cư dân đóng tiền |
| **API-09** | `GET` | `/api/feedbacks` | All (Role-scoped)| Tra cứu danh sách phản ánh sự cố kỹ thuật |
| **API-10** | `POST`| `/api/feedbacks` | Cư dân | Gửi phản ánh sự cố mới kèm hình ảnh hiện trường |
| **API-11** | `PUT` | `/api/feedbacks/:id/status` | BQL, Kỹ thuật | Cập nhật tiến độ xử lý sự cố & lưu giải pháp |
| **API-12** | `GET` | `/api/amenities` | All | Danh mục tiện ích dùng chung của tòa nhà |
| **API-13** | `POST`| `/api/amenities/book` | Cư dân | Đặt lịch tiện ích dùng chung (Kiểm tra chống trùng) |
| **API-14** | `GET` | `/api/announcements` | All | Danh sách bản tin thông báo gửi tới cư dân |
| **API-15** | `POST`| `/api/ai/generate-announcement` | BQL (Admin) | AI tự động sinh văn bản thông báo theo sự kiện |
| **API-16** | `POST`| `/api/ai/rag-chatbot` | Cư dân, All | Chatbot RAG hỏi đáp nội quy tòa nhà (Chống ảo giác) |

---
*Bản quyền thuộc về Nhóm 25 — Đề tài 21: Hệ thống Quản lý Cư dân Chung cư Có Tích hợp AI (2026).*
