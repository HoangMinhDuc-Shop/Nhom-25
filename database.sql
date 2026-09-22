-- ================================================================
-- CSDL HỆ THỐNG QUẢN LÝ CƯ DÂN CHUNG CƯ CÓ TÍCH HỢP AI
-- Khởi tạo 11 bảng chuẩn hóa 100% theo Sơ đồ quan hệ thực thể (ERD)
-- ================================================================

CREATE DATABASE IF NOT EXISTS apartment_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE apartment_management;

-- 1. Bảng BUILDINGS (Tòa nhà)
CREATE TABLE IF NOT EXISTS buildings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    num_floors INT NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- 2. Bảng APARTMENTS (Căn hộ)
CREATE TABLE IF NOT EXISTS apartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    floor INT NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    area DECIMAL(6,2) NOT NULL,
    status ENUM('vacant','occupied','rented') NOT NULL DEFAULT 'vacant',
    CONSTRAINT fk_apartments_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Bảng RESIDENTS (Cư dân & Người dùng)
CREATE TABLE IF NOT EXISTS residents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL UNIQUE,
    role ENUM('admin','accountant','resident') NOT NULL DEFAULT 'resident',
    is_owner TINYINT(1) NOT NULL DEFAULT 0,
    password_hash VARCHAR(255) NOT NULL,
    CONSTRAINT fk_residents_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Bảng FEEDBACKS (Phản ánh & Sự cố)
CREATE TABLE IF NOT EXISTS feedbacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    resident_id INT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Khác',
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    status ENUM('pending','in_progress','resolved','rejected') NOT NULL DEFAULT 'pending',
    ai_summary_group VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedbacks_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    CONSTRAINT fk_feedbacks_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Bảng AMENITIES (Tiện ích dùng chung)
CREATE TABLE IF NOT EXISTS amenities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 20,
    open_time TIME NOT NULL DEFAULT '06:00:00',
    close_time TIME NOT NULL DEFAULT '22:00:00'
) ENGINE=InnoDB;

-- 6. Bảng AMENITY_BOOKINGS (Lịch đặt tiện ích)
CREATE TABLE IF NOT EXISTS amenity_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amenity_id INT NOT NULL,
    resident_id INT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_amenity FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Bảng ANNOUNCEMENTS (Bản tin thông báo)
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    created_by INT NOT NULL,
    is_ai_generated TINYINT(1) NOT NULL DEFAULT 0,
    target_scope VARCHAR(100) NOT NULL DEFAULT 'all',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcements_creator FOREIGN KEY (created_by) REFERENCES residents(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8. Bảng NOTIFICATION_READS (Lượt đọc thông báo)
CREATE TABLE IF NOT EXISTS notification_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT NOT NULL,
    resident_id INT NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Bảng FEE_TYPES (Danh mục loại phí)
CREATE TABLE IF NOT EXISTS fee_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(30) NOT NULL
) ENGINE=InnoDB;

-- 10. Bảng FEE_TRANSACTIONS (Giao dịch thu phí & công nợ)
CREATE TABLE IF NOT EXISTS fee_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NOT NULL,
    fee_type_id INT NOT NULL,
    period VARCHAR(10) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fee_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
    CONSTRAINT fk_fee_type FOREIGN KEY (fee_type_id) REFERENCES fee_types(id) ON DELETE RESTRICT,
    CONSTRAINT uq_apt_fee_period UNIQUE (apartment_id, fee_type_id, period)
) ENGINE=InnoDB;

-- 11. Bảng INTERNAL_RULES (Kho tri thức nội quy phục vụ RAG)
CREATE TABLE IF NOT EXISTS internal_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Nội quy chung',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FULLTEXT INDEX ft_rules (title, content)
) ENGINE=InnoDB;


-- ================================================================
-- DỮ LIỆU KHỞI TẠO MẪU (SEED DATA CHO HỆ THỐNG QUẢN LÝ CHUNG CƯ)
-- ================================================================

