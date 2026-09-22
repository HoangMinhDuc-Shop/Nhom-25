const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// GET /feedbacks - Xem danh sách phản ánh
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const { status, category } = req.query;

    let sql = `
      SELECT f.id, f.apartment_id, f.resident_id, f.category, f.title, f.content, f.status, f.response_note, f.resolved_at, f.created_at,
             r.full_name AS resident_name, r.phone AS resident_phone,
             a.code AS apartment_number, b.name AS building_name
      FROM feedbacks f
      JOIN residents r ON f.resident_id = r.id
      LEFT JOIN apartments a ON f.apartment_id = a.id
      LEFT JOIN buildings b ON a.building_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (user.role === 'resident') {
      sql += ' AND f.resident_id = ?';
      params.push(user.id);
    } else {
      if (status) {
        sql += ' AND f.status = ?';
        params.push(status);
      }
      if (category) {
        sql += ' AND f.category = ?';
        params.push(category);
      }
    }

    sql += ' ORDER BY f.created_at DESC';

    const [feedbacks] = await pool.execute(sql, params);

    const totalCount = feedbacks.length;
    const pendingCount = feedbacks.filter(f => f.status === 'pending').length;
    const inProgressCount = feedbacks.filter(f => f.status === 'in_progress').length;
    const resolvedCount = feedbacks.filter(f => f.status === 'resolved').length;

    if (user.role === 'resident') {
      return res.render('resident/feedbacks', {
        title: 'Ý kiến & Phản ánh của Cư dân',
        feedbacks,
        stats: { totalCount, pendingCount, inProgressCount, resolvedCount },
        success: req.query.success || null,
        error: req.query.error || null
      });
    }

    res.render('admin/feedbacks', {
      title: 'Quản lý & Xử lý Ý kiến Phản ánh Cư dân',
      feedbacks,
      filters: { status, category },
      stats: { totalCount, pendingCount, inProgressCount, resolvedCount },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải phản ánh:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải danh sách phản ánh' });
  }
});

// POST /feedbacks/create - Cư dân gửi phản ánh mới
router.post('/create', isAuthenticated, requireRole('resident'), async (req, res) => {
  const { title, category, content } = req.body;
  const user = req.session.user;

  if (!title || !content) {
    return res.redirect('/feedbacks?error=Vui lòng điền đầy đủ Tiêu đề và Nội dung phản ánh');
  }

  try {
    const aptId = user.apartment_id || 1;
    await pool.execute(
      `INSERT INTO feedbacks (apartment_id, resident_id, category, title, content, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [aptId, user.id, category || 'Khác', title.trim(), content.trim()]
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

    res.redirect('/feedbacks?success=Ý kiến của bạn đã được gửi tới Ban Quản Lý! Chúng tôi sẽ phản hồi sớm nhất.');
  } catch (err) {
    console.error('Lỗi gửi phản ánh:', err);
    res.redirect('/feedbacks?error=Lỗi khi gửi phản ánh: ' + err.message);
  }
});

// POST /feedbacks/:id/status - Cập nhật tiến độ xử lý phản ánh (Admin)
router.post('/:id/status', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { status, response_note } = req.body;

  try {
    if (status === 'resolved') {
      await pool.execute(
        `UPDATE feedbacks SET status = ?, response_note = ?, resolved_at = NOW() WHERE id = ?`,
        [status, response_note ? response_note.trim() : null, id]
      );
    } else {
      await pool.execute(
        `UPDATE feedbacks SET status = ?, response_note = ? WHERE id = ?`,
        [status, response_note ? response_note.trim() : null, id]
      );
    }

    res.redirect('/feedbacks?success=Đã cập nhật trạng thái phản ánh #' + id);
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái phản ánh:', err);
    res.redirect('/feedbacks?error=Lỗi cập nhật phản ánh: ' + err.message);
  }
});

// POST /feedbacks/:id/reopen - Ban Quản Lý mở lại xử lý phản ánh đã hoàn tất (Recurrence / Re-open)
router.post('/:id/reopen', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { reopen_reason } = req.body;

  try {
    const [rows] = await pool.execute('SELECT id, status, response_note FROM feedbacks WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.redirect('/feedbacks?error=Không tìm thấy phản ánh #' + id);
    }

    const current = rows[0];
    const timeStr = new Date().toLocaleString('vi-VN');
    const reasonText = reopen_reason && reopen_reason.trim() ? reopen_reason.trim() : 'Sự cố cần kiểm tra xử lý bổ sung';
    const updatedNote = (current.response_note ? current.response_note + '\n' : '') +
      `[🔄 BQL MỞ LẠI lúc ${timeStr}]: ${reasonText}`;

    await pool.execute(
      `UPDATE feedbacks SET status = 'in_progress', response_note = ? WHERE id = ?`,
      [updatedNote, id]
    );

    res.redirect('/feedbacks?success=Đã mở lại phản ánh #' + id + ' sang trạng thái Đang xử lý!');
  } catch (err) {
    console.error('Lỗi mở lại phản ánh (Admin):', err);
    res.redirect('/feedbacks?error=Lỗi khi mở lại phản ánh: ' + err.message);
  }
});

// POST /feedbacks/:id/resident-reopen - Cư dân yêu cầu mở lại khi sự cố chưa dứt điểm
router.post('/:id/resident-reopen', isAuthenticated, requireRole('resident'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = req.session.user;

  try {
    const [rows] = await pool.execute(
      'SELECT id, status, response_note, title FROM feedbacks WHERE id = ? AND resident_id = ?',
      [id, user.id]
    );

    if (rows.length === 0) {
      return res.redirect('/feedbacks?error=Không tìm thấy phản ánh hoặc bạn không có quyền thao tác');
    }

    const current = rows[0];
    if (current.status !== 'resolved') {
      return res.redirect('/feedbacks?error=Chỉ có thể yêu cầu mở lại các phản ánh đã ở trạng thái Đã xử lý');
    }

    const timeStr = new Date().toLocaleString('vi-VN');
    const reasonText = reason && reason.trim() ? reason.trim() : 'Cư dân phản hồi sự cố tái phát / chưa khắc phục triệt để';
    const updatedNote = (current.response_note ? current.response_note + '\n' : '') +
      `[⚠️ CƯ DÂN YÊU CẦU MỞ LẠI lúc ${timeStr}]: ${reasonText}`;

    await pool.execute(
      `UPDATE feedbacks SET status = 'in_progress', response_note = ? WHERE id = ?`,
      [updatedNote, id]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('feedback_reopened_alert', {
        id,
        resident_name: user.full_name,
        apartment_number: user.apartment_number,
        title: current.title,
        reason: reasonText
      });
    }

    res.redirect('/feedbacks?success=Đã gửi yêu cầu mở lại phản ánh tới BQL! Kỹ thuật sẽ kiểm tra xử lý lại sớm nhất.');
  } catch (err) {
    console.error('Lỗi cư dân mở lại phản ánh:', err);
    res.redirect('/feedbacks?error=Lỗi khi yêu cầu mở lại: ' + err.message);
  }
});

module.exports = router;
