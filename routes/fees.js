const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// GET /fees - Quản lý thu phí & hóa đơn
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const { status, billing_month, fee_type_id, keyword } = req.query;

    let sql = `
      SELECT ft.id, ft.apartment_id, ft.fee_type_id, ft.period AS billing_month, ft.amount, ft.status, ft.paid_at,
             a.code AS apartment_number, b.name AS building_name, ftype.name AS fee_name, ftype.unit,
             r.full_name AS resident_name, r.phone AS resident_phone
      FROM fee_transactions ft
      JOIN apartments a ON ft.apartment_id = a.id
      JOIN buildings b ON a.building_id = b.id
      JOIN fee_types ftype ON ft.fee_type_id = ftype.id
      LEFT JOIN residents r ON a.id = r.apartment_id AND r.is_owner = 1
      WHERE 1=1
    `;
    const params = [];

    // Nếu là Resident: chỉ xem phí của căn hộ mình
    if (user.role === 'resident') {
      if (!user.apartment_id) {
        return res.render('resident/fees', {
          title: 'Khoản phí Căn hộ',
          transactions: [],
          feeTypes: [],
          stats: { totalAmount: 0, unpaidAmount: 0, paidAmount: 0 },
          message: 'Tài khoản của bạn chưa được liên kết với căn hộ nào.'
        });
      }
      sql += ' AND ft.apartment_id = ?';
      params.push(user.apartment_id);
    } else {
      // Admin hoặc Accountant
      if (status) {
        sql += ' AND ft.status = ?';
        params.push(status);
      }
      if (billing_month) {
        sql += ' AND ft.period = ?';
        params.push(billing_month);
      }
      if (fee_type_id) {
        sql += ' AND ft.fee_type_id = ?';
        params.push(fee_type_id);
      }
      if (keyword) {
        sql += ' AND (a.code LIKE ? OR r.full_name LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
    }

    sql += ' ORDER BY ft.period DESC, ft.status ASC, a.code ASC';

    const [transactions] = await pool.execute(sql, params);
    const [feeTypes] = await pool.execute('SELECT id, name, unit_price AS price_per_unit, unit FROM fee_types ORDER BY id ASC');

    // Tính toán thống kê
    let totalAmount = 0;
    let unpaidAmount = 0;
    let paidAmount = 0;
    transactions.forEach(t => {
      const amt = Number(t.amount);
      totalAmount += amt;
      if (t.status === 'paid') paidAmount += amt;
      else unpaidAmount += amt;
    });

    if (user.role === 'resident') {
      return res.render('resident/fees', {
        title: 'Tra cứu & Thanh toán Phí Căn hộ - ' + (user.apartment_number || ''),
        transactions,
        feeTypes,
        stats: { totalAmount, unpaidAmount, paidAmount },
        success: req.query.success || null,
        error: req.query.error || null
      });
    }

    // Giao diện cho Kế toán & Quản trị viên
    res.render('accountant/fees', {
      title: 'Quản lý Tài chính & Thu phí Chung cư',
      transactions,
      feeTypes,
      filters: { status, billing_month, fee_type_id, keyword },
      stats: { totalAmount, unpaidAmount, paidAmount, count: transactions.length },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải danh sách phí:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải danh sách hóa đơn thu phí' });
  }
});

// POST /fees/settle/:id - Gạch nợ hóa đơn
router.post('/settle/:id', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute(
      `UPDATE fee_transactions 
       SET status = 'paid', paid_at = NOW() 
       WHERE id = ?`,
      [id]
    );
    res.redirect('/fees?success=Đã gạch nợ thành công cho hóa đơn #' + id);
  } catch (err) {
    console.error('Lỗi gạch nợ:', err);
    res.redirect('/fees?error=Lỗi khi gạch nợ: ' + err.message);
  }
});

