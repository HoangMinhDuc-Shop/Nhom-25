/**
 * Module Tính toán Phí Quản lý & Tiền nước Lũy tiến
 * Phù hợp 100% mục 6.1.1 và Bảng 29 trong Báo cáo Đồ án Nhóm 25
 */

/**
 * Tính phí dịch vụ quản lý vận hành tòa nhà
 * @param {number} area - Diện tích căn hộ (m2)
 * @param {number} unitPrice - Đơn giá dịch vụ (mặc định 12.000 đ/m2)
 * @returns {number} Số tiền phí dịch vụ (VNĐ)
 */
function calculateServiceFee(area, unitPrice = 12000) {
  const a = Math.max(0, parseFloat(area) || 0);
  const p = Math.max(0, parseFloat(unitPrice) || 12000);
  return Math.round(a * p);
}

/**
 * Tính tiền nước sinh hoạt theo bậc thang lũy tiến chuẩn quy định chung cư
 * Bậc 1: 0 - 10 m3: 15.000 đ/m3
 * Bậc 2: 10 - 20 m3: 18.500 đ/m3
 * Bậc 3: Trên 20 m3: 25.000 đ/m3
 * @param {number} consumptionM3 - Lượng nước tiêu thụ trong kỳ (m3)
 * @returns {number} Tổng tiền nước (VNĐ)
 */
function calculateWaterFee(consumptionM3) {
  const m3 = Math.max(0, parseFloat(consumptionM3) || 0);
  let total = 0;

  if (m3 <= 10) {
    total = m3 * 15000;
  } else if (m3 <= 20) {
    total = (10 * 15000) + ((m3 - 10) * 18500);
  } else {
    total = (10 * 15000) + (10 * 18500) + ((m3 - 20) * 25000);
  }

  // Thuế VAT & phí BVMT 10%
  const totalWithVat = total * 1.1;
  return Math.round(totalWithVat);
}

module.exports = {
  calculateServiceFee,
  calculateWaterFee
};
