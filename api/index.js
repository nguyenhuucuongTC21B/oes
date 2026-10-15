/**
 * api/index.js — ĐIỂM VÀO SERVERLESS CHO VERCEL.
 *
 * Trên Vercel KHÔNG có quá trình server sống lâu: mỗi yêu cầu có thể chạy trên
 * một "lambda instance" mới. Vì vậy:
 *  - KHÔNG gọi dataStore.init() lúc nạp module — thay vào đó dùng "lazy boot":
 *    yêu cầu đầu tiên của mỗi instance sẽ kích hoạt khởi tạo 1 lần duy nhất
 *    (kết quả được cache trong biến readyPromise trong suốt vòng đời instance).
 *  - Toàn bộ bảo toàn dữ liệu nằm ở dataStore (baseline-merge khi ghi) và
 *    attempt token HMAC (phiên thi stateless) — xem src/store/dataStore.js.
 *
 * Chạy local: dùng `npm start` (server.js) — không cần file này.
 */
'use strict';

const driveClient = require('../src/drive/driveClient');
const dataStore = require('../src/store/dataStore');
const { createApp } = require('../src/app');

/** Khởi tạo 1 lần cho mỗi instance (lazy — chỉ chạy khi có request đầu tiên). */
let readyPromise = null;
function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      console.log('[oes] Khoi tao instance serverless (lazy boot)...');
      driveClient.init();
      await dataStore.init();
      console.log('[oes] Instance san sang nhan request.');
    })().catch((err) => {
      readyPromise = null; // Cho phép thử lại ở request sau.
      throw err;
    });
  }
  return readyPromise;
}

const app = createApp(ensureReady);

/**
 * Export MỘT HÀM HANDLER được ĐỊNH NGHĨA NGAY TRONG FILE NÀY.
 *
 * ⚠️ KHÔNG được `module.exports = app` (app được tạo ra từ src/app.js):
 * runtime Node của Vercel tự truy vết export về module nơi giá trị được tạo ra
 * — src/app.js exports một OBJECT `{ createApp }` chứ không phải hàm, nên
 * Vercel từ chối với lỗi:
 *   "Invalid export found in module /var/task/src/app.js.
 *    The default export must be a function or server."
 * → process exit 1, mọi request trả 500.
 * Hàm bọc dưới đây được định nghĩa tại chỗ nên việc kiểm tra export luôn pass.
 */
async function handler(req, res) {
  return app(req, res);
}

module.exports = handler;
// Tương thích ESM-interop: nếu runtime tra `exports.default` vẫn thấy handler.
module.exports.default = handler;
