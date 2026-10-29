/**
 * admin.js — Logic Admin Dashboard:
 *  - Tổng quan: thống kê + biểu đồ cột điểm TB + bài thi mới nhất.
 *  - Người dùng: tìm kiếm, sửa (modal), xóa (xác nhận).
 *  - Đề thi: danh sách + form ra đề mới (thêm/xóa câu hỏi động).
 *  - Bảng điểm: lọc theo hạng mục, xếp hạng, can thiệp sửa / xóa kết quả.
 */
'use strict';

Auth.guard({ admin: true });

const currentUser = Auth.user();
document.getElementById('admin-chip').textContent = `Admin: ${maskCccd(currentUser.cccd)}`;

/* Dữ liệu đệm client-side. */
const cache = { users: [], exams: [], results: [] };
let rankByScore = false;
let editingUserCccd = null;
let editingResultId = null;
let examFormBusy = false;   // Đang gửi form đề thi — chặn bấm Lưu lặp làm nhân đôi đề.
let userFormBusy = false;   // Đang gửi form người dùng.
let resultFormBusy = false; // Đang gửi form kết quả.
let deleteAction = null; // { label, run() }

/* ------------------------------ Điều hướng section ------------------------------ */
function switchSection(name) {
  for (const el of document.querySelectorAll('.admin-section')) el.classList.add('hidden');
  document.getElementById(`section-${name}`).classList.remove('hidden');
  for (const btn of document.querySelectorAll('.nav-btn')) {
    const active = btn.dataset.section === name;
    btn.className = `nav-btn flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
      active ? 'bg-flag-600 text-white shadow' : 'text-slate-600 hover:bg-flag-50 hover:text-flag-700'
    }`;
  }
  if (name === 'overview') renderOverview();
  if (name === 'users') renderUsers();
  if (name === 'exams') renderExams();
  if (name === 'results') renderResults();
  if (name === 'teams') renderTeams();
  if (name === 'site') loadSiteForm();
}
for (const btn of document.querySelectorAll('.nav-btn')) {
  btn.addEventListener('click', () => switchSection(btn.dataset.section));
}

/* ------------------------------ Nạp dữ liệu ------------------------------ */
async function refreshAll() {
  try {
    const [u, e, r] = await Promise.all([api('/admin/users'), api('/exams'), api('/admin/results')]);
    cache.users = u.users;
    cache.exams = e.exams;
    cache.results = r.results;
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ================================ TỔNG QUAN ================================ */
function renderOverview() {
  document.getElementById('ov-users').textContent = cache.users.length.toLocaleString('vi-VN');
  // R10a: không đếm đề ảo random30 (isRandom) vào số đề thi thực.
  document.getElementById('ov-exams').textContent = cache.exams.filter((e) => !e.isRandom).length.toLocaleString('vi-VN');
  document.getElementById('ov-results').textContent = cache.results.length.toLocaleString('vi-VN');
  const avg = cache.results.length
    ? Math.round((cache.results.reduce((s, r) => s + (Number(r.score) || 0), 0) / cache.results.length) * 100) / 100
    : 0;
  document.getElementById('ov-avg').textContent = avg.toFixed(2);

  // Cột điểm trung bình theo đề thi.
  const byExam = {};
  for (const r of cache.results) {
    (byExam[r.examTitle] = byExam[r.examTitle] || { sum: 0, n: 0 });
    byExam[r.examTitle].sum += Number(r.score) || 0;
    byExam[r.examTitle].n += 1;
  }
  const barsHost = document.getElementById('ov-bars');
  const entries = Object.entries(byExam);
  if (entries.length === 0) {
    barsHost.innerHTML = '<p class="text-slate-400">Chưa có dữ liệu.</p>';
  } else {
    const max = Math.max(...entries.map(([, v]) => v.sum / v.n), 1);
    barsHost.innerHTML = entries.map(([title, v]) => {
      const a = Math.round((v.sum / v.n) * 100) / 100;
      const pct = Math.round((a / max) * 100);
      return `
        <div>
          <div class="flex justify-between text-xs mb-1"><span class="font-semibold text-slate-700 truncate mr-2">${esc(title)}</span><span class="text-flag-600 font-bold">${a.toFixed(2)} đ</span></div>
          <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-flag-500 rounded-full" style="width:${pct}%"></div></div>
          <p class="text-[11px] text-slate-400 mt-0.5">${v.n} lượt thi</p>
        </div>`;
    }).join('');
  }

  const recentHost = document.getElementById('ov-recent');
  const recent = [...cache.results].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 6);
  recentHost.innerHTML = recent.length === 0
    ? '<p class="text-slate-400">Chưa có dữ liệu.</p>'
    : recent.map((r) => `
        <div class="flex items-center justify-between gap-3 border-b border-slate-50 pb-2 last:border-0">
          <div class="min-w-0">
            <p class="font-semibold text-slate-700 text-xs">${esc(maskCccd(r.cccd))}</p>
            <p class="text-[11px] text-slate-400 truncate">${esc(r.examTitle)} · ${fmtDateTime(r.submittedAt)}</p>
          </div>
          <span class="shrink-0 font-extrabold ${Number(r.score) >= 5 ? 'text-emerald-600' : 'text-red-500'}">${Number(r.score).toFixed(2)}</span>
        </div>`).join('');
}

/* ================================ NGƯỜI DÙNG ================================ */
function roleBadge(role) {
  return role === 'admin'
    ? '<span class="bg-flag-50 text-flag-700 font-bold text-[11px] px-2 py-0.5 rounded-full">Admin</span>'
    : '<span class="bg-slate-100 text-slate-600 font-semibold text-[11px] px-2 py-0.5 rounded-full">Thí sinh</span>';
}

function renderUsers() {
  const keyword = document.getElementById('user-search').value.trim().toLowerCase();
  const list = cache.users.filter((u) =>
    !keyword || [u.cccd, u.email, u.unit, u.position].some((v) => String(v || '').toLowerCase().includes(keyword))
  );
  const tbody = document.getElementById('users-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400 py-10">Không tìm thấy người dùng nào.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((u) => `
    <tr class="hover:bg-slate-50/70">
      <td class="px-5 py-3.5 font-mono font-semibold text-slate-800">${esc(u.cccd)}<div class="text-[11px] text-slate-400 font-sans">Tạo: ${fmtDate(u.createdAt)}</div></td>
      <td class="px-5 py-3.5">
        <div class="text-slate-700 font-medium">${esc(u.phone)}</div>
        <div class="text-xs text-slate-400">${esc(u.email)}</div>
      </td>
      <td class="px-5 py-3.5">
        <div class="text-slate-700">${esc(u.position)}</div>
        <div class="text-xs text-slate-400">${esc(u.unit)}</div>
      </td>
      <td class="px-5 py-3.5">${roleBadge(u.role)}</td>
      <td class="px-5 py-3.5 text-right whitespace-nowrap">
        <button onclick="openUserModal('${esc(u.cccd)}')" class="text-flag-600 hover:text-flag-800 font-semibold text-xs px-2 py-1.5">Sửa</button>
        <button onclick="askDeleteUser('${esc(u.cccd)}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1.5">Xóa</button>
      </td>
    </tr>`).join('');
}
document.getElementById('user-search').addEventListener('input', renderUsers);

function openUserModal(cccd) {
  const u = cache.users.find((x) => x.cccd === cccd);
  if (!u) return;
  editingUserCccd = cccd;
  document.getElementById('mu-cccd').value = u.cccd;
  document.getElementById('mu-phone').value = u.phone || '';
  document.getElementById('mu-email').value = u.email || '';
  document.getElementById('mu-position').value = u.position || '';
  // R10: đơn vị công tác dạng dropdown 25 mục (giữ giá trị cũ nếu ngoài danh mục).
  document.getElementById('mu-unit').innerHTML = unitOptionsHtml(u.unit || '');
  document.getElementById('mu-role').value = u.role || 'user';
  document.getElementById('mu-password').value = '';
  document.getElementById('mu-error').classList.add('hidden');
  openModal('modal-user');
}

document.getElementById('form-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (userFormBusy) return;
  const body = {
    phone: document.getElementById('mu-phone').value.trim(),
    email: document.getElementById('mu-email').value.trim(),
    position: document.getElementById('mu-position').value.trim(),
    unit: document.getElementById('mu-unit').value.trim(),
    role: document.getElementById('mu-role').value,
  };
  const newPassword = document.getElementById('mu-password').value;
  if (newPassword) body.password = newPassword;
  userFormBusy = true;
  try {
    const data = await api(`/admin/users/${editingUserCccd}`, { method: 'PUT', body });
    toast(data.message, data.synced === false ? 'info' : 'success');
    if (data.synced === false) checkSyncStatus();
    closeModal('modal-user');
    await refreshAll();
    renderUsers();
    renderOverview();
  } catch (err) {
    const el = document.getElementById('mu-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  } finally {
    userFormBusy = false;
  }
});

function askDeleteUser(cccd) {
  askDelete(`Xóa vĩnh viễn tài khoản ${maskCccd(cccd)} khỏi hệ thống? Hành động này không thể hoàn tác.`, async () => {
    const data = await api(`/admin/users/${cccd}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await refreshAll();
    renderUsers();
    renderOverview();
  });
}

