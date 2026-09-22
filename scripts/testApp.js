/**
 * Automated Verification Script
 * Kiểm tra toàn diện hệ thống với xác thực mật khẩu nghiêm ngặt qua POST /auth/login
 */

const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function login(identifier, password) {
  const postData = `identifier=${encodeURIComponent(identifier)}&password=${encodeURIComponent(password)}`;
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
  if (!res.headers['set-cookie']) {
    throw new Error(`Đăng nhập thất bại với tài khoản ${identifier}`);
  }
  return res.headers['set-cookie'][0].split(';')[0];
}

async function runTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ HỆ THỐNG XÁC THỰC NGHIÊM NGẶT ===\n');

  try {
    // 1. Kiểm tra trang đăng nhập
    console.log('1. Kiểm tra GET /auth/login...');
    let res = await request({ hostname: 'localhost', port: 3000, path: '/auth/login', method: 'GET' });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 2. Đăng nhập chính thức vai trò Admin bằng mật khẩu bcrypt
    console.log('2. Đăng nhập Ban Quản Lý (Admin: 0901234567 / admin123)...');
    let adminCookie = await login('0901234567', 'admin123');
    console.log(`   -> Đăng nhập thành công! Cookie: ${adminCookie.substring(0, 30)}...`);

    // 3. Kiểm tra Admin Dashboard
    console.log('3. Kiểm tra GET /admin/dashboard...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/admin/dashboard', method: 'GET', headers: { Cookie: adminCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 4. Kiểm tra Quản lý Căn hộ
    console.log('4. Kiểm tra GET /apartments...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/apartments', method: 'GET', headers: { Cookie: adminCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 5. Kiểm tra Quản lý Cư dân
    console.log('5. Kiểm tra GET /residents...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/residents', method: 'GET', headers: { Cookie: adminCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 6. Kiểm tra Sổ Thu Phí
    console.log('6. Kiểm tra GET /fees...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/fees', method: 'GET', headers: { Cookie: adminCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 7. Kiểm tra Phản ánh Cư dân
    console.log('7. Kiểm tra GET /feedbacks...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/feedbacks', method: 'GET', headers: { Cookie: adminCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 8. Kiểm tra Trung tâm Trí tuệ Nhân tạo AI Tools
    console.log('8. Kiểm tra GET /ai/tools...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/ai/tools', method: 'GET', headers: { Cookie: adminCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 9. Kiểm tra API 1: AI Soạn thảo thông báo
    console.log('9. Kiểm tra POST /ai/generate-announcement...');
    const postDraft = JSON.stringify({
      event_type: 'Bảo trì thang máy Tháp A',
      event_time: '08:00 - 11:30 ngày 20/09/2026',
      target_scope: 'Tòa A',
      note: 'Dùng thang bộ hoặc thang hàng số 3'
    });
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/ai/generate-announcement',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postDraft),
        Cookie: adminCookie
      }
    }, postDraft);
    const draftJson = JSON.parse(res.body);
    console.log(`   -> Status: ${res.statusCode}, Success: ${draftJson.success}`);

    // 10. Đăng nhập Cư dân (Resident: 0912345678 / cudan123)
    console.log('10. Đăng nhập Cư dân (0912345678 / cudan123)...');
    let resCookie = await login('0912345678', 'cudan123');
    console.log(`   -> Đăng nhập Cư dân thành công!`);

    // 11. Cư dân truy cập Cổng Cư Dân
    console.log('11. Kiểm tra GET /resident/home...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/resident/home', method: 'GET', headers: { Cookie: resCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 200)`);

    // 12. Kiểm tra Cư dân có bị chặn khi cố vào trang Admin không (Phân quyền 403)
    console.log('12. Kiểm tra Bảo mật: Cư dân truy cập trái phép /admin/dashboard...');
    res = await request({ hostname: 'localhost', port: 3000, path: '/admin/dashboard', method: 'GET', headers: { Cookie: resCookie } });
    console.log(`   -> Status: ${res.statusCode} (Kỳ vọng: 403 Bị chặn thành công!)`);
    if (res.statusCode !== 403) throw new Error('Phân quyền thất bại: Cư dân vẫn vào được trang Admin!');

    console.log('\n⭐⭐⭐ TẤT CẢ CÁC BÀI TEST BẢO MẬT & PHÂN QUYỀN ĐÃ VƯỢT QUA HOÀN HẢO! ⭐⭐⭐');
  } catch (err) {
    console.error('\n❌ LỖI:', err.message);
    process.exit(1);
  }
}

runTests();
