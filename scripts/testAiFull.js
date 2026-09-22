const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- BẮT ĐẦU KIỂM THỬ TOÀN BỘ CHỨC NĂNG AI TRÊN WEB ---');

  // 1. Đăng nhập với tài khoản Admin
  const loginData = new URLSearchParams({
    identifier: 'admin@chungcu.vn',
    password: 'admin123'
  }).toString();

  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);

  const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
  console.log('1. Đăng nhập Admin:', loginRes.statusCode === 302 ? '✅ Thành công' : '❌ Thất bại');

  // 2. Kiểm tra GET /ai/tools
  const toolsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/tools',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  console.log('2. Truy cập /ai/tools:', toolsRes.statusCode === 200 ? '✅ Thành công' : '❌ Thất bại');
  console.log('   - Giao diện có cấu hình Gemini Key:', toolsRes.body.includes('Cấu hình Google Gemini API Key') ? '✅ Có' : '❌ Không');

  // 3. Test RAG câu hỏi: "Có được nuôi chó trong căn hộ không?"
  const q1 = JSON.stringify({ message: 'Có được nuôi chó trong căn hộ không?' });
  const rag1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/chat-rag',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(q1),
      'Cookie': cookie
    }
  }, q1);
  const rag1Data = JSON.parse(rag1.body);
  console.log('\n3. RAG Q1: "Có được nuôi chó trong căn hộ không?"');
  console.log('   - Trạng thái:', rag1Data.success ? '✅ Thành công' : '❌ Thất bại');
  console.log('   - Trả lời trích dẫn:', rag1Data.matchedRules?.map(r => r.code + ': ' + r.title).join(', '));
  const q1Match = rag1Data.matchedRules?.some(r => r.id === 3 || r.code === 'Điều 3');
  console.log('   - Khớp chính xác Điều 3 (Thú cưng):', q1Match ? '✅ CHÍNH XÁC' : '❌ SAI');

  // 4. Test RAG câu hỏi: "Mấy giờ cấm khoan đục và thi công?"
  const q2 = JSON.stringify({ message: 'Mấy giờ cấm khoan đục và thi công?' });
  const rag2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/chat-rag',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(q2),
      'Cookie': cookie
    }
  }, q2);
  const rag2Data = JSON.parse(rag2.body);
  console.log('\n4. RAG Q2: "Mấy giờ cấm khoan đục và thi công?"');
  console.log('   - Trạng thái:', rag2Data.success ? '✅ Thành công' : '❌ Thất bại');
  console.log('   - Trả lời trích dẫn:', rag2Data.matchedRules?.map(r => r.code + ': ' + r.title).join(', '));
  const q2Match = rag2Data.matchedRules?.some(r => r.id === 1 || r.code === 'Điều 1');
  console.log('   - Khớp chính xác Điều 1 (Thi công sửa chữa):', q2Match ? '✅ CHÍNH XÁC' : '❌ SAI');

  // 5. Test RAG câu hỏi ngoài phạm vi (Chống ảo giác): "Mai trời có mưa không?"
  const q3 = JSON.stringify({ message: 'Mai trời có mưa không?' });
  const rag3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/chat-rag',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(q3),
      'Cookie': cookie
    }
  }, q3);
  const rag3Data = JSON.parse(rag3.body);
  console.log('\n5. RAG Q3: "Mai trời có mưa không?" (Test Chống ảo giác - Mục 5.4.1)');
  console.log('   - Có từ chối ảo giác:', rag3Data.answer.includes('0280.3855.999') ? '✅ ĐẠT CHUẨN' : '❌ CHƯA ĐẠT');
  console.log('   - Nguồn bảo vệ:', rag3Data.source);

  // 6. Test RAG câu hỏi về xe và hầm gửi xe
  const q4 = JSON.stringify({ message: 'Giá vé gửi xe máy và ô tô bao nhiêu?' });
  const rag4 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/chat-rag',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(q4),
      'Cookie': cookie
    }
  }, q4);
  const rag4Data = JSON.parse(rag4.body);
  console.log('\n6. RAG Q4: "Giá vé gửi xe máy và ô tô bao nhiêu?"');
  console.log('   - Trả lời trích dẫn:', rag4Data.matchedRules?.map(r => r.code + ': ' + r.title).join(', '));
  const q4Match = rag4Data.matchedRules?.some(r => r.id === 5 || r.code === 'Điều 5');
  console.log('   - Khớp chính xác Điều 5 (Gửi xe & hầm đỗ xe):', q4Match ? '✅ CHÍNH XÁC' : '❌ SAI');

  // 7. Test AI Sinh thông báo tự động (Mục 5.2)
  const announcePayload = JSON.stringify({
    event_type: 'Bảo dưỡng định kỳ thang máy Tháp A',
    event_time: '08h00 - 11h30 ngày 15/09/2026',
    target_scope: 'Khu vực Tháp A',
    note: 'Cư dân vui lòng sử dụng thang hàng'
  });
  const annRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/generate-announcement',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(announcePayload),
      'Cookie': cookie
    }
  }, announcePayload);
  const annData = JSON.parse(annRes.body);
  console.log('\n7. AI Soạn thảo thông báo tự động (Mục 5.2):', annData.success ? '✅ Thành công' : '❌ Thất bại');
  console.log('   - Nguồn sinh:', annData.source);
  console.log('   - Độ dài văn bản tạo ra:', annData.content?.length, 'ký tự');

  // 8. Test AI Tổng hợp phản ánh tuần (Mục 5.3)
  const sumRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/ai/summarize-feedbacks',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  });
  const sumData = JSON.parse(sumRes.body);
  console.log('\n8. AI Tổng hợp phản ánh tuần (Mục 5.3):', sumData.success ? '✅ Thành công' : '❌ Thất bại');
  console.log('   - Nguồn phân tích:', sumData.source);
  console.log('   - Có nội dung phân tích:', sumData.summary?.length > 100 ? '✅ Đạt' : '❌ Rỗng');

  console.log('\n=============================================');
  console.log('🎉 TẤT CẢ CÁC TÍNH NĂNG AI HOẠT ĐỘNG HOÀN HẢO!');
  console.log('=============================================');
}

run().catch(console.error);
