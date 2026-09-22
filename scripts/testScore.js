const mysql = require('mysql2/promise');
require('dotenv').config();

const STOP_WORDS = new Set(['có', 'được', 'cho', 'không', 'trong', 'căn', 'hộ', 'là', 'gì', 'ở', 'như', 'thế', 'nào', 'với', 'và', 'các', 'của', 'để', 'tại', 'tôi', 'bạn', 'mình', 'khi', 'nào', 'sao', 'về', 'này', 'đó', 'những', 'một', 'thì', 'làm', 'phải', 'hay', 'ra', 'vào', 'bởi', 'do', 'đến', 'lại', 'rồi']);

const SYNONYMS = {
  'chó': ['thú cưng', 'chó mèo', 'vật nuôi'],
  'mèo': ['thú cưng', 'chó mèo', 'vật nuôi'],
  'pet': ['thú cưng', 'chó mèo'],
  'khoan': ['thi công', 'sửa chữa', 'khoan đục'],
  'đục': ['thi công', 'sửa chữa', 'khoan đục'],
  'ồn': ['tiếng ồn', 'an ninh trật tự'],
  'rác': ['rác thải', 'vệ sinh'],
  'xe': ['gửi xe', 'tầng hầm'],
  'thang': ['thang máy']
};

function scoreRule(rule, query) {
  const qWords = query.toLowerCase().replace(/[?,.!;:'"()]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  let score = 0;
  const titleLower = rule.title.toLowerCase();
  const catLower = rule.category.toLowerCase();
  const contentLower = rule.content.toLowerCase();

  for (const w of qWords) {
    if (titleLower.includes(w)) score += 5;
    if (catLower.includes(w)) score += 4;
    if (contentLower.includes(w)) score += 2;
    if (SYNONYMS[w]) {
      for (const syn of SYNONYMS[w]) {
        if (titleLower.includes(syn)) score += 3;
        if (catLower.includes(syn)) score += 3;
      }
    }
  }
  return score;
}

async function testQuery(q) {
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'apartment_management' });
  const [rules] = await conn.query('SELECT id, title, category, content FROM internal_rules');
  const scored = rules.map(r => ({ ...r, score: scoreRule(r, q) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  console.log('Câu hỏi: "' + q + '" -> Khớp: ' + (scored[0] ? scored[0].title + ' [Score: ' + scored[0].score + ']' : 'Không khớp'));
  await conn.end();
}

async function run() {
  await testQuery('Có được nuôi chó trong căn hộ không?');
  await testQuery('Mấy giờ cấm khoan đục sửa nhà?');
  await testQuery('Rác thải sinh hoạt vứt ở đâu và mấy giờ?');
  await testQuery('Quy định gửi xe máy xe điện dưới hầm?');
  await testQuery('Thang máy số 2 đi như thế nào?');
  await testQuery('Mai trời có mưa không?');
}
run();
