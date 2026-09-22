const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// GET /apartments - Danh sách căn hộ
router.get('/', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { building_id, status, floor, keyword } = req.query;

    let sql = `
      SELECT a.id, a.building_id, a.floor, a.code AS apartment_number, a.area, a.status,
             b.name AS building_name,
             COUNT(r.id) AS resident_count,
             (SELECT full_name FROM residents WHERE apartment_id = a.id AND is_owner = 1 LIMIT 1) AS owner_name,
             (SELECT phone FROM residents WHERE apartment_id = a.id AND is_owner = 1 LIMIT 1) AS owner_phone
      FROM apartments a
      JOIN buildings b ON a.building_id = b.id
      LEFT JOIN residents r ON a.id = r.apartment_id
      WHERE 1=1
    `;
    const params = [];

    if (building_id) {
      sql += ' AND a.building_id = ?';
      params.push(building_id);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (floor) {
      sql += ' AND a.floor = ?';
      params.push(floor);
    }
    if (keyword) {
      sql += ' AND a.code LIKE ?';
      params.push(`%${keyword}%`);
    }

    sql += ' GROUP BY a.id, b.name ORDER BY a.building_id ASC, a.floor ASC, a.code ASC';

    const [apartments] = await pool.execute(sql, params);
    const [buildings] = await pool.execute('SELECT * FROM buildings ORDER BY id ASC');

    const totalApartments = apartments.length;
    const occupiedCount = apartments.filter(a => a.status === 'occupied').length;
    const vacantCount = apartments.filter(a => a.status === 'vacant').length;
    const maintenanceCount = apartments.filter(a => a.status === 'rented').length;

    res.render('admin/apartments', {
      title: 'Quản lý Căn hộ - BQL Chung cư',
      apartments,
      buildings,
      filters: { building_id, status, floor, keyword },
      stats: { totalApartments, occupiedCount, vacantCount, maintenanceCount },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải danh sách căn hộ:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải danh sách căn hộ' });
  }
});

// POST /apartments/add - Thêm mới căn hộ (Admin)
router.post('/add', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { building_id, apartment_number, floor, area, status } = req.body;
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM apartments WHERE code = ?',
      [apartment_number.trim()]
    );
    if (existing.length > 0) {
      return res.redirect('/apartments?error=Số căn hộ này đã tồn tại trong hệ thống!');
    }

    await pool.execute(
      `INSERT INTO apartments (building_id, floor, code, area, status)
       VALUES (?, ?, ?, ?, ?)`,
      [building_id, floor, apartment_number.trim(), area || 70.0, status || 'vacant']
    );

    res.redirect('/apartments?success=Đã thêm căn hộ ' + apartment_number + ' thành công!');
  } catch (err) {
    console.error('Lỗi thêm căn hộ:', err);
    res.redirect('/apartments?error=Lỗi khi thêm căn hộ: ' + err.message);
  }
});

// POST /apartments/:id/update - Cập nhật thông tin căn hộ
router.post('/:id/update', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { area, status } = req.body;
  try {
    await pool.execute(
      `UPDATE apartments SET area = ?, status = ? WHERE id = ?`,
      [area, status, id]
    );
    res.redirect('/apartments?success=Đã cập nhật thông tin căn hộ!');
  } catch (err) {
    console.error('Lỗi cập nhật căn hộ:', err);
    res.redirect('/apartments?error=Lỗi cập nhật: ' + err.message);
  }
});

module.exports = router;
