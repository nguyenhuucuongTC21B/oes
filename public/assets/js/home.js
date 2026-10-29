/**
 * home.js — Trang chủ: băng rôn cổ động, đếm ngược hạn nhận bài, số liệu thống kê
 * tự động từ server, và trạng thái đăng nhập trên header.
 */
'use strict';

/* ---------------------- Băng rôn khẩu hiệu chạy ngang ---------------------- */
(function buildMarquee() {
  const slogans =
    '★ CHÀO MỪNG BẠN ĐẾN VỚI CUỘC THI TRẮC NGHIỆM TÌM HIỂU PHÁP LUẬT TRỰC TUYẾN NĂM 2026 ' +
    '★ TRAO DỒI KIẾN THỨC — LAN TỎA NIỀM TIN — SỐNG VÀ LÀM VIỆC THEO HIẾN PHÁP VÀ PHÁP LUẬT ' +
    '★ THAM GIA MIỄN PHÍ — NHẬN GIẢI TRỰC TIẾP ';
  const track = document.getElementById('marquee');
  if (track) track.innerHTML = `<span class="px-4">${slogans.repeat(2)}</span><span class="px-4">${slogans.repeat(2)}</span>`;
})();

/* ------------------------------ Đếm ngược hạn thi ------------------------------ */
let DEADLINE = new Date('2026-12-31T23:59:59+07:00').getTime();
let deadlineTimer = null;
(function countdown() {
  const els = {
    d: document.getElementById('cd-d'),
    h: document.getElementById('cd-h'),
    m: document.getElementById('cd-m'),
    s: document.getElementById('cd-s'),
    box: document.getElementById('countdown'),
  };
  if (!els.d) return;

  function tick() {
    const diff = DEADLINE - Date.now();
    if (diff <= 0) {
      els.box.innerHTML =
        '<div class="col-span-4 bg-white/95 text-flag-700 rounded-xl py-4 font-extrabold text-center">Đã hết thời gian nhận bài dự thi — Trân trọng cảm ơn thí sinh!</div>';
      clearInterval(deadlineTimer);
      return;
    }
    els.d.textContent = String(Math.floor(diff / 86400000));
    els.h.textContent = String(Math.floor(diff / 3600000) % 24).padStart(2, '0');
    els.m.textContent = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
    els.s.textContent = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
  }
  tick();
  deadlineTimer = setInterval(tick, 1000);
  // Cho phép site config thay mốc đếm ngược khi tải xong.
  window.__oesSetDeadline = function setDeadline(iso) {
    const ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isNaN(ms) && ms > 0) DEADLINE = ms;
  };
})();

/* ------------------- R10: ÁP CẤU HÌNH GIAO DIỆN (site config) ------------------- */
(async function applySiteConfig() {
  const cfg = await loadSiteConfig();
  if (!cfg) return;

  // Băng rôn khẩu hiệu chạy ngang.
  if (cfg.marquee) {
    const track = document.getElementById('marquee');
    if (track) track.innerHTML = `<span class="px-4">${cfg.marquee.repeat(2)}</span><span class="px-4">${cfg.marquee.repeat(2)}</span>`;
  }
  // Nhãn + tiêu đề + mô tả hero (Admin nhập — cho phép HTML).
  // R10a: luôn kiểm tra phần tử tồn tại trước khi gán — thiếu slot (trang tùy
  // biến) chỉ bỏ qua slot đó, không làm đổ toàn bộ applySiteConfig.
  const slotHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  if (cfg.heroBadge) slotHtml('hero-badge', cfg.heroBadge);
  if (cfg.heroTitle) slotHtml('hero-title', cfg.heroTitle);
  if (cfg.heroSubtitle) slotHtml('hero-subtitle', cfg.heroSubtitle);
  // Ảnh bìa hero.
  if (cfg.bannerUrl) {
    const b = document.getElementById('hero-banner');
    const o = document.getElementById('hero-banner-overlay');
    if (b) {
      b.style.backgroundImage = `url('${cfg.bannerUrl}')`;
      b.classList.remove('hidden');
    }
    if (o) o.classList.remove('hidden');
  }
  // Nội dung các khối div trang chủ (R10a: thiếu slot chỉ bỏ qua, không đổ trang).
  if (cfg.introHtml) slotHtml('intro-body', cfg.introHtml);
  if (cfg.principleHtml) slotHtml('principle-body', cfg.principleHtml);
  if (cfg.rulesHtml) slotHtml('rules-note', cfg.rulesHtml);
  // R10b — Chi tiết chân trang (footer): bỏ trống ô nào thì ô đó giữ nội dung gốc.
  if (cfg.footerAbout) slotHtml('footer-about', cfg.footerAbout);
  if (cfg.footerCredits) slotHtml('footer-credits', cfg.footerCredits);
  if (cfg.footerContact) slotHtml('footer-contact', cfg.footerContact);
  if (cfg.footerLinks) slotHtml('footer-links', cfg.footerLinks);
  if (cfg.footerCopyright) slotHtml('footer-copyright', esc(cfg.footerCopyright));
  // Dòng mô tả khung giờ nhận bài + mốc đếm ngược.
  const intakeNote = document.getElementById('intake-note');
  if (intakeNote) {
    if (cfg.intakeOpenAt && cfg.intakeCloseAt) {
      intakeNote.textContent = `Nhận bài từ ${fmtVn(cfg.intakeOpenAt)} đến ${fmtVn(cfg.intakeCloseAt)} (giờ VN)`;
    } else if (cfg.intakeCloseAt) {
      intakeNote.textContent = `Nhận bài đến hết ${fmtVn(cfg.intakeCloseAt)} (giờ VN)`;
    } else if (cfg.deadlineIso) {
      const d = new Date(cfg.deadlineIso);
      if (!Number.isNaN(d.getTime())) {
        intakeNote.textContent = `Đến hết ngày ${d.toLocaleDateString('vi-VN')} (giờ VN)`;
      }
    }
  }
  if (cfg.deadlineIso && typeof window.__oesSetDeadline === 'function') {
    window.__oesSetDeadline(cfg.deadlineIso);
  }
})();

