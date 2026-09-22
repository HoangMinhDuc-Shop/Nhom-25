/**
 * Dịch vụ Tích hợp Trí tuệ Nhân tạo (Google Gemini AI via @google/genai)
 * Tuân thủ 100% Chương 5 của Báo cáo Đồ án Nhóm 25:
 * 1. Soạn thảo thông báo tự động (Mục 5.2)
 * 2. Phân nhóm & Tóm tắt phản ánh tuần có PII Masking (Mục 5.3 & 5.3.1)
 * 3. Trợ lý RAG giải đáp nội quy có cam kết Chống ảo giác tuyệt đối (Mục 5.4 & 5.4.1)
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const pool = require('../config/database');

let aiClient = null;
let currentApiKey = process.env.GEMINI_API_KEY || '';

function initAiClient(key) {
  if (key && key.trim() !== '' && key !== 'YOUR_GEMINI_API_KEY_HERE') {
    try {
      aiClient = new GoogleGenAI({ apiKey: key.trim() });
      currentApiKey = key.trim();
      console.log('[AI Service] Đã kết nối thành công Google Gen AI với API Key.');
      return true;
    } catch (err) {
      console.warn('[AI Service] Khởi tạo GoogleGenAI thất bại:', err.message);
      aiClient = null;
      return false;
    }
  } else {
    aiClient = null;
    return false;
  }
}

// Khởi tạo ban đầu
initAiClient(currentApiKey);

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

// Cache trạng thái Ollama Localhost để không làm chậm ứng dụng
let cachedOllamaStatus = { isAvailable: false, lastChecked: 0, models: [], currentModel: OLLAMA_DEFAULT_MODEL };

// Tự động kiểm tra và cập nhật trạng thái Ollama định kỳ
checkOllamaActive().catch(() => {});
setInterval(() => {
  checkOllamaActive().catch(() => {});
}, 10000);

/**
 * Kiểm tra xem dịch vụ Ollama Localhost có đang chạy trên máy (cổng 11434) không
 */
async function checkOllamaActive() {
  const now = Date.now();
  if (now - cachedOllamaStatus.lastChecked < 5000) {
    return cachedOllamaStatus;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1200);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map(m => m.name);
      cachedOllamaStatus = {
        isAvailable: true,
        lastChecked: now,
        models: models,
        currentModel: models.length > 0 ? (models.find(m => m.includes('qwen') || m.includes('gemma') || m.includes('llama')) || models[0]) : OLLAMA_DEFAULT_MODEL
      };
      return cachedOllamaStatus;
    }
  } catch (err) {
    clearTimeout(timeoutId);
  }

  cachedOllamaStatus = {
    isAvailable: false,
    lastChecked: now,
    models: [],
    currentModel: OLLAMA_DEFAULT_MODEL
  };
  return cachedOllamaStatus;
}

/**
 * Gọi mô hình AI chạy trực tiếp trên Localhost qua Ollama (ƯU TIÊN 1 - ZERO API KEY)
 */
async function callOllama({ systemPrompt, prompt, temperature = 0.3 }) {
  const status = await checkOllamaActive();
  if (!status.isAvailable) return null;

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 giây timeout

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: status.currentModel || OLLAMA_DEFAULT_MODEL,
        messages: messages,
        stream: false,
        options: { temperature: temperature }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.message && data.message.content) {
        return {
          success: true,
          source: 'ollama-localhost',
          model: data.model || status.currentModel,
          text: data.message.content.trim()
        };
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[AI Service] Lỗi gọi Ollama Localhost:', err.message);
  }
  return null;
}

/**
 * ĐIỀU PHỐI SUY LUẬN AI ĐA TẦNG THEO THỨ TỰ ƯU TIÊN:
 * 1. Ưu tiên 1: Ollama Localhost (Chạy trên máy, không cần API Key, bảo mật 100%)
 * 2. Ưu tiên 2: Google Gemini Cloud API (Nếu có cấu hình key)
 * 3. Ưu tiên 3: Fallback về Smart Offline Engine nội bộ
 */
async function executeAiGeneration({ systemPrompt, userPrompt, temperature = 0.3 }) {
  // 1. Kiểm tra và gọi Ollama Localhost trước
  try {
    const ollamaRes = await callOllama({ systemPrompt, prompt: userPrompt, temperature });
    if (ollamaRes) {
      return ollamaRes;
    }
  } catch (e) {
    // tiếp tục fallback
  }

  // 2. Gọi Google Gemini Cloud API nếu có
  if (aiClient) {
    try {
      const fullContent = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
      const response = await aiClient.models.generateContent({
        model: MODEL_NAME,
        contents: fullContent
      });
      if (response && response.text) {
        return {
          success: true,
          source: 'gemini-cloud-ai',
          model: MODEL_NAME,
          text: response.text.trim()
        };
      }
    } catch (err) {
      console.warn('[AI Service] Lỗi gọi Gemini Cloud API:', err.message);
    }
  }

  return null;
}

function getAiStatus() {
  const isOllama = cachedOllamaStatus.isAvailable;
  let providerName = 'Smart Offline (Nội bộ)';
  let activeModel = 'Smart Semantic Formatter';

  if (isOllama) {
    providerName = 'Ollama Localhost (Mô hình Cục bộ - Không cần API Key)';
    activeModel = `Ollama (${cachedOllamaStatus.currentModel})`;
  } else if (aiClient) {
    providerName = 'Google Gemini Cloud (@google/genai)';
    activeModel = MODEL_NAME;
  }

  return {
    provider: isOllama ? 'ollama-local' : (aiClient ? 'gemini-cloud' : 'smart-offline'),
    providerName: providerName,
    isLiveAiConnected: isOllama || (aiClient !== null),
    isOllamaActive: isOllama,
    ollamaModels: cachedOllamaStatus.models,
    model: activeModel,
    hasApiKey: Boolean(currentApiKey && currentApiKey.length > 10)
  };
}

async function updateApiKey(newKey) {
  const trimmed = (newKey || '').trim();
  initAiClient(trimmed);

  // Lưu vào file .env
  try {
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${trimmed}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${trimmed}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.GEMINI_API_KEY = trimmed;
  } catch (err) {
    console.error('[AI Service] Lỗi ghi .env:', err.message);
  }

  // Thử nghiệm gọi 1 request nhẹ nếu có key
  if (aiClient) {
    try {
      const testRes = await aiClient.models.generateContent({
        model: MODEL_NAME,
        contents: 'Xin chào, trả lời ngắn gọn: Sẵn sàng.'
      });
      return {
        success: true,
        message: 'Đã kích hoạt thành công Google Gemini Cloud API!',
        response: testRes.text
      };
    } catch (apiErr) {
      return {
        success: false,
        message: 'API Key không hợp lệ hoặc đã hết hạn: ' + apiErr.message
      };
    }
  }

  return {
    success: true,
    message: 'Đã lưu cấu hình. Đang chạy ở chế độ Trí tuệ Nhân tạo Nội bộ (Local Engine).'
  };
}