// POST /fees/pay/:id - Cư dân thanh toán
router.post('/pay/:id', isAuthenticated, requireRole('resident'), async (req, res) => {
  const { id } = req.params;
  const user = req.session.user;
  try {
    const [rows] = await pool.execute(
      'SELECT id, amount, status FROM fee_transactions WHERE id = ? AND apartment_id = ?',
      [id, user.apartment_id]
    );
    if (rows.length === 0) {
      return res.redirect('/fees?error=Hóa đơn không hợp lệ');
    }

    await pool.execute(
      `UPDATE fee_transactions 
       SET status = 'paid', paid_at = NOW() 
       WHERE id = ?`,
      [id]
    );
    res.redirect('/fees?success=Thanh toán trực tuyến thành công cho hóa đơn #' + id + '! Cảm ơn bạn.');
  } catch (err) {
    console.error('Lỗi cư dân thanh toán:', err);
    res.redirect('/fees?error=Lỗi thanh toán: ' + err.message);
  }
});

// POST /fees/generate-monthly - Tự động phát sinh kỳ phí hàng tháng
router.post('/generate-monthly', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  const { billing_month } = req.body; // YYYY-MM
  if (!billing_month || !/^\d{4}-\d{2}$/.test(billing_month)) {
    return res.redirect('/fees?error=Vui lòng chọn tháng thu phí hợp lệ (Định dạng YYYY-MM)');
  }

  try {
    const [apartments] = await pool.execute("SELECT id, area, code FROM apartments WHERE status = 'occupied'");
    const [serviceFeeType] = await pool.execute("SELECT id, unit_price FROM fee_types WHERE name LIKE '%dịch vụ%' LIMIT 1");

    if (apartments.length === 0) {
      return res.redirect('/fees?error=Không có căn hộ nào đang có cư dân sinh sống.');
    }

    const feeTypeId = serviceFeeType.length > 0 ? serviceFeeType[0].id : 1;
    const pricePerM2 = serviceFeeType.length > 0 ? Number(serviceFeeType[0].unit_price) : 12000;

    let createdCount = 0;
    for (const apt of apartments) {
      const [ex] = await pool.execute(
        'SELECT id FROM fee_transactions WHERE apartment_id = ? AND fee_type_id = ? AND period = ?',
        [apt.id, feeTypeId, billing_month]
      );
      if (ex.length === 0) {
        const area = Number(apt.area) || 70;
        const totalAmount = area * pricePerM2;
        await pool.execute(
          `INSERT INTO fee_transactions (apartment_id, fee_type_id, period, amount, status)
           VALUES (?, ?, ?, ?, 'unpaid')`,
          [apt.id, feeTypeId, billing_month, totalAmount]
        );
        createdCount++;
      }
    }

    res.redirect(`/fees?billing_month=${billing_month}&success=Đã tạo thành công ${createdCount} hóa đơn phí quản lý dịch vụ cho tháng ${billing_month}!`);
  } catch (err) {
    console.error('Lỗi phát sinh hóa đơn tự động:', err);
    res.redirect('/fees?error=Lỗi khi phát sinh kỳ phí: ' + err.message);
  }
});

// GET /fees/types - Quản lý biểu phí
router.get('/types', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const [feeTypes] = await pool.execute('SELECT id, name, unit_price AS price_per_unit, unit FROM fee_types ORDER BY id ASC');
    res.render('accountant/fee-types', {
      title: 'Quản lý Biểu phí & Đơn giá Dịch vụ',
      feeTypes,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải biểu phí:', err);
    res.redirect('/fees?error=Không thể tải biểu phí');
  }
});

// POST /fees/types/update - Cập nhật đơn giá
router.post('/types/update', isAuthenticated, requireRole('admin', 'accountant'), async (req, res) => {
  const { id, price_per_unit } = req.body;
  try {
    await pool.execute(
      'UPDATE fee_types SET unit_price = ? WHERE id = ?',
      [price_per_unit, id]
    );
    res.redirect('/fees/types?success=Đã cập nhật đơn giá dịch vụ thành công!');
  } catch (err) {
    console.error('Lỗi cập nhật đơn giá:', err);
    res.redirect('/fees/types?error=Lỗi cập nhật: ' + err.message);
  }
});

module.exports = router;
