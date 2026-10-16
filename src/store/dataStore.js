/**
 * dataStore.js (OES / VERCEL EDITION) — Bộ nhớ đệm RAM + đồng bộ Google Drive
 * cho môi trường SERVERLESS.
 *
 * KHÁC BIỆT SO VỚI BẢN RENDER (server thường):
 *
 *  1. LAZY BOOT  — Trên Vercel không có lúc "khởi động server": mỗi instance
 *     lambda sống/ngủ động độc lập. init() được gọi trễ (lần request đầu tiên),
 *     khởi tạo 1 lần rồi cache promise trong suốt vòng đời instance.
 *
 *  2. GHI ĐỒNG BỘ NGAY — Không còn debounce 1.2s, không vòng rà 30s, không
 *     SIGTERM-flush (instance có thể "ngủ" bất kỳ lúc nào). MỌI ghi dữ liệu
 *     phải `await saveNow(key)` hoàn tất TRƯỚC khi trả response.
 *
 *  3. BASELINE-MERGE (hợp nhất 3 đường) — Nhiều instance có thể chạy song song
 *     và cùng ghi một file. Trước MỖI lần upload, hệ thống tải file mới nhất
 *     từ Drive về và hợp nhất theo "baseline" (danh sách id có tại lần nạp
 *     gần nhất):
 *       + Bản ghi có trên Drive mà KHÔNG trong baseline → do instance khác
 *         vừa thêm → GIỮ LẠI (không bao giờ mất bài nộp/đăng ký chéo instance).
 *       + Bản ghi trong baseline nhưng đã bị XÓA khỏi RAM → ta đã xóa → KHÔNG
 *         đưa lại (lệnh xóa của Admin luôn "dính").
 *       + Trùng id: nếu bản ghi trong RAM KHÁC baseline (ta vừa sửa) → RAM
 *         thắng; nếu RAM GIỐNG hệt baseline (ta không đụng đến) → lấy bản mới
 *         nhất trên Drive (instance khác có thể vừa sửa nó).
 *
 *  4. REFRESH ĐỌC — Cache có tuổi: quá 15 giây kể từ lần nạp/ghi cuối, request
 *     kế tiếp sẽ tự tải lại từ Drive (middleware gọi refreshIfStale) để mọi
 *     instance nhìn thấy dữ liệu của nhau gần như tức thời.
 *
 * Nguyên tắc an toàn dữ liệu (giữ nguyên tinh thần bản cũ):
 *  - Mọi thay đổi trong RAM phải đi qua saveNow() — thao tác quan trọng
 *    (nộp bài, đăng ký) luôn đợi Drive ghi xong mới trả kết quả.
 *  - Mutex theo từng file: các request trong cùng instance xếp hàng ghi,
 *    không ghi đè chéo.
 *  - Nếu boot KHÔNG đọc được Drive (mạng/quyền lỗi): cấm upload đè cho tới
 *    khi đọc được file cũ — tránh tình trạng RAM rỗng đè mất dữ liệu thật.
 */
'use strict';

const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const driveClient = require('../drive/driveClient');
const { adviceForError, isQuotaError } = require('../utils/driveAdvice');
const { globalMutex } = require('../utils/mutex');

const FILES = ['users', 'exams', 'results'];
/**
 * Tên file dữ liệu của một kho (Drive + mirror cục bộ đều dùng helper này).
 * Có hậu tố config.dataFileSuffix (vd "Vercel") để tách dữ liệu giữa các bản
 * deploy dùng chung thư mục Drive: usersVercel.json / examsVercel.json / resultsVercel.json.
 */
function fileNameOf(key) {
  return `${key}${config.dataFileSuffix || ''}.json`;
}
/** Trường định danh của bản ghi trong từng file (dùng cho baseline-merge). */
const ID_FIELD = { users: 'cccd', exams: 'id', results: 'id' };
/** Tuổi tối đa của cache đọc trước khi tự tải lại từ Drive (ms). */
const CACHE_TTL_MS = 15_000;

/**
 * RAM cache mỗi instance:
 *   store[key] = { data: [], fileId, baseline: Map<id, JSON-string>, loadedAt: ms|null,
 *                  bootLoadedOk: bool, lastSyncedAt, lastSyncError }
 */
const store = {};

let initPromise = null; // Cache promise lazy-boot (1 lần cho mỗi instance).

/* ------------------------------ KHỞI TẠO (LAZY) ------------------------------ */

