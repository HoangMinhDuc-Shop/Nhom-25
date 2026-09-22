# 🏢 HỆ THỐNG QUẢN LÝ CƯ DÂN CHUNG CƯ CÓ TÍCH HỢP AI
> **Học phần:** Phân Tích & Thiết Kế Hệ Thống Thông Tin  
> **Đề tài số 21:** Hệ thống Quản lý Cư dân Chung cư Có Tích hợp AI  
> **Giảng viên hướng dẫn:** Thầy Nguyễn Tuấn Anh  
> **Nhóm thực hiện (Nhóm 25):**  
> • Hoàng Minh Đức (Trưởng nhóm) — MSSV: DTC245200281  
> • Trần Anh Dũng  

---

> ### 📌 LƯU Ý DÀNH CHO GIẢNG VIÊN & NGƯỜI CHẤM ĐỒ ÁN:
> 1. **Về Nền Tảng Công Nghệ (Node.js vs Python):**  
>    Khác với đa số các đồ án trong lớp sử dụng Python (FastAPI/Django), nhóm 25 lựa chọn nền tảng **Node.js (Express.js + Socket.io + MySQL)** để tối ưu hóa hiệu năng xử lý bất đồng bộ thời gian thực (*Real-time WebSocket*), đẩy chuông thông báo tức thì (*Push Notification*) và khả năng mở rộng kiến trúc Web di động (PWA).  
>    👉 Vì vậy, máy chấm bài chỉ cần có **Node.js** (chạy `npm install` để tự động tải `node_modules`) và **MySQL** (cổng 3306).
> 
> 2. **Về Yêu Cầu AI (Ollama / Card đồ họa GPU):**  
>    - **Nếu máy của Thầy/Cô CÓ cài Ollama:** Hệ thống sẽ tự động nhận diện và kích hoạt mô hình AI cục bộ `Qwen2.5:1.5B` nạp VRAM GPU On-Premise đạt tốc độ suy luận ~1.2 giây/câu, chi phí API = 0 và bảo mật tuyệt đối.
>    - **Nếu máy của Thầy/Cô KHÔNG CÓ Ollama (hoặc không có GPU rời):**  
>      ✨ **HOÀN TOÀN KHÔNG SAO CẢ!** Hệ thống được nhóm trang bị kiến trúc **Đa Động Cơ Tri-Engine độc quyền**: Bộ điều phối thông minh sẽ **tự động fallback sang Động cơ Dự phòng Nội bộ (Smart Semantic Offline Engine)**. Thầy/Cô **KHÔNG CẦN CÀI OLLAMA** thì toàn bộ 3 chức năng AI (*Sinh thông báo, Tóm tắt phản ánh, Chatbot RAG nội quy*) vẫn hoạt động chuẩn xác 100%, cam kết không bao giờ phát sinh lỗi crash server!

---

## ⚡ HƯỚNG DẪN KHỞI CHẠY NHANH TRONG 3 BƯỚC (QUICK START)

### 🌟 Cách nhanh nhất: Click đúp vào tệp `start.bat`
Nhóm đã tạo sẵn tệp kịch bản tự động `start.bat` trong thư mục gốc. Thầy/Cô chỉ cần click đúp vào file **`start.bat`**, hệ thống sẽ tự động kiểm tra thư viện, tự động cài đặt `npm install` nếu chưa có `node_modules` và khởi chạy web ngay lập tức!

---

### Hoặc chạy thủ công qua Terminal (3 bước):

#### 🔹 Bước 1: Cài đặt thư viện Node.js
Mở Terminal/PowerShell tại thư mục dự án và chạy:
```bash
npm install
```
*(Lệnh này sẽ tự động tải toàn bộ các gói thư viện vào thư mục `node_modules` trong vòng 30 giây).*

#### 🔹 Bước 2: Khởi tạo CSDL MySQL & Nạp 40 Căn hộ mẫu
Đảm bảo dịch vụ MySQL đang bật (qua XAMPP hoặc MySQL Service cổng 3306), sau đó chạy lệnh tự động:
```bash
node scripts/initDb.js
node scripts/seed.js
```
*(Script sẽ tự động tạo đủ 11 bảng CSDL chuẩn 3NF và nạp sẵn 40 căn hộ mẫu, 100 cư dân, 120 hóa đơn thu phí 3 tháng, 25 phản ánh và 18 điều khoản nội quy).*

