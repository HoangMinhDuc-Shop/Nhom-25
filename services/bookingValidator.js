/**
 * Module Kiểm tra và Ngăn chặn Trùng lịch Đặt Tiện ích (Conflict Detection)
 * Phù hợp 100% mục 6.1.1 và Bảng 29 trong Báo cáo Đồ án Nhóm 25
 */

const pool = require('../config/database');

/**
 * Thuật toán kiểm tra xung đột thời gian đặt tiện ích
 * Điều kiện giao thoa giữa 2 khoảng thời gian [start, end] và [existing_start, existing_end]:
 * existing_start < new_end AND existing_end > new_start
 * 
 * @param {Object} params
 * @param {number} params.amenity_id - ID của tiện ích
 * @param {string} params.booking_date - Ngày đặt (YYYY-MM-DD)
 * @param {string} params.start_time - Giờ bắt đầu (HH:MM:SS)
 * @param {string} params.end_time - Giờ kết thúc (HH:MM:SS)
 * @param {number} [params.exclude_id] - Bỏ qua ID lịch đặt khi cập nhật
 * @returns {Promise<{ hasConflict: boolean, conflictingBooking?: Object }>}
 */
async function checkConflict({ amenity_id, booking_date, start_time, end_time, exclude_id = null }) {
  let sql = `
    SELECT id, amenity_id, resident_id, booking_date, start_time, end_time, status
    FROM amenity_bookings
    WHERE amenity_id = ?
      AND booking_date = ?
      AND status != 'cancelled'
      AND (start_time < ? AND end_time > ?)
  `;
  const params = [amenity_id, booking_date, end_time, start_time];

  if (exclude_id) {
    sql += ' AND id != ?';
    params.push(exclude_id);
  }

  sql += ' LIMIT 1';

  const [rows] = await pool.execute(sql, params);

  if (rows.length > 0) {
    return {
      hasConflict: true,
      conflictingBooking: rows[0]
    };
  }

  return {
    hasConflict: false
  };
}

module.exports = {
  checkConflict
};
