/**
 * quiz.js (OES / VERCEL EDITION) — Luồng làm bài thi trực tuyến:
 *   Danh sách đề → bắt đầu (server cấp attempt token + thời gian) → làm bài
 *   + đếm ngược → nộp bài (thủ công hoặc tự động khi hết giờ) → chấm điểm
 *   server → kết quả.
 *
 * An toàn dữ liệu:
 *  - Đề tải về không chứa đáp án đúng; chấm điểm 100% trên máy chủ.
 *  - Câu trả lời tạm lưu localStorage theo cccd+examId → refresh không mất bài.
 *  - Attempt token (HMAC do server cấp) lưu localStorage → refresh/đổi tab
 *   /khởi động lại máy vẫn giữ nguyên đồng hồ làm bài trên nền serverless.
 */
'use strict';

Auth.guard();

const state = {
  examId: new URLSearchParams(location.search).get('id'),
  exam: null,
  remaining: 0,          // giây
  totalSeconds: 0,
  current: 0,            // index câu đang xem
  answers: {},           // { qid: choiceIndex }
  timerId: null,
  submitting: false,
  attemptToken: '',      // HMAC { cccd, examId, startedAt } — phiên thi stateless
};

/* ------------------------------ Tiện ích view ------------------------------ */
function showView(name) {
  for (const v of ['view-list', 'view-quiz', 'view-result']) {
    document.getElementById(v).classList.toggle('hidden', v !== name);
  }
  window.scrollTo({ top: 0 });
}

function answerKey() {
  return `quiz_answers_${Auth.user().cccd}_${state.examId}`;
}
function saveAnswersLocal() {
  localStorage.setItem(answerKey(), JSON.stringify(state.answers));
}
function loadAnswersLocal() {
  try { return JSON.parse(localStorage.getItem(answerKey()) || '{}'); }
  catch { return {}; }
}
function clearAnswersLocal() {
  localStorage.removeItem(answerKey());
}

/* Attempt token: bằng chứng “đã bắt đầu lúc nào” do server ký — sống 24h. */
function attemptKey() {
  return `quiz_attempt_${Auth.user().cccd}_${state.examId}`;
}
function loadAttemptToken() {
  return localStorage.getItem(attemptKey()) || '';
}
function saveAttemptToken(token) {
  try { localStorage.setItem(attemptKey(), token); } catch { /* bỏ qua */ }
}
function clearAttemptToken() {
  localStorage.removeItem(attemptKey());
}

/* ============================ VIEW 1: DANH SÁCH ĐỀ ============================ */
/**
 * Giờ thi quy định: thẻ đề hiển thị trạng thái cửa thi + đếm ngược mở/đóng cửa.
 * Nút "Vào thi" bị KHÓA khi chưa mở cửa hoặc đã đóng cửa (server vẫn chặn lại
 * lần nữa ở POST /start — khóa ở đây chỉ là lớp giao diện cho thân thiện).
 */
function windowInfo(e) {
  const openMs = e.openAt ? Date.parse(e.openAt) : null;
  const closeMs = e.closeAt ? Date.parse(e.closeAt) : null;
  const now = Date.now();
  let status = 'open';
  if (openMs !== null && now < openMs) status = 'scheduled';
  if (closeMs !== null && now >= closeMs) status = 'closed';
  return { status, openMs, closeMs };
}

function windowBadgeHtml(e) {
  if (e.windowStatus === 'unscheduled' && !e.openAt && !e.closeAt) return '';
  const w = windowInfo(e);
  if (w.status === 'scheduled') {
    return `<div class="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-win="${esc(e.id)}">
      <span>⏰</span><span>Mở cửa từ <b>${esc(fmtVn(e.openAt))}</b> (giờ VN)</span></div>`;
  }
  if (w.status === 'closed') {
    return `<div class="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2" data-win="${esc(e.id)}">
      <span>🔒</span><span>Đã đóng cửa từ <b>${esc(fmtVn(e.closeAt))}</b> (giờ VN)</span></div>`;
  }
  const closeTxt = e.closeAt
    ? `Đang mở — đóng cửa lúc <b>${esc(fmtVn(e.closeAt))}</b> (giờ VN)`
    : 'Đang mở — thí sinh có thể vào thi';
  return `<div class="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2" data-win="${esc(e.id)}">
    <span>🟢</span><span>${closeTxt}</span></div>`;
}

