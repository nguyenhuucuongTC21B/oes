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

let app = null;
let bootError = null;

/** Tạo hàm lazy-boot riêng cho instance (nhận module qua tham số để tách scope). */
function makeEnsureReady(driveClient, dataStore) {
  let readyPromise = null;
  return function ensureReady() {
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
  };
}

/**
 * Nạp module trong try/catch: nếu lỗi xảy ra lúc nạp module (env var sai định
 * dạng, bundle hỏng...), handler vẫn được export thành công và trả về trang
 * chẩn đoán JSON — thay vì cả lambda sập với 500 FUNCTION_INVOCATION_FAILED
 * không một manh mối.
 *
 * Đồng thời chấp nhận CẢ HAI dạng export của src/app.js:
 *  - bản mới: module.exports = createApp (hàm)
 *  - bản cũ:  module.exports = { createApp }
 * → repo GitHub chỉ cần cập nhật file này là đủ, không phụ thuộc thứ tự.
 */
try {
  const driveClient = require('../src/drive/driveClient');
  const dataStore = require('../src/store/dataStore');
  const appModule = require('../src/app');
  const createApp = typeof appModule === 'function' ? appModule : appModule.createApp;
  app = createApp(makeEnsureReady(driveClient, dataStore));
} catch (err) {
  bootError = err;
  console.error('[oes] LOI NGHIEM TRONG khi khoi tao module:', (err && err.stack) || err);
}

/**
 * Export MỘT HÀM HANDLER được ĐỊNH NGHĨA NGAY TRONG FILE NÀY.
 *
 * ⚠️ KHÔNG được `module.exports = app` (app được tạo ra từ src/app.js):
 * runtime Node của Vercel tự truy vết export về module nơi giá trị được tạo ra
 * và yêu cầu module đó export một hàm. Hàm bọc dưới đây được định nghĩa tại
 * chỗ nên việc kiểm tra export luôn pass — kể cả khi truy vết sâu hơn,
 * src/app.js bản mới cũng đã export hàm createApp (xem src/app.js).
 */
async function handler(req, res) {
  if (bootError) {
    // Lỗi khởi tạo: trả JSON chẩn đoán để đọc ngay trên trình duyệt.
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(
      JSON.stringify(
        {
          ok: false,
          error: 'OES_INITIALIZATION_FAILED',
          message: String((bootError && bootError.message) || bootError),
          hint:
            'Kiem tra Environment Variables tren Vercel (GOOGLE_SERVICE_ACCOUNT_JSON, ' +
            'GOOGLE_DRIVE_FOLDER_ID, ADMIN_CCCDS, SESSION_SECRET) va xem Runtime Logs ' +
            'trong Dashboard, dong "LOI NGHIEM TRONG khi khoi tao module".',
        },
        null,
        2
      )
    );
    return;
  }
  return app(req, res);
}

module.exports = handler;
// Tương thích ESM-interop: nếu runtime tra `exports.default` vẫn thấy handler.
module.exports.default = handler;
