/**
 * 16 RESTful API Endpoints Cốt Lõi
 * Đáp ứng chính xác 100% Bảng 30 trong Báo cáo Đồ án Nhóm 25
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const aiAssistant = require('../services/aiAssistant');
const { calculateServiceFee, calculateWaterFee } = require('../services/feeCalculator');
const { checkConflict } = require('../services/bookingValidator');

// Middleware xác thực phiên đơn giản cho API
function apiAuth(roles = []) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập (401 Unauthorized)' });
    }
    if (roles.length > 0 && !roles.includes(req.session.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập (403 Forbidden)' });
    }
    next();
  };
}

// API-01: POST /api/auth/login (Public)
router.post('/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng nhập' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT r.*, a.code AS apartment_number, b.name AS building_name
       FROM residents r
       LEFT JOIN apartments a ON r.apartment_id = a.id
       LEFT JOIN buildings b ON a.building_id = b.id
       WHERE r.phone = ? OR r.email = ? LIMIT 1`,
      [identifier.trim(), identifier.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác' });
    }

    req.session.user = {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      apartment_id: user.apartment_id,
      apartment_number: user.apartment_number,
      building_name: user.building_name,
      is_owner: user.is_owner
    };

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: req.session.user
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-02: POST /api/auth/logout (All Authenticated)
router.post('/auth/logout', apiAuth(), (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Đã đăng xuất thành công' });
});

// API-03: GET /api/apartments (Admin, Accountant)
router.get('/apartments', apiAuth(['admin', 'accountant']), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT a.id, a.code, a.floor, a.area, a.status, b.name AS building_name,
             (SELECT full_name FROM residents WHERE apartment_id = a.id AND is_owner = 1 LIMIT 1) AS owner_name
      FROM apartments a
      JOIN buildings b ON a.building_id = b.id
      ORDER BY a.building_id ASC, a.floor ASC, a.code ASC
    `);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-04: POST /api/apartments (Admin)
router.post('/apartments', apiAuth(['admin']), async (req, res) => {
  const { building_id, floor, code, area, status } = req.body;
  try {
    const [result] = await pool.execute(
      `INSERT INTO apartments (building_id, floor, code, area, status) VALUES (?, ?, ?, ?, ?)`,
      [building_id || 1, floor, code, area || 70, status || 'vacant']
    );
    res.status(201).json({ success: true, message: 'Đã thêm căn hộ thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-05: GET /api/apartments/:id/residents (Admin, Accountant)
router.get('/apartments/:id/residents', apiAuth(['admin', 'accountant']), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, full_name, phone, email, role, is_owner FROM residents WHERE apartment_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-06: POST /api/residents (Admin)
router.post('/residents', apiAuth(['admin']), async (req, res) => {
  const { apartment_id, full_name, phone, email, role, is_owner, password } = req.body;
  try {
    const hash = await bcrypt.hash(password || 'cudan123', 10);
    const [result] = await pool.execute(
      `INSERT INTO residents (apartment_id, full_name, phone, email, role, is_owner, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [apartment_id || null, full_name, phone, email || null, role || 'resident', is_owner ? 1 : 0, hash]
    );
    res.status(201).json({ success: true, message: 'Đã thêm cư dân thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-07: GET /api/fees/current (Accountant, Admin)
router.get('/fees/current', apiAuth(['admin', 'accountant']), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.id, t.period, t.amount, t.status, t.paid_at,
             a.code AS apartment_number, ft.name AS fee_name
      FROM fee_transactions t
      JOIN apartments a ON t.apartment_id = a.id
      JOIN fee_types ft ON t.fee_type_id = ft.id
      ORDER BY t.period DESC, t.id DESC LIMIT 50
    `);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-08: POST /api/fees/generate (Accountant)
router.post('/fees/generate', apiAuth(['accountant', 'admin']), async (req, res) => {
  const { period } = req.body;
  if (!period) return res.status(400).json({ success: false, message: 'Thiếu kỳ phí (YYYY-MM)' });

  try {
    const [apartments] = await pool.execute("SELECT id, area FROM apartments WHERE status = 'occupied'");
    const [feeType] = await pool.execute("SELECT id, unit_price FROM fee_types WHERE name LIKE '%dịch vụ%' LIMIT 1");
    const feeTypeId = feeType.length > 0 ? feeType[0].id : 1;
    const unitPrice = feeType.length > 0 ? Number(feeType[0].unit_price) : 12000;

    let created = 0;
    for (const apt of apartments) {
      const [ex] = await pool.execute(
        'SELECT id FROM fee_transactions WHERE apartment_id = ? AND fee_type_id = ? AND period = ?',
        [apt.id, feeTypeId, period]
      );
      if (ex.length === 0) {
        const amount = calculateServiceFee(apt.area, unitPrice);
        await pool.execute(
          `INSERT INTO fee_transactions (apartment_id, fee_type_id, period, amount, status)
           VALUES (?, ?, ?, ?, 'unpaid')`,
          [apt.id, feeTypeId, period, amount]
        );
        created++;
      }
    }
    res.json({ success: true, message: `Đã phát sinh thành công ${created} hóa đơn cho kỳ ${period}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-09: PUT /api/fees/:id/settle (Accountant)
router.put('/fees/:id/settle', apiAuth(['accountant', 'admin']), async (req, res) => {
  try {
    await pool.execute(
      "UPDATE fee_transactions SET status = 'paid', paid_at = NOW() WHERE id = ?",
      [req.params.id]
    );
    res.json({ success: true, message: `Đã gạch nợ thành công hóa đơn #${req.params.id}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-10: GET /api/feedbacks (Admin, Resident)
router.get('/feedbacks', apiAuth(), async (req, res) => {
  const user = req.session.user;
  try {
    let sql = `
      SELECT f.id, f.category, f.title, f.content, f.status, f.created_at,
             a.code AS apartment_number, r.full_name AS resident_name
      FROM feedbacks f
      JOIN residents r ON f.resident_id = r.id
      LEFT JOIN apartments a ON f.apartment_id = a.id
    `;
    const params = [];
    if (user.role === 'resident') {
      sql += ' WHERE f.resident_id = ?';
      params.push(user.id);
    }
    sql += ' ORDER BY f.created_at DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-11: POST /api/feedbacks (Resident)
router.post('/feedbacks', apiAuth(['resident']), async (req, res) => {
  const { title, content, category } = req.body;
  const user = req.session.user;
  if (!title || !content) return res.status(400).json({ success: false, message: 'Thiếu thông tin' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO feedbacks (apartment_id, resident_id, category, title, content, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [user.apartment_id || 1, user.id, category || 'Khác', title, content]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('new_feedback_alert', {
        resident_name: user.full_name,
        apartment_number: user.apartment_number,
        title: title.trim(),
        category: category || 'Khác'
      });
    }

    res.status(201).json({ success: true, message: 'Đã gửi phản ánh thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-12: PUT /api/feedbacks/:id/status (Admin)
router.put('/feedbacks/:id/status', apiAuth(['admin']), async (req, res) => {
  const { status } = req.body;
  try {
    await pool.execute('UPDATE feedbacks SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `Đã cập nhật phản ánh #${req.params.id} sang trạng thái ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-13: POST /api/amenities/book (Resident)
router.post('/amenities/book', apiAuth(['resident', 'admin']), async (req, res) => {
  const { amenity_id, booking_date, start_time, end_time } = req.body;
  const user = req.session.user;

  try {
    // Gọi module bookingValidator kiểm tra chống trùng lịch
    const conflict = await checkConflict({ amenity_id, booking_date, start_time, end_time });
    if (conflict.hasConflict) {
      return res.status(409).json({
        success: false,
        message: `Khung giờ ${start_time} - ${end_time} ngày ${booking_date} đã có người đặt trước.`
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO amenity_bookings (amenity_id, resident_id, booking_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      [amenity_id, user.id, booking_date, start_time, end_time]
    );

    res.status(201).json({ success: true, message: 'Đặt tiện ích thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-14: POST /api/announcements (Admin)
router.post('/announcements', apiAuth(['admin']), async (req, res) => {
  const { title, content, target_scope } = req.body;
  const user = req.session.user;

  try {
    const [result] = await pool.execute(
      `INSERT INTO announcements (title, content, target_scope, created_by, is_ai_generated)
       VALUES (?, ?, ?, ?, 0)`,
      [title, content, target_scope || 'all', user.id]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('new_announcement', {
        id: result.insertId,
        title,
        content: content.substring(0, 100) + '...',
        target_scope: target_scope || 'all'
      });
    }

    res.status(201).json({ success: true, message: 'Đã phát hành thông báo thành công', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-15: POST /api/ai/generate-announcement (Admin) - Đúng mẫu Bảng 31
router.post('/ai/generate-announcement', apiAuth(['admin']), async (req, res) => {
  const { event_type, start_time, end_time, affected_scope, note } = req.body;
  const event_time = start_time && end_time ? `Từ ${start_time} đến ${end_time}` : (start_time || end_time);

  try {
    const result = await aiAssistant.generateAnnouncement({
      event_type,
      event_time,
      target_scope: affected_scope,
      note
    });

    res.json({
      success: true,
      data: {
        title: result.content.split('\n')[0].replace(/^[#*\s]+/, ''),
        summary: `Thông báo về ${event_type}`,
        content: result.content,
        urgency: 'important'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API-16: POST /api/ai/rag-chatbot (Resident, All)
router.post('/ai/rag-chatbot', apiAuth(), async (req, res) => {
  const { message } = req.body;
  try {
    const result = await aiAssistant.answerRulesRAG(message);
    res.json({
      success: true,
      data: {
        answer: result.answer,
        citations: result.matchedRules,
        source: result.source
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
