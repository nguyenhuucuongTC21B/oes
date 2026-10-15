/**
 * config.js — Nạp biến môi trường và cấu hình tập trung (OES / Vercel edition).
 * Hỗ trợ đọc file .env (chạy local) mà không cần dependency ngoài.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Đọc file .env nếu tồn tại và gán vào process.env (không ghi đè giá trị đã có). */
function loadDotEnv(file = '.env') {
  try {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) return;
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    console.warn('[config] Khong doc duoc file .env:', err.message);
  }
}

loadDotEnv();

/** Đang chạy trên nền serverless Vercel? (Vercel luôn set VERCEL=1) */
const isServerless = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  /** Chế độ serverless: mọi ghi dữ liệu đều phải await ngay (không debounce). */
  isServerless,

  /** Khoa ky token HMAC. Neu khong set -> tu sinh ngau nhien (token mat sau khi restart). */
  sessionSecret:
    process.env.SESSION_SECRET ||
    require('crypto').randomBytes(48).toString('hex'),

  /** Danh sach CCCD duoc cap quyen Admin khi dang ky. */
  adminCccds: (process.env.ADMIN_CCCDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /**
   * Thu muc cache cuc bo (mirror cua Google Drive).
   * - Local: ./data (nhìn thấy được, tiện debug).
   * - Vercel: /tmp/oes-data — hệ thống file chỉ /tmp là ghi được và cũng
   *   chỉ sống cùng instance; mirror ở đây chỉ để debug log, KHÔNG phải
   *   nơi lưu trữ chính (dữ liệu chính thức luôn nằm trên Google Drive).
   */
  localDataDir: isServerless
    ? path.join('/tmp', 'oes-data')
    : path.join(process.cwd(), 'data'),
};

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[config] CANH BAO: SESSION_SECRET chua duoc cau hinh. ' +
      'Token dang nhap se het hieu moi khi instance thay doi. ' +
      'Hay dat bien nay trong Vercel Environment Variables!'
  );
}

module.exports = config;
