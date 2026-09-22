const mysql = require('mysql2/promise');
require('dotenv').config();

const DDL_STATEMENTS = [
  // 1. BUILDINGS
  `CREATE TABLE IF NOT EXISTS buildings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    num_floors INT NOT NULL DEFAULT 1
  ) ENGINE=InnoDB;`,

  // 2. APARTMENTS
  `CREATE TABLE IF NOT EXISTS apartments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    floor INT NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    area DECIMAL(6,2) NOT NULL,
    status ENUM('vacant','occupied','rented') NOT NULL DEFAULT 'vacant',
    CONSTRAINT fk_apartments_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 3. RESIDENTS
  `CREATE TABLE IF NOT EXISTS residents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    apartment_id INT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NULL UNIQUE,
    role ENUM('admin','accountant','resident') NOT NULL DEFAULT 'resident',
    is_owner TINYINT(1) NOT NULL DEFAULT 0,
    password_hash VARCHAR(255) NOT NULL,
    CONSTRAINT fk_residents_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL
  ) ENGINE=InnoDB;`,

  // 4. FEEDBACKS
  `CREATE TABLE IF NOT EXISTS feedbacks (
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
  ) ENGINE=InnoDB;`,

  // 5. AMENITIES
  `CREATE TABLE IF NOT EXISTS amenities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 20,
    open_time TIME NOT NULL DEFAULT '06:00:00',
    close_time TIME NOT NULL DEFAULT '22:00:00'
  ) ENGINE=InnoDB;`,

  // 6. AMENITY_BOOKINGS
  `CREATE TABLE IF NOT EXISTS amenity_bookings (
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
  ) ENGINE=InnoDB;`,

  // 7. ANNOUNCEMENTS
  `CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    created_by INT NOT NULL,
    is_ai_generated TINYINT(1) NOT NULL DEFAULT 0,
    target_scope VARCHAR(100) NOT NULL DEFAULT 'all',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_announcements_creator FOREIGN KEY (created_by) REFERENCES residents(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB;`,

  // 8. NOTIFICATION_READS
  `CREATE TABLE IF NOT EXISTS notification_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT NOT NULL,
    resident_id INT NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_resident FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,

  // 9. FEE_TYPES
  `CREATE TABLE IF NOT EXISTS fee_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(30) NOT NULL
  ) ENGINE=InnoDB;`,

  // 10. FEE_TRANSACTIONS
  `CREATE TABLE IF NOT EXISTS fee_transactions (
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
  ) ENGINE=InnoDB;`,

  // 11. INTERNAL_RULES
  `CREATE TABLE IF NOT EXISTS internal_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Nội quy chung',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FULLTEXT INDEX ft_rules (title, content)
  ) ENGINE=InnoDB;`
];

async function initDb() {
  console.log('Connecting to MySQL host:', process.env.DB_HOST || '127.0.0.1');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    charset: 'utf8mb4'
  });

  try {
    await connection.query('CREATE DATABASE IF NOT EXISTS apartment_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await connection.query('USE apartment_management;');
    console.log('Database apartment_management selected.');

    for (let i = 0; i < DDL_STATEMENTS.length; i++) {
      await connection.query(DDL_STATEMENTS[i]);
      console.log(`[${i + 1}/${DDL_STATEMENTS.length}] Created table.`);
    }

    const [tables] = await connection.query('SHOW TABLES;');
    console.log(`\nAll ${tables.length} tables verified successfully in database:`);
    tables.forEach(t => console.log(' - ' + Object.values(t)[0]));
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

initDb();
