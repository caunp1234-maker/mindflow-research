const jwt = require('jsonwebtoken');
const config = require('../config');

/** Authorization: Bearer <token> 을 검증하고 req.user = { id, role } 를 채운다. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'authorization 헤더가 없습니다.' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
  }
}

/** requireAuth 이후에 붙여서 역할을 제한한다. 예: requireRole('admin', 'researcher') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '이 작업을 수행할 권한이 없습니다.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