/** Khởi tạo 1 lần cho mỗi instance — gọi nhiều lần cũng chỉ chạy đúng một lần. */
function init() {
  if (!initPromise) {
    initPromise = (async () => {
      for (const key of FILES) {
        store[key] = {
          data: [],
          fileId: null,
          baseline: new Map(),
          loadedAt: null,
          bootLoadedOk: false,
          lastSyncedAt: null,
          lastSyncError: null,
        };
      }
      for (const key of FILES) await initOne(key);
      console.log(
        `[store] Khoi tao xong (instance): users=${store.users.data.length}, exams=${store.exams.data.length}, results=${store.results.data.length}`
      );
      await seedSampleExamsIfEmpty();
    })().catch((err) => {
      initPromise = null; // Cho phép request sau thử khởi tạo lại.
      throw err;
    });
  }
  return initPromise;
}

/** Đợi lazy boot hoàn tất (dùng ở middleware trước khi route chạy). */
function ready() {
  return init();
}

/**
 * LẦN CHẠY ĐẦU TIÊN (hoặc exams.json trống `[]`): tự nạp 3 BỘ ĐỀ MẪU
 * (2 × 50 câu ATTT + 1 × 81 câu Chuyển đổi số) để hệ thống có ngay dữ liệu
 * dùng thử. Chỉ nạp khi exams RỘNG HOÀN TOÀN — không đè lên đề của Ban Tổ chức.
 */
async function seedSampleExamsIfEmpty() {
  if (store.exams.data.length > 0) return;
  try {
    const { buildSampleExams } = require('../data/sampleExams');
    const samples = buildSampleExams();
    store.exams.data.push(...samples);
    const sync = await saveNow('exams');
    console.log(
      `[store] exams trong — DA NAP ${samples.length} BO DE MAU ( ATTT + Chuyen doi so, ` +
        `${sync.synced ? 'DA SYNC' : 'CHUA SYNC — se tu thu lai'} ). Admin co the sua/xoa tuy y.`
    );
  } catch (err) {
    console.warn(`[store] Khong nap duoc bo de mau: ${err.message}`);
  }
}

async function initOne(key) {
  const fname = fileNameOf(key);
  if (driveClient.isDriveMode()) {
    try {
      const fileId = await driveClient.findFileByName(fname);
      if (fileId) {
        const data = await driveClient.downloadFile(fileId);
        store[key].data = Array.isArray(data) ? data : [];
        store[key].fileId = fileId;
      } else {
        // Lần chạy đầu tiên: file chưa tồn tại trên Drive (sẽ tạo khi ghi đầu tiên).
        store[key].data = [];
        store[key].fileId = null;
      }
      store[key].baseline = new Map(store[key].data.map((r) => [idOf(key, r), JSON.stringify(r)]));
      store[key].loadedAt = Date.now();
      store[key].bootLoadedOk = true;
      await mirrorLocal(key);
      console.log(`[store] Tai ${fname} tu Google Drive: ${store[key].data.length} ban ghi`);
      return;
    } catch (err) {
      // NGHIÊM TRỌNG: RAM có thể rỗng trong khi Drive còn dữ liệu cũ → cấm
      // upload đè cho tới khi đọc được file cũ (saveNow sẽ tự thử lại).
      store[key].bootLoadedOk = false;
      const tip = adviceForError(err);
      store[key].lastSyncError =
        `Lúc khởi động không đọc được file từ Drive: ${err.message}${tip ? ` → ${tip}` : ''}`;
      console.error(`[store] Khong tai duoc ${fname} tu Drive (${err.message}).`);
      // Rơi xuống đọc mirror nếu có (instance cũ trên cùng máy cục bộ).
    }
  }
  // Fallback mirror cục bộ (chế độ local, hoặc Drive lỗi lúc local).
  try {
    const text = await fs.readFile(path.join(config.localDataDir, fname), 'utf8');
    const data = JSON.parse(text);
    store[key].data = Array.isArray(data) ? data : [];
    store[key].baseline = new Map(store[key].data.map((r) => [idOf(key, r), JSON.stringify(r)]));
    store[key].loadedAt = Date.now();
    console.log(`[store] Tai ${fname} tu cache cuc bo: ${store[key].data.length} ban ghi`);
  } catch {
    store[key].data = [];
  }
}

/* ------------------------------ TRUY CẤP RAM ------------------------------ */

/** Mượn tham chiếu mảng dữ liệu trong RAM (đọc/ghi trực tiếp, tốc độ tối đa). */
function get(key) {
  assertKey(key);
  return store[key].data;
}

/** Đếm nhanh số bản ghi. */
function count(key) {
  return store[key] ? store[key].data.length : 0;
}

function assertKey(key) {
  if (!store[key]) throw new Error(`Khoa du lieu khong hop le: ${key}`);
}

function idOf(key, record) {
  return record && record[ID_FIELD[key]] !== undefined ? String(record[ID_FIELD[key]]) : null;
}

/* ------------------------------ LÀM TƯƠI CACHE ĐỌC ------------------------------ */

