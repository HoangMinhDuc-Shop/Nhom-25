/**
 * Hệ thống Quản lý Cư dân Chung cư Tích hợp AI (Đề tài 21, Nhóm 25)
 * Server chính: Node.js + Express.js + Socket.io + EJS
 */

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');

const { attachUserLocals } = require('./middleware/auth');
const pool = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Lưu io vào app để các routes có thể truy xuất phát sóng thông báo
app.set('io', io);

// Cấu hình View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware phục vụ static files & body parser
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // Ngăn chặn trình duyệt cache cứng CSS/JS khiến F5 bị lỗi font
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'apartment_management_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000 // 1 ngày
    }
  })
);

// Gắn thông tin người dùng vào res.locals để mọi view EJS đều truy cập được
app.use(attachUserLocals);

// Mount Web Routes (Server-Side Rendering)
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const apartmentRoutes = require('./routes/apartments');
const residentRoutes = require('./routes/residents');
const feeRoutes = require('./routes/fees');
const feedbackRoutes = require('./routes/feedbacks');
const amenityRoutes = require('./routes/amenities');
const announcementRoutes = require('./routes/announcements');
const aiRoutes = require('./routes/ai');
const apiRoutes = require('./routes/api');

// 16 RESTful API Endpoints (Bảng 30 trong Báo cáo)
app.use('/api', apiRoutes);

app.use('/auth', authRoutes);
app.use('/apartments', apartmentRoutes);
app.use('/residents', residentRoutes);
app.use('/fees', feeRoutes);
app.use('/feedbacks', feedbackRoutes);
app.use('/amenities', amenityRoutes);
app.use('/announcements', announcementRoutes);
app.use('/ai', aiRoutes);
app.use('/rules', (req, res, next) => {
  req.url = '/rules' + req.url;
  aiRoutes(req, res, next);
});
app.use('/', dashboardRoutes);

// Các đường dẫn tắt tiện lợi (Convenient Redirects)
app.get('/login', (req, res) => res.redirect('/auth/login'));
app.get('/logout', (req, res) => res.redirect('/auth/logout'));
app.get('/dashboard', (req, res) => res.redirect('/'));

// Socket.io kết nối Real-time
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client đã kết nối: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client ngắt kết nối: ${socket.id}`);
  });
});

// Xử lý Route 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Không tìm thấy trang',
    message: 'Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.'
  });
});

// Xử lý Lỗi 500
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).render('error', {
    title: '500 - Lỗi máy chủ nội bộ',
    message: 'Đã có sự cố xảy ra trong quá trình xử lý yêu cầu của bạn: ' + (err.message || '')
  });
});

// Khởi chạy Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 ỨNG DỤNG QUẢN LÝ CHUNG CƯ AI ĐÃ SẴN SÀNG HOẠT ĐỘNG!`);
  console.log(`🌐 Truy cập hệ thống tại: http://localhost:${PORT}`);
  console.log(`📡 16 RESTful APIs: http://localhost:${PORT}/api/...`);
  console.log(`⚡ WebSocket Real-time: Đang lắng nghe sự kiện push thông báo`);
  console.log(`✨ Trợ lý AI: Sẵn sàng phục vụ (Announcement, Summarizer, RAG)`);
  console.log(`=============================================================\n`);
});
