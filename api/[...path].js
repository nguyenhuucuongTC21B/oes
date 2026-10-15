/**
 * api/[...path].js — CATCH-ALL DYNAMIC ROUTE CỦA VERCEL.
 *
 * Bắt TẤT CẢ request /api/* (ví dụ /api/auth/login, /api/exams...) theo cơ chế
 * định tuyến gốc của Vercel — KHÔNG phụ thuộc cấu hình rewrite, đảm bảo
 * Express luôn nhận đúng URL gốc của request.
 *
 * Handler dùng chung với api/index.js (nơi định nghĩa handler thật).
 * Lưu ý: export phải là hàm định nghĩa ngay trong file này — quy tắc bắt buộc
 * của runtime Vercel (tránh lỗi "Invalid export found in module ...").
 */
'use strict';

const entry = require('./index.js');

/** Chấp nhận mọi dạng export lịch sử: hàm / { default } / { createApp }. */
function resolveHandler(mod) {
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;
  if (mod && typeof mod.createApp === 'function') {
    const app = mod.createApp(null);
    return async function (req, res) {
      return app(req, res);
    };
  }
  return null;
}

const resolved = resolveHandler(entry);

if (!resolved) {
  console.error('[oes] Khong the suy ra handler tu api/index.js — kiem tra file nay.');
}

/** Handler bọc — ĐỊNH NGHĨA NGAY TRONG FILE (quy tắc export của Vercel). */
async function vercelHandler(req, res) {
  if (!resolved) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'OES_HANDLER_NOT_RESOLVED' }));
    return;
  }
  return resolved(req, res);
}

module.exports = vercelHandler;
module.exports.default = vercelHandler;
