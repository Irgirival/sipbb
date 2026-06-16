const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sipbb_kasomalang_kulon_secret_2026';

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

function staffOnly(req, res, next) {
  if (!['admin', 'kolektor', 'rt'].includes(req.user?.role))
    return res.status(403).json({ error: 'Staff only' });
  next();
}

module.exports = { auth, adminOnly, staffOnly, JWT_SECRET };
