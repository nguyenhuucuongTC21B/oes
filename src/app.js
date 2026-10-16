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
const config = require('./config');
const dataStore = require('./store/dataStore');

const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const examRoutes = require('./routes/exam.routes');
const adminRoutes = require('./routes/admin.routes');

/* ----------------------------------------------------------------------
 * LAZY BOOT DỰ PHÒNG — dùng khi entrypoint KHÔNG truyền ensureReady
 * (ví dụ code cũ re-export thẳng module này làm handler trên Vercel).
 * dataStore.init() tự bảo vệ (initPromise) nên gọi trùng cũng vô hại.
 * ---------------------------------------------------------------------- */
let defaultReadyPromise = null;
function defaultEnsureReady() {
  if (!defaultReadyPromise) {
    defaultReadyPromise = (async () => {
      console.log('[oes] Lazy boot du phong (entrypoint khong truyen ensureReady)...');
      require('./drive/driveClient').init();
      await dataStore.init();
      console.log('[oes] Instance du phong san sang nhan request.');
    })().catch((err) => {
      defaultReadyPromise = null; // Cho phép request sau thử lại.
      throw err;
    });
  }
  return defaultReadyPromise;
}

/* ----------------------------------------------------------------------
 * PHỤC HỒI ĐƯỜNG DẪN GỐC (R6) — chống lỗi "mọi API trả 401 Phiên hết hạn".
 *
 * Bối cảnh: khi repo GitHub được cập nhật THIẾU file (ví dụ vẫn còn
 * api/index.js cũ trong khi src/ đã là bản mới), cách định tuyến của Vercel
 * có thể đưa request vào lambda với req.url = '/api/index' (đích của
 * rewrite) thay vì đường dẫn gốc. Khi đó KHÔNG route nào khớp, request rơi
 * vào exam router (router.use(requireAuth)) → MỌI API trả 401 kèm câu
 * "Phiên đăng nhập hết hạn..." — kể cả đăng ký/đăng nhập/health/stats, khiến
 * chẩn đoán nhầm sang lỗi phiên (đã xảy ra thật trên deploy 16/10).
 *
 * Giải pháp 2 lớp:
 *  1) Nếu thấy URL bị dịch chuyển về '/api/index', khôi phục đường dẫn thật
 *     từ header định tuyến của Vercel (x-now-route-matches / x-forwarded-path)
 *     rồi ghi đè req.url — hệ thống chạy ĐÚNG dù deploy trộn lẫn.
 *  2) Nếu không khôi phục được: trả JSON chẩn đoán OES_ROUTING_MISMATCH chỉ
 *     rõ nguyên nhân + cách xử lý, thay vì 401 gây hiểu lầm.
 * ---------------------------------------------------------------------- */
const ROUTE_DEST_PATH = '/api/index';

/** Giải mã header x-now-route-matches dạng "1=auth%2Fregister&2=x" → mảng nhóm. */
function decodeRouteMatches(raw) {
  const groups = [];
  String(raw)
    .split('&')
    .forEach((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return;
      const key = Number.parseInt(part.slice(0, eq), 10);
      if (!Number.isFinite(key)) return;
      let val = part.slice(eq + 1);
      try {
        val = decodeURIComponent(val);
      } catch {
        /* giữ nguyên giá trị thô nếu không decode được */
      }
      groups[key] = val;
    });
  return groups.filter(Boolean);
}

/** Trả về đường dẫn gốc nếu khôi phục được, ngược lại null. */
function recoverOriginalUrl(req) {
  const rawUrl = String(req.url || '');
  const rawPath = rawUrl.split('?')[0];
  if (rawPath !== ROUTE_DEST_PATH) return null; // URL bình thường — không can thiệp.

  // ① Header "đường dẫn gốc" nếu runtime/proxy cung cấp.
  const forwarded =
    req.headers['x-forwarded-path'] || req.headers['x-vercel-original-path'];
  if (typeof forwarded === 'string' && forwarded.startsWith('/') && forwarded !== ROUTE_DEST_PATH) {
    return forwarded;
  }

  // ② Khôi phục từ capture group của route match:
  //    source "/(.*)"  + path /api/health   → 1=api/health   → '/api/health'
  //    source "/api/(.*)" + path /api/health → 1=health       → '/api/health'
  const groups = decodeRouteMatches(req.headers['x-now-route-matches']);
  if (groups.length > 0) {
    const joined = groups.join('').replace(/^\/+/, '');
    const candidate = /^api\//.test(joined) ? '/' + joined : '/api/' + joined;
    return candidate;
  }
  return null;
}

