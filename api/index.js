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

// Express app là một handler (req, res) hợp lệ cho Vercel Node runtime.
const app = createApp(ensureReady);
module.exports = app;
