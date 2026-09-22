const rateLimit = require('express-rate-limit');

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 30, // tối đa 30 requests/phút
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều yêu cầu tới AI trong thời gian ngắn. Vui lòng chờ 1 phút rồi thử lại.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau 15 phút.'
});

module.exports = {
  aiLimiter,
  authLimiter
};