-- 1. Nạp Buildings
INSERT INTO buildings (id, name, address, num_floors) VALUES
(1, 'Tòa Tháp A (Ruby Tower)', 'Số 25 Đường Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 25),
(2, 'Tòa Tháp B (Sapphire Tower)', 'Số 25 Đường Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 20)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. Nạp 40 Apartments mẫu
INSERT INTO apartments (building_id, floor, code, area, status) VALUES
(1, 1, 'A0101', 73.50, 'occupied'),
(1, 1, 'A0102', 76.00, 'occupied'),
(1, 1, 'A0103', 78.50, 'occupied'),
(1, 1, 'A0104', 81.00, 'occupied'),
(1, 2, 'A0201', 76.00, 'occupied'),
(1, 2, 'A0202', 78.50, 'occupied'),
(1, 2, 'A0203', 81.00, 'occupied'),
(1, 2, 'A0204', 83.50, 'occupied'),
(1, 3, 'A0301', 78.50, 'vacant'),
(1, 3, 'A0302', 81.00, 'occupied'),
(1, 3, 'A0303', 83.50, 'vacant'),
(1, 3, 'A0304', 86.00, 'vacant'),
(1, 4, 'A0401', 81.00, 'occupied'),
(1, 4, 'A0402', 83.50, 'occupied'),
(1, 4, 'A0403', 86.00, 'occupied'),
(1, 4, 'A0404', 88.50, 'occupied'),
(1, 5, 'A0501', 83.50, 'occupied'),
(1, 5, 'A0502', 86.00, 'occupied'),
(1, 5, 'A0503', 88.50, 'occupied'),
(1, 5, 'A0504', 91.00, 'occupied'),
(1, 6, 'A0601', 86.00, 'vacant'),
(1, 6, 'A0602', 88.50, 'vacant'),
(1, 6, 'A0603', 91.00, 'vacant'),
(1, 6, 'A0604', 93.50, 'vacant'),
(1, 7, 'A0701', 88.50, 'occupied'),
(1, 7, 'A0702', 91.00, 'occupied'),
(1, 7, 'A0703', 93.50, 'occupied'),
(1, 7, 'A0704', 96.00, 'occupied'),
(2, 1, 'B0101', 78.00, 'vacant'),
(2, 1, 'B0102', 81.00, 'occupied'),
(2, 1, 'B0103', 84.00, 'vacant'),
(2, 1, 'B0104', 87.00, 'occupied'),
(2, 2, 'B0201', 81.00, 'vacant'),
(2, 2, 'B0202', 84.00, 'occupied'),
(2, 2, 'B0203', 87.00, 'vacant'),
(2, 2, 'B0204', 90.00, 'occupied'),
(2, 3, 'B0301', 84.00, 'vacant'),
(2, 3, 'B0302', 87.00, 'occupied'),
(2, 3, 'B0303', 90.00, 'vacant'),
(2, 3, 'B0304', 93.00, 'occupied')
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- 3. Nạp Residents & Tài khoản người dùng (Mật khẩu đã hash chuẩn bcrypt)
INSERT INTO residents (id, apartment_id, full_name, phone, email, role, is_owner, password_hash) VALUES
(1, NULL, 'Ban Quản Lý Chung Cư (Admin)', '0901234567', 'admin@chungcu.vn', 'admin', 0, '$2a$10$oUckdDyyYU7iZ/UW/Xktte3PSSuK.eFnPRZZjN8iNJEAsJtgsJiP6'),
(2, NULL, 'Nguyễn Thị Thu Hương (Kế toán)', '0909876543', 'ketoan@chungcu.vn', 'accountant', 0, '$2a$10$.D4FdU4jIQmkV2CJR3lp9OM9VBcBWrQ6KQ/QJJjxPSUzUoMuDI2MK'),
(3, 1, 'Hoàng Minh Đức (Chủ hộ A0101)', '0912345678', 'duc.hoang@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(4, 2, 'Trần Anh Dũng (Chủ hộ A0102)', '0987654321', 'dung.tran@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(5, 3, 'Lê Văn Thắng (Chủ hộ A0103)', '0934567890', 'thang.le@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(6, 1, 'Phạm Thị Mai (Thành viên A0101)', '0945678901', 'mai.pham@gmail.com', 'resident', 0, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(7, 5, 'Vũ Đình Trọng (Chủ hộ A0201)', '0956789012', 'trong.vu@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(8, 6, 'Ngô Thanh Vân (Chủ hộ A0202)', '0967890123', 'van.ngo@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(9, 9, 'Đỗ Mạnh Cường (Chủ hộ A0301)', '0978901234', 'cuong.do@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW'),
(10, 29, 'Bùi Tuyết Mai (Chủ hộ B0101)', '0989012345', 'mai.bui@gmail.com', 'resident', 1, '$2a$10$UTI3pV0fM93mep3qEelcd.ajOFy.p4ij/KO.peu1B8E3h0Z90QomW')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- 4. Nạp Fee Types (Danh mục loại phí)
INSERT INTO fee_types (id, name, unit_price, unit) VALUES
(1, 'Phí dịch vụ quản lý vận hành', 12000.00, 'm2/tháng'),
(2, 'Phí nước sinh hoạt', 18500.00, 'm3'),
(3, 'Phí trông giữ xe máy', 100000.00, 'xe/tháng'),
(4, 'Phí trông giữ xe ô tô', 1200000.00, 'xe/tháng')
ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price);

-- 5. Nạp Fee Transactions (Hóa đơn thu phí)
INSERT INTO fee_transactions (apartment_id, fee_type_id, period, amount, status, paid_at) VALUES
(1, 1, '2026-09', 850000.00, 'paid', NOW()),
(1, 2, '2026-09', 245000.00, 'paid', NOW()),
(1, 3, '2026-09', 200000.00, 'paid', NOW()),
(2, 1, '2026-09', 910000.00, 'unpaid', NULL),
(2, 2, '2026-09', 315000.00, 'unpaid', NULL),
(2, 4, '2026-09', 1200000.00, 'unpaid', NULL),
(3, 1, '2026-09', 820000.00, 'unpaid', NULL),
(3, 3, '2026-09', 100000.00, 'unpaid', NULL),
(5, 1, '2026-09', 950000.00, 'paid', NOW()),
(6, 1, '2026-09', 930000.00, 'unpaid', NULL)
ON DUPLICATE KEY UPDATE amount=VALUES(amount);

-- 6. Nạp Feedbacks (Phản ánh cư dân mẫu)
INSERT INTO feedbacks (apartment_id, resident_id, category, title, content, status, ai_summary_group) VALUES
(1, 3, 'Thang máy', 'Thang máy số 2 tòa A bị rung lắc mạnh khi qua tầng 12', 'Vào lúc 7h30 sáng nay khi tôi đi làm, thang số 2 có tiếng kêu rít và giật cục nhẹ, đề nghị kỹ thuật kiểm tra cáp kéo khẩn cấp.', 'in_progress', 'THIẾT BỊ KỸ THUẬT'),
(2, 4, 'Điện', 'Bóng đèn hành lang tầng 8 tòa A chập chờn liên tục', 'Đèn chiếu sáng khu vực đối diện thang rác bị nhấp nháy 2 ngày nay gây khó khăn cho việc đi lại ban đêm.', 'pending', 'THIẾT BỊ KỸ THUẬT'),
(3, 5, 'Vệ sinh', 'Nhà rác tầng 5 có mùi khó chịu chưa được dọn sạch', 'Thùng rác hữu cơ đã đầy từ tối qua nhưng chưa thấy nhân viên vệ sinh chuyển xuống hầm gom.', 'resolved', 'VỆ SINH MÔI TRƯỜNG'),
(5, 7, 'Tiếng ồn', 'Căn hộ tầng trên khoan đục sửa nhà vào giờ nghỉ trưa', 'Căn hộ 0302 thường xuyên khoan đục lúc 12h30 - 13h30 gây ồn ào không ngủ được, vi phạm Điều 1 nội quy.', 'pending', 'AN NINH TRẬT TỰ'),
(1, 3, 'Nước', 'Nước sinh hoạt căn A0101 có màu vàng đục', 'Nước vòi rửa bát sáng nay xả ra thấy có cặn màu vàng đục, đề nghị kiểm tra bể chứa ngầm.', 'in_progress', 'VỆ SINH MÔI TRƯỜNG')
ON DUPLICATE KEY UPDATE status=VALUES(status);

-- 7. Nạp Amenities (Tiện ích dùng chung)
INSERT INTO amenities (id, name, capacity, open_time, close_time) VALUES
(1, 'Sân thể thao Pickleball & Tennis ngoài trời', 8, '06:00:00', '22:00:00'),
(2, 'Phòng sinh hoạt cộng đồng Tòa A', 50, '08:00:00', '21:30:00'),
(3, 'Khu vực Vườn nướng BBQ sân thượng Tòa B', 25, '16:00:00', '22:00:00')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 8. Nạp Announcements & Notification Reads
INSERT INTO announcements (id, title, content, created_by, is_ai_generated, target_scope) VALUES
(1, 'THÔNG BÁO TẠM NGỪNG CẤP NƯỚC ĐỂ THAU RỬA BỂ NGẦM', 'Kính gửi Quý cư dân Tòa Tháp A:\nBan Quản lý xin trân trọng thông báo về kế hoạch thau rửa bể nước ngầm định kỳ nhằm bảo đảm chất lượng nước sinh hoạt.\n- Thời gian: Từ 23h00 ngày 12/09 đến 05h00 ngày 13/09/2026.\n- Phạm vi: Toàn bộ căn hộ Tòa A.\nQuý cư dân vui lòng chủ động tích trữ nước trước khung giờ trên.\nTrân trọng cảm ơn!', 1, 1, 'all'),
(2, 'KẾ HOẠCH DIỄN TẬP PHÒNG CHÁY CHỮA CHÁY (PCCC) NĂM 2026', 'Ban Quản lý phối hợp cùng Đội Cảnh sát PCCC Quận Cầu Giấy tổ chức diễn tập phương án chữa cháy và thoát nạn toàn tòa nhà.\n- Thời gian: 09h00 - 11h00 sáng Thứ Bảy (19/09/2026).\n- Đề nghị cư dân không hoảng loạn khi nghe còi báo cháy trong khung giờ diễn tập.', 1, 0, 'all')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 9. Nạp 15 Điều khoản Nội quy (Kho tri thức cho RAG Chatbot)
INSERT INTO internal_rules (id, title, content, category) VALUES
(1, 'Điều 1: Quy định về giờ giấc thi công, sửa chữa căn hộ gây ồn', 'Các ngày từ Thứ Hai đến Thứ Sáu, các công việc sửa chữa khoan đục gây tiếng ồn chỉ được phép tiến hành từ 08h00 đến 11h30 và từ 14h00 đến 17h00. Nghiêm cấm mọi hành vi thi công gây ồn vào các ngày Thứ Bảy, Chủ Nhật, ngày Lễ Tết và trong khung giờ nghỉ trưa từ 11h30 đến 14h00.', 'Thi công sửa chữa'),
(2, 'Điều 2: Quy định về an toàn Phòng cháy chữa cháy (PCCC) và cấm đốt lửa trần', 'Nghiêm cấm tuyệt đối hành vi đốt vàng mã, nướng than hoa, đốt lửa trần tại ban công, lô gia, hành lang hoặc các khu vực công cộng trong chung cư. Khi đốt vàng mã bắt buộc phải xuống khu lò đốt chuyên dụng của tòa nhà đặt tại góc sân sau.', 'An toàn PCCC'),
(3, 'Điều 3: Quy định về việc nuôi thú cưng, chó mèo trong tòa nhà', 'Cư dân được phép nuôi thú cưng nhưng bắt buộc phải đăng ký với Ban Quản lý và tiêm phòng dại đầy đủ. Khi đưa thú cưng ra ngoài khu vực công cộng (thang máy, hành lang, sân chơi), chó mèo phải được rọ mõm, có dây dắt và chủ nuôi phải mang theo dụng cụ dọn vệ sinh chất thải ngay lập tức.', 'Nuôi thú cưng'),
(4, 'Điều 4: Quy định phân loại và thời gian tập kết rác thải sinh hoạt', 'Rác thải sinh hoạt phải được đóng gói trong túi nilong kín, không rò rỉ nước và thả vào họng thu rác tại phòng rác từng tầng từ 06h00 đến 21h00 hàng ngày. Các loại rác cồng kềnh (xà bần, nệm cũ, đồ gỗ, thùng carton lớn) phải thông báo tổ vệ sinh để chuyển thẳng xuống kho rác tầng hầm, cấm vứt tại hành lang.', 'Vệ sinh rác thải'),
(5, 'Điều 5: Quy định sử dụng và gửi xe tại tầng hầm', 'Phương tiện xe máy, ô tô phải được đỗ đúng vạch kẻ và khu vực quy định theo mã thẻ xe đã đăng ký. Nghiêm cấm hút thuốc lá, nổ máy lâu hoặc sửa xe trong tầng hầm. Vận tốc tối đa trong hầm là 10 km/h.', 'Gửi xe hầm'),
(6, 'Điều 6: Quy định sử dụng thang máy chở khách và thang hàng', 'Thang máy số 1 và số 2 dành riêng cho cư dân chở người. Vận chuyển đồ đạc cồng kềnh, xe đạp, vật liệu xây dựng bắt buộc phải sử dụng thang hàng số 3 và có bọc bảo vệ vách thang. Nghiêm cấm trẻ em dưới 10 tuổi đi thang máy một mình.', 'Sử dụng thang máy'),
(7, 'Điều 7: Quy định giữ gìn an ninh trật tự và hạn chế tiếng ồn ban đêm', 'Sau 22h00 đêm, cư dân phải giữ trật tự chung, không mở loa đài, tivi hoặc hát karaoke âm lượng lớn làm ảnh hưởng đến các căn hộ xung quanh. Mọi hành vi tụ tập gây rối, đánh bạc, sử dụng chất kích thích đều bị nghiêm cấm và báo công an xử lý.', 'An ninh trật tự'),
(8, 'Điều 8: Quy định đăng ký tạm trú và quản lý khách lưu trú qua đêm', 'Chủ hộ có trách nhiệm đăng ký thông tin người lưu trú cho khách ở lại qua đêm quá 24 giờ thông qua Cổng dịch vụ cư dân hoặc khai báo tại bàn lễ tân sảnh tầng 1.', 'Quản lý nhân khẩu'),
(9, 'Điều 9: Quy định sử dụng các tiện ích dùng chung (Sân thể thao, BBQ, phòng cộng đồng)', 'Cư dân phải đặt lịch trước qua ứng dụng quản lý cư dân tối thiểu 2 giờ. Mỗi căn hộ được đặt tối đa 2 giờ/ngày đối với sân Pickleball và phải dọn dẹp sạch sẽ sau khi sử dụng khu vực nướng BBQ.', 'Tiện ích dùng chung'),
(10, 'Điều 10: Quy định thời hạn nộp phí dịch vụ và giải quyết nợ phí', 'Phí dịch vụ quản lý, phí nước và tiền gửi xe hàng tháng phải được thanh toán trước ngày 15 của tháng tiếp theo. Quá ngày 20, BQL sẽ gửi giấy nhắc nợ; quá 30 ngày chưa thanh toán sẽ tạm ngừng cung cấp một số tiện ích đi kèm.', 'Phí dịch vụ'),
(11, 'Điều 11: Quy định giữ gìn vệ sinh chung và bảo vệ cảnh quan ban công', 'Nghiêm cấm vứt tàn thuốc lá, rác thải hoặc hắt nước từ ban công, cửa sổ xuống dưới. Cấm phơi quần áo, chăn màn thò ra ngoài lan can ban công làm mất mỹ quan tòa nhà.', 'Cảnh quan ban công'),
(12, 'Điều 12: Quy định xử lý trường hợp vi phạm nội quy tòa nhà', 'Hành vi vi phạm lần đầu sẽ bị BQL nhắc nhở bằng văn bản hoặc thông báo trên ứng dụng. Vi phạm lần 2 sẽ lập biên bản sự việc và phạt tiền theo quy chế tòa nhà. Vi phạm lần 3 hoặc cố tình tái diễn sẽ chuyển hồ sơ lên chính quyền địa phương.', 'Quy chế xử lý'),
(13, 'Điều 13: Quy định đón tiếp nhân viên giao hàng (Shipper)', 'Nhân viên giao hàng chỉ được phép giao nhận tại sảnh lễ tân tầng 1 hoặc bàn gửi hàng tập trung. Trường hợp giao đồ cồng kềnh lên căn hộ phải xuất trình CCCD tại quầy bảo vệ để đổi thẻ thang máy.', 'Giao nhận hàng hóa'),
(14, 'Điều 14: Quy định quản lý và bàn giao căn hộ cho thuê', 'Chủ hộ khi cho thuê căn hộ phải gửi bản sao hợp đồng thuê và danh sách khách thuê cho Ban Quản lý để cập nhật quyền truy cập ứng dụng và thẻ ra vào tòa nhà.', 'Cho thuê căn hộ'),
(15, 'Điều 15: Đường dây nóng khẩn cấp và kênh hỗ trợ BQL 24/7', 'Đường dây nóng hỗ trợ kỹ thuật và an ninh khẩn cấp trực 24/7: 0901.234.567. Văn phòng Ban Quản lý làm việc từ 08h00 đến 17h30 hàng ngày tại Tầng 1 Tòa Tháp A. Cư dân có thể gửi phản ánh sự cố trực tiếp qua ứng dụng web.', 'Đường dây nóng')
ON DUPLICATE KEY UPDATE title=VALUES(title);