/**
 * Tải lại file từ Drive nếu cache đã cũ hơn `maxAgeMs` (mặc định 15s).
 * Sau khi tải: remote là chuẩn (không có ghi "dở dang" nào vì mọi ghi đều
 * đồng bộ) — thay toàn bộ data + baseline. Không ném lỗi: nếu Drive lỗi,
 * cache hiện tại vẫn dùng được (hệ thống hoạt động giảm cấp).
 */
async function refreshIfStale(key, maxAgeMs = CACHE_TTL_MS) {
  assertKey(key);
  if (!driveClient.isDriveMode()) return;
  const s = store[key];
  if (s.loadedAt !== null && Date.now() - s.loadedAt < maxAgeMs) return;
  await globalMutex.runExclusive(`persist:${key}`, async () => {
    // Kiểm tra lại sau khi có khóa — request khác có thể vừa refresh xong.
    if (s.loadedAt !== null && Date.now() - s.loadedAt < maxAgeMs) return;
    try {
      let fileId = s.fileId;
      if (!fileId) {
        fileId = await driveClient.findFileByName(fileNameOf(key));
        if (!fileId) {
          s.loadedAt = Date.now(); // File chưa tồn tại — coi như mới nạp (rỗng).
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
      // Giữ cache cũ, ghi nhận lỗi để banner hiển thị.
      s.lastSyncError = `Không làm tươi được dữ liệu từ Drive: ${err.message}`;
      s.loadedAt = Date.now(); // Tránh refresh dồn dập khi Drive đang lỗi.
      console.warn(`[store] refreshIfStale(${key}): ${err.message}`);
    }
  });
}

/** Làm tươi mọi file (dùng ở middleware trước mỗi request API). */
async function refreshAllIfStale(maxAgeMs = CACHE_TTL_MS) {
  for (const key of FILES) await refreshIfStale(key, maxAgeMs);
}

/* ------------------------------ GHI LÊN DRIVE ------------------------------ */

/**
 * Ghi dữ liệu vĩnh viễn — BẮT BUỘC await trong môi trường serverless.
 *
 * Quy trình (chế độ Drive):
 *  1. Ghi mirror cục bộ (best-effort, /tmp).
 *  2. Tải file mới nhất từ Drive về (fetch-before-write).
 *  3. BASELINE-MERGE: giữ bản ghi mới từ instance khác, giữ lệnh xóa của ta,
 *     bản ghi RAM thắng khi trùng id.
 *  4. Upload toàn bộ mảng hợp nhất (update nếu biết fileId, ngược lại tạo mới).
 *
 * KHÔNG BAO GIỜ ném lỗi khi Drive tạm lỗi: trả về { synced: false } và ghi
 * nhận lastSyncError để dashboard hiển thị. Dữ liệu vẫn an toàn trong RAM
 * của instance; request kế tiếp sẽ thử lại toàn bộ quy trình.
 */
async function saveNow(key) {
  assertKey(key);
  // Lưu ý: KHÔNG await ready() ở đây — saveNow có thể được gọi TRONG init()
  // (seed bộ đề mẫu lần đầu); middleware lazy-boot đã đảm bảo init xong trước
  // khi route chạy. Gọi ready() tại đây sẽ tự-đợi chính mình → deadlock.
  return globalMutex.runExclusive(`persist:${key}`, async () => {
    const s = store[key];
    try {
      await mirrorLocal(key); // An toàn cục bộ trước — rẻ và đáng tin cậy.

      if (!driveClient.isDriveMode()) {
        s.lastSyncedAt = new Date().toISOString();
        s.lastSyncError = null;
        return { synced: true };
      }

      // ---- BƯỚC 2: FETCH-BEFORE-WRITE ----
      // findFileByName THÀNH CÔNG (kể cả trả null = file chưa có) chứng tỏ
      // Drive đang reachable → mọi quyết định ghi đều dựa trên sự thật này.
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
          // Không đọc được file cũ → CẤM upload đè (bảo toàn dữ liệu Drive).
          // (Nếu Drive đang lỗi mạng/quota thì upload cũng sẽ lỗi — abort là không tốn gì.)
          const tip = adviceForError(fetchErr);
          s.lastSyncError =
            `Chưa đọc được dữ liệu mới nhất từ Drive trước khi ghi: ${fetchErr.message}${tip ? ` → ${tip}` : ''}`;
          console.error(
            `[store] HOAN ghi ${fileNameOf(key)} — khong doc duoc ban moi tren Drive (${fetchErr.message}). ` +
              'Du lieu van an toan trong RAM cua instance; request ke tiep se tu thu lai.'
          );
          return { synced: false };
        }

        // ---- BƯỚC 3: BASELINE-MERGE (3 đường: baseline / RAM / remote) ----
        // baseline = bản chụp nội dung tại lần nạp/ghi gần nhất của instance này.
        // Dùng nó phân biệt: "ta đã sửa" (RAM ≠ baseline) với "ta chỉ giữ bản cũ"
        // (RAM = baseline) — bản ghi không đụng đến sẽ nhường bản MỚI trên Drive.
        const remoteById = new Map(remoteArr.map((r) => [idOf(key, r), r]));
        const merged = [];
        const ourIds = new Set();
        for (const record of s.data) {
          const rid = idOf(key, record);
          ourIds.add(rid);
          const base = s.baseline.get(rid);
          const remoteRec = remoteById.get(rid);
          if (base === undefined) {
            merged.push(record); // Ta thêm mới → của ta.
          } else if (JSON.stringify(record) !== base) {
            merged.push(record); // Ta đã sửa → bản RAM thắng.
          } else if (remoteRec !== undefined) {
            merged.push(remoteRec); // Ta không đụng → lấy bản Drive (instance khác có thể đã sửa).
          }
          // Còn lại: base có, ta không đụng, remote KHÔNG còn → instance khác đã xóa → bỏ.
        }
        for (const [rid, remoteRec] of remoteById) {
          if (rid === null || ourIds.has(rid)) continue;
          if (!s.baseline.has(rid)) {
            merged.push(remoteRec); // Instance khác vừa thêm mới → giữ lại.
            console.log(`[store] Merge: nhan ban ghi moi tu instance khac vao ${fileNameOf(key)} (id=${rid})`);
          }
          // rid nằm trong baseline nhưng không có trong RAM → ta đã xóa → bỏ qua.
        }

        s.data = merged;
        s.baseline = new Map(merged.map((r) => [idOf(key, r), JSON.stringify(r)]));
        await mirrorLocal(key);
      }
      // fileId null = findFileByName xác nhận file CHƯA tồn tại trên Drive
      // (Drive reachable) → an toàn để tạo mới ở bước upload bên dưới.

      // ---- BƯỚC 4: UPLOAD ----
      const payload = JSON.stringify(s.data, null, 2);
      if (s.fileId) {
        await driveClient.updateFile(s.fileId, payload);
      } else {
        s.fileId = await driveClient.createFile(fileNameOf(key), payload);
      }
      s.lastSyncedAt = new Date().toISOString();
      s.lastSyncError = null;
      s.loadedAt = Date.now();
      console.log(`[store] Da ghi ${fileNameOf(key)} len Google Drive (${s.data.length} ban ghi)`);
      return { synced: true };
    } catch (err) {
      const tip = adviceForError(err);
      s.lastSyncError = `${err.message}${tip ? ` → ${tip}` : ''}`;
      if (tip) console.error(`[store] CACH SUA: ${tip}`);
      console.error(`[store] KHONG ghi duoc ${fileNameOf(key)}: ${err.message}`);
      return { synced: false };
    }
  });
}

