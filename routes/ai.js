const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const aiAssistant = require('../services/aiAssistant');

// GET /ai/tools - Trung tâm Điều hành Trí tuệ Nhân tạo (Admin)
router.get('/tools', isAuthenticated, requireRole('admin'), async (req, res) => {
  try {
    const [feedbacks] = await pool.execute(
      `SELECT f.*, r.full_name AS resident_name, a.code AS apartment_number
       FROM feedbacks f
       JOIN residents r ON f.resident_id = r.id
       LEFT JOIN apartments a ON f.apartment_id = a.id
       ORDER BY f.created_at DESC LIMIT 30`
    );

    res.render('admin/ai-tools', {
      title: 'Trung tâm AI Ban Quản Lý Chung cư',
      feedbacks,
      aiStatus: aiAssistant.getAiStatus(),
      user: req.session.user
    });
  } catch (err) {
    console.error('Lỗi tải trang AI Tools:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải trung tâm AI' });
  }
});

// POST /ai/set-api-key - Cấu hình Google Gemini API Key
router.post('/set-api-key', isAuthenticated, requireRole('admin'), async (req, res) => {
  const { apiKey } = req.body;
  try {
    const result = await aiAssistant.updateApiKey(apiKey);
    res.json(result);
  } catch (err) {
    console.error('Lỗi cập nhật API Key:', err);
    res.status(500).json({ success: false, message: 'Lỗi cấu hình AI Key: ' + err.message });
  }
});

// POST /ai/generate-announcement - API AI Soạn thông báo tự động
router.post('/generate-announcement', isAuthenticated, requireRole('admin'), aiLimiter, async (req, res) => {
  const { event_type, event_time, target_scope, note } = req.body;

  try {
    const result = await aiAssistant.generateAnnouncement({
      event_type,
      event_time,
      target_scope,
      note
    });

    res.json(result);
  } catch (err) {
    console.error('Lỗi API sinh thông báo AI:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi gọi AI: ' + err.message });
  }
});

// POST /ai/summarize-feedbacks - API AI Tổng hợp phản ánh tuần
router.post('/summarize-feedbacks', isAuthenticated, requireRole('admin', 'accountant'), aiLimiter, async (req, res) => {
  try {
    const [feedbacks] = await pool.execute(
      `SELECT f.title, f.content, f.category, f.status, a.code AS apartment_number, f.created_at
       FROM feedbacks f
       JOIN residents r ON f.resident_id = r.id
       LEFT JOIN apartments a ON f.apartment_id = a.id
       ORDER BY f.created_at DESC LIMIT 50`
    );

    const result = await aiAssistant.summarizeFeedbacks(feedbacks);
    res.json(result);
  } catch (err) {
    console.error('Lỗi API tổng hợp phản ánh:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi gọi AI: ' + err.message });
  }
});

// POST /ai/chat-rag - API Trợ lý ảo AI Copilot phân quyền đa vai trò & giải đáp nội quy
router.post('/chat-rag', isAuthenticated, aiLimiter, async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi' });
  }

  try {
    const result = await aiAssistant.handleRoleAwareChat(message.trim(), req.session.user);
    res.json(result);
  } catch (err) {
    console.error('Lỗi Chatbot AI Copilot:', err);
    res.status(500).json({ success: false, message: 'Lỗi chatbot: ' + err.message });
  }
});

// GET /rules - Cẩm nang Tra cứu Nội quy Chung cư
router.get('/rules', isAuthenticated, async (req, res) => {
  const { category, keyword } = req.query;

  try {
    let sql = `SELECT id, title, content, category, updated_at, CONCAT('Điều ', id) AS rule_code FROM internal_rules WHERE 1=1`;
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (keyword) {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY id ASC';

    const [rules] = await pool.execute(sql, params);
    const [categories] = await pool.execute('SELECT DISTINCT category FROM internal_rules ORDER BY category ASC');

    res.render('resident/rules', {
      title: 'Cẩm nang & Quy định Quản lý Chung cư',
      rules,
      categories: categories.map(c => c.category),
      filters: { category, keyword },
      user: req.session.user
    });
  } catch (err) {
    console.error('Lỗi tải nội quy:', err);
    res.status(500).render('error', { title: 'Lỗi máy chủ', message: 'Không thể tải nội quy' });
  }
});

module.exports = router;