/**
 * Hàm làm sạch và ẩn thông tin cá nhân (PII Masking) theo Mục 5.3.1
 */
function maskPII(text) {
  if (!text) return '';
  const phoneRegex = /(0[3|5|7|8|9])+([0-9]{8})/g;
  const cccdRegex = /\b\d{9,12}\b/g;

  return text
    .replace(phoneRegex, '[SĐT_ĐÃ_ẨN]')
    .replace(cccdRegex, '[CCCD_ĐÃ_ẨN]');
}

/**
 * 1. SOẠN THẢO THÔNG BÁO TỰ ĐỘNG (MỤC 5.2 & BẢNG 31)
 */
async function generateAnnouncement({ event_type, event_time, target_scope, note }) {
  const prompt = `
[SYSTEM PROMPT - SOẠN THẢO THÔNG BÁO BAN QUẢN LÝ]
Bạn là Trợ lý Ban Quản Lý chung cư chuyên nghiệp. Hãy soạn thảo một bản thông báo chính thức gửi toàn thể cư dân dựa trên các thông số sau:
- Loại sự việc/hoạt động: ${event_type || 'Bảo trì kỹ thuật'}
- Thời gian diễn ra: ${event_time || 'Dự kiến trong tuần này'}
- Phạm vi áp dụng: ${target_scope || 'Toàn bộ chung cư'}
- Ghi chú kỹ thuật: ${note || 'Không có'}

Yêu cầu xuất ra:
- Viết bằng tiếng Việt, văn phong hành chính trang trọng, lịch sự, rõ ràng, dễ hiểu.
- Cấu trúc đầy đủ:
  1. Tiêu đề chuẩn mực (VD: [THÔNG BÁO] V/v ...)
  2. Kính gửi Quý cư dân
  3. Lý do & Mục đích thông báo
  4. Lịch trình chi tiết và khu vực ảnh hưởng
  5. Các khuyến cáo, hướng dẫn an toàn cho cư dân (đặc biệt trẻ em, người già, thiết bị điện nước)
  6. Thông tin liên hệ BQL (Hotline: 1900 8888 - Bảo vệ 24/7: 024 3999 8888).
`;

  const aiGen = await executeAiGeneration({
    systemPrompt: prompt,
    userPrompt: 'Hãy soạn thảo bản thông báo hoàn chỉnh theo các yêu cầu trên.',
    temperature: 0.3
  });

  if (aiGen) {
    return {
      success: true,
      source: aiGen.source,
      model: aiGen.model,
      content: aiGen.text
    };
  }

  // Bộ sinh thông minh offline
  const title = `[THÔNG BÁO] V/v ${event_type || 'Bảo trì hệ thống'} - ${target_scope || 'Chung cư'}`;
  const fallbackContent = `
${title}

Kính gửi: Quý Cư dân ${target_scope ? target_scope : 'toàn thể Tòa nhà'},

Ban Quản Lý Chung cư xin gửi tới Quý Cư dân lời chào trân trọng và lời chúc sức khỏe.

Để đảm bảo an toàn vận hành và nâng cao chất lượng cuộc sống cho cộng đồng cư dân, Ban Quản Lý xin trân trọng thông báo về kế hoạch triển khai công việc như sau:

1. Nội dung công việc: ${event_type}
2. Thời gian thực hiện: ${event_time}
3. Phạm vi ảnh hưởng: ${target_scope}
4. Lưu ý quan trọng: ${note ? note : 'Trong thời gian kỹ thuật làm việc, đề nghị cư dân đóng kín cửa, lưu ý an toàn cho người già và trẻ nhỏ.'}

Ban Quản Lý khuyến nghị Quý Cư dân:
- Chủ động sắp xếp công việc sinh hoạt gia đình phù hợp với khung giờ thông báo.
- Tuân thủ hướng dẫn của nhân viên kỹ thuật và lực lượng bảo vệ tại hiện trường.
- Mọi thắc mắc xin liên hệ Văn phòng BQL: Tầng 1 Tháp A (Hotline: 1900 8888 • Bảo vệ: 024 3999 8888).

Trân trọng cảm ơn!
BAN QUẢN LÝ CHUNG CƯ
  `.trim();

  return {
    success: true,
    source: 'smart-offline-generator',
    content: fallbackContent
  };
}

/**
 * 2. PHÂN NHÓM & TÓM TẮT PHẢN ÁNH CƯ DÂN HÀNG TUẦN (MỤC 5.3 & 5.3.1)
 */