function windowButtonHtml(e) {
  const w = windowInfo(e);
  if (w.status === 'scheduled') {
    return `<button disabled class="mt-5 w-full bg-slate-200 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">⏳ Chưa mở cửa</button>`;
  }
  if (w.status === 'closed') {
    return `<button disabled class="mt-5 w-full bg-slate-200 text-slate-400 font-bold py-3 rounded-xl cursor-not-allowed">🔒 Đã đóng cửa</button>`;
  }
  return `<button onclick="startExam('${esc(e.id)}')" class="mt-5 w-full bg-flag-600 hover:bg-flag-700 text-white font-bold py-3 rounded-xl transition">Vào thi</button>`;
}

async function renderExamList() {
  showView('view-list');
  const user = Auth.user();
  document.getElementById('user-chip').textContent =
    `Thí sinh: ${maskCccd(user.cccd)} · ${user.unit || ''}`;
  const titleEl = document.getElementById('list-title');
  const subEl = document.getElementById('list-sub');
  if (titleEl) titleEl.textContent = 'Danh sách đề thi — các hạng mục';
  if (subEl) subEl.textContent = 'Chọn một hạng mục để bắt đầu lượt thi. Thời gian làm bài được giám sát bởi máy chủ.';
  const grid = document.getElementById('exam-grid');
  try {
    const { exams } = await api('/exams');
    state.examMeta = exams; // ticker cập nhật cửa thi theo thời gian thực
    if (exams.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <div class="text-4xl">📋</div>
          <p class="font-bold text-slate-700 mt-3">Chưa có đề thi nào được mở</p>
          <p class="text-sm text-slate-400 mt-1">Ban Tổ chức sẽ công bố đề thi trong thời gian sớm nhất. Vui lòng quay lại sau.</p>
        </div>`;
      return;
    }
    // R10a: đề ảo "random30" (isRandom) render thẻ riêng nổi bật — không còn
    // hiện tượng "bộ đề ngẫu nhiên biến mất" khỏi danh sách.
    grid.innerHTML = exams.map((e) => e.isRandom ? randomCardHtml(e) : `
      <article class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col hover:shadow-soft transition" data-exam-card="${esc(e.id)}">
        <span class="self-start bg-flag-50 text-flag-700 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded">${esc(e.category)}</span>
        <h2 class="font-serif font-bold text-lg text-slate-900 mt-3 leading-snug">${esc(e.title)}</h2>
        <p class="text-sm text-slate-500 mt-2 leading-relaxed flex-1">${esc(e.description || 'Đề thi trắc nghiệm kiến thức pháp luật.')}</p>
        <div class="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span>📝 ${e.questionCount} câu</span>
          <span>⏱ ${e.durationMinutes} phút</span>
        </div>
        ${windowBadgeHtml(e)}
        ${windowButtonHtml(e)}
      </article>`).join('');
    startWindowTicker();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">${esc(err.message)}</div>`;
  }
}

/**
 * R10a — Thẻ đề ngẫu nhiên random30 trong danh sách đề (nổi bật, nền đỏ cờ).
 * Khi pool đang dùng TOÀN BỘ ngân hàng (chưa nạp exam_c6) hiển thị cảnh báo
 * để Ban Tổ chức biết cần dán examsVercel_6de.json vào examsVercel.json.
 */
function randomCardHtml(e) {
  const poolWarn = e.poolSourceId
    ? ''
    : `<div class="mt-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs leading-relaxed px-3 py-2">
         ⚠ Chưa tìm thấy Bộ đề số 6 (exam_c6) trong kho — đang trộn từ <b>toàn bộ ngân hàng đề thi</b> (${e.poolQuestions || 0} câu).
         Ban Tổ chức cần nạp examsVercel_6de.json vào examsVercel.json trên Google Drive để đề trộn đúng 150 câu Luật An ninh mạng 2026.
       </div>`;
  return `
    <article class="col-span-full bg-gradient-to-br from-flag-700 via-flag-600 to-flag-800 text-white rounded-2xl shadow-soft p-6 sm:p-8 star-pattern" data-exam-card="${esc(e.id)}">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <span class="inline-block bg-gold-400 text-flag-900 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">★ Đề riêng mỗi thí sinh</span>
          <h2 class="font-serif font-bold text-xl sm:text-2xl mt-3 leading-snug">${esc(e.title)}</h2>
        </div>
        <div class="text-right text-xs text-white/70 leading-relaxed">
          <div>⭐ mỗi câu ${e.pointsPerQuestion || 2} điểm</div>
          <div>Thang 10 · Thang 100 · Thang 60</div>
        </div>
      </div>
      <p class="text-sm text-white/85 mt-3 leading-relaxed">${esc(e.description || '')}</p>
      <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/75">
        <span>📝 ${e.questionCount} câu / lượt</span>
        <span>⏱ ${e.durationMinutes} phút</span>
        <span>🎯 Nguồn đề: ${esc(e.poolSourceLabel || 'ngân hàng đề thi')} (${e.poolQuestions || 0} câu)</span>
      </div>
      ${poolWarn}
      ${windowBadgeHtml(e)}
      ${windowButtonHtml(e)}
    </article>`;
}

/**
 * Đồng hồ "cửa thi" 1 giây/lần: tự đổi nhãn + nút bấm khi tới giờ mở cửa hoặc
 * giờ đóng cửa mà KHÔNG cần tải lại trang (thí sinh cứ để tab mở chờ giờ thi).
 * Mỗi thẻ lưu chữ ký nội dung trong data-sig — chỉ đụng DOM khi trạng thái đổi.
 */
let windowTickerId = null;
const windowSig = new Map(); // examId → signature lần render trước
function startWindowTicker() {
  if (windowTickerId) return;
  windowTickerId = setInterval(() => {
    if (!state.examMeta) return;
    for (const card of document.querySelectorAll('[data-exam-card]')) {
      const id = card.getAttribute('data-exam-card');
      const e = state.examMeta.find((x) => x.id === id);
      if (!e) continue;
      const newBadge = windowBadgeHtml(e);
      const newBtn = windowButtonHtml(e);
      const sig = newBadge + '|' + newBtn;
      if (windowSig.get(id) === sig) continue; // Không đổi — bỏ qua, không nhấp nháy.
      windowSig.set(id, sig);
      const oldBadge = card.querySelector('[data-win]');
      const oldBtn = card.querySelector('article > button, button.mt-5');
      if (oldBadge) oldBadge.outerHTML = newBadge;
      if (oldBtn) oldBtn.outerHTML = newBtn;
    }
  }, 1000);
}
state.examMeta = null; // danh sách đề gốc cho ticker

/* ================== MÀN HÌNH "ĐỀ CỦA BẠN" (đề ngẫu nhiên — R9) ================== */
/**
 * Thí sinh KHÔNG cần chọn đề nữa: vào khu vực thi là thấy thẻ "Đề thi ngẫu
 * nhiên 30 câu / 20 phút". Bấm vào thi → server trộn đề riêng và ký bộ đề
 * vào attempt token. Quản trị vẫn xem được danh sách đề gốc qua ?list=1.
 */
function hasOngoingRandomAttempt() {
  try {
    return !!localStorage.getItem(`quiz_attempt_${Auth.user().cccd}_random30`);
  } catch { return false; }
}

function renderRandomIntro() {
  showView('view-list');
  const user = Auth.user();
  document.getElementById('user-chip').textContent =
    `Thí sinh: ${maskCccd(user.cccd)} · ${user.unit || ''}`;
  const titleEl = document.getElementById('list-title');
  const subEl = document.getElementById('list-sub');
  if (titleEl) titleEl.textContent = 'Bài thi trực tuyến của bạn';
  if (subEl) subEl.textContent = 'Mỗi thí sinh nhận MỘT đề riêng 30 câu — vào lại bất cứ lúc nào vẫn là đúng bộ đề của bạn.';

  const resume = hasOngoingRandomAttempt();
  const grid = document.getElementById('exam-grid');
  grid.innerHTML = `
    <article class="col-span-full max-w-2xl mx-auto w-full bg-white rounded-3xl border border-slate-100 shadow-soft p-8 sm:p-10 text-center">
      <span class="inline-block bg-flag-50 text-flag-700 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">Đề riêng theo thí sinh · Luật An ninh mạng 2026</span>
      <h2 class="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-4">Đề thi ngẫu nhiên 30 câu — 20 phút</h2>
      <div class="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
        <span>📝 30 câu / lượt</span>
        <span>⏱ 20 phút</span>
        <span>🎯 4 đáp án / câu</span>
        <span>⭐ mỗi câu 2 điểm</span>
      </div>
      <p class="text-sm text-slate-500 mt-4 leading-relaxed">Hệ thống trộn đề riêng 30 câu từ <b>150 câu của Bộ đề số 6 — Luật An ninh mạng và các Nghị định hướng dẫn năm 2026</b>. Bộ đề gắn với tài khoản của bạn: thoát ra và vào lại vẫn nhận ĐÚNG bộ đề cũ, đồng hồ 20 phút do máy chủ giám sát. Hết giờ hệ thống tự động nộp bài theo các câu đã trả lời.</p>
      <div class="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div class="rounded-xl border border-flag-100 bg-flag-50 py-2.5 font-bold text-flag-700">Thang 10<br /><span class="text-[10px] font-medium text-flag-600/70">xếp hạng chính</span></div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 py-2.5 font-bold text-slate-600">Thang 100<br /><span class="text-[10px] font-medium text-slate-400">% câu đúng</span></div>
        <div class="rounded-xl border border-gold-400/60 bg-gold-400/10 py-2.5 font-bold text-gold-600">Thang 60<br /><span class="text-[10px] font-medium text-gold-600/70">30 câu × 2 điểm</span></div>
      </div>
      <button onclick="startExam('random30')" class="mt-6 w-full sm:w-auto bg-flag-600 hover:bg-flag-700 text-white font-extrabold text-lg px-10 py-4 rounded-2xl shadow transition">${resume ? 'Tiếp tục lượt thi đang làm' : 'Vào thi ngay'}</button>
      ${user.role === 'admin' ? '<p class="mt-5 text-xs"><a href="/quiz.html?list=1" class="text-flag-700 underline font-semibold">Quản trị: xem danh sách đề gốc</a></p>' : ''}
    </article>`;
}

/* ============================ VÀO THI ============================ */
async function startExam(examId) {
  try {
    state.examId = examId;
    // Gửi attemptToken (nếu có) để server kế tục lượt đang làm — không reset đồng hồ.
    const savedToken = loadAttemptToken();
    const start = await api(`/exams/${examId}/start`, {
      method: 'POST',
      body: savedToken ? { attemptToken: savedToken } : {},
    });
    // Đề ngẫu nhiên (random30): đề được trả ngay trong phản hồi start; đề
    // thường thì vẫn tải qua GET /exams/:id như cũ.
    const exam = start.exam || (await api(`/exams/${examId}`)).exam;

    state.exam = exam;
    state.attemptToken = start.attemptToken || savedToken;
    if (start.attemptToken) saveAttemptToken(start.attemptToken);
    state.totalSeconds = start.durationMinutes * 60;
    state.remaining = start.remainingSeconds;
    // Giữ lại câu trả lời khớp với bộ đề hiện tại (lượt mới khác lượt cũ →
    // tự loại đáp án "ma" của lượt trước, tránh tick sẵn câu không thuộc đề).
    const savedAnswers = loadAnswersLocal();
    state.answers = Object.fromEntries(
      Object.entries(savedAnswers).filter(([qid]) =>
        state.exam.questions.some((q) => q.id === qid))
    );
    saveAnswersLocal();
    state.current = 0;

    // Về lại danh sách nếu hết giờ ngay khi vào.
    if (state.remaining <= 0) {
      toast('Lượt thi này đã hết giờ, hệ thống sẽ nộp bài tự động.', 'info');
    }

    document.getElementById('q-category').textContent = exam.category;
    document.getElementById('q-title').textContent = exam.title;
    document.getElementById('total-count').textContent = exam.questions.length;
    renderPalette();
    renderQuestion();
    startTimer();
    showView('view-quiz');
  } catch (err) {
    toast(err.message, 'error');
    // Bị máy chủ chặn vì giờ thi quy định (423) → nạp lại danh sách để nút
    // "Vào thi" chuyển sang trạng thái khóa đúng lúc.
    if (err.status === 423) {
      state.examId = null;
      renderExamList();
    }
  }
}

/* ============================ LÀM BÀI ============================ */
function renderPalette() {
  const palette = document.getElementById('palette');
  palette.innerHTML = state.exam.questions
    .map((q, i) => {
      const answered = state.answers[q.id] !== undefined;
      const active = i === state.current;
      return `<button onclick="gotoQuestion(${i})" data-palette="${i}"
        class="h-9 rounded-lg text-xs font-bold transition ${
          active ? 'bg-flag-600 text-white shadow'
          : answered ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }">${i + 1}</button>`;
    })
    .join('');
  updateAnsweredCount();
}

function updateAnsweredCount() {
  const n = Object.keys(state.answers).length;
  document.getElementById('answered-count').textContent = n;
}

function gotoQuestion(i) {
  state.current = i;
  renderQuestion();
  renderPalette();
}

function renderQuestion() {
  const q = state.exam.questions[state.current];
  document.getElementById('q-counter').textContent = `Câu ${state.current + 1}/${state.exam.questions.length}`;
  document.getElementById('q-text').textContent = q.text;
  document.getElementById('progress-bar').style.width =
    `${((state.current + 1) / state.exam.questions.length) * 100}%`;

  const chosen = state.answers[q.id];
  document.getElementById('q-options').innerHTML = q.options
    .map((opt, i) => `
      <label class="flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition ${
        chosen === i ? 'border-flag-500 bg-flag-50 ring-1 ring-flag-500' : 'border-slate-200 hover:border-flag-200 hover:bg-flag-50/40'
      }" onclick="chooseOption(${i})">
        <span class="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${
          chosen === i ? 'bg-flag-600 border-flag-600 text-white' : 'border-slate-300 text-slate-500'
        }">${String.fromCharCode(65 + i)}</span>
        <span class="text-[15px] text-slate-700 leading-relaxed">${esc(opt)}</span>
      </label>`)
    .join('');

  document.getElementById('btn-prev').disabled = state.current === 0;
  const isLast = state.current === state.exam.questions.length - 1;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.textContent = isLast ? 'Đã đến câu cuối' : 'Câu sau →';
  nextBtn.disabled = isLast;
}

function chooseOption(i) {
  const q = state.exam.questions[state.current];
  state.answers[q.id] = i;
  saveAnswersLocal();
  renderQuestion();
  renderPalette();
}

document.getElementById('btn-prev').addEventListener('click', () => gotoQuestion(Math.max(state.current - 1, 0)));
document.getElementById('btn-next').addEventListener('click', () => gotoQuestion(Math.min(state.current + 1, state.exam.questions.length - 1)));

/* ============================ ĐẾM NGƯỢC ============================ */
function startTimer() {
  stopTimer();
  updateTimerUI();
  state.timerId = setInterval(() => {
    state.remaining -= 1;
    updateTimerUI();
    if (state.remaining <= 0) {
      stopTimer();
      autoSubmit();
    }
  }, 1000);
}
function stopTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}
function updateTimerUI() {
  const box = document.getElementById('timer');
  document.getElementById('timer-text').textContent = fmtClock(state.remaining);
  const danger = state.remaining <= 60;
  box.classList.toggle('bg-red-600', danger);
  box.classList.toggle('timer-danger', danger);
  box.classList.toggle('bg-flag-600', !danger);
}

