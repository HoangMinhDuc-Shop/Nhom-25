const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// Root redirect
router.get('/', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login');
  }
  const role = req.session.user.role;
  if (role === 'admin') return res.redirect('/admin/dashboard');
  if (role === 'accountant') return res.redirect('/accountant/dashboard');
  return res.redirect('/resident/home');
});

// GET /admin/dashboard - Tổng quan Ban Quản Lý
router.get('/admin/dashboard', isAuthenticated, requireRole('admin'), async (req, res) => {
  try {
    // 1. Thống kê căn hộ
    const [aptStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
        SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) AS vacant,
        SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) AS maintenance
      FROM apartments
    `);

    // 2. Thống kê cư dân
    const [resStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN is_owner = 1 THEN 1 ELSE 0 END) AS owners,
        SUM(CASE WHEN is_owner = 0 AND role = 'resident' THEN 1 ELSE 0 END) AS tenants
      FROM residents
    `);

    // 3. Thống kê tài chính
    const [feeStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) AS unpaid_amount,
        0 AS overdue_amount
      FROM fee_transactions
    `);

    // 4. Thống kê phản ánh
    const [feedbackStats] = await pool.execute(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved
      FROM feedbacks
    `);

    // 5. Phản ánh mới nhất
    const [recentFeedbacks] = await pool.execute(`
      SELECT f.id, f.category, f.title, f.content, f.status, f.created_at,
             r.full_name AS resident_name, a.code AS apartment_number
      FROM feedbacks f
      JOIN residents r ON f.resident_id = r.id
      LEFT JOIN apartments a ON f.apartment_id = a.id
      ORDER BY f.created_at DESC LIMIT 5
    `);

    // 6. Thông báo mới nhất
    const [recentAnnouncements] = await pool.execute(`
      SELECT a.id, a.title, a.content, a.target_scope, a.created_at,
             r.full_name AS author_name
      FROM announcements a
      JOIN residents r ON a.created_by = r.id
      ORDER BY a.created_at DESC LIMIT 4
    `);

    res.render('admin/dashboard', {
      title: 'Bảng Điều Khiển Ban Quản Lý (Admin Dashboard)',
      user: req.session.user,
      apt: aptStats[0],
      resCount: resStats[0],
      fee: feeStats[0],
      fb: feedbackStats[0],
      recentFeedbacks,
      recentAnnouncements
    });
  } catch (err) {
    console.error('Lỗi tải Admin Dashboard:', err);
    res.status(500).render('error', { title: 'Lỗi', message: 'Không thể tải bảng điều khiển quản trị: ' + err.message });
  }
});

// GET /accountant/dashboard - Tổng quan Kế toán & Tài chính
router.get('/accountant/dashboard', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().substring(0, 7);

    // 1. Doanh thu toàn bộ
    const [financeStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) AS total_receivable,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_collected,
        COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) AS total_unpaid,
        0 AS total_overdue
      FROM fee_transactions
    `);

    // 2. Thống kê theo loại phí
    const [feesByType] = await pool.execute(`
      SELECT ft.name, COALESCE(SUM(t.amount), 0) AS total_amount,
             COALESCE(SUM(CASE WHEN t.status = 'paid' THEN t.amount ELSE 0 END), 0) AS paid_amount
      FROM fee_transactions t
      JOIN fee_types ft ON t.fee_type_id = ft.id
      GROUP BY ft.id, ft.name
    `);

    // 3. Hóa đơn chưa thanh toán mới nhất
    const [unpaidBills] = await pool.execute(`
      SELECT t.id, t.period AS billing_month, t.amount, t.status,
             a.code AS apartment_number, ft.name AS fee_name, r.full_name AS resident_name, r.phone AS resident_phone
      FROM fee_transactions t
      JOIN apartments a ON t.apartment_id = a.id
      JOIN fee_types ft ON t.fee_type_id = ft.id
      LEFT JOIN residents r ON a.id = r.apartment_id AND r.is_owner = 1
      WHERE t.status = 'unpaid'
      ORDER BY t.period DESC, t.amount DESC
      LIMIT 10
    `);

    res.render('accountant/dashboard', {
      title: 'Bảng Điều Khiển Kế Toán & Quản Lý Thu Chi',
      user: req.session.user,
      currentMonth,
      finance: financeStats[0],
      feesByType,
      unpaidBills
    });
  } catch (err) {
    console.error('Lỗi tải Accountant Dashboard:', err);
    res.status(500).render('error', { title: 'Lỗi', message: 'Không thể tải bảng điều khiển kế toán: ' + err.message });
  }
});

// GET /resident/home - Cổng thông tin Cư dân
router.get('/resident/home', isAuthenticated, async (req, res) => {
  const user = req.session.user;
  try {
    let myUnpaidFees = [];
    let myUnpaidTotal = 0;
    if (user.apartment_id) {
      const [feeRows] = await pool.execute(
        `SELECT t.id, t.period AS billing_month, t.amount, t.status, ft.name AS fee_name
         FROM fee_transactions t
         JOIN fee_types ft ON t.fee_type_id = ft.id
         WHERE t.apartment_id = ? AND t.status = 'unpaid'
         ORDER BY t.period DESC`,
        [user.apartment_id]
      );
      myUnpaidFees = feeRows;
      myUnpaidTotal = feeRows.reduce((sum, item) => sum + Number(item.amount), 0);
    }

    const [announcements] = await pool.execute(
      `SELECT a.id, a.title, a.content, a.target_scope, a.created_at,
              r.full_name AS author_name,
              (SELECT COUNT(*) FROM notification_reads nr WHERE nr.announcement_id = a.id AND nr.resident_id = ?) AS is_read
       FROM announcements a
       JOIN residents r ON a.created_by = r.id
       ORDER BY a.created_at DESC LIMIT 5`,
      [user.id]
    );

    const [myFeedbacks] = await pool.execute(
      `SELECT * FROM feedbacks WHERE resident_id = ? ORDER BY created_at DESC LIMIT 4`,
      [user.id]
    );

    const [myBookings] = await pool.execute(
      `SELECT b.id, b.booking_date, 
              TIME_FORMAT(b.start_time, '%H:%i') AS start_time, 
              TIME_FORMAT(b.end_time, '%H:%i') AS end_time, 
              b.status, a.name AS amenity_name
       FROM amenity_bookings b
       JOIN amenities a ON b.amenity_id = a.id
       WHERE b.resident_id = ? AND b.booking_date >= CURDATE() AND b.status != 'cancelled'
       ORDER BY b.booking_date ASC LIMIT 3`,
      [user.id]
    );

    res.render('resident/home', {
      title: 'Cổng Thông Tin Cư Dân - SmartBuilding AI',
      user,
      myUnpaidFees,
      myUnpaidTotal,
      announcements,
      myFeedbacks,
      myBookings
    });
  } catch (err) {
    console.error('Lỗi tải Resident Home:', err);
    res.status(500).render('error', { title: 'Lỗi', message: 'Không thể tải cổng thông tin cư dân: ' + err.message });
  }
});

module.exports = router;
