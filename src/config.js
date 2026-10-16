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

/**
 * Secret ký token PHẢI GIỐNG NHAU ở mọi instance, nếu không token ký bởi
 * instance A sẽ bị instance B từ chối → "Phiên đăng nhập hết hạn hoặc
 * không hợp lệ" ngay sau khi đăng nhập (lỗi kinh điển trên serverless).
 *
 * Thứ tự ưu tiên:
 *  1. SESSION_SECRET — người dùng tự đặt trên Vercel (khuyến nghị).
 *  2. Phái sinh ổn định từ GOOGLE_SERVICE_ACCOUNT_JSON (biến bắt buộc phải có
 *     sẵn trên Vercel để lưu trữ Drive hoạt động) — SHA-256 có tiền tố miền
 *     riêng, đảm bảo mọi instance cùng deployment sinh ra CÙNG một secret mà
 *     không cần cấu hình thêm. Service Account JSON vốn là bí mật server-side
 *     nên phái sinh từ nó an toàn tương đương secret ngẫu nhiên.
 *  3. Random (chỉ còn xảy ra khi chạy local không .env) — token sẽ mất khi
 *     restart, chấp nhận được vì local không có nhiều instance.
 */
function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (saJson) {
    return require('crypto')
      .createHash('sha256')
      .update('oes-session-secret/v1:' + saJson)
      .digest('hex');
  }
  return require('crypto').randomBytes(48).toString('hex');
}

/**
 * Hậu tố tên file dữ liệu — cho phép chạy NHIỀU BẢN hệ thống CHUNG MỘT thư
 * mục Google Drive mà không ghi đè dữ liệu của nhau (vd: bản Vercel và bản
 * render.com cùng trỏ vào 1 folder).
 *
 *   - Đặt DATA_FILE_SUFFIX (vd "Vercel") → dùng đúng giá trị đó:
 *       users.json → usersVercel.json, exams.json → examsVercel.json,
 *       results.json → resultsVercel.json.
 *   - KHÔNG đặt và đang chạy trên Vercel (VERCEL=1) → mặc định "Vercel"
 *     → file dữ liệu của bản Vercel tự tách khỏi bản gốc.
 *   - Chạy local / render.com / không đặt gì → rỗng → giữ nguyên tên gốc.
 *
 * Chỉ cho phép chữ/số/gạch nối/gạch dưới để không phá vỡ đường dẫn.
 */
function sanitizeSuffix(raw) {
  const s = String(raw === undefined ? '' : raw).trim();
  if (!s) return '';
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(s)) {
    console.warn(`[config] DATA_FILE_SUFFIX "${s}" khong hop le (chi chu/so/-/_ ) — bo qua, dung ten file goc.`);
    return '';
  }
  return s;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  /** Chế độ serverless: mọi ghi dữ liệu đều phải await ngay (không debounce). */
  isServerless,

  /** Khoa ky token HMAC — xác định theo thứ tự ưu tiên ở trên (xem resolveSessionSecret). */
  sessionSecret: resolveSessionSecret(),

  /** Hậu tố tên file dữ liệu ("Vercel" khi chạy trên Vercel nếu không tự đặt) — xem giải thích trên. */
  dataFileSuffix: sanitizeSuffix(
    process.env.DATA_FILE_SUFFIX !== undefined
      ? process.env.DATA_FILE_SUFFIX
      : isServerless
        ? 'Vercel'
        : ''
  ),

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
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.warn(
      '[config] Ghi chu: SESSION_SECRET chua dat — dang dung secret phai sinh ' +
        'on dinh tu GOOGLE_SERVICE_ACCOUNT_JSON (van hoat dong da instance). ' +
        'Khuyen nghi: dat SESSION_SECRET trong Vercel Environment Variables.'
    );
  } else {
    console.warn(
      '[config] CANH BAO: SESSION_SECRET chua duoc cau hinh va khong co ' +
        'GOOGLE_SERVICE_ACCOUNT_JSON de phai sinh. Token dang nhap se het hieu ' +
        'moi khi instance thay doi. Hay dat bien nay trong Vercel Environment Variables!'
    );
  }
}

module.exports = config;
