/**
 * test-session-secret.js — Mô phỏng đúng lỗi "Phiên đăng nhập hết hạn" trên Vercel:
 * đăng nhập ở instance A (tiến trình Node #1), request tiếp theo rơi vào
 * instance B (tiến trình Node #2). Token phải còn hợp lệ.
 *
 * Kịch bản:
 *  T1: Không SESSION_SECRET, có GOOGLE_SERVICE_ACCOUNT_JSON (giống hệt Vercel
 *      của người dùng) → A ký, B verify → PHẢI PASS (fix mới).
 *  T2: Hai instance có GOOGLE_SERVICE_ACCOUNT_JSON KHÁC nhau → verify phải FAIL
 *      (đảm bảo secret không "va chạm" giữa các deployment khác nhau).
 *  T3: Có SESSION_SECRET → ưu tiên SESSION_SECRET, bỏ qua SA JSON.
 *  T4: Không có cả hai (local không .env) → random, verify trong cùng tiến trình vẫn OK.
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGN = path.join(__dirname, 'helper-sign.js');
const VERIFY = path.join(__dirname, 'helper-verify.js');

let passed = 0;
let failed = 0;

function run(env, file, ...args) {
  const out = execFileSync('node', [path.join(__dirname, file), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return out.trim();
}

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('== Test session secret da instance (mo phong Vercel lambda) ==\n');

const SA_A = JSON.stringify({ client_email: 'oes@test.iam.gserviceaccount.com', private_key: 'KEY_A' });
const SA_B = JSON.stringify({ client_email: 'oes@test.iam.gserviceaccount.com', private_key: 'KEY_B' });
const SECRET = 'my-fixed-secret-123';

// T1: đúng kịch bản người dùng — không SESSION_SECRET, 2 instance cùng SA JSON.
const t1 = run({ GOOGLE_SERVICE_ACCOUNT_JSON: SA_A }, 'helper-sign.js', 'user-a');
const t1v = run({ GOOGLE_SERVICE_ACCOUNT_JSON: SA_A }, 'helper-verify.js', t1);
check('T1: A ky -> B verify (cung SA JSON, khong SESSION_SECRET)', t1v === 'OK');

// T2: deployment khác nhau (SA JSON khác) phải từ chối token của nhau.
const t2v = run({ GOOGLE_SERVICE_ACCOUNT_JSON: SA_B }, 'helper-verify.js', t1);
check('T2: SA JSON khac -> verify PHAI that bai', t2v === 'FAIL');

// T3: SESSION_SECRET ưu tiên cao nhất.
const t3 = run({ SESSION_SECRET: SECRET, GOOGLE_SERVICE_ACCOUNT_JSON: SA_A }, 'helper-sign.js', 'user-b');
const t3v = run({ SESSION_SECRET: SECRET }, 'helper-verify.js', t3);
check('T3: SESSION_SECRET duoc uu tien, khong phu thuoc SA JSON', t3v === 'OK');
const t3v2 = run({ SESSION_SECRET: SECRET + 'x' }, 'helper-verify.js', t3);
check('T3b: SESSION_SECRET khac -> verify PHAI that bai', t3v2 === 'FAIL');

// T4: local không .env — secret random nhưng trong cùng tiến trình vẫn tự verify được.
const t4 = run({}, 'helper-sign-verify-inline.js');
check('T4: local random secret — ky + verify cung tien trinh van OK', t4 === 'OK');

console.log(`\nKet qua: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