/* ================================ ĐỀ THI ================================ */
let editingExamId = null; // null = đang tạo mới; có giá trị = đang chỉnh sửa đề này.

/** Chip trạng thái cửa thi hiển thị trên thẻ đề trong dashboard. */
function examScheduleChip(e) {
  if (!e.openAt && !e.closeAt) return '';
  const now = Date.now();
  const openMs = e.openAt ? Date.parse(e.openAt) : null;
  const closeMs = e.closeAt ? Date.parse(e.closeAt) : null;
  if (openMs !== null && now < openMs) {
    return `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2">⏰ Mở cửa ${esc(fmtVn(e.openAt))} (giờ VN)</span>`;
  }
  if (closeMs !== null && now >= closeMs) {
    return `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 mt-2">🔒 Đóng cửa từ ${esc(fmtVn(e.closeAt))}</span>`;
  }
  return `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 mt-2">🟢 Đang mở${e.closeAt ? ` — đến ${esc(fmtVn(e.closeAt))}` : ''}</span>`;
}

function renderExams() {
  const host = document.getElementById('exams-list');
  // R10a: đề ảo "random30" (isRandom) render THẺ RIÊNG ở đầu danh sách —
  // hết cảnh "bộ đề ngẫu nhiên biến mất" trong Ban quản trị. Thẻ chỉ hiển thị
  // thông tin pool, không có nút Sửa/Xóa vì đề này do hệ thống sinh theo CCCD.
  const randomExam = cache.exams.find((e) => e.isRandom);
  const realExams = cache.exams.filter((e) => !e.isRandom);
  const randomCardHtml = randomExam ? `
    <article class="md:col-span-2 xl:col-span-3 bg-gradient-to-br from-flag-700 via-flag-600 to-flag-800 text-white rounded-2xl shadow-soft p-5 sm:p-6 star-pattern">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <span class="inline-block bg-gold-400 text-flag-900 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">★ Đề riêng mỗi thí sinh — đề ảo tự sinh</span>
          <h3 class="font-bold text-lg mt-2.5 leading-snug">${esc(randomExam.title)}</h3>
          <p class="text-xs text-white/85 mt-1.5 leading-relaxed">${esc(randomExam.description || '')}</p>
        </div>
        <div class="text-right text-xs text-white/75 leading-relaxed shrink-0">
          <div>📝 ${randomExam.questionCount} câu / lượt</div>
          <div>⏱ ${randomExam.durationMinutes} phút</div>
          <div>⭐ mỗi câu ${randomExam.pointsPerQuestion || 2} điểm (Thang 60)</div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span class="bg-white/10 border border-white/25 rounded-lg px-2.5 py-1.5">🎯 Pool: <b>${randomExam.poolQuestions || 0} câu</b> — ${esc(randomExam.poolSourceLabel || '')}</span>
        ${randomExam.poolSourceId
          ? `<button onclick="viewExam('${esc(randomExam.poolSourceId)}')" class="bg-white/10 hover:bg-white/20 border border-white/25 rounded-lg px-2.5 py-1.5 font-semibold transition">Xem đề nguồn (${esc(randomExam.poolSourceId)})</button>`
          : `<span class="bg-amber-100 border border-amber-300 text-amber-900 rounded-lg px-2.5 py-1.5 leading-relaxed">⚠ Chưa có Bộ đề số 6 (exam_c6) — đang trộn toàn bộ ngân hàng. Hãy nạp examsVercel_6de.json vào examsVercel.json trên Drive.</span>`}
      </div>
    </article>` : '';
  if (realExams.length === 0 && !randomExam) {
    host.innerHTML = `
      <div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div class="text-4xl">📝</div>
        <p class="font-bold text-slate-700 mt-3">Chưa có đề thi nào</p>
        <p class="text-sm text-slate-400 mt-1">Nhấn “Ra đề thi mới” để tạo đề thi đầu tiên cho cuộc thi.</p>
      </div>`;
    return;
  }
  host.innerHTML = randomCardHtml + realExams.map((e) => `
    <article class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
      <div class="flex items-start justify-between gap-2">
        <span class="bg-flag-50 text-flag-700 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded">${esc(e.category)}</span>
        <span class="text-[11px] text-slate-400">${fmtDate(e.createdAt)}</span>
      </div>
      <h3 class="font-bold text-slate-900 mt-3 leading-snug">${esc(e.title)}</h3>
      <p class="text-xs text-slate-500 mt-1.5 leading-relaxed flex-1">${esc(e.description || '—')}</p>
      ${examScheduleChip(e)}
      <div class="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span>📝 ${e.questionCount} câu</span><span>⏱ ${e.durationMinutes} phút</span>
      </div>
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-semibold">
        <button onclick="viewExam('${esc(e.id)}')" class="flex-1 text-center text-flag-600 hover:text-flag-800 px-2 py-1.5 rounded-lg hover:bg-flag-50">Xem đề</button>
        <button onclick="openExamEdit('${esc(e.id)}')" class="flex-1 text-center text-amber-600 hover:text-amber-700 px-2 py-1.5 rounded-lg hover:bg-amber-50">Sửa</button>
        <button onclick="askDeleteExam('${esc(e.id)}', '${esc(e.title)}')" class="flex-1 text-center text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50">Xóa</button>
      </div>
    </article>`).join('');
}

