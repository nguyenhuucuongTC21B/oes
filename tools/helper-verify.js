/** helper-verify.js — xác minh token ở tiến trình khác ("instance B"). In OK/FAIL. */
'use strict';
const { verifyToken } = require('../src/utils/crypto');
const payload = verifyToken(process.argv[2] || '');
console.log(payload ? 'OK' : 'FAIL');
