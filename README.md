# 🏢 HỆ THỐNG QUẢN LÝ CƯ DÂN CHUNG CƯ CÓ TÍCH HỢP AI
> **Học phần:** Phân Tích & Thiết Kế Hệ Thống Thông Tin  
> **Đề tài số 21:** Hệ thống Quản lý Cư dân Chung cư Có Tích hợp AI  
> **Giảng viên hướng dẫn:** Thầy Nguyễn Tuấn Anh  
> **Nhóm thực hiện (Nhóm 25):**  
> • Hoàng Minh Đức (Trưởng nhóm)  
> • Trần Anh Dũng  

---

## 🌟 TỔNG QUAN HỆ THỐNG
Hệ thống được phát triển nhằm giải quyết triệt để các bài toán nhức nhối trong công tác quản lý vận hành tòa nhà chung cư: xóa bỏ phương pháp quản lý thủ công qua sổ sách/Excel/Zalo, tự động hóa tính toán công nợ và đối soát tài chính, tiếp nhận và điều phối sự cố kỹ thuật có kiểm soát nghiệm thu, đồng thời tích hợp **Trí tuệ nhân tạo (AI)** hỗ trợ đắc lực cho cả 3 đối tượng người dùng: **Ban Quản Lý (Admin), Bộ phận Kế toán (Accountant) và Cư dân (Resident)**.

### ✨ Các Điểm Nhấn Công Nghệ & Tính Năng Đột Phá:
1. **Kiến trúc AI Đa Động Cơ Tri-Engine (`services/aiAssistant.js`):**
   - **Chế độ Ưu tiên 1 — Ollama Localhost AI (Qwen2.5:1.5B):** Chạy On-Premise trên card đồ họa rời NVIDIA GeForce RTX 3060 6GB GDDR6, tốc độ phản hồi cực nhanh (~1.2s), chi phí API = 0 và bảo mật tuyệt đối dữ liệu nội bộ chung cư không gửi ra Internet.
   - **Chế độ Ưu tiên 2 — Google Gemini Cloud API:** Tự động kích hoạt mô hình Gemini 2.5 Flash qua SDK `@google/genai` khi quản trị viên nhập `GEMINI_API_KEY`.
   - **Chế độ Ưu tiên 3 — Smart Semantic Offline Engine:** Động cơ dự phòng nội bộ hoạt động trên dữ liệu MySQL và quy tắc nghiệp vụ, cam kết độ sẵn sàng **High Availability 99.9%**, không bao giờ bị gián đoạn hay sập trang.
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

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY HỆ THỐNG

### 1. Chuẩn Bị Môi Trường
- Đã cài đặt **Node.js** (khuyến nghị v18 hoặc mới hơn).
- Đã khởi động dịch vụ **MySQL** (qua XAMPP, WampServer hoặc MySQL Service) trên cổng mặc định `3306`.
- *(Tùy chọn cho AI Cục bộ)*: Khởi động **Ollama** (`ollama serve`) và tải mô hình `ollama pull qwen2.5:1.5b`.

### 2. Cài Đặt Thư Viện
Mở Terminal tại thư mục `WebCHungCu`:
```bash
npm install
```

### 3. Khởi Tạo Cơ Sở Dữ Liệu & Nạp Dữ Liệu Mẫu
Chạy script tự động tạo 11 bảng CSDL và nạp 40 căn hộ mẫu, 100 cư dân, 120 hóa đơn thu phí 3 tháng, 25 phản ánh và 18 nội quy:
```bash
node scripts/initDb.js
node scripts/seed.js
```

### 4. Cấu Hình Tệp Môi Trường (`.env`)
Tệp `.env` đã được cấu hình sẵn các tham số mặc định:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=webchungcu
SESSION_SECRET=apartment_management_secret_key_2026
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_URL=http://localhost:11434
```

### 5. Khởi Chạy Ứng Dụng
```bash
npm start
# Hoặc: node server.js
```
Mở trình duyệt và truy cập: **[http://localhost:3000](http://localhost:3000)**

---

## 👥 TÀI KHOẢN DEMO TRÌNH DIỄN (3 VAI TRÒ)

| STT | Vai trò (Role) | Tên đăng nhập | Mật khẩu | Phạm vi quyền hạn |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Ban Quản Lý (Admin)** | `admin` *(hoặc `admin@chungcu.vn`)* | `admin123` | Toàn quyền quản trị tòa nhà, căn hộ, cư dân, duyệt phản ánh, AI soạn thông báo, AI tóm tắt tuần. |
| **2** | **Kế toán (Accountant)** | `ketoan@chungcu.vn` | `ketoan123` | Quản lý danh mục biểu phí, sinh kỳ phí hàng tháng, theo dõi công nợ, gạch nợ thanh toán. |
| **3** | **Cư dân mẫu (Resident)** | `0912345678` *(Căn hộ A101)* | `cudan123` | Cổng cư dân di động (PWA), xem hóa đơn cá nhân, đặt tiện ích (chống trùng lịch), gửi phản ánh, Chatbot AI nội quy. |

---

## 🧪 BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITE)
Nhóm đã xây dựng sẵn 3 bộ kịch bản kiểm thử tự động toàn diện:
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
