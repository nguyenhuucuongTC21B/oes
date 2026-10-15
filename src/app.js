/**
 * app.js (OES / VERCEL EDITION) — Lắp ráp ứng dụng Express.
 *
 * Hai middleware nền tảng cho serverless:
 *  - boot: đợi lazy-init của dataStore hoàn tất (instance đầu tiên lạnh).
 *  - fresh: làm tươi cache đọc nếu đã cũ >15s để các instance nhìn thấy
 *    dữ liệu của nhau gần như tức thời (chỉ tính với request /api).
 */
'use strict';

const path = require('path');
const express = require('express');
const dataStore = require('./store/dataStore');

const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const examRoutes = require('./routes/exam.routes');
const adminRoutes = require('./routes/admin.routes');

/**
 * @param {() => Promise<void>} [ensureReady] — hàm lazy-boot (api/index.js truyền
 *        vào khi chạy trên Vercel; server.js tự init trước listen nên không cần).
 */
function createApp(ensureReady) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Lazy boot: request đầu tiên của mỗi instance đợi khởi tạo dataStore.
  if (ensureReady) {
    app.use('/api', (req, res, next) => {
      ensureReady().then(() => next()).catch(next);
    });
  }

  // Security headers tối thiểu.
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  // Nhật ký request gọn nhẹ (chỉ API).
  app.use('/api', (req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () =>
      console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0}ms)`)
    );
    next();
  });

  // Làm tươi cache đọc (chế độ Drive): sau 15s cache coi như cũ.
  app.use('/api', (req, res, next) => {
    dataStore
      .refreshAllIfStale()
      .then(() => next())
      .catch(() => next()); // Không bao giờ chặn request vì Drive lỗi.
  });

  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', examRoutes);
  app.use('/api/admin', adminRoutes);

  // API không tồn tại → JSON 404 (không trả HTML).
  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Endpoint không tồn tại.' });
  });

  // Giao diện tĩnh — trên Vercel thư mục public/ được phục vụ tự động,
  // dòng này chỉ phục vụ khi chạy server.js trên máy local.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Trang không tìm thấy → về trang chủ.
  app.use((req, res) => res.redirect('/'));

  // Bắt lỗi tập trung — thông báo đúng nguyên nhân thay vì câu chữ chung chung.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    if (res.headersSent) return;

    const msg = String((err && err.message) || '');
    const reason = String((err && err.errors && err.errors[0] && err.errors[0].reason) || '');
    if (
      /drive|googleapis|invalid_grant|invalid_client|permission|quota|SERVICE_DISABLED/i.test(msg + reason)
    ) {
      return res.status(502).json({
        message:
          'Hệ thống chưa ghi được dữ liệu lên Google Drive. Vui lòng báo Ban tổ chức kiểm tra: ' +
          'đã bật Google Drive API, đã Share thư mục cho Service Account với quyền Editor, ' +
          'GOOGLE_DRIVE_FOLDER_ID đúng — hướng dẫn chi tiết ở README mục 3 (chạy: node tools/check-drive.js).',
      });
    }
    res.status(500).json({ message: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
  });

  return app;
}

module.exports = { createApp };