/** Ghi mirror xuống thư mục cache cục bộ (best-effort, không bao giờ ném lỗi). */
async function mirrorLocal(key) {
  try {
    await fs.mkdir(config.localDataDir, { recursive: true });
    await fs.writeFile(
      path.join(config.localDataDir, fileNameOf(key)),
      JSON.stringify(store[key].data, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn(`[store] Khong ghi duoc mirror cuc bo cho ${key}: ${err.message}`);
  }
}

/** Tương thích: bản cũ có save() fire-and-forget — trên serverless phải await ngay. */
function save(key) {
  // Chạy nền cho tiện gọi; mọi route trọng yếu vẫn nên await saveNow().
  return saveNow(key);
}

/** Không còn ý nghĩa trên serverless (không có pending queue) — giữ cho tương thích. */
async function flushOnShutdown() {
  /* no-op: mọi ghi đã đồng bộ ngay trong request */
}

function getSyncInfo() {
  return FILES.map((key) => {
    const s = store[key] || {};
    return {
      file: fileNameOf(key),
      records: s.data ? s.data.length : 0,
      lastSyncedAt: s.lastSyncedAt || null,
      pending: false,
      lastError: s.lastSyncError || null,
      cacheAgeSeconds: s.loadedAt ? Math.floor((Date.now() - s.loadedAt) / 1000) : null,
    };
  });
}

/**
 * Nạp LẠI toàn bộ từ Drive (dùng khi chẩn đoán "tự lành"): quên fileId + baseline
 * rồi initOne lại từng file. Chỉ áp dụng cho instance hiện tại.
 */
async function reloadFromDrive() {
  if (!driveClient.isDriveMode()) return;
  await globalMutex.runExclusive('persist:reload', async () => {
    for (const key of FILES) {
      store[key].fileId = null;
      store[key].loadedAt = null;
      await initOne(key);
    }
  });
}

module.exports = {
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
  fileNameOf,
  FILES,
};