/* ============================ NỘP BÀI ============================ */
function askSubmit() {
  if (state.submitting) return;
  const answered = Object.keys(state.answers).length;
  const total = state.exam.questions.length;
  const unanswered = total - answered;
  document.getElementById('modal-submit-detail').innerHTML =
    `Bạn đã trả lời <b>${answered}/${total}</b> câu` +
    (unanswered > 0 ? `, còn <b class="text-red-600">${unanswered} câu bỏ trống</b>. Câu bỏ trống sẽ không được tính điểm.` : '.') +
    ` Thời gian còn lại: <b>${fmtClock(state.remaining)}</b>.`;
  openModal('modal-submit');
}

async function doSubmit() {
  if (state.submitting) return;
  state.submitting = true;
  stopTimer();
  setBusyUI(true);
  const payload = {
    answers: Object.entries(state.answers).map(([qid, choice]) => ({ qid, choice })),
    // Đề ngẫu nhiên: gửi kèm danh sách câu hỏi của lượt làm bài — server dùng
    // khi mất attempt token (fallback); có token thì server ưu tiên token.
    qids: state.exam && Array.isArray(state.exam.questions)
      ? state.exam.questions.map((q) => q.id)
      : undefined,
    durationSeconds: state.totalSeconds - Math.max(state.remaining, 0),
    attemptToken: loadAttemptToken() || state.attemptToken || '',
  };
  try {
    const data = await api(`/exams/${state.examId}/submit`, { method: 'POST', body: payload });
    clearAnswersLocal();
    clearAttemptToken();
    renderResult(data.result);
  } catch (err) {
    toast(err.message, 'error');
    state.submitting = false;
    setBusyUI(false);
    // Nếu máy chủ vẫn yêu cầu đăng nhập hợp lệ mà phiên hết hạn, api() đã redirect.
    if (state.remaining > 0) startTimer();
  }
}

