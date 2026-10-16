/**
 * public.routes.js — API công khai (không cần đăng nhập): thống kê tổng quan
 * cho trang chủ + health check cho Vercel.
 */
'use strict';

const express = require('express');
const dataStore = require('../store/dataStore');
const driveClient = require('../drive/driveClient');

const router = express.Router();

/**
 * Nhãn phiên bản build — dùng để xác minh code mới đã được deploy:
 * mở <domain>/api/health, nếu thấy "build": "OES-VERCEL-R6" tức bản R5 (tách
 * file dữ liệu usersVercel.json / examsVercel.json / resultsVercel.json) +
 * R6 (tự phục hồi đường dẫn gốc khi deploy trộn lẫn — hết lỗi "mọi API trả
 * 401 Phiên hết hạn") đã chạy thật.
 */
const BUILD_TAG = 'OES-VERCEL-R6';

/** Số liệu tuyên truyền chỉ chứa con số tổng hợp, không chứa thông tin cá nhân. */
router.get('/stats', (req, res) => {
  const results = dataStore.get('results');
  const avgScore =
    results.length > 0
      ? Math.round((results.reduce((s, r) => s + (Number(r.score) || 0), 0) / results.length) * 100) / 100
      : 0;
  res.json({
    users: dataStore.count('users'),
    exams: dataStore.count('exams'),
    results: results.length,
    avgScore,
  });
});

/** Health check (giám sát định kỳ) + trạng thái đồng bộ Drive. */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    build: BUILD_TAG,
    mode: driveClient.getMode(),
    uptimeSeconds: Math.floor(process.uptime()),
    sync: dataStore.getSyncInfo(),
  });
});

module.exports = router;
