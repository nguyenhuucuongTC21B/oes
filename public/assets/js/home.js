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

/* ---------------- R10: CẤU HÌNH GIAO DIỆN (Admin chỉnh, lưu trên server) ---------------- */
let siteCfg = null;
let siteServerTime = null;

async function loadSiteConfig() {
  try {
    const data = await api('/site-config', { auth: false });
    siteCfg = (data && data.config) || null;
    siteServerTime = (data && data.serverTime) || null;
  } catch {
    siteCfg = null; // offline: giữ nguyên giao diện gốc
  }
  applySiteConfig();
}

function applySiteConfig() {
  if (!siteCfg) return;
  // Banner (trống = ẩn banner, chỉ còn header gradient)
  const banner = document.getElementById('site-banner');
  if (banner) {
    if (siteCfg.bannerUrl) {
      banner.src = siteCfg.bannerUrl;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
  // Tiêu đề / lead: chỉ ghi đè khi Admin nhập nội dung mới (trống = giữ mẫu).
  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el && v && String(v).trim()) el.textContent = v;
  };
  setText('site-title', siteCfg.siteName);
  setText('site-subtitle', siteCfg.headerSub);
  setText('hero-title', siteCfg.heroTitle);
  setText('hero-lead', siteCfg.heroLead);
  // Thanh thông báo nổi bật dưới hero (HTML do Admin soạn).
  const notice = document.getElementById('site-notice');
  if (notice) {
    const inner = notice.firstElementChild;
    if (siteCfg.noticeHtml && siteCfg.noticeHtml.trim()) {
      if (inner) inner.innerHTML = siteCfg.noticeHtml;
      notice.classList.remove('hidden');
    } else {
      notice.classList.add('hidden');
    }
  }
  // Nội dung khối Giới thiệu (thay toàn bộ các đoạn <p> trong div).
  const intro = document.getElementById('intro-content');
  if (intro && siteCfg.introHtml && siteCfg.introHtml.trim()) {
    intro.innerHTML = siteCfg.introHtml;
  }
  // Đoạn giới thiệu footer.
  setText('footer-about', siteCfg.footerText);
}

loadSiteConfig();

/* ------------------------------ Đếm ngược hạn thi ------------------------------ */
(function countdown() {
  // Hạn cuối nhận bài dự thi dự phòng (khi server chưa cấu hình khung giờ).
  const FALLBACK_DEADLINE = new Date('2026-11-04T23:59:59+07:00').getTime();
  const els = {
    d: document.getElementById('cd-d'),
    h: document.getElementById('cd-h'),
    m: document.getElementById('cd-m'),
    s: document.getElementById('cd-s'),
    box: document.getElementById('countdown'),
    text: document.getElementById('receive-window-text'),
  };
  if (!els.d) return;

  // Múi giờ VN cho dòng mô tả.
  const fmtDay = (iso) => new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  });

  function targets() {
    const w = (siteCfg && siteCfg.window) || {};
    const openMs = w.openAt ? new Date(w.openAt).getTime() : null;
    const closeMs = w.closeAt ? new Date(w.closeAt).getTime() : null;
    const now = siteServerTime ? new Date(siteServerTime).getTime() : Date.now();
    // Chưa tới giờ mở → đếm ngược tới giờ mở; ngược lại đếm tới giờ đóng.
    if (openMs && now < openMs) {
      return { end: openMs, text: `Nhận bài từ ${fmtDay(w.openAt)}${closeMs ? ` đến hết ${fmtDay(w.closeAt)}` : ''}` };
    }
    if (closeMs) {
      return { end: closeMs, text: openMs ? `Nhận bài đến hết ${fmtDay(w.closeAt)}` : `Đến hết ngày ${fmtDay(w.closeAt)}` };
    }
    return { end: FALLBACK_DEADLINE, text: 'Đến hết ngày 04 tháng 11 năm 2026' };
  }

  function tick() {
    const t = targets();
    if (els.text) els.text.textContent = t.text;
    const diff = t.end - Date.now();
    if (diff <= 0) {
      els.box.innerHTML =
        '<div class="col-span-4 bg-white/95 text-flag-700 rounded-xl py-4 font-extrabold text-center">Cuộc thi đã kết thúc — Trân trọng cảm ơn thí sinh!</div>';
      clearInterval(timer);
      return;
    }
    els.d.textContent = String(Math.floor(diff / 86400000));
    els.h.textContent = String(Math.floor(diff / 3600000) % 24).padStart(2, '0');
    els.m.textContent = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
    els.s.textContent = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
  }
  tick();
  const timer = setInterval(tick, 1000);
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