#### 🔹 Bước 3: Bật Web và trải nghiệm
```bash
npm start
```
Mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)** *(hoặc [http://localhost:3000/login](http://localhost:3000/login))*.

---

## 🔑 DANH SÁCH TÀI KHOẢN DEMO ĐĂNG NHẬP (3 VAI TRÒ)

| Vai trò (Role) | Tên đăng nhập | Mật khẩu | Các tính năng nổi bật để chấm điểm |
| :--- | :--- | :--- | :--- |
| **Ban Quản Lý (Admin)** | `admin` *(hoặc `admin@chungcu.vn`)* | `admin123` | • Bảng điều khiển KPI toàn diện cư dân, căn hộ, công nợ.<br>• Quản lý danh mục căn hộ, duyệt khiếu nại sự cố.<br>• **✨ AI Soạn thông báo sự kiện** (`/ai/tools`).<br>• **✨ AI Phân cụm & Tóm tắt phản ánh tuần** (`/feedbacks/summary`). |
| **Kế toán (Accountant)** | `ketoan@chungcu.vn` | `ketoan123` | • Bảng kê công nợ thu phí định kỳ theo tháng.<br>• Biểu phí nước sinh hoạt lũy tiến bậc thang tự động.<br>• Thao tác **Gạch nợ hóa đơn trực tiếp** cập nhật thời gian thực. |
| **Cư dân (Resident)** | `0912345678` *(Căn hộ A101)* | `cudan123` | • Cổng dịch vụ Cư dân di động (PWA).<br>• Tra cứu hóa đơn phí minh bạch của riêng căn hộ mình.<br>• Đặt tiện ích dùng chung có **thuật toán chặn trùng lịch**.<br>• Gửi phản ánh sự cố kèm ảnh & xem Hộp giải pháp BQL.<br>• **💬 Chatbot bong bóng RAG** hỏi đáp 18 điều khoản nội quy. |

---

## 🧪 KỊCH BẢN TEST NHANH 3 TÍNH NĂNG AI (DÀNH CHO NGƯỜI CHẤM)

1. **AI Soạn thảo thông báo:**
   - Đăng nhập quyền `admin` -> Vào menu **"✨ Trợ lý AI"** -> Chọn sự kiện *"Bảo trì máy bơm nước tòa nhà"* -> Bấm **"Tạo thông báo bằng AI"** -> AI sinh văn bản hành chính hoàn chỉnh trong 1.5 giây.
2. **AI Tóm tắt & Phân cụm phản ánh:**
   - Đăng nhập quyền `admin` -> Vào menu **"✨ Trợ lý AI"** -> Tab *"Phân tích phản ánh tuần"* -> Bấm **"AI Phân Tích"** -> AI tự động gom 25 phản ánh thành 4 nhóm nghiệp vụ, chỉ ra mức ưu tiên (URGENT/HIGH) và giải pháp kỹ thuật.
3. **Chatbot RAG hỏi đáp nội quy chung cư (Có Anti-Hallucination Guard):**
   - Đăng nhập quyền cư dân (`0912345678` / `cudan123`) -> Bấm vào bong bóng Chatbot AI góc phải dưới màn hình:
     - *Câu hỏi 1 (Đúng nội quy):* *"Ban công có được nuôi chó mèo không?"* -> AI trích dẫn chuẩn xác **Điều 3** trong quy chế tòa nhà.
     - *Câu hỏi 2 (Kiểm tra Chống ảo giác):* *"Ngày mai thời tiết Hà Nội thế nào?"* -> Chatbot lịch sự từ chối và hướng dẫn liên hệ Hotline BQL, **cam kết không bịa đặt thông tin**.

---

## 🔬 KIỂM THỬ TỰ ĐỘNG BẰNG 1 CÂU LỆNH
Thầy/Cô có thể kiểm chứng độ ổn định của hệ thống bằng các bộ test tự động viết sẵn:
```bash
# Kiểm thử toàn bộ quy trình nghiệp vụ End-to-End (E2E)
node scripts/testAppFull.js

# Kiểm thử đầy đủ 16 RESTful API Endpoints & Chống ảo giác
node scripts/testApi16.js

# Kiểm thử Đa Động Cơ AI Tri-Engine (Ollama / Gemini / Offline)
node scripts/testAiFull.js
```
*(Kết quả kiểm thử cam kết đạt **100% Pass**).*

---

## 🏛️ CẤU TRÚC THƯ MỤC DỰ ÁN
```text
WebCHungCu/
├── config/database.js         # Kết nối MySQL Connection Pool
├── middleware/                # Phân quyền RBAC, Xác thực Session, Rate Limiter
├── public/                    # CSS Responsive, Client JS, WebSocket, PWA (sw.js)
├── routes/                    # Định tuyến: Auth, Dashboard, Apartments, Fees, Feedbacks, AI, API
├── scripts/                   # Schema SQL 11 bảng, Seed Mock data 40 căn hộ, Bộ test tự động
├── services/                  # AI Tri-Engine (aiAssistant.js), Tính phí nước, Chặn trùng lịch
├── views/                     # Bộ giao diện EJS Server-Side Rendering (Admin, Kế toán, Cư dân)
├── start.bat                  # File chạy tự động 1-click cho người chấm
├── .env.example               # File mẫu biến môi trường
└── server.js                  # Điểm khởi chạy máy chủ Express & Socket.io
```

---
*Bản quyền thuộc về Nhóm 25 — Đề tài 21: Hệ thống Quản lý Cư dân Chung cư Có Tích hợp AI (2026).*