function autoSubmit() {
  if (state.submitting) return;
  toast('Hết giờ làm bài! Hệ thống tự động nộp bài của bạn.', 'info');
  doSubmit();
}

function setBusyUI(busy) {
  for (const id of ['btn-submit-top', 'btn-submit-side', 'btn-confirm-submit']) {
    const b = document.getElementById(id);
    if (b) { b.disabled = busy; b.classList.toggle('opacity-60', busy); }
  }
  closeModal('modal-submit');
}

function renderResult(r) {
  showView('view-result');
  // R10 — 3 THANG ĐIỂM: server trả score/score100/score60; phòng hờ tự tính lại.
  const s = computeScales(r.correct, r.total, r);
  animateScore(s.score10);
  document.getElementById('r-correct').textContent = `${r.correct} câu`;
  document.getElementById('r-total').textContent = `${r.total} câu`;
  document.getElementById('r-duration').textContent = fmtDuration(r.durationSeconds);
  document.getElementById('r-s10').textContent = fmtScore(s.score10);
  document.getElementById('r-s100').textContent = fmtScore(s.score100);
  document.getElementById('r-s60').textContent = fmtScore(s.score60);
  // Ghi chú thang 60 chỉ áp đúng khi bộ đề 30 câu (mỗi câu 2 điểm).
  const note = document.getElementById('r-scale-note');
  if (Number(r.total) === 30) note.classList.remove('hidden');
  else note.classList.add('hidden');
  const ring = document.getElementById('score-ring');
  setTimeout(() => { ring.style.setProperty('--pct', Math.round(s.score100)); }, 120);
}

