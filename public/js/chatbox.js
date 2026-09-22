/**
 * AI Assistant Chatbot Widget Script (RAG Rules Assistant)
 */

function toggleChatbot() {
  const widget = document.getElementById('chatbot-widget');
  if (widget) {
    widget.classList.toggle('active');
    if (widget.classList.contains('active')) {
      const input = document.getElementById('chat-input');
      if (input) input.focus();
    }
  }
}

function sendChipQuestion(chipElement) {
  const text = chipElement.textContent.replace(/^["'\s]+|["'\s]+$/g, '');
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = text;
    submitChatMessage();
  }
}

async function submitChatMessage() {
  const input = document.getElementById('chat-input');
  const messagesBox = document.getElementById('chat-messages');
  if (!input || !messagesBox) return;

  const text = input.value.trim();
  if (!text) return;

  // Hiển thị tin nhắn người dùng
  appendChatMessage(text, 'user');
  input.value = '';

  // Hiển thị trạng thái đang suy nghĩ
  const loadingId = 'loading-' + Date.now();
  const loadingDiv = document.createElement('div');
  loadingDiv.id = loadingId;
  loadingDiv.className = 'msg msg-bot';
  loadingDiv.innerHTML = '<em>⚡ ChungCuAI đang xử lý yêu cầu...</em>';
  messagesBox.appendChild(loadingDiv);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  try {
    const res = await fetch('/ai/chat-rag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) loadingElem.remove();

    if (data.success) {
      let formattedAnswer = data.answer
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      let citationsHtml = '';
      if (data.matchedRules && data.matchedRules.length > 0) {
        citationsHtml = '<div style="margin-top: 8px; font-size: 0.75rem; color: #475569; border-top: 1px dashed #CBD5E1; padding-top: 5px;"><strong>Trích dẫn:</strong> ' +
          data.matchedRules.map(r => `<span style="background:#E2E8F0; padding:2px 6px; border-radius:4px; margin-right:4px;">${r.code}</span>`).join('') +
          '</div>';
      }

      appendChatMessage(formattedAnswer + citationsHtml, 'bot', true);
    } else {
      appendChatMessage('Xin lỗi, tôi gặp chút trục trặc khi tra cứu. Bạn vui lòng liên hệ BQL qua Hotline 1900 8888 nhé!', 'bot');
    }
  } catch (err) {
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) loadingElem.remove();
    appendChatMessage('Lỗi kết nối tới máy chủ AI. Vui lòng thử lại sau!', 'bot');
  }
}

function appendChatMessage(htmlContent, type, isHtml = false) {
  const messagesBox = document.getElementById('chat-messages');
  if (!messagesBox) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `msg msg-${type}`;
  if (isHtml) {
    msgDiv.innerHTML = htmlContent;
  } else {
    msgDiv.textContent = htmlContent;
  }
  messagesBox.appendChild(msgDiv);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}