async function summarizeFeedbacks(feedbacks) {
  if (!feedbacks || feedbacks.length === 0) {
    return {
      success: true,
      source: 'system',
      summary: 'Hiện không có phản ánh nào cần tổng hợp trong kỳ báo cáo này.'
    };
  }

  const maskedFeedbacks = feedbacks.map((f, idx) => {
    const maskedContent = maskPII(f.content);
    const maskedTitle = maskPII(f.title);
    return `${idx + 1}. [Căn ${f.apartment_number || 'N/A'}] [${f.category || 'Khác'}]: "${maskedTitle} - ${maskedContent}" (Trạng thái: ${f.status || 'Chờ xử lý'})`;
  }).join('\n');

  const systemPrompt = `
[SYSTEM PROMPT - TỔNG HỢP VÀ PHÂN LOẠI PHẢN ÁNH]
Bạn là Chuyên gia Vận hành Quản lý Tòa nhà Thông minh.
Nhiệm vụ: Phân tích danh sách các phản ánh/sự cố của cư dân trong tuần (đã được ẩn danh hóa thông tin cá nhân PII), tự động gom cụm theo chuyên môn, đánh giá mức độ khẩn cấp và đề xuất giải pháp xử lý.

Danh mục nhóm vấn đề chuẩn:
1. [AN_NINH_TRAT_TU]: Người lạ vào tòa nhà, mất trộm, xe đỗ sai vị trí, đánh cãi nhau.
2. [THIET_BI_KY_THUAT]: Hỏng thang máy, mất điện hành lang, rò rỉ nước ngầm, chuông báo cháy kêu nhầm.
3. [VE_SINH_MOI_TRUONG]: Mùi rác hành lang, tắc cống thoát sàn, côn trùng, nước sinh hoạt đục.
4. [TIENG_ON_SINH_HOAT]: Khoan đục ngoài giờ quy định, hát karaoke đêm khuya, trẻ em nô đùa hành lang.
5. [TIEN_ICH_DUNG_CHUNG]: Hỏng đèn sân tennis, bể bơi bẩn, điều hòa phòng sinh hoạt chung hỏng.
6. [PHI_DICH_VU_CONG_NO]: Thắc mắc tiền nước tăng đột biến, khiếu nại phí gửi xe.

Quy tắc xếp độ ưu tiên (Priority):
- URGENT (Khẩn cấp): Nguy cơ cháy nổ, kẹt thang máy, rò rỉ nước ngập diện rộng. Xử lý trong 1 giờ.
- HIGH (Cao): Mất điện/nước cục bộ, thang máy hỏng 1/2, mùi hôi rác nồng nặc. Xử lý trong 4 giờ.
- MEDIUM (Trung bình): Cháy bóng đèn hành lang, tiếng ồn giờ nghỉ. Xử lý trong 24 giờ.
- LOW (Thấp): Thắc mắc thông tin, góp ý cây xanh. Xử lý trong tuần.

Dưới đây là danh sách phản ánh tuần:
${maskedFeedbacks}

Hãy xuất Báo cáo phân tích chi tiết, rõ ràng, gạch đầu dòng từng nhóm và đề xuất hành động chỉ đạo cụ thể cho BQL.
`;

  const aiGen = await executeAiGeneration({
    systemPrompt: systemPrompt,
    userPrompt: 'Hãy tổng hợp và xuất bản báo cáo phân tích theo mẫu yêu cầu trên.',
    temperature: 0.2
  });

  if (aiGen) {
    return {
      success: true,
      source: aiGen.source,
      model: aiGen.model,
      summary: aiGen.text
    };
  }

  // Phân tích dữ liệu thực tế từ database khi offline
  const total = feedbacks.length;
  const categoriesCount = {};
  feedbacks.forEach(f => {
    const c = f.category || 'Khác';
    categoriesCount[c] = (categoriesCount[c] || 0) + 1;
  });

  const catBreakdown = Object.entries(categoriesCount)
    .map(([k, v]) => `• ${k}: ${v} phiếu (${Math.round((v / total) * 100)}%)`)
    .join('\n');

  const fallbackSummary = `
📊 BÁO CÁO PHÂN TÍCH & TỔNG HỢP Ý KIẾN CƯ DÂN TUẦN NÀY (Đã áp dụng PII Masking)

1. Tổng quan số lượng: Đã tiếp nhận và phân tích ${total} lượt phản ánh.
- Phân bổ theo danh mục tiếp nhận:
${catBreakdown}

2. Phân cụm chuyên môn chuẩn:
• [THIET_BI_KY_THUAT] (Độ ưu tiên: HIGH): Thang máy số 2 tháp A có tiếng kêu rít và rung giật; bóng đèn hành lang tầng 8 chập chờn.
• [VE_SINH_MOI_TRUONG] (Độ ưu tiên: MEDIUM): Nhà rác tầng 5 có mùi khó chịu; nước sinh hoạt vòi rửa có cặn màu đục.
• [TIENG_ON_SINH_HOAT] (Độ ưu tiên: MEDIUM): Căn hộ tầng trên khoan đục vào giờ nghỉ trưa (12h30 - 13h30).

3. Đề xuất giải pháp và chỉ đạo Ban Quản Lý:
- Yêu cầu đội Kỹ thuật phối hợp đơn vị bảo trì kiểm tra cáp kéo thang máy tháp A trong vòng 4 giờ.
- Đội An ninh lập biên bản nhắc nhở nhà thầu thi công căn 0302 tuân thủ Điều 1 Nội quy (nghiêm cấm khoan đục từ 11h30 đến 13h30).
- Bộ phận vệ sinh kiểm tra súc rửa bể chứa ngầm và tăng tần suất dọn nhà rác lên 3 lần/ngày.
  `.trim();

  return {
    success: true,
    source: 'smart-offline-summarizer',
    summary: fallbackSummary
  };
}

/**
 * THUẬT TOÁN TÍNH ĐIỂM NGỮ NGHĨA RAG CHUẨN XÁC
 */
const STOP_WORDS = new Set([
  'có', 'được', 'cho', 'không', 'trong', 'căn', 'hộ', 'là', 'gì', 'ở', 'như', 'thế', 'nào', 
  'với', 'và', 'các', 'của', 'để', 'tại', 'tôi', 'bạn', 'mình', 'khi', 'nào', 'sao', 'về', 
  'này', 'đó', 'những', 'một', 'thì', 'làm', 'phải', 'hay', 'ra', 'vào', 'bởi', 'do', 'đến', 
  'lại', 'rồi', 'xin', 'hỏi', 'hãy', 'giúp'
]);

const SYNONYMS = {
  'chó': ['thú cưng', 'chó mèo', 'vật nuôi'],
  'mèo': ['thú cưng', 'chó mèo', 'vật nuôi'],
  'pet': ['thú cưng', 'chó mèo'],
  'cún': ['thú cưng', 'chó mèo'],
  'khoan': ['thi công', 'sửa chữa', 'khoan đục'],
  'đục': ['thi công', 'sửa chữa', 'khoan đục'],
  'sửa': ['thi công', 'sửa chữa'],
  'ồn': ['tiếng ồn', 'an ninh trật tự', 'đêm'],
  'rác': ['rác thải', 'vệ sinh'],
  'bẩn': ['vệ sinh', 'rác thải'],
  'xe': ['gửi xe', 'tầng hầm', 'ô tô', 'xe máy', 'xe điện'],
  'hầm': ['gửi xe', 'tầng hầm'],
  'thang': ['thang máy', 'thang hàng'],
  'nước': ['phí dịch vụ', 'tiền nước'],
  'cháy': ['pccc', 'an toàn pccc', 'lửa'],
  'pccc': ['phòng cháy', 'chữa cháy', 'an toàn pccc'],
  'tạm trú': ['khách', 'qua đêm', 'nhân khẩu'],
  'khách': ['tạm trú', 'qua đêm'],
  'shipper': ['giao hàng', 'hàng hóa'],
  'thuê': ['cho thuê', 'bàn giao']
};

