/**
 * Socket.io Real-time Client
 * Tiếp nhận thông báo tức thời từ Ban Quản Lý và phản ánh mới
 */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof io === 'undefined') return;

  const socket = io();

  // Container thông báo Toast
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '10px';
    document.body.appendChild(toastContainer);
  }

  function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.background = type === 'alert' ? '#1F4E79' : '#0F766E';
    toast.style.color = '#fff';
    toast.style.padding = '14px 18px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
    toast.style.minWidth = '300px';
    toast.style.maxWidth = '380px';
    toast.style.fontSize = '0.9rem';
    toast.style.transition = 'all 0.3s ease';
    toast.style.animation = 'slideIn 0.3s ease';

    toast.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
        <span>📢 ${title}</span>
        <span style="font-size: 0.75rem; opacity: 0.8;">Vừa xong</span>
      </div>
      <div style="line-height: 1.4; opacity: 0.95;">${message}</div>
    `;

    toastContainer.appendChild(toast);

    // Tự biến mất sau 6 giây
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  // 1. Nhận thông báo phát thanh mới từ BQL
  socket.on('new_announcement', (data) => {
    showToast('THÔNG BÁO MỚI TỪ BQL', data.title, 'alert');

    // Cập nhật huy hiệu unread nếu có
    const badge = document.querySelector('.nav-unread-badge');
    if (badge) {
      const cur = parseInt(badge.textContent || '0', 10);
      badge.textContent = cur + 1;
      badge.style.display = 'inline-block';
    }
  });

  // 2. Nhận cảnh báo phản ánh mới (Dành cho Admin)
  socket.on('new_feedback_alert', (data) => {
    showToast('Ý KIẾN CƯ DÂN MỚI', `Căn ${data.apartment_number} (${data.resident_name}) vừa gửi: "${data.title}"`, 'info');
  });
});
