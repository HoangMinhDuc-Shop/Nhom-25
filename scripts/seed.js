const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  console.log('--- BẮT ĐẦU NẠP DỮ LIỆU MẪU (SEED DATA) ---');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'apartment_management',
    charset: 'utf8mb4'
  });

  try {
    // 1. Buildings
    await conn.query('DELETE FROM notification_reads;');
    await conn.query('DELETE FROM amenity_bookings;');
    await conn.query('DELETE FROM feedbacks;');
    await conn.query('DELETE FROM fee_transactions;');
    await conn.query('DELETE FROM announcements;');
    await conn.query('DELETE FROM residents;');
    await conn.query('DELETE FROM apartments;');
    await conn.query('DELETE FROM buildings;');
    await conn.query('DELETE FROM amenities;');
    await conn.query('DELETE FROM fee_types;');
    await conn.query('DELETE FROM internal_rules;');

    console.log('1. Nạp Buildings...');
    await conn.query(`
      INSERT INTO buildings (id, name, address, num_floors) VALUES
      (1, 'Tòa Tháp A (Ruby Tower)', 'Số 25 Đường Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 25),
      (2, 'Tòa Tháp B (Sapphire Tower)', 'Số 25 Đường Hoàng Quốc Việt, Cầu Giấy, Hà Nội', 20);
    `);

    console.log('2. Nạp 40 Apartments...');
    const aptValues = [];
    // Building 1: Floors 1 to 7 (28 apartments)
    for (let f = 1; f <= 7; f++) {
      for (let r = 1; r <= 4; r++) {
        const floorStr = f < 10 ? '0' + f : '' + f;
        const roomStr = r < 10 ? '0' + r : '' + r;
        const code = `A${floorStr}${roomStr}`;
        const area = (68.5 + (f + r) * 2.5).toFixed(2);
        const status = (f === 1 && r === 1) || (f === 1 && r === 2) || (f === 2 && r === 1) || (f === 3 && r === 2) ? 'occupied' : (f % 3 === 0 ? 'vacant' : 'occupied');
        aptValues.push([1, f, code, area, status]);
      }
    }
    // Building 2: Floors 1 to 3 (12 apartments)
    for (let f = 1; f <= 3; f++) {
      for (let r = 1; r <= 4; r++) {
        const floorStr = f < 10 ? '0' + f : '' + f;
        const roomStr = r < 10 ? '0' + r : '' + r;
        const code = `B${floorStr}${roomStr}`;
        const area = (72.0 + (f + r) * 3.0).toFixed(2);
        const status = r % 2 === 0 ? 'occupied' : 'vacant';
        aptValues.push([2, f, code, area, status]);
      }
    }
    for (const row of aptValues) {
      await conn.query('INSERT INTO apartments (building_id, floor, code, area, status) VALUES (?, ?, ?, ?, ?)', row);
    }

    console.log('3. Nạp Residents & Tài khoản...');
    const passAdmin = bcrypt.hashSync('admin123', 10);
    const passKetoan = bcrypt.hashSync('ketoan123', 10);
    const passCudan = bcrypt.hashSync('cudan123', 10);

    // Admin & Accountant (không gắn apartment)
    await conn.query(`
      INSERT INTO residents (id, apartment_id, full_name, phone, email, role, is_owner, password_hash) VALUES
      (1, NULL, 'Ban Quản Lý Chung Cư (Admin)', '0901234567', 'admin@chungcu.vn', 'admin', 0, ?),
      (2, NULL, 'Nguyễn Thị Thu Hương (Kế toán)', '0909876543', 'ketoan@chungcu.vn', 'accountant', 0, ?);
    `, [passAdmin, passKetoan]);

    // Cư dân mẫu
    const residentsData = [
      [1, 'Hoàng Minh Đức (Chủ hộ A0101)', '0912345678', 'duc.hoang@gmail.com', 'resident', 1, passCudan],
      [2, 'Trần Anh Dũng (Chủ hộ A0102)', '0987654321', 'dung.tran@gmail.com', 'resident', 1, passCudan],
      [3, 'Lê Văn Thắng (Chủ hộ A0103)', '0934567890', 'thang.le@gmail.com', 'resident', 1, passCudan],
      [4, 'Phạm Thị Mai (Thành viên A0101)', '0945678901', 'mai.pham@gmail.com', 'resident', 0, passCudan],
      [5, 'Vũ Đình Trọng (Chủ hộ A0201)', '0956789012', 'trong.vu@gmail.com', 'resident', 1, passCudan],
      [6, 'Ngô Thanh Vân (Chủ hộ A0202)', '0967890123', 'van.ngo@gmail.com', 'resident', 1, passCudan],
      [7, 'Đỗ Mạnh Cường (Chủ hộ A0301)', '0978901234', 'cuong.do@gmail.com', 'resident', 1, passCudan],
      [8, 'Bùi Tuyết Mai (Chủ hộ B0101)', '0989012345', 'mai.bui@gmail.com', 'resident', 1, passCudan]
    ];
    for (const r of residentsData) {
      await conn.query('INSERT INTO residents (apartment_id, full_name, phone, email, role, is_owner, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)', r);
    }

    console.log('4. Nạp Fee Types...');
    await conn.query(`
      INSERT INTO fee_types (id, name, unit_price, unit) VALUES
      (1, 'Phí dịch vụ quản lý vận hành', 12000.00, 'm2/tháng'),
      (2, 'Phí nước sinh hoạt', 18500.00, 'm3'),
      (3, 'Phí trông giữ xe máy', 100000.00, 'xe/tháng'),
      (4, 'Phí trông giữ xe ô tô', 1200000.00, 'xe/tháng');
    `);

    console.log('5. Nạp Fee Transactions...');
    const period = '2026-09';
    await conn.query(`
      INSERT INTO fee_transactions (apartment_id, fee_type_id, period, amount, status, paid_at) VALUES
      (1, 1, '${period}', 850000.00, 'paid', NOW()),
      (1, 2, '${period}', 245000.00, 'paid', NOW()),
      (1, 3, '${period}', 200000.00, 'paid', NOW()),
      (2, 1, '${period}', 910000.00, 'unpaid', NULL),
      (2, 2, '${period}', 315000.00, 'unpaid', NULL),
      (2, 4, '${period}', 1200000.00, 'unpaid', NULL),
      (3, 1, '${period}', 820000.00, 'unpaid', NULL),
      (3, 3, '${period}', 100000.00, 'unpaid', NULL),
      (5, 1, '${period}', 950000.00, 'paid', NOW()),
      (6, 1, '${period}', 930000.00, 'unpaid', NULL);
    `);

    console.log('6. Nạp Feedbacks...');
    await conn.query(`
      INSERT INTO feedbacks (apartment_id, resident_id, category, title, content, status, ai_summary_group) VALUES
      (1, 3, 'Thang máy', 'Thang máy số 2 tòa A bị rung lắc mạnh khi qua tầng 12', 'Vào lúc 7h30 sáng nay khi tôi đi làm, thang số 2 có tiếng kêu rít và giật cục nhẹ, đề nghị kỹ thuật kiểm tra cáp kéo khẩn cấp.', 'in_progress', 'THIẾT BỊ KỸ THUẬT'),
      (2, 4, 'Điện', 'Bóng đèn hành lang tầng 8 tòa A chập chờn liên tục', 'Đèn chiếu sáng khu vực đối diện thang rác bị nhấp nháy 2 ngày nay gây khó khăn cho việc đi lại ban đêm.', 'pending', 'THIẾT BỊ KỸ THUẬT'),
      (3, 5, 'Vệ sinh', 'Nhà rác tầng 5 có mùi khó chịu chưa được dọn sạch', 'Thùng rác hữu cơ đã đầy từ tối qua nhưng chưa thấy nhân viên vệ sinh chuyển xuống hầm gom.', 'resolved', 'VỆ SINH MÔI TRƯỜNG'),
      (5, 7, 'Tiếng ồn', 'Căn hộ tầng trên khoan đục sửa nhà vào giờ nghỉ trưa', 'Căn hộ 0302 thường xuyên khoan đục lúc 12h30 - 13h30 gây ồn ào không ngủ được, vi phạm Điều 1 nội quy.', 'pending', 'AN NINH TRẬT TỰ'),
      (1, 3, 'Nước', 'Nước sinh hoạt căn A0101 có màu vàng đục', 'Nước vòi rửa bát sáng nay xả ra thấy có cặn màu vàng đục, đề nghị kiểm tra bể chứa ngầm.', 'in_progress', 'VỆ SINH MÔI TRƯỜNG');
    `);

    console.log('7. Nạp Amenities...');
    await conn.query(`
      INSERT INTO amenities (id, name, capacity, open_time, close_time) VALUES
      (1, 'Sân thể thao Pickleball & Tennis ngoài trời', 8, '06:00:00', '22:00:00'),
      (2, 'Phòng sinh hoạt cộng đồng Tòa A', 50, '08:00:00', '21:30:00'),
      (3, 'Khu vực Vườn nướng BBQ sân thượng Tòa B', 25, '16:00:00', '22:00:00');
    `);

    console.log('8. Nạp Amenity Bookings...');
    await conn.query(`
      INSERT INTO amenity_bookings (amenity_id, resident_id, booking_date, start_time, end_time, status) VALUES
      (1, 3, '2026-09-10', '16:00:00', '18:00:00', 'confirmed'),
      (3, 4, '2026-09-12', '18:00:00', '21:00:00', 'confirmed');
    `);

    console.log('9. Nạp Announcements & Notification Reads...');
    await conn.query(`
      INSERT INTO announcements (id, title, content, created_by, is_ai_generated, target_scope) VALUES
      (1, 'THÔNG BÁO TẠM NGỪNG CẤP NƯỚC ĐỂ THAU RỬA BỂ NGẦM', 'Kính gửi Quý cư dân Tòa Tháp A:\\nBan Quản lý xin trân trọng thông báo về kế hoạch thau rửa bể nước ngầm định kỳ nhằm bảo đảm chất lượng nước sinh hoạt.\\n- Thời gian: Từ 23h00 ngày 12/09 đến 05h00 ngày 13/09/2026.\\n- Phạm vi: Toàn bộ căn hộ Tòa A.\\nQuý cư dân vui lòng chủ động tích trữ nước trước khung giờ trên.\\nTrân trọng cảm ơn!', 1, 1, 'all'),
      (2, 'KẾ HOẠCH DIỄN TẬP PHÒNG CHÁY CHỮA CHÁY (PCCC) NĂM 2026', 'Ban Quản lý phối hợp cùng Đội Cảnh sát PCCC Quận Cầu Giấy tổ chức diễn tập phương án chữa cháy và thoát nạn toàn tòa nhà.\\n- Thời gian: 09h00 - 11h00 sáng Thứ Bảy (19/09/2026).\\n- Đề nghị cư dân không hoảng loạn khi nghe còi báo cháy trong khung giờ diễn tập.', 1, 0, 'all');
    `);
    await conn.query(`
      INSERT INTO notification_reads (announcement_id, resident_id, read_at) VALUES
      (1, 3, NOW()),
      (1, 4, NOW()),
      (2, 3, NOW());
    `);

    console.log('10. Nạp 15 Điều khoản Nội quy (Knowledge Base cho RAG Chatbot)...');
    const rules = [
      ['Điều 1: Quy định về giờ giấc thi công, sửa chữa căn hộ gây ồn', 'Các ngày từ Thứ Hai đến Thứ Sáu, các công việc sửa chữa khoan đục gây tiếng ồn chỉ được phép tiến hành từ 08h00 đến 11h30 và từ 14h00 đến 17h00. Nghiêm cấm mọi hành vi thi công gây ồn vào các ngày Thứ Bảy, Chủ Nhật, ngày Lễ Tết và trong khung giờ nghỉ trưa từ 11h30 đến 14h00.', 'Thi công sửa chữa'],
      ['Điều 2: Quy định về an toàn Phòng cháy chữa cháy (PCCC) và cấm đốt lửa trần', 'Nghiêm cấm tuyệt đối hành vi đốt vàng mã, nướng than hoa, đốt lửa trần tại ban công, lô gia, hành lang hoặc các khu vực công cộng trong chung cư. Khi đốt vàng mã bắt buộc phải xuống khu lò đốt chuyên dụng của tòa nhà đặt tại góc sân sau.', 'An toàn PCCC'],
      ['Điều 3: Quy định về việc nuôi thú cưng, chó mèo trong tòa nhà', 'Cư dân được phép nuôi thú cưng nhưng bắt buộc phải đăng ký với Ban Quản lý và tiêm phòng dại đầy đủ. Khi đưa thú cưng ra ngoài khu vực công cộng (thang máy, hành lang, sân chơi), chó mèo phải được rọ mõm, có dây dắt và chủ nuôi phải mang theo dụng cụ dọn vệ sinh chất thải ngay lập tức.', 'Nuôi thú cưng'],
      ['Điều 4: Quy định phân loại và thời gian tập kết rác thải sinh hoạt', 'Rác thải sinh hoạt phải được đóng gói trong túi nilong kín, không rò rỉ nước và thả vào họng thu rác tại phòng rác từng tầng từ 06h00 đến 21h00 hàng ngày. Các loại rác cồng kềnh (xà bần, nệm cũ, đồ gỗ, thùng carton lớn) phải thông báo tổ vệ sinh để chuyển thẳng xuống kho rác tầng hầm, cấm vứt tại hành lang.', 'Vệ sinh rác thải'],
      ['Điều 5: Quy định sử dụng và gửi xe tại tầng hầm', 'Phương tiện xe máy, ô tô phải được đỗ đúng vạch kẻ và khu vực quy định theo mã thẻ xe đã đăng ký. Nghiêm cấm hút thuốc lá, nổ máy lâu hoặc sửa xe trong tầng hầm. Vận tốc tối đa trong hầm là 10 km/h.', 'Gửi xe hầm'],
      ['Điều 6: Quy định sử dụng thang máy chở khách và thang hàng', 'Thang máy số 1 và số 2 dành riêng cho cư dân chở người. Vận chuyển đồ đạc cồng kềnh, xe đạp, vật liệu xây dựng bắt buộc phải sử dụng thang hàng số 3 và có bọc bảo vệ vách thang. Nghiêm cấm trẻ em dưới 10 tuổi đi thang máy một mình.', 'Sử dụng thang máy'],
      ['Điều 7: Quy định giữ gìn an ninh trật tự và hạn chế tiếng ồn ban đêm', 'Sau 22h00 đêm, cư dân phải giữ trật tự chung, không mở loa đài, tivi hoặc hát karaoke âm lượng lớn làm ảnh hưởng đến các căn hộ xung quanh. Mọi hành vi tụ tập gây rối, đánh bạc, sử dụng chất kích thích đều bị nghiêm cấm và báo công an xử lý.', 'An ninh trật tự'],
      ['Điều 8: Quy định đăng ký tạm trú và quản lý khách lưu trú qua đêm', 'Chủ hộ có trách nhiệm đăng ký thông tin người lưu trú cho khách ở lại qua đêm quá 24 giờ thông qua Cổng dịch vụ cư dân hoặc khai báo tại bàn lễ tân sảnh tầng 1.', 'Quản lý nhân khẩu'],
      ['Điều 9: Quy định sử dụng các tiện ích dùng chung (Sân thể thao, BBQ, phòng cộng đồng)', 'Cư dân phải đặt lịch trước qua ứng dụng quản lý cư dân tối thiểu 2 giờ. Mỗi căn hộ được đặt tối đa 2 giờ/ngày đối với sân Pickleball và phải dọn dẹp sạch sẽ sau khi sử dụng khu vực nướng BBQ.', 'Tiện ích dùng chung'],
      ['Điều 10: Quy định thời hạn nộp phí dịch vụ và giải quyết nợ phí', 'Phí dịch vụ quản lý, phí nước và tiền gửi xe hàng tháng phải được thanh toán trước ngày 15 của tháng tiếp theo. Quá ngày 20, BQL sẽ gửi giấy nhắc nợ; quá 30 ngày chưa thanh toán sẽ tạm ngừng cung cấp một số tiện ích đi kèm.', 'Phí dịch vụ'],
      ['Điều 11: Quy định giữ gìn vệ sinh chung và bảo vệ cảnh quan ban công', 'Nghiêm cấm vứt tàn thuốc lá, rác thải hoặc hắt nước từ ban công, cửa sổ xuống dưới. Cấm phơi quần áo, chăn màn thò ra ngoài lan can ban công làm mất mỹ quan tòa nhà.', 'Cảnh quan ban công'],
      ['Điều 12: Quy định xử lý trường hợp vi phạm nội quy tòa nhà', 'Hành vi vi phạm lần đầu sẽ bị BQL nhắc nhở bằng văn bản hoặc thông báo trên ứng dụng. Vi phạm lần 2 sẽ lập biên bản sự việc và phạt tiền theo quy chế tòa nhà. Vi phạm lần 3 hoặc cố tình tái diễn sẽ chuyển hồ sơ lên chính quyền địa phương.', 'Quy chế xử lý'],
      ['Điều 13: Quy định đón tiếp nhân viên giao hàng (Shipper)', 'Nhân viên giao hàng chỉ được phép giao nhận tại sảnh lễ tân tầng 1 hoặc bàn gửi hàng tập trung. Trường hợp giao đồ cồng kềnh lên căn hộ phải xuất trình CCCD tại quầy bảo vệ để đổi thẻ thang máy.', 'Giao nhận hàng hóa'],
      ['Điều 14: Quy định quản lý và bàn giao căn hộ cho thuê', 'Chủ hộ khi cho thuê căn hộ phải gửi bản sao hợp đồng thuê và danh sách khách thuê cho Ban Quản lý để cập nhật quyền truy cập ứng dụng và thẻ ra vào tòa nhà.', 'Cho thuê căn hộ'],
      ['Điều 15: Đường dây nóng khẩn cấp và kênh hỗ trợ BQL 24/7', 'Đường dây nóng hỗ trợ kỹ thuật và an ninh khẩn cấp trực 24/7: 0901.234.567. Văn phòng Ban Quản lý làm việc từ 08h00 đến 17h30 hàng ngày tại Tầng 1 Tòa Tháp A. Cư dân có thể gửi phản ánh sự cố trực tiếp qua ứng dụng web.', 'Đường dây nóng']
    ];

    for (const r of rules) {
      await conn.query('INSERT INTO internal_rules (title, content, category) VALUES (?, ?, ?)', r);
    }

    console.log('--- NẠP DỮ LIỆU MẪU THÀNH CÔNG RỰC RỠ! ---');
  } catch (err) {
    console.error('Lỗi khi nạp dữ liệu mẫu:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

seed();