/* ---------- XEM CHI TIẾT ĐỀ THI (kèm đáp án đúng) ---------- */
async function viewExam(id) {
  try {
    const data = await api(`/admin/exams/${id}`);
    const exam = data.exam;
    document.getElementById('mv-title').textContent = exam.title;
    document.getElementById('mv-meta').innerHTML =
      `Hạng mục: <b class="text-flag-700">${esc(exam.category)}</b> · ` +
      `${(exam.questions || []).length} câu · ${exam.durationMinutes} phút` +
      (exam.updatedAt ? ` · <span title="Đã chỉnh sửa bởi admin">✎ đã sửa ${fmtDateTime(exam.updatedAt)}</span>` : '') +
      (exam.openAt || exam.closeAt
        ? `<br>⏰ Giờ thi quy định: ` +
          (exam.openAt ? `mở cửa <b>${esc(fmtVn(exam.openAt))}</b>` : 'không giới hạn giờ mở') +
          (exam.closeAt ? ` · đóng cửa <b>${esc(fmtVn(exam.closeAt))}</b>` : ' · không giới hạn giờ đóng') +
          ' (giờ VN)'
        : '<br>⏰ Không quy định giờ thi — thí sinh thi được mọi lúc');
    document.getElementById('mv-desc').textContent = exam.description || '';
    document.getElementById('mv-questions').innerHTML = (exam.questions || []).map((q, i) => `
      <div class="border border-slate-200 rounded-2xl p-4 bg-slate-50/60">
        <p class="font-semibold text-slate-800 text-sm">Câu ${i + 1}. ${esc(q.text)}</p>
        <div class="mt-2.5 grid sm:grid-cols-2 gap-2">
          ${(q.options || []).map((opt, j) => `
            <div class="flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${
              j === q.correctIndex
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                : 'bg-white border-slate-200 text-slate-600'
            }">
              <span class="shrink-0 font-bold">${String.fromCharCode(65 + j)}.</span>
              <span class="min-w-0">${esc(opt)}${j === q.correctIndex ? ' <span title="Đáp án đúng">✓</span>' : ''}</span>
            </div>`).join('')}
        </div>
      </div>`).join('');
    document.getElementById('mv-edit').onclick = () => {
      closeModal('modal-exam-view');
      openExamEdit(id);
    };
    openModal('modal-exam-view');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---------- Form ra đề / sửa đề: builder câu hỏi động ---------- */
let questionSeq = 0;

/** Bật/tắt khối nhập giờ thi quy định trong form đề. */
function toggleScheduleInputs() {
  const on = document.getElementById('me-sched-on').checked;
  const box = document.getElementById('me-sched-fields');
  box.classList.toggle('hidden', !on);
  if (!on) {
    document.getElementById('me-openat').value = '';
    document.getElementById('me-closeat').value = '';
  }
}

function resetScheduleInputs(exam = null) {
  const on = !!(exam && (exam.openAt || exam.closeAt));
  document.getElementById('me-sched-on').checked = on;
  document.getElementById('me-openat').value = on ? isoToVnLocal(exam.openAt || '') : '';
  document.getElementById('me-closeat').value = on ? isoToVnLocal(exam.closeAt || '') : '';
  document.getElementById('me-sched-fields').classList.toggle('hidden', !on);
}

function questionRowHtml(n, q) {
  const text = q ? q.text || '' : '';
  const correctIndex = q ? q.correctIndex : 0;
  return `
    <div class="question-row border border-slate-200 rounded-2xl p-4 bg-slate-50/60" data-idx="${n}">
      <div class="flex items-center justify-between">
        <span class="text-xs font-extrabold uppercase tracking-wider text-flag-700 q-label">Câu hỏi ${n + 1}</span>
        <button type="button" onclick="removeQuestionRow(this)" class="text-xs font-semibold text-red-500 hover:text-red-700">Xóa câu</button>
      </div>
      <textarea class="field mt-2" rows="2" placeholder="Nội dung câu hỏi..." data-q="text">${esc(text)}</textarea>
      <div class="mt-3 space-y-2" data-q="options">
        ${[0, 1, 2, 3].map((i) => `
          <div class="flex items-center gap-2">
            <input type="radio" name="correct-${n}" data-q="radio" value="${i}" title="Đánh dấu là đáp án đúng" class="accent-red-700 shrink-0" ${i === correctIndex ? 'checked' : ''} />
            <input class="field !py-2" type="text" placeholder="Phương án ${String.fromCharCode(65 + i)}" data-q="opt" value="${esc(q && q.options && q.options[i] ? q.options[i] : '')}" />
          </div>`).join('')}
      </div>
      <p class="text-[11px] text-slate-400 mt-2">Chọn nút tròn trước phương án <b>đúng</b>.</p>
    </div>`;
}

function addQuestionRow(q) {
  const host = document.getElementById('questions-builder');
  host.insertAdjacentHTML('beforeend', questionRowHtml(questionSeq, q));
  questionSeq += 1;
  renumberQuestions();
}

function removeQuestionRow(btn) {
  btn.closest('.question-row').remove();
  renumberQuestions();
}

function renumberQuestions() {
  document.querySelectorAll('.question-row .q-label').forEach((el, i) => {
    el.textContent = `Câu hỏi ${i + 1}`;
  });
}

/** Mở form ở chế độ TẠO MỚI. */
function openExamForm() {
  editingExamId = null;
  document.getElementById('form-exam').reset();
  document.getElementById('questions-builder').innerHTML = '';
  questionSeq = 0;
  document.getElementById('me-error').classList.add('hidden');
  document.getElementById('modal-exam-title').textContent = 'Ra đề thi mới';
  resetScheduleInputs(null); // ẩn + xóa giờ thi quy định
  const submitBtn = document.getElementById('me-submit');
  submitBtn.textContent = 'Lưu đề thi';
  submitBtn.disabled = false;
  addQuestionRow();
  addQuestionRow();
  openModal('modal-exam');
}

/** Mở form ở chế độ CHỈNH SỬA: tải đề từ server và điền sẵn toàn bộ form. */
async function openExamEdit(id) {
  try {
    const data = await api(`/admin/exams/${id}`);
    const exam = data.exam;
    editingExamId = id;
    document.getElementById('form-exam').reset();
    document.getElementById('questions-builder').innerHTML = '';
    questionSeq = 0;
    document.getElementById('me-error').classList.add('hidden');
    document.getElementById('modal-exam-title').textContent = 'Chỉnh sửa đề thi';
    document.getElementById('me-title').value = exam.title || '';
    document.getElementById('me-category').value = exam.category || '';
    document.getElementById('me-duration').value = exam.durationMinutes || 20;
    document.getElementById('me-desc').value = exam.description || '';
    resetScheduleInputs(exam); // điền sẵn giờ thi quy định (đổi về giờ VN)
    const questions = exam.questions || [];
    if (questions.length === 0) {
      addQuestionRow();
      addQuestionRow();
    } else {
      for (const q of questions) addQuestionRow(q);
    }
    const submitBtn = document.getElementById('me-submit');
    submitBtn.textContent = 'Cập nhật đề thi';
    submitBtn.disabled = false;
    openModal('modal-exam');
  } catch (err) {
    toast(err.message, 'error');
  }
}

document.getElementById('form-exam').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (examFormBusy) return; // Đang gửi — chặn bấm lặp (nguyên nhân đề bị nhân đôi).
  const rows = [...document.querySelectorAll('#questions-builder .question-row')];
  const questions = [];
  let firstError = null;
  rows.forEach((row, idx) => {
    const text = row.querySelector('[data-q="text"]').value.trim();
    const optInputs = [...row.querySelectorAll('[data-q="opt"]')];
    const radio = row.querySelector('[data-q="radio"]:checked');
    const options = optInputs.map((i) => i.value.trim());
    if (firstError) return;
    if (!text) { firstError = `Câu hỏi số ${idx + 1}: chưa nhập nội dung câu hỏi.`; return; }
    if (options.some((o) => !o)) { firstError = `Câu hỏi số ${idx + 1}: chưa nhập đủ 4 phương án trả lời.`; return; }
    if (!radio) { firstError = `Câu hỏi số ${idx + 1}: chưa đánh dấu phương án đúng.`; return; }
    questions.push({ text, options, correctIndex: parseInt(radio.value, 10) });
  });
  if (firstError || questions.length === 0) {
    const el = document.getElementById('me-error');
    el.textContent = firstError || 'Đề thi phải có ít nhất 1 câu hỏi hợp lệ.';
    el.classList.remove('hidden');
    return;
  }

  // ---- Giờ thi quy định (tùy chọn) ----
  let openAt = null;
  let closeAt = null;
  if (document.getElementById('me-sched-on').checked) {
    openAt = vnLocalToIso(document.getElementById('me-openat').value);
    closeAt = vnLocalToIso(document.getElementById('me-closeat').value);
    if (openAt === undefined || closeAt === undefined) {
      const el = document.getElementById('me-error');
      el.textContent = 'Giờ thi quy định không hợp lệ — hãy chọn lại ngày giờ trong ô lịch.';
      el.classList.remove('hidden');
      return;
    }
    if (!openAt) {
      const el = document.getElementById('me-error');
      el.textContent = 'Bạn đã bật "Quy định giờ thi" — vui lòng chọn giờ MỞ CỬA thi.';
      el.classList.remove('hidden');
      return;
    }
  }

  const body = {
    title: document.getElementById('me-title').value.trim(),
    category: document.getElementById('me-category').value.trim(),
    durationMinutes: parseInt(document.getElementById('me-duration').value, 10),
    description: document.getElementById('me-desc').value.trim(),
    openAt,
    closeAt,
    questions,
  };
  const submitBtn = document.getElementById('me-submit');
  examFormBusy = true;
  submitBtn.disabled = true;
  submitBtn.textContent = editingExamId ? 'Đang cập nhật...' : 'Đang lưu...';
  try {
    const data = editingExamId
      ? await api(`/admin/exams/${editingExamId}`, { method: 'PUT', body })
      : await api('/admin/exams', { method: 'POST', body });
    toast(data.message, data.synced === false ? 'info' : 'success');
    if (data.synced === false) checkSyncStatus();
    closeModal('modal-exam');
    await refreshAll();
    renderExams();
    renderOverview();
    fillResultFilter();
  } catch (err) {
    const el = document.getElementById('me-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  } finally {
    examFormBusy = false;
    submitBtn.disabled = false;
    submitBtn.textContent = editingExamId ? 'Cập nhật đề thi' : 'Lưu đề thi';
  }
});