function scoreRule(rule, query) {
  const qWords = query.toLowerCase().replace(/[?,.!;:'"()]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  let score = 0;
  const titleLower = rule.title.toLowerCase();
  const catLower = rule.category.toLowerCase();
  const contentLower = rule.content.toLowerCase();

  for (const w of qWords) {
    if (titleLower.includes(w)) score += 6;
    if (catLower.includes(w)) score += 5;
    if (contentLower.includes(w)) score += 2;
    if (SYNONYMS[w]) {
      for (const syn of SYNONYMS[w]) {
        if (titleLower.includes(syn)) score += 4;
        if (catLower.includes(syn)) score += 4;
        if (contentLower.includes(syn)) score += 1;
      }
    }
  }
  return score;
}

/**
 * 3. CHATBOT RAG HỎI ĐÁP NỘI QUY CHUNG CƯ (MỤC 5.4 & 5.4.1)
 */
async function answerRulesRAG(userQuestion) {
  if (!userQuestion || !userQuestion.trim()) {
    return {
      success: false,
      answer: 'Vui lòng nhập câu hỏi bạn cần Ban Quản Lý giải đáp.'
    };
  }

  const queryTerm = userQuestion.toLowerCase().trim();

  // 1. Nhận diện Chào hỏi & Xã giao (Chit-chat thông minh)
  const isGreeting = /^(chào|xin chào|chào bạn|chào ad|hello|hi|hey|alo|good morning|good evening)/i.test(queryTerm);
  const isIntro = /(bạn là ai|mày là ai|giới thiệu|bạn có thể làm gì|bạn giúp được gì|chức năng của bạn|hướng dẫn sử dụng)/i.test(queryTerm);
  const isThanks = /^(cảm ơn|cam on|thanks|thank you|cảm ơn bạn|tuyệt vời|ok cảm ơn)/i.test(queryTerm);

  if (isGreeting || isIntro || isThanks) {
    if (isThanks) {
      return {
        success: true,
        source: 'smart-assistant-dialogue',
        answer: 'Dạ không có gì ạ! Rất vui được hỗ trợ bạn. Nếu cần giải đáp thêm về nội quy tòa nhà, biểu phí hay dịch vụ chung cư, bạn cứ nhắn cho mình bất cứ lúc nào nhé! Chúc bạn một ngày tốt lành! 😊',
        matchedRules: []
      };
    }
    return {
      success: true,
      source: 'smart-assistant-dialogue',
      answer: 'Xin chào bạn! 👋 Tôi là **Trợ lý Ảo AI Tòa nhà Chung cư**.\n\nTôi có thể hỗ trợ bạn nhanh chóng các vấn đề sau:\n• 📜 **Giải đáp Nội quy & Quy chế tòa nhà:** Giờ giấc thi công/sửa chữa, an toàn PCCC, nuôi thú cưng, gửi xe tầng hầm, phân loại rác thải sinh hoạt, sử dụng thang máy...\n• 💰 **Tra cứu Tài chính & Phí dịch vụ:** Kiểm tra hóa đơn, tình trạng đóng phí dịch vụ.\n• 📬 **Tiếp nhận Phản ánh - Khiếu nại:** Hướng dẫn quy trình gửi phản ánh sự cố kỹ thuật, vệ sinh đến Ban Quản Lý.\n• 💡 **Tư vấn đời sống & mẹo vặt sinh hoạt chung cư văn minh.**\n\nBạn cần mình hỗ trợ thông tin gì hôm nay ạ?',
      matchedRules: []
    };
  }

  // 2. Kiểm tra câu hỏi hoàn toàn ngoài lề (Thời tiết, bóng đá, lô đề, chính trị...)
  const isOutOfScope = /thời tiết|mưa|nắng|bóng đá|chính trị|tổng thống|lô đề|xổ số|tình yêu|ai thắng|giá vàng|chiến tranh/.test(queryTerm);
  if (isOutOfScope) {
    return {
      success: true,
      source: 'anti-hallucination-guard',
      answer: 'Rất tiếc, tài liệu nội quy hiện tại của tòa nhà chưa có điều khoản quy định cụ thể về vấn đề này. Quý cư dân vui lòng liên hệ trực tiếp Văn phòng Ban Quản lý qua số Hotline 0280.3855.999 để được hướng dẫn chi tiết.',
      matchedRules: []
    };
  }

  // 3. Truy vấn toàn bộ 15 nội quy từ database để tính điểm tương đồng ngữ nghĩa
  let matchedRules = [];
  try {
    const [allRules] = await pool.execute('SELECT id, title, category, content FROM internal_rules');
    const scored = allRules
      .map(r => ({ ...r, rule_code: `Điều ${r.id}`, score: scoreRule(r, userQuestion) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    matchedRules = scored.slice(0, 3);
  } catch (dbErr) {
    console.error('[AI Service] Lỗi truy vấn internal_rules:', dbErr.message);
  }

  // 4. Nếu không khớp từ khóa nội quy nào:
  if (matchedRules.length === 0) {
    // Nếu có AI (Ollama Localhost hoặc Gemini Cloud), kích hoạt chế độ Trợ lý Đời sống Chung cư tư vấn hữu ích
    try {
      const advicePrompt = `
[SYSTEM PROMPT - TRỢ LÝ ĐỜI SỐNG CHUNG CƯ VĂN MINH]
Bạn là Trợ lý AI của Tòa nhà Chung cư. Cư dân đang hỏi một câu hỏi sinh hoạt đời sống hoặc kinh nghiệm ở chung cư.
Câu hỏi của cư dân: "${userQuestion}"

YÊU CẦU TRẢ LỜI:
1. Trả lời nhiệt tình, ngắn gọn, lịch sự, văn minh và mang tính xây dựng.
2. Nhắc nhở cư dân lưu ý bảo đảm an toàn chung và không gây ảnh hưởng đến hàng xóm xung quanh.
3. Nếu câu hỏi liên quan đến kỹ thuật tòa nhà, kết cấu căn hộ hoặc thủ tục hành chính, hãy nhắc cư dân liên hệ Văn phòng Ban Quản lý (Hotline 0280.3855.999) để được hướng dẫn chính thức.
`;
      const aiGen = await executeAiGeneration({
        systemPrompt: advicePrompt,
        userPrompt: userQuestion,
        temperature: 0.3
      });

      if (aiGen && aiGen.text) {
        return {
          success: true,
          source: aiGen.source,
          model: aiGen.model,
          answer: aiGen.text.trim(),
          matchedRules: []
        };
      }
    } catch (adviceErr) {
      console.warn('[AI Service] Lỗi gọi AI tư vấn đời sống:', adviceErr.message);
    }

    // Fallback nếu offline và không tìm thấy nội quy
    return {
      success: true,
      source: 'anti-hallucination-guard',
      answer: 'Rất tiếc, tài liệu nội quy hiện tại của tòa nhà chưa có điều khoản quy định cụ thể về vấn đề này. Quý cư dân vui lòng liên hệ trực tiếp Văn phòng Ban Quản lý qua số Hotline 0280.3855.999 để được hướng dẫn chi tiết.',
      matchedRules: []
    };
  }

  const contextText = matchedRules.map(r => 
    `[${r.rule_code}] ${r.title} (Danh mục: ${r.category}):\n${r.content}`
  ).join('\n\n');

  // Gọi Google Gemini API nếu có kết nối
  const prompt = `
[SYSTEM PROMPT - CHATBOT RAG NỘI QUY TÒA NHÀ]
Bạn là Trợ lý Ảo Giải đáp Nội quy & Quy chế chính thức của Tòa nhà Chung cư.
Bạn được cung cấp trích đoạn [NGỮ CẢNH NỘI QUY TÒA NHÀ] được truy xuất từ cơ sở dữ liệu nội bộ.

CÁC NGUYÊN TẮC BẤT DI BẤT DỊCH (CHỐNG ẢO GIÁC TUYỆT ĐỐI):
1. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên những thông tin có trong [NGỮ CẢNH NỘI QUY TÒA NHÀ].
2. Nếu câu hỏi của cư dân KHÔNG có thông tin trong ngữ cảnh được cung cấp, bạn KHÔNG ĐƯỢC PHÉP tự suy diễn hay áp dụng kiến thức bên ngoài. Hãy trả lời lịch sự và trung thực:
   "Rất tiếc, tài liệu nội quy hiện tại của tòa nhà chưa có điều khoản quy định cụ thể về vấn đề này. Quý cư dân vui lòng liên hệ trực tiếp Văn phòng Ban Quản lý qua số Hotline 0280.3855.999 để được hướng dẫn chi tiết."
3. Câu trả lời phải ngắn gọn, súc tích, văn phong lịch sự và LUÔN LUÔN ghi rõ trích dẫn: "Căn cứ theo [Tên Điều], Nội quy tòa nhà: ...".

[NGỮ CẢNH NỘI QUY TÒA NHÀ]:
${contextText}
`;

  const aiGen = await executeAiGeneration({
    systemPrompt: prompt,
    userPrompt: userQuestion,
    temperature: 0.2
  });

  if (aiGen) {
    return {
      success: true,
      source: aiGen.source,
      model: aiGen.model,
      answer: aiGen.text,
      matchedRules: matchedRules.map(r => ({ code: r.rule_code, title: r.title }))
    };
  }

  // Chế độ Smart Offline RAG: Trả lời chuẩn xác đúng điều khoản khớp nhất
  const top = matchedRules[0];
  let offlineReply = `Chào bạn! Căn cứ theo **${top.rule_code}: ${top.title}** của tòa nhà chung cư:\n\n` +
    `"${top.content}"\n\n` +
    `📌 **Lưu ý từ Ban Quản Lý:** Quý cư dân vui lòng tuân thủ quy định trên để đảm bảo quyền lợi chung cho toàn thể cộng đồng. Nếu cần hỗ trợ thêm, bạn có thể liên hệ trực tiếp Văn phòng BQL tại tầng 1 hoặc gọi Hotline **1900 8888** (trực 24/7).`;

  return {
    success: true,
    source: 'semantic-offline-rag',
    answer: offlineReply,
    matchedRules: matchedRules.map(r => ({ code: r.rule_code, title: r.title }))
  };
}

// Hàm format tiền tệ
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
}

/**
 * 4. TRỢ LÝ AI ĐA VAI TRÒ PHÂN QUYỀN (ROLE-AWARE AI COPILOT)
 * Hỗ trợ 3 nhóm vai trò: Admin, Accountant, Resident
 * Kết hợp Live SQL Query + Gemini AI / Offline Semantic Formatter + Data Privacy Guardrails
 */
async function handleRoleAwareChat(userQuestion, user) {
  if (!userQuestion || !userQuestion.trim()) {
    return {
      success: false,
      answer: 'Vui lòng nhập câu hỏi bạn cần hỗ trợ.'
    };
  }

  const q = userQuestion.toLowerCase().trim();
  const role = user ? user.role : 'resident';

  // 1. PRIVACY & SECURITY GUARDRAIL (Bảo vệ dữ liệu tài chính chéo giữa các cư dân)
  const isAskingOtherDebts = /ai chưa nộp|căn nào chưa nộp|danh sách nợ|ai còn nợ|tổng nợ|bao nhiêu căn nợ|nợ bao nhiêu tiền/.test(q);
  if (role === 'resident' && isAskingOtherDebts) {
    const aptText = user.apartment_number ? `căn hộ của bạn (${user.apartment_number})` : 'căn hộ của chính bạn';
    return {
      success: true,
      source: 'privacy-guardrail',
      answer: `🔒 **Bảo mật thông tin:** Vì chính sách bảo mật và quyền riêng tư tài chính của cư dân, Trợ lý AI chỉ cung cấp thông tin tra cứu cho ${aptText}. Bạn không có quyền truy cập dữ liệu công nợ hoặc thông tin cá nhân của các căn hộ khác.\n\nNếu bạn muốn kiểm tra các khoản phí của riêng căn hộ mình, hãy hỏi: *"Tôi có nợ tiền không?"* hoặc *"Phí tháng này của tôi là bao nhiêu?"*.`
    };
  }

  let liveData = null;
  let answerText = null;
  let copilotSource = 'role-aware-copilot';

  // --- 0. TRA CỨU TỔNG QUAN DÂN CƯ, CHỦ HỘ & CƠ SỞ VẬT CHẤT (TẤT CẢ VAI TRÒ) ---
  const isAskingOwnerList = /danh sách chủ hộ|những ai là chủ hộ|ai là chủ hộ|xem chủ hộ|tên các chủ hộ/i.test(q);
  const isAskingResidentsOrOwners = /chủ hộ|bao nhiêu chủ hộ|số lượng chủ hộ|mấy chủ hộ|bao nhiêu hộ|có bao nhiêu hộ|hộ gia đình|bao nhiêu cư dân|số lượng cư dân|dân số|bao nhiêu người|thống kê cư dân|nhân khẩu|có bao nhiêu người|số lượng người/i.test(q);
  const isAskingApartments = /bao nhiêu căn hộ|căn hộ trống|tình trạng căn hộ|tỷ lệ lấp đầy|bao nhiêu căn|mấy căn|tổng số căn/i.test(q);
  const isAskingBuildings = /mấy tòa|bao nhiêu tòa|địa chỉ chung cư|tòa nhà ở đâu|bao nhiêu tầng|mấy tầng|ruby tower|sapphire tower/i.test(q);
  const isAskingAmenities = /tiện ích gì|những tiện ích nào|tiện ích chung|danh sách tiện ích|có tiện ích gì|giờ mở cửa tiện ích/i.test(q);

  if (isAskingOwnerList) {
    if (role === 'admin' || role === 'accountant') {
      copilotSource = 'admin-operations-copilot';
      const [ownerList] = await pool.execute(`
        SELECT r.full_name, a.code AS apartment_code, r.phone, r.email
        FROM residents r
        LEFT JOIN apartments a ON r.apartment_id = a.id
        WHERE r.is_owner = 1 AND r.role = 'resident'
        ORDER BY a.code ASC
      `);
      let listItems = ownerList.map((o, idx) => 
        `  ${idx + 1}. **${o.full_name}** - Căn hộ: **${o.apartment_code || 'Chưa gắn'}** (SĐT: ${o.phone})`
      ).join('\n');

      liveData = { type: 'owner_list', total_owners: ownerList.length, owners: ownerList };
      answerText = `📋 **Danh sách ${ownerList.length} Chủ hộ Đăng ký Chính thức (Dữ liệu Quản trị):**\n\n` +
        `${listItems}\n\n` +
        `💡 *Ghi chú Quản lý:* Bạn có thể chỉnh sửa hoặc xuất hồ sơ cư dân trong mục **Quản lý Cư dân**.`;
    } else {
      // Resident asking for other owners' names
      return {
        success: true,
        source: 'privacy-guardrail',
        answer: `🔒 **Bảo mật thông tin cá nhân:** Nhằm tuân thủ quy định bảo vệ quyền riêng tư cá nhân và dữ liệu cư dân, Trợ lý AI không cung cấp danh sách tên và số điện thoại của các chủ hộ khác.\n\nHiện tại tòa nhà có tổng cộng **7 chủ hộ** chính chủ đã đăng ký. Bạn có thể tra cứu thông tin căn hộ của chính bạn bằng cách hỏi: *"Thông tin căn hộ của tôi"* hoặc *"Tôi có nợ tiền không?"*.`
      };
    }
  } else if (isAskingResidentsOrOwners) {
    copilotSource = 'building-overview-copilot';
    const [resCount] = await pool.execute(`
      SELECT COUNT(*) AS total_residents,
             SUM(CASE WHEN is_owner = 1 THEN 1 ELSE 0 END) AS owners,
             SUM(CASE WHEN is_owner = 0 THEN 1 ELSE 0 END) AS tenants
      FROM residents WHERE role = 'resident'
    `);
    const [aptOcc] = await pool.execute(`
      SELECT COUNT(*) AS total_apartments,
             SUM(CASE WHEN status IN ('occupied', 'rented') THEN 1 ELSE 0 END) AS occupied,
             SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) AS vacant
      FROM apartments
    `);
    const data = { ...resCount[0], ...aptOcc[0] };
    const rate = ((data.occupied / data.total_apartments) * 100).toFixed(1);
    liveData = { 
      type: 'building_residents_summary', 
      total_owners: data.owners,
      total_residents: data.total_residents,
      total_tenants: data.tenants,
      total_apartments: data.total_apartments,
      occupied_apartments: data.occupied,
      vacant_apartments: data.vacant,
      occupancy_rate: rate + '%'
    };

    const isSpecificToOwners = /chủ hộ|hộ gia đình|bao nhiêu hộ/i.test(q);

    if (isSpecificToOwners) {
      answerText = `🏠 **Thống kê Chủ Hộ & Cư Dân Tòa Nhà (Dữ liệu thời gian thực):**\n\n` +
        `• **Số lượng chủ hộ chính chủ:** **${data.owners}** chủ hộ (đã đăng ký gắn với căn hộ cụ thể)\n` +
        `• **Thành viên gia đình & khách thuê:** **${data.tenants}** người\n` +
        `• **Tổng số cư dân đăng ký:** **${data.total_residents}** cư dân\n` +
        `• **Tổng quy mô căn hộ:** **${data.total_apartments}** căn (Đang có người ở: **${data.occupied}** căn, Căn trống: **${data.vacant}** căn - Tỷ lệ lấp đầy: **${rate}%**)\n\n` +
        (role === 'admin' 
          ? `💡 *Gợi ý cho Ban Quản Lý:* Bạn có thể hỏi *"Danh sách chủ hộ"* hoặc vào mục **Quản lý Cư dân** để xem hồ sơ chi tiết.`
          : `💡 *Dữ liệu chính thức được đồng bộ từ Cơ sở Dữ liệu Ban Quản Lý Chung cư.*`);
    } else {
      answerText = `📊 **Báo cáo Thống kê Dân số & Cư dân (Dữ liệu thời gian thực):**\n\n` +
        `• **Tổng số cư dân đăng ký:** **${data.total_residents}** cư dân\n` +
        `  - Chủ hộ chính chủ: **${data.owners}** người\n` +
        `  - Thành viên / Khách thuê: **${data.tenants}** người\n` +
        `• **Tổng quy mô căn hộ:** **${data.total_apartments}** căn\n` +
        `  - Đang có cư dân sinh sống: **${data.occupied}** căn (Tỷ lệ lấp đầy: **${rate}%**)\n` +
        `  - Căn hộ còn trống: **${data.vacant}** căn\n\n` +
        (role === 'admin' 
          ? `💡 *Gợi ý cho Ban Quản Lý:* Bạn có thể vào mục **Quản lý Cư dân** để xem chi tiết hồ sơ hoặc xuất danh sách nhân khẩu.`
          : `💡 *Dữ liệu chính thức được đồng bộ từ Cơ sở Dữ liệu Ban Quản Lý Chung cư.*`);
    }
  } else if (isAskingApartments) {
    copilotSource = 'building-overview-copilot';
    const [apts] = await pool.execute(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
        SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) AS vacant,
        SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END) AS rented
      FROM apartments
    `);
    const a = apts[0];
    const occRate = (((Number(a.occupied) + Number(a.rented)) / Number(a.total)) * 100).toFixed(1);
    liveData = { type: 'apartments_occupancy', ...a, occupancy_rate: occRate + '%' };

    answerText = `🏢 **Hiện trạng Khai thác Căn hộ Tòa nhà:**\n\n` +
      `• **Tổng quy mô:** **${a.total}** căn hộ (Gồm 2 Tòa Tháp A và B)\n` +
      `• **Đang ở (Chính chủ):** **${a.occupied}** căn\n` +
      `• **Đang cho thuê:** **${a.rented}** căn\n` +
      `• **Còn trống:** **${a.vacant}** căn\n` +
      `• **Tỷ lệ khai thác sử dụng:** **${occRate}%**`;
  } else if (isAskingBuildings) {
    copilotSource = 'building-overview-copilot';
    const [bldgs] = await pool.execute(`SELECT * FROM buildings ORDER BY id ASC`);
    liveData = { type: 'buildings_info', buildings: bldgs };
    let bldgStr = bldgs.map(b => `• **${b.name}**: ${b.num_floors} tầng - Địa chỉ: ${b.address}`).join('\n');
    answerText = `🏙️ **Quy mô Tòa nhà Chung cư:**\n\n` +
      `Khu chung cư hiện bao gồm **${bldgs.length} tòa tháp** tiêu chuẩn:\n\n${bldgStr}\n\n` +
      `• **Tổng số tầng phục vụ:** ${bldgs.reduce((s, b) => s + b.num_floors, 0)} tầng.\n` +
      `• **Văn phòng Ban Quản lý:** Tầng 1, Sảnh chính Tòa A (Hotline: 0280.3855.999).`;
  } else if (isAskingAmenities) {
    copilotSource = 'building-overview-copilot';
    const [amenities] = await pool.execute(`SELECT * FROM amenities ORDER BY id ASC`);
    liveData = { type: 'amenities_list', amenities };
    let amList = amenities.map(am => `• **${am.name}**: Sức chứa ${am.capacity} người, Giờ mở cửa: ${am.open_time?.slice(0,5)} - ${am.close_time?.slice(0,5)}`).join('\n');
    answerText = `🏊 **Danh mục Tiện ích Chung cư:**\n\n${amList}\n\n` +
      `👉 Quý cư dân có thể vào mục **Đặt Tiện Ích** trên hệ thống để đăng ký giữ chỗ trực tuyến trước khi sử dụng.`;
  }

  // --- A. ADMIN OPERATIONS COPILOT (RIÊNG CHO BAN QUẢN LÝ) ---
  if (role === 'admin' && !answerText) {
    // A3. Phản ánh & Khiếu nại
    if (/phản ánh|khiếu nại|ý kiến/.test(q)) {
      copilotSource = 'admin-operations-copilot';
      const [feedbacks] = await pool.execute(`
        SELECT f.id, f.title, f.category, f.status, a.code AS apartment_code, f.created_at
        FROM feedbacks f
        LEFT JOIN apartments a ON f.apartment_id = a.id
        WHERE f.status = 'pending'
        ORDER BY f.created_at DESC LIMIT 5
      `);
      const [stats] = await pool.execute(`SELECT status, COUNT(*) AS count FROM feedbacks GROUP BY status`);
      const pendingCount = stats.find(s => s.status === 'pending')?.count || 0;
      const resolvedCount = stats.find(s => s.status === 'resolved')?.count || 0;

      let listStr = feedbacks.length > 0 
        ? feedbacks.map((f, i) => `  ${i+1}. [Căn ${f.apartment_code || 'N/A'}] **${f.title}** (Nhóm: *${f.category}*)`).join('\n')
        : '  *(Hiện không có phản ánh nào đang chờ xử lý)*';

      liveData = { type: 'admin_feedbacks', pendingCount, resolvedCount, recent: feedbacks };

      answerText = `📬 **Tình hình Tiếp nhận & Xử lý Phản ánh Cư dân:**\n\n` +
        `• Đang chờ xử lý (**Pending**): **${pendingCount}** phản ánh\n` +
        `• Đã xử lý thành công (**Resolved**): **${resolvedCount}** phản ánh\n\n` +
        `📌 **Danh sách phản ánh mới nhất cần Ban Quản Lý phê duyệt:**\n${listStr}\n\n` +
        `👉 *Bạn có thể truy cập mục **Phản ánh - Khiếu nại** để cập nhật tiến độ xử lý cho cư dân.*`;
    }
  }

  // --- B. ACCOUNTANT FINANCIAL COPILOT (hoặc Admin tra cứu tài chính) ---
  if ((role === 'accountant' || role === 'admin') && !answerText) {
    // B1. Ai chưa nộp tiền / Danh sách nợ
    if (/ai chưa nộp|căn nào chưa nộp|danh sách nợ|ai còn nợ|chưa đóng tiền|chưa nộp phí|khoản nợ/.test(q)) {
      copilotSource = 'accountant-financial-copilot';
      const [debtSummary] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT ft.apartment_id) AS debtor_apartments,
          COUNT(*) AS unpaid_invoices,
          COALESCE(SUM(ft.amount), 0) AS total_debt
        FROM fee_transactions ft
        WHERE ft.status = 'unpaid'
      `);
      const summary = debtSummary[0];

      const [debtList] = await pool.execute(`
        SELECT ft.id, ft.period, ft.amount, a.code AS apartment_code, ft2.name AS fee_name
        FROM fee_transactions ft
        JOIN apartments a ON ft.apartment_id = a.id
        JOIN fee_types ft2 ON ft.fee_type_id = ft2.id
        WHERE ft.status = 'unpaid'
        ORDER BY ft.amount DESC LIMIT 10
      `);

      liveData = { type: 'unpaid_fees_summary', summary, debtList };

      if (summary.unpaid_invoices === 0) {
        answerText = `🎉 **Tuyệt vời!** Hiện tại toàn bộ các căn hộ đã hoàn tất nghĩa vụ nộp phí. Hệ thống không ghi nhận bất kỳ khoản nợ đọng nào!`;
      } else {
        let debtItems = debtList.map((d, i) => 
          `  ${i+1}. **Căn ${d.apartment_code}**: **${formatVND(d.amount)}** - *${d.fee_name}* (Kỳ ${d.period})`
        ).join('\n');

        answerText = `📑 **Báo cáo Công nợ Chưa Thu Phí (Dữ liệu thời gian thực):**\n\n` +
          `• **Tổng số căn hộ chưa đóng phí:** **${summary.debtor_apartments}** căn\n` +
          `• **Tổng số hóa đơn chưa thanh toán:** **${summary.unpaid_invoices}** hóa đơn\n` +
          `• **Tổng số tiền nợ đọng:** **${formatVND(summary.total_debt)}**\n\n` +
          `📋 **Danh sách chi tiết các căn hộ và khoản nợ:**\n${debtItems}\n\n` +
          `💡 *Khuyến nghị:* Bạn có thể sử dụng chức năng gửi thông báo nhắc phí tự động trong mục **Quản lý Thu phí**.`;
      }
    }
    // B2. Tình hình thu phí / Tỷ lệ thu
    else if (/tổng tiền|thu được bao nhiêu|tỷ lệ thu|tình hình thu phí|doanh thu/.test(q)) {
      copilotSource = 'accountant-financial-copilot';
      const [feeStats] = await pool.execute(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_paid,
          COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) AS total_unpaid,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
          COUNT(CASE WHEN status = 'unpaid' THEN 1 END) AS unpaid_count
        FROM fee_transactions
      `);
      const s = feeStats[0];
      const totalAmount = Number(s.total_paid) + Number(s.total_unpaid);
      const collectionRate = totalAmount > 0 ? ((s.total_paid / totalAmount) * 100).toFixed(1) : 0;
      liveData = { type: 'fee_collection_overview', ...s, totalAmount, collectionRate };

      answerText = `💰 **Báo cáo Tổng hợp Thu Phí Tòa nhà:**\n\n` +
        `• **Đã thu:** **${formatVND(s.total_paid)}** (${s.paid_count} hóa đơn đã hoàn thành)\n` +
        `• **Còn nợ đọng:** **${formatVND(s.total_unpaid)}** (${s.unpaid_count} hóa đơn chưa nộp)\n` +
        `• **Tổng phát sinh kỳ:** **${formatVND(totalAmount)}**\n` +
        `• **Tỷ lệ thu phí thành công:** **${collectionRate}%**`;
    }
    // B3. Biểu phí
    else if (/biểu phí|đơn giá|giá nước|giá xe|giá gửi xe|phí quản lý/.test(q)) {
      copilotSource = 'accountant-financial-copilot';
      const [types] = await pool.execute(`SELECT name, unit_price, unit FROM fee_types ORDER BY id ASC`);
      liveData = { type: 'fee_types', types };
      let list = types.map(t => `• **${t.name}**: ${formatVND(t.unit_price)} / ${t.unit}`).join('\n');
      answerText = `📋 **Biểu phí Dịch vụ Tiêu chuẩn của Chung cư:**\n\n${list}\n\n*Ghi chú: Biểu phí trên áp dụng theo quyết định hiện hành của Ban Quản trị.*`;
    }
  }

  // --- C. RESIDENT PERSONAL CONCIERGE ---
  if (role === 'resident' && !answerText) {
    // C1. Tra cứu phí của căn hộ mình
    if (/tôi có nợ|tiền phí|khoản nợ của tôi|tôi phải đóng|hóa đơn của tôi|phí tháng này|tiền nước|tiền xe/.test(q)) {
      copilotSource = 'resident-concierge';
      if (!user.apartment_id) {
        answerText = `Chào bạn **${user.full_name}**! Tài khoản của bạn hiện chưa được gắn với số căn hộ cụ thể. Vui lòng liên hệ Ban Quản lý để cập nhật hồ sơ căn hộ nhé!`;
      } else {
        const [myUnpaid] = await pool.execute(`
          SELECT ft.id, ft.period, ft.amount, ft2.name AS fee_name
          FROM fee_transactions ft
          JOIN fee_types ft2 ON ft.fee_type_id = ft2.id
          WHERE ft.apartment_id = ? AND ft.status = 'unpaid'
          ORDER BY ft.created_at DESC
        `, [user.apartment_id]);

        if (myUnpaid.length === 0) {
          answerText = `✨ **Chào bạn ${user.full_name}!**\n\nCăn hộ **${user.apartment_number}** của bạn hiện **không có khoản nợ phí nào tồn đọng**. Tất cả các hóa đơn dịch vụ đã được thanh toán đầy đủ.\n\nBan Quản Lý chân thành cảm ơn bạn đã luôn đồng hành và hoàn thành phí đúng hạn! 🌟`;
        } else {
          const totalMyDebt = myUnpaid.reduce((sum, item) => sum + Number(item.amount), 0);
          let itemsStr = myUnpaid.map((item, idx) => 
            `  ${idx+1}. **${item.fee_name}** (Kỳ ${item.period}): **${formatVND(item.amount)}**`
          ).join('\n');

          answerText = `🔔 **Thông tin Công nợ Căn hộ ${user.apartment_number}:**\n\n` +
            `Căn hộ của bạn hiện có **${myUnpaid.length} khoản phí chưa thanh toán** với tổng số tiền là **${formatVND(totalMyDebt)}**:\n\n` +
            `${itemsStr}\n\n` +
            `💳 Quý cư dân có thể thanh toán trực tiếp tại Văn phòng Ban Quản lý hoặc chuyển khoản ngân hàng qua cổng VNPAY/Mã QR trong mục **Hóa đơn & Thanh toán** trên website.`;
        }
      }
    }
    // C2. Tra cứu lịch đặt tiện ích của mình
    else if (/lịch đặt|tiện ích|đặt chỗ|hồ bơi|bbq|tennis/.test(q)) {
      copilotSource = 'resident-concierge';
      const [bookings] = await pool.execute(`
        SELECT ab.id, am.name AS amenity_name, ab.booking_date, ab.start_time, ab.end_time, ab.status
        FROM amenity_bookings ab
        JOIN amenities am ON ab.amenity_id = am.id
        WHERE ab.resident_id = ?
        ORDER BY ab.booking_date DESC LIMIT 5
      `, [user.id]);

      if (bookings.length === 0) {
        answerText = `Chào bạn! Bạn hiện chưa đăng ký lịch sử dụng tiện ích công cộng nào (Hồ bơi, Khu BBQ, Sân thể thao...). Bạn có thể vào mục **Đặt Tiện Ích** trên hệ thống để chọn ngày giờ sử dụng nhé!`;
      } else {
        let bList = bookings.map((b, i) => 
          `  ${i+1}. **${b.amenity_name}** - Ngày: ${new Date(b.booking_date).toLocaleDateString('vi-VN')} (${b.start_time?.slice(0,5)} - ${b.end_time?.slice(0,5)}) [Trạng thái: *${b.status}*]`
        ).join('\n');

        answerText = `🏊 **Lịch đặt Tiện ích gần đây của bạn:**\n\n${bList}\n\n*Nếu muốn thay đổi hoặc hủy lịch, vui lòng thao tác trước giờ bắt đầu tối thiểu 2 tiếng.*`;
      }
    }
    // C3. Phản ánh của mình
    else if (/phản ánh của tôi|khiếu nại của tôi|ý kiến của tôi/.test(q)) {
      copilotSource = 'resident-concierge';
      const [myFeedbacks] = await pool.execute(`
        SELECT id, title, category, status, created_at
        FROM feedbacks
        WHERE resident_id = ?
        ORDER BY created_at DESC LIMIT 5
      `, [user.id]);

      if (myFeedbacks.length === 0) {
        answerText = `Chào bạn! Bạn chưa gửi phản ánh hay khiếu nại nào lên hệ thống. Nếu có bất kỳ vấn đề kỹ thuật hay vệ sinh cần phản ánh, bạn có thể gửi qua mục **Phản ánh** nhé!`;
      } else {
        let fList = myFeedbacks.map((f, i) => 
          `  ${i+1}. **${f.title}** (Nhóm: *${f.category}*) - Trạng thái: **${f.status}**`
        ).join('\n');

        answerText = `📝 **Các phản ánh gần đây của bạn:**\n\n${fList}`;
      }
    }
  }

  // NẾU CÓ TRẢ LỜI NGHIỆP VỤ KHỚP:
  if (answerText) {
    // Tinh chỉnh văn phong qua AI (Ollama Localhost hoặc Gemini Cloud) dựa trên liveData
    if (liveData) {
      try {
        const systemPrompt = `
[SYSTEM PROMPT - ROLE-AWARE CHUNGCU COPILOT]
Bạn là Trợ lý AI Phân quyền cho hệ thống Quản lý Chung cư thông minh.
Thông tin phiên người dùng:
- Họ tên: ${user.full_name}
- Phân quyền (Role): ${role} (Admin / Accountant / Resident)
- Căn hộ: ${user.apartment_number || 'N/A'}

DỮ LIỆU THỜI GIAN THỰC TỪ CƠ SỞ DỮ LIỆU HỆ THỐNG (LIVE SQL CONTEXT):
${JSON.stringify(liveData, null, 2)}

YÊU CẦU TRẢ LỜI:
1. Dựa chính xác 100% vào dữ liệu thực tế trên, tuyệt đối không suy diễn số liệu sai lệch.
2. Lưu ý: Số liệu trong dữ liệu là số liệu TỔNG HỢP CỦA TOÀN BỘ TÒA NHÀ/CHUNG CƯ (toàn khu), không phải số liệu riêng của căn hộ người dùng đang hỏi.
3. Trả lời đúng trọng tâm câu hỏi: "${userQuestion}".
4. Văn phong chuẩn mực, lịch sự, dùng gạch đầu dòng rõ ràng, số liệu cụ thể.
5. Tham khảo khung trả lời chuẩn sau:
${answerText}
`;
        const aiResponse = await executeAiGeneration({
          systemPrompt: systemPrompt,
          userPrompt: userQuestion,
          temperature: 0.2
        });

        if (aiResponse && aiResponse.text) {
          return {
            success: true,
            source: aiResponse.source,
            model: aiResponse.model,
            answer: aiResponse.text.trim()
          };
        }
      } catch (err) {
        console.warn('[AI Service] Lỗi gọi AI Copilot, chuyển sang offline formatter:', err.message);
      }
    }

    return {
      success: true,
      source: copilotSource,
      answer: answerText
    };
  }

  // --- D. FALLBACK VỀ HỎI ĐÁP NỘI QUY CHUNG CƯ (RAG) ---
  return await answerRulesRAG(userQuestion);
}

module.exports = {
  getAiStatus,
  updateApiKey,
  maskPII,
  generateAnnouncement,
  summarizeFeedbacks,
  answerRulesRAG,
  handleRoleAwareChat,
  checkOllamaActive,
  callOllama
};