function animateScore(target) {
  const el = document.getElementById('r-score');
  const t0 = performance.now();
  const dur = 1100;
  function frame(t) {
    const p = Math.min((t - t0) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (Math.round(target * eased * 100) / 100).toFixed(2);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.getElementById('btn-submit-top').addEventListener('click', askSubmit);
document.getElementById('btn-submit-side').addEventListener('click', askSubmit);
document.getElementById('btn-confirm-submit').addEventListener('click', doSubmit);

/* Cảnh báo khi rời trang giữa lượt thi. */
window.addEventListener('beforeunload', (e) => {
  if (state.exam && !state.submitting && document.getElementById('view-quiz').classList.contains('hidden') === false) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ============================ ĐIỀU HƯỚNG CHÍNH ============================ */
(function main() {
  const user = Auth.user();
  document.getElementById('header-user').innerHTML = `
    <span class="hidden sm:inline text-slate-400">${esc(maskCccd(user.cccd))}</span>
    ${user.role === 'admin' ? `<a href="/admin.html" class="text-flag-700 bg-flag-50 hover:bg-flag-100 font-semibold px-3 py-2 rounded-lg transition">Quản trị</a>` : ''}
    <button onclick="doLogout()" class="text-slate-500 hover:text-red-600 font-semibold px-3 py-2 transition">Đăng xuất</button>`;

  const listParam = new URLSearchParams(location.search).get('list');
  if (state.examId) startExam(state.examId);
  else if (listParam === '1') renderExamList(); // Quản trị xem đề gốc
  else renderRandomIntro(); // Thí sinh: màn hình đề ngẫu nhiên
})();