/* ------------------- Số liệu tuyên truyền (đếm lên mượt) ------------------- */
async function loadStats() {
  const map = {
    users: 'stat-users',
    exams: 'stat-exams',
    results: 'stat-results',
    avgScore: 'stat-avg',
  };
  try {
    const stats = await api('/stats', { auth: false });
    for (const [key, id] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) continue;
      countUp(el, Number(stats[key]) || 0, key === 'avgScore');
    }
  } catch {
    /* offline: giữ số 0, không phiền người dùng */
  }
}

function countUp(el, target, isDecimal = false) {
  const dur = 900;
  const t0 = performance.now();
  function frame(t) {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = target * eased;
    el.textContent = isDecimal ? (Math.round(val * 100) / 100).toFixed(2) : Math.round(val).toLocaleString('vi-VN');
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* --------------------- Header: trạng thái đăng nhập --------------------- */
function renderHeaderAuth() {
  const host = document.getElementById('header-auth');
  if (!host) return;
  const user = Auth.user();
  if (Auth.token() && user) {
    const adminLink = user.role === 'admin'
      ? `<a href="/admin.html" class="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-flag-700 bg-flag-50 hover:bg-flag-100 px-3 py-2 rounded-lg transition">Quản trị</a>`
      : '';
    host.innerHTML = `
      ${adminLink}
      <a href="/quiz.html" class="inline-flex items-center gap-1.5 bg-flag-600 hover:bg-flag-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
        Vào thi
      </a>
      <div class="relative group">
        <button class="flex items-center gap-2 text-sm text-slate-600 hover:text-flag-700 px-2 py-2" title="${esc(user.cccd)}">
          <span class="w-8 h-8 rounded-full bg-gold-400/30 text-gold-600 font-bold flex items-center justify-center text-xs">${esc(String(user.cccd).slice(-2))}</span>
          <span class="hidden lg:inline">${esc(maskCccd(user.cccd))}</span>
        </button>
        <div class="absolute right-0 top-full pt-1 hidden group-hover:block">
          <button onclick="doLogout()" class="w-40 bg-white border border-slate-200 shadow-soft rounded-lg px-4 py-2.5 text-sm text-left text-red-600 hover:bg-red-50 font-semibold">Đăng xuất</button>
        </div>
      </div>`;
  } else {
    host.innerHTML = `
      <a href="/login.html" class="inline-flex items-center gap-1.5 bg-flag-600 hover:bg-flag-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
        Đăng nhập / Đăng ký
      </a>`;
  }
}

renderHeaderAuth();
loadStats();

/* ------------------- R10b: TIN BÀI "TIN TỨC — TUYÊN TRUYỀN" ------------------- */
/**
 * Nạp tin bài do Admin viết (GET /api/news — công khai, chỉ tin đã đăng) và
 * thay vào lưới thẻ tin trên trang chủ. Khi CHƯA có tin nào (hoặc lỗi mạng)
 * giữ nguyên 3 tin mặc định nhúng sẵn trong trang — trang chủ không bao giờ
 * trống mục Tin tức — Tuyên truyền.
 */
(async function loadNews() {
  const grid = document.getElementById('news-grid');
  if (!grid) return; // Trang tùy biến thiếu slot — bỏ qua an toàn.
  let list = [];
  try {
    const d = await api('/news', { auth: false });
    list = Array.isArray(d.news) ? d.news : [];
  } catch {
    return; // Lỗi mạng — giữ tin mặc định, không phiền người xem.
  }
  if (!list.length) return;

  // Xoay vòng 3 màu nền header thẻ tin — giống phong cách 3 tin mặc định.
  const grads = ['from-flag-600 to-flag-800', 'from-gold-500 to-flag-500', 'from-flag-800 to-slate-900'];
  grid.innerHTML = list
    .map(
      (n, i) => `
      <article class="group bg-[#FAF7F2] rounded-2xl border border-slate-100 overflow-hidden hover:shadow-soft transition">
        <div class="h-36 bg-gradient-to-br ${grads[i % grads.length]} star-pattern flex items-center justify-center">
          <span class="text-5xl opacity-90">${esc(n.emoji || '📰')}</span>
        </div>
        <div class="p-5">
          <div class="flex items-center gap-2 text-[11px] uppercase tracking-wider">
            <span class="bg-flag-50 text-flag-700 font-bold px-2 py-0.5 rounded">${esc(n.category || 'Tin tức')}</span>
            <span class="text-slate-400">${fmtDate(n.createdAt)}</span>
            ${n.pinned ? '<span class="text-gold-600" title="Tin được ghim lên đầu">★</span>' : ''}
          </div>
          <h3 class="font-bold text-slate-900 mt-2.5 leading-snug group-hover:text-flag-700 transition">${esc(n.title)}</h3>
          <p class="text-sm text-slate-600 mt-2 leading-relaxed">${esc(n.excerpt || '')}</p>
        </div>
      </article>`
    )
    .join('');
})();
