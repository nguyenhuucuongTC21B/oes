/** helper-sign-verify-inline.js — ký và verify trong cùng tiến trình (local mode). */
'use strict';
const { signToken, verifyToken } = require('../src/utils/crypto');
const token = signToken({ cccd: '098765432109', role: 'user' });
console.log(verifyToken(token) ? 'OK' : 'FAIL');
