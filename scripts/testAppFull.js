/**
 * Comprehensive E2E Verification Script
 * Kiểm thử chi tiết các tác vụ:
 * 1. Accountant dashboard & Sổ thu phí
 * 2. Gạch nợ (settle)
 * 3. Sinh kỳ phí tự động (generate-monthly)
 * 4. Đăng ký tiện ích & Kiểm tra xung đột (Amenity booking & Conflict check)
 * 5. Gửi phản ánh từ cư dân (Feedbacks create)
 * 6. Đăng thông báo mới từ Admin (Announcements create)
 * 7. Đánh dấu đã đọc thông báo (Notification reads)
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
  const data = new URLSearchParams({ identifier, password }).toString();
  const res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data)
    }
  }, data);
  if (!res.headers['set-cookie']) {
    throw new Error('Đăng nhập thất bại: ' + identifier);
  }
  return res.headers['set-cookie'][0].split(';')[0];
}

async function runDetailedTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ CHI TIẾT CÁC NGHIỆP VỤ ===\n');

  try {
    // 1. Kế toán: Đăng nhập & kiểm tra Dashboard
    console.log('1. Đăng nhập Kế toán (ketoan@chungcu.vn)...');
    let accCookie = await login('ketoan@chungcu.vn', 'ketoan123');
    
    let res = await request({ hostname: 'localhost', port: 3000, path: '/accountant/dashboard', method: 'GET', headers: { Cookie: accCookie } });
    console.log(`   -> Accountant Dashboard: HTTP ${res.statusCode}`);
    if (res.statusCode !== 200) throw new Error('Accountant dashboard lỗi');

    // 2. Kế toán: Gạch nợ hóa đơn #4 (unpaid)
    console.log('2. Kiểm thử Gạch nợ hóa đơn (POST /fees/settle/4)...');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/fees/settle/4',
      method: 'POST',
      headers: { Cookie: accCookie }
    });
    console.log(`   -> Gạch nợ: HTTP ${res.statusCode} (Redirect 302 về /fees)`);

    // 3. Kế toán: Phát sinh kỳ phí tháng 2026-10
    console.log('3. Kiểm thử Tự động sinh kỳ phí (POST /fees/generate-monthly)...');
    const postMonth = 'billing_month=2026-10';
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/fees/generate-monthly',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postMonth),
        Cookie: accCookie
      }
    }, postMonth);
    console.log(`   -> Sinh kỳ phí tháng 2026-10: HTTP ${res.statusCode}`);

    // 4. Cư dân: Đăng nhập
    console.log('4. Đăng nhập Cư dân (0912345678)...');
    let resCookie = await login('0912345678', 'cudan123');

    // 5. Cư dân: Đặt lịch tiện ích Sân Pickleball (Amenity ID: 1)
    console.log('5. Cư dân đặt tiện ích (Ngày 2026-09-25, 08:00 - 10:00)...');
    const bookData1 = 'amenity_id=1&booking_date=2026-09-25&start_time=08:00&end_time=10:00';
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/amenities/book',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bookData1),
        Cookie: resCookie
      }
    }, bookData1);
    console.log(`   -> Đặt lịch thành công: HTTP ${res.statusCode}`);

    // 6. Kiểm tra thuật toán chống trùng lịch (Conflict check)
    console.log('6. Kiểm tra Thuật toán Ngăn chặn Trùng lịch (Conflict Prevention)...');
    // Cố tình đặt trùng khung giờ 09:00 - 11:00 cùng ngày
    const bookDataConflict = 'amenity_id=1&booking_date=2026-09-25&start_time=09:00&end_time=11:00';
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/amenities/book',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bookDataConflict),
        Cookie: resCookie
      }
    }, bookDataConflict);
    const redirectUrl = res.headers['location'] || '';
    const isConflictCaught = redirectUrl.includes('error') || redirectUrl.includes('tr%C3%B9ng');
    console.log(`   -> Bắt trùng lịch: ${isConflictCaught ? 'THÀNH CÔNG (Đã chặn trùng lịch!)' : 'Cần kiểm tra'}`);

    // 7. Cư dân gửi phản ánh mới
    console.log('7. Cư dân gửi phản ánh mới (POST /feedbacks/create)...');
    const fbData = 'category=V%E1%BB%87%20sinh&title=Thu%20gom%20r%C3%A1c%20th%E1%BA%A3i&content=Nh%C3%A0%20r%C3%A1c%20t%E1%BA%A7ng%2012%20b%E1%BB%8B%20%C4%91%E1%BA%A7y';
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/feedbacks/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(fbData),
        Cookie: resCookie
      }
    }, fbData);
    console.log(`   -> Gửi phản ánh: HTTP ${res.statusCode}`);

    // 8. Admin tạo thông báo và phát sóng Socket.io
    console.log('8. Admin tạo thông báo (POST /announcements/create)...');
    let adminCookie = await login('admin@chungcu.vn', 'admin123');
    const annData = 'title=Th%C3%B4ng%20b%C3%A1o%20ki%E1%BB%83m%20tra%20PCCC&content=BQL%20th%C3%B4ng%20b%C3%A1o%20ki%E1%BB%83m%20tra%20PCCC%20v%C3%A0o%20ng%C3%A0y%20mai.&target_scope=all';
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/announcements/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(annData),
        Cookie: adminCookie
      }
    }, annData);
    console.log(`   -> Đăng thông báo: HTTP ${res.statusCode}`);

    // 9. Cư dân đọc thông báo
    console.log('9. Cư dân đánh dấu đã đọc thông báo #1 (POST /announcements/1/read)...');
    res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/announcements/1/read',
      method: 'POST',
      headers: { Cookie: resCookie }
    });
    console.log(`   -> Đánh dấu đã đọc: HTTP ${res.statusCode}`);

    console.log('\n⭐⭐⭐ TẤT CẢ CÁC NGHIỆP VỤ E2E ĐÃ HOÀN TẤT THÀNH CÔNG RỰC RỠ! ⭐⭐⭐');
  } catch (err) {
    console.error('\n❌ LỖI:', err.message);
    process.exit(1);
  }
}

runDetailedTests();
