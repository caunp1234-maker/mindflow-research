const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { asyncHandler } = require('../lib/asyncHandler');

const router = express.Router();

// 셀프 회원가입은 없다 — 연구원 계정은 scripts/seed.js 또는 admin이 만든다(내부 운영 도구 전제).
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email, password가 필요합니다.' });
  }

  const { rows } = await db.query('select id, password_hash, role from users where email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '8h' });
  res.json({ token, role: user.role });
}));

module.exports = router;
