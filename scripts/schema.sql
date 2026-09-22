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
