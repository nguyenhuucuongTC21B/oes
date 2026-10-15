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

const handler = require('./index.js');

module.exports = async function vercelHandler(req, res) {
  return handler(req, res);
};

module.exports.default = module.exports;