function askDeleteExam(id, title) {
  askDelete(`Xóa đề thi "${title}"? Các kết quả thi của đề này vẫn được giữ trong bảng điểm.`, async () => {
    const data = await api(`/admin/exams/${id}`, { method: 'DELETE' });
    toast(data.message, data.synced === false ? 'info' : 'success');
    if (data.synced === false) checkSyncStatus();
    await refreshAll();
    renderExams();
    renderOverview();
    fillResultFilter();
  });
}

/** Nạp bộ đề mẫu (2 đề × 50 câu An toàn thông tin) — chỉ thêm những đề còn thiếu. */
async function seedSampleExams() {
  try {
    const data = await api('/admin/seed-sample-exams', { method: 'POST' });
    toast(data.message, data.synced === false ? 'info' : 'success');
    if (data.synced === false) checkSyncStatus();
    await refreshAll();
    renderExams();
    renderOverview();
    fillResultFilter();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ==================== TRẠNG THÁI ĐỒNG BỘ GOOGLE DRIVE ====================
 * Vercel serverless: mỗi instance bị giải phóng bất kỳ lúc nào — dữ liệu chưa
 * ghi kịp lên Google Drive sẽ MẤT khi instance kết thúc.
 * Banner này để admin LUÔN biết dữ liệu đã an toàn hay chưa. */
async function checkSyncStatus() {
  const banner = document.getElementById('sync-banner');
  let health;
  try {
    health = await api('/health', { auth: false });
  } catch {
    banner.classList.add('hidden');
    return;
  }
  const syncFiles = health.sync || [];
  const pendingFiles = syncFiles.filter((s) => s.pending);
  // Lỗi cụ thể gần nhất (từ dataStore — do server ghi nhận khi upload fail).
  const firstErrorFile = pendingFiles.find((s) => s.lastError);
  const errDetail = firstErrorFile
    ? `<div class="mt-2 p-2.5 rounded-lg bg-white/70 border border-amber-200 text-xs leading-relaxed">
         <b>Lỗi gần nhất (${esc(firstErrorFile.file)}):</b> ${esc(firstErrorFile.lastError)}
       </div>`
    : '';

  if (health.mode !== 'drive') {
    banner.className = 'mb-5 rounded-2xl border p-4 flex flex-wrap items-center gap-3 bg-red-50 border-red-300';
    banner.innerHTML = `
      <span class="text-xl">🚨</span>
      <div class="flex-1 min-w-0 text-sm text-red-800">
        <b>CHẾ ĐỘ CỤC BỘ — dữ liệu KHÔNG bền vững!</b> Máy chủ chưa kết nối được Google Drive,
        mọi đề thi / điểm số chỉ nằm trong bộ nhớ tạm và <b>sẽ mất khi Function bị giải phóng</b>.
        Hãy khai báo biến <code class="bg-red-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_JSON</code> và
        <code class="bg-red-100 px-1 rounded">GOOGLE_DRIVE_FOLDER_ID</code> trên Vercel (README mục 3), sau đó tạo lại đề thi.
        <div class="mt-2">Bấm "Kiểm tra Drive ngay" để biết chính xác máy chủ đang thiếu/sai gì.</div>
      </div>
      <button onclick="runDriveCheck()" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shrink-0">🔍 Kiểm tra Drive ngay</button>`;
    banner.classList.remove('hidden');
    return;
  }

  if (pendingFiles.length > 0) {
    banner.className = 'mb-5 rounded-2xl border p-4 flex flex-wrap items-center gap-3 bg-amber-50 border-amber-300';
    banner.innerHTML = `
      <span class="text-xl">⚠️</span>
      <div class="flex-1 min-w-0 text-sm text-amber-800">
        <b>Có ${pendingFiles.length} file chưa đồng bộ lên Google Drive</b>
        (${pendingFiles.map((s) => s.file).join(', ')}). Dữ liệu còn an toàn trong bộ nhớ tạm,
        nhưng sẽ mất nếu máy chủ tắt trước khi sync thành công.
        <b>Bấm "Kiểm tra Drive ngay" để biết chính xác nguyên nhân và cách sửa</b> (chạy trực tiếp trên server, không cần tool local).
        ${errDetail}
      </div>
      <div class="flex flex-col gap-2 shrink-0">
        <button onclick="runDriveCheck()" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition">🔍 Kiểm tra Drive ngay</button>
        <button onclick="forceSyncNow()" class="border border-amber-500 text-amber-700 hover:bg-amber-100 font-bold text-xs px-4 py-2 rounded-lg transition">⟳ Đồng bộ ngay</button>
      </div>`;
    banner.classList.remove('hidden');
    return;
  }

  const lastSync = syncFiles
    .map((s) => s.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .pop();
  banner.className = 'mb-5 rounded-2xl border p-4 flex flex-wrap items-center gap-3 bg-emerald-50 border-emerald-200';
  banner.innerHTML = `
    <span class="text-lg">✅</span>
    <div class="flex-1 min-w-0 text-sm text-emerald-800">
      Dữ liệu đã đồng bộ an toàn lên Google Drive${lastSync ? ` (lần cuối: ${fmtDateTime(lastSync)})` : ''}.
    </div>
    <button onclick="forceSyncNow()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shrink-0">⟳ Đồng bộ ngay</button>`;
  banner.classList.remove('hidden');
}

async function forceSyncNow() {
  try {
    const data = await api('/admin/sync', { method: 'POST' });
    toast(data.message, data.synced ? 'success' : 'error');
    await checkSyncStatus();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* --------- CHẨN ĐOÁN GOOGLE DRIVE 5 MỨC NGAY TRÊN SERVER ---------
 * Gọi POST /admin/drive-check — máy chủ tự kiểm tra: biến env → key Service
 * Account → đọc thư mục → ghi file test → xóa file test. Mỗi mức FAIL kèm
 * gợi ý sửa cụ thể. Nếu hết mức PASS mà server đang kẹt chế độ local, máy
 * chủ TỰ KẾT NỐI LẠI (không cần restart). */
async function runDriveCheck() {
  openModal('modal-drive-check');
  const body = document.getElementById('dc-body');
  body.innerHTML = '<p class="text-center py-6 text-slate-400">Đang kiểm tra kết nối tới Google Drive (tối đa ~15 giây)...</p>';
  try {
    const r = await api('/admin/drive-check', { method: 'POST' });
    const stepIcon = (ok) => (ok ? '✅' : '❌');
    const stepsHtml = r.steps
      .map(
        (s) => `
        <div class="rounded-xl border ${s.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'} p-3">
          <div class="flex items-start gap-2">
            <span>${stepIcon(s.ok)}</span>
            <div class="flex-1 min-w-0">
              <div class="font-semibold ${s.ok ? 'text-emerald-800' : 'text-red-800'} text-sm">${esc(s.name)}</div>
              <div class="text-xs mt-1 ${s.ok ? 'text-emerald-700' : 'text-red-700'} leading-relaxed break-words">${esc(s.detail)}</div>
              ${s.advice ? `<div class="mt-2 p-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed"><b>Cách sửa:</b> ${esc(s.advice)}</div>` : ''}
            </div>
          </div>
        </div>`
      )
      .join('');
    const healedNote = r.healed
      ? '<div class="mt-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-xs leading-relaxed"><b>🎉 Đã tự kết nối lại Google Drive thành công!</b> Máy chủ đã chuyển sang chế độ Drive mà không cần restart — bấm "Đồng bộ ngay" trên banner để đẩy dữ liệu lên Drive.</div>'
      : '';
    body.innerHTML = `
      <div class="rounded-xl p-3 mb-3 text-sm font-semibold ${r.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-300'}">
        ${r.ok ? '✅ Kết nối Google Drive: TỐT' : '❌ Kết nối Google Drive: CÓ LỖI'}
        ${r.clientEmail ? `<span class="block text-xs font-normal mt-1 text-slate-500">Service account: ${esc(r.clientEmail)}</span>` : ''}
        ${r.folderId ? `<span class="block text-xs font-normal mt-0.5 text-slate-500">Folder ID: ${esc(r.folderId)}</span>` : ''}
      </div>
      <div class="space-y-2">${stepsHtml}</div>
      ${healedNote}
      <div class="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
        ${esc(r.message)}
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="rounded-xl bg-red-50 border border-red-300 p-4 text-sm text-red-800">Không chạy được chẩn đoán: ${esc(err.message)}</div>`;
  }
}
setInterval(checkSyncStatus, 60_000);

/* ================================ BẢNG ĐIỂM ================================ */
function fillResultFilter() {
  const sel = document.getElementById('result-filter');
  const current = sel.value;
  const categories = [...new Set(cache.results.map((r) => r.category || r.examTitle))];
  sel.innerHTML = '<option value="">Tất cả hạng mục</option>' +
    categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (categories.includes(current)) sel.value = current;
}

function renderResults() {
  fillResultFilter();
  const filter = document.getElementById('result-filter').value;
  let list = cache.results.filter((r) => !filter || r.category === filter || r.examTitle === filter);

  const summary = document.getElementById('result-summary');
  if (list.length) {
    const avg10 = Math.round((list.reduce((s, r) => s + (Number(r.score) || 0), 0) / list.length) * 100) / 100;
    const avg100 = Math.round((list.reduce((s, r) => s + (Number(r.score100) || 0), 0) / list.length) * 100) / 100;
    const avg60 = Math.round((list.reduce((s, r) => s + (Number(r.score60) || 0), 0) / list.length) * 100) / 100;
    const max = Math.max(...list.map((r) => Number(r.score) || 0));
    summary.innerHTML = `Tổng số bài: <b>${list.length}</b> · TB 3 thang: <b class="text-flag-600">${avg10.toFixed(2)}</b> / 10 · <b class="text-flag-600">${avg100.toFixed(2)}</b> / 100 · <b class="text-flag-600">${avg60.toFixed(2)}</b> / 60 · Cao nhất: <b class="text-emerald-600">${max.toFixed(2)}</b> / 10`;
  } else {
    summary.textContent = '';
  }

  if (rankByScore) list = [...list].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  const tbody = document.getElementById('results-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 py-10">Chưa có bài thi nào trong hạng mục này.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((r, i) => {
    const user = cache.users.find((u) => u.cccd === r.cccd);
    const edited = r.editedAt ? `<span title="Đã chỉnh sửa bởi admin" class="ml-1">✎</span>` : '';
    // R10: 3 thang điểm hiển thị đồng thời.
    const s = computeScales(r.correct, r.total, r);
    return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-5 py-3.5 text-slate-400 font-bold">${rankByScore ? (i + 1) : i + 1}</td>
        <td class="px-5 py-3.5 font-mono font-semibold text-slate-800">${esc(r.cccd)}${edited}
          <div class="text-[11px] text-slate-400 font-sans">${esc(user ? `${user.position} · ${user.unit}` : 'Tài khoản đã xóa')}</div>
        </td>
        <td class="px-5 py-3.5">
          <div class="text-slate-700 font-medium">${esc(r.category)}</div>
          <div class="text-xs text-slate-400">${esc(r.examTitle)}</div>
        </td>
        <td class="px-5 py-3.5">
          <span class="font-extrabold ${Number(s.score10) >= 5 ? 'text-emerald-600' : 'text-red-500'} text-base">${fmtScore(s.score10)}</span>
          <span class="text-[11px] text-slate-400">/10</span>
          <div class="text-[11px] text-slate-500 mt-0.5">Thang 100: <b>${fmtScore(s.score100)}</b> · Thang 60: <b>${fmtScore(s.score60)}</b></div>
          <div class="text-[11px] text-slate-400">${r.correct}/${r.total} câu · ${fmtDuration(r.durationSeconds)}</div>
          ${r.note ? `<div class="text-[11px] text-amber-600 mt-0.5">Ghi chú: ${esc(r.note)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5 text-xs text-slate-500">
          <div>Nộp: ${fmtDateTime(r.submittedAt)}</div>
          ${r.editedAt ? `<div class="text-amber-600">Sửa: ${fmtDateTime(r.editedAt)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5 text-right whitespace-nowrap">
          <button onclick="openPaperModal('${esc(r.id)}')" class="text-slate-600 hover:text-flag-700 font-semibold text-xs px-2 py-1.5" title="Xem toàn bộ bài làm (đáp án đúng + lựa chọn của thí sinh)">Bài làm</button>
          <button onclick="openResultModal('${esc(r.id)}')" class="text-flag-600 hover:text-flag-800 font-semibold text-xs px-2 py-1.5">Sửa</button>
          <button onclick="askDeleteResult('${esc(r.id)}')" class="text-red-500 hover:text-red-700 font-semibold text-xs px-2 py-1.5">Xóa</button>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('result-filter').addEventListener('change', renderResults);
document.getElementById('btn-rank').addEventListener('click', () => {
  rankByScore = !rankByScore;
  document.getElementById('btn-rank').textContent = rankByScore ? 'Xếp theo thời gian ↓' : 'Xếp theo điểm ↓';
  renderResults();
});

function openResultModal(id) {
  const r = cache.results.find((x) => x.id === id);
  if (!r) return;
  editingResultId = id;
  document.getElementById('mr-info').innerHTML =
    `Thí sinh: <b>${esc(r.cccd)}</b><br />Bài thi: <b>${esc(r.examTitle)}</b> (${esc(r.category)})<br />` +
    `Nộp lúc: ${fmtDateTime(r.submittedAt)} · Thời lượng: ${fmtDuration(r.durationSeconds)}`;
  document.getElementById('mr-total').textContent = r.total;
  document.getElementById('mr-correct').value = r.correct;
  document.getElementById('mr-score').value = r.score;
  document.getElementById('mr-note').value = r.note || '';
  document.getElementById('mr-error').classList.add('hidden');
  openModal('modal-result');
}

document.getElementById('form-result').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (resultFormBusy) return;
  const body = {
    correct: parseInt(document.getElementById('mr-correct').value, 10),
    score: parseFloat(document.getElementById('mr-score').value),
    note: document.getElementById('mr-note').value.trim(),
  };
  resultFormBusy = true;
  try {
    const data = await api(`/admin/results/${editingResultId}`, { method: 'PUT', body });
    toast(data.message, data.synced === false ? 'info' : 'success');
    if (data.synced === false) checkSyncStatus();
    closeModal('modal-result');
    await refreshAll();
    renderResults();
    renderOverview();
  } catch (err) {
    const el = document.getElementById('mr-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  } finally {
    resultFormBusy = false;
  }
});

function askDeleteResult(id) {
  askDelete('Xóa vĩnh viễn kết quả bài làm này khỏi hệ thống?', async () => {
    const data = await api(`/admin/results/${id}`, { method: 'DELETE' });
    toast(data.message, 'success');
    await refreshAll();
    renderResults();
    renderOverview();
  });
}

/* ==================== R10: BẢNG ĐIỂM TẬP THỂ ==================== */
let teamsExamFilter = ''; // '' = tự chọn mặc định (random30 ưu tiên)

async function renderTeams() {
  const tbody = document.getElementById('teams-tbody');
  const summary = document.getElementById('team-summary');
  const sel = document.getElementById('team-exam-filter');
  try {
    const q = teamsExamFilter ? `?examId=${encodeURIComponent(teamsExamFilter)}` : '';
    const data = await api(`/admin/team-results${q}`);
    // Bộ lọc hạng mục (lần đầu / khi danh sách đổi).
    const current = sel.value;
    const opts = ['<option value="">— Tất cả hạng mục (gộp mọi bài thi) —</option>']
      .concat(data.exams.map((e) => `<option value="${esc(e.id)}">${esc(e.title || e.id)}</option>`));
    sel.innerHTML = opts.join('');
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
    else sel.value = data.examId === 'ALL' ? '' : data.examId;

    // Dòng tổng kết.
    const t = data.totals;
    summary.innerHTML =
      `Số tập thể xét giải: <b>${t.teams}</b> · Đăng ký: <b>${t.registered}</b> · Đã dự thi: <b>${t.participants}</b> · ` +
      `Bài thi: <b>${t.attempts}</b> · Điểm TB toàn hội đồng 3 thang: ` +
      `<b class="text-flag-600">${fmtScore(t.avg10)}</b>/10 · <b class="text-flag-600">${fmtScore(t.avg100)}</b>/100 · <b class="text-flag-600">${fmtScore(t.avg60)}</b>/60`;

    if (data.teams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center text-slate-400 py-10">Chưa có dữ liệu.</td></tr>';
      return;
    }
    tbody.innerHTML = data.teams.map((tm) => {
      const medal = tm.rank === 1 ? '🥇' : tm.rank === 2 ? '🥈' : tm.rank === 3 ? '🥉' : '';
      const top = (tm.topMembers || [])
        .map((m) => `<span class="inline-block bg-slate-100 rounded-lg px-2 py-0.5 text-[11px] mr-1 mb-0.5" title="${esc(m.cccd)}">${esc(maskCccd(m.cccd))}: <b>${fmtScore(m.score10)}</b></span>`)
        .join('') || '<span class="text-slate-300 text-xs">—</span>';
      return `
        <tr class="hover:bg-slate-50/70 ${tm.excluded ? 'opacity-60' : ''}">
          <td class="px-4 py-3.5 font-extrabold text-slate-700">${tm.excluded ? '—' : `${esc(String(tm.rank))} ${medal}`}</td>
          <td class="px-4 py-3.5">
            <span class="font-bold text-slate-800">${esc(tm.unit)}</span>
            ${tm.excluded ? '<span class="ml-1.5 bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">Không xét giải</span>' : ''}
          </td>
          <td class="px-3 py-3.5 text-center text-slate-600">${tm.registered}</td>
          <td class="px-3 py-3.5 text-center text-slate-600">${tm.participants}</td>
          <td class="px-3 py-3.5 text-center ${tm.participation >= 80 ? 'text-emerald-600 font-bold' : tm.participation >= 50 ? 'text-slate-600' : 'text-amber-600'}">${tm.participation}%</td>
          <td class="px-3 py-3.5 text-center font-extrabold text-flag-600 text-base">${fmtScore(tm.avg10)}</td>
          <td class="px-3 py-3.5 text-center font-bold text-slate-700">${fmtScore(tm.avg100)}</td>
          <td class="px-3 py-3.5 text-center font-bold text-gold-600">${fmtScore(tm.avg60)}</td>
          <td class="px-3 py-3.5 text-center text-slate-600">${tm.participants ? fmtScore(tm.best10) : '—'}</td>
          <td class="px-4 py-3.5">${top}</td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-red-500 py-10">${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('team-exam-filter').addEventListener('change', (e) => {
  teamsExamFilter = e.target.value;
  renderTeams();
});

function printTeamBoard() {
  document.body.classList.add('print-teams');
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-teams'));

/* ==================== R10: PHIẾU BÀI LÀM HOÀN CHỈNH ==================== */
/** Xem & in toàn bộ bài làm của một thí sinh (đáp án đúng + lựa chọn thực tế). */
async function openPaperModal(resultId) {
  openModal('modal-paper');
  const body = document.getElementById('paper-body');
  body.innerHTML = '<p class="text-center text-slate-400 py-10">Đang tải bài làm...</p>';
  try {
    const d = await api(`/admin/results/${resultId}/paper`);
    const r = d.result;
    const u = d.user;
    const s = computeScales(r.correct, r.total, r);
    const answerMap = d.answers || {};
    let answeredCount = 0;
    let correctCount = 0;
    const questionsHtml = (d.questions || []).map((q, i) => {
      const choice = answerMap[q.id];
      const hasAnswer = Number.isInteger(choice);
      if (hasAnswer) answeredCount += 1;
      const isCorrect = hasAnswer && choice === q.correctIndex;
      if (isCorrect) correctCount += 1;
      return `
        <div class="paper-q border border-slate-200 rounded-2xl p-4 mb-3 bg-white">
          <div class="flex items-start justify-between gap-2">
            <p class="font-semibold text-slate-800 text-sm">Câu ${i + 1}. ${esc(q.text)}</p>
            ${!hasAnswer
              ? '<span class="shrink-0 text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-2 py-0.5">BỎ TRỐNG</span>'
              : isCorrect
                ? '<span class="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">ĐÚNG ✓</span>'
                : '<span class="shrink-0 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">SAI ✕</span>'}
          </div>
          <div class="mt-2.5 grid sm:grid-cols-2 gap-2">
            ${(q.options || []).map((opt, j) => {
              const isCorrectOpt = j === q.correctIndex;
              const isChosen = hasAnswer && choice === j;
              let cls = 'bg-white border-slate-200 text-slate-600';
              let mark = '';
              if (isCorrectOpt && isChosen) { cls = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold'; mark = '✓ đúng & đã chọn'; }
              else if (isCorrectOpt) { cls = 'bg-emerald-50 border-emerald-300 text-emerald-800'; mark = '✓ đáp án đúng'; }
              else if (isChosen) { cls = 'bg-red-50 border-red-300 text-red-700 font-semibold'; mark = '✕ thí sinh chọn'; }
              return `
                <div class="flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${cls}">
                  <span class="shrink-0 font-bold">${String.fromCharCode(65 + j)}.</span>
                  <span class="min-w-0">${esc(opt)}${mark ? ` <span class="text-[10px] whitespace-nowrap">(${mark})</span>` : ''}</span>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    const noAnswers = !(r.answers && r.answers.length > 0);
    body.innerHTML = `
      <div class="rounded-2xl border border-slate-200 p-5 bg-slate-50/70">
        <div class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <p>Thí sinh: <b>${esc(r.cccd)}</b>${u ? ` — ${esc(u.position || '')}` : ''}</p>
          <p>Đơn vị công tác: <b>${esc(u ? u.unit : 'Không rõ')}</b></p>
          <p>Bài thi: <b>${esc(r.examTitle)}</b></p>
          <p>Hạng mục: <b>${esc(r.category)}</b></p>
          <p>Nộp lúc: <b>${fmtDateTime(r.submittedAt)}</b></p>
          <p>Thời lượng: <b>${fmtDuration(r.durationSeconds)}</b></p>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-xl border-2 border-flag-500 bg-white py-3"><p class="text-[10px] font-bold uppercase text-flag-700">Thang 10</p><p class="text-2xl font-extrabold text-flag-600">${fmtScore(s.score10)}</p></div>
          <div class="rounded-xl border border-slate-300 bg-white py-3"><p class="text-[10px] font-bold uppercase text-slate-500">Thang 100</p><p class="text-2xl font-extrabold text-slate-800">${fmtScore(s.score100)}</p></div>
          <div class="rounded-xl border border-gold-400 bg-white py-3"><p class="text-[10px] font-bold uppercase text-gold-600">Thang 60</p><p class="text-2xl font-extrabold text-gold-600">${fmtScore(s.score60)}</p></div>
        </div>
        <p class="mt-3 text-xs text-slate-500">Số câu đúng: <b>${r.correct}/${r.total}</b> · Đã trả lời: <b>${answeredCount}/${(d.questions || []).length}</b>${r.note ? ` · Ghi chú BTC: <b>${esc(r.note)}</b>` : ''}</p>
        ${noAnswers ? '<p class="mt-2 text-xs text-amber-600">⚠ Bài nộp trước bản nâng cấp R10 nên hệ thống chưa lưu chi tiết từng câu trả lời — chỉ hiển thị được bộ đề.</p>' : ''}
      </div>
      <div class="mt-4">${questionsHtml || '<p class="text-center text-slate-400 py-6">Không còn dữ liệu bộ đề của lượt thi này trong ngân hàng câu hỏi.</p>'}</div>
      <p class="text-[10px] text-slate-400 text-center pb-2">Phiếu in tự động từ Hệ thống thi trực tuyến OES — ${fmtDateTime(new Date().toISOString())}</p>`;
  } catch (err) {
    body.innerHTML = `<div class="rounded-xl bg-red-50 border border-red-300 p-4 text-sm text-red-800">Không tải được bài làm: ${esc(err.message)}</div>`;
  }
}

function printPaper() {
  document.body.classList.add('print-paper');
  setTimeout(() => window.print(), 60);
}

/* ==================== R10: CẤU HÌNH GIAO DIỆN & GIỜ NHẬN BÀI ==================== */
let siteFormBusy = false;

async function loadSiteForm() {
  document.getElementById('sc-error').classList.add('hidden');
  try {
    const { config: c } = await api('/admin/site-config');
    document.getElementById('sc-intake-open').value = isoToVnLocal(c.intakeOpenAt || '');
    document.getElementById('sc-intake-close').value = isoToVnLocal(c.intakeCloseAt || '');
    document.getElementById('sc-deadline').value = isoToVnLocal(c.deadlineIso || '');
    document.getElementById('sc-banner').value = c.bannerUrl || '';
    updateBannerPreview(c.bannerUrl || '');
    document.getElementById('sc-marquee').value = c.marquee || '';
    document.getElementById('sc-hero-badge').value = c.heroBadge || '';
    document.getElementById('sc-hero-title').value = c.heroTitle || '';
    document.getElementById('sc-hero-subtitle').value = c.heroSubtitle || '';
    document.getElementById('sc-intro').value = c.introHtml || '';
    document.getElementById('sc-principle').value = c.principleHtml || '';
    document.getElementById('sc-rules').value = c.rulesHtml || '';
  } catch (err) {
    toast(err.message, 'error');
  }
}

function updateBannerPreview(url) {
  const img = document.getElementById('sc-banner-preview');
  if (url && /^https?:\/\//.test(url)) {
    img.src = url;
    img.classList.remove('hidden');
    img.onerror = () => img.classList.add('hidden');
  } else {
    img.classList.add('hidden');
  }
}
document.getElementById('sc-banner').addEventListener('input', (e) => updateBannerPreview(e.target.value.trim()));

document.getElementById('form-site').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (siteFormBusy) return;
  siteFormBusy = true;
  const btn = document.getElementById('sc-submit');
  btn.disabled = true;
  btn.textContent = 'Đang lưu...';
  const body = {
    intakeOpenAt: document.getElementById('sc-intake-open').value,
    intakeCloseAt: document.getElementById('sc-intake-close').value,
    deadlineIso: document.getElementById('sc-deadline').value,
    bannerUrl: document.getElementById('sc-banner').value.trim(),
    marquee: document.getElementById('sc-marquee').value,
    heroBadge: document.getElementById('sc-hero-badge').value,
    heroTitle: document.getElementById('sc-hero-title').value,
    heroSubtitle: document.getElementById('sc-hero-subtitle').value,
    introHtml: document.getElementById('sc-intro').value,
    principleHtml: document.getElementById('sc-principle').value,
    rulesHtml: document.getElementById('sc-rules').value,
  };
  try {
    const data = await api('/admin/site-config', { method: 'PUT', body });
    toast(data.message, data.synced === false ? 'info' : 'success');
    if (data.synced === false) checkSyncStatus();
  } catch (err) {
    const el = document.getElementById('sc-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  } finally {
    siteFormBusy = false;
    btn.disabled = false;
    btn.textContent = '💾 Lưu cấu hình giao diện';
  }
});

/* ================================ XÓA CHUNG ================================ */
function askDelete(detail, run) {
  deleteAction = run;
  document.getElementById('delete-detail').textContent = detail;
  openModal('modal-delete');
}
document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
  if (!deleteAction) return;
  try {
    await deleteAction();
  } catch (err) {
    toast(err.message, 'error');
  }
  deleteAction = null;
  closeModal('modal-delete');
});

/* ================================ KHỞI ĐỘNG ================================ */
(async function main() {
  await refreshAll();
  fillResultFilter();
  switchSection('overview');
  checkSyncStatus(); // Banner cảnh báo dữ liệu chưa an toàn trên Google Drive.
})();
