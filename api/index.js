"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/config.js
var require_config = __commonJS({
  "src/config.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    function loadDotEnv(file = ".env") {
      try {
        const fullPath = path.join(process.cwd(), file);
        if (!fs.existsSync(fullPath)) return;
        const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq === -1) continue;
          const key = trimmed.slice(0, eq).trim();
          let value = trimmed.slice(eq + 1).trim();
          if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          if (!(key in process.env)) process.env[key] = value;
        }
      } catch (err) {
        console.warn("[config] Khong doc duoc file .env:", err.message);
      }
    }
    loadDotEnv();
    var isServerless = process.env.VERCEL === "1" || process.env.VERCEL === "true";
    function resolveSessionSecret() {
      if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
      const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
      if (saJson) {
        return require("crypto").createHash("sha256").update("oes-session-secret/v1:" + saJson).digest("hex");
      }
      return require("crypto").randomBytes(48).toString("hex");
    }
    function sanitizeSuffix(raw) {
      const s = String(raw === void 0 ? "" : raw).trim();
      if (!s) return "";
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(s)) {
        console.warn(`[config] DATA_FILE_SUFFIX "${s}" khong hop le (chi chu/so/-/_ ) \u2014 bo qua, dung ten file goc.`);
        return "";
      }
      return s;
    }
    var config = {
      env: process.env.NODE_ENV || "development",
      port: parseInt(process.env.PORT || "3000", 10),
      /** Chế độ serverless: mọi ghi dữ liệu đều phải await ngay (không debounce). */
      isServerless,
      /** Khoa ky token HMAC — xác định theo thứ tự ưu tiên ở trên (xem resolveSessionSecret). */
      sessionSecret: resolveSessionSecret(),
      /** Hậu tố tên file dữ liệu ("Vercel" khi chạy trên Vercel nếu không tự đặt) — xem giải thích trên. */
      dataFileSuffix: sanitizeSuffix(
        process.env.DATA_FILE_SUFFIX !== void 0 ? process.env.DATA_FILE_SUFFIX : isServerless ? "Vercel" : ""
      ),
      /**
       * R10 — QUẢN TRỊ VIÊN MẶC ĐỊNH: tài khoản đăng ký bằng số CCCD này LUÔN
       * được cấp quyền Admin (kể cả đăng ký sau khi hệ thống đã có người dùng,
       * kể cả tài khoản đã tồn tại trước đó — đăng nhập sẽ tự nâng quyền).
       * Danh sách ADMIN_CCCDS (env) vẫn được cộng thêm nếu Ban Tổ chức muốn
       * cấp quyền cho các CCCD khác.
       */
      masterAdminCccd: "048085006405",
      /** Danh sach CCCD duoc cap quyen Admin khi dang ky (bao gồm cả Admin mặc định). */
      adminCccds: [
        ...new Set(
          ["048085006405", ...process.env.ADMIN_CCCDS || ""].join(",").split(",").map((s) => s.trim()).filter(Boolean)
        )
      ],
      /**
       * Thu muc cache cuc bo (mirror cua Google Drive).
       * - Local: ./data (nhìn thấy được, tiện debug).
       * - Vercel: /tmp/oes-data — hệ thống file chỉ /tmp là ghi được và cũng
       *   chỉ sống cùng instance; mirror ở đây chỉ để debug log, KHÔNG phải
       *   nơi lưu trữ chính (dữ liệu chính thức luôn nằm trên Google Drive).
       */
      localDataDir: isServerless ? path.join("/tmp", "oes-data") : path.join(process.cwd(), "data")
    };
    if (!process.env.SESSION_SECRET) {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        console.warn(
          "[config] Ghi chu: SESSION_SECRET chua dat \u2014 dang dung secret phai sinh on dinh tu GOOGLE_SERVICE_ACCOUNT_JSON (van hoat dong da instance). Khuyen nghi: dat SESSION_SECRET trong Vercel Environment Variables."
        );
      } else {
        console.warn(
          "[config] CANH BAO: SESSION_SECRET chua duoc cau hinh va khong co GOOGLE_SERVICE_ACCOUNT_JSON de phai sinh. Token dang nhap se het hieu moi khi instance thay doi. Hay dat bien nay trong Vercel Environment Variables!"
        );
      }
    }
    module2.exports = config;
  }
});

// src/utils/driveAdvice.js
var require_driveAdvice = __commonJS({
  "src/utils/driveAdvice.js"(exports2, module2) {
    "use strict";
    function isQuotaError(err) {
      const reason = err && err.errors && err.errors[0] && err.errors[0].reason || "";
      const msg = `${err && err.message || ""} ${reason}`.toLowerCase();
      return msg.includes("storagequotaexceeded") || msg.includes("do not have storage quota") || msg.includes("storage quota") || msg.includes("disk quota");
    }
    function adviceForError(err) {
      const reason = err && err.errors && err.errors[0] && err.errors[0].reason || "";
      const detail = err && err.errors && err.errors[0] && err.errors[0].message || "";
      const msg = `${err && err.message || ""} ${reason} ${detail}`.toLowerCase();
      if (msg.includes("service_disabled") || msg.includes("has not been used") || msg.includes("is disabled")) {
        return 'Google Drive API CH\u01AFA \u0110\u01AF\u1EE2C B\u1EACT cho project ch\u1EE9a Service Account. S\u1EEDa: Google Cloud Console \u2192 APIs & Services \u2192 Library \u2192 t\xECm "Google Drive API" \u2192 n\xFAt Enable. Ch\u1EDD 1\u20132 ph\xFAt r\u1ED3i b\u1EA5m "Ki\u1EC3m tra Drive ngay" l\u1EA7n n\u1EEFa.';
      }
      if (Number(err && err.code) === 404 || msg.includes("file not found") || msg.includes("notfound")) {
        return "KH\xD4NG T\xCCM TH\u1EA4Y TH\u01AF M\u1EE4C tr\xEAn Drive. GOOGLE_DRIVE_FOLDER_ID sai (copy d\u01B0 URL, d\u01B0 kho\u1EA3ng tr\u1EAFng, ho\u1EB7c th\u01B0 m\u1EE5c \u0111\xE3 b\u1ECB x\xF3a). M\u1EDF th\u01B0 m\u1EE5c tr\xEAn drive.google.com, copy \u0110O\u1EA0N SAU /folders/ tr\xEAn thanh \u0111\u1ECBa ch\u1EC9 (v\xED d\u1EE5 URL .../folders/1AbC-xYz th\xEC Folder ID l\xE0 1AbC-xYz), s\u1EEDa bi\u1EBFn tr\xEAn Vercel (Settings \u2192 Environment Variables) r\u1ED3i Redeploy: Deployments \u2192 n\xFAt \u22EF \u2192 Redeploy.";
      }
      if (Number(err && err.code) === 403 && (msg.includes("permission") || msg.includes("insufficient"))) {
        return "B\u1ECA T\u1EEA CH\u1ED0I QUY\u1EC0N \u2014 th\u01B0 m\u1EE5c ch\u01B0a \u0111\u01B0\u1EE3c Share cho Service Account (ho\u1EB7c ch\u1EC9 share quy\u1EC1n Viewer). S\u1EEDa: m\u1EDF th\u01B0 m\u1EE5c tr\xEAn Drive \u2192 n\xFAt Share \u2192 d\xE1n \u0111\xFAng email Service Account (client_email) \u2192 \u0111\u1ED5i quy\u1EC1n th\xE0nh EDITOR \u2192 Send. N\u1EBFu d\xF9ng t\xE0i kho\u1EA3n t\u1ED5 ch\u1EE9c b\u1ECB ch\u1EB7n chia s\u1EBB, h\xE3y t\u1EA1o th\u01B0 m\u1EE5c b\u1EB1ng @gmail.com c\xE1 nh\xE2n.";
      }
      if (isQuotaError(err)) {
        let names = "users.json, exams.json, results.json";
        try {
          const suffix = require_config().dataFileSuffix || "";
          if (suffix) {
            names = `users${suffix}.json, exams${suffix}.json, results${suffix}.json`;
          }
        } catch {
        }
        return `L\u1ED6I DUNG L\u01AF\u1EE2NG: Service Account KH\xD4NG c\xF3 dung l\u01B0\u1EE3ng ri\xEAng n\xEAn kh\xF4ng t\u1EF1 t\u1EA1o \u0111\u01B0\u1EE3c file M\u1EDAI (gi\u1EDBi h\u1EA1n c\u1EE7a Google). H\u1EC7 th\u1ED1ng v\u1EABn ch\u1EA1y t\u1ED1t n\u1EBFu trong th\u01B0 m\u1EE5c Drive \u0111\xE3 c\xF3 s\u1EB5n 3 file THU\u1EA6N \u0111\xFAng t\xEAn: ${names} (t\u1EA1o b\u1EB1ng c\xE1ch UPLOAD file .json t\u1EEB m\xE1y t\xEDnh \u2014 KH\xD4NG d\xF9ng "Google Docs"; n\u1ED9i dung m\u1ED7i file ch\u1EC9 c\u1EA7n []). N\u1EBFu \u0111\xE3 t\u1EA1o r\u1ED3i: ki\u1EC3m tra \u0111\xFAng ch\xEDnh t\u1EA3 t\xEAn file (ch\u1EEF th\u01B0\u1EDDng, c\xF3 \u0111u\xF4i .json, \u0111\xFAng h\u1EADu t\u1ED1 n\u1EBFu c\xF3) r\u1ED3i b\u1EA5m "Ki\u1EC3m tra l\u1EA1i" \u2014 m\u1EE9c 4 s\u1EBD t\u1EF1 chuy\u1EC3n sang ki\u1EC3m tra c\u1EADp nh\u1EADt file c\xF3 s\u1EB5n.`;
      }
      if (msg.includes("err_ossl") || msg.includes("decoder routines") || msg.includes("pem_read") || msg.includes("no start line") || msg.includes("bad decrypt")) {
        return 'PRIVATE_KEY KH\xD4NG \u0110\u1ECCC \u0110\u01AF\u1EE2C: chu\u1ED7i key b\u1ECB h\u1ECFng khi copy/encode Base64 (thi\u1EBFu \u0111\u1EA7u/cu\u1ED1i, \u0111\u1EE9t d\xF2ng, d\xE1n thi\u1EBFu). T\u1EA1o l\u1EA1i c\u1EA5u h\xECnh: node tools/check-drive.js "\u0111\u01B0\u1EDDng-d\u1EABn-file-key.json" r\u1ED3i copy TR\u1ECCN V\u1EB8N gi\xE1 tr\u1ECB GOOGLE_SERVICE_ACCOUNT_JSON m\u1EDBi v\xE0o Vercel (| Set-Clipboard tr\xEAn Windows, | pbcopy tr\xEAn macOS), r\u1ED3i Redeploy.';
      }
      if (msg.includes("invalid_grant") || msg.includes("invalid_client") || msg.includes("jwt") || msg.includes("malformed")) {
        return 'KEY SERVICE ACCOUNT KH\xD4NG H\u1EE2P L\u1EC6 / B\u1ECA L\u1ED6I COPY. Chu\u1ED7i Base64 c\xF3 th\u1EC3 b\u1ECB thi\u1EBFu, \u0111\u1EE9t d\xF2ng ho\u1EB7c d\xE1n nh\u1EA7m. T\u1EA1o l\u1EA1i key (README m\u1EE5c 3, B\u01B0\u1EDBc 4\u20137) r\u1ED3i ch\u1EA1y: node tools/check-drive.js "\u0111\u01B0\u1EDDng-d\u1EABn-file-key.json" \u0111\u1EC3 sinh l\u1EA1i GOOGLE_SERVICE_ACCOUNT_JSON, c\u1EADp nh\u1EADt bi\u1EBFn tr\xEAn Vercel (Settings \u2192 Environment Variables) v\xE0 Redeploy.';
      }
      if (Number(err && err.code) === 401) {
        return "L\u1ED6I 401 X\xC1C TH\u1EF0C: GOOGLE_SERVICE_ACCOUNT_JSON kh\xF4ng kh\u1EDBp v\u1EDBi project \u0111\xE3 b\u1EADt Drive API. Ki\u1EC3m tra l\u1EA1i chu\u1ED7i Base64 / file key c\xF3 \u0111\xFAng project kh\xF4ng, r\u1ED3i c\u1EADp nh\u1EADt l\u1EA1i bi\u1EBFn m\xF4i tr\u01B0\u1EDDng.";
      }
      if (msg.includes("enotfound") || msg.includes("etimedout") || msg.includes("econnrefused") || msg.includes("fetch failed")) {
        return "L\u1ED6I M\u1EA0NG: server kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c t\u1EDBi Google. N\u1EBFu l\u1ED7i l\u1EB7p l\u1EA1i li\xEAn t\u1EE5c, ki\u1EC3m tra network c\u1EE7a Vercel Function (th\u01B0\u1EDDng t\u1EF1 h\u1ED3i ph\u1EE5c sau \xEDt ph\xFAt).";
      }
      return null;
    }
    function describeError(err) {
      const base = err && err.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh";
      const tip = adviceForError(err);
      return tip ? `${base} \u2192 ${tip}` : base;
    }
    module2.exports = { adviceForError, describeError, isQuotaError };
  }
});

// src/utils/mutex.js
var require_mutex = __commonJS({
  "src/utils/mutex.js"(exports2, module2) {
    "use strict";
    var Mutex = class {
      constructor() {
        this._chains = /* @__PURE__ */ new Map();
      }
      /**
       * Lấy khóa cho tài nguyên `key`.
       * Trả về hàm `release()` — BẮT BUỘC gọi trong `finally` sau khi xong việc.
       */
      acquire(key) {
        const prev = this._chains.get(key) || Promise.resolve();
        let release;
        const gate = new Promise((resolve) => release = resolve);
        this._chains.set(
          key,
          prev.then(() => gate)
        );
        return release;
      }
      /**
       * Chạy hàm `fn` trong vùng khóa của `key`, tự động nhả khóa kể cả khi lỗi.
       * @template T
       * @param {string} key
       * @param {() => Promise<T>} fn
       * @returns {Promise<T>}
       */
      async runExclusive(key, fn) {
        const release = this.acquire(key);
        try {
          return await fn();
        } finally {
          release();
        }
      }
    };
    var globalMutex = new Mutex();
    module2.exports = { Mutex, globalMutex };
  }
});

// src/utils/examWindow.js
var require_examWindow = __commonJS({
  "src/utils/examWindow.js"(exports2, module2) {
    "use strict";
    var VN_TZ = "Asia/Ho_Chi_Minh";
    var VN_OFFSET_MS = 7 * 60 * 60 * 1e3;
    function toIsoOrNull(value) {
      if (value === void 0 || value === null || value === "") return null;
      let s = String(value).trim();
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(s)) {
        s = s.replace(" ", "T") + ":00+07:00";
      } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(s)) {
        s = s.replace(" ", "T") + "+07:00";
      }
      const ms = Date.parse(s);
      if (Number.isNaN(ms)) return void 0;
      return new Date(ms).toISOString();
    }
    function statusOf(exam, nowMs = Date.now()) {
      const openAt = exam && exam.openAt ? exam.openAt : null;
      const closeAt = exam && exam.closeAt ? exam.closeAt : null;
      const openMs = openAt ? Date.parse(openAt) : null;
      const closeMs = closeAt ? Date.parse(closeAt) : null;
      if (!openAt && !closeAt) {
        return { status: "unscheduled", openAt: null, closeAt: null, minutesUntilOpen: null, minutesUntilClose: null };
      }
      let status = "open";
      if (openMs !== null && nowMs < openMs) status = "scheduled";
      if (closeMs !== null && nowMs >= closeMs) status = "closed";
      return {
        status,
        openAt,
        closeAt,
        minutesUntilOpen: openMs !== null && nowMs < openMs ? Math.ceil((openMs - nowMs) / 6e4) : null,
        minutesUntilClose: closeMs !== null && nowMs < closeMs ? Math.ceil((closeMs - nowMs) / 6e4) : null
      };
    }
    function gateMessage(win, examTitle = "") {
      const prefix = examTitle ? `\u0110\u1EC1 thi "${examTitle}": ` : "";
      if (win.status === "scheduled") {
        return `${prefix}Cu\u1ED9c thi CH\u01AFA m\u1EDF c\u1EEDa. Gi\u1EDD thi \u0111\u01B0\u1EE3c quy \u0111\u1ECBnh t\u1EEB ${fmtVn(win.openAt)} (gi\u1EDD VN). Vui l\xF2ng quay l\u1EA1i \u0111\xFAng gi\u1EDD (c\xF2n kho\u1EA3ng ${win.minutesUntilOpen} ph\xFAt n\u1EEFa).`;
      }
      if (win.status === "closed") {
        return `${prefix}Cu\u1ED9c thi \u0110\xC3 \u0110\xD3NG C\u1EECA t\u1EEB ${fmtVn(win.closeAt)} (gi\u1EDD VN). H\u1EC7 th\u1ED1ng kh\xF4ng nh\u1EADn th\xEAm th\xED sinh v\xE0o b\xE0i. Vui l\xF2ng li\xEAn h\u1EC7 Ban T\u1ED5 ch\u1EE9c n\u1EBFu b\u1EA1n cho r\u1EB1ng \u0111\xE2y l\xE0 nh\u1EA7m l\u1EABn.`;
      }
      return null;
    }
    function fmtVn(iso) {
      if (!iso) return "\u2014";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "\u2014";
      const time = new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: VN_TZ
      }).format(d);
      const date = new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: VN_TZ
      }).format(d);
      return `${time} ng\xE0y ${date}`;
    }
    function isoToVnInput(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: VN_TZ
      }).formatToParts(d);
      const get = (t) => (parts.find((p) => p.type === t) || {}).value || "00";
      return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
    }
    module2.exports = { VN_TZ, VN_OFFSET_MS, toIsoOrNull, statusOf, gateMessage, fmtVn, isoToVnInput };
  }
});

// src/data/sampleExams.js
var require_sampleExams = __commonJS({
  "src/data/sampleExams.js"(exports2, module2) {
    "use strict";
    var { toIsoOrNull } = require_examWindow();
    var q = (text, options, correctIndex) => ({ text, options, correctIndex });
    var SET1_TITLE = "B\u1ED9 \u0111\u1EC1 thi s\u1ED1 1: \u0110\xE1nh gi\xE1 n\u0103ng l\u1EF1c An to\xE0n th\xF4ng tin";
    var SET2_TITLE = "B\u1ED9 \u0111\u1EC1 thi s\u1ED1 2: \u0110\xE1nh gi\xE1 n\u0103ng l\u1EF1c An to\xE0n th\xF4ng tin";
    var SET3_TITLE = "B\u1ED9 \u0111\u1EC1 thi s\u1ED1 3: Chuy\u1EC3n \u0111\u1ED5i s\u1ED1 & K\u1EF9 n\u0103ng s\u1ED1";
    var CATEGORY = "An to\xE0n th\xF4ng tin";
    var SET3_CATEGORY = "Chuy\u1EC3n \u0111\u1ED5i s\u1ED1";
    var DURATION = 35;
    var DURATION3 = 60;
    var SET_DESC = "50 c\xE2u tr\u1EAFc nghi\u1EC7m ATTT: 17 c\xE2u Nh\u1EADn bi\u1EBFt (ATTT c\u01A1 b\u1EA3n & ph\xF2ng ch\u1ED1ng l\u1EEBa \u0111\u1EA3o), 23 c\xE2u Th\xF4ng hi\u1EC3u & \xC1p d\u1EE5ng (c\xF4ng c\u1EE5 & gi\xE1m s\xE1t), 10 c\xE2u V\u1EADn d\u1EE5ng n\xE2ng cao (ph\xE2n t\xEDch l\u1ED7 h\u1ED5ng website & Natas). Th\u1EDDi gian l\xE0m b\xE0i: 35 ph\xFAt.";
    var SET3_DESC = "81 c\xE2u (75 tr\u1EAFc nghi\u1EC7m + 6 c\xE2u t\u1EF1 lu\u1EADn ng\u1EAFn): 17 c\xE2u Nh\u1EADn bi\u1EBFt (Chuy\u1EC3n \u0111\u1ED5i s\u1ED1 c\u01A1 b\u1EA3n), 52 c\xE2u Th\xF4ng hi\u1EC3u & \xC1p d\u1EE5ng (k\u1EF9 n\u0103ng s\u1ED1 thi\u1EBFt y\u1EBFu \u2014 VNeID, thanh to\xE1n s\u1ED1, ph\xF2ng ch\u1ED1ng l\u1EEBa \u0111\u1EA3o, g\u1ED3m 3 c\xE2u t\u1EF1 lu\u1EADn), 12 c\xE2u V\u1EADn d\u1EE5ng (t\xECnh hu\u1ED1ng th\u1EF1c t\u1EBF v\xE0 ph\xE2n t\xEDch l\u1ED7 h\u1ED5ng website, g\u1ED3m 3 c\xE2u t\u1EF1 lu\u1EADn). Th\u1EDDi gian l\xE0m b\xE0i: 60 ph\xFAt.";
    var SET1_QUESTIONS = [
      // ---- MỤC A: NHẬN BIẾT — ATTT CƠ BẢN & PHÒNG CHỐNG LỪA ĐẢO (Câu 1–17) ----
      q('Quy t\u1EAFc sao l\u01B0u d\u1EEF li\u1EC7u "3-2-1" y\xEAu c\u1EA7u \u0111i\u1EC1u ki\u1EC7n n\xE0o sau \u0111\xE2y?', [
        "3 b\u1EA3n sao, 2 ng\u01B0\u1EDDi qu\u1EA3n l\xFD, 1 m\u1EADt kh\u1EA9u.",
        "3 thi\u1EBFt b\u1ECB gi\u1ED1ng nhau, 2 tu\u1EA7n c\u1EADp nh\u1EADt 1 l\u1EA7n, 1 b\u1EA3n l\u01B0u Cloud.",
        "3 file n\xE9n, 2 \u1ED5 c\u1EE9ng di \u0111\u1ED9ng, 1 m\xE3 kh\xF3a AES.",
        "\xCDt nh\u1EA5t 3 b\u1EA3n sao, l\u01B0u tr\xEAn 2 lo\u1EA1i ph\u01B0\u01A1ng ti\u1EC7n kh\xE1c nhau, 1 b\u1EA3n l\u01B0u \u1EDF v\u1ECB tr\xED \u0111\u1ED9c l\u1EADp b\xEAn ngo\xE0i."
      ], 3),
      q("H\xECnh th\u1EE9c l\u1EEBa \u0111\u1EA3o g\u1EEDi email/tin nh\u1EAFn gi\u1EA3 m\u1EA1o c\u01A1 quan ch\u1EE9c n\u0103ng \u0111\u1EC3 l\u1EEBa ng\u01B0\u1EDDi d\xF9ng cung c\u1EA5p s\u1ED1 C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n (CCCD) v\xE0 m\xE3 OTP \u0111\u01B0\u1EE3c g\u1ECDi l\xE0 g\xEC?", [
        "Phishing (T\u1EA5n c\xF4ng gi\u1EA3 m\u1EA1o).",
        "Malware.",
        "DDoS.",
        "Brute Force."
      ], 0),
      q("Th\xE0nh ph\u1EA7n n\xE0o sau \u0111\xE2y c\u1EE7a m\u1EADt kh\u1EA9u quy\u1EBFt \u0111\u1ECBnh \u0111\u1ED9 an to\xE0n cao nh\u1EA5t ch\u1ED1ng l\u1EA1i c\xE1c cu\u1ED9c t\u1EA5n c\xF4ng d\xF2 qu\xE9t t\u1EF1 \u0111\u1ED9ng?", [
        "Ch\u1EC9 ch\u1EE9a th\xF4ng tin ng\xE0y sinh v\xE0 t\xEAn vi\u1EBFt t\u1EAFt.",
        "\u0110\u1ED9 d\xE0i t\u1ED1i thi\u1EC3u t\u1EEB 8-12 k\xFD t\u1EF1, k\u1EBFt h\u1EE3p ch\u1EEF hoa, ch\u1EEF th\u01B0\u1EDDng, s\u1ED1 v\xE0 k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t.",
        "Ch\u1EE9a to\xE0n b\u1ED9 l\xE0 c\xE1c k\xFD t\u1EF1 s\u1ED1 vi\u1EBFt li\u1EC1n nhau.",
        "L\xE0 m\u1ED9t t\u1EEB ti\u1EBFng Anh c\xF3 \xFD ngh\u0129a r\xF5 r\xE0ng trong t\u1EEB \u0111i\u1EC3n."
      ], 1),
      q("Khi truy c\u1EADp m\u1EA1ng WiFi c\xF4ng c\u1ED9ng kh\xF4ng c\xF3 m\u1EADt kh\u1EA9u b\u1EA3o v\u1EC7, h\xE0nh vi n\xE0o sau \u0111\xE2y \u0111\u01B0\u1EE3c khuy\u1EBFn c\xE1o \u0111\u1EC3 b\u1EA3o v\u1EC7 d\u1EEF li\u1EC7u?", [
        "T\u1EA3i v\xE0 c\xE0i \u0111\u1EB7t c\xE1c ph\u1EA7n m\u1EC1m b\u1EBB kh\xF3a (Crack).",
        "Th\u1EF1c hi\u1EC7n giao d\u1ECBch chuy\u1EC3n ti\u1EC1n ng\xE2n h\xE0ng tr\u1EF1c tuy\u1EBFn.",
        "B\u1EADt t\xEDnh n\u0103ng t\u1EF1 \u0111\u1ED9ng chia s\u1EBB th\u01B0 m\u1EE5c l\u01B0u tr\u1EEF.",
        "S\u1EED d\u1EE5ng m\u1EA1ng ri\xEAng \u1EA3o (VPN) b\u1EA3o m\u1EADt \u0111\u1EC3 m\xE3 h\xF3a l\u01B0u l\u01B0\u1EE3ng m\u1EA1ng."
      ], 3),
      q("Giao th\u1EE9c n\xE0o \u0111\u1EA3m b\u1EA3o l\u01B0u l\u01B0\u1EE3ng truy c\u1EADp gi\u1EEFa b\u1EA1n v\xE0 website \u0111\u01B0\u1EE3c m\xE3 h\xF3a an to\xE0n, nh\u1EADn bi\u1EBFt b\u1EB1ng k\xFD hi\u1EC7u \u1ED5 kh\xF3a \u{1F512} tr\xEAn thanh \u0111\u1ECBa ch\u1EC9?", [
        "HTTP.",
        "FTP.",
        "HTTPS.",
        "SMTP."
      ], 2),
      q('M\xE3 \u0111\u1ED9c gi\u1EA3 m\u1EA1o ph\u1EA7n m\u1EC1m m\xE3 ngu\u1ED3n m\u1EDF "OpenClaw" \u0111\u01B0\u1EE3c ph\xE1t t\xE1n nh\u1EB1m m\u1EE5c \u0111\xEDch nguy hi\u1EC3m n\xE0o?', [
        "H\u1ED7 tr\u1EE3 d\u1ECDn r\xE1c h\u1EC7 th\u1ED1ng m\xE1y t\xEDnh.",
        "\u0110\xE1nh c\u1EAFp th\xF4ng tin v\xED ti\u1EC1n \u0111i\u1EC7n t\u1EED v\xE0 tr\xECnh qu\u1EA3n l\xFD m\u1EADt kh\u1EA9u ng\u01B0\u1EDDi d\xF9ng.",
        "Qu\xE9t c\xE1c l\u1ED7i c\u1EA5u h\xECnh b\u1EA3o m\u1EADt \u1EE9ng d\u1EE5ng web.",
        "T\u0103ng t\u1ED1c \u0111\u1ED9 \u0111\u01B0\u1EDDng truy\u1EC1n internet n\u1ED9i b\u1ED9."
      ], 1),
      q("\u0110\u1EC3 b\u1EA3o v\u1EC7 t\xE0i kho\u1EA3n m\u1EA1ng x\xE3 h\u1ED9i kh\xF4ng b\u1ECB chi\u1EBFm \u0111o\u1EA1t khi l\u1ED9 m\u1EADt kh\u1EA9u, gi\u1EA3i ph\xE1p t\u1ED1t nh\u1EA5t l\xE0 g\xEC?", [
        "\u0110\u1ED5i \u1EA3nh \u0111\u1EA1i di\u1EC7n \u0111\u1ECBnh k\u1EF3.",
        "\u1EA8n s\u1ED1 \u0111i\u1EC7n tho\u1EA1i hi\u1EC3n th\u1ECB c\xF4ng khai.",
        "S\u1EED d\u1EE5ng t\xEDnh n\u0103ng l\u01B0u m\u1EADt kh\u1EA9u t\u1EF1 \u0111\u1ED9ng c\u1EE7a tr\xECnh duy\u1EC7t.",
        "B\u1EADt x\xE1c th\u1EF1c 2 l\u1EDBp / 2 th\xE0nh t\u1ED1 (2FA / MFA)."
      ], 3),
      q("D\u1EA5u hi\u1EC7u n\xE0o c\u1EA3nh b\xE1o m\xE1y t\xEDnh c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB nhi\u1EC5m m\xE3 \u0111\u1ED9c ho\u1EB7c b\u1ECB hacker \u0111i\u1EC1u khi\u1EC3n t\u1EEB xa?", [
        "Qu\u1EA1t t\u1EA3n nhi\u1EC7t c\u1EE7a m\xE1y t\xEDnh ch\u1EA1y h\u01A1i \u1ED3n khi x\u1EED l\xFD \u0111\u1ED3 h\u1ECDa.",
        "Th\u1EDDi gian kh\u1EDFi \u0111\u1ED9ng c\u1EE7a h\u1EC7 \u0111i\u1EC1u h\xE0nh t\u0103ng th\xEAm 3 gi\xE2y.",
        "\u0110\u1ED9 s\xE1ng m\xE0n h\xECnh t\u1EF1 \u0111\u1ED9ng gi\u1EA3m khi r\xFAt d\xE2y s\u1EA1c pin.",
        "Chu\u1ED9t t\u1EF1 di chuy\u1EC3n t\u1EF1 \u0111\u1ED9ng b\u1EA5m n\xFAt, c\xE1c c\u1EEDa s\u1ED5 l\u1EC7nh t\u1EF1 b\u1EADt/t\u1EAFt li\xEAn t\u1EE5c, t\xE0i kho\u1EA3n t\u1EF1 g\u1EEDi link r\xE1c."
      ], 3),
      q("Khi \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n tr\xEAn c\xE1c trang web, vi\u1EC7c s\u1EED d\u1EE5ng c\xF9ng m\u1ED9t m\u1EADt kh\u1EA9u cho t\u1EA5t c\u1EA3 c\xE1c d\u1ECBch v\u1EE5 (Email, Facebook, Ng\xE2n h\xE0ng, Portal c\xF4ng vi\u1EC7c) d\u1EABn \u0111\u1EBFn r\u1EE7i ro g\xEC?", [
        "L\xE0m gi\u1EA3m t\u1ED1c \u0111\u1ED9 \u0111\u01B0\u1EDDng truy\u1EC1n m\u1EA1ng khi truy c\u1EADp.",
        "T\xE0i kho\u1EA3n s\u1EBD b\u1ECB h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng kh\xF3a do vi ph\u1EA1m ch\xEDnh s\xE1ch.",
        "Hi\u1EC7u \u1EE9ng domino: n\u1EBFu l\u1ED9 m\u1EADt kh\u1EA9u \u1EDF 1 trang web y\u1EBFu, hacker s\u1EBD chi\u1EBFm to\xE0n b\u1ED9 c\xE1c t\xE0i kho\u1EA3n c\xF2n l\u1EA1i.",
        "Kh\xF4ng th\u1EC3 k\xEDch ho\u1EA1t \u0111\u01B0\u1EE3c t\xEDnh n\u0103ng x\xE1c th\u1EF1c 2 l\u1EDBp."
      ], 2),
      q("M\xE3 \u0111\u1ED9c m\xE3 h\xF3a t\u1ED1ng ti\u1EC1n (Ransomware) th\u1EF1c hi\u1EC7n h\xE0nh vi ph\xE1 ho\u1EA1i n\xE0o nguy hi\u1EC3m nh\u1EA5t tr\xEAn thi\u1EBFt b\u1ECB n\u1EA1n nh\xE2n?", [
        "T\u1EF1 \u0111\u1ED9ng g\u1EEDi email r\xE1c \u0111\u1EBFn to\xE0n b\u1ED9 danh b\u1EA1.",
        "L\xE0m h\u1ECFng ph\u1EA7n c\u1EE9ng \u1ED5 c\u1EE9ng c\u1EE7a m\xE1y t\xEDnh v\u0129nh vi\u1EC5n.",
        "M\xE3 h\xF3a to\xE0n b\u1ED9 c\xE1c file t\xE0i li\u1EC7u quan tr\u1ECDng v\xE0 \u0111\xF2i ti\u1EC1n chu\u1ED9c \u0111\u1EC3 gi\u1EA3i m\xE3.",
        "Thay \u0111\u1ED5i h\xECnh n\u1EC1n m\xE0n h\xECnh m\xE1y t\xEDnh c\u1EE7a b\u1EA1n."
      ], 2),
      q("Trong c\xE1c lo\u1EA1i th\xF4ng tin sau, th\xF4ng tin n\xE0o tuy\u1EC7t \u0111\u1ED1i KH\xD4NG \u0111\u01B0\u1EE3c chia s\u1EBB c\xF4ng khai l\xEAn m\u1EA1ng x\xE3 h\u1ED9i \u0111\u1EC3 tr\xE1nh b\u1ECB t\u1ED9i ph\u1EA1m l\u1EE3i d\u1EE5ng l\xE0m gi\u1EA3 danh t\xEDnh?", [
        "H\xECnh \u1EA3nh phong c\u1EA3nh n\u01A1i b\u1EA1n \u0111i du l\u1ECBch.",
        "\u1EA2nh ch\u1EE5p r\xF5 n\xE9t hai m\u1EB7t c\u1EE7a C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n (CCCD) ho\u1EB7c H\u1ED9 chi\u1EBFu.",
        "Ti\xEAu \u0111\u1EC1 m\u1ED9t b\xE0i b\xE1o khoa h\u1ECDc b\u1EA1n v\u1EEBa \u0111\u1ECDc.",
        "L\u1ECBch thi \u0111\u1EA5u th\u1EC3 thao c\u1EE7a c\u01A1 quan."
      ], 1),
      q("Khi l\u01B0\u1EDBt web, l\xE0m th\u1EBF n\xE0o \u0111\u1EC3 nh\u1EADn bi\u1EBFt m\u1ED9t website c\xF3 nguy c\u01A1 cao l\xE0 gi\u1EA3 m\u1EA1o (Phishing page)?", [
        "Giao di\u1EC7n trang web c\xF3 m\xE0u s\u1EAFc kh\xE1c v\u1EDBi b\xECnh th\u01B0\u1EDDng.",
        "T\xEAn mi\u1EC1n (Domain) tr\xEAn thanh \u0111\u1ECBa ch\u1EC9 b\u1ECB vi\u1EBFt sai ch\xEDnh t\u1EA3, sai \u0111u\xF4i m\u1EDF r\u1ED9ng (v\xED d\u1EE5: vksnddanang.com \u0111\u1ED5i th\xE0nh vksdanang-fake.net).",
        "Trang web hi\u1EC3n th\u1ECB qu\xE1 nhi\u1EC1u h\xECnh \u1EA3nh qu\u1EA3ng c\xE1o \u0111\u1ED9ng.",
        "Trang web kh\xF4ng c\xF3 thanh t\xECm ki\u1EBFm th\xF4ng tin b\xE0i vi\u1EBFt."
      ], 1),
      q("Ch\u1EE9c n\u0103ng ch\xEDnh c\u1EE7a ph\u1EA7n m\u1EC1m qu\u1EA3n l\xFD m\u1EADt kh\u1EA9u (Password Manager) l\xE0 g\xEC?", [
        "L\u01B0u tr\u1EEF m\xE3 h\xF3a an to\xE0n v\xE0 t\u1EF1 \u0111\u1ED9ng \u0111\u1ED3ng b\u1ED9 t\u1EA5t c\u1EA3 m\u1EADt kh\u1EA9u ph\u1EE9c t\u1EA1p c\u1EE7a b\u1EA1n.",
        "T\u1EF1 \u0111\u1ED9ng chia s\u1EBB m\u1EADt kh\u1EA9u c\u1EE7a b\u1EA1n cho \u0111\u1ED3ng nghi\u1EC7p khi c\u1EA7n.",
        "T\u1EF1 \u0111\u1ED9ng b\u1EBB kh\xF3a m\u1EADt kh\u1EA9u WiFi c\u1EE7a c\xE1c khu v\u1EF1c xung quanh.",
        "Qu\xE9t v\xE0 lo\u1EA1i b\u1ECF m\xE3 \u0111\u1ED9c n\u1EB1m trong c\xE1c file \u0111\xEDnh k\xE8m email."
      ], 0),
      q("Khi b\u1EA1n nh\u1EADn \u0111\u01B0\u1EE3c cu\u1ED9c g\u1ECDi t\u1EEB s\u1ED1 l\u1EA1 t\u1EF1 x\u01B0ng l\xE0 c\xE1n b\u1ED9 C\xF4ng an ho\u1EB7c Vi\u1EC7n ki\u1EC3m s\xE1t b\xE1o b\u1EA1n \u0111ang li\xEAn quan \u0111\u1EBFn v\u1EE5 \xE1n m\u1EA1ng v\xE0 y\xEAu c\u1EA7u chuy\u1EC3n ti\u1EC1n v\xE0o t\xE0i kho\u1EA3n \u0111\u1EC3 \u0111i\u1EC1u tra, b\u1EA1n n\xEAn l\xE0m g\xEC?", [
        "L\xE0m theo h\u01B0\u1EDBng d\u1EABn, ra ng\xE2n h\xE0ng r\xFAt ti\u1EC1n chuy\u1EC3n ngay \u0111\u1EC3 ch\u1EE9ng minh v\xF4 t\u1ED9i.",
        "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng chuy\u1EC3n ti\u1EC1n, kh\xF4ng cung c\u1EA5p th\xF4ng tin c\xE1 nh\xE2n, t\u1EAFt m\xE1y v\xE0 b\xE1o ngay cho c\u01A1 quan C\xF4ng an n\u01A1i g\u1EA7n nh\u1EA5t.",
        "Chia s\u1EBB th\xF4ng tin t\xE0i kho\u1EA3n ng\xE2n h\xE0ng c\u1EE7a m\xECnh cho ng\u01B0\u1EDDi g\u1ECDi \u0111\u1EC3 h\u1ECD t\u1EF1 ki\u1EC3m tra.",
        "R\u1EE7 th\xEAm b\u1EA1n b\xE8 c\xF9ng chuy\u1EC3n ti\u1EC1n \u0111\u1EC3 c\xF9ng x\xE1c minh d\u1EEF li\u1EC7u."
      ], 1),
      q("Vi\u1EC7c c\u1EADp nh\u1EADt h\u1EC7 \u0111i\u1EC1u h\xE0nh (Windows/macOS) v\xE0 ph\u1EA7n m\u1EC1m th\u01B0\u1EDDng xuy\xEAn c\xF3 \xFD ngh\u0129a g\xEC trong an to\xE0n th\xF4ng tin?", [
        "V\xE1 c\xE1c l\u1ED7 h\u1ED5ng b\u1EA3o m\u1EADt c\u1ED1 h\u1EEFu m\xE0 hacker c\xF3 th\u1EC3 l\u1EE3i d\u1EE5ng \u0111\u1EC3 x\xE2m nh\u1EADp m\xE1y t\xEDnh.",
        "Ch\u1EC9 \u0111\u1EC3 l\xE0m thay \u0111\u1ED5i giao di\u1EC7n s\u1EED d\u1EE5ng cho \u0111\u1EB9p h\u01A1n.",
        "L\xE0m t\u0103ng dung l\u01B0\u1EE3ng l\u01B0u tr\u1EEF tr\u1ED1ng c\u1EE7a \u1ED5 \u0111\u0129a c\u1EE9ng.",
        "X\xF3a b\u1ECF to\xE0n b\u1ED9 c\xE1c file t\xE0i li\u1EC7u c\u0169 m\xE0 b\u1EA1n kh\xF4ng d\xF9ng \u0111\u1EBFn."
      ], 0),
      q('T\u1EA5n c\xF4ng "Social Engineering" (Thao t\xFAng t\xE2m l\xFD con ng\u01B0\u1EDDi) nh\u1EAFm v\xE0o y\u1EBFu t\u1ED1 n\xE0o trong h\u1EC7 th\u1ED1ng an ninh m\u1EA1ng?', [
        "L\u1ED7 h\u1ED5ng trong m\xE3 ngu\u1ED3n c\u1EE7a h\u1EC7 qu\u1EA3n tr\u1ECB c\u01A1 s\u1EDF d\u1EEF li\u1EC7u.",
        "L\u1ED7i c\u1EA5u h\xECnh c\xE1c thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng t\u01B0\u1EDDng l\u1EEDa.",
        "\u0110i\u1EC3m y\u1EBFu trong nh\u1EADn th\u1EE9c, s\u1EF1 l\u01A1 l\xE0 ho\u1EB7c l\xF2ng tin c\u1EE7a con ng\u01B0\u1EDDi.",
        "S\u1EF1 thi\u1EBFu s\xF3t c\u1EE7a c\xE1c ch\u1EE9ng ch\u1EC9 b\u1EA3o m\u1EADt SSL/TLS."
      ], 2),
      q('Thu\u1EADt ng\u1EEF "Ch\u1EBF \u0111\u1ED9 c\u1EE5c b\u1ED9" (Local mode) c\u1EE7a \u1EE9ng d\u1EE5ng thi tr\u1EF1c tuy\u1EBFn khi kh\xF4ng c\u1EA5u h\xECnh bi\u1EBFn Google \u0111\u01B0\u1EE3c hi\u1EC3u l\xE0 g\xEC?', [
        "\u1EE8ng d\u1EE5ng s\u1EBD b\u1ECB l\u1ED7i v\xE0 kh\xF4ng th\u1EC3 kh\u1EDFi \u0111\u1ED9ng \u0111\u01B0\u1EE3c.",
        "\u1EE8ng d\u1EE5ng ch\u1EC9 cho ph\xE9p c\xE1c m\xE1y t\xEDnh trong c\xF9ng ph\xF2ng truy c\u1EADp.",
        "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng chuy\u1EC3n sang giao di\u1EC7n qu\u1EA3n tr\u1ECB Admin.",
        "D\u1EEF li\u1EC7u \u0111\u01B0\u1EE3c l\u01B0u t\u1EA1m th\u1EDDi v\xE0o c\xE1c file JSON trong th\u01B0 m\u1EE5c ./data/ tr\xEAn \u1ED5 c\u1EE9ng c\u1EE7a server thay v\xEC \u0111\u1ED3ng b\u1ED9 l\xEAn Google Drive."
      ], 3),
      // ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — CÔNG CỤ & GIÁM SÁT (Câu 18–40) ----
      q("Khi ph\xE2n t\xEDch nh\u1EADt k\xFD truy c\u1EADp t\u1EA1i BlueTeam Dashboard, b\u1EA1n th\u1EA5y m\u1ED9t IP li\xEAn t\u1EE5c g\u1EEDi y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp sai 6 l\u1EA7n trong v\xF2ng 15 ph\xFAt v\u1EDBi nhi\u1EC1u m\u1EADt kh\u1EA9u kh\xE1c nhau. C\u01A1 ch\u1EBF n\xE0o c\u1EE7a m\xE3 ngu\u1ED3n h\u1EC7 th\u1ED1ng s\u1EBD t\u1EF1 \u0111\u1ED9ng k\xEDch ho\u1EA1t \u0111\u1EC3 ng\u0103n ch\u1EB7n?", [
        "C\u01A1 ch\u1EBF Rate-limit (Gi\u1EDBi h\u1EA1n t\u1EA7n su\u1EA5t y\xEAu c\u1EA7u) \u0111\u1EC3 ch\u1ED1ng d\xF2 m\u1EADt kh\u1EA9u.",
        "C\u01A1 ch\u1EBF m\xE3 h\xF3a file d\u1EEF li\u1EC7u ph\u1EB3ng b\u1EB1ng thu\u1EADt to\xE1n AES.",
        "C\u01A1 ch\u1EBF kh\xF3a lu\u1ED3ng d\u1EEF li\u1EC7u b\u1EB1ng v\xF2ng l\u1EB7p h\u1EB1ng s\u1ED1.",
        "T\u1EF1 \u0111\u1ED9ng x\xF3a t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng \u0111ang b\u1ECB d\xF2 qu\xE9t."
      ], 0),
      q("Vai tr\xF2 ch\u1EE7 \u0111\u1EA1o c\u1EE7a \u0110\u1ED9i T\u1EA5n c\xF4ng (Red Team) trong c\xE1c bu\u1ED5i di\u1EC5n t\u1EADp An to\xE0n th\xF4ng tin l\xE0 g\xEC?", [
        "X\xE2y d\u1EF1ng h\u1EC7 th\u1ED1ng t\u01B0\u1EDDng l\u1EEDa \u0111\u1EC3 b\u1EA3o v\u1EC7 d\u1EEF li\u1EC7u.",
        "C\xE0i \u0111\u1EB7t h\u1EC7 \u0111i\u1EC1u h\xE0nh v\xE0 c\u1EA5u h\xECnh m\u1EA1ng n\u1ED9i b\u1ED9 cho c\u01A1 quan.",
        "Gi\xE1m s\xE1t c\xE1c log ghi nh\u1EADn h\xE0nh vi \u0111\u0103ng nh\u1EADp tr\xE1i ph\xE9p c\u1EE7a ng\u01B0\u1EDDi d\xF9ng.",
        "\u0110\xF3ng vai k\u1EBB t\u1EA5n c\xF4ng, s\u1EED d\u1EE5ng c\xE1c c\xF4ng c\u1EE5 v\xE0 k\u1EF9 thu\u1EADt b\u1EBB kh\xF3a \u0111\u1EC3 t\xECm ra c\xE1c l\u1ED7 h\u1ED5ng b\u1EA3o m\u1EADt c\u1EE7a h\u1EC7 th\u1ED1ng."
      ], 3),
      q("Khi s\u1EED d\u1EE5ng l\u1EC7nh nmap -p 80,443 vksdanang.22web.org, k\u1EF9 s\u01B0 m\u1EA1ng \u0111ang th\u1EF1c hi\u1EC7n h\xE0nh vi g\xEC?", [
        "T\u1EA3i to\xE0n b\u1ED9 m\xE3 ngu\u1ED3n c\u1EE7a trang web v\u1EC1 m\xE1y t\xEDnh c\xE1 nh\xE2n.",
        "Ki\u1EC3m tra xem c\xE1c c\u1ED5ng m\u1EA1ng d\u1ECBch v\u1EE5 web (80 cho HTTP, 443 cho HTTPS) c\u1EE7a m\xE1y ch\u1EE7 c\xF3 \u0111ang m\u1EDF kh\xF4ng.",
        "T\u1EA5n c\xF4ng t\u1EEB ch\u1ED1i d\u1ECBch v\u1EE5 l\xE0m s\u1EADp m\xE1y ch\u1EE7 web.",
        "D\xF2 t\xECm m\u1EADt kh\u1EA9u t\xE0i kho\u1EA3n qu\u1EA3n tr\u1ECB Admin c\u1EE7a h\u1EC7 th\u1ED1ng."
      ], 1),
      q("\u1EE8ng d\u1EE5ng b\u1EA3o m\u1EADt Burp Suite \u0111\u01B0\u1EE3c \u0111\u1ECBnh ngh\u0129a ch\xEDnh x\xE1c l\xE0 c\xF4ng c\u1EE5 thu\u1ED9c lo\u1EA1i n\xE0o?", [
        "Tr\xECnh qu\xE9t virus v\xE0 m\xE3 \u0111\u1ED9c t\u1EF1 \u0111\u1ED9ng tr\xEAn h\u1EC7 \u0111i\u1EC1u h\xE0nh Windows.",
        "H\u1EC7 qu\u1EA3n tr\u1ECB c\u01A1 s\u1EDF d\u1EEF li\u1EC7u ph\u1EB3ng d\xF9ng cho c\xE1c file JSON.",
        "H\u1EC7 \u0111i\u1EC1u h\xE0nh chuy\xEAn d\u1EE5ng d\xE0nh cho hacker m\u0169 tr\u1EAFng.",
        "Proxy ch\u1EB7n b\u1EAFt (Interception Proxy) d\xF9ng \u0111\u1EC3 xem v\xE0 s\u1EEDa \u0111\u1ED5i d\u1EEF li\u1EC7u HTTP/HTTPS truy\u1EC1n gi\u1EEFa tr\xECnh duy\u1EC7t v\xE0 server."
      ], 3),
      q("\u0110\u1EC3 t\xEDnh t\u1EF7 l\u1EC7 t\u1EA5n c\xF4ng th\xE0nh c\xF4ng hi\u1EC3n th\u1ECB tr\xEAn b\u1EA3ng th\u1ED1ng k\xEA h\u1EC7 th\u1ED1ng (Th\u1ED1ng k\xEA h\u1EC7 th\u1ED1ng portal), c\xF4ng th\u1EE9c n\xE0o sau \u0111\xE2y \u0111\u01B0\u1EE3c \xE1p d\u1EE5ng?", [
        "T\u1EF7 l\u1EC7 = T\u1ED5ng l\u01B0\u1EE3t t\u1EA5n c\xF4ng / L\u01B0\u1EE3t th\xE0nh c\xF4ng",
        "T\u1EF7 l\u1EC7 = (Th\xE0nh c\xF4ng / T\u1ED5ng l\u01B0\u1EE3t t\u1EA5n c\xF4ng) x 100%",
        "T\u1EF7 l\u1EC7 = L\u01B0\u1EE3t th\u1EA5t b\u1EA1i - L\u01B0\u1EE3t th\xE0nh c\xF4ng",
        "T\u1EF7 l\u1EC7 = (L\u01B0\u1EE3t th\u1EA5t b\u1EA1i / T\u1ED5ng l\u01B0\u1EE3t t\u1EA5n c\xF4ng) x 100%"
      ], 1),
      q("Thu\u1EADt to\xE1n m\xE3 h\xF3a AES thu\u1ED9c lo\u1EA1i m\xE3 h\xF3a n\xE0o v\xE0 th\u01B0\u1EDDng d\xF9ng \u0111\u1EC3 l\xE0m g\xEC tr\xEAn \u1EE9ng d\u1EE5ng b\u1EA3o m\u1EADt tr\u1EF1c tuy\u1EBFn?", [
        "M\xE3 h\xF3a \u0111\u1ED1i x\u1EE9ng, d\xF9ng \u0111\u1EC3 b\u1EA3o m\u1EADt m\xE3 h\xF3a v\xE0 gi\u1EA3i m\xE3 n\u1ED9i dung t\u1EC7p tin an to\xE0n.",
        "M\xE3 h\xF3a b\u1EA5t \u0111\u1ED1i x\u1EE9ng, d\xF9ng \u0111\u1EC3 b\u0103m m\u1EADt kh\u1EA9u ng\u01B0\u1EDDi d\xF9ng sang chu\u1ED7i c\u1ED1 \u0111\u1ECBnh.",
        "Thu\u1EADt to\xE1n m\xE3 h\xF3a d\xF2ng l\u1EC7nh d\xF9ng \u0111\u1EC3 ch\u1ED1ng t\u1EA5n c\xF4ng SQL Injection.",
        "Ph\u01B0\u01A1ng ph\xE1p chuy\u1EC3n \u0111\u1ED5i \u0111\u1ECBnh d\u1EA1ng t\u1EC7p tin sang chu\u1ED7i Base64 m\u1ED9t d\xF2ng."
      ], 0),
      q("Trong t\u1EC7p c\u1EA5u h\xECnh m\xF4i tr\u01B0\u1EDDng \u1EE9ng d\u1EE5ng .env, bi\u1EBFn m\xF4i tr\u01B0\u1EDDng SESSION_SECRET \u0111\xF3ng vai tr\xF2 g\xEC?", [
        "L\xE0m kh\xF3a b\xED m\u1EADt d\xF9ng \u0111\u1EC3 k\xFD v\xE0 x\xE1c th\u1EF1c t\xEDnh to\xE0n v\u1EB9n c\u1EE7a token phi\xEAn l\xE0m vi\u1EC7c (HMAC-SHA256 tokens).",
        "L\u01B0u tr\u1EEF \u0111\u1ECBa ch\u1EC9 email k\u1EBFt n\u1ED1i v\u1EDBi bot Google Drive.",
        "L\u01B0u s\u1ED1 C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n c\u1EE7a nh\u1EEFng ng\u01B0\u1EDDi d\xF9ng h\u1EC7 th\u1ED1ng.",
        "Quy \u0111\u1ECBnh c\u1ED5ng k\u1EBFt n\u1ED1i m\u1EA1ng m\u1EB7c \u0111\u1ECBnh c\u1EE7a m\xE1y ch\u1EE7 Express."
      ], 0),
      q("\u0110i\u1EC3m kh\xE1c bi\u1EC7t l\u1EDBn nh\u1EA5t gi\u1EEFa ch\u1EE9c n\u0103ng c\u1EE7a c\xF4ng c\u1EE5 Nmap v\xE0 c\xF4ng c\u1EE5 Nikto khi trinh s\xE1t h\u1EC7 th\u1ED1ng l\xE0 g\xEC?", [
        "Nmap t\u1EADp trung qu\xE9t c\u1ED5ng v\xE0 d\u1ECBch v\u1EE5 m\u1EA1ng; Nikto t\u1EADp trung qu\xE9t m\xE1y ch\u1EE7 web \u0111\u1EC3 t\xECm c\xE1c file nguy hi\u1EC3m v\xE0 l\u1ED7i c\u1EA5u h\xECnh c\u1EE5 th\u1EC3.",
        "Nmap ch\u1EC9 d\xF9ng tr\xEAn Windows, Nikto ch\u1EC9 d\xF9ng tr\xEAn Linux.",
        "Nmap d\xF9ng \u0111\u1EC3 t\u1EA5n c\xF4ng SQL Injection, Nikto d\xF9ng \u0111\u1EC3 b\u1EBB kh\xF3a m\u1EADt kh\u1EA9u t\xE0i kho\u1EA3n.",
        "Nmap t\u1EA1o ra file d\u1EEF li\u1EC7u JSON, Nikto gi\u1EA3i m\xE3 c\xE1c chu\u1ED7i d\u1EEF li\u1EC7u d\u1EA1ng Base64."
      ], 0),
      q("Khi server Node.js nh\u1EADn \u0111\u01B0\u1EE3c t\xEDn hi\u1EC7u ng\u1EAFt h\u1EC7 th\u1ED1ng SIGTERM t\u1EEB n\u1EC1n t\u1EA3ng hosting (nh\u01B0 Render), h\u1EC7 th\u1ED1ng x\u1EED l\xFD d\u1EEF li\u1EC7u ph\u1EB3ng s\u1EBD th\u1EF1c hi\u1EC7n h\xE0nh \u0111\u1ED9ng g\xEC tr\u01B0\u1EDBc khi t\u1EAFt h\u1EB3n?", [
        "X\xF3a to\xE0n b\u1ED9 t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng c\xF3 tr\xEAn h\u1EC7 th\u1ED1ng \u0111\u1EC3 b\u1EA3o m\u1EADt.",
        "K\xEDch ho\u1EA1t h\xE0m flush \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o to\xE0n b\u1ED9 d\u1EEF li\u1EC7u \u0111ang l\u01B0u tr\xEAn RAM cache \u0111\u01B0\u1EE3c sync h\u1EBFt l\xEAn Google Drive v\u0129nh vi\u1EC5n.",
        "T\u1EF1 \u0111\u1ED9ng g\u1EEDi email th\xF4ng b\xE1o l\u1ED7i h\u1EC7 th\u1ED1ng cho qu\u1EA3n tr\u1ECB vi\xEAn.",
        "Chuy\u1EC3n to\xE0n b\u1ED9 giao di\u1EC7n ng\u01B0\u1EDDi d\xF9ng sang ch\u1EBF \u0111\u1ED9 b\u1EA3o tr\xEC."
      ], 1),
      q('T\u1EA1i sao khi h\u1EC7 th\u1ED1ng thi tr\u1EF1c tuy\u1EBFn tr\xEAn Render (b\u1EA3n Free Tier) \u1EDF tr\u1EA1ng th\xE1i "ng\u1EE7" (sau 15 ph\xFAt kh\xF4ng c\xF3 ng\u01B0\u1EDDi truy c\u1EADp), l\u01B0\u1EE3t truy c\u1EADp \u0111\u1EA7u ti\xEAn l\u1EA1i b\u1ECB ch\u1EADm t\u1EEB 20\u201340 gi\xE2y?', [
        "Do h\u1EC7 th\u1ED1ng m\u1EA1ng internet t\u1EA1i Vi\u1EC7t Nam b\u1ECB ngh\u1EBDn b\u0103ng th\xF4ng.",
        "Do m\xE3 \u0111\u1ED9c t\u1EF1 \u0111\u1ED9ng ch\u1EA1y ng\u1EA7m \u0111\u1EC3 qu\xE9t ki\u1EC3m tra l\u1ED7 h\u1ED5ng b\u1EA3o m\u1EADt.",
        "Do tr\xECnh duy\u1EC7t web c\u1EE7a ng\u01B0\u1EDDi d\xF9ng t\u1EF1 \u0111\u1ED9ng x\xF3a cookies phi\xEAn c\u0169.",
        "Do server ph\u1EA3i tr\u1EA3i qua qu\xE1 tr\xECnh kh\u1EDFi \u0111\u1ED9ng ngu\u1ED9i (Cold start) v\xE0 th\u1EF1c hi\u1EC7n t\u1EA3i to\xE0n b\u1ED9 d\u1EEF li\u1EC7u 3 file JSON t\u1EEB Google Drive v\u1EC1 RAM cache."
      ], 3),
      q("Ph\u01B0\u01A1ng ph\xE1p b\u0103m m\u1EADt kh\u1EA9u n\xE0o \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng trong h\u1EC7 th\u1ED1ng \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o an to\xE0n cao nh\u1EA5t ch\u1ED1ng l\u1EA1i t\u1EA5n c\xF4ng v\xE9t c\u1EA1n (Brute force), c\xF3 s\u1EED d\u1EE5ng th\xEAm chu\u1ED7i mu\u1ED1i ng\u1EABu nhi\xEAn (salt)?", [
        "scrypt + salt.",
        "MD5 th\xF4.",
        "Base64 Encoding.",
        "SHA-1 kh\xF4ng salt."
      ], 0),
      q("\u0110\u1EC3 ki\u1EC3m tra t\u1EF1 \u0111\u1ED9ng xem c\u1EA5u h\xECnh k\u1EBFt n\u1ED1i gi\u1EEFa server \u1EE9ng d\u1EE5ng v\xE0 Google Drive \u0111\xE3 ho\u1EA1t \u0111\u1ED9ng ch\xEDnh x\xE1c 100% hay ch\u01B0a (g\u1ED3m c\u1EA3 quy\u1EC1n \u0111\u1ECDc v\xE0 quy\u1EC1n ghi), l\u1EADp tr\xECnh vi\xEAn n\xEAn ch\u1EA1y l\u1EC7nh n\xE0o trong th\u01B0 m\u1EE5c d\u1EF1 \xE1n?", [
        "npm start",
        "node server.js",
        "node tools/check-drive.js",
        "npm install googleapis"
      ], 2),
      q("Khi c\u1EA5u h\xECnh ph\xE2n quy\u1EC1n cho t\xE0i kho\u1EA3n Service Account c\u1EE7a Google tr\xEAn th\u01B0 m\u1EE5c d\u1EEF li\u1EC7u Drive, n\u1EBFu b\u1EA1n ch\u1EC9 \u0111\u1EB7t quy\u1EC1n l\xE0 Viewer (Ng\u01B0\u1EDDi xem) th\xEC \u0111i\u1EC1u g\xEC s\u1EBD x\u1EA3y ra v\u1EDBi \u1EE9ng d\u1EE5ng?", [
        "Server ch\u1EC9 \u0111\u1ECDc \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u l\xFAc kh\u1EDFi \u0111\u1ED9ng, nh\u01B0ng KH\xD4NG TH\u1EC2 \u0111\u1ED3ng b\u1ED9 ghi d\u1EEF li\u1EC7u (nh\u01B0 \u0111\u0103ng k\xFD m\u1EDBi, n\u1ED9p b\xE0i) l\xEAn Drive, g\xE2y l\u1ED7i h\u1EC7 th\u1ED1ng.",
        "\u1EE8ng d\u1EE5ng kh\xF4ng th\u1EC3 \u0111\u1ECDc \u0111\u01B0\u1EE3c danh s\xE1ch \u0111\u1EC1 thi.",
        "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng chuy\u1EC3n sang l\u01B0u tr\u1EEF b\u1EB1ng c\u01A1 s\u1EDF d\u1EEF li\u1EC7u SQL.",
        "T\xE0i kho\u1EA3n Admin b\u1ECB t\u01B0\u1EDBc quy\u1EC1n \u0111i\u1EC1u khi\u1EC3n dashboard."
      ], 0),
      q("Ti\xEAu \u0111\u1EC1 HTTP n\xE0o \u0111\u01B0\u1EE3c tr\xECnh duy\u1EC7t t\u1EF1 \u0111\u1ED9ng g\u1EEDi k\xE8m \u0111\u1EC3 \u0111\u1ECBnh danh h\u1EC7 \u0111i\u1EC1u h\xE0nh, tr\xECnh duy\u1EC7t v\xE0 phi\xEAn b\u1EA3n ph\u1EA7n m\u1EC1m m\xE0 ng\u01B0\u1EDDi d\xF9ng \u0111ang s\u1EED d\u1EE5ng \u0111\u1EC3 truy c\u1EADp website?", [
        "Cookie.",
        "Referer.",
        "Content-Type.",
        "User-Agent."
      ], 3),
      q("C\u01A1 ch\u1EBF Mutex ho\u1EA1t \u0111\u1ED9ng tr\xEAn h\xE0ng \u0111\u1EE3i ghi d\u1EEF li\u1EC7u ph\u1EB3ng (dataStore) c\u1EE7a h\u1EC7 th\u1ED1ng thi tr\u1EF1c tuy\u1EBFn c\xF3 vai tr\xF2 g\xEC quan tr\u1ECDng nh\u1EA5t?", [
        "M\xE3 h\xF3a chu\u1ED7i d\u1EEF li\u1EC7u sang d\u1EA1ng kh\xF4ng th\u1EC3 \u0111\u1ECDc \u0111\u01B0\u1EE3c.",
        "Kh\xF3a lu\u1ED3ng ghi, ng\u0103n ng\u1EEBa t\xECnh tr\u1EA1ng nhi\u1EC1u th\xED sinh n\u1ED9p b\xE0i c\xF9ng m\u1ED9t l\xFAc ghi \u0111\xE8 l\xE0m m\u1EA5t m\xE1t d\u1EEF li\u1EC7u c\u1EE7a nhau.",
        "T\u1EF1 \u0111\u1ED9ng ch\u1EA5m \u0111i\u1EC3m c\xE1c c\xE2u h\u1ECFi tr\u1EAFc nghi\u1EC7m c\u1EE7a th\xED sinh.",
        "T\xE1ch bi\u1EC7t file m\xE3 ngu\u1ED3n PHP ra kh\u1ECFi giao di\u1EC7n HTML5."
      ], 1),
      q("Khi s\u1EED d\u1EE5ng l\u1EC7nh curl -u natas0:natas0 https://22web.org, tham s\u1ED1 -u c\xF3 \xFD ngh\u0129a l\xE0 g\xEC?", [
        "Ch\u1EC9 \u0111\u1ECBnh \u0111\u01B0\u1EDDng d\u1EABn t\u1EC7p tin c\u1EA7n t\u1EA3i v\u1EC1 m\xE1y.",
        "\xC9p bu\u1ED9c curl s\u1EED d\u1EE5ng giao th\u1EE9c b\u1EA3o m\u1EADt m\xE3 h\xF3a n\xE2ng cao.",
        "Cung c\u1EA5p th\xF4ng tin t\xEAn \u0111\u0103ng nh\u1EADp v\xE0 m\u1EADt kh\u1EA9u (Username:Password) \u0111\u1EC3 x\xE1c th\u1EF1c HTTP Basic Authentication.",
        "Chuy\u1EC3n \u0111\u1ED5i to\xE0n b\u1ED9 k\u1EBFt qu\u1EA3 ph\u1EA3n h\u1ED3i sang \u0111\u1ECBnh d\u1EA1ng Base64."
      ], 2),
      q("H\u1EC7 th\u1ED1ng l\u01B0u tr\u1EEF d\u1EEF li\u1EC7u ph\u1EB3ng g\u1ED9p c\xE1c thay \u0111\u1ED5i d\u1ED3n d\u1EADp di\u1EC5n ra trong v\xF2ng bao nhi\xEAu gi\xE2y th\xE0nh m\u1ED9t l\u1EA7n upload n\u1EC1n duy nh\u1EA5t l\xEAn Google Drive \u0111\u1EC3 ti\u1EBFt ki\u1EC7m t\xE0i nguy\xEAn v\xE0 quota API?", [
        "0.5 gi\xE2y.",
        "5.0 gi\xE2y.",
        "1.2 gi\xE2y.",
        "10.0 gi\xE2y."
      ], 2),
      q("T\u1EA1i sao vi\u1EC7c ch\u1EA5m \u0111i\u1EC3m b\xE0i thi tr\u1EAFc nghi\u1EC7m b\u1EAFt bu\u1ED9c ph\u1EA3i \u0111\u01B0\u1EE3c th\u1EF1c hi\u1EC7n 100% \u1EDF ph\xEDa Server (Server-side) thay v\xEC th\u1EF1c hi\u1EC7n \u1EDF tr\xECnh duy\u1EC7t c\u1EE7a th\xED sinh (Client-side)?", [
        "\u0110\u1EC3 l\xE0m gi\u1EA3m dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB RAM c\u1EE7a m\xE1y t\xEDnh th\xED sinh.",
        "V\xEC tr\xECnh duy\u1EC7t kh\xF4ng h\u1ED7 tr\u1EE3 c\xE1c ph\xE9p to\xE1n c\u1ED9ng tr\u1EEB \u0111i\u1EC3m s\u1ED1.",
        "\u0110\u1EC3 \u0111\u1EA3m b\u1EA3o t\xEDnh c\xF4ng b\u1EB1ng, ng\u0103n ch\u1EB7n vi\u1EC7c th\xED sinh d\xF9ng F12 s\u1EEDa code JavaScript \u0111\u1ED5i \u0111i\u1EC3m ho\u1EB7c xem tr\u01B0\u1EDBc \u0111\xE1p \xE1n \u0111\xFAng.",
        "\u0110\u1EC3 h\u1EC7 th\u1ED1ng Render t\u1EF1 \u0111\u1ED9ng \u0111\u1ED3ng b\u1ED9 d\u1EEF li\u1EC7u nhanh h\u01A1n."
      ], 2),
      q("Gi\u1EDBi h\u1EA1n th\u1EDDi gian hi\u1EC7u l\u1EF1c m\u1EB7c \u0111\u1ECBnh c\u1EE7a m\u1ED9t m\xE3 m\xE3 h\xF3a Token phi\xEAn l\xE0m vi\u1EC7c (HMAC-SHA256 token) trong h\u1EC7 th\u1ED1ng thi \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh l\xE0 bao l\xE2u?", [
        "30 ph\xFAt.",
        "12 gi\u1EDD.",
        "1 gi\u1EDD.",
        "7 ng\xE0y."
      ], 1),
      q("Khi m\u1ED9t ng\u01B0\u1EDDi d\xF9ng m\u1EDBi \u0111\u0103ng k\xFD v\xE0o h\u1EC7 th\u1ED1ng thi tr\u1EF1c tuy\u1EBFn khi d\u1EEF li\u1EC7u \u0111ang ho\xE0n to\xE0n tr\u1ED1ng r\u1ED7ng (users.json r\u1ED7ng), t\xE0i kho\u1EA3n n\xE0y s\u1EBD nh\u1EADn \u0111\u01B0\u1EE3c \u0111\u1EB7c quy\u1EC1n g\xEC?", [
        "T\u1EF1 \u0111\u1ED9ng \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n h\u1EA1n cao nh\u1EA5t l\xE0 Qu\u1EA3n tr\u1ECB vi\xEAn (Admin).",
        "B\u1ECB h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng kh\xF3a t\xE0i kho\u1EA3n \u0111\u1EC3 ki\u1EC3m tra an to\xE0n.",
        "\u0110\u01B0\u1EE3c quy\u1EC1n t\u1EF1 \u0111\u1ED9ng c\u1ED9ng th\xEAm 2 \u0111i\u1EC3m v\xE0o m\u1ECDi b\xE0i thi.",
        "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng x\xF3a file k\u1EBFt qu\u1EA3 l\u01B0u tr\u1EEF c\u1EE5c b\u1ED9."
      ], 0),
      q("H\u1EB1ng s\u1ED1 DEADLINE quy \u0111\u1ECBnh h\u1EA1n cu\u1ED1i n\u1ED9p b\xE0i thi c\u1EE7a cu\u1ED9c thi tr\u1EF1c tuy\u1EBFn \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh tr\u1EF1c ti\u1EBFp \u1EDF file n\xE0o trong m\xE3 ngu\u1ED3n h\u1EC7 th\u1ED1ng?", [
        "public/assets/js/home.js",
        "src/drive/driveClient.js",
        "src/config.js",
        "package.json"
      ], 0),
      q("Gi\u1EDBi h\u1EA1n h\u1EA1n ng\u1EA1ch (Quota) t\u1EA3i l\xEAn d\u1EEF li\u1EC7u c\u1EE7a m\u1ED9t t\xE0i kho\u1EA3n Google Drive Service Account th\xF4ng th\u01B0\u1EDDng theo quy \u0111\u1ECBnh c\u1EE7a Google l\xE0 bao nhi\xEAu trong m\u1ED9t ng\xE0y?", [
        "750 GB/ng\xE0y.",
        "10 GB/ng\xE0y.",
        "100 GB/ng\xE0y.",
        "Kh\xF4ng gi\u1EDBi h\u1EA1n dung l\u01B0\u1EE3ng."
      ], 0),
      q("Trong m\xF4 h\xECnh ki\u1EBFn tr\xFAc t\u1ED5ng quan c\u1EE7a h\u1EC7 th\u1ED1ng, th\xE0nh ph\u1EA7n n\xE0o \u0111\xF3ng vai tr\xF2 trung gian nh\u1EADn request, x\u1EED l\xFD logic ki\u1EC3m tra \u0111\u0103ng nh\u1EADp/\u0111\u0103ng k\xFD rate-limit v\xE0 ch\u1EA5m \u0111i\u1EC3m b\xE0i thi?", [
        "Th\u01B0 m\u1EE5c public/ ch\u1EE9a file t\u0129nh HTML.",
        "\u1ED4 c\u1EE9ng l\u01B0u tr\u1EEF m\u1EA1ng c\u1EE7a d\u1ECBch v\u1EE5 Google Drive.",
        "C\xE1c file \u0111\u1ECBnh tuy\u1EBFn trong th\u01B0 m\u1EE5c src/routes/ (auth, exam, admin routes).",
        "C\xF4ng c\u1EE5 ki\u1EC3m tra k\u1EBFt n\u1ED1i d\xF2ng l\u1EC7nh check-drive.js."
      ], 2),
      // ---- MỤC C: VẬN DỤNG CAO — PHÂN TÍCH LỖ HỔNG WEBSITE & NATAS (Câu 41–50) ----
      q('M\u1ED9t trang web l\u01B0u m\u1EADt kh\u1EA9u c\u1EE7a c\u1EA5p \u0111\u1ED9 ti\u1EBFp theo ngay trong m\u1ED9t \u0111o\u1EA1n text \u1EA9n c\u1EE7a thu\u1ED9c t\xEDnh HTML c\xF3 c\u1EA5u tr\xFAc d\u1EA1ng <div id="pass" data-password="SECRET_KEY">. \u0110\u1EC3 l\u1EA5y \u0111\u01B0\u1EE3c chu\u1ED7i m\u1EADt kh\u1EA9u n\xE0y b\u1EB1ng l\u1EC7nh d\xF2ng l\u1EC7nh curl k\u1EBFt h\u1EE3p bi\u1EC3u th\u1EE9c ch\xEDnh quy (Regex), l\u1EC7nh n\xE0o sau \u0111\xE2y l\xE0 ch\xEDnh x\xE1c?', [
        "curl -u user:pass URL | grep secret",
        "curl URL > secret.txt",
        `curl -s -u user:pass URL | grep -oP 'data-password="\\K[^"]+'`,
        'curl -X POST -d "password" URL'
      ], 2),
      q("Khi \u1EE9ng d\u1EE5ng Web s\u1EED d\u1EE5ng c\u01A1 ch\u1EBF m\xE3 h\xF3a Cookie b\u1EB1ng thu\u1EADt to\xE1n ph\xE9p to\xE1n logic XOR (M\xF4 ph\u1ECFng Natas Level 11). K\u1EBB t\u1EA5n c\xF4ng c\xF3 th\u1EC3 thao t\xFAng d\u1EEF li\u1EC7u b\xEAn trong Cookie (v\xED d\u1EE5 \u0111\u1ED5i quy\u1EC1n t\u1EEB user th\xE0nh admin) b\u1EB1ng c\xE1ch t\u1EADn d\u1EE5ng \u0111\u1EB7c \u0111i\u1EC3m n\xE0o c\u1EE7a ph\xE9p to\xE1n XOR?", [
        "XOR kh\xF4ng bao gi\u1EDD c\xF3 th\u1EC3 b\u1ECB gi\u1EA3i m\xE3 n\u1EBFu kh\xF4ng c\xF3 kh\xF3a RSA 2048-bit.",
        "N\u1EBFu bi\u1EBFt tr\u01B0\u1EDBc n\u1ED9i dung g\u1ED1c (Plaintext) v\xE0 chu\u1ED7i k\u1EBFt qu\u1EA3 \u0111\xE3 m\xE3 h\xF3a (Ciphertext), k\u1EBB t\u1EA5n c\xF4ng ho\xE0n to\xE0n c\xF3 th\u1EC3 t\xEDnh to\xE1n ng\u01B0\u1EE3c l\u1EA1i \u0111\u1EC3 t\xECm ra Kh\xF3a b\xED m\u1EADt (XOR Key).",
        "Ph\xE9p to\xE1n XOR t\u1EF1 \u0111\u1ED9ng thay \u0111\u1ED5i \u0111\u1ED9 d\xE0i chu\u1ED7i theo th\u1EDDi gian th\u1EF1c h\u1EC7 th\u1ED1ng.",
        "XOR lu\xF4n t\u1EA1o ra c\xE1c k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t n\u1EB1m trong comment HTML."
      ], 1),
      q("H\u1EC7 th\u1ED1ng web cho ph\xE9p ng\u01B0\u1EDDi d\xF9ng xem t\xE0i li\u1EC7u th\xF4ng qua tham s\u1ED1 \u0111\u01B0\u1EDDng d\u1EABn c\xF3 d\u1EA1ng https://gt.tc. N\u1EBFu l\u1EADp tr\xECnh vi\xEAn kh\xF4ng l\u1ECDc s\u1EA1ch d\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o, k\u1EBB t\u1EA5n c\xF4ng nh\u1EADp v\xE0o chu\u1ED7i d\u1EEF li\u1EC7u ?page=../../../../etc/natas_webpass/natas8. L\u1ED7 h\u1ED5ng nguy hi\u1EC3m n\xE0y g\u1ECDi l\xE0 g\xEC?", [
        "SQL Injection.",
        "Command Injection.",
        "Cross-Site Request Forgery (CSRF).",
        "Path Traversal (Duy\u1EC7t qua \u0111\u01B0\u1EDDng d\u1EABn t\u1EC7p tin tr\xE1i ph\xE9p)."
      ], 3),
      q('Khi ch\u1EA1y m\xE3 ngu\u1ED3n, h\u1EC7 th\u1ED1ng tr\u1EA3 v\u1EC1 m\xE3 l\u1ED7i hi\u1EC3n th\u1ECB tr\xEAn m\xE0n h\xECnh console log l\xE0 403 SERVICE_DISABLED k\xE8m d\xF2ng tr\u1EA1ng th\xE1i "Google Drive API has not been used...". L\u1ED7i n\xE0y do nguy\xEAn nh\xE2n c\u1EA5u h\xECnh sai \u1EDF b\u01B0\u1EDBc n\xE0o?', [
        "\u0110i\u1EC1n sai m\xE3 ID th\u01B0 m\u1EE5c l\u01B0u tr\u1EEF c\u1EE7a Google Drive.",
        "File key JSON c\u1EE7a t\xE0i kho\u1EA3n Service Account b\u1ECB x\xF3a ho\xE0n to\xE0n.",
        "Thi\u1EBFt b\u1ECB m\xE1y ch\u1EE7 Render b\u1ECB h\u1EBFt dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB RAM cache.",
        "Ch\u01B0a b\u1EA5m n\xFAt K\xEDch ho\u1EA1t (Enable) d\u1ECBch v\u1EE5 Google Drive API trong trang qu\u1EA3n tr\u1ECB th\u01B0 vi\u1EC7n Google Cloud Console."
      ], 3),
      q("M\u1ED9t trang web c\xF3 t\xEDnh n\u0103ng th\u1EF1c hi\u1EC7n l\u1EC7nh t\xECm ki\u1EBFm v\u0103n b\u1EA3n b\u1EB1ng c\xE1ch g\u1ECDi l\u1EC7nh h\u1EC7 th\u1ED1ng grep ch\u1EA1y ng\u1EA7m \u1EDF Backend. K\u1EBB t\u1EA5n c\xF4ng nh\u1EADp chu\u1ED7i k\xFD t\u1EF1 ; cat /etc/natas_webpass/natas10 v\xE0o \xF4 t\xECm ki\u1EBFm nh\u1EB1m \xE9p m\xE1y ch\u1EE7 th\u1EF1c thi th\xEAm l\u1EC7nh \u0111\u1ECDc file h\u1EC7 th\u1ED1ng. K\u1EF9 thu\u1EADt t\u1EA5n c\xF4ng n\xE0y c\xF3 t\xEAn l\xE0 g\xEC?", [
        "SQL Injection.",
        "Command Injection (Ch\xE8n m\xE3 l\u1EC7nh h\u1EC7 \u0111i\u1EC1u h\xE0nh).",
        "Path Traversal.",
        "Brute Force Attack."
      ], 1),
      q("\u0110o\u1EA1n code Backend x\u1EED l\xFD \u0111\u0103ng nh\u1EADp ch\u1EE9a c\xE2u l\u1EC7nh SQL n\u1ED1i chu\u1ED7i tr\u1EF1c ti\u1EBFp: SELECT * FROM users WHERE username = ' + req.body.username + ' AND password = ' + req.body.password + '. K\u1EBB t\u1EA5n c\xF4ng nh\u1EADp chu\u1ED7i gi\xE1 tr\u1ECB n\xE0o v\xE0o \xF4 username \u0111\u1EC3 \u0111\u0103ng nh\u1EADp th\xE0nh c\xF4ng quy\u1EC1n Admin m\xE0 kh\xF4ng c\u1EA7n m\u1EADt kh\u1EA9u?", [
        "admin123",
        "<script>location.href='hacker.com'</script>",
        "../../config/database.json",
        "admin' OR '1'='1' -- ho\u1EB7c ' OR 1=1 #"
      ], 3),
      q("\u0110\u1EC3 ki\u1EC3m tra t\xEDnh to\xE0n v\u1EB9n c\u1EE7a m\u1ED9t chu\u1ED7i d\u1EEF li\u1EC7u Base64 d\xF9ng l\xE0m bi\u1EBFn m\xF4i tr\u01B0\u1EDDng GOOGLE_SERVICE_ACCOUNT_JSON tr\xEAn m\xF4i tr\u01B0\u1EDDng Production, n\u1EBFu chu\u1ED7i b\u1ECB thi\u1EBFu k\xFD t\u1EF1 ho\u1EB7c ch\xE8n sai d\xF2ng tr\u1ED1ng, server s\u1EBD n\xE9m ra ngo\u1EA1i l\u1EC7 (l\u1ED7i) g\xEC khi kh\u1EDFi ch\u1EA1y \u1EE9ng d\u1EE5ng?", [
        "404 File Not Found",
        "403 Unauthorized",
        "SyntaxError: Unexpected token / JSON.parse error",
        "502 Bad Gateway"
      ], 2),
      q("K\u1EF9 thu\u1EADt ph\xF2ng th\u1EE7 n\xE0o sau \u0111\xE2y c\u1EE7a Blue Team gi\xFAp ng\u0103n ch\u1EB7n tri\u1EC7t \u0111\u1EC3 l\u1ED7 h\u1ED5ng Command Injection khi vi\u1EBFt code g\u1ECDi \u1EE9ng d\u1EE5ng h\u1EC7 th\u1ED1ng?", [
        "Kh\xF4ng d\xF9ng c\xE1c h\xE0m th\u1EF1c thi chu\u1ED7i l\u1EC7nh tr\u1EF1c ti\u1EBFp (nh\u01B0 eval() hay exec()), s\u1EED d\u1EE5ng h\xE0m truy\u1EC1n \u0111\u1ED1i s\u1ED1 t\xE1ch bi\u1EC7t d\u01B0\u1EDBi d\u1EA1ng m\u1EA3ng (Array arguments).",
        'Ch\u1EB7n ng\u01B0\u1EDDi d\xF9ng nh\u1EADp c\xE1c t\u1EEB kh\xF3a nh\u01B0 "SELECT", "UNION", "WHERE".',
        "Chuy\u1EC3n to\xE0n b\u1ED9 \u1EE9ng d\u1EE5ng sang ch\u1EA1y giao th\u1EE9c HTTPS b\u1EA3o m\u1EADt \u1ED5 kh\xF3a.",
        "M\xE3 h\xF3a chu\u1ED7i \u0111\u1EA7u v\xE0o c\u1EE7a ng\u01B0\u1EDDi d\xF9ng b\u1EB1ng thu\u1EADt to\xE1n \u0111\u1ED1i x\u1EE9ng AES-256."
      ], 0),
      q("Khi c\u1EA5u h\xECnh file c\u1EA5u h\xECnh h\u1EA1 t\u1EA7ng render.yaml (Blueprint 1-click deploy), thu\u1ED9c t\xEDnh n\xE0o \u0111\u1ECBnh ngh\u0129a \u0111\u01B0\u1EDDng d\u1EABn d\xF9ng \u0111\u1EC3 Render t\u1EF1 \u0111\u1ED9ng ki\u1EC3m tra xem \u1EE9ng d\u1EE5ng Web \u0111ang ho\u1EA1t \u0111\u1ED9ng \u1ED5n \u0111\u1ECBnh hay \u0111\xE3 ch\u1EBFt (Health Check)?", [
        "build_command",
        "start_command",
        "health_check_path (\u0111\u01B0\u1EE3c c\u1EA5u h\xECnh d\u1EABn t\u1EDBi /api/health).",
        "env_vars_sync"
      ], 2),
      q("Trong th\u1EED th\xE1ch v\u01B0\u1EE3t qua l\u1ED7 h\u1ED5ng t\u1EA3i file (File Upload), \u1EE9ng d\u1EE5ng Backend ki\u1EC3m tra \u0111\u1ECBnh d\u1EA1ng file b\u1EB1ng c\xE1ch \u0111\u1ECDc c\xE1c k\xFD t\u1EF1 \u0111\u1EB7c tr\u01B0ng \u1EDF \u0111\u1EA7u file. K\u1EBB t\u1EA5n c\xF4ng \u0111\xE3 ch\xE8n chu\u1ED7i k\xFD t\u1EF1 n\xE0o sau \u0111\xE2y v\xE0o \u0111\u1EA7u file PHP \u0111\u1EC3 \u0111\xE1nh l\u1EEBa h\u1EC7 th\u1ED1ng r\u1EB1ng \u0111\xE2y l\xE0 m\u1ED9t file \u1EA3nh GIF h\u1EE3p l\u1EC7?", [
        "PNG89a",
        "<?php",
        "GIF8; ho\u1EB7c GIF89a (K\u1EF9 thu\u1EADt bypass qua Magic Bytes).",
        "Content-Type: image/gif"
      ], 2)
    ];
    var SET2_QUESTIONS = [
      // ---- MỤC A: NHẬN BIẾT — ATTT CƠ BẢN & PHÒNG CHỐNG LỪA ĐẢO (Câu 1–17) ----
      q('Trong quy t\u1EAFc sao l\u01B0u d\u1EEF li\u1EC7u "3-2-1", con s\u1ED1 "2" c\xF3 \xFD ngh\u0129a c\u1ED1t l\xF5i l\xE0 g\xEC?', [
        "Th\u1EF1c hi\u1EC7n c\u1EADp nh\u1EADt sao l\u01B0u d\u1EEF li\u1EC7u t\u1ED1i thi\u1EC3u 2 l\u1EA7n m\u1ED9t tu\u1EA7n.",
        "Y\xEAu c\u1EA7u c\xF3 \xEDt nh\u1EA5t 2 ng\u01B0\u1EDDi qu\u1EA3n l\xFD c\u1EA5p cao gi\u1EEF m\u1EADt kh\u1EA9u gi\u1EA3i m\xE3.",
        "L\u01B0u tr\u1EEF c\xE1c b\u1EA3n sao d\u1EEF li\u1EC7u tr\xEAn \xEDt nh\u1EA5t 2 lo\u1EA1i ph\u01B0\u01A1ng ti\u1EC7n v\u1EADt l\xFD kh\xE1c nhau (v\xED d\u1EE5: \u1ED5 c\u1EE9ng m\xE1y t\xEDnh v\xE0 \u1ED5 c\u1EE9ng di \u0111\u1ED9ng).",
        "Chia file t\xE0i li\u1EC7u th\xE0nh 2 ph\u1EA7n m\xE3 h\xF3a \u0111\u1ED9c l\u1EADp."
      ], 2),
      q('T\u1EA5n c\xF4ng "Phishing" th\u01B0\u1EDDng \u0111\u01B0\u1EE3c t\u1ED9i ph\u1EA1m c\xF4ng ngh\u1EC7 cao th\u1EF1c hi\u1EC7n qua con \u0111\u01B0\u1EDDng n\xE0o ph\u1ED5 bi\u1EBFn nh\u1EA5t \u0111\u1EC3 ti\u1EBFp c\u1EADn n\u1EA1n nh\xE2n t\u1EA1i c\xE1c c\u01A1 quan, \u0111\u01A1n v\u1ECB?', [
        "Tr\u1EF1c ti\u1EBFp \u0111\u1EBFn ph\xE1 ho\u1EA1i thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng m\xE1y ch\u1EE7.",
        "D\xF2 qu\xE9t t\xEDn hi\u1EC7u s\xF3ng WiFi c\u1EE7a c\u01A1 quan t\u1EEB xa.",
        "G\u1EEDi email gi\u1EA3 m\u1EA1o c\xF3 ti\xEAu \u0111\u1EC1 kh\u1EA9n c\u1EA5p, ch\u1EE9a file \u0111\xEDnh k\xE8m \u0111\u1ED9c h\u1EA1i ho\u1EB7c \u0111\u01B0\u1EDDng link trang web l\u1EEBa \u0111\u1EA3o.",
        "C\xE0i \u0111\u1EB7t c\xE1c \u1EE9ng d\u1EE5ng \u0111i\u1EC1u khi\u1EC3n m\xE0n h\xECnh ch\xEDnh th\u1ED1ng."
      ], 2),
      q("H\xE0nh vi n\xE0o sau \u0111\xE2y gi\xFAp b\u1EA1n t\u1EA1o ra m\u1ED9t m\u1EADt kh\u1EA9u b\u1EA3o m\u1EADt t\xE0i kho\u1EA3n c\xE1 nh\xE2n c\xF3 \u0111\u1ED9 an to\xE0n cao ch\u1ED1ng l\u1EA1i c\xE1c cu\u1ED9c t\u1EA5n c\xF4ng \u0111o\xE1n m\u1EADt kh\u1EA9u?", [
        "S\u1EED d\u1EE5ng chu\u1ED7i s\u1ED1 li\xEAn t\u1EE5c t\u0103ng d\u1EA7n nh\u01B0 123456789.",
        "D\xF9ng ch\xEDnh t\xEAn vi\u1EBFt t\u1EAFt c\u1EE7a c\u01A1 quan k\u1EBFt h\u1EE3p n\u0103m th\xE0nh l\u1EADp \u0111\u01A1n v\u1ECB.",
        "L\u1EA5y s\u1ED1 \u0111i\u1EC7n tho\u1EA1i c\xE1 nh\xE2n l\xE0m m\u1EADt kh\u1EA9u \u0111\u1EC3 d\u1EC5 nh\u1EDB.",
        "S\u1EED d\u1EE5ng m\u1ED9t c\u1EE5m t\u1EEB d\xE0i kh\xF4ng c\xF3 ngh\u0129a trong t\u1EEB \u0111i\u1EC3n, g\u1ED3m c\u1EA3 ch\u1EEF hoa, ch\u1EEF th\u01B0\u1EDDng, s\u1ED1 v\xE0 c\xE1c k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t."
      ], 3),
      q("R\u1EE7i ro l\u1EDBn nh\u1EA5t khi ng\u01B0\u1EDDi d\xF9ng k\u1EBFt n\u1ED1i \u0111i\u1EC7n tho\u1EA1i v\xE0o m\u1EA1ng WiFi c\xF4ng c\u1ED9ng mi\u1EC5n ph\xED kh\xF4ng y\xEAu c\u1EA7u m\u1EADt kh\u1EA9u \u0111\u0103ng nh\u1EADp l\xE0 g\xEC?", [
        "\u0110i\u1EC7n tho\u1EA1i b\u1ECB s\u1EE5t dung l\u01B0\u1EE3ng pin nhanh h\u01A1n b\xECnh th\u01B0\u1EDDng.",
        "H\u1EC7 \u0111i\u1EC1u h\xE0nh t\u1EF1 \u0111\u1ED9ng x\xF3a b\u1ECF c\xE1c \u1EE9ng d\u1EE5ng \u0111\xE3 c\xE0i \u0111\u1EB7t.",
        "K\u1EBB x\u1EA5u c\xF3 th\u1EC3 ch\u1EB7n b\u1EAFt l\u01B0u l\u01B0\u1EE3ng m\u1EA1ng \u0111\u1EC3 \u0111\xE1nh c\u1EAFp t\xE0i kho\u1EA3n \u0111\u0103ng nh\u1EADp, th\xF4ng tin th\u1EBB t\xEDn d\u1EE5ng truy\u1EC1n qua m\u1EA1ng kh\xF4ng m\xE3 h\xF3a.",
        "Kh\xF4ng th\u1EC3 g\u1EEDi \u0111\u01B0\u1EE3c tin nh\u1EAFn v\u0103n b\u1EA3n SMS th\xF4ng th\u01B0\u1EDDng."
      ], 2),
      q("Khi m\u1ED9t trang web kh\xF4ng s\u1EED d\u1EE5ng ch\u1EE9ng ch\u1EC9 b\u1EA3o m\u1EADt SSL/TLS (ch\u1EC9 ch\u1EA1y giao th\u1EE9c HTTP th\xF4ng th\u01B0\u1EDDng), tr\xECnh duy\u1EC7t web s\u1EBD hi\u1EC3n th\u1ECB c\u1EA3nh b\xE1o g\xEC tr\xEAn thanh \u0111\u1ECBa ch\u1EC9?", [
        "Bi\u1EC3u t\u01B0\u1EE3ng chi\u1EBFc \u1ED5 kh\xF3a m\xE0u xanh an to\xE0n \u{1F512}.",
        "T\u1EF1 \u0111\u1ED9ng \u0111\xF3ng tr\xECnh duy\u1EC7t kh\xF4ng cho ng\u01B0\u1EDDi d\xF9ng truy c\u1EADp.",
        "Chuy\u1EC3n to\xE0n b\u1ED9 n\u1ED9i dung ch\u1EEF c\u1EE7a trang web sang m\xE3 Base64.",
        'D\xF2ng ch\u1EEF "Kh\xF4ng an to\xE0n" (Not Secure) ho\u1EB7c bi\u1EC3u t\u01B0\u1EE3ng d\u1EA5u ch\u1EA5m than c\u1EA3nh b\xE1o.'
      ], 3),
      q('\u1EE8ng d\u1EE5ng m\xE3 ngu\u1ED3n m\u1EDF gi\u1EA3 m\u1EA1o mang t\xEAn "OpenClaw" ch\u1EE9a m\xE3 \u0111\u1ED9c nguy hi\u1EC3m \u0111\u01B0\u1EE3c thi\u1EBFt k\u1EBF nh\u1EB1m m\u1EE5c \u0111\xEDch t\u1EA5n c\xF4ng v\xE0o \u0111\u1ED1i t\u01B0\u1EE3ng n\xE0o c\u1EE7a ng\u01B0\u1EDDi d\xF9ng?', [
        "C\xE1c t\u1EC7p tin h\xECnh \u1EA3nh l\u01B0u tr\xEAn th\u01B0 m\u1EE5c Google Drive.",
        "C\xE1c thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng m\xE0n h\xECnh c\u1EA3m \u1EE9ng c\u1EE7a \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh.",
        "H\u1EC7 th\u1ED1ng \u0111i\u1EC1u h\xF2a nhi\u1EC7t \u0111\u1ED9 ch\u1EA1y ng\u1EA7m c\u1EE7a ph\xF2ng m\xE1y ch\u1EE7.",
        "Th\xF4ng tin s\u1ED1 d\u01B0, m\xE3 kh\xF3a v\xED ti\u1EC1n \u0111i\u1EC7n t\u1EED v\xE0 d\u1EEF li\u1EC7u t\xE0i kho\u1EA3n l\u01B0u trong tr\xECnh qu\u1EA3n l\xFD m\u1EADt kh\u1EA9u."
      ], 3),
      q("C\u01A1 ch\u1EBF x\xE1c th\u1EF1c \u0111a th\xE0nh t\u1ED1 (MFA/2FA) b\u1EA3o v\u1EC7 t\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n d\u1EF1a tr\xEAn nguy\xEAn l\xFD c\u1ED1t l\xF5i n\xE0o?", [
        "Y\xEAu c\u1EA7u ng\u01B0\u1EDDi d\xF9ng ph\u1EA3i nh\u1EADp m\u1EADt kh\u1EA9u hai l\u1EA7n li\xEAn ti\u1EBFp gi\u1ED1ng nhau.",
        "T\u1EF1 \u0111\u1ED9ng m\xE3 h\xF3a t\xEAn \u0111\u0103ng nh\u1EADp th\xE0nh chu\u1ED7i k\xFD t\u1EF1 hex 96 k\xFD t\u1EF1.",
        "Y\xEAu c\u1EA7u k\u1EBFt h\u1EE3p gi\u1EEFa c\xE1i b\u1EA1n bi\u1EBFt (m\u1EADt kh\u1EA9u) v\xE0 c\xE1i b\u1EA1n s\u1EDF h\u1EEFu/\u0111ang n\u1EAFm gi\u1EEF (m\xE3 OTP g\u1EEDi v\u1EC1 \u0111i\u1EC7n tho\u1EA1i ho\u1EB7c \u1EE9ng d\u1EE5ng Authenticator).",
        "Ch\u1EA5m \u0111i\u1EC3m m\u1EE9c \u0111\u1ED9 m\u1EA1nh y\u1EBFu c\u1EE7a m\u1EADt kh\u1EA9u tr\u01B0\u1EDBc khi b\u1EA5m \u0111\u0103ng nh\u1EADp."
      ], 2),
      q("M\xE1y t\xEDnh c\u1EE7a c\u01A1 quan c\xF3 d\u1EA5u hi\u1EC7u n\xE0o sau \u0111\xE2y c\u1EA7n \u0111\u01B0\u1EE3c c\xE1ch ly kh\u1ECFi m\u1EA1ng n\u1ED9i b\u1ED9 ngay l\u1EADp t\u1EE9c \u0111\u1EC3 ki\u1EC3m tra m\xE3 \u0111\u1ED9c?", [
        "Xu\u1EA5t hi\u1EC7n t\u1EC7p tin l\u1EA1 t\u1EF1 sinh ra h\xE0ng lo\u1EA1t, m\xE1y t\xEDnh t\u1EF1 g\u1EEDi file qua m\u1EA1ng, xu\u1EA5t hi\u1EC7n th\xF4ng b\xE1o t\u1ED1ng ti\u1EC1n \u0111\xF2i ti\u1EC1n chu\u1ED9c b\u1EB1ng ti\u1EC1n \u1EA3o.",
        "Dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB tr\u1ED1ng c\u1EE7a \u1ED5 \u0111\u0129a c\u1EE9ng t\u0103ng l\xEAn sau khi d\u1ECDn r\xE1c.",
        "H\u1EC7 \u0111i\u1EC1u h\xE0nh t\u1EF1 \u0111\u1ED9ng c\u1EADp nh\u1EADt b\u1EA3n v\xE1 b\u1EA3o m\u1EADt v\xE0o ban \u0111\xEAm.",
        "M\xE0n h\xECnh hi\u1EC3n th\u1ECB th\xF4ng b\xE1o y\xEAu c\u1EA7u c\u1EAFm d\xE2y s\u1EA1c pin."
      ], 0),
      q('T\u1EA1i sao c\xE1c chuy\xEAn gia an ninh m\u1EA1ng khuy\u1EBFn c\xE1o tuy\u1EC7t \u0111\u1ED1i kh\xF4ng s\u1EED d\u1EE5ng t\xEDnh n\u0103ng "Ghi nh\u1EDB m\u1EADt kh\u1EA9u" t\u1EF1 \u0111\u1ED9ng tr\xEAn c\xE1c m\xE1y t\xEDnh d\xF9ng chung, m\xE1y t\xEDnh c\xF4ng c\u1ED9ng?', [
        "B\u1EA5t k\u1EF3 ng\u01B0\u1EDDi n\xE0o s\u1EED d\u1EE5ng m\xE1y t\xEDnh \u0111\xF3 sau b\u1EA1n \u0111\u1EC1u c\xF3 th\u1EC3 t\u1EF1 \u0111\u1ED9ng \u0111\u0103ng nh\u1EADp v\xE0o t\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n ho\u1EB7c xem m\u1EADt kh\u1EA9u thu\u1EA7n trong ph\u1EA7n c\xE0i \u0111\u1EB7t tr\xECnh duy\u1EC7t.",
        "L\xE0m gi\u1EA3m hi\u1EC7u su\u1EA5t x\u1EED l\xFD d\u1EEF li\u1EC7u ph\u1EB3ng c\u1EE7a chip CPU m\xE1y t\xEDnh.",
        "Khi\u1EBFn h\u1EC7 th\u1ED1ng m\xE1y ch\u1EE7 b\u1ECB d\xEDnh l\u1ED7i c\u1EA5u h\xECnh API Google Drive.",
        "L\xE0m m\u1EA5t t\xEDnh n\u0103ng x\xE1c th\u1EF1c token HMAC c\u1EE7a h\u1EC7 th\u1ED1ng."
      ], 0),
      q("Khi b\u1ECB d\xEDnh m\xE3 \u0111\u1ED9c t\u1ED1ng ti\u1EC1n (Ransomware), h\xE0nh vi n\xE0o sau \u0111\xE2y l\xE0 SAI L\u1EA6M v\xE0 c\xF3 th\u1EC3 g\xE2y m\u1EA5t m\xE1t d\u1EEF li\u1EC7u v\u0129nh vi\u1EC5n?", [
        "T\u1EF1 \xFD ch\u1EA1y c\xE1c ph\u1EA7n m\u1EC1m d\u1ECDn r\xE1c, ch\u1EC9nh s\u1EEDa file h\u1EC7 th\u1ED1ng ho\u1EB7c chuy\u1EC3n ti\u1EC1n tr\u1EA3 ti\u1EC1n chu\u1ED9c cho hacker m\xE0 kh\xF4ng b\xE1o c\xE1o b\u1ED9 ph\u1EADn chuy\xEAn tr\xE1ch ATTT.",
        "Ng\u1EAFt k\u1EBFt n\u1ED1i m\u1EA1ng WiFi ho\u1EB7c r\xFAt d\xE2y m\u1EA1ng LAN c\u1EE7a m\xE1y t\xEDnh ngay l\u1EADp t\u1EE9c.",
        "Li\xEAn h\u1EC7 ngay v\u1EDBi \u0111\u1ED9i k\u1EF9 thu\u1EADt Blue Team c\u1EE7a c\u01A1 quan \u0111\u1EC3 \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3 chuy\xEAn s\xE2u.",
        "T\u1EAFt ngu\u1ED3n m\xE1y t\xEDnh \u0111\u1EC3 c\xF4 l\u1EADp v\xF9ng nh\u1EDB RAM b\u1ECB t\u1EA5n c\xF4ng."
      ], 0),
      q("Vi\u1EC7c \u0111\u0103ng t\u1EA3i h\xECnh \u1EA3nh th\u1EBB ng\xE0nh, th\u1EBB nh\xE2n vi\xEAn ho\u1EB7c v\xE9 m\xE1y bay c\xF3 hi\u1EC3n th\u1ECB r\xF5 m\xE3 v\u1EA1ch (Barcode/QR code) l\xEAn m\u1EA1ng x\xE3 h\u1ED9i ti\u1EC1m \u1EA9n nguy c\u01A1 b\u1EA3o m\u1EADt g\xEC?", [
        "L\xE0m gi\u1EA3m ch\u1EA5t l\u01B0\u1EE3ng h\xECnh \u1EA3nh hi\u1EC3n th\u1ECB tr\xEAn trang c\xE1 nh\xE2n c\u1EE7a b\u1EA1n.",
        "K\u1EBB x\u1EA5u c\xF3 th\u1EC3 qu\xE9t m\xE3 v\u1EA1ch \u0111\u1EC3 tr\xEDch xu\u1EA5t th\xF4ng tin c\xE1 nh\xE2n nh\u1EA1y c\u1EA3m, s\u1ED1 CCCD, ng\xE0y sinh nh\u1EB1m m\u1EE5c \u0111\xEDch l\u1EEBa \u0111\u1EA3o ho\u1EB7c gi\u1EA3 m\u1EA1o th\xF4ng tin.",
        "T\xE0i kho\u1EA3n m\u1EA1ng x\xE3 h\u1ED9i c\u1EE7a b\u1EA1n s\u1EBD b\u1ECB t\u1EF1 \u0111\u1ED9ng kh\xF3a do vi ph\u1EA1m b\u1EA3n quy\u1EC1n h\xECnh \u1EA3nh.",
        "H\u1EC7 th\u1ED1ng m\u1EA1ng n\u1ED9i b\u1ED9 c\u01A1 quan s\u1EBD b\u1ECB s\u1EADp do qu\xE1 t\u1EA3i y\xEAu c\u1EA7u truy c\u1EADp."
      ], 1),
      q("Khi nh\u1EADn \u0111\u01B0\u1EE3c m\u1ED9t email t\u1EEB \u0111\u1ECBa ch\u1EC9 c\xF3 \u0111u\xF4i l\u1EA1 (v\xED d\u1EE5: vksnddanang@gmail.com thay v\xEC email c\xF4ng v\u1EE5 @vks.gov.vn) t\u1EF1 x\u01B0ng l\xE0 L\xE3nh \u0111\u1EA1o \u0111\u01A1n v\u1ECB y\xEAu c\u1EA7u b\u1EA1n chuy\u1EC3n kho\u1EA3n g\u1EA5p m\u1ED9t s\u1ED1 ti\u1EC1n \u0111\u1EC3 x\u1EED l\xFD vi\u1EC7c c\xF4ng, b\u1EA1n n\xEAn x\u1EED l\xFD th\u1EBF n\xE0o?", [
        "Chuy\u1EC3n ti\u1EC1n ngay l\u1EADp t\u1EE9c v\xEC s\u1EE3 l\xE0m \u1EA3nh h\u01B0\u1EDFng \u0111\u1EBFn ti\u1EBFn \u0111\u1ED9 c\xF4ng vi\u1EC7c c\u1EE7a L\xE3nh \u0111\u1EA1o.",
        "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng chuy\u1EC3n ti\u1EC1n, th\u1EF1c hi\u1EC7n x\xE1c minh l\u1EA1i tr\u1EF1c ti\u1EBFp b\u1EB1ng c\xE1ch g\u1ECDi \u0111i\u1EC7n tho\u1EA1i ho\u1EB7c g\u1EB7p tr\u1EF1c ti\u1EBFp L\xE3nh \u0111\u1EA1o \u0111\u1EC3 ki\u1EC3m tra th\xF4ng tin.",
        "G\u1EEDi l\u1EA1i email y\xEAu c\u1EA7u cung c\u1EA5p th\xEAm h\xECnh \u1EA3nh th\u1EBB CCCD c\u1EE7a L\xE3nh \u0111\u1EA1o \u0111\u1EC3 x\xE1c th\u1EF1c.",
        "Chuy\u1EC3n ti\u1EBFp email \u0111\xF3 cho to\xE0n b\u1ED9 ng\u01B0\u1EDDi d\xF9ng trong c\u01A1 quan c\xF9ng bi\u1EBFt."
      ], 1),
      q("Ph\u01B0\u01A1ng th\u1EE9c l\u01B0u tr\u1EEF m\u1EADt kh\u1EA9u an to\xE0n nh\u1EA5t \u0111\u01B0\u1EE3c c\xE1c t\u1ED5 ch\u1EE9c c\xF4ng ngh\u1EC7 khuy\u1EBFn ngh\u1ECB d\xE0nh cho ng\u01B0\u1EDDi d\xF9ng c\xE1 nh\xE2n l\xE0 g\xEC?", [
        "S\u1EED d\u1EE5ng \u1EE9ng d\u1EE5ng qu\u1EA3n l\xFD m\u1EADt kh\u1EA9u chuy\xEAn d\u1EE5ng c\xF3 m\xE3 h\xF3a \u0111\u1EA7u cu\u1ED1i, b\u1EA3o v\u1EC7 b\u1EB1ng m\xE3 v\xE2n tay ho\u1EB7c m\u1EADt kh\u1EA9u ch\u1EE7 (Master Password) m\u1EA1nh.",
        "Ghi ch\xE9p to\xE0n b\u1ED9 m\u1EADt kh\u1EA9u v\xE0o m\u1ED9t cu\u1ED1n s\u1ED5 tay nh\u1ECF \u0111\u1EC3 tr\xEAn b\xE0n l\xE0m vi\u1EC7c.",
        "L\u01B0u t\u1EA5t c\u1EA3 m\u1EADt kh\u1EA9u v\xE0o m\u1ED9t file v\u0103n b\u1EA3n \u0111\u1EB7t t\xEAn l\xE0 matkhau.txt ngay tr\xEAn m\xE0n h\xECnh n\u1EC1n.",
        "\u0110\u1EB7t m\u1EADt kh\u1EA9u tr\xF9ng v\u1EDBi t\xEAn t\xE0i kho\u1EA3n \u0111\u0103ng nh\u1EADp \u0111\u1EC3 kh\xF4ng bao gi\u1EDD b\u1ECB qu\xEAn."
      ], 0),
      q('Th\u1EE7 \u0111o\u1EA1n l\u1EEBa \u0111\u1EA3o "T\u1ED9i ph\u1EA1m gi\u1EA3 danh c\u01A1 quan T\u01B0 ph\xE1p" (Vi\u1EC7n ki\u1EC3m s\xE1t, T\xF2a \xE1n, C\xF4ng an) th\u01B0\u1EDDng \u0111\xE1nh v\xE0o y\u1EBFu t\u1ED1 t\xE2m l\xFD n\xE0o c\u1EE7a n\u1EA1n nh\xE2n?', [
        "S\u1EF1 t\xF2 m\xF2 v\u1EC1 c\xE1c ch\u01B0\u01A1ng tr\xECnh khuy\u1EBFn m\xE3i, tr\xFAng th\u01B0\u1EDFng tr\u1EF1c tuy\u1EBFn.",
        "L\xF2ng tham \u0111\u1ED1i v\u1EDBi c\xE1c kho\u1EA3n ti\u1EC1n th\u01B0\u1EDFng ho\u1EB7c c\u01A1 h\u1ED9i vi\u1EC7c l\xE0m l\u01B0\u01A1ng cao tr\xEAn m\u1EA1ng.",
        "S\u1EF1 l\u01A1 l\xE0 khi tham gia c\xE1c tr\xF2 ch\u01A1i \u0111i\u1EC7n t\u1EED tr\u1EF1c tuy\u1EBFn.",
        "S\u1EF1 s\u1EE3 h\xE3i, hoang mang khi b\u1ECB h\xF9 d\u1ECDa li\xEAn quan \u0111\u1EBFn c\xE1c v\u1EE5 \xE1n h\xECnh s\u1EF1, ma t\xFAy, r\u1EEDa ti\u1EC1n v\xE0 y\xEAu c\u1EA7u gi\u1EEF b\xED m\u1EADt."
      ], 3),
      q("Bi\u1EC7n ph\xE1p n\xE0o sau \u0111\xE2y gi\xFAp b\u1EA3o v\u1EC7 \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh \u1EE9ng d\u1EE5ng ng\xE2n h\xE0ng s\u1ED1 tr\xE1nh b\u1ECB m\xE3 \u0111\u1ED9c t\u1EF1 \u0111\u1ED9ng c\xE0i \u0111\u1EB7t chi\u1EBFm quy\u1EC1n \u0111i\u1EC1u khi\u1EC3n Accessibility Service?", [
        "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng b\u1EA5m v\xE0o c\xE1c \u0111\u01B0\u1EDDng link l\u1EA1 t\u1EA3i file c\xE0i \u0111\u1EB7t c\xF3 \u0111u\xF4i .apk b\xEAn ngo\xE0i c\u1EEDa h\xE0ng \u1EE9ng d\u1EE5ng ch\xEDnh th\u1ED1ng (Google Play / App Store).",
        "Lu\xF4n m\u1EDF t\xEDnh n\u0103ng \u0111\u1ECBnh v\u1ECB v\u1ECB tr\xED GPS m\u1ECDi l\xFAc m\u1ECDi n\u01A1i.",
        "C\xE0i \u0111\u1EB7t qu\xE1 nhi\u1EC1u \u1EE9ng d\u1EE5ng h\xECnh n\u1EC1n \u0111\u1ED9ng kh\xF4ng r\xF5 ngu\u1ED3n g\u1ED1c.",
        "T\u1EAFt t\xEDnh n\u0103ng t\u1EF1 \u0111\u1ED9ng c\u1EADp nh\u1EADt h\u1EC7 \u0111i\u1EC1u h\xE0nh c\u1EE7a \u0111i\u1EC7n tho\u1EA1i."
      ], 0),
      q('Kh\xE1i ni\u1EC7m "H\xE0ng \u0111\u1EE3i ghi d\u1EEF li\u1EC7u ph\u1EB3ng" trong h\u1EC7 th\u1ED1ng thi tr\u1EF1c tuy\u1EBFn ph\u1EE5c v\u1EE5 m\u1EE5c \u0111\xEDch g\xEC trong thi\u1EBFt k\u1EBF h\u1EC7 th\u1ED1ng?', [
        "Nh\u1EADn c\xE1c thay \u0111\u1ED5i d\u1EEF li\u1EC7u tr\xEAn RAM v\xE0 x\u1EED l\xFD l\u01B0u tu\u1EA7n t\u1EF1 xu\u1ED1ng \u1ED5 \u0111\u0129a m\u1ED9t c\xE1ch b\u1EA5t \u0111\u1ED3ng b\u1ED9 \u0111\u1EC3 kh\xF4ng l\xE0m ngh\u1EBDn tr\u1EA3i nghi\u1EC7m ng\u01B0\u1EDDi d\xF9ng.",
        "S\u1EAFp x\u1EBFp th\u1EE9 t\u1EF1 b\u1EA3ng \u0111i\u1EC3m t\u1EEB cao xu\u1ED1ng th\u1EA5p c\u1EE7a c\xE1c th\xED sinh.",
        "T\u1EF1 \u0111\u1ED9ng b\u0103m m\u1EADt kh\u1EA9u ng\u01B0\u1EDDi d\xF9ng sang \u0111\u1ECBnh d\u1EA1ng chu\u1ED7i m\xE3 h\xF3a scrypt.",
        "Ng\u0103n ch\u1EB7n c\xE1c cu\u1ED9c t\u1EA5n c\xF4ng qu\xE9t c\u1ED5ng t\u1EEB c\xF4ng c\u1EE5 Nmap c\u1EE7a \u0111\u1ED1i ph\u01B0\u01A1ng."
      ], 0),
      q("File package.json trong th\u01B0 m\u1EE5c m\xE3 ngu\u1ED3n c\u1EE7a \u1EE9ng d\u1EE5ng Node.js \u0111\xF3ng vai tr\xF2 g\xEC?", [
        "Ch\u1EE9a to\xE0n b\u1ED9 m\u1EADt kh\u1EA9u v\xE0 th\xF4ng tin C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n c\u1EE7a Admin h\u1EC7 th\u1ED1ng.",
        "L\u01B0u tr\u1EEF n\u1ED9i dung c\xE1c c\xE2u h\u1ECFi \u0111\u1EC1 thi tr\u1EAFc nghi\u1EC7m d\u1EA1ng d\u1EEF li\u1EC7u ph\u1EB3ng.",
        "Khai b\xE1o th\xF4ng tin d\u1EF1 \xE1n, c\u1EA5u h\xECnh l\u1EC7nh ch\u1EA1y (start, dev) v\xE0 danh s\xE1ch c\xE1c th\u01B0 vi\u1EC7n ph\u1EE5 thu\u1ED9c b\u1EAFt bu\u1ED9c ph\u1EA3i c\xE0i \u0111\u1EB7t (Dependencies).",
        "Th\u1EF1c hi\u1EC7n nhi\u1EC7m v\u1EE5 k\u1EBFt n\u1ED1i tr\u1EF1c ti\u1EBFp \u0111\u1EBFn giao di\u1EC7n Google Drive API v3."
      ], 2),
      // ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — CÔNG CỤ & GIÁM SÁT (Câu 18–40) ----
      q("Khi ki\u1EC3m tra l\u1ECBch s\u1EED t\u1EA5n c\xF4ng tr\xEAn giao di\u1EC7n ph\xF2ng th\u1EE7 (BlueTeam Dashboard), n\u1EBFu th\u1EA5y m\u1ED9t chu\u1ED7i IP li\xEAn t\u1EE5c qu\xE9t c\xE1c t\u1EC7p tin d\u1EA1ng config.php.bak, backup.zip, .env th\xEC k\u1EBB t\u1EA5n c\xF4ng \u0111ang th\u1EF1c hi\u1EC7n k\u1EF9 thu\u1EADt g\xEC?", [
        "SQL Injection v\u01B0\u1EE3t quy\u1EC1n h\u1EA1n.",
        "K\u1EF9 thu\u1EADt thu th\u1EADp th\xF4ng tin v\xE0 d\xF2 t\xECm c\xE1c file c\u1EA5u h\xECnh, file sao l\u01B0u b\u1ECB l\u1ED9 tr\xEAn m\xE1y ch\u1EE7 (Information Gathering).",
        "T\u1EA5n c\xF4ng l\u1EEBa \u0111\u1EA3o ng\u01B0\u1EDDi d\xF9ng qua giao di\u1EC7n email t\u0129nh.",
        "Th\u1EF1c thi m\xE3 \u0111\u1ED9c m\xE3 h\xF3a t\u1ED1ng ti\u1EC1n d\u1EEF li\u1EC7u ph\u1EB3ng tr\xEAn RAM."
      ], 1),
      q("Nhi\u1EC7m v\u1EE5 c\u1ED1t l\xF5i v\xE0 quan tr\u1ECDng nh\u1EA5t c\u1EE7a \u0110\u1ED9i Ph\xF2ng th\u1EE7 (Blue Team) khi h\u1EC7 th\u1ED1ng m\u1EA1ng \u0111ang di\u1EC5n ra di\u1EC5n t\u1EADp an ninh m\u1EA1ng l\xE0 g\xEC?", [
        "T\xECm c\xE1ch x\xE2m nh\u1EADp v\xE0o m\xE1y t\xEDnh c\xE1 nh\xE2n c\u1EE7a c\xE1c th\xE0nh vi\xEAn \u0110\u1ED9i T\u1EA5n c\xF4ng.",
        "Ph\xE1t hi\u1EC7n s\u1EDBm cu\u1ED9c t\u1EA5n c\xF4ng, ph\xE2n t\xEDch k\u1EF9 thu\u1EADt khai th\xE1c qua log h\u1EC7 th\u1ED1ng, th\u1EF1c hi\u1EC7n v\xE1 l\u1ED7 h\u1ED5ng v\xE0 kh\xF4i ph\u1EE5c ho\u1EA1t \u0111\u1ED9ng b\xECnh th\u01B0\u1EDDng.",
        "Thay \u0111\u1ED5i to\xE0n b\u1ED9 n\u1ED9i dung hi\u1EC3n th\u1ECB tr\xEAn trang ch\u1EE7 tuy\xEAn truy\u1EC1n c\u1ED5 \u0111\u1ED9ng.",
        "T\u1EA1o ra c\xE1c file d\u1EEF li\u1EC7u tr\u1ED1ng trong th\u01B0 m\u1EE5c ./data/ c\u1EE7a m\xE1y ch\u1EE7."
      ], 1),
      q("Khi ch\u1EA1y c\xF4ng c\u1EE5 Nmap v\u1EDBi t\xF9y ch\u1ECDn qu\xE9t phi\xEAn b\u1EA3n d\u1ECBch v\u1EE5 \u0111\u1EA7y \u0111\u1EE7 d\u1EA1ng nmap -sV -O <IP_M\xE1y_Ch\u1EE7>, m\u1EE5c ti\xEAu thu \u0111\u01B0\u1EE3c l\xE0 th\xF4ng tin n\xE0o?", [
        "T\xEAn d\u1ECBch v\u1EE5, phi\xEAn b\u1EA3n ch\xEDnh x\xE1c c\u1EE7a ph\u1EA7n m\u1EC1m \u0111ang ch\u1EA1y tr\xEAn c\xE1c c\u1ED5ng m\u1EDF v\xE0 t\xEAn h\u1EC7 \u0111i\u1EC1u h\xE0nh c\u1EE7a m\xE1y ch\u1EE7 m\u1EE5c ti\xEAu.",
        "Danh s\xE1ch to\xE0n b\u1ED9 t\xEAn \u0111\u0103ng nh\u1EADp v\xE0 m\u1EADt kh\u1EA9u c\u1EE7a ng\u01B0\u1EDDi d\xF9ng c\xF3 tr\xEAn m\xE1y ch\u1EE7.",
        "T\u1EF7 l\u1EC7 ph\u1EA7n tr\u0103m c\xE1c cu\u1ED9c t\u1EA5n c\xF4ng b\u1EBB kh\xF3a th\xE0nh c\xF4ng v\xE0o h\u1EC7 th\u1ED1ng d\u1EEF li\u1EC7u.",
        "N\u1ED9i dung chi ti\u1EBFt c\u1EA5u tr\xFAc 3 file JSON \u0111ang l\u01B0u tr\u1EEF tr\xEAn m\u1EA1ng."
      ], 0),
      q("C\xF4ng c\u1EE5 b\u1EA3o m\u1EADt \u1EE9ng d\u1EE5ng OWASP ZAP c\xF3 t\xEDnh n\u0103ng n\xE0o t\u01B0\u01A1ng \u0111\u1ED3ng v\u1EDBi \u1EE9ng d\u1EE5ng Burp Suite trong \u0111\xE1nh gi\xE1 ATTT website?", [
        "Ho\u1EA1t \u0111\u1ED9ng nh\u01B0 m\u1ED9t proxy trung gian cho ph\xE9p ch\u1EB7n b\u1EAFt, ch\u1EC9nh s\u1EEDa c\xE1c tham s\u1ED1 \u0111\u1EA7u v\xE0o c\u1EE7a request g\u1EEDi t\u1EEB tr\xECnh duy\u1EC7t l\xEAn server.",
        "T\u1EF1 \u0111\u1ED9ng sinh ra chu\u1ED7i m\xE3 h\xF3a token HMAC-SHA256 phi\xEAn l\xE0m vi\u1EC7c.",
        "Thay \u0111\u1ED5i thu\u1EADt to\xE1n b\u0103m m\u1EADt kh\u1EA9u t\u1EEB scrypt sang MD5 th\xF4.",
        "\u0110\u1ED3ng b\u1ED9 d\u1EEF li\u1EC7u ph\u1EB3ng tr\u1EF1c ti\u1EBFp l\xEAn th\u01B0 m\u1EE5c Google Drive c\u1EE7a b\u1EA1n."
      ], 0),
      q("Bi\u1EBFn m\xF4i tr\u01B0\u1EDDng ADMIN_CCCDS \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh trong h\u1EC7 th\u1ED1ng qu\u1EA3n l\xFD thi tr\u1EF1c tuy\u1EBFn d\xF9ng \u0111\u1EC3 gi\u1EA3i quy\u1EBFt b\xE0i to\xE1n g\xEC?", [
        "L\u01B0u to\xE0n b\u1ED9 s\u1ED1 \u0111\u1ECBnh danh c\u1EE7a th\xED sinh tham gia cu\u1ED9c thi tr\u1EF1c tuy\u1EBFn.",
        "Quy \u0111\u1ECBnh \u0111\u1ED9 d\xE0i t\u1ED1i \u0111a c\u1EE7a chu\u1ED7i m\xE3 h\xF3a m\u1EADt kh\u1EA9u trong h\xE0m crypto.",
        "Khai b\xE1o danh s\xE1ch c\xE1c s\u1ED1 C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n \u0111\u01B0\u1EE3c h\u1EC7 th\u1ED1ng c\u1EA5p \u0111\u1EB7c quy\u1EC1n l\xE0m Admin t\u1ED1i cao ngay khi ti\u1EBFn h\xE0nh \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n.",
        "X\xE1c th\u1EF1c quy\u1EC1n ghi d\u1EEF li\u1EC7u c\u1EE7a robot l\xEAn d\u1ECBch v\u1EE5 l\u01B0u tr\u1EEF \u0111\xE1m m\xE2y."
      ], 2),
      q("\u0110i\u1EC3m kh\xE1c bi\u1EC7t c\u1ED1t l\xF5i gi\u1EEFa c\u01A1 ch\u1EBF m\xE3 h\xF3a d\u1EEF li\u1EC7u file b\u1EB1ng thu\u1EADt to\xE1n AES v\xE0 c\u01A1 ch\u1EBF b\u0103m m\u1EADt kh\u1EA9u b\u1EB1ng thu\u1EADt to\xE1n scrypt l\xE0 g\xEC?", [
        "AES ch\u1EC9 ch\u1EA1y tr\xEAn m\xE1y t\xEDnh c\u1EA5u h\xECnh m\u1EA1nh; scrypt ch\u1EA1y \u0111\u01B0\u1EE3c tr\xEAn m\u1ECDi thi\u1EBFt b\u1ECB di \u0111\u1ED9ng.",
        "AES t\u1EF1 \u0111\u1ED9ng ch\xE8n th\xEAm chu\u1ED7i mu\u1ED1i ng\u1EABu nhi\xEAn; scrypt b\u1EAFt bu\u1ED9c nh\u1EADp file JSON th\xF4 1 d\xF2ng.",
        "AES ch\u1EC9 d\xF9ng \u1EDF ch\u1EBF \u0111\u1ED9 c\u1EE5c b\u1ED9; scrypt b\u1EAFt bu\u1ED9c ph\u1EA3i \u0111\u1ED3ng b\u1ED9 l\xEAn d\u1ECBch v\u1EE5 \u0111\xE1m m\xE2y.",
        "AES l\xE0 m\xE3 h\xF3a 2 chi\u1EC1u (c\xF3 th\u1EC3 gi\u1EA3i m\xE3 l\u1EA1i th\xE0nh file g\u1ED1c n\u1EBFu c\xF3 kh\xF3a); scrypt l\xE0 h\xE0m b\u0103m 1 chi\u1EC1u (kh\xF4ng th\u1EC3 d\u1ECBch ng\u01B0\u1EE3c l\u1EA1i m\u1EADt kh\u1EA9u g\u1ED1c t\u1EEB chu\u1ED7i hash)."
      ], 3),
      q("T\u1EA1i sao trong file c\u1EA5u h\xECnh m\xF4i tr\u01B0\u1EDDng h\u1EC7 th\u1ED1ng, chu\u1ED7i kh\xF3a private_key c\u1EE7a t\xE0i kho\u1EA3n Google Service Account th\u01B0\u1EDDng \u0111\u01B0\u1EE3c khuy\u1EBFn c\xE1o m\xE3 h\xF3a sang \u0111\u1ECBnh d\u1EA1ng Base64 tr\u01B0\u1EDBc khi d\xE1n v\xE0o bi\u1EBFn m\xF4i tr\u01B0\u1EDDng GOOGLE_SERVICE_ACCOUNT_JSON?", [
        "\u0110\u1EC3 l\xE0m t\u0103ng \u0111\u1ED9 b\u1EA3o m\u1EADt c\u1EE7a kh\xF3a l\xEAn g\u1EA5p hai l\u1EA7n ch\u1ED1ng b\u1EBB kh\xF3a.",
        "V\xEC bi\u1EBFn m\xF4i tr\u01B0\u1EDDng h\u1EC7 th\u1ED1ng r\u1EA5t kh\xF3 l\u01B0u tr\u1EEF nguy\xEAn v\u1EB9n m\u1ED9t file v\u0103n b\u1EA3n JSON ch\u1EE9a nhi\u1EC1u k\xFD t\u1EF1 xu\u1ED1ng d\xF2ng v\xE0 d\u1EA5u ngo\u1EB7c k\xE9p ph\u1EE9c t\u1EA1p; Base64 gi\xFAp bi\u1EBFn \u0111\u1ED5i th\xE0nh m\u1ED9t chu\u1ED7i k\xFD t\u1EF1 li\u1EC1n m\u1EA1ch duy nh\u1EA5t tr\xEAn 1 d\xF2ng.",
        "Nh\u1EB1m l\xE0m gi\u1EA3m dung l\u01B0\u1EE3ng c\u1EE7a file key t\u1EEB v\xE0i KB xu\u1ED1ng c\xF2n v\xE0i byte.",
        "\u0110\u1EC3 h\u1EC7 th\u1ED1ng Render t\u1EF1 \u0111\u1ED9ng ph\xE2n quy\u1EC1n Editor cho email c\u1EE7a robot."
      ], 1),
      q("Khi ph\xE2n t\xEDch l\u01B0u l\u01B0\u1EE3ng m\u1EA1ng b\u1EB1ng ph\u1EA7n m\u1EC1m Wireshark, n\u1EBFu trang web s\u1EED d\u1EE5ng giao th\u1EE9c HTTP th\xF4ng th\u01B0\u1EDDng, k\u1EF9 s\u01B0 b\u1EA3o m\u1EADt c\xF3 th\u1EC3 nh\xECn th\u1EA5y th\xF4ng tin nh\u1EA1y c\u1EA3m n\xE0o c\u1EE7a ng\u01B0\u1EDDi d\xF9ng truy\u1EC1n qua m\u1EA1ng?", [
        "Nh\xECn th\u1EA5y to\xE0n b\u1ED9 n\u1ED9i dung thu\u1EA7n (Plaintext) d\u1EEF li\u1EC7u g\u1EEDi \u0111i, bao g\u1ED3m c\u1EA3 t\xE0i kho\u1EA3n \u0111\u0103ng nh\u1EADp, m\u1EADt kh\u1EA9u, n\u1ED9i dung b\xE0i l\xE0m tr\u1EAFc nghi\u1EC7m.",
        "Ch\u1EC9 nh\xECn th\u1EA5y \u0111\u1ECBa ch\u1EC9 IP c\u1EE7a m\xE1y ch\u1EE7 web c\xF4ng c\u1ED9ng.",
        "Kh\xF4ng nh\xECn th\u1EA5y g\xEC v\xEC Wireshark t\u1EF1 \u0111\u1ED9ng m\xE3 h\xF3a d\u1EEF li\u1EC7u th\xE0nh chu\u1ED7i hex.",
        "Ch\u1EC9 nh\xECn th\u1EA5y dung l\u01B0\u1EE3ng k\xEDch th\u01B0\u1EDBc c\u1EE7a file d\u1EEF li\u1EC7u \u0111ang truy\u1EC1n t\u1EA3i."
      ], 0),
      q("Trong c\u01A1 ch\u1EBF \u0111\u1ED3ng b\u1ED9 ng\u01B0\u1EE3c d\u1EEF li\u1EC7u (Sync) c\u1EE7a h\u1EC7 th\u1ED1ng thi tr\u1EF1c tuy\u1EBFn, khi m\u1ED9t route x\u1EED l\xFD ghi nh\u1EADn d\u1EEF li\u1EC7u m\u1EDBi tr\xEAn RAM, n\xF3 s\u1EBD \u0111\xE1nh d\u1EA5u file \u0111\xF3 \u1EDF tr\u1EA1ng th\xE1i g\xEC \u0111\u1EC3 v\xF2ng upload n\u1EC1n ti\u1EBFn h\xE0nh l\u01B0u l\xEAn Drive?", [
        "Tr\u1EA1ng th\xE1i clean (S\u1EA1ch s\u1EBD).",
        "Tr\u1EA1ng th\xE1i locked (\u0110ang b\u1ECB kh\xF3a lu\u1ED3ng).",
        "Tr\u1EA1ng th\xE1i dirty (D\u1EEF li\u1EC7u b\u1EA9n / D\u1EEF li\u1EC7u \u0111\xE3 b\u1ECB thay \u0111\u1ED5i c\u1EA7n \u0111\u1ED3ng b\u1ED9).",
        "Tr\u1EA1ng th\xE1i flushed (\u0110\xE3 l\u01B0u xong)."
      ], 2),
      q("C\u01A1 ch\u1EBF t\u1EF1 \u0111\u1ED9ng th\u1EED l\u1EA1i (Retry v\u1EDBi chi\u1EBFn l\u01B0\u1EE3c Backoff t\u0103ng d\u1EA7n th\u1EDDi gian 1s -> 2s -> 4s) c\u1EE7a th\u01B0 vi\u1EC7n k\u1EBFt n\u1ED1i Google Drive API gi\xFAp h\u1EC7 th\u1ED1ng gi\u1EA3i quy\u1EBFt v\u1EA5n \u0111\u1EC1 g\xEC?", [
        "T\u1EF1 \u0111\u1ED9ng b\u1EBB kh\xF3a khi t\xE0i kho\u1EA3n Service Account b\u1ECB m\u1EA5t quy\u1EC1n truy c\u1EADp.",
        "L\xE0m t\u0103ng t\u1ED1c \u0111\u1ED9 x\u1EED l\xFD \u0111i\u1EC3m s\u1ED1 b\xE0i thi c\u1EE7a th\xED sinh tr\xEAn RAM cache.",
        "Gi\xFAp h\u1EC7 th\u1ED1ng t\u1EF1 ph\u1EE5c h\u1ED3i, v\u01B0\u1EE3t qua c\xE1c l\u1ED7i m\u1EA1ng t\u1EA1m th\u1EDDi ho\u1EB7c khi b\u1ECB Google t\u1EEB ch\u1ED1i do v\u01B0\u1EE3t qu\xE1 t\u1EA7n su\u1EA5t y\xEAu c\u1EA7u (M\xE3 l\u1ED7i 429 ho\u1EB7c l\u1ED7i 5xx).",
        "Thay \u0111\u1ED5i m\xE3 ID th\u01B0 m\u1EE5c l\u01B0u tr\u1EEF khi th\u01B0 m\u1EE5c c\u0169 b\u1ECB x\xF3a."
      ], 2),
      q("Khi ti\u1EBFn h\xE0nh c\u1EA5u h\xECnh bi\u1EBFn m\xF4i tr\u01B0\u1EDDng tr\xEAn Render, n\u1EBFu l\u1EADp tr\xECnh vi\xEAn qu\xEAn khai b\xE1o bi\u1EBFn SESSION_SECRET, h\u1EC7 th\u1ED1ng Express s\u1EBD x\u1EED l\xFD nh\u01B0 th\u1EBF n\xE0o khi kh\u1EDFi ch\u1EA1y?", [
        "\u1EE8ng d\u1EE5ng s\u1EBD t\u1EF1 \u0111\u1ED9ng d\u1EEBng ho\u1EA1t \u0111\u1ED9ng v\xE0 b\xE1o l\u1ED7i thi\u1EBFu bi\u1EBFn m\xF4i tr\u01B0\u1EDDng.",
        "Script ki\u1EC3m tra t\u1EF1 \u0111\u1ED9ng s\u1EBD t\u1EF1 t\u1EA1o ra m\u1ED9t chu\u1ED7i m\xE3 ng\u1EABu nhi\xEAn d\xE0i 96 k\xFD t\u1EF1 \u0111\u1EC3 l\xE0m kh\xF3a k\xFD token t\u1EA1m th\u1EDDi nh\u1EB1m duy tr\xEC ho\u1EA1t \u0111\u1ED9ng h\u1EC7 th\u1ED1ng.",
        "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng chuy\u1EC3n sang ch\u1EBF \u0111\u1ED9 \u0111\u0103ng nh\u1EADp kh\xF4ng c\u1EA7n m\u1EADt kh\u1EA9u.",
        "To\xE0n b\u1ED9 t\xE0i kho\u1EA3n th\xED sinh s\u1EBD t\u1EF1 \u0111\u1ED9ng \u0111\u01B0\u1EE3c ph\xE2n quy\u1EC1n th\xE0nh Admin."
      ], 1),
      q("L\u1EC7nh d\xF2ng l\u1EC7nh n\xE0o sau \u0111\xE2y d\xF9ng \u0111\u1EC3 c\xE0i \u0111\u1EB7t to\xE0n b\u1ED9 c\xE1c th\u01B0 vi\u1EC7n ph\u1EE5 thu\u1ED9c \u0111\u01B0\u1EE3c khai b\xE1o trong file package.json tr\u01B0\u1EDBc khi kh\u1EDFi ch\u1EA1y d\u1EF1 \xE1n Node.js tr\xEAn m\xE1y t\xEDnh c\xE1 nh\xE2n?", [
        "npm install",
        "npm start",
        "npm run dev",
        "node -v"
      ], 0),
      q("Ti\xEAu \u0111\u1EC1 HTTP n\xE0o (HTTP Header) x\xE1c \u0111\u1ECBnh \u0111\u1ECBnh d\u1EA1ng n\u1ED9i dung d\u1EEF li\u1EC7u \u0111\u01B0\u1EE3c g\u1EEDi trong ph\u1EA7n th\xE2n c\u1EE7a y\xEAu c\u1EA7u (v\xED d\u1EE5 x\xE1c \u0111\u1ECBnh d\u1EEF li\u1EC7u g\u1EEDi l\xEAn l\xE0 \u0111\u1ECBnh d\u1EA1ng JSON hay form d\u1EEF li\u1EC7u th\xF4ng th\u01B0\u1EDDng)?", [
        "Cookie.",
        "User-Agent.",
        "Authorization.",
        "Content-Type (v\xED d\u1EE5: application/json)."
      ], 3),
      q("T\u1EA1i sao c\u01A1 ch\u1EBF b\u1EA3o m\u1EADt ch\u1ED1ng d\xF2 m\u1EADt kh\u1EA9u gi\u1EDBi h\u1EA1n t\u1ED1i \u0111a 6 l\u1EA7n \u0111\u0103ng nh\u1EADp sai trong v\xF2ng 15 ph\xFAt l\u1EA1i b\u1EAFt bu\u1ED9c ph\u1EA3i \u0111i k\xE8m v\u1EDBi c\u01A1 ch\u1EBF b\u0103m m\u1EADt kh\u1EA9u c\xF3 th\u1EDDi gian x\u1EED l\xFD t\u1ED1n t\xE0i nguy\xEAn (nh\u01B0 h\xE0m scrypt)?", [
        "\u0110\u1EC3 t\u0103ng t\u1ED1i \u0111a chi ph\xED th\u1EDDi gian v\xE0 ph\u1EA7n c\u1EE9ng c\u1EE7a hacker n\u1EBFu h\u1ECD sao ch\xE9p \u0111\u01B0\u1EE3c file d\u1EEF li\u1EC7u v\u1EC1 m\xE1y \u0111\u1EC3 b\u1EBB kh\xF3a v\xE9t c\u1EA1n ngo\u1EA1i tuy\u1EBFn (Offline brute-force).",
        "Nh\u1EB1m gi\u1EA3m dung l\u01B0\u1EE3ng l\u01B0u tr\u1EEF c\u1EE7a file d\u1EEF li\u1EC7u ph\u1EB3ng users.json.",
        "\u0110\u1EC3 h\u1EC7 th\u1ED1ng Render t\u1EF1 \u0111\u1ED9ng ph\xE2n b\u1ED5 dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB RAM cache t\u1ED1i \u01B0u h\u01A1n.",
        "Gi\xFAp t\u0103ng t\u1ED1c \u0111\u1ED9 \u0111\u1ED3ng b\u1ED9 d\u1EEF li\u1EC7u t\u1EEB RAM l\xEAn Google Drive v\u0129nh vi\u1EC5n."
      ], 0),
      q("Trong file d\u1EEF li\u1EC7u c\u1EA5u tr\xFAc ph\u1EB3ng exams.json, th\xF4ng tin n\xE0o \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF b\xEAn trong m\u1ED7i c\xE2u h\u1ECFi c\u1EE7a \u0111\u1EC1 thi \u0111\u1EC3 ph\u1EE5c v\u1EE5 ch\u1EA5m \u0111i\u1EC3m?", [
        "Chu\u1ED7i n\u1ED9i dung \u0111\xE1p \xE1n \u0111\xFAng d\u1EA1ng v\u0103n b\u1EA3n thu\u1EA7n.",
        "S\u1ED1 c\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n c\u1EE7a ng\u01B0\u1EDDi ra \u0111\u1EC1 thi.",
        "T\u1ED5ng s\u1ED1 l\u01B0\u1EE3t th\xED sinh \u0111\xE3 tr\u1EA3 l\u1EDDi \u0111\xFAng c\xE2u h\u1ECFi \u0111\xF3.",
        "Ch\u1EC9 s\u1ED1 v\u1ECB tr\xED c\u1EE7a c\xE2u tr\u1EA3 l\u1EDDi ch\xEDnh x\xE1c trong m\u1EA3ng ph\u01B0\u01A1ng \xE1n ch\u1ECDn (tr\u01B0\u1EDDng correctIndex)."
      ], 3),
      q("Khi b\u1EA1n d\xE1n chu\u1ED7i c\u1EA5u h\xECnh JSON c\u1EE7a file kh\xF3a Service Account n\u1EB1m tr\xEAn m\u1ED9t d\xF2ng duy nh\u1EA5t v\xE0o bi\u1EBFn m\xF4i tr\u01B0\u1EDDng c\u1EE7a h\u1EC7 th\u1ED1ng, ph\u01B0\u01A1ng th\u1EE9c n\xE0y \u0111\u01B0\u1EE3c t\xE0i li\u1EC7u h\u01B0\u1EDBng d\u1EABn g\u1ECDi l\xE0 g\xEC?", [
        "Khai b\xE1o d\u1EA1ng Base64 khuy\xEAn d\xF9ng.",
        "Khai b\xE1o d\u1EA1ng \u0111\u01B0\u1EDDng d\u1EABn file key c\u1EE5c b\u1ED9.",
        "Khai b\xE1o th\xF4ng qua API Token trung gian.",
        "Khai b\xE1o d\u1EA1ng JSON th\xF4 1 d\xF2ng (Raw JSON)."
      ], 3),
      q('M\u1EE5c \u0111\xEDch ch\xEDnh c\u1EE7a vi\u1EC7c h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng ghi m\u1ED9t b\u1EA3n sao "mirror c\u1EE5c b\u1ED9" l\u01B0u xu\u1ED1ng th\u01B0 m\u1EE5c ./data/*.json tr\xEAn m\xE1y ch\u1EE7 song song v\u1EDBi vi\u1EC7c l\u01B0u l\xEAn Google Drive l\xE0 g\xEC?', [
        "\u0110\u1EC3 l\xE0m t\u0103ng g\u1EA5p \u0111\xF4i dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB l\u01B0u tr\u1EEF file d\u1EEF li\u1EC7u ph\u1EB3ng.",
        "Gi\xFAp h\u1EC7 th\u1ED1ng kh\u1EDFi \u0111\u1ED9ng nhanh h\u01A1n \u1EDF nh\u1EEFng l\u1EA7n sau v\xE0 l\xE0m ph\u01B0\u01A1ng \xE1n c\u1EE9u tr\u1EE3 d\u1EEF li\u1EC7u kh\u1EA9n c\u1EA5p n\u1EBFu d\u1ECBch v\u1EE5 Google Drive t\u1EA1m th\u1EDDi g\u1EB7p s\u1EF1 c\u1ED1 k\u1EBFt n\u1ED1i.",
        "Ch\u1ED1ng l\u1EA1i cu\u1ED9c t\u1EA5n c\xF4ng ch\xE8n c\xE2u l\u1EC7nh h\u1EC7 \u0111i\u1EC1u h\xE0nh Command Injection.",
        "T\u1EF1 \u0111\u1ED9ng \u0111\u1ED3ng b\u1ED9 t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng sang n\u1EC1n t\u1EA3ng c\u01A1 s\u1EDF d\u1EEF li\u1EC7u SQL."
      ], 1),
      q("\u0110\u1EC3 ki\u1EC3m tra xem h\u1EC7 th\u1ED1ng m\xE1y ch\u1EE7 web c\xF3 \u0111ang ho\u1EA1t \u0111\u1ED9ng t\u1ED1t hay kh\xF4ng, n\u1EC1n t\u1EA3ng Render s\u1EBD \u0111\u1ECBnh k\u1EF3 g\u1EEDi y\xEAu c\u1EA7u ki\u1EC3m tra (Health Check) t\u1EDBi \u0111\u01B0\u1EDDng d\u1EABn API n\xE0o \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh trong h\u1EC7 th\u1ED1ng?", [
        "/api/stats",
        "/api/health",
        "/api/admin/users",
        "/login.html"
      ], 1),
      q("Khi th\xED sinh b\u1EA5m n\xFAt B\u1EAFt \u0111\u1EA7u l\xE0m b\xE0i thi, h\u1EC7 th\u1ED1ng Backend Express s\u1EBD ghi nh\u1EADn v\xE0 c\u1EA5p cho th\xED sinh th\xF4ng tin quan tr\u1ECDng n\xE0o \u0111\u1EC3 gi\xE1m s\xE1t th\u1EDDi gian l\xE0m b\xE0i ch\u1ED1ng gian l\u1EADn?", [
        "T\u1EF1 \u0111\u1ED9ng t\u1EA3i to\xE0n b\u1ED9 file \u0111\xE1p \xE1n \u0111\xFAng v\u1EC1 cookies tr\xECnh duy\u1EC7t c\u1EE7a th\xED sinh.",
        "Chuy\u1EC3n \u0111\u1ED5i giao di\u1EC7n l\xE0m b\xE0i sang ch\u1EBF \u0111\u1ED9 m\xE3 h\xF3a file \u0111\u1ED1i x\u1EE9ng AES.",
        "C\u1EA5p v\xE0 l\u01B0u tr\u1EEF th\u1EDDi \u0111i\u1EC3m b\u1EAFt \u0111\u1EA7u l\xE0m b\xE0i ch\xEDnh x\xE1c \u1EDF ph\xEDa Server (tr\u01B0\u1EDDng startedAt), vi\u1EC7c refresh trang web s\u1EBD kh\xF4ng l\xE0m t\u0103ng th\xEAm th\u1EDDi gian.",
        "T\u1EF1 \u0111\u1ED9ng g\u1EEDi m\u1ED9t y\xEAu c\u1EA7u l\u01B0u file test l\xEAn th\u01B0 m\u1EE5c Google Drive."
      ], 2),
      q("Trong c\u1EA5u tr\xFAc t\u1EC7p tin d\u1EEF li\u1EC7u ph\u1EB3ng results.json, tr\u01B0\u1EDDng d\u1EEF li\u1EC7u durationSeconds d\xF9ng \u0111\u1EC3 l\u01B0u tr\u1EEF th\xF4ng tin g\xEC c\u1EE7a l\u01B0\u1EE3t thi?", [
        "T\u1ED5ng s\u1ED1 th\u1EDDi gian t\u1ED1i \u0111a \u0111\u01B0\u1EE3c ph\xE9p l\xE0m b\xE0i thi t\xEDnh b\u1EB1ng ph\xFAt.",
        "T\u1ED5ng s\u1ED1 th\u1EDDi gian th\u1EF1c t\u1EBF m\xE0 th\xED sinh \u0111\xE3 b\u1ECF ra \u0111\u1EC3 ho\xE0n th\xE0nh b\xE0i thi, t\xEDnh b\u1EB1ng \u0111\u01A1n v\u1ECB gi\xE2y.",
        "Th\u1EDDi \u0111i\u1EC3m ch\xEDnh x\xE1c th\xED sinh b\u1EA5m n\xFAt n\u1ED9p b\xE0i l\xEAn m\xE1y ch\u1EE7.",
        "M\xE3 s\u1ED1 \u0111\u1ECBnh danh duy nh\u1EA5t c\u1EE7a \u0111\u1EC1 thi tr\u1EAFc nghi\u1EC7m."
      ], 1),
      q("Khi mu\u1ED1n ch\u1EA1y \u1EE9ng d\u1EE5ng \u1EDF ch\u1EBF \u0111\u1ED9 ph\xE1t tri\u1EC3n (Development mode) d\u01B0\u1EDBi m\xE1y t\xEDnh c\xE1 nh\xE2n \u0111\u1EC3 t\u1EF1 \u0111\u1ED9ng kh\u1EDFi \u0111\u1ED9ng l\u1EA1i server m\u1ED7i khi l\u1EADp tr\xECnh vi\xEAn ch\u1EC9nh s\u1EEDa file m\xE3 ngu\u1ED3n, b\u1EA1n s\u1EED d\u1EE5ng l\u1EC7nh d\xF2ng l\u1EC7nh n\xE0o?", [
        "npm start",
        "node server.js",
        "npm run dev",
        "npm install"
      ], 2),
      q("Khi m\u1ED9t t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng th\xF4ng th\u01B0\u1EDDng c\u1ED1 t\xECnh truy c\u1EADp v\xE0o \u0111\u01B0\u1EDDng d\u1EABn API d\xE0nh ri\xEAng cho qu\u1EA3n tr\u1ECB vi\xEAn (v\xED d\u1EE5: l\u1EA5y danh s\xE1ch to\xE0n b\u1ED9 ng\u01B0\u1EDDi d\xF9ng h\u1EC7 th\u1ED1ng), middleware b\u1EA3o m\u1EADt requireAdmin s\u1EBD tr\u1EA3 v\u1EC1 m\xE3 l\u1ED7i HTTP n\xE0o \u0111\u1EC3 t\u1EEB ch\u1ED1i truy c\u1EADp?", [
        "200 OK",
        "403 Forbidden ho\u1EB7c th\xF4ng b\xE1o l\u1ED7i vi ph\u1EA1m quy\u1EC1n truy c\u1EADp.",
        "404 Not Found",
        "500 Internal Server Error"
      ], 1),
      q("C\u01A1 ch\u1EBF g\u1ED9p c\xE1c thay \u0111\u1ED5i d\u1ED3n d\u1EADp di\u1EC5n ra trong m\u1ED9t kho\u1EA3ng th\u1EDDi gian ng\u1EAFn th\xE0nh m\u1ED9t l\u1EA7n \u0111\u1ED3ng b\u1ED9 duy nh\u1EA5t l\xEAn Google Drive \u0111\u01B0\u1EE3c g\u1ECDi thu\u1EADt ng\u1EEF chuy\xEAn ng\xE0nh l\xE0 g\xEC?", [
        "Mutex Locking.",
        "Coalesce (G\u1ED9p c\xE1c thay \u0111\u1ED5i d\u1ED3n d\u1EADp n\u1EC1n).",
        "Parameterized Queries.",
        "Constant-time Comparison."
      ], 1),
      // ---- MỤC C: VẬN DỤNG CAO — PHÂN TÍCH LỖ HỔNG WEBSITE & NATAS (Câu 41–50) ----
      q("Trong m\xE3 ngu\u1ED3n h\u1EC7 th\u1ED1ng, \u0111\u1EC3 so s\xE1nh chu\u1ED7i b\u0103m m\u1EADt kh\u1EA9u ho\u1EB7c x\xE1c th\u1EF1c token phi\xEAn l\xE0m vi\u1EC7c m\u1ED9t c\xE1ch an to\xE0n nh\u1EA5t, tr\xE1nh l\u1ED7 h\u1ED5ng t\u1EA5n c\xF4ng ph\xE2n t\xEDch th\u1EDDi gian ph\u1EA3n h\u1ED3i c\u1EE7a CPU (Timing Attack), l\u1EADp tr\xECnh vi\xEAn b\u1EAFt bu\u1ED9c ph\u1EA3i s\u1EED d\u1EE5ng c\u01A1 ch\u1EBF so s\xE1nh n\xE0o?", [
        "So s\xE1nh b\u1EB1ng to\xE1n t\u1EED th\xF4ng th\u01B0\u1EDDng == ho\u1EB7c ===.",
        "Chuy\u1EC3n \u0111\u1ED5i to\xE0n b\u1ED9 hai chu\u1ED7i d\u1EEF li\u1EC7u sang \u0111\u1ECBnh d\u1EA1ng Base64 tr\u01B0\u1EDBc khi so s\xE1nh.",
        "G\u1EEDi c\u1EA3 hai chu\u1ED7i d\u1EEF li\u1EC7u l\xEAn Google Drive \u0111\u1EC3 nh\u1EDD robot so s\xE1nh h\u1ED9.",
        "So s\xE1nh th\u1EDDi gian c\u1ED1 \u0111\u1ECBnh (Constant-time comparison) b\u1EB1ng h\xE0m chuy\xEAn d\u1EE5ng c\u1EE7a th\u01B0 vi\u1EC7n crypto."
      ], 3),
      q("Khi ch\u1EA1y script ki\u1EC3m tra k\u1EBFt n\u1ED1i t\u1EF1 \u0111\u1ED9ng t\u1EDBi Google Drive, h\u1EC7 th\u1ED1ng b\xE1o l\u1ED7i \u1EDF m\u1EE9c 4/5 k\xE8m d\xF2ng tr\u1EA1ng th\xE1i 403 The caller does not have permission. L\u1ED7i n\xE0y x\xE1c \u0111\u1ECBnh nguy\xEAn nh\xE2n ch\xEDnh x\xE1c do c\u1EA5u h\xECnh thi\u1EBFu b\u01B0\u1EDBc n\xE0o sau \u0111\xE2y?", [
        "Nh\u1EADp sai chu\u1ED7i m\xE3 s\u1ED1 ID th\u01B0 m\u1EE5c Google Drive c\u1EE7a b\u1EA1n.",
        "B\u1EA1n \u0111\xE3 chia s\u1EBB th\u01B0 m\u1EE5c Drive cho email c\u1EE7a robot r\u1ED3i, nh\u01B0ng l\u1EA1i thi\u1EBFt l\u1EADp nh\u1EA7m quy\u1EC1n l\xE0 Viewer (Ng\u01B0\u1EDDi xem) thay v\xEC Editor (Ng\u01B0\u1EDDi ch\u1EC9nh s\u1EEDa).",
        "Ch\u01B0a b\u1EADt t\xEDnh n\u0103ng x\xE1c th\u1EF1c 2 l\u1EDBp cho t\xE0i kho\u1EA3n Gmail c\xE1 nh\xE2n.",
        "Th\u01B0 m\u1EE5c l\u01B0u tr\u1EEF tr\xEAn Google Drive \u0111\xE3 b\u1ECB \u0111\u1EA7y dung l\u01B0\u1EE3ng 750 GB."
      ], 1),
      q("K\u1EBB t\u1EA5n c\xF4ng th\u1EF1c hi\u1EC7n h\xE0nh vi g\u1EEDi y\xEAu c\u1EA7u truy c\u1EADp li\xEAn t\u1EE5c v\u1EDBi tham s\u1ED1 \u0111\u01B0\u1EDDng d\u1EABn ch\u1EE9a chu\u1ED7i k\xFD t\u1EF1 ki\u1EC3m th\u1EED nguy hi\u1EC3m: https://liveblog365.com | grep -oP .... Logic x\u1EED l\xFD \u1EDF Backend g\u1ECDi tr\u1EF1c ti\u1EBFp h\xE0m x\u1EED l\xFD chu\u1ED7i h\u1EC7 th\u1ED1ng m\xE0 kh\xF4ng c\xF4 l\u1EADp tham s\u1ED1 \u0111\u1EA7u v\xE0o. \u0110\xE2y l\xE0 bi\u1EC3u hi\u1EC7n c\u1EE7a l\u1ED7 h\u1ED5ng b\u1EA3o m\u1EADt n\xE0o?", [
        "Path Traversal.",
        "SQL Injection tr\xE1i ph\xE9p.",
        "Session Hijacking.",
        "Command Injection (Ch\xE8n m\xE3 l\u1EC7nh h\u1EC7 \u0111i\u1EC1u h\xE0nh qua c\xE1c h\xE0m x\u1EED l\xFD n\u1EC1n)."
      ], 3),
      q("Khi m\u1EDF file key JSON t\u1EA3i v\u1EC1 t\u1EEB Google Cloud Console b\u1EB1ng c\xF4ng c\u1EE5 Notepad, b\u1EA1n c\u1EA7n t\xECm v\xE0 sao ch\xE9p ch\xEDnh x\xE1c gi\xE1 tr\u1ECB n\u1EB1m \u1EDF tr\u01B0\u1EDDng d\u1EEF li\u1EC7u n\xE0o \u0111\u1EC3 l\u1EA5y \u0111\u01B0\u1EE3c \u0111\u1ECBa ch\u1EC9 email \u0111\u1ECBnh danh c\u1EE7a robot c\u1EA5p quy\u1EC1n chia s\u1EBB?", [
        "private_key",
        "project_id",
        "auth_uri",
        "client_email"
      ], 3),
      q("\u0110\u1EC3 ph\xF2ng ch\u1ED1ng tri\u1EC7t \u0111\u1EC3 l\u1ED7 h\u1ED5ng b\u1EA3o m\u1EADt nguy hi\u1EC3m SQL Injection, k\u1EF9 thu\u1EADt l\u1EADp tr\xECnh n\xE0o sau \u0111\xE2y l\xE0 ti\xEAu chu\u1EA9n b\u1EAFt bu\u1ED9c ph\u1EA3i \xE1p d\u1EE5ng \u0111\u1ED1i v\u1EDBi m\u1ECDi \xF4 nh\u1EADp li\u1EC7u d\u1EEF li\u1EC7u c\u1EE7a ng\u01B0\u1EDDi d\xF9ng?", [
        "Ch\u1EC9 m\xE3 h\xF3a chu\u1ED7i nh\u1EADp v\xE0o b\u1EB1ng thu\u1EADt to\xE1n Base64 Encoding \u1EDF Frontend.",
        "S\u1EED d\u1EE5ng v\xF2ng l\u1EB7p ki\u1EC3m tra v\xE0 t\u1EF1 \u0111\u1ED9ng x\xF3a b\u1ECF to\xE0n b\u1ED9 d\u1EA5u kho\u1EA3ng tr\u1EAFng c\u1EE7a chu\u1ED7i.",
        "S\u1EED d\u1EE5ng truy v\u1EA5n c\xF3 tham s\u1ED1 t\xE1ch bi\u1EC7t (Parameterized Queries) / c\xE2u l\u1EC7nh chu\u1EA9n b\u1ECB tr\u01B0\u1EDBc (Prepared Statements).",
        "C\u1EA5u h\xECnh h\u1EC7 th\u1ED1ng t\u01B0\u1EDDng l\u1EEDa m\u1EA1ng \u0111\u1EC3 ch\u1EB7n ho\xE0n to\xE0n \u0111\u1ECBa ch\u1EC9 IP c\u1EE7a th\xED sinh."
      ], 2),
      q("Khi k\u1EBB t\u1EA5n c\xF4ng t\xECm c\xE1ch thay \u0111\u1ED5i tham s\u1ED1 \u0111\u01B0\u1EDDng link th\xE0nh ?page=../../../../config.php \u0111\u1EC3 l\u1EA5y c\u1EAFp kh\xF3a b\xED m\u1EADt h\u1EC7 th\u1ED1ng. \u0110\u1EC3 ph\xF2ng ng\u1EF1 l\u1ED7i Path Traversal n\xE0y, h\xE0m ki\u1EC3m tra \u0111\u1EA7u v\xE0o \u1EDF Backend c\u1EA7n th\u1EF1c hi\u1EC7n h\xE0nh vi l\u1ECDc b\u1ECF (Sanitize) c\xE1c k\xFD t\u1EF1 nguy hi\u1EC3m n\xE0o?", [
        "Ch\u1EB7n c\xE1c chu\u1ED7i k\xFD t\u1EF1 d\u1EA1ng d\u1EA5u ngo\u1EB7c nh\u1ECDn <script>.",
        "X\xF3a b\u1ECF c\xE1c k\xFD t\u1EF1 d\u1EA5u nh\xE1y \u0111\u01A1n ' v\xE0 d\u1EA5u b\u0103m #.",
        "\xC9p ki\u1EC3u d\u1EEF li\u1EC7u \u0111\u1EA7u v\xE0o c\u1EE7a ng\u01B0\u1EDDi d\xF9ng b\u1EAFt bu\u1ED9c ph\u1EA3i l\xE0 d\u1EA1ng s\u1ED1 nguy\xEAn.",
        "L\u1ECDc s\u1EA1ch v\xE0 ch\u1EB7n c\xE1c chu\u1ED7i d\u1EA5u ch\u1EA5m v\xE0 d\u1EA5u g\u1EA1ch ch\xE9o nguy hi\u1EC3m nh\u01B0 ../ ho\u1EB7c ..\\ d\xF9ng \u0111\u1EC3 nh\u1EA3y th\u01B0 m\u1EE5c."
      ], 3),
      q("M\u1ED9t chu\u1ED7i k\xFD t\u1EF1 m\xE3 h\xF3a Base64 d\xF9ng l\xE0m bi\u1EBFn m\xF4i tr\u01B0\u1EDDng khi d\xE1n v\xE0o trang qu\u1EA3n tr\u1ECB Render b\u1ECB h\u1EC7 th\u1ED1ng b\xE1o l\u1ED7i kh\xF4ng th\u1EC3 kh\u1EDFi ch\u1EA1y, ki\u1EC3m tra log th\u1EA5y d\xF2ng tr\u1EA1ng th\xE1i b\xE1o l\u1ED7i li\xEAn quan \u0111\u1EBFn k\xFD t\u1EF1 \u0111\u1EA7u v\xE0o Unexpected token. Nguy\xEAn nh\xE2n ph\u1ED5 bi\u1EBFn nh\u1EA5t g\xE2y ra l\u1ED7i n\xE0y \u1EDF b\u01B0\u1EDBc x\u1EED l\xFD file key b\u1EB1ng PowerShell l\xE0 g\xEC?", [
        "\u0110\u01B0\u1EDDng d\u1EABn file .json tr\xEAn m\xE1y t\xEDnh c\xE1 nh\xE2n vi\u1EBFt sai ch\xEDnh t\u1EA3.",
        "T\xE0i kho\u1EA3n d\u1ECBch v\u1EE5 Service Account c\u1EE7a b\u1EA1n ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n truy c\u1EADp project.",
        "M\xE3 s\u1ED1 ID th\u01B0 m\u1EE5c l\u01B0u tr\u1EEF Google Drive ch\u1EE9a k\xFD t\u1EF1 kho\u1EA3ng tr\u1EAFng \u1EDF cu\u1ED1i.",
        "Qu\xE1 tr\xECnh sao ch\xE9p chu\u1ED7i Base64 b\u1EB1ng tay b\u1ECB thi\u1EBFu k\xFD t\u1EF1, b\u1ECB \u0111\u1EE9t d\xF2ng ho\u1EB7c s\u1EED d\u1EE5ng nh\u1EA7m l\u1EC7nh ch\xE8n th\xEAm c\xE1c chu\u1ED7i ti\xEAu \u0111\u1EC1 certificate th\u1EEBa."
      ], 3),
      q("T\u1EA1i sao vi\u1EC7c s\u1EED d\u1EE5ng thu\u1EADt to\xE1n b\u0103m MD5 ho\u1EB7c SHA-1 th\xF4 \u0111\u1EC3 l\u01B0u tr\u1EEF m\u1EADt kh\u1EA9u ng\u01B0\u1EDDi d\xF9ng v\xE0o file d\u1EEF li\u1EC7u ph\u1EB3ng ng\xE0y nay \u0111\u01B0\u1EE3c coi l\xE0 kh\xF4ng c\xF2n an to\xE0n tr\u01B0\u1EDBc hacker?", [
        "V\xEC dung l\u01B0\u1EE3ng chu\u1ED7i b\u0103m c\u1EE7a MD5 qu\xE1 l\u1EDBn l\xE0m t\u1ED1n b\u1ED9 nh\u1EDB RAM m\xE1y ch\u1EE7.",
        "V\xEC MD5 kh\xF4ng h\u1ED7 tr\u1EE3 k\u1EBFt h\u1EE3p l\u01B0u tr\u1EEF c\xF9ng s\u1ED1 C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n.",
        "V\xEC c\xE1c thu\u1EADt to\xE1n n\xE0y c\xF3 t\u1ED1c \u0111\u1ED9 x\u1EED l\xFD qu\xE1 nhanh, hacker c\xF3 th\u1EC3 s\u1EED d\u1EE5ng c\xE1c si\xEAu m\xE1y t\xEDnh ho\u1EB7c b\u1EA3ng tra c\u1EE9u tr\u01B0\u1EDBc (Rainbow Tables) \u0111\u1EC3 gi\u1EA3i m\xE3 v\xE9t c\u1EA1n h\xE0ng t\u1EF7 m\u1EADt kh\u1EA9u trong m\u1ED9t gi\xE2y.",
        "Do thu\u1EADt to\xE1n MD5 t\u1EF1 \u0111\u1ED9ng l\xE0m s\u1EADp k\u1EBFt n\u1ED1i c\u1EE7a d\u1ECBch v\u1EE5 Google Drive API."
      ], 2),
      q("Trong c\u1EA5u tr\xFAc file d\u1EEF li\u1EC7u ph\u1EB3ng qu\u1EA3n l\xFD k\u1EBFt qu\u1EA3 thi results.json, n\u1EBFu m\u1ED9t b\u1EA3n ghi \u0111i\u1EC3m s\u1ED1 c\u1EE7a th\xED sinh c\xF3 xu\u1EA5t hi\u1EC7n th\xEAm hai tr\u01B0\u1EDDng d\u1EEF li\u1EC7u l\xE0 editedAt v\xE0 editedBy, \u0111i\u1EC1u n\xE0y th\u1EC3 hi\u1EC7n h\xE0nh vi g\xEC \u0111\xE3 di\u1EC5n ra trong h\u1EC7 th\u1ED1ng?", [
        "T\xE0i kho\u1EA3n qu\u1EA3n tr\u1ECB vi\xEAn (Admin) \u0111\xE3 can thi\u1EC7p ch\u1EC9nh s\u1EEDa k\u1EBFt qu\u1EA3 b\xE0i thi n\xE0y v\xE0o m\u1ED9t th\u1EDDi \u0111i\u1EC3m c\u1EE5 th\u1EC3 sau khi n\u1ED9p b\xE0i.",
        "Th\xED sinh t\u1EF1 \u0111\u1ED9ng th\u1EF1c hi\u1EC7n h\xE0nh vi hack s\u1EEDa \u0111i\u1EC3m s\u1ED1 b\xE0i l\xE0m c\u1EE7a m\xECnh tr\xEAn tr\xECnh duy\u1EC7t.",
        "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng k\xEDch ho\u1EA1t t\xEDnh n\u0103ng l\u01B0u mirror c\u1EE5c b\u1ED9 khi m\u1EA5t m\u1EA1ng m\u1EA1ng LAN.",
        "Token phi\xEAn l\xE0m vi\u1EC7c c\u1EE7a th\xED sinh \u0111\xE3 h\u1EBFt h\u1EA1n hi\u1EC7u l\u1EF1c 12 gi\u1EDD quy \u0111\u1ECBnh."
      ], 0),
      q("Khi c\u1EA5u h\xECnh t\u1EC7p tin c\u1EA5u h\xECnh m\xF4i tr\u01B0\u1EDDng h\u1EC7 th\u1ED1ng cho \u1EE9ng d\u1EE5ng web, l\u1ED7i 404 File not found: <id> tr\u1EA3 v\u1EC1 t\u1EEB log server x\xE1c \u0111\u1ECBnh h\u1EC7 th\u1ED1ng c\u1EE7a b\u1EA1n \u0111ang \u0111i\u1EC1n sai th\xF4ng tin c\u1EE7a bi\u1EBFn m\xF4i tr\u01B0\u1EDDng n\xE0o?", [
        "SESSION_SECRET",
        "GOOGLE_DRIVE_FOLDER_ID (Do copy th\u1EEBa c\u1EA3 \u0111\u01B0\u1EDDng link URL, th\u1EEBa kho\u1EA3ng tr\u1EAFng ho\u1EB7c d\xF9ng ID c\u1EE7a th\u01B0 m\u1EE5c \u0111\xE3 b\u1ECB x\xF3a ho\xE0n to\xE0n).",
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        "ADMIN_CCCDS"
      ], 1)
    ];
    var SET3_QUESTIONS = [
      // ---- MỤC A: NHẬN BIẾT — CHUYỂN ĐỔI SỐ CƠ BẢN (Câu 1–17) ----
      q('Kh\xE1i ni\u1EC7m "Chuy\u1EC3n \u0111\u1ED5i s\u1ED1" (Digital Transformation) \u0111\u01B0\u1EE3c hi\u1EC3u \u0111\u1EA7y \u0111\u1EE7 v\xE0 ch\xEDnh x\xE1c nh\u1EA5t l\xE0 g\xEC?', [
        "L\xE0 vi\u1EC7c mua s\u1EAFm th\xEAm nhi\u1EC1u m\xE1y t\xEDnh v\xE0 thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng hi\u1EC7n \u0111\u1EA1i cho c\u01A1 quan.",
        "L\xE0 vi\u1EC7c s\u1ED1 h\xF3a v\u0103n b\u1EA3n gi\u1EA5y t\u1EDD sang file d\u1EA1ng PDF \u0111\u1EC3 l\u01B0u tr\u1EEF n\u1ED9i b\u1ED9.",
        "L\xE0 vi\u1EC7c c\xE0i \u0111\u1EB7t c\xE1c ph\u1EA7n m\u1EC1m di\u1EC7t virus b\u1EA3n quy\u1EC1n tr\xEAn m\xE1y t\xEDnh c\xE1 nh\xE2n.",
        "L\xE0 qu\xE1 tr\xECnh thay \u0111\u1ED5i t\u1ED5ng th\u1EC3 v\xE0 to\xE0n di\u1EC7n c\u1EE7a c\xE1 nh\xE2n, t\u1ED5 ch\u1EE9c v\u1EC1 c\xE1ch s\u1ED1ng, c\xE1ch l\xE0m vi\u1EC7c v\xE0 ph\u01B0\u01A1ng th\u1EE9c s\u1EA3n xu\u1EA5t d\u1EF1a tr\xEAn c\xE1c c\xF4ng ngh\u1EC7 s\u1ED1."
      ], 3),
      q('Trong c\xE1c th\xE0nh ph\u1EA7n sau \u0111\xE2y, \u0111\xE2u l\xE0 "trung t\xE2m", l\xE0 m\u1EE5c ti\xEAu ph\u1EE5c v\u1EE5 c\u1ED1t l\xF5i c\u1EE7a ti\u1EBFn tr\xECnh x\xE2y d\u1EF1ng Ch\xEDnh quy\u1EC1n s\u1ED1 v\xE0 Chuy\u1EC3n \u0111\u1ED5i s\u1ED1 qu\u1ED1c gia?', [
        "C\xE1c doanh nghi\u1EC7p cung c\u1EA5p gi\u1EA3i ph\xE1p h\u1EA1 t\u1EA7ng ph\u1EA7n c\u1EE9ng m\u1EA1ng.",
        "C\xE1c h\u1EC7 th\u1ED1ng m\xE1y ch\u1EE7 l\u01B0u tr\u1EEF d\u1EEF li\u1EC7u t\u1EADp trung.",
        "Ng\u01B0\u1EDDi d\xE2n v\xE0 doanh nghi\u1EC7p.",
        "\u0110\u1ED9i ng\u0169 chuy\xEAn gia l\u1EADp tr\xECnh v\xE0 qu\u1EA3n tr\u1ECB h\u1EC7 th\u1ED1ng."
      ], 2),
      q('H\xE0nh \u0111\u1ED9ng n\xE0o sau \u0111\xE2y \u0111\u01B0\u1EE3c ph\xE2n lo\u1EA1i v\xE0o b\u01B0\u1EDBc "S\u1ED1 h\xF3a th\xF4ng tin" (Digitization) \u2013 m\u1EE9c \u0111\u1ED9 c\u01A1 b\u1EA3n nh\u1EA5t c\u1EE7a chuy\u1EC3n \u0111\u1ED5i s\u1ED1?', [
        "D\xF9ng m\xE1y qu\xE9t (Scanner) ho\u1EB7c \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh \u0111\u1EC3 ch\u1EE5p, qu\xE9t m\u1ED9t v\u0103n b\u1EA3n gi\u1EA5y r\u1ED3i l\u01B0u th\xE0nh t\u1EC7p tin tr\xEAn m\xE1y t\xEDnh.",
        "S\u1EED d\u1EE5ng tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (AI) \u0111\u1EC3 ph\xE2n t\xEDch t\u1EF1 \u0111\u1ED9ng xu h\u01B0\u1EDBng d\u1EEF li\u1EC7u.",
        "Thay \u0111\u1ED5i ho\xE0n to\xE0n quy tr\xECnh ti\u1EBFp nh\u1EADn h\u1ED3 s\u01A1 t\u1EEB tr\u1EF1c ti\u1EBFp sang 100% m\xF4i tr\u01B0\u1EDDng m\u1EA1ng.",
        "X\xE2y d\u1EF1ng kho d\u1EEF li\u1EC7u d\xF9ng chung k\u1EBFt n\u1ED1i th\xF4ng su\u1ED1t gi\u1EEFa c\xE1c b\u1ED9 ban ng\xE0nh."
      ], 0),
      q("N\u1EC1n t\u1EA3ng \u1EE9ng d\u1EE5ng n\xE0o sau \u0111\xE2y \u0111\xF3ng vai tr\xF2 l\xE0 \u0110\u1ECBnh danh \u0111i\u1EC7n t\u1EED qu\u1ED1c gia c\u1EE7a Vi\u1EC7t Nam, gi\xFAp ng\u01B0\u1EDDi d\xE2n th\u1EF1c hi\u1EC7n c\xE1c th\u1EE7 t\u1EE5c h\xE0nh ch\xEDnh kh\xF4ng c\u1EA7n mang theo gi\u1EA5y t\u1EDD v\u1EADt l\xFD?", [
        "Zalo.",
        "VNeID.",
        "VssID.",
        "PC-Covid."
      ], 1),
      q("M\xF4 h\xECnh \u0111i\u1EC7n to\xE1n n\xE0o cho ph\xE9p ng\u01B0\u1EDDi d\xF9ng truy c\u1EADp, s\u1EED d\u1EE5ng t\xE0i nguy\xEAn ph\u1EA7n m\u1EC1m, l\u01B0u tr\u1EEF d\u1EEF li\u1EC7u m\u1ECDi l\xFAc m\u1ECDi n\u01A1i th\xF4ng qua k\u1EBFt n\u1ED1i Internet m\xE0 kh\xF4ng c\u1EA7n t\u1EF1 duy tr\xEC m\xE1y ch\u1EE7 v\u1EADt l\xFD?", [
        "\u0110i\u1EC7n to\xE1n c\u1EE5c b\u1ED9 (Local Computing).",
        "M\u1EA1ng l\u01B0u tr\u1EEF g\u1EAFn k\xE8m c\u1EE5c b\u1ED9 (NAS).",
        "\u0110i\u1EC7n to\xE1n \u0111\xE1m m\xE2y (Cloud Computing).",
        "H\u1EC7 th\u1ED1ng l\u01B0u tr\u1EEF d\u1EEF li\u1EC7u ph\u1EB3ng JSON."
      ], 2),
      q('Trong xu th\u1EBF ph\xE1t tri\u1EC3n c\xF4ng ngh\u1EC7 hi\u1EC7n nay, thu\u1EADt ng\u1EEF "D\u1EEF li\u1EC7u l\u1EDBn" (Big Data) d\xF9ng \u0111\u1EC3 ch\u1EC9 nh\u1EEFng t\u1EADp h\u1EE3p d\u1EEF li\u1EC7u c\xF3 \u0111\u1EB7c tr\u01B0ng n\u1ED5i b\u1EADt n\xE0o?', [
        "D\u1EEF li\u1EC7u c\xF3 kh\u1ED1i l\u01B0\u1EE3ng c\u1EF1c l\u1EDBn, t\u1ED1c \u0111\u1ED9 sinh tr\u01B0\u1EDFng nhanh v\xE0 ch\u1EE7ng lo\u1EA1i r\u1EA5t \u0111a d\u1EA1ng, v\u01B0\u1EE3t qu\xE1 kh\u1EA3 n\u0103ng x\u1EED l\xFD c\u1EE7a c\xE1c c\xF4ng c\u1EE5 truy\u1EC1n th\u1ED1ng.",
        "D\u1EEF li\u1EC7u c\xF3 dung l\u01B0\u1EE3ng r\u1EA5t nh\u1ECF v\xE0 d\u1EC5 d\xE0ng x\u1EED l\xFD b\u1EB1ng ph\u1EA7n m\u1EC1m v\u0103n ph\xF2ng Excel.",
        "D\u1EEF li\u1EC7u ch\u1EC9 bao g\u1ED3m c\xE1c file v\u0103n b\u1EA3n thu\u1EA7n kh\xF4ng c\xF3 h\xECnh \u1EA3nh hay video.",
        "D\u1EEF li\u1EC7u \u0111\u01B0\u1EE3c kh\xF3a b\u1EA3o m\u1EADt tuy\u1EC7t \u0111\u1ED1i b\u1EB1ng thu\u1EADt to\xE1n m\xE3 h\xF3a \u0111\u1ED1i x\u1EE9ng AES."
      ], 0),
      q('M\u1EE5c ti\xEAu c\u01A1 b\u1EA3n c\u1EE7a vi\u1EC7c tri\u1EC3n khai "C\u1ED5ng d\u1ECBch v\u1EE5 c\xF4ng tr\u1EF1c tuy\u1EBFn" t\u1EA1i c\xE1c c\u01A1 quan nh\xE0 n\u01B0\u1EDBc l\xE0 g\xEC?', [
        "\u0110\u1EC3 b\xE1n c\xE1c s\u1EA3n ph\u1EA9m ph\u1EA7n m\u1EC1m c\xF4ng ngh\u1EC7 cho ng\u01B0\u1EDDi d\xE2n ki\u1EBFm l\u1EE3i nhu\u1EADn.",
        "Thay th\u1EBF ho\xE0n to\xE0n vai tr\xF2 qu\u1EA3n l\xFD \u0111i\u1EC1u h\xE0nh c\u1EE7a c\xE1c c\xE1n b\u1ED9 c\xF4ng ch\u1EE9c.",
        "T\u1EF1 \u0111\u1ED9ng x\xF3a b\u1ECF to\xE0n b\u1ED9 d\u1EEF li\u1EC7u l\u1ECBch s\u1EED n\u1ED9p h\u1ED3 s\u01A1 c\u0169 c\u1EE7a c\xF4ng d\xE2n.",
        "Gi\xFAp ng\u01B0\u1EDDi d\xE2n, doanh nghi\u1EC7p c\xF3 th\u1EC3 n\u1ED9p h\u1ED3 s\u01A1, th\u1EE7 t\u1EE5c h\xE0nh ch\xEDnh t\u1EEB xa qua Internet, t\u0103ng t\xEDnh minh b\u1EA1ch v\xE0 ti\u1EBFt ki\u1EC7m chi ph\xED, th\u1EDDi gian."
      ], 3),
      q("Khi n\xF3i v\u1EC1 chuy\u1EC3n \u0111\u1ED5i s\u1ED1, y\u1EBFu t\u1ED1 n\xE0o sau \u0111\xE2y \u0111\xF3ng vai tr\xF2 quy\u1EBFt \u0111\u1ECBnh s\u1EF1 th\xE0nh b\u1EA1i cao nh\u1EA5t c\u1EE7a m\u1ED9t t\u1ED5 ch\u1EE9c?", [
        "Nh\u1EADn th\u1EE9c, t\u01B0 duy v\xE0 s\u1EF1 quy\u1EBFt t\xE2m thay \u0111\u1ED5i c\u1EE7a con ng\u01B0\u1EDDi, \u0111\u1EB7c bi\u1EC7t l\xE0 ng\u01B0\u1EDDi \u0111\u1EE9ng \u0111\u1EA7u.",
        "Ng\xE2n s\xE1ch kinh ph\xED mua s\u1EAFm thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng c\xF4ng ngh\u1EC7.",
        "T\u1ED1c \u0111\u1ED9 \u0111\u01B0\u1EDDng truy\u1EC1n b\u0103ng th\xF4ng Internet c\u1EE7a nh\xE0 m\u1EA1ng.",
        "S\u1ED1 l\u01B0\u1EE3ng ph\u1EA7n m\u1EC1m m\xE3 ngu\u1ED3n m\u1EDF \u0111\u01B0\u1EE3c c\xE0i \u0111\u1EB7t v\xE0o h\u1EC7 th\u1ED1ng."
      ], 0),
      q('Kh\xE1i ni\u1EC7m "Kinh t\u1EBF s\u1ED1" \u0111\u01B0\u1EE3c hi\u1EC3u l\xE0 c\xE1c ho\u1EA1t \u0111\u1ED9ng kinh t\u1EBF d\u1EF1a tr\xEAn n\u1EC1n t\u1EA3ng n\xE0o sau \u0111\xE2y?', [
        "Ho\u1EA1t \u0111\u1ED9ng s\u1EA3n xu\u1EA5t n\xF4ng nghi\u1EC7p truy\u1EC1n th\u1ED1ng t\u1EA1i n\xF4ng th\xF4n.",
        "C\xF4ng ngh\u1EC7 s\u1ED1 v\xE0 n\u1EC1n t\u1EA3ng d\u1EEF li\u1EC7u s\u1ED1.",
        "Vi\u1EC7c giao d\u1ECBch mua b\xE1n h\xE0ng h\xF3a b\u1EB1ng ti\u1EC1n m\u1EB7t tr\u1EF1c ti\u1EBFp t\u1EA1i c\xE1c ch\u1EE3.",
        "C\xE1c ng\xE0nh c\xF4ng nghi\u1EC7p khai th\xE1c t\xE0i nguy\xEAn thi\xEAn nhi\xEAn th\xF4."
      ], 1),
      q('H\xE0nh vi n\xE0o sau \u0111\xE2y c\u1EE7a c\xF4ng d\xE2n g\xF3p ph\u1EA7n t\xEDch c\u1EF1c v\xE0o m\u1EE5c ti\xEAu x\xE2y d\u1EF1ng "X\xE3 h\u1ED9i s\u1ED1"?', [
        "T\xEDch c\u1EF1c h\u1ECDc h\u1ECFi k\u1EF9 n\u0103ng s\u1ED1, s\u1EED d\u1EE5ng thanh to\xE1n kh\xF4ng ti\u1EC1n m\u1EB7t v\xE0 th\u1EF1c hi\u1EC7n d\u1ECBch v\u1EE5 c\xF4ng tr\u1EF1c tuy\u1EBFn.",
        "T\u1EEB ch\u1ED1i ti\u1EBFp c\u1EADn c\xE1c thi\u1EBFt b\u1ECB c\xF4ng ngh\u1EC7 v\xE0 \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh.",
        "Ch\u1EC9 chia s\u1EBB c\xE1c th\xF4ng tin gi\u1EA3i tr\xED ch\u01B0a \u0111\u01B0\u1EE3c ki\u1EC3m ch\u1EE9ng l\xEAn m\u1EA1ng x\xE3 h\u1ED9i.",
        "S\u1EED d\u1EE5ng chung m\u1ED9t m\u1EADt kh\u1EA9u \u0111\u01A1n gi\u1EA3n cho t\u1EA5t c\u1EA3 c\xE1c t\xE0i kho\u1EA3n c\xE1 nh\xE2n."
      ], 0),
      q('"Ch\xEDnh ph\u1EE7 s\u1ED1" kh\xE1c v\u1EDBi "Ch\xEDnh ph\u1EE7 \u0111i\u1EC7n t\u1EED" \u1EDF \u0111i\u1EC3m c\u1ED1t l\xF5i n\xE0o sau \u0111\xE2y?', [
        "Ch\xEDnh ph\u1EE7 s\u1ED1 kh\xF4ng s\u1EED d\u1EE5ng m\u1EA1ng Internet \u0111\u1EC3 k\u1EBFt n\u1ED1i c\xE1c c\u01A1 quan.",
        "Ch\xEDnh ph\u1EE7 \u0111i\u1EC7n t\u1EED ch\u1EC9 d\xF9ng m\xE1y t\xEDnh ch\u1EA1y h\u1EC7 \u0111i\u1EC1u h\xE0nh Windows c\u0169.",
        "Ch\xEDnh ph\u1EE7 \u0111i\u1EC7n t\u1EED t\u1EADp trung v\xE0o s\u1ED1 h\xF3a quy tr\xECnh c\u0169; Ch\xEDnh ph\u1EE7 s\u1ED1 t\u1EADp trung v\xE0o thay \u0111\u1ED5i m\xF4 h\xECnh ho\u1EA1t \u0111\u1ED9ng d\u1EF1a tr\xEAn d\u1EEF li\u1EC7u v\xE0 c\xF4ng ngh\u1EC7 s\u1ED1 \u0111\u1EC3 t\u1EA1o ra d\u1ECBch v\u1EE5 m\u1EDBi.",
        "Ch\xEDnh ph\u1EE7 s\u1ED1 b\u1EAFt bu\u1ED9c ng\u01B0\u1EDDi d\xE2n ph\u1EA3i bi\u1EBFt l\u1EADp tr\xECnh m\xE3 ngu\u1ED3n Backend."
      ], 2),
      q('Trong c\xF4ng cu\u1ED9c chuy\u1EC3n \u0111\u1ED5i s\u1ED1, "H\u1EA1 t\u1EA7ng s\u1ED1" qu\u1ED1c gia bao g\u1ED3m c\xE1c th\xE0nh ph\u1EA7n c\u1ED1t l\xF5i n\xE0o?', [
        "H\u1EA1 t\u1EA7ng vi\u1EC5n th\xF4ng b\u0103ng r\u1ED9ng, h\u1EA1 t\u1EA7ng \u0111i\u1EC7n to\xE1n \u0111\xE1m m\xE2y v\xE0 c\xE1c n\u1EC1n t\u1EA3ng d\u1EEF li\u1EC7u, danh t\xEDnh s\u1ED1.",
        "H\u1EC7 th\u1ED1ng \u0111\u01B0\u1EDDng giao th\xF4ng v\xE0 c\xE1c t\xF2a nh\xE0 tr\u1EE5 s\u1EDF l\xE0m vi\u1EC7c.",
        "H\u1EC7 th\u1ED1ng l\u01B0\u1EDBi \u0111i\u1EC7n qu\u1ED1c gia v\xE0 c\xE1c nh\xE0 m\xE1y th\u1EE7y \u0111i\u1EC7n.",
        "M\u1EA1ng l\u01B0\u1EDBi c\xE1c c\u1EEDa h\xE0ng kinh doanh thi\u1EBFt b\u1ECB \u0111i\u1EC7n t\u1EED b\xE1n l\u1EBB."
      ], 0),
      q("C\xF4ng ngh\u1EC7 n\xE0o cho ph\xE9p m\xE1y t\xEDnh t\u1EF1 h\u1ECDc h\u1ECFi t\u1EEB d\u1EEF li\u1EC7u qu\xE1 kh\u1EE9 \u0111\u1EC3 \u0111\u01B0a ra c\xE1c d\u1EF1 b\xE1o, quy\u1EBFt \u0111\u1ECBnh ho\u1EB7c t\u1EF1 \u0111\u1ED9ng th\u1EF1c hi\u1EC7n c\xE1c t\xE1c v\u1EE5 th\xF4ng minh thay con ng\u01B0\u1EDDi?", [
        "M\xE3 h\xF3a file \u0111\u1ED1i x\u1EE9ng.",
        "C\u01A1 ch\u1EBF kh\xF3a lu\u1ED3ng h\xE0ng \u0111\u1EE3i d\u1EEF li\u1EC7u Mutex.",
        "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o v\xE0 H\u1ECDc m\xE1y (AI / Machine Learning).",
        "Chuy\u1EC3n \u0111\u1ED5i v\u0103n b\u1EA3n thu\u1EA7n sang chu\u1ED7i k\xFD t\u1EF1 m\u1ED9t d\xF2ng."
      ], 2),
      q("M\xE3 QR (QR Code) \u0111\u01B0\u1EE3c \u1EE9ng d\u1EE5ng r\u1ED9ng r\xE3i trong chuy\u1EC3n \u0111\u1ED5i s\u1ED1 \u0111\u1EDDi s\u1ED1ng h\xE0ng ng\xE0y nh\u1EB1m m\u1EE5c \u0111\xEDch ch\xEDnh l\xE0 g\xEC?", [
        "M\xE3 h\xF3a th\xF4ng tin th\xE0nh ma tr\u1EADn \u0111i\u1EC3m hai chi\u1EC1u gi\xFAp c\xE1c thi\u1EBFt b\u1ECB di \u0111\u1ED9ng qu\xE9t v\xE0 truy c\u1EADp nhanh th\xF4ng tin, li\xEAn k\u1EBFt ho\u1EB7c th\u1EF1c hi\u1EC7n thanh to\xE1n.",
        "Thay th\u1EBF cho vi\u1EC7c k\u1EBFt n\u1ED1i m\u1EA1ng WiFi v\xE0 m\u1EA1ng LAN truy\u1EC1n th\u1ED1ng.",
        "T\u1EF1 \u0111\u1ED9ng t\u0103ng dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB RAM c\u1EE7a \u0111i\u1EC7n tho\u1EA1i di \u0111\u1ED9ng.",
        "Ch\u1EB7n to\xE0n b\u1ED9 c\xE1c cu\u1ED9c g\u1ECDi v\xE0 tin nh\u1EAFn l\u1EEBa \u0111\u1EA3o t\u1EEB s\u1ED1 l\u1EA1."
      ], 0),
      q("C\u01A1 s\u1EDF d\u1EEF li\u1EC7u qu\u1ED1c gia v\u1EC1 D\xE2n c\u01B0 do b\u1ED9 ban ng\xE0nh n\xE0o ch\u1EE7 tr\xEC x\xE2y d\u1EF1ng, \u0111\xF3ng vai tr\xF2 l\xE0 d\u1EEF li\u1EC7u g\u1ED1c ph\u1EE5c v\u1EE5 chuy\u1EC3n \u0111\u1ED5i s\u1ED1?", [
        "B\u1ED9 Th\xF4ng tin v\xE0 Truy\u1EC1n th\xF4ng.",
        "B\u1ED9 C\xF4ng an.",
        "B\u1ED9 T\u01B0 ph\xE1p.",
        "B\u1ED9 Khoa h\u1ECDc v\xE0 C\xF4ng ngh\u1EC7."
      ], 1),
      q("Khi th\u1EF1c hi\u1EC7n thanh to\xE1n kh\xF4ng d\xF9ng ti\u1EC1n m\u1EB7t qua \u1EE9ng d\u1EE5ng Ng\xE2n h\xE0ng s\u1ED1, ph\u01B0\u01A1ng th\u1EE9c qu\xE9t m\xE3 n\xE0o sau \u0111\xE2y \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n h\xF3a to\xE0n qu\u1ED1c?", [
        "M\xE3 v\u1EA1ch m\u1ED9t chi\u1EC1u (Barcode).",
        "M\xE3 k\xFD t\u1EF1 Base64 m\u1ED9t d\xF2ng.",
        "M\xE3 VietQR."
      ], 2),
      q('Kh\xE1i ni\u1EC7m "C\xF4ng d\xE2n s\u1ED1" (Digital Citizen) y\xEAu c\u1EA7u c\xE1 nh\xE2n c\u1EA7n c\xF3 n\u0103ng l\u1EF1c t\u1ED1i thi\u1EC3u n\xE0o?', [
        "N\u0103ng l\u1EF1c vi\u1EBFt m\xE3 ngu\u1ED3n \u1EE9ng d\u1EE5ng b\u1EB1ng c\xE1c ng\xF4n ng\u1EEF Node.js ho\u1EB7c PHP.",
        "N\u0103ng l\u1EF1c truy c\u1EADp, s\u1EED d\u1EE5ng c\xF4ng ngh\u1EC7 s\u1ED1 m\u1ED9t c\xE1ch an to\xE0n, tr\xE1ch nhi\u1EC7m, tu\xE2n th\u1EE7 ph\xE1p lu\u1EADt v\xE0 chu\u1EA9n m\u1EF1c \u0111\u1EA1o \u0111\u1EE9c tr\xEAn m\xF4i tr\u01B0\u1EDDng s\u1ED1.",
        "S\u1EDF h\u1EEFu \xEDt nh\u1EA5t 3 chi\u1EBFc m\xE1y t\xEDnh c\u1EA5u h\xECnh cao t\u1EA1i nh\xE0.",
        "Khai th\xE1c th\xE0nh c\xF4ng c\xE1c l\u1ED7i c\u1EA5u h\xECnh b\u1EA3o m\u1EADt h\u1EC7 th\u1ED1ng web."
      ], 1),
      // ---- MỤC B: THÔNG HIỂU & ÁP DỤNG — KỸ NĂNG SỐ THIẾT YẾU (Câu 18–40) ----
      q("Khi n\u1ED9p h\u1ED3 s\u01A1 d\u1ECBch v\u1EE5 c\xF4ng tr\u1EF1c tuy\u1EBFn, t\u1EA1i sao h\u1EC7 th\u1ED1ng th\u01B0\u1EDDng khuy\u1EBFn c\xE1o c\xF4ng d\xE2n cung c\u1EA5p t\u1EC7p tin v\u0103n b\u1EA3n \u0111\xE3 k\xFD s\u1ED1 (ho\u1EB7c k\xFD \u0111i\u1EC7n t\u1EED)?", [
        "\u0110\u1EC3 \u0111\u1EA3m b\u1EA3o t\xEDnh x\xE1c th\u1EF1c c\u1EE7a ng\u01B0\u1EDDi k\xFD, ch\u1ED1ng ch\u1ED1i b\u1ECF tr\xE1ch nhi\u1EC7m v\xE0 ph\xE1t hi\u1EC7n n\u1EBFu n\u1ED9i dung file b\u1ECB ch\u1EC9nh s\u1EEDa tr\xE1i ph\xE9p sau khi k\xFD.",
        "\u0110\u1EC3 l\xE0m gi\u1EA3m dung l\u01B0\u1EE3ng b\u1ED9 nh\u1EDB l\u01B0u tr\u1EEF file d\u1EEF li\u1EC7u ph\u1EB3ng c\u1EE7a server.",
        "V\xEC h\u1EC7 th\u1ED1ng m\xE1y ch\u1EE7 kh\xF4ng th\u1EC3 \u0111\u1ECDc \u0111\u01B0\u1EE3c c\xE1c file t\xE0i li\u1EC7u d\u1EA1ng ch\u1EEF thu\u1EA7n.",
        "Nh\u1EB1m m\u1EE5c \u0111\xEDch k\xEDch ho\u1EA1t t\xEDnh n\u0103ng t\u1EF1 \u0111\u1ED9ng ch\u1EA5m \u0111i\u1EC3m h\u1ED3 s\u01A1 c\xF4ng d\xE2n."
      ], 0),
      q("H\xE0nh vi n\xE0o sau \u0111\xE2y \xE1p d\u1EE5ng \u0111\xFAng k\u1EF9 n\u0103ng qu\u1EA3n l\xFD d\u1EEF li\u1EC7u s\u1ED1 c\xE1 nh\xE2n m\u1ED9t c\xE1ch khoa h\u1ECDc tr\xEAn m\xF4i tr\u01B0\u1EDDng \u0111\xE1m m\xE2y?", [
        "L\u01B0u t\u1EA5t c\u1EA3 c\xE1c file \u1EA3nh, v\u0103n b\u1EA3n v\xE0o m\u1ED9t th\u01B0 m\u1EE5c chung kh\xF4ng \u0111\u1EB7t t\xEAn.",
        'Chia s\u1EBB quy\u1EC1n "Editor" c\xF4ng khai cho b\u1EA5t k\u1EF3 ai c\xF3 \u0111\u01B0\u1EDDng link truy c\u1EADp t\xE0i nguy\xEAn.',
        "\u0110\u1EB7t m\u1EADt kh\u1EA9u cho m\u1ECDi file gi\u1ED1ng h\u1EC7t v\u1EDBi t\xEAn \u0111\u0103ng nh\u1EADp t\xE0i kho\u1EA3n email.",
        "S\u1EAFp x\u1EBFp file theo c\u1EA5u tr\xFAc th\u01B0 m\u1EE5c r\xF5 r\xE0ng (n\u0103m, lo\u1EA1i c\xF4ng vi\u1EC7c), \u0111\u1EB7t t\xEAn file g\u1EE3i nh\u1EDB, \u0111\u1ECBnh k\u1EF3 x\xF3a b\u1ECF d\u1EEF li\u1EC7u r\xE1c kh\xF4ng c\xF2n gi\xE1 tr\u1ECB."
      ], 3),
      q("Khi s\u1EED d\u1EE5ng \u1EE9ng d\u1EE5ng VNeID m\u1EE9c \u0111\u1ED9 2, ng\u01B0\u1EDDi d\xE2n c\xF3 th\u1EC3 d\xF9ng th\xF4ng tin hi\u1EC3n th\u1ECB tr\xEAn \u1EE9ng d\u1EE5ng n\xE0y \u0111\u1EC3 thay th\u1EBF cho gi\u1EA5y t\u1EDD v\u1EADt l\xFD n\xE0o khi l\xE0m th\u1EE7 t\u1EE5c t\u1EA1i s\xE2n bay?", [
        "C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n (ho\u1EB7c H\u1ED9 chi\u1EBFu).",
        "Th\u1EBB b\u1EA3o hi\u1EC3m y t\u1EBF.",
        "Gi\u1EA5y khai sinh b\u1EA3n g\u1ED1c.",
        "Gi\u1EA5y ph\xE9p l\xE1i xe h\u1EA1ng A1."
      ], 0),
      q("\u0110\u1EC3 chia s\u1EBB m\u1ED9t t\xE0i li\u1EC7u v\u0103n b\u1EA3n tr\xEAn Google Drive cho \u0111\u1ED3ng nghi\u1EC7p ph\u1ED1i h\u1EE3p s\u1EEDa n\u1ED9i dung c\xF9ng l\xFAc, b\u1EA1n n\xEAn c\u1EA5p quy\u1EC1n truy c\u1EADp \u1EDF m\u1EE9c \u0111\u1ED9 n\xE0o l\xE0 ph\xF9 h\u1EE3p nh\u1EA5t?", [
        "Viewer (Ng\u01B0\u1EDDi xem).",
        "Commenter (Ng\u01B0\u1EDDi b\xECnh lu\u1EADn).",
        "Editor (Ng\u01B0\u1EDDi ch\u1EC9nh s\u1EEDa).",
        "Ch\u1EE7 s\u1EDF h\u1EEFu h\u1EC7 th\u1ED1ng d\u1EEF li\u1EC7u ph\u1EB3ng."
      ], 2),
      q("Ch\u1EEF k\xFD s\u1ED1 (Digital Signature) ho\u1EA1t \u0111\u1ED9ng d\u1EF1a tr\xEAn c\u1EB7p kh\xF3a b\u1EA3o m\u1EADt n\xE0o \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o t\xEDnh x\xE1c th\u1EF1c to\xE0n v\u1EB9n?", [
        "Kh\xF3a \u0111\u1ED1i x\u1EE9ng AES v\xE0 chu\u1ED7i Base64.",
        "Kh\xF3a b\xED m\u1EADt (Private Key) \u0111\u1EC3 k\xFD v\xE0 Kh\xF3a c\xF4ng khai (Public Key) \u0111\u1EC3 x\xE1c th\u1EF1c.",
        "Kh\xF3a logic XOR v\xE0 h\xE0m b\u0103m m\u1EADt kh\u1EA9u MD5.",
        "Kh\xF3a h\u1EC7 th\u1ED1ng c\u1EE7a bot Google Drive API."
      ], 1),
      q("Khi nh\u1EADn th\u1EA5y m\u1ED9t file t\xE0i li\u1EC7u tr\xEAn m\xE1y t\xEDnh c\xF3 \u0111u\xF4i m\u1EDF r\u1ED9ng l\u1EA1 l\xE0 .xlsx.exe ho\u1EB7c .pdf.exe, b\u1EA1n n\xEAn x\u1EED l\xFD nh\u01B0 th\u1EBF n\xE0o?", [
        "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng m\u1EDF file, ti\u1EBFn h\xE0nh x\xF3a file ngay l\u1EADp t\u1EE9c v\xEC \u0111\xE2y c\xF3 kh\u1EA3 n\u0103ng cao l\xE0 m\xE3 \u0111\u1ED9c l\u1ED3ng \u0111u\xF4i gi\u1EA3 m\u1EA1o file t\xE0i li\u1EC7u.",
        "B\u1EA5m \u0111\xFAp chu\u1ED9t \u0111\u1EC3 m\u1EDF file ngay v\xEC \u0111\xE2y l\xE0 t\u1EC7p tin v\u0103n b\u1EA3n v\u0103n ph\xF2ng.",
        "\u0110\u1ED5i t\xEAn file x\xF3a ch\u1EEF .exe \u0111i r\u1ED3i ti\u1EBFp t\u1EE5c click m\u1EDF b\xECnh th\u01B0\u1EDDng.",
        "G\u1EEDi file n\xE0y qua email cho to\xE0n b\u1ED9 m\u1ECDi ng\u01B0\u1EDDi trong c\u01A1 quan c\xF9ng xem."
      ], 0),
      q("N\u1EC1n t\u1EA3ng h\u1ECDc tr\u1EF1c tuy\u1EBFn m\u1EDF (MOOCs) mang l\u1EA1i l\u1EE3i \xEDch l\u1EDBn nh\u1EA5t n\xE0o cho c\xE1n b\u1ED9 c\xF4ng ch\u1EE9c trong c\xF4ng t\xE1c b\u1ED3i d\u01B0\u1EE1ng k\u1EF9 n\u0103ng s\u1ED1?", [
        "T\u1EF1 \u0111\u1ED9ng l\xE0m h\u1ED9 b\xE0i thi tr\u1EAFc nghi\u1EC7m c\u1EE7a h\u1ECDc vi\xEAn khi \u0111\u1EBFn h\u1EA1n.",
        "C\u1EA5p ch\u1EE9ng ch\u1EC9 t\u1ED1t nghi\u1EC7p t\u1EF1 \u0111\u1ED9ng m\xE0 kh\xF4ng c\u1EA7n tham gia thi \u0111\xE1nh gi\xE1.",
        "Cho ph\xE9p ti\u1EBFp c\u1EADn kho b\xE0i gi\u1EA3ng ch\u1EA5t l\u01B0\u1EE3ng cao, t\u1EF1 h\u1ECDc m\u1ECDi l\xFAc m\u1ECDi n\u01A1i theo t\u1ED1c \u0111\u1ED9 c\xE1 nh\xE2n, ti\u1EBFt ki\u1EC7m chi ph\xED \u0111i l\u1EA1i.",
        "Thay \u0111\u1ED5i to\xE0n b\u1ED9 c\u1EA5u tr\xFAc file d\u1EEF li\u1EC7u c\u1EE7a h\u1EC7 qu\u1EA3n tr\u1ECB c\u01A1 s\u1EDF d\u1EEF li\u1EC7u."
      ], 2),
      q("Khi l\xE0m vi\u1EC7c tr\xEAn m\xF4i tr\u01B0\u1EDDng m\u1EA1ng, h\xE0nh vi n\xE0o th\u1EC3 hi\u1EC7n k\u1EF9 n\u0103ng giao ti\u1EBFp v\u0103n minh, tu\xE2n th\u1EE7 Lu\u1EADt An ninh m\u1EA1ng v\xE0 B\u1ED9 quy t\u1EAFc \u1EE9ng x\u1EED tr\xEAn m\u1EA1ng x\xE3 h\u1ED9i?", [
        "S\u1EED d\u1EE5ng t\xE0i kho\u1EA3n \u1EA9n danh \u0111\u1EC3 \u0111i b\xECnh lu\u1EADn x\xFAc ph\u1EA1m, b\xF4i nh\u1ECD uy t\xEDn ng\u01B0\u1EDDi kh\xE1c.",
        "Sao ch\xE9p to\xE0n b\u1ED9 b\xE0i vi\u1EBFt c\u1EE7a ng\u01B0\u1EDDi kh\xE1c v\u1EC1 trang c\xE1 nh\xE2n v\xE0 t\u1EF1 nh\u1EADn l\xE0 c\u1EE7a m\xECnh.",
        "Ch\u1EC9 chia s\u1EBB c\xE1c th\xF4ng tin r\xF5 ngu\u1ED3n g\u1ED1c t\u1EEB c\u01A1 quan ch\xEDnh th\u1ED1ng, s\u1EED d\u1EE5ng ng\xF4n t\u1EEB l\u1ECBch s\u1EF1, kh\xF4ng k\xEDch \u0111\u1ED9ng b\u1EA1o l\u1EF1c hay lan truy\u1EC1n tin gi\u1EA3.",
        "T\u1EF1 \u0111\u1ED9ng th\xEAm b\u1EA1n b\xE8 v\xE0o c\xE1c nh\xF3m qu\u1EA3ng c\xE1o kinh doanh khi ch\u01B0a \u0111\u01B0\u1EE3c s\u1EF1 \u0111\u1ED3ng \xFD."
      ], 2),
      q('H\xE0nh vi "Thanh to\xE1n b\u1EB1ng qu\xE9t m\xE3 QR t\u0129nh" d\xE1n t\u1EA1i qu\u1EA7y h\xE0ng ti\u1EC1m \u1EA9n r\u1EE7i ro l\u1EEBa \u0111\u1EA3o c\xF4ng ngh\u1EC7 g\xEC n\u1EBFu ng\u01B0\u1EDDi mua l\u01A1 l\xE0 kh\xF4ng ki\u1EC3m tra?', [
        "K\u1EBB gian l\xE9n l\xFAt d\xE1n \u0111\xE8 m\u1ED9t m\xE3 QR kh\xE1c ch\u1EE9a t\xE0i kho\u1EA3n c\u1EE7a h\u1ECD l\xEAn tr\xEAn m\xE3 QR th\u1EADt c\u1EE7a c\u1EEDa h\xE0ng \u0111\u1EC3 chi\u1EBFm \u0111o\u1EA1t ti\u1EC1n chuy\u1EC3n kho\u1EA3n.",
        "Hacker t\u1EF1 \u0111\u1ED9ng hack chi\u1EBFm quy\u1EC1n \u0111i\u1EC1u khi\u1EC3n \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh qua camera.",
        "\u0110i\u1EC7n tho\u1EA1i c\u1EE7a ng\u01B0\u1EDDi mua t\u1EF1 \u0111\u1ED9ng s\u1EE5t gi\u1EA3m dung l\u01B0\u1EE3ng l\u01B0u tr\u1EEF file d\u1EEF li\u1EC7u.",
        "H\u1EC7 th\u1ED1ng m\u1EA1ng WiFi c\u1EE7a c\u1EEDa h\xE0ng s\u1EBD b\u1ECB s\u1EADp do qu\xE1 t\u1EA3i y\xEAu c\u1EA7u giao d\u1ECBch."
      ], 0),
      q("Khi c\u1EA5u h\xECnh m\u1ED9t file bi\u1EC3u m\u1EABu kh\u1EA3o s\xE1t tr\u1EF1c tuy\u1EBFn (Google Forms / Microsoft Forms) thu th\u1EADp th\xF4ng tin c\xE1 nh\xE2n c\u1EE7a ng\u01B0\u1EDDi d\xE2n, l\u1EADp tr\xECnh vi\xEAn c\u1EA7n l\u01B0u \xFD nguy\xEAn t\u1EAFc b\u1EA3o m\u1EADt n\xE0o?", [
        "M\u1EDF c\xF4ng khai k\u1EBFt qu\u1EA3 ph\u1EA3n h\u1ED3i cho t\u1EA5t c\u1EA3 m\u1ECDi ng\u01B0\u1EDDi c\xF9ng xem \u0111\u1EC3 t\u0103ng t\xEDnh minh b\u1EA1ch.",
        "T\u1EF1 \u0111\u1ED9ng l\u01B0u tr\u1EEF th\xF4ng tin m\u1EADt kh\u1EA9u t\xE0i kho\u1EA3n c\xE1 nh\xE2n c\u1EE7a ng\u01B0\u1EDDi \u0111i\u1EC1n form.",
        "Chuy\u1EC3n \u0111\u1ED5i to\xE0n b\u1ED9 bi\u1EC3u m\u1EABu sang \u0111\u1ECBnh d\u1EA1ng file v\u0103n b\u1EA3n th\xF4 1 d\xF2ng.",
        "Ch\u1EC9 thu th\u1EADp \u0111\xFAng c\xE1c tr\u01B0\u1EDDng th\xF4ng tin c\u1EA7n thi\u1EBFt, gi\u1EDBi h\u1EA1n quy\u1EC1n xem trang k\u1EBFt qu\u1EA3 ph\u1EA3n h\u1ED3i cho ng\u01B0\u1EDDi c\xF3 tr\xE1ch nhi\u1EC7m v\xE0 b\u1EADt b\u1EA3o m\u1EADt t\xE0i kho\u1EA3n qu\u1EA3n tr\u1ECB."
      ], 3),
      q('Trong c\xF4ng t\xE1c s\u1ED1 h\xF3a h\u1ED3 s\u01A1, k\u1EF9 thu\u1EADt "Nh\u1EADn d\u1EA1ng k\xFD t\u1EF1 quang h\u1ECDc" (OCR) \u0111\xF3ng vai tr\xF2 g\xEC quan tr\u1ECDng?', [
        "T\u1EF1 \u0111\u1ED9ng d\u1ECBch ng\xF4n ng\u1EEF v\u0103n b\u1EA3n t\u1EEB ti\u1EBFng Vi\u1EC7t sang ti\u1EBFng Anh.",
        "Chuy\u1EC3n \u0111\u1ED5i h\xECnh \u1EA3nh c\u1EE7a v\u0103n b\u1EA3n ch\u1EEF vi\u1EBFt tay ho\u1EB7c ch\u1EEF in th\xE0nh d\u1EEF li\u1EC7u v\u0103n b\u1EA3n d\u1EA1ng ch\u1EEF thu\u1EA7n c\xF3 th\u1EC3 t\xECm ki\u1EBFm v\xE0 ch\u1EC9nh s\u1EEDa \u0111\u01B0\u1EE3c.",
        "M\xE3 h\xF3a file t\xE0i li\u1EC7u b\u1EB1ng thu\u1EADt to\xE1n \u0111\u1ED1i x\u1EE9ng chu\u1ED7i n\xE9n.",
        "T\u1EF1 \u0111\u1ED9ng g\u1EEDi file v\u0103n b\u1EA3n l\xEAn th\u01B0 m\u1EE5c l\u01B0u tr\u1EEF \u0111\xE1m m\xE2y c\u1EE7a Google Drive."
      ], 1),
      q('Khi tr\xECnh duy\u1EC7t hi\u1EC3n th\u1ECB c\u1EA3nh b\xE1o "K\u1EBFt n\u1ED1i c\u1EE7a b\u1EA1n kh\xF4ng ph\u1EA3i l\xE0 k\u1EBFt n\u1ED1i ri\xEAng t\u01B0" (L\u1ED7i SSL/TLS), h\xE0nh \u0111\u1ED9ng x\u1EED l\xFD n\xE0o an to\xE0n nh\u1EA5t cho ng\u01B0\u1EDDi d\xF9ng?', [
        'B\u1EA5m ch\u1ECDn m\u1EE5c "N\xE2ng cao" v\xE0 ti\u1EBFp t\u1EE5c truy c\u1EADp trang web b\u1EA5t ch\u1EA5p c\u1EA3nh b\xE1o.',
        "T\u1EAFt t\xEDnh n\u0103ng di\u1EC7t virus c\u1EE7a m\xE1y t\xEDnh \u0111\u1EC3 tr\xECnh duy\u1EC7t kh\xF4ng b\xE1o l\u1ED7i n\u1EEFa.",
        "C\xE0i \u0111\u1EB7t l\u1EA1i h\u1EC7 \u0111i\u1EC1u h\xE0nh c\u1EE7a m\xE1y t\xEDnh \u0111\u1EC3 kh\u1EAFc ph\u1EE5c l\u1ED7i m\u1EA1ng.",
        "D\u1EEBng truy c\u1EADp trang web \u0111\xF3 ngay l\u1EADp t\u1EE9c, kh\xF4ng \u0111i\u1EC1n b\u1EA5t k\u1EF3 th\xF4ng tin t\xE0i kho\u1EA3n hay m\u1EADt kh\u1EA9u n\xE0o tr\xEAn giao di\u1EC7n n\xE0y."
      ], 3),
      q('Ch\u1EE9c n\u0103ng "\u0110\u1ED3ng b\u1ED9 h\xF3a d\u1EEF li\u1EC7u" (Data Synchronization) tr\xEAn c\xE1c thi\u1EBFt b\u1ECB di \u0111\u1ED9ng c\xF3 \xFD ngh\u0129a nh\u01B0 th\u1EBF n\xE0o trong \u0111\u1EDDi s\u1ED1ng s\u1ED1?', [
        "L\xE0m t\u0103ng k\xEDch th\u01B0\u1EDBc dung l\u01B0\u1EE3ng l\u01B0u tr\u1EEF c\u1EE7a c\xE1c file \u1EA3nh c\u1EE5c b\u1ED9.",
        "Chuy\u1EC3n to\xE0n b\u1ED9 cu\u1ED9c g\u1ECDi th\xF4ng th\u01B0\u1EDDng sang cu\u1ED9c g\u1ECDi m\xE3 h\xF3a qua Internet.",
        "T\u1EF1 \u0111\u1ED9ng c\u1EADp nh\u1EADt, sao l\u01B0u d\u1EEF li\u1EC7u \u0111\u1ED3ng nh\u1EA5t gi\u1EEFa \u0111i\u1EC7n tho\u1EA1i, m\xE1y t\xEDnh v\xE0 Cloud, gi\xFAp kh\xF4ng b\u1ECB m\u1EA5t m\xE1t th\xF4ng tin khi thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng b\u1ECB h\u1ECFng.",
        "T\u1EF1 \u0111\u1ED9ng x\xF3a b\u1ECF c\xE1c t\xE0i kho\u1EA3n ng\u01B0\u1EDDi d\xF9ng kh\xF4ng ho\u1EA1t \u0111\u1ED9ng trong 15 ph\xFAt."
      ], 2),
      q('Khi nh\u1EADn \u0111\u01B0\u1EE3c m\u1ED9t t\xE0i li\u1EC7u chia s\u1EBB qua Cloud c\xF3 quy\u1EC1n "Editor", n\u1EBFu b\u1EA1n l\u1EE1 tay x\xF3a m\u1ED9t th\u01B0 m\u1EE5c quan tr\u1ECDng, l\xE0m th\u1EBF n\xE0o \u0111\u1EC3 kh\xF4i ph\u1EE5c l\u1EA1i d\u1EEF li\u1EC7u?', [
        "H\u1EC7 th\u1ED1ng \u0111\xE3 m\u1EA5t d\u1EEF li\u1EC7u v\u0129nh vi\u1EC5n kh\xF4ng th\u1EC3 l\u1EA5y l\u1EA1i \u0111\u01B0\u1EE3c.",
        'Truy c\u1EADp v\xE0o m\u1EE5c "Th\xF9ng r\xE1c" (Trash/Bin) c\u1EE7a d\u1ECBch v\u1EE5 \u0111\xE1m m\xE2y \u0111\xF3 \u0111\u1EC3 t\xECm l\u1EA1i th\u01B0 m\u1EE5c b\u1ECB x\xF3a v\xE0 b\u1EA5m n\xFAt Kh\xF4i ph\u1EE5c (Restore).',
        "Ch\u1EA1y l\u1EC7nh PowerShell b\u0103m m\u1EADt kh\u1EA9u d\u01B0\u1EDBi m\xE1y t\xEDnh c\xE1 nh\xE2n.",
        "Y\xEAu c\u1EA7u t\u1EA5t c\u1EA3 ng\u01B0\u1EDDi d\xF9ng kh\xE1c \u0111\u0103ng xu\u1EA5t kh\u1ECFi h\u1EC7 th\u1ED1ng m\u1EA1ng."
      ], 1),
      q('K\u1EF9 n\u0103ng "X\xE1c th\u1EF1c ngu\u1ED3n tin" tr\u01B0\u1EDBc khi chia s\u1EBB m\u1ED9t b\xE0i vi\u1EBFt l\xEAn m\u1EA1ng x\xE3 h\u1ED9i \u0111\xF2i h\u1ECFi b\u1EA1n ph\u1EA3i ki\u1EC3m tra y\u1EBFu t\u1ED1 n\xE0o?', [
        "S\u1ED1 l\u01B0\u1EE3ng l\u01B0\u1EE3t th\xEDch (Like) v\xE0 l\u01B0\u1EE3t chia s\u1EBB (Share) c\u1EE7a b\xE0i vi\u1EBFt \u0111\xF3.",
        "H\xECnh \u1EA3nh minh h\u1ECDa c\u1EE7a b\xE0i vi\u1EBFt c\xF3 m\xE0u s\u1EAFc b\u1EAFt m\u1EAFt s\u1ED1ng \u0111\u1ED9ng kh\xF4ng.",
        "\u0110\u1ED9 d\xE0i v\u0103n b\u1EA3n c\u1EE7a b\xE0i vi\u1EBFt c\xF3 tr\xEAn 2.000 k\xFD t\u1EF1 hay kh\xF4ng.",
        "B\xE0i vi\u1EBFt c\xF3 \u0111\u1EBFn t\u1EEB trang th\xF4ng tin \u0111i\u1EC7n t\u1EED c\xF3 t\xEAn mi\u1EC1n ch\xEDnh th\u1ED1ng (\u0111u\xF4i .gov.vn, .org.vn) ho\u1EB7c c\u01A1 quan b\xE1o ch\xED uy t\xEDn kh\xF4ng."
      ], 3),
      q("Khi s\u1EED d\u1EE5ng ph\u1EA7n m\u1EC1m h\u1ECDp tr\u1EF1c tuy\u1EBFn (nh\u01B0 Zoom, Microsoft Teams), \u0111\u1EC3 ng\u0103n ch\u1EB7n k\u1EBB x\u1EA5u v\xE0o ph\xE1 ho\u1EA1i ho\u1EB7c ph\xE1t t\xE1n n\u1ED9i dung \u0111\u1ED9c h\u1EA1i, gi\u1EA3i ph\xE1p n\xE0o sau \u0111\xE2y l\xE0 c\u1EA7n thi\u1EBFt?", [
        "C\xF4ng khai ID v\xE0 m\u1EADt kh\u1EA9u ph\xF2ng h\u1ECDp l\xEAn c\xE1c h\u1ED9i nh\xF3m m\u1EA1ng x\xE3 h\u1ED9i l\u1EDBn.",
        'B\u1EADt t\xEDnh n\u0103ng "Ph\xF2ng ch\u1EDD" (Waiting Room), \u0111\u1EB7t m\u1EADt kh\u1EA9u m\u1EA1nh cho ph\xF2ng h\u1ECDp v\xE0 ch\u1EC9 duy\u1EC7t nh\u1EEFng ng\u01B0\u1EDDi c\xF3 t\xEAn trong danh s\xE1ch x\xE1c th\u1EF1c v\xE0o h\u1ECDp.',
        "T\u1EAFt t\xEDnh n\u0103ng t\u01B0\u1EDDng l\u1EEDa b\u1EA3o m\u1EADt m\u1EA1ng c\u1EE7a m\xE1y ch\u1EE7 m\xE1y t\xEDnh.",
        "\xC9p bu\u1ED9c t\u1EA5t c\u1EA3 th\xE0nh vi\xEAn tham gia ph\u1EA3i s\u1EED d\u1EE5ng k\u1EBFt n\u1ED1i m\u1EA1ng VPN."
      ], 1),
      q('Vi\u1EC7c t\u1EAFt t\xEDnh n\u0103ng "T\u1EF1 \u0111\u1ED9ng k\u1EBFt n\u1ED1i WiFi" (Auto-connect) tr\xEAn \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh mang l\u1EA1i l\u1EE3i \xEDch g\xEC v\u1EC1 m\u1EB7t an to\xE0n th\xF4ng tin?', [
        "Ng\u0103n ch\u1EB7n \u0111i\u1EC7n tho\u1EA1i t\u1EF1 \u0111\u1ED9ng k\u1EBFt n\u1ED1i v\xE0o c\xE1c m\u1EA1ng WiFi gi\u1EA3 m\u1EA1o, WiFi \u0111\u1ED9c h\u1EA1i do hacker l\u1EADp ra \u0111\u1EC3 ch\u1EB7n b\u1EAFt d\u1EEF li\u1EC7u ng\u01B0\u1EDDi d\xF9ng khi b\u1EA1n di chuy\u1EC3n.",
        "Gi\xFAp \u0111i\u1EC7n tho\u1EA1i b\u1EAFt s\xF3ng m\u1EA1ng di \u0111\u1ED9ng 4G/5G t\u1ED1t h\u01A1n.",
        "L\xE0m t\u0103ng t\u1ED1c \u0111\u1ED9 x\u1EED l\xFD \u0111i\u1EC3m s\u1ED1 c\u1EE7a c\xE1c \u1EE9ng d\u1EE5ng thi tr\u1EF1c tuy\u1EBFn.",
        "X\xF3a b\u1ECF to\xE0n b\u1ED9 b\u1ED9 nh\u1EDB \u0111\u1EC7m cache cookies c\u1EE7a tr\xECnh duy\u1EC7t web."
      ], 0),
      q("Khi g\u1EEDi m\u1ED9t t\u1EC7p tin t\xE0i li\u1EC7u nh\u1EA1y c\u1EA3m qua Email c\xF4ng v\u1EE5, gi\u1EA3i ph\xE1p n\xE0o t\u0103ng c\u01B0\u1EDDng b\u1EA3o m\u1EADt d\u1EEF li\u1EC7u t\u1ED1t nh\u1EA5t?", [
        "D\xE1n th\u1EB3ng to\xE0n b\u1ED9 n\u1ED9i dung t\xE0i li\u1EC7u nh\u1EA1y c\u1EA3m v\xE0o ph\u1EA7n th\xE2n email ch\u1EEF thu\u1EA7n.",
        "Thay \u0111\u1ED5i ph\u1EA7n m\u1EDF r\u1ED9ng \u0111u\xF4i file sang \u0111\u1ECBnh d\u1EA1ng c\u1EA5u tr\xFAc ph\u1EB3ng JSON.",
        "N\xE9n t\u1EC7p tin l\u1EA1i, \u0111\u1EB7t m\u1EADt kh\u1EA9u b\u1EA3o v\u1EC7 m\u1EA1nh cho file n\xE9n \u0111\xF3 v\xE0 g\u1EEDi m\u1EADt kh\u1EA9u qua m\u1ED9t k\xEAnh li\xEAn l\u1EA1c t\xE1ch bi\u1EC7t (nh\u01B0 g\u1ECDi \u0111i\u1EC7n ho\u1EB7c nh\u1EAFn tin SMS).",
        "G\u1EEDi k\xE8m file \u0111\xF3 cho to\xE0n b\u1ED9 \u0111\u1ECBa ch\u1EC9 email c\xF3 trong danh b\u1EA1 h\u1EC7 th\u1ED1ng."
      ], 2),
      q("Trong b\u1EA3ng t\xEDnh Excel, \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o ng\u01B0\u1EDDi nh\u1EADp li\u1EC7u kh\xF4ng g\xF5 sai \u0111\u1ECBnh d\u1EA1ng ng\xE0y th\xE1ng ho\u1EB7c s\u1ED1 C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n (CCCD), t\xEDnh n\u0103ng n\xE0o c\u1EA7n \u0111\u01B0\u1EE3c \xE1p d\u1EE5ng?", [
        "Conditional Formatting.",
        "Pivot Table.",
        "AutoFilter.",
        "Data Validation (Ki\u1EC3m tra h\u1EE3p l\u1EC7 d\u1EEF li\u1EC7u)."
      ], 3),
      q('Kh\xE1i ni\u1EC7m "Ch\u1EEF k\xFD s\u1ED1 c\xF4ng c\u1ED9ng" \u0111\u01B0\u1EE3c c\u1EA5p b\u1EDFi c\xE1c \u0111\u01A1n v\u1ECB \u0111\u01B0\u1EE3c c\u1EA5p ph\xE9p c\xF3 gi\xE1 tr\u1ECB ph\xE1p l\xFD t\u01B0\u01A1ng \u0111\u01B0\u01A1ng v\u1EDBi y\u1EBFu t\u1ED1 n\xE0o trong m\xF4i tr\u01B0\u1EDDng truy\u1EC1n th\u1ED1ng?', [
        "L\u1EDDi n\xF3i ch\u1EE9ng th\u1EF1c c\u1EE7a ng\u01B0\u1EDDi l\xE0m ch\u1EE9ng t\u1EA1i c\u01A1 quan th\u1EA9m quy\u1EC1n.",
        "M\u1EADt kh\u1EA9u truy c\u1EADp v\xE0o h\u1EC7 th\u1ED1ng dashboard qu\u1EA3n tr\u1ECB n\u1ED9i b\u1ED9.",
        "Ch\u1EEF k\xFD tay c\u1EE7a c\xE1 nh\xE2n v\xE0 con d\u1EA5u c\u1EE7a t\u1ED5 ch\u1EE9c, doanh nghi\u1EC7p tr\xEAn v\u0103n b\u1EA3n gi\u1EA5y.",
        "M\xE3 \u0111\u1ECBnh danh duy nh\u1EA5t c\u1EE7a thi\u1EBFt b\u1ECB ph\u1EA7n c\u1EE9ng m\xE1y t\xEDnh."
      ], 2),
      q("H\xE0nh vi n\xE0o sau \u0111\xE2y vi ph\u1EA1m quy\u1EC1n s\u1EDF h\u1EEFu tr\xED tu\u1EC7 v\xE0 b\u1EA3n quy\u1EC1n tr\xEAn m\xF4i tr\u01B0\u1EDDng s\u1ED1?", [
        "T\u1EA3i v\u1EC1, t\u1EF1 \xFD ch\u1EC9nh s\u1EEDa x\xF3a t\xEAn t\xE1c gi\u1EA3 r\u1ED3i \u0111\u0103ng t\u1EA3i l\u1EA1i ph\u1EA7n m\u1EC1m b\u1EA3n quy\u1EC1n, h\xECnh \u1EA3nh \u0111\u1ED9c quy\u1EC1n l\xEAn trang web c\xE1 nh\xE2n \u0111\u1EC3 kinh doanh th\u01B0\u01A1ng m\u1EA1i.",
        "Tr\xEDch d\u1EABn ngu\u1ED3n r\xF5 r\xE0ng t\xEAn t\xE1c gi\u1EA3 khi s\u1EED d\u1EE5ng m\u1ED9t ph\u1EA7n b\xE0i vi\u1EBFt nghi\xEAn c\u1EE9u.",
        "Mua b\u1EA3n quy\u1EC1n \u1EE9ng d\u1EE5ng t\u1EEB c\u1EEDa h\xE0ng \u1EE9ng d\u1EE5ng ch\xEDnh th\u1ED1ng.",
        "S\u1EED d\u1EE5ng c\xE1c b\xE0i h\u1ECDc an to\xE0n th\xF4ng tin mi\u1EC5n ph\xED c\u1EE7a c\u1ED5ng \u0111\xE0o t\u1EA1o."
      ], 0),
      q("Khi thi\u1EBFt l\u1EADp h\u1EC7 th\u1ED1ng \u0111\u1ECBnh danh, h\xE0m so s\xE1nh chu\u1ED7i m\u1EADt kh\u1EA9u th\xF4ng th\u01B0\u1EDDng (nh\u01B0 ===) d\u1EC5 b\u1ECB t\u1EA5n c\xF4ng ph\xE2n t\xEDch th\u1EDDi gian ph\u1EA3n h\u1ED3i (Timing Attack). L\u1EADp tr\xECnh vi\xEAn ph\xF2ng th\u1EE7 b\u1EB1ng c\xE1ch n\xE0o?", [
        "M\xE3 h\xF3a \u0111\u1EA7u v\xE0o c\u1EE7a ng\u01B0\u1EDDi d\xF9ng th\xE0nh m\u1ED9t chu\u1ED7i Base64 ng\u1EABu nhi\xEAn.",
        "Chuy\u1EC3n c\xE2u l\u1EC7nh so s\xE1nh chu\u1ED7i th\u1EF1c hi\u1EC7n tr\u1EF1c ti\u1EBFp tr\xEAn d\u1ECBch v\u1EE5 \u0111\xE1m m\xE2y Cloud.",
        "S\u1EED d\u1EE5ng c\u01A1 ch\u1EBF so s\xE1nh th\u1EDDi gian c\u1ED1 \u0111\u1ECBnh (Constant-time comparison) b\u1EB1ng h\xE0m chuy\xEAn d\u1EE5ng c\u1EE7a th\u01B0 vi\u1EC7n crypto.",
        "Gi\u1EA3m \u0111\u1ED9 d\xE0i m\u1EADt kh\u1EA9u \u0111\u0103ng k\xFD t\u1ED1i \u0111a xu\u1ED1ng c\xF2n 6 k\xFD t\u1EF1."
      ], 2),
      q("M\u1ED9t h\u1EC7 th\u1ED1ng qu\u1EA3n l\xFD h\u1ED3 s\u01A1 c\xF4ng v\u1EE5 l\u01B0u tr\u1EEF th\xF4ng tin b\u1EB1ng c\xE1c file d\u1EEF li\u1EC7u ph\u1EB3ng .json tr\xEAn RAM cache v\xE0 \u0111\u1ED3ng b\u1ED9 b\u1EA5t \u0111\u1ED3ng b\u1ED9 l\xEAn Drive. Khi nhi\u1EC1u ng\u01B0\u1EDDi c\xF9ng thao t\xE1c d\u1ED3n d\u1EADp, c\u01A1 ch\u1EBF n\xE0o \u0111\u1EA3m b\u1EA3o d\u1EEF li\u1EC7u kh\xF4ng b\u1ECB ghi \u0111\xE8 l\u1EABn nhau?", [
        "C\u01A1 ch\u1EBF m\xE3 h\xF3a t\u1EC7p tin b\u1EB1ng thu\u1EADt to\xE1n AES \u0111\u1ED1i x\u1EE9ng.",
        "T\u1EF1 \u0111\u1ED9ng ng\u1EAFt k\u1EBFt n\u1ED1i Internet c\u1EE7a c\xE1c t\xE0i kho\u1EA3n g\u1EEDi y\xEAu c\u1EA7u mu\u1ED9n h\u01A1n.",
        "Chuy\u1EC3n \u0111\u1ED5i to\xE0n b\u1ED9 d\u1EEF li\u1EC7u ng\u01B0\u1EDDi d\xF9ng sang \u0111\u1ECBnh d\u1EA1ng hex 96 k\xFD t\u1EF1.",
        "C\u01A1 ch\u1EBF kh\xF3a lu\u1ED3ng Mutex (Promise-chain Locking) \u0111\u1EC3 c\xF4 l\u1EADp phi\xEAn ghi t\u1EA1i m\u1ED9t th\u1EDDi \u0111i\u1EC3m."
      ], 3),
      q("Tr\xEAn h\u1EC7 \u0111i\u1EC1u h\xE0nh Linux c\u1EE7a m\xE1y ch\u1EE7, l\u1EC7nh n\xE0o sau \u0111\xE2y \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng \u0111\u1EC3 n\xE9n th\u01B0 m\u1EE5c m\xE3 ngu\u1ED3n v\xE0 d\u1EEF li\u1EC7u ph\u1EB3ng th\xE0nh t\u1EC7p sao l\u01B0u d\u1EF1 ph\xF2ng nhanh nh\u1EA5t?", [
        "cat /etc/passwd > backup.txt",
        'grep -r "secret" ./src',
        "tar -czf backup_data.tar.gz ./data ./src",
        "chmod 755 server.js"
      ], 2),
      q("Khi ng\u01B0\u1EDDi d\xE2n s\u1EED d\u1EE5ng d\u1ECBch v\u1EE5 c\xF4ng tr\u1EF1c tuy\u1EBFn, ti\xEAu \u0111\u1EC1 HTTP n\xE0o (HTTP Header) t\u1EF1 \u0111\u1ED9ng g\u1EEDi k\xE8m \u0111\u1EC3 h\u1EC7 th\u1ED1ng nh\u1EADn bi\u1EBFt h\u1ECD \u0111ang thao t\xE1c b\u1EB1ng \u0111i\u1EC7n tho\u1EA1i Android, iPhone hay m\xE1y t\xEDnh Windows?", [
        "User-Agent",
        "Cookie",
        "Content-Type",
        "Referer"
      ], 0),
      q('M\u1ED9t trang web d\u1ECBch v\u1EE5 c\xF4ng b\u1ECB c\u1EA5u h\xECnh sai l\u1ED7i CORS (Cross-Origin Resource Sharing) cho ph\xE9p gi\xE1 tr\u1ECB Origin l\xE0 "*". Nguy c\u01A1 b\u1EA3o m\u1EADt nghi\xEAm tr\u1ECDng n\xE0o s\u1EBD x\u1EA3y ra?', [
        "H\u1EC7 th\u1ED1ng m\xE1y ch\u1EE7 t\u1EF1 \u0111\u1ED9ng chuy\u1EC3n sang Ch\u1EBF \u0111\u1ED9 c\u1EE5c b\u1ED9 (Local mode).",
        "C\xE1c trang web \u0111\u1ED9c h\u1EA1i c\u1EE7a b\xEAn th\u1EE9 ba c\xF3 th\u1EC3 g\u1EEDi y\xEAu c\u1EA7u tr\xE1i ph\xE9p \u0111\u1EC3 \u0111\u1ECDc d\u1EEF li\u1EC7u nh\u1EA1y c\u1EA3m ho\u1EB7c chi\u1EBFm \u0111o\u1EA1t phi\xEAn l\xE0m vi\u1EC7c c\u1EE7a ng\u01B0\u1EDDi d\xE2n.",
        "\u1EE8ng d\u1EE5ng Express s\u1EBD b\u1ECB s\u1EADp ho\xE0n to\xE0n do qu\xE1 t\u1EA3i h\xE0ng \u0111\u1EE3i ghi.",
        "Dung l\u01B0\u1EE3ng l\u01B0u tr\u1EEF c\u1EE7a t\xE0i kho\u1EA3n Google Drive Service Account b\u1ECB \u0111\u1EA7y v\u0129nh vi\u1EC5n."
      ], 1),
      q("Trong quy tr\xECnh ph\xE1t tri\u1EC3n ph\u1EA7n m\u1EC1m an to\xE0n, m\u1EE5c \u0111\xEDch ch\xEDnh c\u1EE7a vi\u1EC7c s\u1EED d\u1EE5ng c\xE1c truy v\u1EA5n c\xF3 tham s\u1ED1 (Parameterized Queries / Prepared Statements) l\xE0 \u0111\u1EC3 ng\u0103n ch\u1EB7n l\u1ED7 h\u1ED5ng n\xE0o?", [
        "Path Traversal nh\u1EA3y th\u01B0 m\u1EE5c h\u1EC7 th\u1ED1ng.",
        "SQL Injection ch\xE8n c\xE2u l\u1EC7nh truy v\u1EA5n d\u1EEF li\u1EC7u tr\xE1i ph\xE9p.",
        "Command Injection ch\xE8n l\u1EC7nh h\u1EC7 \u0111i\u1EC1u h\xE0nh ch\u1EA1y ng\u1EA7m.",
        "Brute Force d\xF2 qu\xE9t m\u1EADt kh\u1EA9u h\xE0ng lo\u1EA1t."
      ], 1),
      q('K\u1EBB t\u1EA5n c\xF4ng l\u1EE3i d\u1EE5ng t\xEDnh n\u0103ng hi\u1EC3n th\u1ECB file t\xE0i li\u1EC7u c\u1EE7a h\u1EC7 th\u1ED1ng, nh\u1EADp v\xE0o chu\u1ED7i truy c\u1EADp: "?file=../../../../src/config.js" nh\u1EB1m \u0111\xE1nh c\u1EAFp bi\u1EBFn m\xF4i tr\u01B0\u1EDDng SESSION_SECRET. Website \u0111ang d\xEDnh l\u1ED7 h\u1ED5ng g\xEC?', [
        "Broken Authentication",
        "Path Traversal (Duy\u1EC7t qua \u0111\u01B0\u1EDDng d\u1EABn t\u1EC7p tin tr\xE1i ph\xE9p)",
        "Command Injection",
        "SQL Injection"
      ], 1),
      q("Khi server Node.js nh\u1EADn \u0111\u01B0\u1EE3c t\xEDn hi\u1EC7u ng\u1EAFt h\u1EC7 th\u1ED1ng SIGTERM t\u1EEB n\u1EC1n t\u1EA3ng hosting Render, h\xE0m x\u1EED l\xFD n\xE0o b\u1EAFt bu\u1ED9c ph\u1EA3i \u0111\u01B0\u1EE3c g\u1ECDi ngay l\u1EADp t\u1EE9c \u0111\u1EC3 b\u1EA3o to\xE0n d\u1EEF li\u1EC7u thi?", [
        "H\xE0m x\xF3a b\u1ECF to\xE0n b\u1ED9 m\u1EADt kh\u1EA9u ng\u01B0\u1EDDi d\xF9ng \u0111\u1EC3 b\u1EA3o m\u1EADt.",
        "H\xE0m t\u1EF1 \u0111\u1ED9ng g\u1EEDi email th\xF4ng b\xE1o l\u1ED7i h\u1EC7 th\u1ED1ng cho qu\u1EA3n tr\u1ECB vi\xEAn.",
        "H\xE0m flush() \u0111\u1EC3 ghi to\xE0n b\u1ED9 d\u1EEF li\u1EC7u t\u1EEB RAM cache \u0111\u1ED3ng b\u1ED9 v\u0129nh vi\u1EC5n l\xEAn Google Drive.",
        "H\xE0m reset l\u1EA1i m\xE3 ID c\u1EE7a th\u01B0 m\u1EE5c Google Drive."
      ], 2),
      q("[T\u1EF0 LU\u1EACN NG\u1EAEN] B\u1EA1n h\xE3y tr\xECnh b\xE0y ng\u1EAFn g\u1ECDn \xFD ngh\u0129a c\u1EE7a vi\u1EC7c x\xE2y d\u1EF1ng kho d\u1EEF li\u1EC7u s\u1ED1 d\xF9ng chung \u0111\u1ED1i v\u1EDBi c\xF4ng t\xE1c qu\u1EA3n l\xFD h\xE0nh ch\xEDnh nh\xE0 n\u01B0\u1EDBc?", [
        "H\u01B0\u1EDBng d\u1EABn ch\u1EA5m: Th\xED sinh n\xEAu \u0111\u01B0\u1EE3c t\u1ED1i thi\u1EC3u 2 trong c\xE1c \xFD sau: \n1. T\u0103ng t\xEDnh li\xEAn th\xF4ng, chia s\u1EBB d\u1EEF li\u1EC7u gi\u1EEFa c\xE1c ph\xF2ng ban, \u0111\u01A1n v\u1ECB.\n2. Gi\u1EA3m thi\u1EC3u c\xE1c th\u1EE7 t\u1EE5c r\u01B0\u1EDDm r\xE0, h\u1EA1n ch\u1EBF vi\u1EC7c ng\u01B0\u1EDDi d\xE2n ph\u1EA3i n\u1ED9p nhi\u1EC1u b\u1EA3n gi\u1EA5y t\u1EDD tr\xF9ng l\u1EB7p.\n3. T\u1ED1i \u01B0u h\xF3a th\u1EDDi gian x\u1EED l\xFD v\xE0 n\xE2ng cao hi\u1EC7u qu\u1EA3 ra quy\u1EBFt \u0111\u1ECBnh qu\u1EA3n l\xFD."
      ], 0),
      q("[T\u1EF0 LU\u1EACN NG\u1EAEN] C\u01A1 ch\u1EBF x\xE1c th\u1EF1c hai l\u1EDBp (2FA/MFA) h\u1ED7 tr\u1EE3 b\u1EA3o v\u1EC7 t\xE0i kho\u1EA3n c\xF4ng v\u1EE5 c\u1EE7a c\xF4ng ch\u1EE9c nh\u01B0 th\u1EBF n\xE0o khi m\u1EADt kh\u1EA9u ch\xEDnh b\u1ECB hacker d\xF2 qu\xE9t \u0111\u01B0\u1EE3c?", [
        "H\u01B0\u1EDBng d\u1EABn ch\u1EA5m: Khi m\u1EADt kh\u1EA9u ch\xEDnh b\u1ECB l\u1ED9, 2FA y\xEAu c\u1EA7u th\xEAm m\u1ED9t y\u1EBFu t\u1ED1 x\xE1c th\u1EF1c th\u1EE9 hai (nh\u01B0 m\xE3 OTP g\u1EEDi v\u1EC1 \u0111i\u1EC7n tho\u1EA1i ho\u1EB7c \u1EE9ng d\u1EE5ng x\xE1c th\u1EF1c) m\xE0 ch\u1EC9 ng\u01B0\u1EDDi d\xF9ng th\u1EADt m\u1EDBi n\u1EAFm gi\u1EEF. Hacker n\u1EBFu kh\xF4ng c\xF3 thi\u1EBFt b\u1ECB v\u1EADt l\xFD n\xE0y th\xEC kh\xF4ng th\u1EC3 \u0111\u0103ng nh\u1EADp tr\xE1i ph\xE9p v\xE0o h\u1EC7 th\u1ED1ng."
      ], 0),
      q("[T\u1EF0 LU\u1EACN NG\u1EAEN] Vai tr\xF2 n\xF2ng c\u1ED1t c\u1EE7a l\u1EF1c l\u01B0\u1EE3ng thanh ni\xEAn v\xE0 T\u1ED5 c\xF4ng ngh\u1EC7 s\u1ED1 c\u1ED9ng \u0111\u1ED3ng t\u1EA1i c\xE1c khu ph\u1ED1, th\xF4n b\u1EA3n trong chi\u1EBFn d\u1ECBch B\xECnh d\xE2n h\u1ECDc v\u1EE5 s\u1ED1 l\xE0 g\xEC?", [
        "H\u01B0\u1EDBng d\u1EABn ch\u1EA5m: L\xE0 l\u1EF1c l\u01B0\u1EE3ng tr\u1EF1c ti\u1EBFp \u0111i t\u1EEBng ng\xF5, g\xF5 t\u1EEBng nh\xE0 \u0111\u1EC3 ph\u1ED5 c\u1EADp k\u1EF9 n\u0103ng s\u1ED1 cho ng\u01B0\u1EDDi d\xE2n; h\u01B0\u1EDBng d\u1EABn tr\u1EF1c ti\u1EBFp c\xE1ch c\xE0i \u0111\u1EB7t \u1EE9ng d\u1EE5ng \u0111\u1ECBnh danh VNeID, \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n d\u1ECBch v\u1EE5 c\xF4ng tr\u1EF1c tuy\u1EBFn v\xE0 th\u1EF1c hi\u1EC7n thanh to\xE1n kh\xF4ng d\xF9ng ti\u1EC1n m\u1EB7t t\u1EA1i \u0111\u1ECBa ph\u01B0\u01A1ng."
      ], 0),
      // ========================================================================
      // BỘ ĐỀ 4: BÌNH DÂN HỌC VỤ SỐ VÀ AN TOÀN THÔNG TIN ĐẠI CHÚNG
      // Thời gian làm bài: 35 phút | Số lượng: 50 câu (47 Trắc nghiệm + 3 Tự luận ngắn)
      // ========================================================================
      q("Th\u1EE7 \u0111o\u1EA1n l\u1EEBa \u0111\u1EA3o s\u1EED d\u1EE5ng c\xF4ng ngh\u1EC7 Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o \u0111\u1EC3 gi\u1EA3 m\u1EA1o h\xECnh \u1EA3nh, gi\u1ECDng n\xF3i c\u1EE7a ng\u01B0\u1EDDi th\xE2n nh\u1EB1m m\u1EE5c \u0111\xEDch vay ti\u1EC1n g\u1EA5p c\xF3 t\xEAn g\u1ECDi l\xE0 g\xEC?", [
        "Phishing Email",
        "AI Deepfake l\u1EEBa \u0111\u1EA3o \u0111\u1EA1i ch\xFAng",
        "T\u1EA5n c\xF4ng DDoS h\u1EC7 th\u1ED1ng",
        "M\xE3 \u0111\u1ED9c t\u1ED1ng ti\u1EC1n Ransomware"
      ], 1),
      q("Khi nh\u1EADn \u0111\u01B0\u1EE3c tin nh\u1EAFn th\u01B0\u01A1ng hi\u1EC7u (SMS Brandname) gi\u1EA3 m\u1EA1o Ng\xE2n h\xE0ng th\xF4ng b\xE1o t\xE0i kho\u1EA3n b\u1ECB kh\xF3a v\xE0 y\xEAu c\u1EA7u truy c\u1EADp link l\u1EA1 \u0111\u1EC3 m\u1EDF l\u1EA1i, ng\u01B0\u1EDDi d\xE2n c\u1EA7n l\xE0m g\xEC?", [
        "B\u1EA5m ngay v\xE0o \u0111\u01B0\u1EDDng link \u0111\u1EC3 th\u1EF1c hi\u1EC7n theo h\u01B0\u1EDBng d\u1EABn b\u1EA3o m\u1EADt.",
        "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng b\u1EA5m v\xE0o link, g\u1ECDi l\xEAn t\u1ED5ng \u0111\xE0i ch\xEDnh th\u1EE9c c\u1EE7a Ng\xE2n h\xE0ng \u0111\u1EC3 x\xE1c minh ho\u1EB7c b\xE1o c\u01A1 quan C\xF4ng an.",
        "G\u1EEDi tin nh\u1EAFn ch\u1EE9a th\xF4ng tin s\u1ED1 th\u1EBB v\xE0 m\xE3 PIN \u0111\u1EC3 h\u1EC7 th\u1ED1ng t\u1EF1 x\u1EED l\xFD.",
        "Chuy\u1EC3n ti\u1EBFp tin nh\u1EAFn \u0111\xF3 cho nhi\u1EC1u ng\u01B0\u1EDDi trong danh b\u1EA1 c\xF9ng x\u1EED l\xFD."
      ], 1),
      q("\u0110\u1EC3 b\u1EA3o v\u1EC7 th\xF4ng tin c\xE1 nh\xE2n khi t\u01B0\u01A1ng t\xE1c tr\xEAn m\xF4i tr\u01B0\u1EDDng m\u1EA1ng x\xE3 h\u1ED9i, h\xE0nh vi n\xE0o sau \u0111\xE2y \u0111\u01B0\u1EE3c khuy\u1EBFn ngh\u1ECB?", [
        "C\xF4ng khai s\u1ED1 \u0111i\u1EC7n tho\u1EA1i, ng\xE0y sinh v\xE0 s\u1ED1 CCCD l\xEAn ph\u1EA7n m\xF4 t\u1EA3 th\xF4ng tin c\xE1 nh\xE2n.",
        "Ki\u1EC3m tra k\u1EF9 quy\u1EC1n truy c\u1EADp c\u1EE7a \u1EE9ng d\u1EE5ng v\xE0 ch\u1EC9 chia s\u1EBB th\xF4ng tin th\u1EF1c s\u1EF1 thi\u1EBFt y\u1EBFu.",
        "C\xE0i \u0111\u1EB7t c\xE1c \u1EE9ng d\u1EE5ng kh\xF4ng r\xF5 ngu\u1ED3n g\u1ED1c t\u1EEB c\xE1c li\xEAn k\u1EBFt l\u1EA1 ho\u1EB7c file \u0111u\xF4i .APK.",
        "S\u1EED d\u1EE5ng chung m\u1ED9t m\u1EADt kh\u1EA9u \u0111\u01A1n gi\u1EA3n cho t\u1EA5t c\u1EA3 t\xE0i kho\u1EA3n tr\u1EF1c tuy\u1EBFn c\u1EE7a m\xECnh."
      ], 1),
      q("Khi k\u1EBFt n\u1ED1i v\xE0o m\u1EA1ng WiFi c\xF4ng c\u1ED9ng kh\xF4ng c\xF3 m\u1EADt kh\u1EA9u (nh\u01B0 t\u1EA1i qu\xE1n c\xE0 ph\xEA, qu\u1EA3ng tr\u01B0\u1EDDng), r\u1EE7i ro l\u1EDBn nh\u1EA5t v\u1EC1 an to\xE0n th\xF4ng tin l\xE0 g\xEC?", [
        "Thi\u1EBFt b\u1ECB di \u0111\u1ED9ng c\u1EE7a ng\u01B0\u1EDDi d\xF9ng b\u1ECB s\u1EE5t dung l\u01B0\u1EE3ng pin nhanh h\u01A1n.",
        "H\u1EC7 \u0111i\u1EC1u h\xE0nh c\u1EE7a m\xE1y t\u1EF1 \u0111\u1ED9ng x\xF3a b\u1ECF to\xE0n b\u1ED9 danh b\u1EA1 \u0111i\u1EC7n tho\u1EA1i.",
        "K\u1EBB x\u1EA5u c\xF3 th\u1EC3 ch\u1EB7n b\u1EAFt v\xE0 \u0111\u1ECDc tr\u1ED9m c\xE1c g\xF3i tin truy\u1EC1n qua m\u1EA1ng (nh\u01B0 m\u1EADt kh\u1EA9u, t\xE0i kho\u1EA3n ng\xE2n h\xE0ng kh\xF4ng m\xE3 h\xF3a).",
        "T\u1ED1c \u0111\u1ED9 t\u1EA3i video c\u1EE7a thi\u1EBFt b\u1ECB b\u1ECB gi\u1EA3m \u0111i \u0111\xE1ng k\u1EC3."
      ], 2),
      q('M\u1ED9t ph\u1EA7n m\u1EC1m \u0111\u1ED9c h\u1EA1i ph\xE1t t\xE1n ng\u1EA7m d\u01B0\u1EDBi d\u1EA1ng \u1EE9ng d\u1EE5ng m\xE3 ngu\u1ED3n m\u1EDF t\xEAn l\xE0 "OpenClaw" c\xF3 h\xE0nh vi nguy hi\u1EC3m n\xE0o sau \u0111\xE2y?', [
        "\u0110\xE1nh c\u1EAFp th\xF4ng tin v\xED ti\u1EC1n \u0111i\u1EC7n t\u1EED v\xE0 d\u1EEF li\u1EC7u l\u01B0u trong tr\xECnh qu\u1EA3n l\xFD m\u1EADt kh\u1EA9u c\u1EE7a n\u1EA1n nh\xE2n.",
        "T\u1EF1 \u0111\u1ED9ng t\u1ED1i \u01B0u h\xF3a v\xE0 d\u1ECDn d\u1EB9p c\xE1c t\u1EC7p tin r\xE1c c\u1EE7a h\u1EC7 \u0111i\u1EC1u h\xE0nh.",
        "T\u1EA1o ra c\xE1c ch\u1EE9ng ch\u1EC9 b\u1EA3o m\u1EADt SSL mi\u1EC5n ph\xED c\u1EA5p cho trang web d\u1ECBch v\u1EE5 c\xF4ng.",
        "Ng\u1EAFt k\u1EBFt n\u1ED1i m\u1EA1ng WiFi c\u1EE7a c\xE1c m\xE1y t\xEDnh xung quanh khu v\u1EF1c."
      ], 0),
      q("C\u01A1 ch\u1EBF x\xE1c th\u1EF1c 2 l\u1EDBp (2FA/MFA) gi\xFAp b\u1EA3o v\u1EC7 an to\xE0n t\xE0i kho\u1EA3n s\u1ED1 c\u1EE7a ng\u01B0\u1EDDi d\xE2n d\u1EF1a tr\xEAn nguy\xEAn l\xFD c\u1ED1t l\xF5i n\xE0o?", [
        "K\u1EBFt h\u1EE3p gi\u1EEFa c\xE1i ng\u01B0\u1EDDi d\xF9ng bi\u1EBFt (m\u1EADt kh\u1EA9u) v\xE0 c\xE1i ng\u01B0\u1EDDi d\xF9ng c\xF3/n\u1EAFm gi\u1EEF (m\xE3 OTP thi\u1EBFt b\u1ECB v\u1EADt l\xFD ho\u1EB7c \u1EE9ng d\u1EE5ng x\xE1c th\u1EF1c).",
        "Y\xEAu c\u1EA7u ng\u01B0\u1EDDi d\xF9ng ph\u1EA3i nh\u1EADp m\u1EADt kh\u1EA9u ch\xEDnh x\xE1c hai l\u1EA7n li\xEAn ti\u1EBFp khi \u0111\u0103ng nh\u1EADp.",
        "T\u1EF1 \u0111\u1ED9ng thay \u0111\u1ED5i t\xEAn hi\u1EC3n th\u1ECB c\u1EE7a t\xE0i kho\u1EA3n sau m\u1ED7i 12 gi\u1EDD.",
        "Ch\u1EB7n t\u1EA5t c\u1EA3 c\xE1c \u0111\u1ECBa ch\u1EC9 IP truy c\u1EADp t\u1EEB b\xEAn ngo\xE0i khu v\u1EF1c t\u1EC9nh th\xE0nh."
      ], 0),
      q("D\u1EA5u hi\u1EC7u n\xE0o sau \u0111\xE2y c\u1EA3nh b\xE1o r\xF5 r\xE0ng nh\u1EA5t vi\u1EC7c m\u1ED9t chi\u1EBFc \u0111i\u1EC7n tho\u1EA1i th\xF4ng minh \u0111\xE3 b\u1ECB d\xEDnh m\xE3 \u0111\u1ED9c chi\u1EBFm quy\u1EC1n \u0111i\u1EC1u khi\u1EC3n t\u1EEB xa?", [
        "Thi\u1EBFt b\u1ECB t\u1EF1 \u0111\u1ED9ng m\u1EDF \u1EE9ng d\u1EE5ng, m\xE0n h\xECnh t\u1EF1 s\xE1ng v\xE0o ban \u0111\xEAm, t\xE0i kho\u1EA3n ng\xE2n h\xE0ng s\u1ED1 t\u1EF1 th\u1EF1c hi\u1EC7n l\u1EC7nh chuy\u1EC3n ti\u1EC1n d\xF9 kh\xF4ng thao t\xE1c.",
        "\u0110i\u1EC7n tho\u1EA1i hi\u1EC3n th\u1ECB th\xF4ng b\xE1o y\xEAu c\u1EA7u c\u1EAFm s\u1EA1c khi dung l\u01B0\u1EE3ng pin xu\u1ED1ng d\u01B0\u1EDBi 20%.",
        "Th\u1EDDi gian t\u1EA3i trang web ch\u1EADm h\u01A1n b\xECnh th\u01B0\u1EDDng kho\u1EA3ng 2 gi\xE2y do s\xF3ng y\u1EBFu.",
        "\u1EE8ng d\u1EE5ng camera t\u1EF1 \u0111\u1ED9ng t\u1EAFt khi ng\u01B0\u1EDDi d\xF9ng chuy\u1EC3n sang ch\u1EBF \u0111\u1ED9 ch\u1EE5p \u0111\xEAm."
      ], 0),
      q("Khi thi\u1EBFt l\u1EADp m\u1EADt kh\u1EA9u cho t\xE0i kho\u1EA3n s\u1ED1 c\xE1 nh\xE2n, c\u1EE5m t\u1EEB n\xE0o sau \u0111\xE2y \u0111\u01B0\u1EE3c \u0111\xE1nh gi\xE1 l\xE0 m\u1EA1nh v\xE0 an to\xE0n nh\u1EA5t tr\u01B0\u1EDBc c\xE1c cu\u1ED9c t\u1EA5n c\xF4ng d\xF2 qu\xE9t?", [
        "admin123456",
        "vksnddanang2026",
        "Kh0nG_S0_M4_D0c_!@#",
        "13102026"
      ], 2),
      q('M\u1EE5c \u0111\xEDch ch\xEDnh c\u1EE7a chi\u1EBFn d\u1ECBch "B\xECnh d\xE2n h\u1ECDc v\u1EE5 s\u1ED1" \u0111\u01B0\u1EE3c tri\u1EC3n khai r\u1ED9ng r\xE3i t\u1EA1i c\xE1c \u0111\u1ECBa ph\u01B0\u01A1ng hi\u1EC7n nay l\xE0 g\xEC?', [
        "Ph\u1ED5 c\u1EADp c\xE1c k\u1EF9 n\u0103ng s\u1ED1 c\u01A1 b\u1EA3n, n\xE2ng cao nh\u1EADn th\u1EE9c an to\xE0n th\xF4ng tin v\xE0 x\xF3a m\xF9 c\xF4ng ngh\u1EC7 cho m\u1ECDi t\u1EA7ng l\u1EDBp nh\xE2n d\xE2n.",
        "\u0110\xE0o t\u1EA1o chuy\xEAn s\xE2u c\xE1c k\u1EF9 s\u01B0 c\xF4ng ngh\u1EC7 th\xF4ng tin tr\xECnh \u0111\u1ED9 cao.",
        "B\xE1n c\xE1c ph\u1EA7n m\u1EC1m di\u1EC7t virus c\xF3 b\u1EA3n quy\u1EC1n th\u01B0\u01A1ng m\u1EA1i cho ng\u01B0\u1EDDi d\xE2n.",
        "Thay th\u1EBF to\xE0n b\u1ED9 c\xE1c th\u1EE7 t\u1EE5c h\xE0nh ch\xEDnh tr\u1EF1c ti\u1EBFp b\u1EB1ng robot t\u1EF1 \u0111\u1ED9ng."
      ], 0),
      q("Khi chia s\u1EBB th\xF4ng tin tr\xEAn m\xF4i tr\u01B0\u1EDDng s\u1ED1, vi\u1EC7c ch\u1EE5p \u1EA3nh v\xE0 \u0111\u0103ng t\u1EA3i r\xF5 n\xE9t C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n (CCCD) l\xEAn m\u1EA1ng x\xE3 h\u1ED9i c\xF3 th\u1EC3 d\u1EABn \u0111\u1EBFn h\u1EADu qu\u1EA3 g\xEC?", [
        "T\u1ED9i ph\u1EA1m c\xF4ng ngh\u1EC7 cao l\u1EE3i d\u1EE5ng h\xECnh \u1EA3nh \u0111\xF3 \u0111\u1EC3 \u0111\u0103ng k\xFD vay ti\u1EC1n app tr\u1EF1c tuy\u1EBFn, m\u1EDF t\xE0i kho\u1EA3n ng\xE2n h\xE0ng r\xE1c ho\u1EB7c l\u1EEBa \u0111\u1EA3o chi\u1EBFm \u0111o\u1EA1t t\xE0i s\u1EA3n.",
        "T\xE0i kho\u1EA3n m\u1EA1ng x\xE3 h\u1ED9i c\u1EE7a b\u1EA1n s\u1EBD nh\u1EADn \u0111\u01B0\u1EE3c nhi\u1EC1u t\u01B0\u01A1ng t\xE1c h\u01A1n.",
        "H\u1EC7 th\u1ED1ng VNeID s\u1EBD t\u1EF1 \u0111\u1ED9ng n\xE2ng c\u1EA5p t\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n l\xEAn m\u1EE9c \u0111\u1ED9 2.",
        "L\xE0m t\u0103ng b\u0103ng th\xF4ng truy\u1EC1n t\u1EA3i d\u1EEF li\u1EC7u c\u1EE7a m\u1EA1ng vi\u1EC5n th\xF4ng \u0111\u1ECBa ph\u01B0\u01A1ng."
      ], 0),
      q("\u0110\u1EC3 nh\u1EADn bi\u1EBFt m\u1ED9t trang web c\xF3 nguy c\u01A1 cao l\xE0 gi\u1EA3 m\u1EA1o (Phishing page) nh\u1EB1m \u0111\xE1nh c\u1EAFp th\xF4ng tin, y\u1EBFu t\u1ED1 n\xE0o d\u01B0\u1EDBi \u0111\xE2y l\xE0 quan tr\u1ECDng nh\u1EA5t c\u1EA7n ki\u1EC3m tra?", [
        "T\xEAn mi\u1EC1n (Domain) tr\xEAn thanh \u0111\u1ECBa ch\u1EC9 b\u1ECB sai l\u1ED7i ch\xEDnh t\u1EA3, sai \u0111u\xF4i m\u1EDF r\u1ED9ng (v\xED d\u1EE5: vksnd.gov.vn b\u1ECB \u0111\u1ED5i th\xE0nh vksnd-gov.com ho\u1EB7c vks-danang.net).",
        "M\xE0u s\u1EAFc giao di\u1EC7n c\u1EE7a trang web \u0111\u1EADm hay nh\u1EA1t h\u01A1n b\xECnh th\u01B0\u1EDDng.",
        "Trang web kh\xF4ng c\xF3 c\xE1c hi\u1EC7u \u1EE9ng chuy\u1EC3n \u0111\u1ED9ng ho\u1EB7c kh\xF4ng c\xF3 video gi\u1EDBi thi\u1EC7u.",
        "S\u1ED1 l\u01B0\u1EE3ng b\xE0i vi\u1EBFt hi\u1EC3n th\u1ECB tr\xEAn trang ch\u1EE7 \xEDt h\u01A1n 10 b\xE0i."
      ], 0),
      q("H\xE0nh vi n\xE0o sau \u0111\xE2y th\u1EC3 hi\u1EC7n k\u1EF9 n\u0103ng s\u1ED1 v\u0103n minh v\xE0 an to\xE0n khi tham gia c\xE1c h\u1ED9i nh\xF3m c\xF4ng c\u1ED9ng tr\xEAn m\xF4i tr\u01B0\u1EDDng m\u1EA1ng?", [
        "Chia s\u1EBB ngay c\xE1c tin t\u1EE9c gi\u1EADt g\xE2n, ch\u01B0a \u0111\u01B0\u1EE3c ki\u1EC3m ch\u1EE9ng t\u1EEB c\xE1c ngu\u1ED3n tin l\u1EA1.",
        "S\u1EED d\u1EE5ng t\xE0i kho\u1EA3n \u1EA3o \u0111\u1EC3 c\xF4ng k\xEDch, n\xF3i x\u1EA5u c\xE1c c\u01A1 quan, t\u1ED5 ch\u1EE9c nh\xE0 n\u01B0\u1EDBc.",
        "Kh\xF4ng l\u0103ng m\u1EA1, x\xFAc ph\u1EA1m ng\u01B0\u1EDDi kh\xE1c; kh\xF4ng ph\xE1t t\xE1n th\xF4ng tin \u0111\u1ED9c h\u1EA1i v\xE0 ch\u1EE7 \u0111\u1ED9ng x\xE1c minh t\xEDnh x\xE1c th\u1EF1c c\u1EE7a tin t\u1EE9c tr\u01B0\u1EDBc khi chia s\u1EBB.",
        "T\u1EF1 \xFD thu th\u1EADp v\xE0 c\xF4ng khai s\u1ED1 \u0111i\u1EC7n tho\u1EA1i, th\xF4ng tin gia \u0111\xECnh c\u1EE7a ng\u01B0\u1EDDi kh\xE1c l\xEAn m\u1EA1ng."
      ], 2),
      q("\u1EE8ng d\u1EE5ng di \u0111\u1ED9ng ch\xEDnh th\u1ED1ng n\xE0o d\u01B0\u1EDBi \u0111\xE2y do B\u1ED9 C\xF4ng an ph\xE1t tri\u1EC3n nh\u1EB1m ph\u1EE5c v\u1EE5 \u0111\u1ECBnh danh, x\xE1c th\u1EF1c \u0111i\u1EC7n t\u1EED v\xE0 d\u1ECBch v\u1EE5 c\xF4ng cho c\xF4ng d\xE2n Vi\u1EC7t Nam?", [
        "Zalo",
        "VssID",
        "eTax Mobile",
        "VNeID"
      ], 3),
      q("Khi ng\u01B0\u1EDDi d\xE2n nh\u1EADn \u0111\u01B0\u1EE3c cu\u1ED9c g\u1ECDi t\u1EEB s\u1ED1 l\u1EA1 t\u1EF1 x\u01B0ng l\xE0 c\xE1n b\u1ED9 Vi\u1EC7n ki\u1EC3m s\xE1t ho\u1EB7c C\xF4ng an \u0111e d\u1ECDa li\xEAn quan \u0111\u1EBFn \u0111\u01B0\u1EDDng d\xE2y t\u1ED9i ph\u1EA1m v\xE0 y\xEAu c\u1EA7u chuy\u1EC3n ti\u1EC1n v\xE0o t\xE0i kho\u1EA3n t\u1EA1m gi\u1EEF, h\xE0nh vi \u1EE9ng x\u1EED \u0111\xFAng nh\u1EA5t l\xE0 g\xEC?", [
        "Ho\u1EA3ng s\u1EE3 v\xE0 ra ngay ng\xE2n h\xE0ng r\xFAt to\xE0n b\u1ED9 ti\u1EC1n ti\u1EBFt ki\u1EC7m chuy\u1EC3n theo y\xEAu c\u1EA7u.",
        "Tuy\u1EC7t \u0111\u1ED1i kh\xF4ng cung c\u1EA5p th\xF4ng tin c\xE1 nh\xE2n, kh\xF4ng chuy\u1EC3n ti\u1EC1n, t\u1EAFt m\xE1y v\xE0 b\xE1o ngay cho c\u01A1 quan ch\u1EE9c n\u0103ng ho\u1EB7c C\xF4ng an n\u01A1i g\u1EA7n nh\u1EA5t.",
        "Cung c\u1EA5p to\xE0n b\u1ED9 m\u1EADt kh\u1EA9u \u1EE9ng d\u1EE5ng ng\xE2n h\xE0ng s\u1ED1 \u0111\u1EC3 c\xE1n b\u1ED9 t\u1EF1 ki\u1EC3m tra.",
        "R\u1EE7 th\xEAm ng\u01B0\u1EDDi th\xE2n c\xF9ng n\u1ED9p ti\u1EC1n \u0111\u1EC3 c\xF9ng ch\u1EE9ng minh s\u1EF1 trong s\u1EA1ch."
      ], 1),
      q("T\u1EA1i sao vi\u1EC7c c\xE0i \u0111\u1EB7t c\xE1c \u1EE9ng d\u1EE5ng b\u1EBB kh\xF3a (Crack), ph\u1EA7n m\u1EC1m l\u1EADu tr\xEAn m\xE1y t\xEDnh c\xE1 nh\xE2n l\u1EA1i c\xF3 nguy c\u01A1 g\xE2y m\u1EA5t an to\xE0n th\xF4ng tin r\u1EA5t cao?", [
        "L\xE0m m\xE1y t\xEDnh ch\u1EA1y t\u1ED1n nhi\u1EC1u \u0111i\u1EC7n n\u0103ng h\u01A1n b\xECnh th\u01B0\u1EDDng.",
        "C\xE1c file b\u1EBB kh\xF3a th\u01B0\u1EDDng b\u1ECB k\u1EBB x\u1EA5u ch\xE8n s\u1EB5n m\xE3 \u0111\u1ED9c ch\u1EA1y ng\u1EA7m (Trojan, Keylogger) \u0111\u1EC3 thu th\u1EADp m\u1EADt kh\u1EA9u v\xE0 chi\u1EBFm quy\u1EC1n \u0111i\u1EC1u khi\u1EC3n m\xE1y.",
        "H\u1EC7 \u0111i\u1EC1u h\xE0nh s\u1EBD t\u1EF1 \u0111\u1ED9ng x\xF3a b\u1ECF to\xE0n b\u1ED9 c\xE1c b\u1ED9 c\xE0i Microsoft Office.",
        "Tr\xECnh duy\u1EC7t web kh\xF4ng th\u1EC3 truy c\u1EADp \u0111\u01B0\u1EE3c v\xE0o c\xE1c trang m\u1EA1ng x\xE3 h\u1ED9i."
      ], 1),
      q('Khi thi\u1EBFt l\u1EADp h\u1EC7 th\u1ED1ng Web, m\u1ED9t l\u1ED7 h\u1ED5ng xu\u1EA5t hi\u1EC7n n\u1EBFu l\u1EADp tr\xECnh vi\xEAn d\xF9ng th\u01B0 vi\u1EC7n x\xE1c th\u1EF1c nh\u01B0ng l\u1EA1i g\u1ECDi h\xE0m "jwt.decode()" m\xE0 kh\xF4ng verify ch\u1EEF k\xFD. Nguy c\u01A1 n\xE0o x\u1EA3y ra?', [
        "H\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng x\xF3a d\u1EEF li\u1EC7u t\u1EC7p ph\u1EB3ng l\u01B0u tr\xEAn RAM cache.",
        "K\u1EBB t\u1EA5n c\xF4ng c\xF3 th\u1EC3 t\u1EF1 t\u1EA1o ra m\u1ED9t token gi\u1EA3 v\u1EDBi quy\u1EC1n Admin \u0111\u1EC3 \u0111\u0103ng nh\u1EADp tr\xE1i ph\xE9p m\xE0 h\u1EC7 th\u1ED1ng v\u1EABn ch\u1EA5p nh\u1EADn.",
        "Tr\xECnh duy\u1EC7t c\u1EE7a ng\u01B0\u1EDDi d\xF9ng s\u1EBD t\u1EF1 \u0111\u1ED9ng ch\u1EB7n to\xE0n b\u1ED9 y\xEAu c\u1EA7u HTTP.",
        "L\u01B0\u1EE3t thi c\u1EE7a th\xED sinh s\u1EBD t\u1EF1 \u0111\u1ED9ng \u0111\u01B0\u1EE3c c\u1ED9ng th\xEAm th\u1EDDi gian l\xE0m b\xE0i."
      ], 1),
      q('Trong k\u1ECBch b\u1EA3n di\u1EC5n t\u1EADp an to\xE0n th\xF4ng tin ph\xF2ng th\u1EE7 chu\u1ED7i th\u1EED th\xE1ch Natas, l\u1ED7i c\u1EA5u h\xECnh file "robots.txt" th\u01B0\u1EDDng b\u1ECB l\u1EE3i d\u1EE5ng \u0111\u1EC3 l\xE0m g\xEC?', [
        "T\u1EA5n c\xF4ng t\u1EEB ch\u1ED1i d\u1ECBch v\u1EE5 l\xE0m s\u1EADp ho\xE0n to\xE0n m\xE1y ch\u1EE7 Express.",
        "Thay \u0111\u1ED5i thu\u1EADt to\xE1n b\u0103m m\u1EADt kh\u1EA9u t\u1EEB scrypt sang MD5 th\xF4.",
        "T\u1EF1 \u0111\u1ED9ng ph\xE2n quy\u1EC1n Editor th\u01B0 m\u1EE5c Drive cho Service Account.",
        "K\u1EBB t\u1EA5n c\xF4ng \u0111\u1ECDc n\u1ED9i dung file \u0111\u1EC3 t\xECm ra c\xE1c th\u01B0 m\u1EE5c \u1EA9n, \u0111\u01B0\u1EDDng d\u1EABn nh\u1EA1y c\u1EA3m m\xE0 qu\u1EA3n tr\u1ECB vi\xEAn c\u1ED1 t\xECnh gi\u1EA5u kh\xF4ng cho b\u1ED9 m\xE1y t\xECm ki\u1EBFm qu\xE9t d\u1EEF li\u1EC7u."
      ], 3),
      q("Khi x\xE2y d\u1EF1ng ch\u1EE9c n\u0103ng t\u1EA3i file l\xEAn m\xE1y ch\u1EE7 (File Upload), n\u1EBFu l\u1EADp tr\xECnh vi\xEAn ch\u1EC9 ki\u1EC3m tra \u0111u\xF4i file b\u1EB1ng JavaScript \u1EDF Frontend th\xEC k\u1EBB t\u1EA5n c\xF4ng v\u01B0\u1EE3t qua b\u1EB1ng c\xE1ch n\xE0o?", [
        "T\u1EA5n c\xF4ng Brute Force b\u1EBB kh\xF3a m\u1EADt kh\u1EA9u t\xE0i kho\u1EA3n Admin.",
        "Thay \u0111\u1ED5i m\xE3 ID th\u01B0 m\u1EE5c Google Drive l\u01B0u tr\u1EEF h\u1EC7 th\u1ED1ng.",
        "S\u1EED d\u1EE5ng thu\u1EADt to\xE1n m\xE3 h\xF3a \u0111\u1ED1i x\u1EE9ng AES \u0111\u1EC3 m\xE3 h\xF3a file \u0111\u1ED9c h\u1EA1i.",
        "S\u1EED d\u1EE5ng c\xF4ng c\u1EE5 ch\u1EB7n b\u1EAFt nh\u01B0 Burp Suite \u0111\u1EC3 s\u1EEDa \u0111\u1ED5i \u0111u\xF4i file tr\u1EF1c ti\u1EBFp tr\xEAn \u0111\u01B0\u1EDDng truy\u1EC1n HTTP request sau khi \u0111\xE3 v\u01B0\u1EE3t qua b\u1ED9 l\u1ECDc Frontend."
      ], 3),
      q("L\u1ED7 h\u1ED5ng b\u1EA3o m\u1EADt n\xE0o cho ph\xE9p k\u1EBB t\u1EA5n c\xF4ng ch\xE8n chu\u1ED7i k\xFD t\u1EF1 ch\u1EE9a l\u1EC7nh h\u1EC7 \u0111i\u1EC1u h\xE0nh (v\xED d\u1EE5 d\u1EA5u ch\u1EA5m ph\u1EA9y v\xE0 l\u1EC7nh h\u1EC7 th\u1ED1ng) v\xE0o \xF4 nh\u1EADp li\u1EC7u \u0111\u1EC3 \xE9p m\xE1y ch\u1EE7 th\u1EF1c thi m\xE3 \u0111\u1ED9c?", [
        "SQL Injection",
        "Path Traversal",
        "Cookie Tampering",
        "Command Injection"
      ], 3),
      q("Bi\u1EC7n ph\xE1p ph\xF2ng th\u1EE7 n\xE0o d\u01B0\u1EDBi \u0111\xE2y gi\xFAp ng\u0103n ch\u1EB7n tri\u1EC7t \u0111\u1EC3 l\u1ED7 h\u1ED5ng Path Traversal khi h\u1EC7 th\u1ED1ng th\u1EF1c hi\u1EC7n \u0111\u1ECDc ghi file d\u1EF1a tr\xEAn tham s\u1ED1 ng\u01B0\u1EDDi d\xF9ng nh\u1EADp v\xE0o?", [
        "Chuy\u1EC3n to\xE0n b\u1ED9 h\u1EC7 th\u1ED1ng sang s\u1EED d\u1EE5ng giao th\u1EE9c b\u1EA3o m\u1EADt HTTPS.",
        "M\xE3 h\xF3a to\xE0n b\u1ED9 n\u1ED9i dung file l\u01B0u tr\xEAn \u1ED5 c\u1EE9ng b\u1EB1ng thu\u1EADt to\xE1n b\u0103m SHA-256.",
        "\u0110\u1EB7t th\u1EDDi h\u1EA1n hi\u1EC7u l\u1EF1c c\u1EE7a m\xE3 token phi\xEAn l\xE0m vi\u1EC7c xu\u1ED1ng c\xF2n 15 ph\xFAt.",
        'L\u1ECDc s\u1EA1ch v\xE0 ch\u1EB7n to\xE0n b\u1ED9 c\xE1c chu\u1ED7i k\xFD t\u1EF1 \u0111i\u1EC1u h\u01B0\u1EDBng nh\u1EA3y th\u01B0 m\u1EE5c nguy hi\u1EC3m nh\u01B0 "../" ho\u1EB7c "..".'
      ], 3),
      q("K\u1EF9 thu\u1EADt t\u1EA5n c\xF4ng ch\xE8n c\xE2u l\u1EC7nh truy v\u1EA5n d\u1EEF li\u1EC7u tr\xE1i ph\xE9p v\xE0o c\xE1c \xF4 nh\u1EADp li\u1EC7u nh\u1EB1m b\u1EBB kh\xF3a logic x\xE1c th\u1EF1c \u0111\u0103ng nh\u1EADp m\xE0 kh\xF4ng c\u1EA7n bi\u1EBFt m\u1EADt kh\u1EA9u th\u1EADt c\xF3 t\xEAn g\u1ECDi l\xE0 g\xEC?", [
        "Command Injection",
        "Path Traversal",
        "Brute Force Attack",
        "SQL Injection"
      ], 3),
      q("\u0110\u1EC3 b\u1EA3o v\u1EC7 th\u01B0 m\u1EE5c m\xE1y ch\u1EE7 kh\u1ECFi m\xE3 \u0111\u1ED9c PHP \u0111\u1ED9i l\u1ED1t file \u1EA3nh, k\u1EF9 thu\u1EADt \u0111\u1ECDc c\xE1c byte \u0111\u1EB7c tr\u01B0ng nh\u1EADn di\u1EC7n \u0111\u1ECBnh d\u1EA1ng th\u1EF1c t\u1EBF \u1EDF \u0111\u1EA7u file \u0111\u01B0\u1EE3c g\u1ECDi l\xE0 g\xEC?", [
        "Ki\u1EC3m tra Mime-Type",
        "Ki\u1EC3m tra File Extension",
        "Ki\u1EC3m tra File Size",
        "Ki\u1EC3m tra Magic Bytes (v\xED d\u1EE5 ki\u1EC3m tra chu\u1ED7i GIF8; \u1EDF \u0111\u1EA7u file)"
      ], 3),
      q('Khi c\u1EA5u h\xECnh file "render.yaml" \u0111\u1EC3 tri\u1EC3n khai \u1EE9ng d\u1EE5ng 1-click l\xEAn hosting Render, bi\u1EBFn m\xF4i tr\u01B0\u1EDDng n\xE0o b\u1EAFt bu\u1ED9c ph\u1EA3i ch\u1EE9a chu\u1ED7i Base64 c\u1EE7a file key d\u1ECBch v\u1EE5 \u0111\xE1m m\xE2y?', [
        "SESSION_SECRET",
        "GOOGLE_DRIVE_FOLDER_ID",
        "ADMIN_CCCDS",
        "GOOGLE_SERVICE_ACCOUNT_JSON"
      ], 3),
      q("Khi ng\u01B0\u1EDDi d\xE2n th\u1EF1c hi\u1EC7n thanh to\xE1n h\xF3a \u0111\u01A1n b\u1EB1ng m\xE3 QR tr\xEAn \u1EE9ng d\u1EE5ng Ng\xE2n h\xE0ng s\u1ED1, h\xE0nh vi n\xE0o sau \u0111\xE2y c\u1EA7n l\xE0m \u0111\u1EC3 \u0111\u1EA3m b\u1EA3o kh\xF4ng b\u1ECB chuy\u1EC3n nh\u1EA7m ti\u1EC1n cho k\u1EBB l\u1EEBa \u0111\u1EA3o?", [
        "B\u1EA5m x\xE1c nh\u1EADn chuy\u1EC3n ti\u1EC1n ngay l\u1EADp t\u1EE9c sau khi qu\xE9t m\xE3 xong.",
        "Lu\xF4n ki\u1EC3m tra k\u1EF9 t\xEAn ch\u1EE7 t\xE0i kho\u1EA3n nh\u1EADn v\xE0 s\u1ED1 ti\u1EC1n hi\u1EC3n th\u1ECB tr\xEAn \u1EE9ng d\u1EE5ng c\xF3 tr\xF9ng kh\u1EDBp v\u1EDBi th\xF4ng tin \u0111\u01A1n v\u1ECB cung c\u1EA5p d\u1ECBch v\u1EE5 hay kh\xF4ng.",
        "Ch\u1EE5p \u1EA3nh m\xE0n h\xECnh m\xE3 QR \u0111\u0103ng t\u1EA3i c\xF4ng khai l\xEAn c\xE1c di\u1EC5n \u0111\xE0n m\u1EA1ng x\xE3 h\u1ED9i.",
        "Nh\u1EDD ng\u01B0\u1EDDi l\u1EA1 xung quanh b\u1EA5m h\u1ED9 m\xE3 PIN x\xE1c th\u1EF1c giao d\u1ECBch t\xE0i ch\xEDnh."
      ], 1),
      q("H\xECnh th\u1EE9c t\u1EA5n c\xF4ng g\u1EEDi h\xE0ng lo\u1EA1t y\xEAu c\u1EA7u truy c\u1EADp d\u1ED3n d\u1EADp t\u1EEB nhi\u1EC1u ngu\u1ED3n kh\xE1c nhau nh\u1EB1m l\xE0m t\xEA li\u1EC7t, ngh\u1EBDn b\u0103ng th\xF4ng v\xE0 g\xE2y s\u1EADp website d\u1ECBch v\u1EE5 c\xF4ng g\u1ECDi l\xE0 g\xEC?", [
        "Phishing",
        "SQL Injection",
        "T\u1EA5n c\xF4ng t\u1EEB ch\u1ED1i d\u1ECBch v\u1EE5 ph\xE2n t\xE1n (DDoS)",
        "Path Traversal"
      ], 2),
      q("Khi ng\u01B0\u1EDDi d\xE2n \u0111\u1ED5i \u0111i\u1EC7n tho\u1EA1i m\u1EDBi, \u0111\u1EC3 chuy\u1EC3n \u1EE9ng d\u1EE5ng \u0111\u1ECBnh danh \u0111i\u1EC7n t\u1EED VNeID m\u1EE9c \u0111\u1ED9 2 sang thi\u1EBFt b\u1ECB m\u1EDBi m\u1ED9t c\xE1ch an to\xE0n v\xE0 nhanh nh\u1EA5t, c\u01A1 ch\u1EBF n\xE0o \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng?", [
        "\u0110\u1EBFn tr\u1EF1c ti\u1EBFp c\u01A1 quan C\xF4ng an qu\u1EADn, huy\u1EC7n \u0111\u1EC3 l\xE0m l\u1EA1i t\u1EEB \u0111\u1EA7u.",
        "Nh\u1EDD t\u1ED5ng \u0111\xE0i vi\u1EC5n th\xF4ng g\u1EEDi l\u1EA1i to\xE0n b\u1ED9 file d\u1EEF li\u1EC7u ph\u1EB3ng l\u01B0u tr\xEAn RAM.",
        "T\u1EF1 \xFD s\u1EEDa \u0111\u1ED5i th\xF4ng tin file c\u1EA5u h\xECnh .env c\u1EE7a \u1EE9ng d\u1EE5ng tr\xEAn m\xE1y t\xEDnh.",
        "S\u1EED d\u1EE5ng t\xEDnh n\u0103ng \u0111\u0103ng nh\u1EADp b\u1EB1ng qu\xE9t chip NFC tr\xEAn th\u1EBB C\u0103n c\u01B0\u1EDBc c\xF4ng d\xE2n g\u1EAFn chip b\u1EB1ng \u0111i\u1EC7n tho\u1EA1i m\u1EDBi."
      ], 3),
      q("Trong vi\u1EC7c qu\u1EA3n l\xFD m\u1EADt kh\u1EA9u gia \u0111\xECnh, th\xF3i quen n\xE0o sau \u0111\xE2y gi\xFAp ng\u01B0\u1EDDi cao tu\u1ED5i b\u1EA3o v\u1EC7 t\xE0i kho\u1EA3n s\u1ED1 c\u1EE7a m\xECnh an to\xE0n nh\u1EA5t?", [
        "Ghi m\u1EADt kh\u1EA9u l\xEAn t\u1EDD gi\u1EA5y nh\u1EDB v\xE0 d\xE1n tr\u1EF1c ti\u1EBFp l\xEAn m\u1EB7t tr\u01B0\u1EDBc c\u1EE7a m\xE0n h\xECnh m\xE1y t\xEDnh.",
        "\u0110\u1EB7t m\u1EADt kh\u1EA9u l\xE0 s\u1ED1 \u0111i\u1EC7n tho\u1EA1i ho\u1EB7c h\u1ECD t\xEAn \u0111\u1EA7y \u0111\u1EE7 kh\xF4ng d\u1EA5u c\u1EE7a m\xECnh.",
        "S\u1EED d\u1EE5ng c\u1EE5m t\u1EEB m\u1EADt kh\u1EA9u g\u1EAFn li\u1EC1n v\u1EDBi m\u1ED9t k\u1EF7 ni\u1EC7m \u0111\u1EB7c bi\u1EC7t, c\xF3 vi\u1EBFt hoa, th\xEAm s\u1ED1, k\xFD t\u1EF1 \u0111\u1EB7c bi\u1EC7t v\xE0 tuy\u1EC7t \u0111\u1ED1i kh\xF4ng chia s\u1EBB cho ng\u01B0\u1EDDi l\u1EA1.",
        "S\u1EED d\u1EE5ng chung m\u1ED9t m\u1EADt kh\u1EA9u duy nh\u1EA5t cho c\u1EA3 t\xE0i kho\u1EA3n Facebook v\xE0 t\xE0i kho\u1EA3n Ng\xE2n h\xE0ng."
      ], 2),
      q('Khi s\u1EED d\u1EE5ng c\xE1c \u1EE9ng d\u1EE5ng m\u1EA1ng x\xE3 h\u1ED9i, t\xEDnh n\u0103ng "Quy\u1EC1n ri\xEAng t\u01B0" c\u1EA7n \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh nh\u01B0 th\u1EBF n\xE0o \u0111\u1EC3 h\u1EA1n ch\u1EBF b\u1ECB t\u1ED9i ph\u1EA1m thu th\u1EADp th\xF4ng tin l\u1EADp t\xE0i kho\u1EA3n gi\u1EA3 m\u1EA1o?', [
        "\u0110\u1EC3 ch\u1EBF \u0111\u1ED9 c\xF4ng khai ho\xE0n to\xE0n t\u1EA5t c\u1EA3 b\xE0i vi\u1EBFt, danh s\xE1ch b\u1EA1n b\xE8 v\xE0 s\u1ED1 \u0111i\u1EC7n tho\u1EA1i.",
        'Gi\u1EDBi h\u1EA1n \u0111\u1ED1i t\u01B0\u1EE3ng xem danh s\xE1ch b\u1EA1n b\xE8, th\xF4ng tin li\xEAn h\u1EC7 v\xE0 b\xE0i vi\u1EBFt c\xE1 nh\xE2n \u1EDF ch\u1EBF \u0111\u1ED9 "Ch\u1EC9 b\u1EA1n b\xE8" ho\u1EB7c "Ch\u1EC9 m\xECnh t\xF4i".',
        "T\u1EAFt t\xEDnh n\u0103ng x\xE1c th\u1EF1c 2 l\u1EDBp \u0111\u1EC3 tr\xE1nh b\u1ECB ngh\u1EBDn m\u1EA1ng vi\u1EC5n th\xF4ng.",
        "Cho ph\xE9p t\u1EA5t c\u1EA3 ng\u01B0\u1EDDi l\u1EA1 t\u1EF1 \u0111\u1ED9ng g\u1EAFn th\u1EBB (tag) v\xE0o c\xE1c b\xE0i vi\u1EBFt qu\u1EA3ng c\xE1o."
      ], 1),
      q('Trong ki\u1EBFn tr\xFAc h\u1EC7 th\u1ED1ng d\u1ECBch v\u1EE5 c\xF4ng tr\u1EF1c tuy\u1EBFn, th\xE0nh ph\u1EA7n "RAM cache" \u0111\xF3ng vai tr\xF2 g\xEC trong vi\u1EC7c t\u1ED1i \u01B0u h\xF3a hi\u1EC7u su\u1EA5t ph\u1EE5c v\u1EE5 ng\u01B0\u1EDDi d\xE2n?', [
        "L\u01B0u tr\u1EEF d\u1EEF li\u1EC7u v\u0129nh vi\u1EC5n k\u1EC3 c\u1EA3 khi m\xE1y ch\u1EE7 b\u1ECB m\u1EA5t \u0111i\u1EC7n \u0111\u1ED9t ng\u1ED9t.",
        "T\u1EF1 \u0111\u1ED9ng b\u0103m m\u1EADt kh\u1EA9u ng\u01B0\u1EDDi d\xF9ng b\u1EB1ng thu\u1EADt to\xE1n scrypt n\xE2ng cao.",
        "L\u01B0u tr\u1EEF t\u1EA1m th\u1EDDi d\u1EEF li\u1EC7u ph\u1EB3ng \u0111\u01B0\u1EE3c t\u1EA3i v\u1EC1 t\u1EEB Google Drive l\xFAc kh\u1EDFi \u0111\u1ED9ng \u0111\u1EC3 ph\u1EE5c v\u1EE5 truy v\u1EA5n c\u1EE7a ng\u01B0\u1EDDi d\xF9ng v\u1EDBi t\u1ED1c \u0111\u1ED9 t\u1ED1i \u0111a, kh\xF4ng g\xE2y ngh\u1EBDn h\u1EC7 th\u1ED1ng.",
        "Qu\xE9t c\xE1c c\u1ED5ng d\u1ECBch v\u1EE5 m\u1EA1ng \u0111ang m\u1EDF c\u1EE7a h\u1EC7 th\u1ED1ng m\xE1y t\xEDnh ng\u01B0\u1EDDi d\xE2n."
      ], 2),
      q("[T\u1EF0 LU\u1EACN NG\u1EAEN] N\xEAu c\xE1c d\u1EA5u hi\u1EC7u c\u01A1 b\u1EA3n \u0111\u1EC3 ng\u01B0\u1EDDi d\xE2n nh\u1EADn bi\u1EBFt m\u1ED9t video cu\u1ED9c g\u1ECDi tr\u1EF1c tuy\u1EBFn c\xF3 s\u1EED d\u1EE5ng c\xF4ng ngh\u1EC7 l\u1EEBa \u0111\u1EA3o Deepfake?", [
        "H\u01B0\u1EDBng d\u1EABn ch\u1EA5m: Th\xED sinh n\xEAu \u0111\u01B0\u1EE3c t\u1ED1i thi\u1EC3u 2 trong c\xE1c d\u1EA5u hi\u1EC7u sau:\n1. Khu\xF4n m\u1EB7t ng\u01B0\u1EDDi g\u1ECDi nh\xECn \u0111\u01A1 c\u1EE9ng, c\u1EED \u0111\u1ED9ng m\u1EAFt, m\xF4i kh\xF4ng t\u1EF1 nhi\xEAn ho\u1EB7c b\u1ECB m\xE9o m\xF3.\n2. Gi\u1ECDng n\xF3i b\u1ECB tr\u1EC5 nh\u1ECBp so v\u1EDBi h\xECnh \u1EA3nh, nghe c\xF3 ti\u1EBFng robot ho\u1EB7c kh\xF4ng r\xF5 r\xE0ng.\n3. H\u01B0\u1EDBng \xE1nh s\xE1ng tr\xEAn khu\xF4n m\u1EB7t kh\xF4ng \u0111\u1ED3ng nh\u1EA5t v\u1EDBi m\xF4i tr\u01B0\u1EDDng xung quanh, xu\u1EA5t hi\u1EC7n c\xE1c v\xF9ng m\u1EDD quanh vi\u1EC1n c\u1ED5 v\xE0 t\xF3c."
      ], 0),
      q("[T\u1EF0 LU\u1EACN NG\u1EAEN] Vi\u1EC7c c\xE0i \u0111\u1EB7t c\xE1c \u1EE9ng d\u1EE5ng b\u1EBB kh\xF3a (Crack) ho\u1EB7c t\u1EF1 \xFD t\u1EA3i c\xE1c t\u1EC7p tin \u0111u\xF4i .apk kh\xF4ng r\xF5 ngu\u1ED3n g\u1ED1c t\u1EEB Internet ti\u1EC1m \u1EA9n r\u1EE7i ro g\xEC cho \u0111i\u1EC7n tho\u1EA1i c\u1EE7a ng\u01B0\u1EDDi d\xE2n?", [
        "H\u01B0\u1EDBng d\u1EABn ch\u1EA5m: Th\xED sinh n\xEAu \u0111\u01B0\u1EE3c c\xE1c \xFD c\u1ED1t l\xF5i:\nC\xE1c ph\u1EA7n m\u1EC1m n\xE0y th\u01B0\u1EDDng b\u1ECB t\u1ED9i ph\u1EA1m c\xF4ng ngh\u1EC7 cao ch\xE8n s\u1EB5n m\xE3 \u0111\u1ED9c ng\u1EA7m (Trojan, Keylogger). Khi c\xE0i \u0111\u1EB7t v\xE0o m\xE1y, m\xE3 \u0111\u1ED9c s\u1EBD \u0111\xE1nh c\u1EAFp m\u1EADt kh\u1EA9u, th\xF4ng tin t\xE0i kho\u1EA3n ng\xE2n h\xE0ng s\u1ED1 ho\u1EB7c t\u1EF1 \u0111\u1ED9ng chi\u1EBFm quy\u1EC1n tr\u1EE3 n\u0103ng (Accessibility Service) \u0111\u1EC3 theo d\xF5i h\xE0nh vi v\xE0 \u0111i\u1EC1u khi\u1EC3n \u0111i\u1EC7n tho\u1EA1i tr\xE1i ph\xE9p t\u1EEB xa nh\u1EB1m chi\u1EBFm \u0111o\u1EA1t t\xE0i s\u1EA3n."
      ], 0),
      q("[T\u1EF0 LU\u1EACN NG\u1EAEN] \u0110\u1EC3 lan t\u1ECFa m\u1EA1nh m\u1EBD phong tr\xE0o B\xECnh d\xE2n h\u1ECDc v\u1EE5 s\u1ED1 v\xE0 h\u1ED7 tr\u1EE3 ng\u01B0\u1EDDi d\xE2n y\u1EBFu th\u1EBF ti\u1EBFp c\u1EADn c\xF4ng ngh\u1EC7 t\u1EA1i \u0111\u1ECBa ph\u01B0\u01A1ng, l\u1EF1c l\u01B0\u1EE3ng \u0111o\xE0n vi\xEAn thanh ni\xEAn c\u1EA7n tri\u1EC3n khai nh\u1EEFng gi\u1EA3i ph\xE1p c\u1EE5 th\u1EC3 n\xE0o?", [
        'H\u01B0\u1EDBng d\u1EABn ch\u1EA5m: Th\xED sinh n\xEAu \u0111\u01B0\u1EE3c t\u1ED1i thi\u1EC3u 2 gi\u1EA3i ph\xE1p thi\u1EBFt th\u1EF1c:\n1. Th\xE0nh l\u1EADp c\xE1c t\u1ED5 c\xF4ng ngh\u1EC7 s\u1ED1 thanh ni\xEAn xung k\xEDch tr\u1EF1c ti\u1EBFp h\u1ED7 tr\u1EE3, h\u01B0\u1EDBng d\u1EABn ng\u01B0\u1EDDi d\xE2n t\u1EA1i b\u1ED9 ph\u1EADn m\u1ED9t c\u1EEDa ho\u1EB7c c\xE1c nh\xE0 v\u0103n h\xF3a.\n2. Tri\u1EC3n khai c\xE1c chi\u1EBFn d\u1ECBch "\u0111i t\u1EEBng ng\xF5, g\xF5 t\u1EEBng nh\xE0" c\u1EA7m tay ch\u1EC9 vi\u1EC7c h\u01B0\u1EDBng d\u1EABn ng\u01B0\u1EDDi cao tu\u1ED5i, ng\u01B0\u1EDDi lao \u0111\u1ED9ng c\xE1ch s\u1EED d\u1EE5ng d\u1ECBch v\u1EE5 c\xF4ng, c\xE0i VNeID v\xE0 thanh to\xE1n kh\xF4ng d\xF9ng ti\u1EC1n m\u1EB7t.\n3. T\u1ED5 ch\u1EE9c c\xE1c bu\u1ED5i tuy\xEAn truy\u1EC1n chuy\xEAn \u0111\u1EC1 sinh \u0111\u1ED9ng v\u1EC1 nh\u1EADn bi\u1EBFt th\u1EE7 \u0111o\u1EA1n l\u1EEBa \u0111\u1EA3o c\xF4ng ngh\u1EC7 cao \u0111\u1EC3 n\xE2ng cao s\u1EE9c \u0111\u1EC1 kh\xE1ng an to\xE0n th\xF4ng tin cho c\u1ED9ng \u0111\u1ED3ng.'
      ], 0)
    ];
    function buildSampleExams() {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      const openMs = Date.UTC(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate(),
        1,
        0,
        0
      );
      const closeMs = Date.UTC(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate() + 7,
        16,
        59,
        0
      );
      return [
        {
          id: "exam_sample_1",
          title: SET1_TITLE,
          description: SET_DESC,
          category: CATEGORY,
          durationMinutes: DURATION,
          openAt: null,
          closeAt: null,
          questions: SET1_QUESTIONS.map((x, i) => ({ id: `s1_q${i + 1}`, ...x }))
        },
        {
          id: "exam_sample_2",
          title: SET2_TITLE,
          description: SET_DESC,
          category: CATEGORY,
          durationMinutes: DURATION,
          openAt: new Date(openMs).toISOString(),
          closeAt: new Date(closeMs).toISOString(),
          questions: SET2_QUESTIONS.map((x, i) => ({ id: `s2_q${i + 1}`, ...x }))
        },
        {
          id: "exam_sample_3",
          title: SET3_TITLE,
          description: SET3_DESC,
          category: SET3_CATEGORY,
          durationMinutes: DURATION3,
          openAt: null,
          closeAt: null,
          questions: SET3_QUESTIONS.map((x, i) => ({ id: `s3_q${i + 1}`, ...x }))
        }
      ];
    }
    function missingSampleExams(existingExams = []) {
      const titles = new Set(existingExams.map((e) => e && e.title));
      return buildSampleExams().filter((s) => !titles.has(s.title));
    }
    module2.exports = { buildSampleExams, missingSampleExams, SET1_TITLE, SET2_TITLE, SET3_TITLE };
  }
});

// src/store/dataStore.js
var require_dataStore = __commonJS({
  "src/store/dataStore.js"(exports2, module2) {
    "use strict";
    var fs = require("fs/promises");
    var path = require("path");
    var config = require_config();
    var driveClient = require_driveClient();
    var { adviceForError, isQuotaError } = require_driveAdvice();
    var { globalMutex } = require_mutex();
    var FILES = ["users", "exams", "results"];
    function fileNameOf(key) {
      return `${key}${config.dataFileSuffix || ""}.json`;
    }
    var ID_FIELD = { users: "cccd", exams: "id", results: "id" };
    var CACHE_TTL_MS = 15e3;
    var store = {};
    var initPromise = null;
    function init() {
      if (!initPromise) {
        initPromise = (async () => {
          for (const key of FILES) {
            store[key] = {
              data: [],
              fileId: null,
              baseline: /* @__PURE__ */ new Map(),
              loadedAt: null,
              bootLoadedOk: false,
              lastSyncedAt: null,
              lastSyncError: null
            };
          }
          for (const key of FILES) await initOne(key);
          console.log(
            `[store] Khoi tao xong (instance): users=${store.users.data.length}, exams=${store.exams.data.length}, results=${store.results.data.length}`
          );
          await seedSampleExamsIfEmpty();
        })().catch((err) => {
          initPromise = null;
          throw err;
        });
      }
      return initPromise;
    }
    function ready() {
      return init();
    }
    async function seedSampleExamsIfEmpty() {
      if (store.exams.data.length > 0) return;
      if (driveClient.isDriveMode()) {
        const s = store.exams;
        if (!s.bootLoadedOk || s.fileId) {
          console.warn(
            `[store] exams tr\u1ED1ng trong RAM nh\u01B0ng KH\xD4NG n\u1EA1p b\u1ED9 \u0111\u1EC1 m\u1EABu (bootLoadedOk=${s.bootLoadedOk}, fileId=${s.fileId ? "c\xF3" : "null"}) \u2014 c\u1EA7n \u0111\u1ECDc \u0111\u01B0\u1EE3c Drive th\xE0nh c\xF4ng v\xE0 x\xE1c nh\u1EADn file exams ch\u01B0a t\u1ED3n t\u1EA1i r\u1ED3i m\u1EDBi n\u1EA1p m\u1EABu. Admin v\u1EABn c\xF3 th\u1EC3 b\u1EA5m "N\u1EA1p b\u1ED9 \u0111\u1EC1 m\u1EABu" th\u1EE7 c\xF4ng khi Drive \u0111\xE3 \u1ED5n \u0111\u1ECBnh.`
          );
          return;
        }
      }
      try {
        const { buildSampleExams } = require_sampleExams();
        const samples = buildSampleExams();
        store.exams.data.push(...samples);
        const sync = await saveNow("exams");
        console.log(
          `[store] exams trong \u2014 DA NAP ${samples.length} BO DE MAU ( ATTT + Chuyen doi so, ${sync.synced ? "DA SYNC" : "CHUA SYNC \u2014 se tu thu lai"} ). Admin co the sua/xoa tuy y.`
        );
      } catch (err) {
        console.warn(`[store] Khong nap duoc bo de mau: ${err.message}`);
      }
    }
    function isHealthy(key) {
      assertKey(key);
      if (!driveClient.isDriveMode()) return true;
      return store[key].bootLoadedOk === true;
    }
    async function initOne(key) {
      const fname = fileNameOf(key);
      if (driveClient.isDriveMode()) {
        let foundFileId = null;
        try {
          foundFileId = await driveClient.findFileByName(fname);
          if (foundFileId) {
            try {
              const data = await driveClient.downloadFile(foundFileId);
              store[key].data = Array.isArray(data) ? data : [];
              store[key].fileId = foundFileId;
              store[key].baseline = new Map(store[key].data.map((r) => [idOf(key, r), JSON.stringify(r)]));
              store[key].loadedAt = Date.now();
              store[key].bootLoadedOk = true;
              await mirrorLocal(key);
              console.log(`[store] Tai ${fname} tu Google Drive: ${store[key].data.length} ban ghi`);
              return;
            } catch (dlErr) {
              store[key].bootLoadedOk = false;
              store[key].fileId = foundFileId;
              const tipDl = adviceForError(dlErr);
              store[key].lastSyncError = `T\xECm th\u1EA5y ${fname} tr\xEAn Drive nh\u01B0ng kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c n\u1ED9i dung: ${dlErr.message}${tipDl ? ` \u2192 ${tipDl}` : ""}`;
              console.error(
                `[store] ${fname} co tren Drive (id=${foundFileId}) nhung khong doc duoc (${dlErr.message}) \u2014 giu fileId, cho thu lai.`
              );
            }
          } else {
            store[key].data = [];
            store[key].fileId = null;
            store[key].baseline = /* @__PURE__ */ new Map();
            store[key].loadedAt = Date.now();
            store[key].bootLoadedOk = true;
            await mirrorLocal(key);
            console.log(`[store] ${fname} chua co tren Google Drive \u2014 khoi tao rong (se tao file khi ghi dau tien).`);
            return;
          }
        } catch (err) {
          store[key].bootLoadedOk = false;
          const tip = adviceForError(err);
          store[key].lastSyncError = `L\xFAc kh\u1EDFi \u0111\u1ED9ng kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c file t\u1EEB Drive: ${err.message}${tip ? ` \u2192 ${tip}` : ""}`;
          console.error(`[store] Khong tai duoc ${fname} tu Drive (${err.message}).`);
        }
      }
      try {
        const text = await fs.readFile(path.join(config.localDataDir, fname), "utf8");
        const data = JSON.parse(text);
        store[key].data = Array.isArray(data) ? data : [];
        store[key].baseline = new Map(store[key].data.map((r) => [idOf(key, r), JSON.stringify(r)]));
        store[key].loadedAt = Date.now();
        console.log(`[store] Tai ${fname} tu cache cuc bo: ${store[key].data.length} ban ghi`);
      } catch {
        store[key].data = [];
      }
    }
    function get(key) {
      assertKey(key);
      return store[key].data;
    }
    function count(key) {
      return store[key] ? store[key].data.length : 0;
    }
    function assertKey(key) {
      if (!store[key]) throw new Error(`Khoa du lieu khong hop le: ${key}`);
    }
    function idOf(key, record) {
      return record && record[ID_FIELD[key]] !== void 0 ? String(record[ID_FIELD[key]]) : null;
    }
    async function refreshIfStale(key, maxAgeMs = CACHE_TTL_MS) {
      assertKey(key);
      if (!driveClient.isDriveMode()) return;
      const s = store[key];
      if (s.loadedAt !== null && Date.now() - s.loadedAt < maxAgeMs) return;
      await globalMutex.runExclusive(`persist:${key}`, async () => {
        if (s.loadedAt !== null && Date.now() - s.loadedAt < maxAgeMs) return;
        try {
          let fileId = s.fileId;
          if (!fileId) {
            fileId = await driveClient.findFileByName(fileNameOf(key));
            if (!fileId) {
              s.loadedAt = Date.now();
              return;
            }
            s.fileId = fileId;
          }
          const remote = await driveClient.downloadFile(fileId);
          s.data = Array.isArray(remote) ? remote : [];
          s.baseline = new Map(s.data.map((r) => [idOf(key, r), JSON.stringify(r)]));
          s.loadedAt = Date.now();
          s.bootLoadedOk = true;
        } catch (err) {
          s.lastSyncError = `Kh\xF4ng l\xE0m t\u01B0\u01A1i \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u t\u1EEB Drive: ${err.message}`;
          s.loadedAt = Date.now();
          console.warn(`[store] refreshIfStale(${key}): ${err.message}`);
        }
      });
    }
    async function refreshAllIfStale(maxAgeMs = CACHE_TTL_MS) {
      for (const key of FILES) await refreshIfStale(key, maxAgeMs);
    }
    var FLUSH_DELAY_MS = 300;
    var DRIVE_SPACING_MS = 1e3;
    var flushState = {};
    function flushEntryOf(key) {
      if (!flushState[key]) {
        flushState[key] = { waiters: [], timer: null, flushing: false, lastWriteAt: 0 };
      }
      return flushState[key];
    }
    function saveNow(key) {
      assertKey(key);
      const entry = flushEntryOf(key);
      return new Promise((resolve) => {
        entry.waiters.push(resolve);
        if (!entry.timer && !entry.flushing) {
          entry.timer = setTimeout(() => {
            entry.timer = null;
            flushKey(key);
          }, FLUSH_DELAY_MS);
        }
      });
    }
    async function flushKey(key) {
      const entry = flushEntryOf(key);
      entry.flushing = true;
      const waiters = entry.waiters;
      entry.waiters = [];
      try {
        const spacing = driveClient.isDriveMode() ? DRIVE_SPACING_MS : 0;
        const waitMs = entry.lastWriteAt + spacing - Date.now();
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        const result = await doSaveNow(key);
        entry.lastWriteAt = Date.now();
        for (const w of waiters) w(result);
      } catch (err) {
        console.error(`[store] flush ${key} loi bat ngo: ${err && err.message || err}`);
        for (const w of waiters) w({ synced: false });
      } finally {
        entry.flushing = false;
        if (entry.waiters.length > 0) flushKey(key);
      }
    }
    async function doSaveNow(key) {
      assertKey(key);
      return globalMutex.runExclusive(`persist:${key}`, async () => {
        const s = store[key];
        try {
          await mirrorLocal(key);
          if (!driveClient.isDriveMode()) {
            s.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
            s.lastSyncError = null;
            return { synced: true };
          }
          let fileId = s.fileId;
          if (!fileId) {
            const found = await driveClient.findFileByName(fileNameOf(key));
            if (found) {
              s.fileId = fileId = found;
            }
          }
          if (fileId) {
            let remoteArr = null;
            try {
              const remote = await driveClient.downloadFile(fileId);
              remoteArr = Array.isArray(remote) ? remote : [];
            } catch (fetchErr) {
              const tip = adviceForError(fetchErr);
              s.lastSyncError = `Ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u m\u1EDBi nh\u1EA5t t\u1EEB Drive tr\u01B0\u1EDBc khi ghi: ${fetchErr.message}${tip ? ` \u2192 ${tip}` : ""}`;
              console.error(
                `[store] HOAN ghi ${fileNameOf(key)} \u2014 khong doc duoc ban moi tren Drive (${fetchErr.message}). Du lieu van an toan trong RAM cua instance; request ke tiep se tu thu lai.`
              );
              return { synced: false };
            }
            const remoteById = new Map(remoteArr.map((r) => [idOf(key, r), r]));
            const merged = [];
            const ourIds = /* @__PURE__ */ new Set();
            for (const record of s.data) {
              const rid = idOf(key, record);
              ourIds.add(rid);
              const base = s.baseline.get(rid);
              const remoteRec = remoteById.get(rid);
              if (base === void 0) {
                merged.push(record);
              } else if (JSON.stringify(record) !== base) {
                merged.push(record);
              } else if (remoteRec !== void 0) {
                merged.push(remoteRec);
              }
            }
            for (const [rid, remoteRec] of remoteById) {
              if (rid === null || ourIds.has(rid)) continue;
              if (!s.baseline.has(rid)) {
                merged.push(remoteRec);
                console.log(`[store] Merge: nhan ban ghi moi tu instance khac vao ${fileNameOf(key)} (id=${rid})`);
              }
            }
            s.data = merged;
            s.baseline = new Map(merged.map((r) => [idOf(key, r), JSON.stringify(r)]));
            await mirrorLocal(key);
          }
          const payload = JSON.stringify(s.data, null, 2);
          if (s.fileId) {
            await driveClient.updateFile(s.fileId, payload);
          } else {
            s.fileId = await driveClient.createFile(fileNameOf(key), payload);
          }
          s.lastSyncedAt = (/* @__PURE__ */ new Date()).toISOString();
          s.lastSyncError = null;
          s.loadedAt = Date.now();
          console.log(`[store] Da ghi ${fileNameOf(key)} len Google Drive (${s.data.length} ban ghi)`);
          return { synced: true };
        } catch (err) {
          const tip = adviceForError(err);
          s.lastSyncError = `${err.message}${tip ? ` \u2192 ${tip}` : ""}`;
          if (tip) console.error(`[store] CACH SUA: ${tip}`);
          console.error(`[store] KHONG ghi duoc ${fileNameOf(key)}: ${err.message}`);
          return { synced: false };
        }
      });
    }
    async function mirrorLocal(key) {
      try {
        await fs.mkdir(config.localDataDir, { recursive: true });
        await fs.writeFile(
          path.join(config.localDataDir, fileNameOf(key)),
          JSON.stringify(store[key].data, null, 2),
          "utf8"
        );
      } catch (err) {
        console.warn(`[store] Khong ghi duoc mirror cuc bo cho ${key}: ${err.message}`);
      }
    }
    function save(key) {
      return saveNow(key);
    }
    async function flushOnShutdown() {
    }
    function getSyncInfo() {
      return FILES.map((key) => {
        const s = store[key] || {};
        return {
          file: fileNameOf(key),
          records: s.data ? s.data.length : 0,
          lastSyncedAt: s.lastSyncedAt || null,
          // R6: serverless không còn hàng đợi pending kiểu render.com, nhưng vẫn
          // cần cờ "chưa sync xong" cho dashboard + /admin/sync: một file được coi
          // là pending khi lần ghi/nạp gần nhất LỖI và chưa có lần ghi thành công
          // nào gỡ lỗi đó (saveNow thành công tự xóa lastSyncError).
          pending: Boolean(s.lastSyncError),
          lastError: s.lastSyncError || null,
          cacheAgeSeconds: s.loadedAt ? Math.floor((Date.now() - s.loadedAt) / 1e3) : null
        };
      });
    }
    async function reloadFromDrive() {
      if (!driveClient.isDriveMode()) return;
      await globalMutex.runExclusive("persist:reload", async () => {
        for (const key of FILES) {
          store[key].fileId = null;
          store[key].loadedAt = null;
          await initOne(key);
        }
      });
    }
    module2.exports = {
      init,
      ready,
      get,
      count,
      save,
      saveNow,
      refreshIfStale,
      refreshAllIfStale,
      flushOnShutdown,
      getSyncInfo,
      reloadFromDrive,
      isHealthy,
      // R10a: chặn thao tác ghi khi instance chưa đọc được Drive
      fileNameOf,
      FILES
    };
  }
});

// src/drive/driveClient.js
var require_driveClient = __commonJS({
  "src/drive/driveClient.js"(exports2, module2) {
    "use strict";
    var { Readable } = require("stream");
    var { google } = require("googleapis");
    var config = require_config();
    var { adviceForError, isQuotaError } = require_driveAdvice();
    var DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
    var TEST_FILE_NAME = "__drive_check__.json";
    var drive = null;
    var folderId = null;
    var mode = "local";
    function parseServiceAccount(raw) {
      let text = raw;
      if (!raw.startsWith("{")) {
        text = Buffer.from(raw, "base64").toString("utf8");
      }
      const creds = JSON.parse(text);
      if (!creds.client_email || !creds.private_key) {
        throw new Error("File Service Account thi\u1EBFu client_email / private_key");
      }
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
      return creds;
    }
    function buildDriveClient() {
      const fid = (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim();
      const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
      const keyFile = (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
      if (!raw && !keyFile) {
        const e = new Error("Ch\u01B0a khai b\xE1o GOOGLE_SERVICE_ACCOUNT_JSON (chu\u1ED7i Base64 c\u1EE7a file key Service Account).");
        e.advice = "L\u1EA5y key theo README m\u1EE5c 3 (B\u01B0\u1EDBc 1\u20137), sau \u0111\xF3 khai b\xE1o bi\u1EBFn tr\xEAn Vercel: Project \u2192 Settings \u2192 Environment Variables \u2192 Add New \u2192 Save, r\u1ED3i Redeploy (Deployments \u2192 n\xFAt \u22EF \u2192 Redeploy).";
        return { error: e };
      }
      if (!fid) {
        const e = new Error("Ch\u01B0a khai b\xE1o GOOGLE_DRIVE_FOLDER_ID (ID th\u01B0 m\u1EE5c Drive ch\u1EE9a 3 file JSON).");
        e.advice = "M\u1EDF th\u01B0 m\u1EE5c tr\xEAn drive.google.com, copy \u0110O\u1EA0N SAU /folders/ tr\xEAn thanh \u0111\u1ECBa ch\u1EC9, khai b\xE1o bi\u1EBFn tr\xEAn Vercel r\u1ED3i Redeploy (Deployments \u2192 n\xFAt \u22EF \u2192 Redeploy).";
        return { error: e };
      }
      if (fid.includes("/folders/")) {
        const e = new Error("GOOGLE_DRIVE_FOLDER_ID \u0111ang ch\u1EE9a c\u1EA3 URL thay v\xEC ch\u1EC9 ID.");
        e.advice = `B\u1EA1n \u0111\xE3 d\xE1n nguy\xEAn URL. Ch\u1EC9 gi\u1EEF l\u1EA1i \u0111o\u1EA1n sau /folders/ (hi\u1EC7n t\u1EA1i: "${fid}"). S\u1EEDa bi\u1EBFn tr\xEAn Vercel r\u1ED3i Redeploy.`;
        return { error: e };
      }
      try {
        let auth;
        let clientEmail = "(kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c email)";
        if (raw) {
          const creds = parseServiceAccount(raw);
          clientEmail = creds.client_email;
          auth = new google.auth.JWT({
            email: creds.client_email,
            key: creds.private_key,
            scopes: [DRIVE_SCOPE]
          });
        } else {
          auth = new google.auth.GoogleAuth({
            keyFile,
            scopes: [DRIVE_SCOPE]
          });
        }
        return {
          drive: google.drive({ version: "v3", auth }),
          folderId: fid,
          clientEmail
        };
      } catch (err) {
        err.advice = err.advice || adviceForError(err) || "Key kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c \u2014 ki\u1EC3m tra chu\u1ED7i Base64 (\u0111\u1EE9t d\xF2ng, thi\u1EBFu k\xFD t\u1EF1) theo README m\u1EE5c 3 B\u01B0\u1EDBc 7.";
        return { error: err };
      }
    }
    function init() {
      const built = buildDriveClient();
      if (built.error) {
        drive = null;
        folderId = null;
        mode = "local";
        console.warn(
          `[drive] KHONG THE ket noi Google Drive: ${built.error.message}` + (built.error.advice ? ` | ${built.error.advice}` : "")
        );
        console.warn("[drive] He thong chay o CHE DO CUC BO (KHONG ben vinh tren Vercel).");
        return mode;
      }
      drive = built.drive;
      folderId = built.folderId;
      mode = "drive";
      console.log(`[drive] Da ket noi Google Drive (service account: ${built.clientEmail})`);
      return mode;
    }
    function isDriveMode() {
      return mode === "drive";
    }
    function getMode() {
      return mode;
    }
    function getServiceAccountEmail() {
      try {
        const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
        if (!raw) return null;
        return parseServiceAccount(raw).client_email || null;
      } catch {
        return null;
      }
    }
    var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    async function withRetry(fn, tries = 3, label = "drive-op") {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          return await fn();
        } catch (err) {
          lastErr = err;
          const status = err && (err.code || err.errors && err.errors[0] && err.errors[0].code);
          const retryable = !status || [429, 500, 502, 503, 504].includes(Number(status));
          if (!retryable || i === tries - 1) break;
          const delay = 1e3 * Math.pow(2, i);
          console.warn(`[drive] ${label} that bai (lan ${i + 1}), thu lai sau ${delay}ms: ${err.message}`);
          await sleep(delay);
        }
      }
      throw lastErr;
    }
    async function findFileByName(name) {
      if (!isDriveMode()) return null;
      const res = await withRetry(
        () => drive.files.list({
          q: `name = '${name}' and '${folderId}' in parents and trashed = false`,
          fields: "files(id, name)",
          pageSize: 1
        }),
        3,
        `find ${name}`
      );
      const file = res.data && res.data.files && res.data.files[0];
      return file ? file.id : null;
    }
    async function createFile(name, contentString) {
      const res = await withRetry(
        () => drive.files.create({
          requestBody: { name, parents: [folderId] },
          media: { mimeType: "application/json", body: Readable.from([contentString]) },
          fields: "id"
        }),
        3,
        `create ${name}`
      );
      return res.data.id;
    }
    async function downloadFile(fileId) {
      const res = await withRetry(
        () => drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }),
        3,
        `download ${fileId}`
      );
      const text = Buffer.from(res.data).toString("utf8");
      if (!text.trim()) {
        console.warn(`[drive] File ${fileId} tr\xEAn Drive dang RONG (0 byte) \u2014 coi nhu du lieu trong, cho phep ghi moi.`);
        return [];
      }
      try {
        return JSON.parse(text);
      } catch (err) {
        const preview = text.slice(0, 60).replace(/\s+/g, " ");
        throw new Error(`N\u1ED9i dung file tr\xEAn Drive kh\xF4ng ph\u1EA3i JSON h\u1EE3p l\u1EC7 (${err.message}). \u0110o\u1EA1n \u0111\u1EA7u file: "${preview}..."`);
      }
    }
    async function updateFile(fileId, contentString) {
      await withRetry(
        () => drive.files.update({
          fileId,
          media: { mimeType: "application/json", body: Readable.from([contentString]) }
        }),
        3,
        `update ${fileId}`
      );
    }
    async function getFileMeta(fileId) {
      if (!isDriveMode()) return null;
      const res = await withRetry(
        () => drive.files.get({ fileId, fields: "id, name, mimeType" }),
        2,
        `meta ${fileId}`
      );
      return res.data;
    }
    async function checkUpdateExistingFile(dapi, fid) {
      const suffix = config.dataFileSuffix || "";
      const base = ["users", "exams", "results"].map((k) => `${k}.json`);
      const suffixed = suffix ? base.map((k) => k.replace(".json", `${suffix}.json`)) : [];
      const probe = async (names) => {
        for (const name of names) {
          let fileId = null;
          try {
            const res = await dapi.files.list({
              q: `name = '${name}' and '${fid}' in parents and trashed = false`,
              fields: "files(id, name, mimeType)",
              pageSize: 1
            });
            const f = res.data && res.data.files && res.data.files[0];
            if (!f) continue;
            fileId = f.id;
            if (f.mimeType && f.mimeType !== "application/json") {
              return {
                ok: false,
                detail: `file ${name} \u0111ang l\xE0 "${f.mimeType}" (kh\xF4ng ph\u1EA3i file JSON thu\u1EA7n \u2014 c\xF3 th\u1EC3 b\u1EA1n t\u1EA1o b\u1EB1ng Google Docs). H\xE3y X\xD3A file \u0111\xF3 trong th\u01B0 m\u1EE5c r\u1ED3i UPLOAD l\u1EA1i file .json t\u1EEB m\xE1y t\xEDnh (n\u1ED9i dung []).`
              };
            }
            const dl = await dapi.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
            const content = Buffer.from(dl.data).toString("utf8");
            await dapi.files.update({ fileId, media: { mimeType: "application/json", body: Readable.from([content]) } });
            return { ok: true, detail: `${name}` };
          } catch (e) {
            if (fileId) return { ok: false, detail: `kh\xF4ng c\u1EADp nh\u1EADt \u0111\u01B0\u1EE3c file ${name}: ${e.message}` };
            continue;
          }
        }
        return null;
      };
      if (suffixed.length) {
        const hit = await probe(suffixed);
        if (hit) return hit;
      }
      const originalHit = await probe(base);
      if (suffixed.length) {
        return {
          ok: false,
          detail: originalHit ? `Th\u01B0 m\u1EE5c c\xF3 3 file g\u1ED1c (users.json...) nh\u01B0ng b\u1EA3n deploy n\xE0y c\u1EA5u h\xECnh h\u1EADu t\u1ED1 "${suffix}" n\xEAn ch\u1EC9 \u0111\u1ECDc/ghi users${suffix}.json, exams${suffix}.json, results${suffix}.json. H\xE3y t\u1EA1o 3 file \u0110\xDANG T\xCAN C\xD3 H\u1EACU T\u1ED0 n\xE0y trong th\u01B0 m\u1EE5c (upload file .json t\u1EEB m\xE1y, n\u1ED9i dung m\u1ED7i file ch\u1EC9 c\u1EA7n []) \u2014 n\u1EBFu kh\xF4ng h\u1EC7 th\u1ED1ng s\u1EBD kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u v\xE0o Drive.` : `Kh\xF4ng th\u1EA5y file d\u1EEF li\u1EC7u n\xE0o kh\u1EDBp t\xEAn b\u1EA3n deploy n\xE0y (users${suffix}.json, exams${suffix}.json, results${suffix}.json) \u2014 h\xE3y t\u1EA1o s\u1EB5n 3 file \u0111\xF3 trong th\u01B0 m\u1EE5c (upload file .json t\u1EEB m\xE1y, n\u1ED9i dung m\u1ED7i file ch\u1EC9 c\u1EA7n []).`
        };
      }
      return originalHit || {
        ok: false,
        detail: "kh\xF4ng t\xECm th\u1EA5y file n\xE0o trong th\u01B0 m\u1EE5c \u2014 c\u1EA7n t\u1EA1o s\u1EB5n users.json, exams.json, results.json (upload file .json t\u1EEB m\xE1y, n\u1ED9i dung m\u1ED7i file ch\u1EC9 c\u1EA7n [])."
      };
    }
    async function runDiagnostic() {
      const steps = [];
      const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
      let built = null;
      const envOk = Boolean(
        ((process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim() || (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim()) && (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim()
      );
      steps.push({
        name: "1. Bi\u1EBFn m\xF4i tr\u01B0\u1EDDng (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID)",
        ok: envOk,
        detail: envOk ? "\u0110\xE3 khai b\xE1o." : "Thi\u1EBFu bi\u1EBFn m\xF4i tr\u01B0\u1EDDng.",
        advice: envOk ? null : "Khai b\xE1o 2 bi\u1EBFn trong Vercel \u2192 Settings \u2192 Environment Variables, r\u1ED3i Redeploy. Xem README m\u1EE5c 3 B\u01B0\u1EDBc 7\u20138."
      });
      if (!envOk) return finishDiagnostic(false);
      built = buildDriveClient();
      steps.push({
        name: "2. \u0110\u1ECDc key Service Account",
        ok: !built.error,
        detail: built.error ? built.error.message : `H\u1EE3p l\u1EC7 \u2014 service account: ${built.clientEmail}`,
        advice: built.error ? built.error.advice || adviceForError(built.error) : null
      });
      if (built.error) return finishDiagnostic(false);
      const dapi = built.drive;
      const fid = built.folderId;
      try {
        await dapi.files.list({
          q: `name = '${TEST_FILE_NAME}' and '${fid}' in parents and trashed = false`,
          fields: "files(id, name)",
          pageSize: 1
        });
        steps.push({
          name: "3. \u0110\u1ECCC th\u01B0 m\u1EE5c Drive (quy\u1EC1n xem + Folder ID \u0111\xFAng)",
          ok: true,
          detail: "Google x\xE1c nh\u1EADn th\u01B0 m\u1EE5c t\u1ED3n t\u1EA1i v\xE0 service account \u0111\u1ECDc \u0111\u01B0\u1EE3c.",
          advice: null
        });
      } catch (err) {
        err.code = err.code || err.errors && err.errors[0] && err.errors[0].code;
        steps.push({
          name: "3. \u0110\u1ECCC th\u01B0 m\u1EE5c Drive (quy\u1EC1n xem + Folder ID \u0111\xFAng)",
          ok: false,
          detail: err.message,
          advice: adviceForError(err)
        });
        return finishDiagnostic(false);
      }
      let testFileId = null;
      let quotaFallback = false;
      try {
        testFileId = await dapi.files.create({
          requestBody: { name: TEST_FILE_NAME, parents: [fid] },
          media: { mimeType: "application/json", body: Readable.from(["[]"]) },
          fields: "id"
        });
        steps.push({
          name: "4. GHI file test l\xEAn th\u01B0 m\u1EE5c (quy\u1EC1n Editor)",
          ok: true,
          detail: "\u0110\xE3 t\u1EA1o \u0111\u01B0\u1EE3c file __drive_check__.json \u2014 th\u01B0 m\u1EE5c \u0110\xC3 share \u0111\xFAng quy\u1EC1n Editor.",
          advice: null
        });
      } catch (err) {
        err.code = err.code || err.errors && err.errors[0] && err.errors[0].code;
        if (isQuotaError(err)) {
          quotaFallback = true;
          const upd = await checkUpdateExistingFile(dapi, fid);
          if (upd.ok) {
            steps.push({
              name: "4. GHI file test l\xEAn th\u01B0 m\u1EE5c (quy\u1EC1n Editor)",
              ok: true,
              detail: `Service Account KH\xD4NG t\u1EF1 t\u1EA1o \u0111\u01B0\u1EE3c file M\u1EDAI (kh\xF4ng c\xF3 dung l\u01B0\u1EE3ng ri\xEAng \u2014 gi\u1EDBi h\u1EA1n c\u1EE7a Google, kh\xF4ng ph\u1EA3i l\u1ED7i c\u1EA5u h\xECnh). Tuy nhi\xEAn \u0111\xE3 x\xE1c nh\u1EADn: C\u1EACP NH\u1EACT \u0110\u01AF\u1EE2C file c\xF3 s\u1EB5n trong th\u01B0 m\u1EE5c (\u0111\xE3 ghi th\u1EED l\u1EA1i file ${upd.detail} m\xE0 kh\xF4ng m\u1EA5t d\u1EEF li\u1EC7u) \u2014 \u0111\xE2y ch\xEDnh l\xE0 m\xF4 h\xECnh h\u1EC7 th\u1ED1ng s\u1EED d\u1EE5ng v\u1EDBi 3 file users/exams/results.json t\u1EA1o s\u1EB5n. H\u1EC6 TH\u1ED0NG HO\u1EA0T \u0110\u1ED8NG B\xCCNH TH\u01AF\u1EDCNG.`,
              advice: null
            });
          } else {
            steps.push({
              name: "4. GHI file test l\xEAn th\u01B0 m\u1EE5c (quy\u1EC1n Editor)",
              ok: false,
              detail: `${err.message}. Ki\u1EC3m tra c\u1EADp nh\u1EADt file c\xF3 s\u1EB5n: ${upd.detail}`,
              advice: adviceForError(err)
            });
            return finishDiagnostic(false);
          }
        } else {
          steps.push({
            name: "4. GHI file test l\xEAn th\u01B0 m\u1EE5c (quy\u1EC1n Editor)",
            ok: false,
            detail: err.message,
            advice: adviceForError(err)
          });
          return finishDiagnostic(false);
        }
      }
      if (quotaFallback) {
        steps.push({
          name: "5. D\u1ECDn d\u1EB9p file test",
          ok: true,
          detail: "B\u1ECF qua (ki\u1EC3m tra b\u1EB1ng file c\xF3 s\u1EB5n \u2014 kh\xF4ng t\u1EA1o r\xE1c trong th\u01B0 m\u1EE5c c\u1EE7a b\u1EA1n).",
          advice: null
        });
      } else {
        try {
          await dapi.files.delete({ fileId: testFileId });
          steps.push({
            name: "5. D\u1ECDn d\u1EB9p file test",
            ok: true,
            detail: "\u0110\xE3 x\xF3a file test \u2014 k\u1EBFt n\u1ED1i Drive HO\xC0N TO\xC0N S\u1EA0CH S\u1EBC.",
            advice: null
          });
        } catch (err) {
          steps.push({
            name: "5. D\u1ECDn d\u1EB9p file test",
            ok: true,
            detail: `Kh\xF4ng x\xF3a \u0111\u01B0\u1EE3c file test (${err.message}) \u2014 kh\xF4ng sao, c\xF3 th\u1EC3 x\xF3a tay trong Drive.`,
            advice: null
          });
        }
      }
      return finishDiagnostic(true);
      function finishDiagnostic(allOk) {
        let healed = false;
        if (allOk && mode !== "drive") {
          init();
          healed = mode === "drive";
          if (healed) {
            try {
              require_dataStore().reloadFromDrive();
            } catch {
            }
          }
        }
        return {
          ok: allOk,
          mode,
          healed,
          clientEmail: built && built.clientEmail || getServiceAccountEmail(),
          folderId: (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim(),
          steps,
          checkedAt,
          message: allOk ? 'K\u1EBFt n\u1ED1i Google Drive HO\u1EA0T \u0110\u1ED8NG \u0110\xDANG \u2014 h\xE3y b\u1EA5m "\u0110\u1ED3ng b\u1ED9 ngay" \u0111\u1EC3 \u0111\u1EA9y d\u1EEF li\u1EC7u \u0111ang ch\u1EDD l\xEAn Drive.' : 'Ph\xE1t hi\u1EC7n l\u1ED7i \u2014 l\xE0m theo g\u1EE3i \xFD c\u1EE7a m\u1EE9c FAIL \u0111\u1EA7u ti\xEAn, sau \u0111\xF3 b\u1EA5m "Ki\u1EC3m tra Drive ngay" l\u1EA7n n\u1EEFa.'
        };
      }
    }
    module2.exports = {
      init,
      getMode,
      isDriveMode,
      getServiceAccountEmail,
      findFileByName,
      createFile,
      downloadFile,
      updateFile,
      getFileMeta,
      runDiagnostic
    };
  }
});

// src/store/siteConfig.js
var require_siteConfig = __commonJS({
  "src/store/siteConfig.js"(exports2, module2) {
    "use strict";
    var dataStore = require_dataStore();
    var { statusOf } = require_examWindow();
    var SITE_CONFIG_KEY = "__siteConfig__";
    var SYSTEM_KEYS = [SITE_CONFIG_KEY, "__news__"];
    var DEFAULTS = {
      marquee: "",
      // Băng rôn khẩu hiệu chạy ngang (rỗng = khẩu hiệu mặc định)
      heroBadge: "",
      // Dòng nhãn nhỏ trên hero (VD: "Ban Tổ chức trân trọng kính mời")
      heroTitle: "",
      // Tiêu đề lớn hero (cho phép HTML)
      heroSubtitle: "",
      // Đoạn mô tả dưới tiêu đề (cho phép HTML)
      bannerUrl: "",
      // Ảnh bìa hero (URL https) — rỗng = nền gradient mặc định
      introHtml: "",
      // Nội dung khối "Giới thiệu chung" (cho phép HTML)
      rulesHtml: "",
      // Nội dung khối "Lưu ý" trong Thể lệ (cho phép HTML)
      principleHtml: "",
      // Nội dung khối "Nguyên tắc chấm điểm" (cho phép HTML)
      deadlineIso: "",
      // Hạn nhận bài dự thi — mốc đếm ngược trên trang chủ (ISO)
      intakeOpenAt: "",
      // Giờ MỞ CỬA nhận bài dự thi (ISO, rỗng = luôn mở)
      intakeCloseAt: "",
      // Giờ ĐÓNG CỬA nhận bài dự thi (ISO, rỗng = không đóng)
      // R10b — CHI TIẾT CHÂN TRANG (footer): rỗng = giữ nguyên nội dung gốc.
      footerAbout: "",
      // Cột 1 — đoạn giới thiệu chân trang (cho phép HTML)
      footerCredits: "",
      // Cột 1 — danh sách thành viên thực hiện (HTML <li>)
      footerContact: "",
      // Cột 2 — liên hệ Ban Tổ chức (HTML <li>)
      footerLinks: "",
      // Cột 3 — liên kết nhanh (HTML <li>)
      footerCopyright: ""
      // Dòng bản quyền cuối trang (văn bản thường)
    };
    var MAX_LEN = {
      marquee: 1e3,
      heroBadge: 300,
      heroTitle: 2e3,
      heroSubtitle: 5e3,
      bannerUrl: 1500,
      introHtml: 2e4,
      rulesHtml: 2e4,
      principleHtml: 2e4,
      // R10b — footer
      footerAbout: 5e3,
      footerCredits: 5e3,
      footerContact: 5e3,
      footerLinks: 3e3,
      footerCopyright: 500
    };
    function record() {
      try {
        return dataStore.get("users").find((u) => u && u.cccd === SITE_CONFIG_KEY) || null;
      } catch {
        return null;
      }
    }
    function getConfig() {
      const rec = record() || {};
      const { cccd, role, passwordHash, createdAt, ...rest } = rec;
      return { ...DEFAULTS, ...rest };
    }
    function intakeStatus(nowMs = Date.now()) {
      const cfg = getConfig();
      return statusOf(
        { openAt: cfg.intakeOpenAt || null, closeAt: cfg.intakeCloseAt || null },
        nowMs
      );
    }
    function sanitizePatch(body = {}) {
      const data = {};
      for (const key of Object.keys(DEFAULTS)) {
        if (body[key] === void 0) continue;
        const cap = MAX_LEN[key] || 2e3;
        data[key] = String(body[key] ?? "").slice(0, cap);
      }
      return { ok: true, data };
    }
    function setConfig(cleanData, updatedBy) {
      const users = dataStore.get("users");
      let rec = users.find((u) => u && u.cccd === SITE_CONFIG_KEY);
      if (!rec) {
        rec = { cccd: SITE_CONFIG_KEY, role: "siteconfig" };
        users.push(rec);
      }
      Object.assign(rec, cleanData);
      rec.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      rec.updatedBy = updatedBy || null;
      return dataStore.saveNow("users");
    }
    function isRealUser(u) {
      return Boolean(u && u.cccd && !SYSTEM_KEYS.includes(u.cccd));
    }
    module2.exports = { getConfig, setConfig, sanitizePatch, intakeStatus, DEFAULTS, isRealUser, SITE_CONFIG_KEY };
  }
});

// src/utils/crypto.js
var require_crypto = __commonJS({
  "src/utils/crypto.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    var config = require_config();
    var TOKEN_TTL_SECONDS = 60 * 60 * 12;
    var ATTEMPT_TTL_SECONDS = 60 * 60 * 24;
    function hashPassword(plain) {
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(String(plain), salt, 64).toString("hex");
      return `scrypt:${salt}:${hash}`;
    }
    function verifyPassword(plain, stored) {
      try {
        const [algo, salt, hash] = String(stored).split(":");
        if (algo !== "scrypt" || !salt || !hash) return false;
        const candidate = crypto.scryptSync(String(plain), salt, 64);
        const expected = Buffer.from(hash, "hex");
        if (candidate.length !== expected.length) return false;
        return crypto.timingSafeEqual(candidate, expected);
      } catch {
        return false;
      }
    }
    function b64url(buf) {
      return Buffer.from(buf).toString("base64url");
    }
    function signToken(payload, ttlSeconds = TOKEN_TTL_SECONDS) {
      const body = { ...payload, exp: Math.floor(Date.now() / 1e3) + ttlSeconds };
      const encoded = b64url(JSON.stringify(body));
      const sig = crypto.createHmac("sha256", config.sessionSecret).update(encoded).digest("base64url");
      return `${encoded}.${sig}`;
    }
    function verifyToken(token) {
      try {
        if (!token || typeof token !== "string") return null;
        const [encoded, sig] = token.split(".");
        if (!encoded || !sig) return null;
        const expected = crypto.createHmac("sha256", config.sessionSecret).update(encoded).digest("base64url");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        if (!payload || typeof payload.exp !== "number" || payload.exp * 1e3 < Date.now()) {
          return null;
        }
        return payload;
      } catch {
        return null;
      }
    }
    function newId(prefix) {
      return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
    }
    function signAttemptToken(cccd, examId, startedAtMs, extra) {
      const body = { t: "attempt", cccd, examId, startedAt: Math.floor(startedAtMs) };
      if (extra && typeof extra === "object") Object.assign(body, extra);
      return signToken(body, ATTEMPT_TTL_SECONDS);
    }
    function verifyAttemptToken(token, cccd, examId) {
      const payload = verifyToken(token);
      if (!payload || payload.t !== "attempt") return null;
      if (payload.cccd !== cccd || payload.examId !== examId) return null;
      if (!Number.isFinite(payload.startedAt) || payload.startedAt <= 0) return null;
      return payload;
    }
    module2.exports = {
      hashPassword,
      verifyPassword,
      signToken,
      verifyToken,
      signAttemptToken,
      verifyAttemptToken,
      newId,
      TOKEN_TTL_SECONDS,
      ATTEMPT_TTL_SECONDS
    };
  }
});

// src/store/newsStore.js
var require_newsStore = __commonJS({
  "src/store/newsStore.js"(exports2, module2) {
    "use strict";
    var dataStore = require_dataStore();
    var { newId } = require_crypto();
    var NEWS_KEY = "__news__";
    var MAX_ITEMS = 60;
    var FIELD_MAX = {
      title: 300,
      category: 60,
      emoji: 16,
      excerpt: 1200,
      content: 2e4
    };
    function record() {
      try {
        return dataStore.get("users").find((u) => u && u.cccd === NEWS_KEY) || null;
      } catch {
        return null;
      }
    }
    function sortNews(items) {
      return items.slice().sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
    }
    function all() {
      const rec = record();
      return sortNews(rec && Array.isArray(rec.items) ? rec.items : []);
    }
    function published() {
      return all().filter((n) => n && n.published);
    }
    function stripHtml(html) {
      return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    }
    function sanitizeArticle(body = {}) {
      const data = {};
      const title = String(body.title ?? "").trim();
      if (!title) return { ok: false, message: "Ti\xEAu \u0111\u1EC1 tin b\xE0i kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng." };
      if (title.length > FIELD_MAX.title) {
        return { ok: false, message: `Ti\xEAu \u0111\u1EC1 qu\xE1 d\xE0i (t\u1ED1i \u0111a ${FIELD_MAX.title} k\xFD t\u1EF1).` };
      }
      data.title = title;
      const content = String(body.content ?? "").trim();
      if (!content) return { ok: false, message: "N\u1ED9i dung tin b\xE0i kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng." };
      if (content.length > FIELD_MAX.content) {
        return { ok: false, message: `N\u1ED9i dung qu\xE1 d\xE0i (t\u1ED1i \u0111a ${FIELD_MAX.content} k\xFD t\u1EF1).` };
      }
      data.content = content;
      data.category = String(body.category ?? "").trim().slice(0, FIELD_MAX.category);
      data.emoji = String(body.emoji ?? "").trim().slice(0, FIELD_MAX.emoji) || "\u{1F4F0}";
      let excerpt = String(body.excerpt ?? "").trim().slice(0, FIELD_MAX.excerpt);
      if (!excerpt) {
        const flat = stripHtml(content);
        excerpt = flat.length > 180 ? `${flat.slice(0, 180)}\u2026` : flat;
      }
      data.excerpt = excerpt;
      data.published = Boolean(body.published);
      data.pinned = Boolean(body.pinned);
      return { ok: true, data };
    }
    async function create(cleanData, authorCccd) {
      const users = dataStore.get("users");
      let rec = users.find((u) => u && u.cccd === NEWS_KEY);
      if (!rec) {
        rec = { cccd: NEWS_KEY, role: "news", items: [] };
        users.push(rec);
      }
      if (!Array.isArray(rec.items)) rec.items = [];
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const article = {
        id: newId("news"),
        ...cleanData,
        createdBy: authorCccd || null,
        createdAt: now,
        updatedAt: now
      };
      rec.items.unshift(article);
      if (rec.items.length > MAX_ITEMS) rec.items.length = MAX_ITEMS;
      const sync = await dataStore.saveNow("users");
      return { article, sync };
    }
    async function update(id, cleanData) {
      const rec = record();
      const item = rec && Array.isArray(rec.items) ? rec.items.find((n) => n.id === id) : null;
      if (!item) return { notFound: true };
      Object.assign(item, cleanData, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      const sync = await dataStore.saveNow("users");
      return { article: item, sync };
    }
    async function remove(id) {
      const rec = record();
      if (!rec || !Array.isArray(rec.items)) return { notFound: true };
      const idx = rec.items.findIndex((n) => n.id === id);
      if (idx === -1) return { notFound: true };
      rec.items.splice(idx, 1);
      const sync = await dataStore.saveNow("users");
      return { sync };
    }
    module2.exports = {
      NEWS_KEY,
      FIELD_MAX,
      all,
      published,
      stripHtml,
      sanitizeArticle,
      create,
      update,
      remove
    };
  }
});

// src/routes/public.routes.js
var require_public_routes = __commonJS({
  "src/routes/public.routes.js"(exports2, module2) {
    "use strict";
    var express = require("express");
    var dataStore = require_dataStore();
    var siteConfig = require_siteConfig();
    var newsStore = require_newsStore();
    var driveClient = require_driveClient();
    var router = express.Router();
    var BUILD_TAG = "OES-VERCEL-R11";
    router.get("/stats", (req, res) => {
      const results = dataStore.get("results");
      const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + (Number(r.score) || 0), 0) / results.length * 100) / 100 : 0;
      res.json({
        users: dataStore.count("users"),
        exams: dataStore.count("exams"),
        results: results.length,
        avgScore
      });
    });
    router.get("/site-config", (req, res) => {
      res.json({ config: siteConfig.getConfig() });
    });
    router.get("/news", (req, res) => {
      res.json({ news: newsStore.published().slice(0, 12) });
    });
    router.get("/health", (req, res) => {
      res.json({
        ok: true,
        build: BUILD_TAG,
        mode: driveClient.getMode(),
        uptimeSeconds: Math.floor(process.uptime()),
        sync: dataStore.getSyncInfo()
      });
    });
    module2.exports = router;
  }
});

// src/middleware/auth.js
var require_auth = __commonJS({
  "src/middleware/auth.js"(exports2, module2) {
    "use strict";
    var { verifyToken } = require_crypto();
    function extractToken(req) {
      const header = req.headers.authorization || "";
      return header.startsWith("Bearer ") ? header.slice(7) : null;
    }
    function requireAuth(req, res, next) {
      const payload = verifyToken(extractToken(req));
      if (!payload) {
        return res.status(401).json({ message: "Phi\xEAn \u0111\u0103ng nh\u1EADp h\u1EBFt h\u1EA1n ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7. Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i." });
      }
      req.user = { cccd: payload.cccd, role: payload.role };
      next();
    }
    function requireAdmin(req, res, next) {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn m\u1EDBi \u0111\u01B0\u1EE3c th\u1EF1c hi\u1EC7n h\xE0nh \u0111\u1ED9ng n\xE0y." });
      }
      next();
    }
    module2.exports = { requireAuth, requireAdmin, extractToken };
  }
});

// src/utils/validate.js
var require_validate = __commonJS({
  "src/utils/validate.js"(exports2, module2) {
    "use strict";
    var { toIsoOrNull, fmtVn } = require_examWindow();
    var RE_CCCD = /^\d{12}$/;
    var RE_PHONE = /^0\d{9}$/;
    var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var OES_UNITS = [
      "V\u0103n ph\xF2ng",
      "Thanh tra - Khi\u1EBFu t\u1ED1",
      "Ph\xF2ng 1",
      "Ph\xF2ng 2",
      "Ph\xF2ng 3",
      "Ph\xF2ng 7",
      "Ph\xF2ng 8",
      "Ph\xF2ng 9",
      "Ph\xF2ng 10",
      "Ph\xF2ng 11",
      "Ph\xF2ng 15",
      "Khu v\u1EF1c 1",
      "Khu v\u1EF1c 2",
      "Khu v\u1EF1c 3",
      "Khu v\u1EF1c 4",
      "Khu v\u1EF1c 5",
      "Khu v\u1EF1c 6",
      "Khu v\u1EF1c 7",
      "Khu v\u1EF1c 8",
      "Khu v\u1EF1c 9",
      "Khu v\u1EF1c 10",
      "Khu v\u1EF1c 11",
      "Khu v\u1EF1c 12",
      "Tr\u01B0\u1EDDng h\u1ECDc",
      "Nh\xF3m tester"
    ];
    function firstError(pairs) {
      for (const [bad, msg] of pairs) if (bad) return msg;
      return null;
    }
    function validateRegister(body = {}) {
      const data = {
        fullName: String(body.fullName || "").trim().replace(/\s+/g, " "),
        // R11: Họ và tên — chuẩn hóa khoảng trắng
        cccd: String(body.cccd || "").trim(),
        phone: String(body.phone || "").trim(),
        email: String(body.email || "").trim().toLowerCase(),
        position: String(body.position || "").trim(),
        unit: String(body.unit || "").trim(),
        password: String(body.password || "")
      };
      const required = [
        ["fullName", "H\u1ECD v\xE0 t\xEAn"],
        ["cccd", "S\u1ED1 CCCD"],
        ["phone", "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i"],
        ["email", "Email"],
        ["position", "Ch\u1EE9c v\u1EE5"],
        ["unit", "\u0110\u01A1n v\u1ECB c\xF4ng t\xE1c"],
        ["password", "M\u1EADt kh\u1EA9u"]
      ];
      for (const [field, label] of required) {
        if (!data[field]) {
          return { ok: false, message: `Vui l\xF2ng nh\u1EADp \u0111\u1EE7 th\xF4ng tin: ${label} l\xE0 b\u1EAFt bu\u1ED9c.` };
        }
      }
      const message = firstError([
        [data.fullName.length < 2 || data.fullName.length > 80, "H\u1ECD v\xE0 t\xEAn ph\u1EA3i t\u1EEB 2 \u0111\u1EBFn 80 k\xFD t\u1EF1."],
        [!RE_CCCD.test(data.cccd), "S\u1ED1 CCCD ph\u1EA3i g\u1ED3m \u0111\xFAng 12 ch\u1EEF s\u1ED1."],
        [!RE_PHONE.test(data.phone), "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7 (10 s\u1ED1, b\u1EAFt \u0111\u1EA7u b\u1EB1ng 0, v\xED d\u1EE5 0912345678)."],
        [!RE_EMAIL.test(data.email), "\u0110\u1ECBa ch\u1EC9 email kh\xF4ng h\u1EE3p l\u1EC7."],
        [data.position.length < 2, "Vui l\xF2ng nh\u1EADp ch\u1EE9c v\u1EE5."],
        [!OES_UNITS.includes(data.unit), "\u0110\u01A1n v\u1ECB c\xF4ng t\xE1c kh\xF4ng h\u1EE3p l\u1EC7 \u2014 vui l\xF2ng CH\u1ECCN \u0111\xFAng \u0111\u01A1n v\u1ECB trong danh m\u1EE5c x\u1ED5 xu\u1ED1ng c\u1EE7a form \u0111\u0103ng k\xFD."],
        [data.password.length < 6, "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1."]
      ]);
      if (message) return { ok: false, message };
      return { ok: true, data };
    }
    function validateExamPayload(body = {}) {
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const category = String(body.category || "").trim();
      const durationMinutes = parseInt(body.durationMinutes, 10);
      const questions = Array.isArray(body.questions) ? body.questions : [];
      const base = firstError([
        [title.length < 3, "T\xEAn \u0111\u1EC1 thi ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 3 k\xFD t\u1EF1."],
        [!category, "Vui l\xF2ng nh\u1EADp h\u1EA1ng m\u1EE5c c\u1EE7a \u0111\u1EC1 thi."],
        [
          !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240,
          "Th\u1EDDi l\u01B0\u1EE3ng l\xE0m b\xE0i ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 240 ph\xFAt."
        ],
        [questions.length === 0, "\u0110\u1EC1 thi ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 1 c\xE2u h\u1ECFi."],
        [questions.length > 200, "\u0110\u1EC1 thi t\u1ED1i \u0111a 200 c\xE2u h\u1ECFi."]
      ]);
      if (base) return { ok: false, message: base };
      let openAt = null;
      let closeAt = null;
      if (body.openAt !== void 0 && body.openAt !== null && String(body.openAt).trim() !== "") {
        openAt = toIsoOrNull(body.openAt);
        if (openAt === void 0) {
          return { ok: false, message: "Gi\u1EDD M\u1EDE C\u1EECA thi kh\xF4ng h\u1EE3p l\u1EC7. H\xE3y ch\u1ECDn l\u1EA1i ng\xE0y gi\u1EDD trong \xF4 l\u1ECBch (\u0111\u1ECBnh d\u1EA1ng gi\u1EDD Vi\u1EC7t Nam GMT+7)." };
        }
      }
      if (body.closeAt !== void 0 && body.closeAt !== null && String(body.closeAt).trim() !== "") {
        closeAt = toIsoOrNull(body.closeAt);
        if (closeAt === void 0) {
          return { ok: false, message: "Gi\u1EDD \u0110\xD3NG C\u1EECA thi kh\xF4ng h\u1EE3p l\u1EC7. H\xE3y ch\u1ECDn l\u1EA1i ng\xE0y gi\u1EDD trong \xF4 l\u1ECBch (\u0111\u1ECBnh d\u1EA1ng gi\u1EDD Vi\u1EC7t Nam GMT+7)." };
        }
      }
      const scheduleErr = firstError([
        [
          openAt && closeAt && Date.parse(closeAt) <= Date.parse(openAt),
          `Gi\u1EDD \u0110\xD3NG C\u1EECA (${fmtVn(closeAt)}) ph\u1EA3i MU\u1ED8N h\u01A1n gi\u1EDD M\u1EDE C\u1EECA (${fmtVn(openAt)}).`
        ],
        [
          openAt && closeAt && Date.parse(closeAt) - Date.parse(openAt) < durationMinutes * 60 * 1e3,
          `Khung gi\u1EDD thi t\u1EEB ${fmtVn(openAt)} \u0111\u1EBFn ${fmtVn(closeAt)} qu\xE1 ng\u1EAFn so v\u1EDBi th\u1EDDi l\u01B0\u1EE3ng l\xE0m b\xE0i ${durationMinutes} ph\xFAt. H\xE3y k\xE9o d\xE0i gi\u1EDD \u0111\xF3ng c\u1EEDa (n\xEAn ch\u1EEBa th\xEAm d\u01B0 \u0111\u1ECBa 5\u201315 ph\xFAt cho th\xED sinh n\u1ED9p b\xE0i).`
        ]
      ]);
      if (scheduleErr) return { ok: false, message: scheduleErr };
      const normalized = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i] || {};
        const text = String(q.text || "").trim();
        const options = (Array.isArray(q.options) ? q.options : []).map((o) => String(o || "").trim()).filter(Boolean);
        const correctIndex = parseInt(q.correctIndex, 10);
        const qErr = firstError([
          [text.length < 3, `C\xE2u h\u1ECFi s\u1ED1 ${i + 1}: n\u1ED9i dung c\xE2u h\u1ECFi qu\xE1 ng\u1EAFn.`],
          [options.length < 2, `C\xE2u h\u1ECFi s\u1ED1 ${i + 1}: ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 2 ph\u01B0\u01A1ng \xE1n tr\u1EA3 l\u1EDDi.`],
          [options.length > 6, `C\xE2u h\u1ECFi s\u1ED1 ${i + 1}: t\u1ED1i \u0111a 6 ph\u01B0\u01A1ng \xE1n tr\u1EA3 l\u1EDDi.`],
          [
            !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length,
            `C\xE2u h\u1ECFi s\u1ED1 ${i + 1}: ch\u01B0a ch\u1ECDn \u0111\xFAng ph\u01B0\u01A1ng \xE1n \u0111\xFAng.`
          ]
        ]);
        if (qErr) return { ok: false, message: qErr };
        normalized.push({
          id: q.id || `q${i + 1}_${Math.random().toString(36).slice(2, 8)}`,
          text,
          options,
          correctIndex
        });
      }
      return {
        ok: true,
        data: { title, description, category, durationMinutes, openAt, closeAt, questions: normalized }
      };
    }
    module2.exports = { validateRegister, validateExamPayload, RE_CCCD, RE_PHONE, RE_EMAIL, OES_UNITS };
  }
});

// src/routes/auth.routes.js
var require_auth_routes = __commonJS({
  "src/routes/auth.routes.js"(exports2, module2) {
    "use strict";
    var express = require("express");
    var dataStore = require_dataStore();
    var { requireAuth } = require_auth();
    var { hashPassword, verifyPassword, signToken } = require_crypto();
    var { validateRegister } = require_validate();
    var config = require_config();
    var router = express.Router();
    var attempts = /* @__PURE__ */ new Map();
    var WINDOW_MS = 15 * 60 * 1e3;
    var MAX_ATTEMPTS = 6;
    function loginRateLimit(req, res, next) {
      const key = `${String(req.body && req.body.cccd || "").trim()}|${req.ip}`;
      const now = Date.now();
      const rec = attempts.get(key);
      if (!rec || now > rec.resetAt) {
        attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return next();
      }
      rec.count += 1;
      if (rec.count > MAX_ATTEMPTS) {
        const waitSec = Math.ceil((rec.resetAt - now) / 1e3);
        return res.status(429).json({
          message: `B\u1EA1n \u0111\xE3 nh\u1EADp sai qu\xE1 nhi\u1EC1u l\u1EA7n. Vui l\xF2ng th\u1EED l\u1EA1i sau ${waitSec} gi\xE2y.`
        });
      }
      next();
    }
    function publicUser(u) {
      return {
        cccd: u.cccd,
        fullName: u.fullName || "",
        // R11: Họ và tên (tài khoản cũ trước R11 có thể rỗng)
        phone: u.phone,
        email: u.email,
        position: u.position,
        unit: u.unit,
        role: u.role,
        createdAt: u.createdAt
      };
    }
    router.post("/register", async (req, res, next) => {
      try {
        if (!dataStore.isHealthy("users")) {
          return res.status(503).json({
            message: "H\u1EC7 th\u1ED1ng \u0111ang t\u1EA1m kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c kho d\u1EEF li\u1EC7u t\u1EEB Google Drive, n\xEAn ch\u01B0a th\u1EC3 nh\u1EADn \u0111\u0103ng k\xFD l\xFAc n\xE0y. Vui l\xF2ng th\u1EED l\u1EA1i sau \xEDt ph\xFAt (th\u01B0\u1EDDng ch\u1EC9 l\xE0 l\u1ED7i m\u1EA1ng/quota t\u1EA1m th\u1EDDi).",
            storeUnhealthy: true
          });
        }
        const check = validateRegister(req.body);
        if (!check.ok) return res.status(400).json({ message: check.message });
        const data = check.data;
        const users = dataStore.get("users");
        if (users.some((u) => u.cccd === data.cccd)) {
          return res.status(409).json({ message: "S\u1ED1 CCCD n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n." });
        }
        if (users.some((u) => u.email === data.email)) {
          return res.status(409).json({ message: "Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng b\u1EDFi t\xE0i kho\u1EA3n kh\xE1c." });
        }
        const role = config.adminCccds.includes(data.cccd) || users.length === 0 ? "admin" : "user";
        const user = {
          ...data,
          password: void 0,
          // không lưu mật khẩu thô
          passwordHash: hashPassword(data.password),
          role,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        delete user.password;
        users.push(user);
        const sync = await dataStore.saveNow("users");
        res.status(201).json({
          message: sync.synced ? "\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n th\xE0nh c\xF4ng!" : "\u0110\u0103ng k\xFD th\xE0nh c\xF4ng! NH\u01AFNG d\u1EEF li\u1EC7u ch\u01B0a \u0111\u1ED3ng b\u1ED9 \u0111\u01B0\u1EE3c l\xEAn Google Drive \u2014 ki\u1EC3m tra c\u1EA5u h\xECnh Drive (README m\u1EE5c 3) r\u1ED3i th\u1EED l\u1EA1i; h\u1EC7 th\u1ED1ng v\u1EABn t\u1EF1 \u0111\u1ED3ng b\u1ED9 khi Drive ho\u1EA1t \u0111\u1ED9ng tr\u1EDF l\u1EA1i.",
          token: signToken({ cccd: user.cccd, role: user.role }),
          user: publicUser(user)
        });
      } catch (err) {
        next(err);
      }
    });
    router.post("/login", loginRateLimit, async (req, res, next) => {
      try {
        const cccd = String(req.body.cccd || "").trim();
        const password = String(req.body.password || "");
        if (!cccd || !password) {
          return res.status(400).json({ message: "Vui l\xF2ng nh\u1EADp s\u1ED1 CCCD v\xE0 m\u1EADt kh\u1EA9u." });
        }
        const user = dataStore.get("users").find((u) => u.cccd === cccd);
        if (!user || !verifyPassword(password, user.passwordHash)) {
          return res.status(401).json({ message: "S\u1ED1 CCCD ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng \u0111\xFAng." });
        }
        if (user.role !== "admin" && config.adminCccds.includes(user.cccd)) {
          user.role = "admin";
          await dataStore.saveNow("users");
          console.log(`[auth] Da tu dong nang quyen ADMIN cho tai khoan mac dinh ${user.cccd}`);
        }
        res.json({
          message: "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng!",
          token: signToken({ cccd: user.cccd, role: user.role }),
          user: publicUser(user)
        });
      } catch (err) {
        next(err);
      }
    });
    router.get("/me", requireAuth, (req, res) => {
      const user = dataStore.get("users").find((u) => u.cccd === req.user.cccd);
      if (!user) return res.status(404).json({ message: "T\xE0i kho\u1EA3n kh\xF4ng c\xF2n t\u1ED3n t\u1EA1i." });
      res.json({ user: publicUser(user) });
    });
    module2.exports = router;
  }
});

// src/utils/scoring.js
var require_scoring = __commonJS({
  "src/utils/scoring.js"(exports2, module2) {
    "use strict";
    function round2(x) {
      return Math.round((Number(x) || 0) * 100) / 100;
    }
    function computeScales(correct, total) {
      const c = Math.max(0, Number(correct) || 0);
      const t = Math.max(0, Number(total) || 0);
      const pct = t > 0 ? c / t : 0;
      return {
        score10: round2(pct * 10),
        score100: round2(pct * 100),
        score60: round2(pct * 60)
      };
    }
    function scalesOfResult(result) {
      const s = computeScales(result && result.correct, result && result.total);
      const manual10 = result && result.score !== void 0 && result.score !== null ? Number(result.score) : NaN;
      return {
        score10: Number.isFinite(manual10) ? round2(manual10) : s.score10,
        score100: result && result.score100 !== void 0 && result.score100 !== null ? round2(result.score100) : s.score100,
        score60: result && result.score60 !== void 0 && result.score60 !== null ? round2(result.score60) : s.score60
      };
    }
    module2.exports = { computeScales, scalesOfResult, round2 };
  }
});

// src/utils/questionPool.js
var require_questionPool = __commonJS({
  "src/utils/questionPool.js"(exports2, module2) {
    "use strict";
    var crypto = require("crypto");
    var POOL_EXAM_ID = "exam_c6";
    var POOL_SOURCE_LABEL = "B\u1ED9 \u0111\u1EC1 s\u1ED1 6 \u2014 Lu\u1EADt An ninh m\u1EA1ng v\xE0 c\xE1c Ngh\u1ECB \u0111\u1ECBnh h\u01B0\u1EDBng d\u1EABn n\u0103m 2026";
    var FALLBACK_SOURCE_LABEL = "to\xE0n b\u1ED9 ng\xE2n h\xE0ng \u0111\u1EC1 thi c\u1EE7a cu\u1ED9c thi";
    function normalizeQText(t) {
      return String(t || "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    function sanitizeQuestions(questions) {
      const seenId = /* @__PURE__ */ new Set();
      const seenText = /* @__PURE__ */ new Set();
      const out = [];
      for (const q of questions || []) {
        const id = String(q.id || "");
        const text = normalizeQText(q.text);
        if (!id || seenId.has(id)) continue;
        if (text && seenText.has(text)) continue;
        if (!Array.isArray(q.options) || q.options.length < 2) continue;
        if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) continue;
        seenId.add(id);
        if (text) seenText.add(text);
        out.push(q);
      }
      return out;
    }
    function buildQuestionPool(dataStore) {
      const exams = dataStore.get("exams");
      const source = exams.find((e) => e.id === POOL_EXAM_ID);
      if (source) {
        const questions = sanitizeQuestions(source.questions);
        if (questions.length > 0) {
          return { questions, sourceId: POOL_EXAM_ID, sourceLabel: POOL_SOURCE_LABEL };
        }
      }
      const merged = [];
      for (const exam of exams) {
        for (const q of sanitizeQuestions(exam.questions)) merged.push(q);
      }
      const seen = /* @__PURE__ */ new Set();
      const pool = [];
      for (const q of merged) {
        const key = normalizeQText(q.text);
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push(q);
      }
      return { questions: pool, sourceId: null, sourceLabel: FALLBACK_SOURCE_LABEL };
    }
    function mulberry32(seed) {
      let t = seed >>> 0;
      return function next() {
        t += 1831565813;
        let r = Math.imul(t ^ t >>> 15, 1 | t);
        r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
        return ((r ^ r >>> 14) >>> 0) / 4294967296;
      };
    }
    function seedFromCccd(cccd) {
      const h = crypto.createHash("sha256").update(`oes-random30/v1|${String(cccd)}`).digest();
      return (h.readUInt32LE(0) ^ h.readUInt32LE(4) ^ h.readUInt32LE(8) ^ h.readUInt32LE(12)) >>> 0;
    }
    function pickDeterministic(pool, cccd, count) {
      const arr = pool.slice();
      const rand = mulberry32(seedFromCccd(cccd));
      const n = Math.min(count, arr.length);
      for (let i = 0; i < n; i += 1) {
        const j = i + Math.floor(rand() * (arr.length - i));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr.slice(0, n);
    }
    function maskQuestion(q) {
      return { id: q.id, text: q.text, options: q.options };
    }
    module2.exports = {
      POOL_EXAM_ID,
      POOL_SOURCE_LABEL,
      FALLBACK_SOURCE_LABEL,
      buildQuestionPool,
      pickDeterministic,
      maskQuestion,
      sanitizeQuestions
    };
  }
});

// src/routes/exam.routes.js
var require_exam_routes = __commonJS({
  "src/routes/exam.routes.js"(exports2, module2) {
    "use strict";
    var express = require("express");
    var dataStore = require_dataStore();
    var siteConfig = require_siteConfig();
    var { requireAuth } = require_auth();
    var { newId, signAttemptToken, verifyAttemptToken } = require_crypto();
    var { statusOf, gateMessage } = require_examWindow();
    var { computeScales } = require_scoring();
    var {
      buildQuestionPool,
      pickDeterministic,
      maskQuestion
    } = require_questionPool();
    var router = express.Router();
    router.use(requireAuth);
    var DURATION_GRACE_SECONDS = 15;
    var RANDOM_EXAM = {
      id: "random30",
      title: "\u0110\u1EC1 thi ng\u1EABu nhi\xEAn 30 c\xE2u \u2014 Lu\u1EADt An ninh m\u1EA1ng 2026",
      category: "Lu\u1EADt An ninh m\u1EA1ng v\xE0 c\xE1c Ngh\u1ECB \u0111\u1ECBnh h\u01B0\u1EDBng d\u1EABn 2026",
      durationMinutes: 20,
      questionCount: 30,
      // Thang 60 dành riêng cho đề 30 câu: MỖI CÂU 2 ĐIỂM (30 × 2 = 60).
      pointsPerQuestion: 2
    };
    router.post("/exams/random30/start", (req, res) => {
      const poolInfo = buildQuestionPool(dataStore);
      const pool = poolInfo.questions;
      if (pool.length === 0) {
        return res.status(503).json({ message: "Ng\xE2n h\xE0ng \u0111\u1EC1 thi \u0111ang tr\u1ED1ng. Vui l\xF2ng li\xEAn h\u1EC7 Ban T\u1ED5 ch\u1EE9c." });
      }
      const byId = new Map(pool.map((q) => [q.id, q]));
      const existing = verifyAttemptToken(req.body.attemptToken, req.user.cccd, RANDOM_EXAM.id);
      let questions = null;
      let startedAt = null;
      if (existing && Array.isArray(existing.qids) && existing.qids.length > 0) {
        const resumed = existing.qids.map((id) => byId.get(id)).filter(Boolean);
        if (resumed.length > 0) {
          questions = resumed;
          startedAt = existing.startedAt;
        }
      }
      if (!questions) {
        const win = siteConfig.intakeStatus();
        const blocked = gateMessage(win, "Cu\u1ED9c thi");
        if (blocked) return res.status(423).json({ message: blocked });
        if (pool.length < RANDOM_EXAM.questionCount) {
          return res.status(503).json({
            message: `Ng\xE2n h\xE0ng \u0111\u1EC1 thi hi\u1EC7n ch\u1EC9 c\xF3 ${pool.length} c\xE2u, ch\u01B0a \u0111\u1EE7 ${RANDOM_EXAM.questionCount} c\xE2u \u0111\u1EC3 tr\u1ED9n \u0111\u1EC1. Vui l\xF2ng li\xEAn h\u1EC7 Ban T\u1ED5 ch\u1EE9c.`
          });
        }
        questions = pickDeterministic(pool, req.user.cccd, RANDOM_EXAM.questionCount);
        startedAt = Date.now();
      }
      const qids = questions.map((q) => q.id);
      const totalSeconds = RANDOM_EXAM.durationMinutes * 60;
      const elapsed = Math.floor((Date.now() - startedAt) / 1e3);
      const remaining = Math.max(totalSeconds - elapsed, 0);
      res.json({
        startedAt: new Date(startedAt).toISOString(),
        serverNow: Date.now(),
        // R11: mốc giờ máy chủ để client hiển thị mili giây đồng bộ với server
        durationMinutes: RANDOM_EXAM.durationMinutes,
        remainingSeconds: remaining,
        totalQuestions: questions.length,
        pointsPerQuestion: RANDOM_EXAM.pointsPerQuestion,
        // Danh sách câu hỏi được ký HMAC bên trong token — client không thể đổi đề.
        attemptToken: signAttemptToken(req.user.cccd, RANDOM_EXAM.id, startedAt, { qids }),
        // Trả luôn đề trong phản hồi (client không cần gọi GET /exams/:id — đề ảo
        // không có trên danh sách đề công khai).
        exam: {
          id: RANDOM_EXAM.id,
          title: RANDOM_EXAM.title,
          description: `B\u1ED9 30 c\xE2u tr\u1ED9n t\u1EEB ${pool.length} c\xE2u c\u1EE7a ${poolInfo.sourceLabel}. M\u1ED7i c\xE2u 2 \u0111i\u1EC3m \u2014 thang \u0111i\u1EC3m 60.`,
          category: RANDOM_EXAM.category,
          durationMinutes: RANDOM_EXAM.durationMinutes,
          questions: questions.map(maskQuestion)
        }
      });
    });
    router.post("/exams/random30/submit", async (req, res, next) => {
      try {
        const poolInfo = buildQuestionPool(dataStore);
        const pool = poolInfo.questions;
        const byId = new Map(pool.map((q) => [q.id, q]));
        const totalSeconds = RANDOM_EXAM.durationMinutes * 60;
        const attempt = verifyAttemptToken(req.body.attemptToken, req.user.cccd, RANDOM_EXAM.id);
        let qids = null;
        let durationSeconds;
        let durationMs;
        let startedAtIso;
        if (attempt && Array.isArray(attempt.qids) && attempt.qids.length > 0) {
          qids = attempt.qids.filter((id) => byId.has(id));
          durationMs = Math.max(0, Date.now() - attempt.startedAt);
          durationSeconds = Math.floor(durationMs / 1e3);
          startedAtIso = new Date(attempt.startedAt).toISOString();
        } else {
          const win = siteConfig.intakeStatus();
          const blocked = gateMessage(win, "Cu\u1ED9c thi");
          if (blocked) return res.status(423).json({ message: blocked });
          const clientQids = Array.isArray(req.body.qids) ? req.body.qids.map(String) : [];
          qids = [...new Set(clientQids)].filter((id) => byId.has(id)).slice(0, 100);
          if (qids.length === 0) {
            return res.status(400).json({
              message: "Kh\xF4ng x\xE1c \u0111\u1ECBnh \u0111\u01B0\u1EE3c b\u1ED9 \u0111\u1EC1 c\u1EE7a l\u01B0\u1EE3t l\xE0m b\xE0i (thi\u1EBFu m\xE3 phi\xEAn thi). Vui l\xF2ng b\u1EAFt \u0111\u1EA7u l\u01B0\u1EE3t thi m\u1EDBi."
            });
          }
          const clientDur = parseInt(req.body.durationSeconds, 10);
          durationSeconds = Number.isFinite(clientDur) && clientDur > 0 ? Math.min(clientDur, totalSeconds) : totalSeconds;
          durationMs = durationSeconds * 1e3;
          startedAtIso = new Date(Date.now() - durationSeconds * 1e3).toISOString();
        }
        const questions = qids.map((id) => byId.get(id));
        if (questions.length === 0) {
          return res.status(400).json({ message: "B\u1ED9 \u0111\u1EC1 c\u1EE7a l\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng c\xF2n h\u1EE3p l\u1EC7 trong ng\xE2n h\xE0ng \u0111\u1EC1 thi." });
        }
        durationSeconds = Math.min(durationSeconds + DURATION_GRACE_SECONDS, totalSeconds);
        const attemptId = attempt ? `${RANDOM_EXAM.id}:${req.user.cccd}:${attempt.startedAt}` : null;
        if (attemptId) {
          const dup = dataStore.get("results").find((r) => r.attemptId === attemptId);
          if (dup) {
            return res.status(200).json({
              message: "B\xE0i n\u1ED9p c\u1EE7a l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c ghi nh\u1EADn tr\u01B0\u1EDBc \u0111\xF3.",
              duplicate: true,
              result: {
                id: dup.id,
                score: dup.score,
                score100: dup.score100,
                score60: dup.score60,
                correct: dup.correct,
                total: dup.total,
                durationSeconds: dup.durationSeconds,
                durationMs: dup.durationMs || dup.durationSeconds * 1e3
              }
            });
          }
        }
        const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
        const answerMap = new Map(
          answers.map((a) => [String(a && a.qid), parseInt(a && a.choice, 10)])
        );
        let correct = 0;
        for (const q of questions) {
          const choice = answerMap.get(q.id);
          if (Number.isInteger(choice) && choice === q.correctIndex) correct += 1;
        }
        const scales = computeScales(correct, questions.length);
        const result = {
          id: newId("res"),
          examId: RANDOM_EXAM.id,
          examTitle: RANDOM_EXAM.title,
          category: RANDOM_EXAM.category,
          cccd: req.user.cccd,
          attemptId,
          score: scales.score10,
          score100: scales.score100,
          score60: scales.score60,
          correct,
          total: questions.length,
          // Lưu bộ câu hỏi đã trộn của lượt này để đối chiếu/kiểm tra sau (audit).
          questionIds: qids.join(","),
          // R10: lưu TOÀN BỘ câu trả lời để Admin xem bài làm hoàn chỉnh từng thí sinh.
          answers: answers.filter((a) => a && byId.has(String(a.qid)) && Number.isInteger(parseInt(a.choice, 10))).map((a) => ({ q: String(a.qid), c: parseInt(a.choice, 10) })),
          startedAt: startedAtIso,
          durationSeconds,
          durationMs,
          // R11: thời gian làm bài THẬT (không cộng dung sai) — cơ sở phân hạng đồng điểm
          submittedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        dataStore.get("results").push(result);
        const sync = await dataStore.saveNow("results");
        res.status(201).json({
          message: sync.synced ? "\u0110\xE3 n\u1ED9p b\xE0i th\xE0nh c\xF4ng!" : "\u0110\xE3 n\u1ED9p b\xE0i th\xE0nh c\xF4ng! (D\u1EEF li\u1EC7u ch\u01B0a sync l\xEAn Drive \u2014 h\u1EC7 th\u1ED1ng s\u1EBD t\u1EF1 th\u1EED l\u1EA1i, b\u1EA1n kh\xF4ng c\u1EA7n l\xE0m g\xEC th\xEAm.)",
          result: {
            id: result.id,
            score: result.score,
            score100: result.score100,
            score60: result.score60,
            correct: result.correct,
            total: result.total,
            pointsPerQuestion: RANDOM_EXAM.pointsPerQuestion,
            durationSeconds: result.durationSeconds,
            durationMs: result.durationMs
          }
        });
      } catch (err) {
        next(err);
      }
    });
    router.get("/exams", (req, res) => {
      const poolInfo = buildQuestionPool(dataStore);
      const virtualRandom = poolInfo.questions.length > 0 ? {
        id: RANDOM_EXAM.id,
        title: RANDOM_EXAM.title,
        description: `\u0110\u1EC1 RI\xCANG cho t\u1EEBng th\xED sinh: 30 c\xE2u tr\u1ED9n t\u1EEB ${poolInfo.sourceLabel}. M\u1ED7i th\xED sinh nh\u1EADn m\u1ED9t b\u1ED9 \u0111\u1EC1 t\u1EA5t \u0111\u1ECBnh g\u1EAFn v\u1EDBi CCCD \u2014 v\xE0o l\u1EA1i v\u1EABn \u0111\xFAng b\u1ED9 \u0111\u1EC1 c\u0169.`,
        category: RANDOM_EXAM.category,
        durationMinutes: RANDOM_EXAM.durationMinutes,
        questionCount: RANDOM_EXAM.questionCount,
        pointsPerQuestion: RANDOM_EXAM.pointsPerQuestion,
        isRandom: true,
        poolQuestions: poolInfo.questions.length,
        poolSourceId: poolInfo.sourceId,
        // 'exam_c6' hoặc null (fallback toàn ngân hàng)
        poolSourceLabel: poolInfo.sourceLabel,
        // Khung giờ nhận bài dự thi của TOÀN HỆ THỐNG áp cho lượt mới.
        openAt: siteConfig.getConfig().intakeOpenAt || null,
        closeAt: siteConfig.getConfig().intakeCloseAt || null,
        windowStatus: siteConfig.intakeStatus().status,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
        // luôn đứng đầu danh sách
      } : null;
      const exams = dataStore.get("exams").map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        category: e.category,
        durationMinutes: e.durationMinutes,
        questionCount: (e.questions || []).length,
        createdAt: e.createdAt,
        // Giờ thi quy định: client dùng để khóa nút "Vào thi" + đếm ngược mở cửa.
        openAt: e.openAt || null,
        closeAt: e.closeAt || null,
        windowStatus: statusOf(e).status
      })).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
      res.json({ exams: virtualRandom ? [virtualRandom, ...exams] : exams });
    });
    router.get("/exams/:id", (req, res) => {
      const exam = dataStore.get("exams").find((e) => e.id === req.params.id);
      if (!exam) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EC1 thi." });
      res.json({
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          category: exam.category,
          durationMinutes: exam.durationMinutes,
          questions: (exam.questions || []).map((q) => ({
            id: q.id,
            text: q.text,
            options: q.options
          }))
        }
      });
    });
    router.post("/exams/:id/start", (req, res) => {
      const exam = dataStore.get("exams").find((e) => e.id === req.params.id);
      if (!exam) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EC1 thi." });
      const totalSeconds = exam.durationMinutes * 60;
      const existing = verifyAttemptToken(req.body.attemptToken, req.user.cccd, exam.id);
      let startedAt;
      if (existing) {
        startedAt = existing.startedAt;
      } else {
        const win = statusOf(exam);
        const blocked = gateMessage(win, exam.title);
        if (blocked) return res.status(423).json({ message: blocked });
        startedAt = Date.now();
      }
      const elapsed = Math.floor((Date.now() - startedAt) / 1e3);
      const remaining = Math.max(totalSeconds - elapsed, 0);
      res.json({
        startedAt: new Date(startedAt).toISOString(),
        serverNow: Date.now(),
        // R11: mốc giờ máy chủ để client hiển thị mili giây đồng bộ với server
        durationMinutes: exam.durationMinutes,
        remainingSeconds: remaining,
        totalQuestions: (exam.questions || []).length,
        // Client PHẢI giữ token này (localStorage) và gửi lại khi nộp bài/vào lại.
        attemptToken: signAttemptToken(req.user.cccd, exam.id, startedAt)
      });
    });
    router.post("/exams/:id/submit", async (req, res, next) => {
      try {
        const exam = dataStore.get("exams").find((e) => e.id === req.params.id);
        if (!exam) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EC1 thi." });
        const questions = exam.questions || [];
        if (questions.length === 0) {
          return res.status(400).json({ message: "\u0110\u1EC1 thi ch\u01B0a c\xF3 c\xE2u h\u1ECFi h\u1EE3p l\u1EC7." });
        }
        const attempt = verifyAttemptToken(req.body.attemptToken, req.user.cccd, exam.id);
        const totalSeconds = exam.durationMinutes * 60;
        let durationSeconds;
        let durationMs;
        let startedAtIso;
        if (attempt) {
          durationMs = Math.max(0, Date.now() - attempt.startedAt);
          durationSeconds = Math.floor(durationMs / 1e3);
          startedAtIso = new Date(attempt.startedAt).toISOString();
        } else {
          const win = statusOf(exam);
          const blocked = gateMessage(win, exam.title);
          if (blocked) return res.status(423).json({ message: blocked });
          const clientDur = parseInt(req.body.durationSeconds, 10);
          durationSeconds = Number.isFinite(clientDur) && clientDur > 0 ? clientDur : totalSeconds;
          durationSeconds = Math.min(durationSeconds, totalSeconds);
          durationMs = durationSeconds * 1e3;
          startedAtIso = new Date(Date.now() - durationSeconds * 1e3).toISOString();
        }
        durationSeconds = Math.min(durationSeconds + DURATION_GRACE_SECONDS, totalSeconds);
        const attemptId = attempt ? `${exam.id}:${req.user.cccd}:${attempt.startedAt}` : null;
        if (attemptId) {
          const dup = dataStore.get("results").find((r) => r.attemptId === attemptId);
          if (dup) {
            return res.status(200).json({
              message: "B\xE0i n\u1ED9p c\u1EE7a l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c ghi nh\u1EADn tr\u01B0\u1EDBc \u0111\xF3.",
              duplicate: true,
              result: {
                id: dup.id,
                score: dup.score,
                correct: dup.correct,
                total: dup.total,
                durationSeconds: dup.durationSeconds,
                durationMs: dup.durationMs || dup.durationSeconds * 1e3
              }
            });
          }
        }
        const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
        const answerMap = new Map(
          answers.map((a) => [String(a && a.qid), parseInt(a && a.choice, 10)])
        );
        let correct = 0;
        for (const q of questions) {
          const choice = answerMap.get(q.id);
          if (Number.isInteger(choice) && choice === q.correctIndex) correct += 1;
        }
        const scales = computeScales(correct, questions.length);
        const result = {
          id: newId("res"),
          examId: exam.id,
          examTitle: exam.title,
          category: exam.category,
          cccd: req.user.cccd,
          attemptId,
          // R8: định danh lượt làm bài — chống nộp trùng (null nếu lượt fallback)
          score: scales.score10,
          score100: scales.score100,
          score60: scales.score60,
          correct,
          total: questions.length,
          // R10: lưu TOÀN BỘ câu trả lời để Admin xem bài làm hoàn chỉnh từng thí sinh.
          answers: answers.filter((a) => a && questions.some((q) => q.id === String(a.qid)) && Number.isInteger(parseInt(a.choice, 10))).map((a) => ({ q: String(a.qid), c: parseInt(a.choice, 10) })),
          startedAt: startedAtIso,
          durationSeconds,
          durationMs,
          // R11: thời gian làm bài THẬT (không cộng dung sai)
          submittedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        dataStore.get("results").push(result);
        const sync = await dataStore.saveNow("results");
        res.status(201).json({
          message: sync.synced ? "\u0110\xE3 n\u1ED9p b\xE0i th\xE0nh c\xF4ng!" : "\u0110\xE3 n\u1ED9p b\xE0i th\xE0nh c\xF4ng! (D\u1EEF li\u1EC7u ch\u01B0a sync l\xEAn Drive \u2014 h\u1EC7 th\u1ED1ng s\u1EBD t\u1EF1 th\u1EED l\u1EA1i, b\u1EA1n kh\xF4ng c\u1EA7n l\xE0m g\xEC th\xEAm.)",
          result: {
            id: result.id,
            score: result.score,
            score100: result.score100,
            score60: result.score60,
            correct: result.correct,
            total: result.total,
            durationSeconds: result.durationSeconds,
            durationMs: result.durationMs
          }
        });
      } catch (err) {
        next(err);
      }
    });
    module2.exports = router;
  }
});

// src/utils/awards.js
var require_awards = __commonJS({
  "src/utils/awards.js"(exports2, module2) {
    "use strict";
    var { scalesOfResult } = require_scoring();
    function msOfResult(r) {
      if (!r) return 0;
      const direct = Number(r.durationMs);
      if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
      const secs = Number(r.durationSeconds);
      if (Number.isFinite(secs) && secs > 0) return Math.round(secs * 1e3);
      const a = Date.parse(r.startedAt || "");
      const b = Date.parse(r.submittedAt || "");
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) return b - a;
      return 0;
    }
    function decorate(r) {
      const s = scalesOfResult(r);
      return { ...r, ...s, durMs: msOfResult(r) };
    }
    function betterOf(a, b) {
      const A = decorate(a);
      const B = decorate(b);
      if (A.score10 !== B.score10) return A.score10 > B.score10 ? a : b;
      if (A.durMs !== B.durMs) return A.durMs < B.durMs ? a : b;
      const tA = String(a.submittedAt || "");
      const tB = String(b.submittedAt || "");
      if (tA !== tB) return tA < tB ? a : b;
      return String(a.cccd) <= String(b.cccd) ? a : b;
    }
    function bestAttempts(results) {
      const best = /* @__PURE__ */ new Map();
      for (const r of Array.isArray(results) ? results : []) {
        if (!r || !r.cccd) continue;
        const cur = best.get(r.cccd);
        if (!cur || betterOf(r, cur) === r) best.set(r.cccd, r);
      }
      return best;
    }
    var INDIVIDUAL_PRIZES = [
      "Gi\u1EA3i Nh\u1EA5t",
      "Gi\u1EA3i Nh\xEC",
      "Gi\u1EA3i Ba",
      "Gi\u1EA3i Khuy\u1EBFn kh\xEDch",
      "Gi\u1EA3i Khuy\u1EBFn kh\xEDch"
    ];
    var INDIVIDUAL_RULES = "X\u1EBFp h\u1EA1ng c\xE1 nh\xE2n theo: (1) \u0110i\u1EC3m thang 10 t\u1EEB cao xu\u1ED1ng th\u1EA5p; (2) c\xF9ng \u0111i\u1EC3m \u2192 th\u1EDDi gian l\xE0m b\xE0i \xCDT h\u01A1n x\u1EBFp tr\xEAn (t\xEDnh ch\xEDnh x\xE1c \u0111\u1EBFn mili gi\xE2y theo gi\u1EDD m\xE1y ch\u1EE7); (3) c\xF9ng th\u1EDDi gian \u2192 th\u1EDDi \u0111i\u1EC3m n\u1ED9p b\xE0i S\u1EDAM h\u01A1n x\u1EBFp tr\xEAn; (4) v\u1EABn tr\xF9ng \u2192 \u0111\u1ED3ng h\u1EA1ng, nh\u1EADn c\xF9ng gi\u1EA3i, gi\u1EA3i ph\xEDa sau b\u1ECB chi\u1EBFm ch\u1ED7 t\u01B0\u01A1ng \u1EE9ng.";
    function rankIndividuals(results) {
      const best = [...bestAttempts(results).values()].map(decorate);
      best.sort(
        (a, b) => b.score10 - a.score10 || a.durMs - b.durMs || String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")) || String(a.cccd).localeCompare(String(b.cccd), "vi")
      );
      const out = [];
      let i = 0;
      let slotIdx = 0;
      while (i < best.length) {
        let j = i + 1;
        while (j < best.length && best[j].score10 === best[i].score10 && best[j].durMs === best[i].durMs && String(best[j].submittedAt || "") === String(best[i].submittedAt || "")) j += 1;
        const groupSize = j - i;
        const rank = i + 1;
        const prize = slotIdx < INDIVIDUAL_PRIZES.length ? INDIVIDUAL_PRIZES[slotIdx] : null;
        for (let k = i; k < j; k += 1) {
          out.push({
            ...best[k],
            rank,
            prize: slotIdx < INDIVIDUAL_PRIZES.length ? prize : null,
            tieGroup: groupSize
          });
        }
        slotIdx += groupSize;
        i = j;
      }
      return out;
    }
    var EXCLUDED_TEAM_UNITS = ["Nh\xF3m tester"];
    var TEAM_GROUPS = {
      "khu-vuc": { label: "C\u1EA5p Khu v\u1EF1c", prize: "Gi\u1EA3i Nh\u1EA5t t\u1EADp th\u1EC3 \u2014 c\u1EA5p Khu v\u1EF1c", pattern: /^Khu\s*vực\s*\d+$/i },
      phong: { label: "C\u1EA5p Ph\xF2ng", prize: "Gi\u1EA3i Nh\u1EA5t t\u1EADp th\u1EC3 \u2014 c\u1EA5p Ph\xF2ng", pattern: null }
      // mọi đơn vị còn lại (trừ bị loại)
    };
    function classifyUnit(unit) {
      const u = String(unit || "").trim();
      if (EXCLUDED_TEAM_UNITS.includes(u)) return "excluded";
      if (TEAM_GROUPS["khu-vuc"].pattern.test(u)) return "khu-vuc";
      return "phong";
    }
    var TEAM_RULES = 'Gi\u1EA3i t\u1EADp th\u1EC3 g\u1ED3m 1 Gi\u1EA3i Nh\u1EA5t c\u1EA5p Khu v\u1EF1c v\xE0 1 Gi\u1EA3i Nh\u1EA5t c\u1EA5p Ph\xF2ng. Ti\xEAu ch\xED: (1) \u0110i\u1EC3m trung b\xECnh thang 10 c\u1EE7a \u0111\u01A1n v\u1ECB t\u1EEB cao xu\u1ED1ng th\u1EA5p; (2) c\xF9ng \u0111i\u1EC3m \u2192 t\u1EF7 l\u1EC7 tham d\u1EF1 cao h\u01A1n x\u1EBFp tr\xEAn; (3) c\xF9ng t\u1EF7 l\u1EC7 \u2192 s\u1ED1 th\xE0nh vi\xEAn \u0111\u1EA1t \u0110I\u1EC2M TUY\u1EC6T \u0110\u1ED0I thang 10 (10/10) nhi\u1EC1u h\u01A1n x\u1EBFp tr\xEAn; (4) tr\xF9ng c\u1EA3 3 ch\u1EC9 s\u1ED1 \u2192 \u0110\u1ED2NG GI\u1EA2I NH\u1EA4T c\u1EE7a nh\xF3m \u0111\xF3. Th\u1EE9 t\u1EF1 t\xEAn \u0111\u01A1n v\u1ECB KH\xD4NG \u0111\u01B0\u1EE3c d\xF9ng \u0111\u1EC3 ph\xE2n gi\u1EA3i. "Nh\xF3m tester" kh\xF4ng x\xE9t gi\u1EA3i.';
    function teamPrizes(teams) {
      const list = Array.isArray(teams) ? teams : [];
      const p10 = (t) => Math.max(0, Number(t && t.perfect10) || 0);
      const out = [];
      for (const key of ["khu-vuc", "phong"]) {
        const meta = TEAM_GROUPS[key];
        const eligible = list.filter((t) => classifyUnit(t.unit) === key && Number(t.participants) > 0).sort(
          (a, b) => b.avg10 - a.avg10 || b.participation - a.participation || p10(b) - p10(a)
          // trùng cả 3 chỉ số = đồng giải — giữ thứ tự gốc, KHÔNG A–Z
        );
        if (eligible.length === 0) {
          out.push({ group: key, label: meta.label, prize: meta.prize, winners: [], tie: false });
          continue;
        }
        const top = eligible[0];
        const winners = eligible.filter(
          (t) => t.avg10 === top.avg10 && t.participation === top.participation && p10(t) === p10(top)
        );
        out.push({
          group: key,
          label: meta.label,
          prize: meta.prize,
          tie: winners.length > 1,
          winners: winners.map((w) => ({
            unit: w.unit,
            avg10: w.avg10,
            avg100: w.avg100,
            avg60: w.avg60,
            participation: w.participation,
            perfect10: p10(w),
            // số thành viên đạt tuyệt đối thang 10
            registered: w.registered,
            participants: w.participants
          }))
        });
      }
      return out;
    }
    module2.exports = {
      msOfResult,
      decorate,
      betterOf,
      bestAttempts,
      rankIndividuals,
      teamPrizes,
      classifyUnit,
      INDIVIDUAL_PRIZES,
      INDIVIDUAL_RULES,
      TEAM_RULES,
      EXCLUDED_TEAM_UNITS
    };
  }
});

// src/routes/admin.routes.js
var require_admin_routes = __commonJS({
  "src/routes/admin.routes.js"(exports2, module2) {
    "use strict";
    var express = require("express");
    var dataStore = require_dataStore();
    var siteConfig = require_siteConfig();
    var newsStore = require_newsStore();
    var driveClient = require_driveClient();
    var { requireAuth, requireAdmin } = require_auth();
    var { hashPassword, verifyPassword, newId } = require_crypto();
    var { validateExamPayload, RE_CCCD, RE_PHONE, RE_EMAIL, OES_UNITS } = require_validate();
    var { toIsoOrNull, fmtVn } = require_examWindow();
    var { computeScales, scalesOfResult, round2 } = require_scoring();
    var {
      msOfResult,
      bestAttempts,
      decorate,
      rankIndividuals,
      teamPrizes,
      classifyUnit,
      INDIVIDUAL_PRIZES,
      INDIVIDUAL_RULES,
      TEAM_RULES
    } = require_awards();
    var { buildQuestionPool } = require_questionPool();
    var { missingSampleExams } = require_sampleExams();
    var router = express.Router();
    router.use(requireAuth, requireAdmin);
    function syncSuffix(sync) {
      return sync && sync.synced ? "" : " \u26A0 D\u1EEF li\u1EC7u CH\u01AFA \u0111\u1ED3ng b\u1ED9 l\xEAn Google Drive \u2014 h\u1EC7 th\u1ED1ng s\u1EBD t\u1EF1 th\u1EED l\u1EA1i m\u1ED7i 30 gi\xE2y.";
    }
    function guardWriteStore(key, res) {
      if (dataStore.isHealthy(key)) return false;
      console.warn(`[admin] CHAN ghi '${key}' \u2014 instance chua doc duoc Drive.`);
      res.status(503).json({
        message: 'H\u1EC7 th\u1ED1ng CH\u01AFA \u0111\u1ECDc \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u t\u1EEB Google Drive (m\u1EA1ng/quota/token t\u1EA1m l\u1ED7i), n\xEAn t\u1EA1m CH\u1EB6N c\xE1c thao t\xE1c ghi \u0111\u1EC3 b\u1EA3o v\u1EC7 d\u1EEF li\u1EC7u th\u1EADt. B\u1EA5m "Ki\u1EC3m tra Drive ngay" \u0111\u1EC3 ch\u1EA9n \u0111o\xE1n; khi Drive \u1ED5n \u0111\u1ECBnh, t\u1EA3i l\u1EA1i trang v\xE0 th\u1EF1c hi\u1EC7n l\u1EA1i thao t\xE1c.',
        synced: false,
        storeUnhealthy: true
      });
      return true;
    }
    router.get("/users", (req, res) => {
      const users = dataStore.get("users").filter(siteConfig.isRealUser).map(({ passwordHash, ...rest }) => rest);
      res.json({ users });
    });
    router.put("/users/:cccd", async (req, res, next) => {
      try {
        if (guardWriteStore("users", res)) return;
        if (!siteConfig.isRealUser({ cccd: req.params.cccd })) {
          return res.status(400).json({ message: "Kh\xF4ng th\u1EC3 s\u1EEDa b\u1EA3n ghi h\u1EC7 th\u1ED1ng." });
        }
        const user = dataStore.get("users").find((u) => u.cccd === req.params.cccd);
        if (!user) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng." });
        const b = req.body || {};
        const errors = [];
        if (b.fullName !== void 0) {
          const fn = String(b.fullName).trim().replace(/\s+/g, " ");
          if (fn.length < 2 || fn.length > 80) errors.push("H\u1ECD v\xE0 t\xEAn ph\u1EA3i t\u1EEB 2 \u0111\u1EBFn 80 k\xFD t\u1EF1.");
          else user.fullName = fn;
        }
        if (b.phone !== void 0) {
          const phone = String(b.phone).trim();
          if (!RE_PHONE.test(phone)) errors.push("S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7 (10 s\u1ED1, b\u1EAFt \u0111\u1EA7u b\u1EB1ng 0).");
          else user.phone = phone;
        }
        if (b.email !== void 0) {
          const email = String(b.email).trim().toLowerCase();
          if (!RE_EMAIL.test(email)) errors.push("Email kh\xF4ng h\u1EE3p l\u1EC7.");
          else if (dataStore.get("users").some((u) => u.email === email && u.cccd !== user.cccd))
            errors.push("Email \u0111\xE3 \u0111\u01B0\u1EE3c t\xE0i kho\u1EA3n kh\xE1c s\u1EED d\u1EE5ng.");
          else user.email = email;
        }
        if (b.position !== void 0) {
          const pos = String(b.position).trim();
          if (pos.length < 2) errors.push("Ch\u1EE9c v\u1EE5 kh\xF4ng h\u1EE3p l\u1EC7.");
          else user.position = pos;
        }
        if (b.unit !== void 0) {
          const unit = String(b.unit).trim();
          if (unit.length < 2) errors.push("\u0110\u01A1n v\u1ECB c\xF4ng t\xE1c kh\xF4ng h\u1EE3p l\u1EC7.");
          else user.unit = unit;
        }
        if (b.role !== void 0) {
          const role = String(b.role);
          if (!["user", "admin"].includes(role)) errors.push("Quy\u1EC1n kh\xF4ng h\u1EE3p l\u1EC7 (user/admin).");
          else if (role !== "admin" && user.cccd === req.user.cccd)
            errors.push("Kh\xF4ng th\u1EC3 t\u1EF1 h\u1EA1 quy\u1EC1n c\u1EE7a ch\xEDnh t\xE0i kho\u1EA3n \u0111ang \u0111\u0103ng nh\u1EADp.");
          else user.role = role;
        }
        if (b.password) {
          const pw = String(b.password);
          if (pw.length < 6) errors.push("M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1.");
          else user.passwordHash = hashPassword(pw);
        }
        if (errors.length) return res.status(400).json({ message: errors.join(" ") });
        const sync = await dataStore.saveNow("users");
        const { passwordHash, ...safe } = user;
        res.json({ message: `\u0110\xE3 c\u1EADp nh\u1EADt th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng.${syncSuffix(sync)}`, synced: sync.synced, user: safe });
      } catch (err) {
        next(err);
      }
    });
    router.delete("/users/:cccd", async (req, res, next) => {
      try {
        if (guardWriteStore("users", res)) return;
        if (req.params.cccd === req.user.cccd) {
          return res.status(400).json({ message: "Kh\xF4ng th\u1EC3 t\u1EF1 x\xF3a t\xE0i kho\u1EA3n \u0111ang \u0111\u0103ng nh\u1EADp." });
        }
        if (!siteConfig.isRealUser({ cccd: req.params.cccd })) {
          return res.status(400).json({ message: "Kh\xF4ng th\u1EC3 x\xF3a b\u1EA3n ghi h\u1EC7 th\u1ED1ng." });
        }
        const users = dataStore.get("users");
        const idx = users.findIndex((u) => u.cccd === req.params.cccd);
        if (idx === -1) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng." });
        users.splice(idx, 1);
        const sync = await dataStore.saveNow("users");
        res.json({ message: `\u0110\xE3 x\xF3a ng\u01B0\u1EDDi d\xF9ng kh\u1ECFi h\u1EC7 th\u1ED1ng.${syncSuffix(sync)}`, synced: sync.synced });
      } catch (err) {
        next(err);
      }
    });
    router.post("/exams", async (req, res, next) => {
      try {
        if (guardWriteStore("exams", res)) return;
        const check = validateExamPayload(req.body);
        if (!check.ok) return res.status(400).json({ message: check.message });
        const twoMinutesAgo = Date.now() - 2 * 60 * 1e3;
        const dup = dataStore.get("exams").find(
          (e) => e.title === check.data.title && e.category === check.data.category && new Date(e.createdAt).getTime() > twoMinutesAgo
        );
        if (dup) {
          return res.status(409).json({
            message: `\u0110\u1EC1 thi "${dup.title}" v\u1EEBa \u0111\u01B0\u1EE3c t\u1EA1o l\xFAc ${new Date(dup.createdAt).toLocaleTimeString("vi-VN")}. Kh\xF4ng t\u1EA1o l\u1EA1i \u0111\u1EC1 tr\xF9ng t\xEAn trong v\xF2ng 2 ph\xFAt (c\xF3 th\u1EC3 b\u1EA1n \u0111\xE3 b\u1EA5m n\xFAt L\u01B0u nhi\u1EC1u l\u1EA7n).`,
            exam: { id: dup.id, title: dup.title }
          });
        }
        const exam = {
          id: newId("exam"),
          ...check.data,
          createdBy: req.user.cccd,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        dataStore.get("exams").push(exam);
        const sync = await dataStore.saveNow("exams");
        res.status(201).json({
          message: `\u0110\xE3 t\u1EA1o \u0111\u1EC1 thi "${exam.title}" v\u1EDBi ${exam.questions.length} c\xE2u h\u1ECFi.${syncSuffix(sync)}`,
          synced: sync.synced,
          exam: { id: exam.id, title: exam.title }
        });
      } catch (err) {
        next(err);
      }
    });
    router.get("/exams/:id", (req, res) => {
      const exam = dataStore.get("exams").find((e) => e.id === req.params.id);
      if (!exam) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EC1 thi." });
      res.json({ exam });
    });
    router.put("/exams/:id", async (req, res, next) => {
      try {
        if (guardWriteStore("exams", res)) return;
        const exam = dataStore.get("exams").find((e) => e.id === req.params.id);
        if (!exam) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EC1 thi." });
        const check = validateExamPayload(req.body);
        if (!check.ok) return res.status(400).json({ message: check.message });
        exam.title = check.data.title;
        exam.description = check.data.description;
        exam.category = check.data.category;
        exam.durationMinutes = check.data.durationMinutes;
        exam.openAt = check.data.openAt || null;
        exam.closeAt = check.data.closeAt || null;
        exam.questions = check.data.questions;
        exam.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        exam.updatedBy = req.user.cccd;
        const sync = await dataStore.saveNow("exams");
        const schedTxt = exam.openAt ? ` M\u1EDF c\u1EEDa t\u1EEB ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(Date.parse(exam.openAt))} (gi\u1EDD VN).` : " (Kh\xF4ng quy \u0111\u1ECBnh gi\u1EDD thi \u2014 th\xED sinh thi \u0111\u01B0\u1EE3c m\u1ECDi l\xFAc.)";
        res.json({
          message: `\u0110\xE3 c\u1EADp nh\u1EADt \u0111\u1EC1 thi "${exam.title}" (${exam.questions.length} c\xE2u h\u1ECFi).${schedTxt}${syncSuffix(sync)}`,
          synced: sync.synced,
          exam: { id: exam.id, title: exam.title }
        });
      } catch (err) {
        next(err);
      }
    });
    router.delete("/exams/:id", async (req, res, next) => {
      try {
        if (guardWriteStore("exams", res)) return;
        const exams = dataStore.get("exams");
        const idx = exams.findIndex((e) => e.id === req.params.id);
        if (idx === -1) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EC1 thi." });
        const [removed] = exams.splice(idx, 1);
        const sync = await dataStore.saveNow("exams");
        res.json({
          message: `\u0110\xE3 x\xF3a \u0111\u1EC1 thi "${removed.title}".${syncSuffix(sync)}`,
          synced: sync.synced
        });
      } catch (err) {
        next(err);
      }
    });
    router.post("/seed-sample-exams", async (req, res, next) => {
      try {
        if (guardWriteStore("exams", res)) return;
        const missing = missingSampleExams(dataStore.get("exams"));
        if (missing.length === 0) {
          return res.json({
            message: "C\xE1c b\u1ED9 \u0111\u1EC1 m\u1EABu \u0111\xE3 c\xF3 \u0111\u1EE7 trong h\u1EC7 th\u1ED1ng \u2014 kh\xF4ng c\u1EA7n n\u1EA1p l\u1EA1i.",
            added: 0
          });
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        for (const s of missing) {
          dataStore.get("exams").push({ ...s, createdBy: req.user.cccd, createdAt: now });
        }
        const sync = await dataStore.saveNow("exams");
        const names = missing.map((s) => s.title).join("; ");
        res.status(201).json({
          message: `\u0110\xE3 n\u1EA1p ${missing.length} b\u1ED9 \u0111\u1EC1 m\u1EABu: ${names}.${syncSuffix(sync)}`,
          synced: sync.synced,
          added: missing.length
        });
      } catch (err) {
        next(err);
      }
    });
    router.post("/sync", async (req, res, next) => {
      try {
        for (const key of dataStore.FILES) await dataStore.saveNow(key);
        const sync = dataStore.getSyncInfo();
        const pending = sync.filter((s) => s.pending);
        if (pending.length === 0) {
          return res.json({
            message: "M\u1ECDi d\u1EEF li\u1EC7u \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1ED3ng b\u1ED9 an to\xE0n l\xEAn Google Drive.",
            synced: true,
            sync
          });
        }
        const firstError = pending.find((s) => s.lastError);
        const errText = firstError ? ` Nguy\xEAn nh\xE2n g\u1EA7n nh\u1EA5t: ${firstError.lastError}` : "";
        res.json({
          message: `V\u1EABn c\xF2n ${pending.length} file CH\u01AFA \u0111\u1ED3ng b\u1ED9 \u0111\u01B0\u1EE3c l\xEAn Google Drive.${errText} B\u1EA5m "Ki\u1EC3m tra Drive ngay" \u0111\u1EC3 ch\u1EA9n \u0111o\xE1n ch\xEDnh x\xE1c nguy\xEAn nh\xE2n v\xE0 c\xE1ch s\u1EEDa.`,
          synced: false,
          sync
        });
      } catch (err) {
        next(err);
      }
    });
    router.post("/drive-check", async (req, res, next) => {
      try {
        const result = await driveClient.runDiagnostic();
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
    router.get("/site-config", (req, res) => {
      res.json({ config: siteConfig.getConfig() });
    });
    router.put("/site-config", async (req, res, next) => {
      try {
        if (guardWriteStore("users", res)) return;
        const b = req.body || {};
        const patch = {};
        const { DEFAULTS } = siteConfig;
        for (const key of Object.keys(DEFAULTS)) {
          if (b[key] === void 0) continue;
          if (key === "deadlineIso" || key === "intakeOpenAt" || key === "intakeCloseAt") continue;
          patch[key] = String(b[key] ?? "");
        }
        for (const key of ["deadlineIso", "intakeOpenAt", "intakeCloseAt"]) {
          if (b[key] === void 0) continue;
          const raw = String(b[key] || "").trim();
          if (!raw) {
            patch[key] = "";
            continue;
          }
          const iso = toIsoOrNull(raw);
          if (iso === void 0) {
            return res.status(400).json({ message: "Ng\xE0y gi\u1EDD kh\xF4ng h\u1EE3p l\u1EC7 \u2014 h\xE3y ch\u1ECDn l\u1EA1i trong \xF4 l\u1ECBch (gi\u1EDD Vi\u1EC7t Nam GMT+7)." });
          }
          patch[key] = iso;
        }
        if (patch.intakeOpenAt && patch.intakeCloseAt && Date.parse(patch.intakeCloseAt) <= Date.parse(patch.intakeOpenAt)) {
          return res.status(400).json({
            message: `Gi\u1EDD \u0110\xD3NG C\u1EECA nh\u1EADn b\xE0i (${fmtVn(patch.intakeCloseAt)}) ph\u1EA3i MU\u1ED8N h\u01A1n gi\u1EDD M\u1EDE C\u1EECA (${fmtVn(patch.intakeOpenAt)}).`
          });
        }
        const clean = siteConfig.sanitizePatch(patch);
        const sync = await siteConfig.setConfig(clean.data, req.user.cccd);
        res.json({
          message: `\u0110\xE3 l\u01B0u c\u1EA5u h\xECnh giao di\u1EC7n & th\u1EDDi gian nh\u1EADn b\xE0i d\u1EF1 thi.${syncSuffix(sync)}`,
          synced: sync.synced,
          config: siteConfig.getConfig()
        });
      } catch (err) {
        next(err);
      }
    });
    router.get("/news", (req, res) => {
      res.json({ news: newsStore.all() });
    });
    router.post("/news", async (req, res, next) => {
      try {
        if (guardWriteStore("users", res)) return;
        const check = newsStore.sanitizeArticle(req.body);
        if (!check.ok) return res.status(400).json({ message: check.message });
        const { article, sync } = await newsStore.create(check.data, req.user.cccd);
        res.status(201).json({
          message: `\u0110\xE3 ${article.published ? "\u0111\u0103ng" : "l\u01B0u nh\xE1p"} tin b\xE0i "${article.title}".${syncSuffix(sync)}`,
          synced: sync.synced,
          article
        });
      } catch (err) {
        next(err);
      }
    });
    router.put("/news/:id", async (req, res, next) => {
      try {
        if (guardWriteStore("users", res)) return;
        const check = newsStore.sanitizeArticle(req.body);
        if (!check.ok) return res.status(400).json({ message: check.message });
        const out = await newsStore.update(req.params.id, check.data);
        if (out.notFound) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y tin b\xE0i." });
        res.json({
          message: `\u0110\xE3 c\u1EADp nh\u1EADt tin b\xE0i "${out.article.title}".${syncSuffix(out.sync)}`,
          synced: out.sync.synced,
          article: out.article
        });
      } catch (err) {
        next(err);
      }
    });
    router.delete("/news/:id", async (req, res, next) => {
      try {
        if (guardWriteStore("users", res)) return;
        const out = await newsStore.remove(req.params.id);
        if (out.notFound) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y tin b\xE0i." });
        res.json({ message: `\u0110\xE3 x\xF3a tin b\xE0i.${syncSuffix(out.sync)}`, synced: out.sync.synced });
      } catch (err) {
        next(err);
      }
    });
    router.get("/results", (req, res) => {
      const userByCccd = new Map(dataStore.get("users").map((u) => [u.cccd, u]));
      const results = [...dataStore.get("results")].sort((a, b) => a.submittedAt < b.submittedAt ? 1 : -1).map((r) => {
        const s = scalesOfResult(r);
        const u = userByCccd.get(r.cccd);
        return {
          ...r,
          score: s.score10,
          score100: s.score100,
          score60: s.score60,
          durationMs: msOfResult(r),
          // R11: mili giây (bản cũ suy ra từ giây)
          fullName: u && u.fullName || "",
          // R11: Họ và tên (tài khoản cũ có thể rỗng)
          userUnit: u && u.unit || "",
          userPosition: u && u.position || ""
        };
      });
      res.json({ results });
    });
    router.put("/results/:id", async (req, res, next) => {
      try {
        if (guardWriteStore("results", res)) return;
        const result = dataStore.get("results").find((r) => r.id === req.params.id);
        if (!result) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y k\u1EBFt qu\u1EA3 b\xE0i l\xE0m." });
        const b = req.body || {};
        let touched = false;
        if (b.correct !== void 0) {
          const correct = parseInt(b.correct, 10);
          if (!Number.isInteger(correct) || correct < 0 || correct > result.total) {
            return res.status(400).json({ message: `S\u1ED1 c\xE2u \u0111\xFAng ph\u1EA3i trong kho\u1EA3ng 0\u2013${result.total}.` });
          }
          result.correct = correct;
          const s = computeScales(correct, result.total);
          result.score = s.score10;
          result.score100 = s.score100;
          result.score60 = s.score60;
          touched = true;
        }
        if (b.score !== void 0) {
          const score = Number(b.score);
          if (!Number.isFinite(score) || score < 0 || score > 10) {
            return res.status(400).json({ message: "\u0110i\u1EC3m s\u1ED1 ph\u1EA3i trong kho\u1EA3ng 0\u201310." });
          }
          const pct = score / 10;
          result.score = Math.round(score * 100) / 100;
          result.score100 = round2(pct * 100);
          result.score60 = round2(pct * 60);
          touched = true;
        }
        if (b.note !== void 0) {
          result.note = String(b.note).slice(0, 300);
          touched = true;
        }
        if (!touched) return res.status(400).json({ message: "Kh\xF4ng c\xF3 tr\u01B0\u1EDDng n\xE0o c\u1EA7n thay \u0111\u1ED5i." });
        result.editedAt = (/* @__PURE__ */ new Date()).toISOString();
        result.editedBy = req.user.cccd;
        const sync = await dataStore.saveNow("results");
        res.json({ message: `\u0110\xE3 c\u1EADp nh\u1EADt k\u1EBFt qu\u1EA3 b\xE0i l\xE0m.${syncSuffix(sync)}`, synced: sync.synced, result });
      } catch (err) {
        next(err);
      }
    });
    router.delete("/results/:id", async (req, res, next) => {
      try {
        const results = dataStore.get("results");
        const idx = results.findIndex((r) => r.id === req.params.id);
        if (idx === -1) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y k\u1EBFt qu\u1EA3 b\xE0i l\xE0m." });
        results.splice(idx, 1);
        const sync = await dataStore.saveNow("results");
        res.json({ message: `\u0110\xE3 x\xF3a k\u1EBFt qu\u1EA3 b\xE0i l\xE0m.${syncSuffix(sync)}`, synced: sync.synced });
      } catch (err) {
        next(err);
      }
    });
    var EXCLUDED_TEAM_UNITS = require_awards().EXCLUDED_TEAM_UNITS;
    router.get("/team-results", (req, res) => {
      const all = dataStore.get("results");
      const users = dataStore.get("users").filter(siteConfig.isRealUser);
      const userByCccd = new Map(users.map((u) => [u.cccd, u]));
      const examMap = /* @__PURE__ */ new Map();
      for (const r of all) {
        if (!examMap.has(r.examId)) examMap.set(r.examId, { id: r.examId, title: r.examTitle, category: r.category });
      }
      let examId = String(req.query.examId || "").trim();
      if (!examId) {
        examId = all.some((r) => r.examId === "random30") ? "random30" : "";
      }
      const list = examId ? all.filter((r) => r.examId === examId) : all;
      const bestByCccd = bestAttempts(list);
      const bestDecorated = /* @__PURE__ */ new Map();
      for (const [cccd, r] of bestByCccd) bestDecorated.set(cccd, decorate(r));
      const attemptsByCccd = /* @__PURE__ */ new Map();
      for (const r of list) attemptsByCccd.set(r.cccd, (attemptsByCccd.get(r.cccd) || 0) + 1);
      const teams = /* @__PURE__ */ new Map();
      const ensureTeam = (unit) => {
        if (!teams.has(unit)) {
          teams.set(unit, {
            unit,
            registered: 0,
            participants: 0,
            attempts: 0,
            sum10: 0,
            sum100: 0,
            sum60: 0,
            best10: 0,
            perfect10: 0,
            // R11: số thành viên đạt ĐIỂM TUYỆT ĐỐI thang 10 (10/10)
            topMembers: [],
            excluded: EXCLUDED_TEAM_UNITS.includes(unit)
          });
        }
        return teams.get(unit);
      };
      for (const u of users) ensureTeam(u.unit || "Ch\u01B0a x\xE1c \u0111\u1ECBnh").registered += 1;
      for (const [cccd, n] of attemptsByCccd) {
        const t = ensureTeam((userByCccd.get(cccd) || {}).unit || "Ch\u01B0a x\xE1c \u0111\u1ECBnh");
        t.attempts += n;
      }
      for (const [cccd, b] of bestDecorated) {
        const u = userByCccd.get(cccd) || {};
        const t = ensureTeam(u.unit || "Ch\u01B0a x\xE1c \u0111\u1ECBnh");
        t.participants += 1;
        t.sum10 += b.score10;
        t.sum100 += b.score100;
        t.sum60 += b.score60;
        if (b.score10 > t.best10) t.best10 = b.score10;
        if (b.score10 === 10) t.perfect10 += 1;
        if (!t.firstSubmittedAt || String(b.submittedAt) < String(t.firstSubmittedAt)) {
          t.firstSubmittedAt = b.submittedAt;
        }
        t.topMembers.push({
          cccd,
          fullName: u.fullName || "",
          // R11: Họ và tên thí sinh
          score10: b.score10,
          score100: b.score100,
          score60: b.score60,
          correct: b.correct,
          total: b.total,
          durMs: b.durMs,
          // R11: thời gian làm bài mili giây
          submittedAt: b.submittedAt
        });
      }
      const rows = [...teams.values()].map((t) => ({
        unit: t.unit,
        registered: t.registered,
        participants: t.participants,
        attempts: t.attempts,
        participation: t.registered > 0 ? Math.round(t.participants / t.registered * 100) : 0,
        avg10: t.participants > 0 ? round2(t.sum10 / t.participants) : 0,
        avg100: t.participants > 0 ? round2(t.sum100 / t.participants) : 0,
        avg60: t.participants > 0 ? round2(t.sum60 / t.participants) : 0,
        best10: round2(t.best10),
        perfect10: t.perfect10,
        // R11: số bài đạt tuyệt đối thang 10 — tiêu chí xét giải
        firstSubmittedAt: t.firstSubmittedAt || null,
        // R11: chỉ hiển thị, không phân giải
        topMembers: t.topMembers.sort((a, b) => b.score10 - a.score10 || a.durMs - b.durMs || String(a.submittedAt).localeCompare(String(b.submittedAt))).slice(0, 3),
        excluded: t.excluded,
        groupClass: classifyUnit(t.unit)
        // R11: 'khu-vuc' | 'phong' | 'excluded'
      }));
      rows.sort((a, b) => {
        if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
        if (b.avg10 !== a.avg10) return b.avg10 - a.avg10;
        if (b.participation !== a.participation) return b.participation - a.participation;
        return (b.perfect10 || 0) - (a.perfect10 || 0);
      });
      rows.forEach((t, i) => {
        if (t.excluded) {
          t.rank = null;
          return;
        }
        const prev = i > 0 ? rows[i - 1] : null;
        const sameAsPrev = prev && !prev.excluded && prev.avg10 === t.avg10 && prev.participation === t.participation && (prev.perfect10 || 0) === (t.perfect10 || 0);
        t.rank = sameAsPrev ? prev.rank : i + 1;
      });
      const totals = {
        teams: rows.filter((t) => !t.excluded).length,
        registered: rows.reduce((s, t) => s + t.registered, 0),
        participants: rows.reduce((s, t) => s + t.participants, 0),
        attempts: rows.reduce((s, t) => s + t.attempts, 0),
        avg10: bestByCccd.size > 0 ? round2([...bestByCccd.values()].reduce((s, b) => s + b.score10, 0) / bestByCccd.size) : 0,
        avg100: bestByCccd.size > 0 ? round2([...bestByCccd.values()].reduce((s, b) => s + b.score100, 0) / bestByCccd.size) : 0,
        avg60: bestByCccd.size > 0 ? round2([...bestByCccd.values()].reduce((s, b) => s + b.score60, 0) / bestByCccd.size) : 0
      };
      res.json({ examId: examId || "ALL", exams: [...examMap.values()], teams: rows, totals });
    });
    router.get("/awards", (req, res) => {
      const all = dataStore.get("results");
      const users = dataStore.get("users").filter(siteConfig.isRealUser);
      const userByCccd = new Map(users.map((u) => [u.cccd, u]));
      let examId = String(req.query.examId || "").trim();
      if (!examId) examId = all.some((r) => r.examId === "random30") ? "random30" : "";
      const list = examId ? all.filter((r) => r.examId === examId) : all;
      const individual = rankIndividuals(list).map((x) => {
        const u = userByCccd.get(x.cccd) || {};
        return {
          rank: x.rank,
          prize: x.prize,
          tieGroup: x.tieGroup,
          cccd: x.cccd,
          fullName: u.fullName || "",
          unit: u.unit || "Ch\u01B0a x\xE1c \u0111\u1ECBnh",
          position: u.position || "",
          examId: x.examId,
          examTitle: x.examTitle,
          correct: x.correct,
          total: x.total,
          score10: x.score10,
          score100: x.score100,
          score60: x.score60,
          durationMs: x.durMs,
          // thời gian làm bài chính xác đến mili giây
          submittedAt: x.submittedAt,
          resultId: x.id
        };
      });
      const teams = /* @__PURE__ */ new Map();
      const ensureTeam = (unit) => {
        if (!teams.has(unit)) {
          teams.set(unit, {
            unit,
            registered: 0,
            participants: 0,
            sum10: 0,
            sum100: 0,
            sum60: 0,
            best10: 0,
            perfect10: 0,
            // R11: số bài đạt ĐIỂM TUYỆT ĐỐI thang 10 — tiêu chí xét giải
            firstSubmittedAt: null,
            excluded: EXCLUDED_TEAM_UNITS.includes(unit)
          });
        }
        return teams.get(unit);
      };
      for (const u of users) ensureTeam(u.unit || "Ch\u01B0a x\xE1c \u0111\u1ECBnh").registered += 1;
      for (const [cccd, b] of bestAttempts(list)) {
        const d = decorate(b);
        const t = ensureTeam((userByCccd.get(cccd) || {}).unit || "Ch\u01B0a x\xE1c \u0111\u1ECBnh");
        t.participants += 1;
        t.sum10 += d.score10;
        t.sum100 += d.score100;
        t.sum60 += d.score60;
        if (d.score10 > t.best10) t.best10 = d.score10;
        if (d.score10 === 10) t.perfect10 += 1;
        if (!t.firstSubmittedAt || String(d.submittedAt) < String(t.firstSubmittedAt)) {
          t.firstSubmittedAt = d.submittedAt;
        }
      }
      const teamRows = [...teams.values()].map((t) => ({
        unit: t.unit,
        registered: t.registered,
        participants: t.participants,
        participation: t.registered > 0 ? Math.round(t.participants / t.registered * 100) : 0,
        avg10: t.participants > 0 ? round2(t.sum10 / t.participants) : 0,
        avg100: t.participants > 0 ? round2(t.sum100 / t.participants) : 0,
        avg60: t.participants > 0 ? round2(t.sum60 / t.participants) : 0,
        best10: round2(t.best10),
        perfect10: t.perfect10,
        // R11: số bài đạt tuyệt đối thang 10 — tiêu chí xét giải
        firstSubmittedAt: t.firstSubmittedAt,
        excluded: t.excluded
      }));
      const teamAwards = teamPrizes(teamRows);
      res.json({
        examId: examId || "ALL",
        individual,
        teamAwards,
        prizes: { individual: INDIVIDUAL_PRIZES },
        rules: { individual: INDIVIDUAL_RULES, team: TEAM_RULES }
      });
    });
    router.get("/results/:id/paper", (req, res) => {
      const r = dataStore.get("results").find((x) => x.id === req.params.id);
      if (!r) return res.status(404).json({ message: "Kh\xF4ng t\xECm th\u1EA5y k\u1EBFt qu\u1EA3 b\xE0i l\xE0m." });
      const user = dataStore.get("users").find((u) => u.cccd === r.cccd) || null;
      const scales = scalesOfResult(r);
      let questions = [];
      let source = "exam";
      if (r.examId === "random30") {
        const ids = String(r.questionIds || "").split(",").map((s) => s.trim()).filter(Boolean);
        const pool = buildQuestionPool(dataStore).questions;
        const byId = new Map(pool.map((q) => [q.id, q]));
        questions = ids.map((id) => byId.get(id)).filter(Boolean);
        source = questions.length > 0 ? "random30" : "random30-missing";
      } else {
        const exam = dataStore.get("exams").find((e) => e.id === r.examId);
        questions = exam ? exam.questions || [] : [];
      }
      const answerMap = {};
      for (const a of Array.isArray(r.answers) ? r.answers : []) {
        if (a && a.q !== void 0) answerMap[String(a.q)] = Number.isInteger(a.c) ? a.c : parseInt(a.c, 10);
      }
      res.json({
        result: { ...r, score: scales.score10, score100: scales.score100, score60: scales.score60 },
        user: user ? {
          cccd: user.cccd,
          fullName: user.fullName || "",
          // R11: Họ và tên
          email: user.email,
          phone: user.phone,
          position: user.position,
          unit: user.unit
        } : null,
        source,
        questions: questions.map((q) => ({
          id: q.id,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex
        })),
        answers: answerMap
      });
    });
    module2.exports = router;
  }
});

// src/app.js
var require_app = __commonJS({
  "src/app.js"(exports2, module2) {
    "use strict";
    var path = require("path");
    var express = require("express");
    var config = require_config();
    var dataStore = require_dataStore();
    var publicRoutes = require_public_routes();
    var authRoutes = require_auth_routes();
    var examRoutes = require_exam_routes();
    var adminRoutes = require_admin_routes();
    var defaultReadyPromise = null;
    function defaultEnsureReady() {
      if (!defaultReadyPromise) {
        defaultReadyPromise = (async () => {
          console.log("[oes] Lazy boot du phong (entrypoint khong truyen ensureReady)...");
          require_driveClient().init();
          await dataStore.init();
          console.log("[oes] Instance du phong san sang nhan request.");
        })().catch((err) => {
          defaultReadyPromise = null;
          throw err;
        });
      }
      return defaultReadyPromise;
    }
    var ROUTE_DEST_PATH = "/api/index";
    function decodeRouteMatches(raw) {
      const groups = [];
      String(raw).split("&").forEach((part) => {
        const eq = part.indexOf("=");
        if (eq === -1) return;
        const key = Number.parseInt(part.slice(0, eq), 10);
        if (!Number.isFinite(key)) return;
        let val = part.slice(eq + 1);
        try {
          val = decodeURIComponent(val);
        } catch {
        }
        groups[key] = val;
      });
      return groups.filter(Boolean);
    }
    function recoverOriginalUrl(req) {
      const rawUrl = String(req.url || "");
      const rawPath = rawUrl.split("?")[0];
      if (rawPath !== ROUTE_DEST_PATH) return null;
      const forwarded = req.headers["x-forwarded-path"] || req.headers["x-vercel-original-path"];
      if (typeof forwarded === "string" && forwarded.startsWith("/") && forwarded !== ROUTE_DEST_PATH) {
        return forwarded;
      }
      const groups = decodeRouteMatches(req.headers["x-now-route-matches"]);
      if (groups.length > 0) {
        const joined = groups.join("").replace(/^\/+/, "");
        const candidate = /^api\//.test(joined) ? "/" + joined : "/api/" + joined;
        return candidate;
      }
      return null;
    }
    function buildApp(ensureReady) {
      const app2 = express();
      app2.disable("x-powered-by");
      app2.use(express.json({ limit: "1mb" }));
      app2.use((req, res, next) => {
        const recovered = recoverOriginalUrl(req);
        if (recovered) {
          const qIdx = String(req.url || "").indexOf("?");
          const query = qIdx === -1 ? "" : String(req.url).slice(qIdx);
          console.log(
            `[oes] Phuc hoi duong dan goc (routing mismatch): ${req.url} -> ${recovered}${query}`
          );
          req.url = recovered + query;
          req.originalUrl = recovered + query;
          req.oesUrlRecovered = true;
          return next();
        }
        if (String(req.url || "").split("?")[0] === ROUTE_DEST_PATH) {
          console.error(
            '[oes] OES_ROUTING_MISMATCH: request den dich "/api/index" ma khong co header duong dan goc. Deploy dang thieu file moi (api/index.js hoac vercel.json la ban cu).'
          );
          return res.status(500).json({
            ok: false,
            error: "OES_ROUTING_MISMATCH",
            message: 'H\u1EC7 th\u1ED1ng nh\u1EADn request t\u1EA1i \u0111\xEDch \u0111\u1ECBnh tuy\u1EBFn "/api/index" thay v\xEC \u0111\u01B0\u1EDDng d\u1EABn API g\u1ED1c. \u0110\xE2y KH\xD4NG ph\u1EA3i l\u1ED7i phi\xEAn \u0111\u0103ng nh\u1EADp \u2014 b\u1EA3n deploy \u0111ang ch\u1EA1y thi\u1EBFu file ho\u1EB7c \u0111ang d\xF9ng api/index.js / vercel.json c\u0169 (repo \u0111\u01B0\u1EE3c c\u1EADp nh\u1EADt m\u1ED9t n\u1EEDa).',
            hint: 'Upload l\u1EA1i TO\xC0N B\u1ED8 n\u1ED9i dung b\u1EA3n m\u1EDBi (C\xE1ch A trong C\u1EACP-NH\u1EACT-L\xCAN-GITHUB.txt \u2014 ph\u1EA3i c\xF3 \u0111\u1EE7 api/index.js, vercel.json, src/**) ho\u1EB7c v\xE0o Vercel > Deployments > Redeploy v\xE0 T\u1EAET "Use existing Build Cache". Sau deploy, m\u1EDF /api/health th\u1EA5y "build": "OES-VERCEL-R6" l\xE0 th\xE0nh c\xF4ng.'
          });
        }
        next();
      });
      if (ensureReady) {
        app2.use("/api", (req, res, next) => {
          ensureReady().then(() => next()).catch(next);
        });
      }
      app2.use((req, res, next) => {
        res.set("X-Content-Type-Options", "nosniff");
        res.set("X-Frame-Options", "SAMEORIGIN");
        res.set("Referrer-Policy", "same-origin");
        next();
      });
      app2.use("/api", (req, res, next) => {
        const t0 = Date.now();
        res.on(
          "finish",
          () => console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0}ms)`)
        );
        next();
      });
      app2.use("/api", (req, res, next) => {
        dataStore.refreshAllIfStale().then(() => next()).catch(() => next());
      });
      app2.use("/api", publicRoutes);
      app2.use("/api/auth", authRoutes);
      app2.use("/api", examRoutes);
      app2.use("/api/admin", adminRoutes);
      app2.use("/api", (req, res) => {
        res.status(404).json({ message: "Endpoint kh\xF4ng t\u1ED3n t\u1EA1i." });
      });
      app2.use(express.static(path.join(__dirname, "..", "public")));
      app2.use((req, res) => res.redirect("/"));
      app2.use((err, req, res, next) => {
        console.error("[error]", err);
        if (res.headersSent) return;
        const msg = String(err && err.message || "");
        const reason = String(err && err.errors && err.errors[0] && err.errors[0].reason || "");
        if (/drive|googleapis|invalid_grant|invalid_client|permission|quota|SERVICE_DISABLED/i.test(msg + reason)) {
          return res.status(502).json({
            message: "H\u1EC7 th\u1ED1ng ch\u01B0a ghi \u0111\u01B0\u1EE3c d\u1EEF li\u1EC7u l\xEAn Google Drive. Vui l\xF2ng b\xE1o Ban t\u1ED5 ch\u1EE9c ki\u1EC3m tra: \u0111\xE3 b\u1EADt Google Drive API, \u0111\xE3 Share th\u01B0 m\u1EE5c cho Service Account v\u1EDBi quy\u1EC1n Editor, GOOGLE_DRIVE_FOLDER_ID \u0111\xFAng \u2014 h\u01B0\u1EDBng d\u1EABn chi ti\u1EBFt \u1EDF README m\u1EE5c 3 (ch\u1EA1y: node tools/check-drive.js)."
          });
        }
        res.status(500).json({ message: "L\u1ED7i m\xE1y ch\u1EE7. Vui l\xF2ng th\u1EED l\u1EA1i sau." });
      });
      return app2;
    }
    function isRequestArg(arg) {
      return !!arg && typeof arg === "object" && typeof arg.on === "function" && typeof arg.socket !== "undefined";
    }
    var singletonApp = null;
    function createApp(ensureReady) {
      if (isRequestArg(ensureReady)) {
        if (!singletonApp) singletonApp = buildApp(defaultEnsureReady);
        return singletonApp(ensureReady, arguments[1]);
      }
      return buildApp(ensureReady || (config.isServerless ? defaultEnsureReady : null));
    }
    module2.exports = createApp;
    module2.exports.createApp = createApp;
    module2.exports.default = createApp;
  }
});

// api/index.js
var app = null;
var bootError = null;
function makeEnsureReady(driveClient, dataStore) {
  let readyPromise = null;
  return function ensureReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        console.log("[oes] Khoi tao instance serverless (lazy boot)...");
        driveClient.init();
        await dataStore.init();
        console.log("[oes] Instance san sang nhan request.");
      })().catch((err) => {
        readyPromise = null;
        throw err;
      });
    }
    return readyPromise;
  };
}
try {
  const driveClient = require_driveClient();
  const dataStore = require_dataStore();
  const appModule = require_app();
  const createApp = typeof appModule === "function" ? appModule : appModule.createApp;
  app = createApp(makeEnsureReady(driveClient, dataStore));
} catch (err) {
  bootError = err;
  console.error("[oes] LOI NGHIEM TRONG khi khoi tao module:", err && err.stack || err);
}
async function handler(req, res) {
  if (bootError) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(
      JSON.stringify(
        {
          ok: false,
          error: "OES_INITIALIZATION_FAILED",
          message: String(bootError && bootError.message || bootError),
          hint: 'Kiem tra Environment Variables tren Vercel (GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID, ADMIN_CCCDS, SESSION_SECRET) va xem Runtime Logs trong Dashboard, dong "LOI NGHIEM TRONG khi khoi tao module".'
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
module.exports.default = handler;
