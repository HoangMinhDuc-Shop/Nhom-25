const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
    if (req.session.user.role === 'accountant') return res.redirect('/accountant/dashboard');
    return res.redirect('/resident/home');
  }
  res.render('auth/login', {
    title: 'Đăng nhập - Hệ thống Quản lý Chung cư',
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// POST /auth/login - Xác thực đăng nhập nghiêm ngặt với bcrypt
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.redirect('/auth/login?error=Vui lòng nhập đầy đủ Số điện thoại/Email và Mật khẩu');
  }

  try {
    const [rows] = await pool.execute(
      `SELECT r.*, a.code AS apartment_number, b.name AS building_name 
       FROM residents r 
       LEFT JOIN apartments a ON r.apartment_id = a.id 
       LEFT JOIN buildings b ON a.building_id = b.id 
       WHERE (r.phone = ? OR r.email = ?) 
       LIMIT 1`,
      [identifier.trim(), identifier.trim()]
    );

    if (rows.length === 0) {
      return res.redirect('/auth/login?error=Tài khoản không tồn tại hoặc đã bị khóa!');
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.redirect('/auth/login?error=Mật khẩu không chính xác!');
    }

    // Lưu phiên đăng nhập bảo mật
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

    if (user.role === 'admin') return res.redirect('/admin/dashboard');
    if (user.role === 'accountant') return res.redirect('/accountant/dashboard');
    return res.redirect('/resident/home');
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    return res.redirect('/auth/login?error=Lỗi hệ thống khi xử lý đăng nhập');
  }
});

// GET /auth/logout - Hủy phiên đăng nhập
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Lỗi hủy session:', err);
    res.redirect('/auth/login?success=Đã đăng xuất thành công!');
  });
});

module.exports = router;
