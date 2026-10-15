/**
 * exam.routes.js (OES / VERCEL EDITION) — API cho thí sinh: xem danh sách đề,
 * tải đề, bắt đầu làm bài, nộp bài (server chấm điểm) và lưu kết quả vĩnh viễn.
 *
 * Lưu ý an toàn:
 *  - Đề gửi cho client KHÔNG BAO GIỜ chứa đáp án đúng (correctIndex).
 *  - Điểm được chấm hoàn toàn trên server từ dữ liệu đề trong RAM cache.
 *  - Phiên làm bài là STATELESS qua "attempt token" HMAC
 *    { cccd, examId, startedAt }: client nhận khi POST /start, lưu localStorage,
 *    gửi lại khi vào lại hoặc nộp bài. Server không cần RAM chung — tương thích
 *    hoàn hảo với Vercel serverless (mỗi request có thể chạy trên instance khác).
 *  - Thí sinh không thể tự gian lận thời gian: startedAt nằm trong token được
 *    ký bằng SESSION_SECRET — sửa token là chữ ký sai → bị từ chối.
 */
'use strict';

const express = require('express');
const dataStore = require('../store/dataStore');
const { requireAuth } = require('../middleware/auth');
const { newId, signAttemptToken, verifyAttemptToken } = require('../utils/crypto');
const { statusOf, gateMessage } = require('../utils/examWindow');

const router = express.Router();
router.use(requireAuth);

const DURATION_GRACE_SECONDS = 15; // Dung sai mạng/khoe UI khi nộp sát giờ.

/* ---------------------------- DANH SÁCH ĐỀ THI ---------------------------- */
router.get('/exams', (req, res) => {
  const exams = dataStore
    .get('exams')
    .map((e) => ({
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
      windowStatus: statusOf(e).status,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ exams });
});

/* ------------------------------ CHI TIẾT ĐỀ THI ------------------------------ */
router.get('/exams/:id', (req, res) => {
  const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

  // Che đáp án đúng trước khi trả về client.
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
        options: q.options,
      })),
    },
  });
});

/* ------------------------- BẮT ĐẦU LÀM BÀI (giám thị server) ------------------------- */
/**
 * Logic:
 *  - Client gửi kèm attemptToken (nếu đã có lượt đang làm): token hợp lệ →
 *    kế tục với startedAt gốc (không reset đồng hồ, không cần qua cửa thi —
 *    đúng tinh thần "ai đã vào trong khung giờ thì được làm tiếp/nộp muộn").
 *  - Không có/không hợp lệ token: kiểm tra CỬA THI (giờ thi quy định) rồi cấp
 *    lượt mới với startedAt = bây giờ.
 */
router.post('/exams/:id/start', (req, res) => {
  const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

  const totalSeconds = exam.durationMinutes * 60;

  // 1) Ưu tiên kế tục lượt đang làm từ attempt token.
  const existing = verifyAttemptToken(req.body.attemptToken, req.user.cccd, exam.id);
  let startedAt;
  if (existing) {
    startedAt = existing.startedAt;
  } else {
    // 2) Lượt mới — phải qua cửa thi (giờ thi quy định).
    const win = statusOf(exam);
    const blocked = gateMessage(win, exam.title);
    if (blocked) return res.status(423).json({ message: blocked });
    startedAt = Date.now();
  }

  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const remaining = Math.max(totalSeconds - elapsed, 0);
  res.json({
    startedAt: new Date(startedAt).toISOString(),
    durationMinutes: exam.durationMinutes,
    remainingSeconds: remaining,
    totalQuestions: (exam.questions || []).length,
    // Client PHẢI giữ token này (localStorage) và gửi lại khi nộp bài/vào lại.
    attemptToken: signAttemptToken(req.user.cccd, exam.id, startedAt),
  });
});

/* ------------------------------- NỘP BÀI & CHẤM ĐIỂM ------------------------------- */
router.post('/exams/:id/submit', async (req, res, next) => {
  try {
    const exam = dataStore.get('exams').find((e) => e.id === req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi.' });

    const questions = exam.questions || [];
    if (questions.length === 0) {
      return res.status(400).json({ message: 'Đề thi chưa có câu hỏi hợp lệ.' });
    }

    // ---- Xác định lượt làm bài ----
    // Ưu tiên attempt token (stateless); không có token hợp lệ → áp dụng luật
    // cửa thi như lượt mới và tin duration client báo (kẹp trần theo đề) —
    // tương đương cơ chế fallback của bản cũ khi server restart.
    const attempt = verifyAttemptToken(req.body.attemptToken, req.user.cccd, exam.id);
    const totalSeconds = exam.durationMinutes * 60;
    let durationSeconds;
    let startedAtIso;

    if (attempt) {
      durationSeconds = Math.floor((Date.now() - attempt.startedAt) / 1000);
      startedAtIso = new Date(attempt.startedAt).toISOString();
    } else {
      // Lượt mới/không có token: đề phải đang MỞ CỬA thì mới được nộp.
      const win = statusOf(exam);
      const blocked = gateMessage(win, exam.title);
      if (blocked) return res.status(423).json({ message: blocked });
      const clientDur = parseInt(req.body.durationSeconds, 10);
      durationSeconds = Number.isFinite(clientDur) && clientDur > 0 ? clientDur : totalSeconds;
      durationSeconds = Math.min(durationSeconds, totalSeconds);
      startedAtIso = new Date(Date.now() - durationSeconds * 1000).toISOString();
    }
    durationSeconds = Math.min(durationSeconds + DURATION_GRACE_SECONDS, totalSeconds);

    // ---- Chấm điểm trên server ----
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answerMap = new Map(
      answers.map((a) => [String(a && a.qid), parseInt(a && a.choice, 10)])
    );
    let correct = 0;
    for (const q of questions) {
      const choice = answerMap.get(q.id);
      if (Number.isInteger(choice) && choice === q.correctIndex) correct += 1;
    }
    // Thang điểm 10, làm tròn 2 chữ số thập phân.
    const score = Math.round((correct / questions.length) * 10 * 100) / 100;

    const result = {
      id: newId('res'),
      examId: exam.id,
      examTitle: exam.title,
      category: exam.category,
      cccd: req.user.cccd,
      score,
      correct,
      total: questions.length,
      startedAt: startedAtIso,
      durationSeconds,
      submittedAt: new Date().toISOString(),
    };

    dataStore.get('results').push(result);

    // Đồng bộ vĩnh viễn kết quả lên Google Drive NGAY trong request (serverless
    // không thể "để vòng sau làm") — baseline-merge đảm bảo không đè mất bài
    // nộp từ instance khác. Nếu Drive tạm lỗi: trả cảnh báo, instance giữ dữ
    // liệu trong RAM và request kế tiếp sẽ thử lại.
    const sync = await dataStore.saveNow('results');

    res.status(201).json({
      message: sync.synced
        ? 'Đã nộp bài thành công!'
        : 'Đã nộp bài thành công! (Dữ liệu chưa sync lên Drive — hệ thống sẽ tự thử lại, bạn không cần làm gì thêm.)',
      result: {
        id: result.id,
        score: result.score,
        correct: result.correct,
        total: result.total,
        durationSeconds: result.durationSeconds,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
