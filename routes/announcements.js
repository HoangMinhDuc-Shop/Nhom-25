const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');

// GET /announcements - Danh sách thông báo
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;

    let sql = `
      SELECT a.id, a.title, a.content, a.created_by, a.is_ai_generated, a.target_scope, a.created_at,
             'general' AS category,
             r.full_name AS author_name,
             (SELECT COUNT(*) FROM notification_reads nr WHERE nr.announcement_id = a.id AND nr.resident_id = ?) AS is_read
      FROM announcements a
      JOIN residents r ON a.created_by = r.id
      ORDER BY a.created_at DESC
    `;
    const [announcements] = await pool.execute(sql, [user.id]);

    const unreadCount = announcements.filter(a => a.is_read == 0).length;

    res.render('admin/announcements', {
      title: 'Bảng tin & Thông báo Ban Quản Lý',
      announcements,
      unreadCount,
      user,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Lỗi tải thông báo:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải bảng tin thông báo' });
  }
});

// POST /announcements/create - Tạo thông báo mới (Admin)
router.post('/create', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { title, content, target_scope } = req.body;
  const user = req.session.user;

  if (!title || !content) {
    return res.redirect('/announcements?error=Vui lòng nhập tiêu đề và nội dung thông báo');
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO announcements (title, content, target_scope, created_by, is_ai_generated)
       VALUES (?, ?, ?, ?, 0)`,
      [title.trim(), content.trim(), target_scope || 'all', user.id]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('new_announcement', {
        id: result.insertId,
        title: title.trim(),
        content: content.trim().substring(0, 120) + '...',
        target_scope: target_scope || 'all',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      });
    }

    res.redirect('/announcements?success=Đã phát đi thông báo mới thành công!');
  } catch (err) {
    console.error('Lỗi tạo thông báo:', err);
    res.redirect('/announcements?error=Lỗi khi tạo thông báo: ' + err.message);
  }
});

// POST /announcements/:id/read - Đánh dấu đã đọc
router.post('/:id/read', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const user = req.session.user;

  try {
    await pool.execute(
      `INSERT INTO notification_reads (announcement_id, resident_id, read_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE read_at = NOW()`,
      [id, user.id]
    );

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ success: true });
    }
    res.redirect('/announcements');
  } catch (err) {
    console.error('Lỗi đánh dấu đã đọc:', err);
    res.redirect('/announcements');
  }
});

module.exports = router;
