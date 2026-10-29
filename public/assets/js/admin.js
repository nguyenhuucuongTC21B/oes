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
  if (name === 'aggregate') renderAggregate();
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
  document.getElementById('ov-exams').textContent = cache.exams.length.toLocaleString('vi-VN');
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
  document.getElementById('mu-unit').value = u.unit || '';
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
  if (cache.exams.length === 0) {
    host.innerHTML = `
      <div class="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <div class="text-4xl">📝</div>
        <p class="font-bold text-slate-700 mt-3">Chưa có đề thi nào</p>
        <p class="text-sm text-slate-400 mt-1">Nhấn “Ra đề thi mới” để tạo đề thi đầu tiên cho cuộc thi.</p>
      </div>`;
    return;
  }
  host.innerHTML = cache.exams.map((e) => e.isRandom ? `
    <article class="bg-amber-50/60 rounded-2xl border border-amber-300 p-5 flex flex-col">
      <div class="flex items-start justify-between gap-2">
        <span class="bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded">Đề tự động sinh</span>
        <span class="text-[11px] text-slate-400">${fmtDate(e.createdAt)}</span>
      </div>
      <h3 class="font-bold text-slate-900 mt-3 leading-snug">${esc(e.title)}</h3>
      <p class="text-xs text-slate-500 mt-1.5 leading-relaxed flex-1">Hệ thống tự trộn cho <b>MỖI thí sinh một bộ ${e.questionCount} câu riêng</b> từ Bộ đề số 6 (150 câu), thời gian làm bài ${e.durationMinutes} phút, mỗi thí sinh chỉ thi một lần. Đề này KHÔNG cần tạo/xóa/sửa — cấu hình nằm trong RANDOM_EXAM (api/index.js). Khung giờ thi kế thừa từ đề nguồn (Bộ đề số 6).</p>
      ${examScheduleChip(e)}
      <div class="mt-3 flex items-center gap-3 text-xs text-slate-400">
        <span>📝 ${e.questionCount} câu</span><span>⏱ ${e.durationMinutes} phút</span>
      </div>
    </article>` : `
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
    const avg = Math.round((list.reduce((s, r) => s + (Number(r.score) || 0), 0) / list.length) * 100) / 100;
    const max = Math.max(...list.map((r) => Number(r.score) || 0));
    summary.innerHTML = `Tổng số bài: <b>${list.length}</b> · Điểm trung bình: <b class="text-flag-600">${avg.toFixed(2)}</b> · Điểm cao nhất: <b class="text-emerald-600">${max.toFixed(2)}</b>`;
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
          <span class="font-extrabold ${Number(r.score) >= 5 ? 'text-emerald-600' : 'text-red-500'} text-base">${Number(r.score).toFixed(2)}</span>
          <div class="text-[11px] text-slate-400">${r.correct}/${r.total} câu · ${fmtDuration(r.durationSeconds)}</div>
          ${r.note ? `<div class="text-[11px] text-amber-600 mt-0.5">Ghi chú: ${esc(r.note)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5 text-xs text-slate-500">
          <div>Nộp: ${fmtDateTime(r.submittedAt)}</div>
          ${r.editedAt ? `<div class="text-amber-600">Sửa: ${fmtDateTime(r.editedAt)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5 text-right whitespace-nowrap">
          <button onclick="openPrintPhieu('${esc(r.id)}')" title="In phiếu kết quả của thí sinh này" class="text-slate-500 hover:text-flag-700 font-semibold text-xs px-2 py-1.5">In</button>
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

/* ==================== R9: TỔNG HỢP & XÉT GIẢI TẬP THỂ ====================
 * Nguyên tắc:
 *  - Gom đội theo "Đơn vị công tác" (user.unit) trong dữ liệu đăng ký. Chuẩn hóa
 *    tên đơn vị (trim + gộp khoảng trắng + không phân biệt hoa/thường) để
 *    "VKS Quận 1" và "vks   quận 1" vẫn là một đội.
 *  - Điểm đội = trung bình điểm của Top k thí sinh cao nhất của đơn vị (mặc định
 *    k=3, chỉnh được). Cách này công bằng giữa đơn vị đông/người ít, không bị
 *    "pha" điểm bởi số lượng và khuyến khích chuẩn bị kỹ.
 *  - Đơn vị cần tối thiểu N bài thi (mặc định 3) mới đủ điều kiện xét giải;
 *    đơn vị thiếu người vẫn hiển thị nhưng không xếp hạng.
 *  - Giải hòa đội: điểm cá nhân cao nhất → nhì → tỷ lệ hoàn thành → thời gian TB.
 *  - Giải hòa cá nhân: điểm cao hơn → làm bài nhanh hơn → nộp sớm hơn.
 */
const ORG_LINE = 'VIỆN KIỂM SÁT NHÂN DÂN TP. ĐÀ NẴNG'; // ← sửa dòng đầu của phiếu in tại đây
const CONTEST_LINE = 'CUỘC THI TRẮC NGHIỆM PHÁP LUẬT TRỰC TUYẾN NĂM 2026';

function normalizeUnitKey(v) {
  return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase() || '(chưa xác định)';
}
function displayUnit(v) {
  return (v && String(v).trim()) ? String(v).trim() : 'Chưa xác định đơn vị';
}
function agExamKey(r) {
  return r.examId || r.examTitle || r.category || '';
}
function agSettings() {
  return {
    examFilter: document.getElementById('ag-exam').value,
    mode: document.getElementById('ag-mode').value, // 'latest' | 'best'
    topK: parseInt(document.getElementById('ag-topk').value, 10) || 3,
    minMembers: Math.max(1, parseInt(document.getElementById('ag-min').value, 10) || 3),
  };
}
function fillAgExamFilter() {
  const sel = document.getElementById('ag-exam');
  const current = sel.value;
  const keys = new Map(); // examKey → nhãn hiển thị
  for (const r of cache.results) {
    const k = agExamKey(r);
    if (!keys.has(k)) keys.set(k, r.examTitle || r.category || k);
  }
  // Đề ngẫu nhiên chính thức luôn có mặt trong bộ lọc (kể cả khi chưa có bài nộp).
  const randomExam = cache.exams.find((e) => e.isRandom);
  const opts = [];
  if (randomExam && !keys.has(randomExam.id)) opts.push([randomExam.id, randomExam.title]);
  for (const [k, label] of keys) opts.push([k, label]);
  sel.innerHTML = '<option value="">Tất cả bài thi</option>' +
    opts.map(([k, label]) => `<option value="${esc(k)}">${esc(label)}</option>`).join('');
  if (current === '' || [...keys.keys()].includes(current)) sel.value = current;
}

/** Danh sách cá nhân: 1 dòng/thí sinh theo chế độ tính (mới nhất hoặc điểm cao nhất), đã xếp hạng. */
function computeIndividuals(settings) {
  const byCccd = new Map();
  for (const r of cache.results) {
    if (settings.examFilter && agExamKey(r) !== settings.examFilter) continue;
    if (!byCccd.has(r.cccd)) byCccd.set(r.cccd, []);
    byCccd.get(r.cccd).push(r);
  }
  const list = [];
  for (const [cccd, attempts] of byCccd) {
    attempts.sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
    let chosen = attempts[0]; // mới nhất
    if (settings.mode === 'best') {
      for (const a of attempts) if ((Number(a.score) || 0) > (Number(chosen.score) || 0)) chosen = a;
    }
    list.push({
      cccd,
      result: chosen,
      attempts: attempts.length,
      user: cache.users.find((u) => u.cccd === cccd) || null,
    });
  }
  list.sort((a, b) => {
    const s = (Number(b.result.score) || 0) - (Number(a.result.score) || 0);
    if (s !== 0) return s;
    const d = (Number(a.result.durationSeconds) || 0) - (Number(b.result.durationSeconds) || 0);
    if (d !== 0) return d;
    return String(a.result.submittedAt || '').localeCompare(String(b.result.submittedAt || ''));
  });
  list.forEach((x, i) => { x.rank = i + 1; });
  return list;
}

/** Xếp hạng đội theo đơn vị + công thức điểm đội Top-k. */
function computeTeams(individuals, settings) {
  const teams = new Map();
  const ensureTeam = (key, unit) => {
    if (!teams.has(key)) teams.set(key, { key, unit, members: [], registered: 0 });
    return teams.get(key);
  };
  // Đếm số đăng ký theo đơn vị (mọi tài khoản, kể cả người chưa thi).
  for (const u of cache.users) {
    ensureTeam(normalizeUnitKey(u.unit), displayUnit(u.unit)).registered += 1;
  }
  for (const it of individuals) {
    const key = normalizeUnitKey(it.user && it.user.unit);
    ensureTeam(key, displayUnit(it.user && it.user.unit)).members.push(it);
  }
  const list = [...teams.values()];
  for (const t of list) {
    t.members.sort((a, b) => (Number(b.result.score) || 0) - (Number(a.result.score) || 0));
    const k = Math.max(1, Math.min(settings.topK, t.members.length));
    const top = t.members.slice(0, k);
    t.topCount = k;
    t.teamScore = top.length
      ? Math.round(top.reduce((s, m) => s + (Number(m.result.score) || 0), 0) / k * 100) / 100
      : 0;
    t.topScores = top.map((m) => Number(m.result.score) || 0);
    t.avgAll = t.members.length
      ? Math.round(t.members.reduce((s, m) => s + (Number(m.result.score) || 0), 0) / t.members.length * 100) / 100
      : 0;
    t.avgDuration = t.members.length
      ? Math.round(t.members.reduce((s, m) => s + (Number(m.result.durationSeconds) || 0), 0) / t.members.length)
      : 0;
    t.qualified = t.members.length >= settings.minMembers;
  }
  // Đội đủ điều kiện đứng trước; trong mỗi nhóm: điểm đội desc → thành phần điểm
  // cao nhất từng vị trí desc → tỷ lệ hoàn thành desc → thời gian TB asc.
  list.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    const s = b.teamScore - a.teamScore;
    if (s !== 0) return s;
    const n = Math.max(a.topScores.length, b.topScores.length);
    for (let i = 0; i < n; i++) {
      const d = (b.topScores[i] || 0) - (a.topScores[i] || 0);
      if (d !== 0) return d;
    }
    const ra = a.members.length / Math.max(a.registered, 1);
    const rb = b.members.length / Math.max(b.registered, 1);
    if (rb !== ra) return rb - ra;
    return a.avgDuration - b.avgDuration;
  });
  let rank = 0;
  for (const t of list) {
    if (t.qualified) { rank += 1; t.rank = rank; } else { t.rank = null; }
  }
  return list;
}

let lastIndividuals = []; // phục vụ tra hạng cá nhân khi in phiếu

function renderAggregate() {
  fillAgExamFilter();
  const settings = agSettings();
  lastIndividuals = computeIndividuals(settings);
  const teams = computeTeams(lastIndividuals, settings);

  /* ---- Bảng đội ---- */
  const tBody = document.getElementById('teams-tbody');
  if (teams.length === 0) {
    tBody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 py-10">Chưa có dữ liệu.</td></tr>';
  } else {
    tBody.innerHTML = teams.map((t) => `
      <tr class="hover:bg-slate-50/70 ${t.rank === 1 ? 'bg-amber-50/60' : ''}">
        <td class="px-4 py-3.5 font-extrabold text-slate-700">${t.rank ? '#' + t.rank : '—'}</td>
        <td class="px-4 py-3.5 font-semibold text-slate-800">${esc(t.unit)}
          ${t.qualified ? '' : `<div class="text-[11px] text-amber-600">Chưa đủ điều kiện xét giải (cần tối thiểu ${settings.minMembers} bài thi)</div>`}
        </td>
        <td class="px-3 py-3.5 text-center text-slate-600">${t.registered}</td>
        <td class="px-3 py-3.5 text-center text-slate-600">${t.members.length}</td>
        <td class="px-4 py-3.5">
          <span class="font-extrabold text-flag-700 text-base">${t.members.length ? t.teamScore.toFixed(2) : '—'}</span>
          <div class="text-[11px] text-slate-400">TB Top ${t.topCount}</div>
        </td>
        <td class="px-4 py-3.5 text-xs text-slate-500">${t.topScores.map((s, i) => `<span class="inline-block bg-slate-100 rounded px-1.5 py-0.5 mr-1 mb-0.5">#${i + 1}: <b>${s.toFixed(2)}</b></span>`).join('') || '—'}</td>
        <td class="px-3 py-3.5 text-center text-slate-600">${t.members.length ? t.avgAll.toFixed(2) : '—'}</td>
      </tr>`).join('');
  }

  /* ---- Bảng cá nhân ---- */
  const pBody = document.getElementById('ag-tbody');
  if (lastIndividuals.length === 0) {
    pBody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 py-10">Chưa có dữ liệu — chưa có bài thi nào thuộc phạm vi đã chọn.</td></tr>';
  } else {
    pBody.innerHTML = lastIndividuals.map((it) => {
      const r = it.result;
      const u = it.user;
      return `
      <tr class="hover:bg-slate-50/70">
        <td class="px-4 py-3.5 font-extrabold ${it.rank <= 3 ? 'text-flag-700' : 'text-slate-500'}">${it.rank}</td>
        <td class="px-4 py-3.5 font-mono font-semibold text-slate-800">${esc(r.cccd)}
          <div class="text-[11px] text-slate-400 font-sans">${esc(u ? [u.position, u.unit].filter(Boolean).join(' · ') : 'Tài khoản đã xóa')}</div>
          ${it.attempts > 1 ? `<div class="text-[11px] text-amber-600 font-sans">Đã thi ${it.attempts} lần — tính theo ${settings.mode === 'best' ? 'điểm cao nhất' : 'bài mới nhất'}</div>` : ''}
        </td>
        <td class="px-4 py-3.5 text-slate-600">${esc(displayUnit(u && u.unit))}</td>
        <td class="px-4 py-3.5">
          <span class="font-extrabold ${Number(r.score) >= 5 ? 'text-emerald-600' : 'text-red-500'} text-base">${Number(r.score).toFixed(2)}</span>
          <div class="text-[11px] text-slate-400">${r.correct}/${r.total} câu</div>
          ${r.note ? `<div class="text-[11px] text-amber-600 mt-0.5">Ghi chú: ${esc(r.note)}</div>` : ''}
        </td>
        <td class="px-4 py-3.5 text-xs text-slate-500">
          <div>${fmtDuration(r.durationSeconds)}</div>
          <div>Nộp: ${fmtDateTime(r.submittedAt)}</div>
        </td>
        <td class="px-4 py-3.5 text-right whitespace-nowrap">
          <button onclick="openPrintPhieu('${esc(r.id)}')" class="text-flag-600 hover:text-flag-800 font-semibold text-xs px-2 py-1.5">🖨 In phiếu</button>
        </td>
      </tr>`;
    }).join('');
  }
}
document.getElementById('ag-exam').addEventListener('change', renderAggregate);
document.getElementById('ag-mode').addEventListener('change', renderAggregate);
document.getElementById('ag-topk').addEventListener('change', renderAggregate);
document.getElementById('ag-min').addEventListener('input', renderAggregate);

/* ---- Xuất CSV (dấu ; + BOM để mở thẳng bằng Excel tiếng Việt) ---- */
function csvCell(v) {
  const s = String(v === undefined || v === null ? '' : v);
  return /[";\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
function downloadCsv(filename, rows) {
  const text = '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function exportIndividualsCsv() {
  const settings = agSettings();
  const individuals = computeIndividuals(settings);
  const rows = [
    ['Hạng', 'CCCD', 'Chức vụ', 'Đơn vị công tác', 'Bài thi', 'Điểm', 'Số câu đúng', 'Tổng câu', 'Thời gian làm bài (giây)', 'Thời điểm nộp', 'Số lần thi', 'Ghi chú'],
  ];
  for (const it of individuals) {
    const r = it.result;
    rows.push([
      it.rank,
      r.cccd,
      it.user ? (it.user.position || '') : '',
      displayUnit(it.user && it.user.unit),
      r.examTitle || r.category || '',
      Number(r.score).toFixed(2),
      r.correct,
      r.total,
      r.durationSeconds,
      fmtDateTime(r.submittedAt),
      it.attempts,
      r.note || '',
    ]);
  }
  downloadCsv(`bang-diem-ca-nhan-${Date.now()}.csv`, rows);
}
function exportTeamsCsv() {
  const settings = agSettings();
  const teams = computeTeams(computeIndividuals(settings), settings);
  const rows = [
    ['Hạng', 'Đơn vị công tác', 'Số đăng ký', 'Số đã thi', `Điểm đội (TB Top ${settings.topK})`, 'Thành phần điểm (Top)', 'Điểm TB tất cả', 'Điều kiện xét giải'],
  ];
  for (const t of teams) {
    rows.push([
      t.rank || '',
      t.unit,
      t.registered,
      t.members.length,
      t.members.length ? t.teamScore.toFixed(2) : '',
      t.topScores.map((s) => s.toFixed(2)).join(', '),
      t.members.length ? t.avgAll.toFixed(2) : '',
      t.qualified ? 'Đạt' : `Chưa đạt (cần tối thiểu ${settings.minMembers})`,
    ]);
  }
  downloadCsv(`bang-xep-hang-doi-${Date.now()}.csv`, rows);
}

/* ---- In phiếu kết quả từng thí sinh ---- */
function optionLetter(i) {
  return Number.isInteger(i) ? String.fromCharCode(65 + i) : '—';
}
function individualRankOf(resultId) {
  const it = lastIndividuals.find((x) => x.result.id === resultId);
  return it ? it.rank : null;
}
async function openPrintPhieu(resultId) {
  try {
    const data = await api(`/admin/results/${resultId}/detail`);
    const html = buildPhieuHtml(data);
    document.getElementById('print-preview').innerHTML = html;
    document.getElementById('print-area').innerHTML = html;
    openModal('modal-print');
  } catch (err) {
    toast(err.message, 'error');
  }
}
function buildPhieuHtml(data) {
  const r = data.result;
  const user = cache.users.find((u) => u.cccd === r.cccd) || {};
  const rank = individualRankOf(r.id);
  const rows = data.questions.map((q, idx) => {
    const has = Object.prototype.hasOwnProperty.call(data.answers, q.id);
    const choice = has ? data.answers[q.id] : null;
    const ok = Number.isInteger(choice) && choice === q.correctIndex;
    const chosen = Number.isInteger(choice) ? `${optionLetter(choice)}. ${q.options[choice] || ''}` : '(không trả lời)';
    const right = `${optionLetter(q.correctIndex)}. ${q.options[q.correctIndex] || ''}`;
    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${esc(q.text)}</td>
        <td>${esc(chosen)}</td>
        <td>${esc(right)}</td>
        <td style="text-align:center;font-weight:700;color:${ok ? '#047857' : '#b91c1c'}">${ok ? 'Đúng' : 'Sai'}</td>
      </tr>`;
  }).join('');
  return `
    <div style="text-align:center">
      <div style="font-weight:700;letter-spacing:.4px">${esc(ORG_LINE)}</div>
      <div style="font-size:11px">---------------- o0o ----------------</div>
      <h2 style="font-size:18px;font-weight:800;margin:8px 0 2px">PHIẾU KẾT QUẢ THI TRẮC NGHIỆM</h2>
      <div style="font-size:12px">${esc(CONTEST_LINE)}</div>
      <div style="font-size:12px;margin-top:3px">Bài thi: <b>${esc(r.examTitle)}</b></div>
    </div>
    <table class="pv-table" style="margin-top:10px">
      <tr><th style="width:20%">Số CCCD</th><td style="width:30%">${esc(r.cccd)}</td><th style="width:20%">Hạng cá nhân</th><td>${rank ? '#' + rank : '—'}</td></tr>
      <tr><th>Chức vụ</th><td>${esc(user.position || '—')}</td><th>Đơn vị công tác</th><td>${esc(displayUnit(user.unit))}</td></tr>
      <tr><th>Email</th><td>${esc(user.email || '—')}</td><th>Số lần thi</th><td>${r.attempts}</td></tr>
      <tr><th><b>ĐIỂM THI</b></th><td style="font-size:16px;font-weight:800;color:#b00d28">${Number(r.score).toFixed(2)} / 10</td><th>Số câu đúng</th><td><b>${r.correct}</b> / ${r.total}</td></tr>
      <tr><th>Thời gian làm bài</th><td>${fmtDuration(r.durationSeconds)}</td><th>Thời điểm nộp bài</th><td>${fmtDateTime(r.submittedAt)}</td></tr>
    </table>
    ${r.note ? `<p style="margin-top:8px"><b>Ghi chú của Ban Tổ chức:</b> ${esc(r.note)}</p>` : ''}
    <p style="margin-top:12px;font-weight:700">CHI TIẾT BÀI LÀM (${data.questions.length} câu):</p>
    <table class="pv-table">
      <thead>
        <tr><th style="width:6%">Câu</th><th style="width:42%">Nội dung câu hỏi</th><th style="width:19%">Đáp án đã chọn</th><th style="width:22%">Đáp án đúng</th><th style="width:11%">Kết quả</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="width:100%;margin-top:22px;font-size:12px">
      <tr>
        <td style="text-align:center;width:50%">Người lập bảng<br><br><br>_____________________</td>
        <td style="text-align:center;width:50%">Đại diện Ban Tổ chức<br><br><br>_____________________</td>
      </tr>
    </table>
    <p style="margin-top:12px;font-size:10px;color:#555">Phiếu in từ hệ thống thi trực tuyến OES lúc ${new Date().toLocaleString('vi-VN')}${r.isRandom ? ' · Bộ đề riêng 30 câu được trộn từ ngân hàng 150 câu (Bộ đề số 6 - Luật An ninh mạng 2026)' : ''}.</p>`;
}

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
