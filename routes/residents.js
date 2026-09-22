const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// GET /residents - Danh sách cư dân
router.get('/', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { keyword, building_id, role } = req.query;

    let sql = `
      SELECT r.id, r.apartment_id, r.full_name, r.phone, r.email, r.role, r.is_owner,
             a.code AS apartment_number, b.name AS building_name
      FROM residents r
      LEFT JOIN apartments a ON r.apartment_id = a.id
      LEFT JOIN buildings b ON a.building_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      sql += ' AND (r.full_name LIKE ? OR r.phone LIKE ? OR r.email LIKE ? OR a.code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (building_id) {
      sql += ' AND b.id = ?';
      params.push(building_id);
    }
    if (role) {
      sql += ' AND r.role = ?';
      params.push(role);
    }

    sql += ' ORDER BY r.role ASC, a.code ASC, r.full_name ASC';

    const [residents] = await pool.execute(sql, params);
    const [buildings] = await pool.execute('SELECT * FROM buildings ORDER BY id ASC');
    const [apartments] = await pool.execute('SELECT id, code AS apartment_number FROM apartments ORDER BY code ASC');

    const totalResidents = residents.length;
    const ownersCount = residents.filter(r => r.is_owner === 1).length;
    const tenantsCount = residents.filter(r => r.is_owner === 0 && r.role === 'resident').length;

    res.render('admin/residents', {
      title: 'Quản lý Hồ sơ Cư dân & Phân quyền',
      residents,
      buildings,
      apartments,
      filters: { keyword, building_id, role },
      stats: { totalResidents, ownersCount, tenantsCount },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải danh sách cư dân:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải danh sách cư dân' });
  }
});

// POST /residents/add - Thêm mới cư dân / tài khoản (Admin)
router.post('/add', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { full_name, phone, email, apartment_id, is_owner, role, password } = req.body;
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM residents WHERE phone = ? OR (email IS NOT NULL AND email = ?)',
      [phone.trim(), email ? email.trim() : '']
    );
    if (existing.length > 0) {
      return res.redirect('/residents?error=Số điện thoại hoặc Email này đã tồn tại trong hệ thống!');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password || 'cudan123', salt);

    await pool.execute(
      `INSERT INTO residents (apartment_id, full_name, phone, email, role, is_owner, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        apartment_id || null,
        full_name.trim(),
        phone.trim(),
        email ? email.trim() : null,
        role || 'resident',
        is_owner ? 1 : 0,
        password_hash
      ]
    );

    if (apartment_id) {
      await pool.execute("UPDATE apartments SET status = 'occupied' WHERE id = ?", [apartment_id]);
    }

    res.redirect('/residents?success=Đã thêm cư dân ' + full_name + ' thành công! Mật khẩu mặc định: ' + (password || 'cudan123'));
  } catch (err) {
    console.error('Lỗi thêm cư dân:', err);
    res.redirect('/residents?error=Lỗi khi thêm: ' + err.message);
  }
});

// POST /residents/:id/update - Cập nhật thông tin cư dân
router.post('/:id/update', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, email, apartment_id, is_owner, role } = req.body;

  try {
    await pool.execute(
      `UPDATE residents 
       SET full_name = ?, phone = ?, email = ?, apartment_id = ?, is_owner = ?, role = ?
       WHERE id = ?`,
      [
        full_name.trim(),
        phone.trim(),
        email ? email.trim() : null,
        apartment_id || null,
        is_owner ? 1 : 0,
        role,
        id
      ]
    );

    res.redirect('/residents?success=Đã cập nhật thông tin cư dân!');
  } catch (err) {
    console.error('Lỗi cập nhật cư dân:', err);
    res.redirect('/residents?error=Lỗi cập nhật: ' + err.message);
  }
});

// POST /residents/:id/reset-password - Đặt lại mật khẩu mặc định (cudan123)
router.post('/:id/reset-password', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('cudan123', salt);
    await pool.execute('UPDATE residents SET password_hash = ? WHERE id = ?', [hash, id]);
    res.redirect('/residents?success=Đã đặt lại mật khẩu về cudan123!');
  } catch (err) {
    console.error('Lỗi reset mật khẩu:', err);
    res.redirect('/residents?error=Lỗi reset mật khẩu');
  }
});

module.exports = router;
