/** helper-sign.js — ký token như sau khi đăng nhập (chạy ở "instance A"). */
'use strict';
const { signToken } = require('../src/utils/crypto');
console.log(signToken({ cccd: process.argv[2] || '012345678901', role: 'user' }));