/**
 * @param {() => Promise<void>} [ensureReady] — hàm lazy-boot (api/index.js truyền
 *        vào khi chạy trên Vercel; server.js tự init trước listen nên không cần).
 */
function buildApp(ensureReady) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // R6 — Phục hồi đường dẫn gốc trước MỌI thứ khác (kể cả lazy boot).
  app.use((req, res, next) => {
    const recovered = recoverOriginalUrl(req);
    if (recovered) {
      const qIdx = String(req.url || '').indexOf('?');
      const query = qIdx === -1 ? '' : String(req.url).slice(qIdx);
      console.log(
        `[oes] Phuc hoi duong dan goc (routing mismatch): ${req.url} -> ${recovered}${query}`
      );
      req.url = recovered + query;
      req.originalUrl = recovered + query;
      req.oesUrlRecovered = true;
      return next();
    }
    // Không khôi phục được mà request vẫn trúng đích rewrite → chẩn đoán rõ.
    if (String(req.url || '').split('?')[0] === ROUTE_DEST_PATH) {
      console.error(
        '[oes] OES_ROUTING_MISMATCH: request den dich "/api/index" ma khong co header duong dan goc. ' +
          'Deploy dang thieu file moi (api/index.js hoac vercel.json la ban cu).'
      );
      return res.status(500).json({
        ok: false,
        error: 'OES_ROUTING_MISMATCH',
        message:
          'Hệ thống nhận request tại đích định tuyến "/api/index" thay vì đường dẫn API gốc. ' +
          'Đây KHÔNG phải lỗi phiên đăng nhập — bản deploy đang chạy thiếu file hoặc đang dùng ' +
          'api/index.js / vercel.json cũ (repo được cập nhật một nửa).',
        hint:
          'Upload lại TOÀN BỘ nội dung bản mới (Cách A trong CẬP-NHẬT-LÊN-GITHUB.txt — phải có đủ ' +
          'api/index.js, vercel.json, src/**) hoặc vào Vercel > Deployments > Redeploy và TẮT ' +
          '"Use existing Build Cache". Sau deploy, mở /api/health thấy "build": "OES-VERCEL-R6" là thành công.',
      });
    }
    next();
  });

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

/** Nhận diện tham số là HTTP request (IncomingMessage) chứ không phải callback. */
function isRequestArg(arg) {
  return (
    !!arg &&
    typeof arg === 'object' &&
    typeof arg.on === 'function' &&
    typeof arg.socket !== 'undefined'
  );
}

let singletonApp = null;

/**
 * createApp — được export TRỰC TIẾP (module.exports = createApp).
 *
 * ⚠️ Quy tắc bắt buộc của runtime Vercel: module mà giá trị export "truy vết"
 * về tới phải export một HÀM (không phải object). Trước đây file này export
 * `{ createApp }` — object — nên Vercel từ chối với lỗi:
 *   "Invalid export found in module /var/task/src/app.js.
 *    The default export must be a function or server."
 * Giờ đây module này export chính hàm createApp (kèm thuộc tính .createApp để
 * code cũ destructuring `const { createApp } = require(...)` vẫn hoạt động).
 *
 * CHẾ ĐỘ PHÒNG THỦ: nếu bị gọi với (req, res) — tức entrypoint nào đó đã
 * re-export thẳng hàm này làm handler — tự xây app 1 lần (singleton) rồi
 * chuyển tiếp request, kèm lazy-boot dự phòng. Nhờ vậy kể cả repo GitHub
 * chỉ cập nhật một nửa file, hệ thống vẫn chạy được.
 */
function createApp(ensureReady) {
  if (isRequestArg(ensureReady)) {
    if (!singletonApp) singletonApp = buildApp(defaultEnsureReady);
    return singletonApp(ensureReady, arguments[1]);
  }
  // Không truyền ensureReady trên serverless → dùng lazy boot dự phòng.
  return buildApp(ensureReady || (config.isServerless ? defaultEnsureReady : null));
}

module.exports = createApp;
module.exports.createApp = createApp;
module.exports.default = createApp;
