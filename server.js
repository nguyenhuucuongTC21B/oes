/**
 * server.js (OES) — Chạy MÁY LOCAL / tự host (không dùng trên Vercel).
 *
 * Trên Vercel: api/index.js là điểm vào (lazy boot từng request).
 * Trên máy local: file này init đủ trước khi mở cổng — nhanh hơn và cho phép
 * SIGTERM flush (không cần thiết trên serverless).
 *
 * Cách chạy:
 *   npm start          (hoặc: node server.js)
 *   PORT=3000 npm start
 */
'use strict';

require('./src/config');

const driveClient = require('./src/drive/driveClient');
const dataStore = require('./src/store/dataStore');
const { createApp } = require('./src/app');
const config = require('./src/config');

async function main() {
  console.log('==============================================');
  console.log('   OES — HE THONG THI TRUC TUYEN (v1.0)       ');
  console.log('   Serverless-ready · Du lieu: Google Drive   ');
  console.log('==============================================');

  driveClient.init();
  await dataStore.init();

  const app = createApp(); // Đã init xong — không cần lazy boot.
  const server = app.listen(config.port, () => {
    console.log(`[server] OES dang chay tai cong ${config.port} — mo http://localhost:${config.port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[server] Nhan tin hieu ${signal} — dang dong he thong an toan...`);
    server.close();
    await Promise.race([dataStore.flushOnShutdown(), new Promise((r) => setTimeout(r, 5000))]);
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => console.error('[fatal] unhandledRejection:', err));
}

main().catch((err) => {
  console.error('[fatal] Khong the khoi dong he thong:', err);
  process.exit(1);
});
