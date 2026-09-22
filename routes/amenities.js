const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// GET /amenities - Xem danh sách tiện ích & lịch đặt
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;

    const [amenities] = await pool.execute(`
      SELECT id, name, capacity, open_time, close_time,
             CONCAT(TIME_FORMAT(open_time, '%H:%i'), ' - ', TIME_FORMAT(close_time, '%H:%i')) AS opening_hours,
             'open' AS status,
             0 AS price_per_hour,
             'Tiện ích chất lượng cao phục vụ miễn phí cho toàn thể cư dân' AS description
      FROM amenities ORDER BY id ASC
    `);

    let bookingsSql = `
      SELECT b.id, b.amenity_id, b.resident_id, b.booking_date, 
             TIME_FORMAT(b.start_time, '%H:%i') AS start_time, 
             TIME_FORMAT(b.end_time, '%H:%i') AS end_time, 
             b.status, 0 AS total_price,
             a.name AS amenity_name, r.full_name AS resident_name, apt.code AS apartment_number
      FROM amenity_bookings b
      JOIN amenities a ON b.amenity_id = a.id
      JOIN residents r ON b.resident_id = r.id
      LEFT JOIN apartments apt ON r.apartment_id = apt.id
      WHERE 1=1
    `;
    const params = [];

    if (user.role === 'resident') {
      bookingsSql += ' AND (b.resident_id = ? OR b.booking_date >= CURDATE())';
      params.push(user.id);
    }

    bookingsSql += ' ORDER BY b.booking_date DESC, b.start_time ASC LIMIT 50';

    const [bookings] = await pool.execute(bookingsSql, params);

    res.render('resident/amenities', {
      title: 'Đăng ký & Sử dụng Tiện ích Chung cư',
      amenities,
      bookings,
      user,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải tiện ích:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải danh sách tiện ích' });
  }
});

// POST /amenities/book - Đăng ký tiện ích có kiểm tra xung đột thời gian (Conflict Detection)
router.post('/book', isAuthenticated, async (req, res) => {
  const { amenity_id, booking_date, start_time, end_time } = req.body;
  const user = req.session.user;

  if (!amenity_id || !booking_date || !start_time || !end_time) {
    return res.redirect('/amenities?error=Vui lòng điền đầy đủ ngày và khung giờ đặt');
  }

  if (start_time >= end_time) {
    return res.redirect('/amenities?error=Giờ kết thúc phải lớn hơn giờ bắt đầu');
  }

  try {
    const [amenityRows] = await pool.execute('SELECT * FROM amenities WHERE id = ?', [amenity_id]);
    if (amenityRows.length === 0) {
      return res.redirect('/amenities?error=Tiện ích không tồn tại');
    }
    const amenity = amenityRows[0];

    // Kiểm tra xung đột lịch đặt
    const [conflictRows] = await pool.execute(
      `SELECT id, start_time, end_time FROM amenity_bookings 
       WHERE amenity_id = ? 
         AND booking_date = ? 
         AND status != 'cancelled'
         AND (start_time < ? AND end_time > ?)`,
      [amenity_id, booking_date, end_time, start_time]
    );

    if (conflictRows.length > 0) {
      return res.redirect(
        `/amenities?error=Khung giờ bạn chọn (${start_time} - ${end_time} ngày ${booking_date}) đã bị trùng với lịch đặt trước của cư dân khác. Vui lòng chọn khung giờ khác!`
      );
    }

    // Lưu lịch đặt
    await pool.execute(
      `INSERT INTO amenity_bookings (amenity_id, resident_id, booking_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      [amenity_id, user.id, booking_date, start_time, end_time]
    );

    res.redirect(`/amenities?success=Đặt tiện ích ${amenity.name} thành công! Thời gian: ${start_time} - ${end_time} ngày ${booking_date}.`);
  } catch (err) {
    console.error('Lỗi đặt tiện ích:', err);
    res.redirect('/amenities?error=Lỗi khi đặt tiện ích: ' + err.message);
  }
});

// POST /amenities/bookings/:id/cancel - Hủy lịch đặt
router.post('/bookings/:id/cancel', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const user = req.session.user;

  try {
    let condition = 'id = ?';
    let params = [id];
    if (user.role === 'resident') {
      condition += ' AND resident_id = ?';
      params.push(user.id);
    }

    const [rows] = await pool.execute(`SELECT id FROM amenity_bookings WHERE ${condition}`, params);
    if (rows.length === 0) {
      return res.redirect('/amenities?error=Không tìm thấy lịch đặt hoặc bạn không có quyền hủy');
    }

    await pool.execute("UPDATE amenity_bookings SET status = 'cancelled' WHERE id = ?", [id]);
    res.redirect('/amenities?success=Đã hủy lịch đặt thành công');
  } catch (err) {
    console.error('Lỗi hủy lịch đặt:', err);
    res.redirect('/amenities?error=Lỗi hủy lịch đặt: ' + err.message);
  }
});

module.exports = router;
