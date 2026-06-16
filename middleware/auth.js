const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sipbb-secret-key-change-in-production-2025';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Khusus admin.' });
  }
  next();
}

function staffOnly(req, res, next) {
  if (!['admin', 'kolektor', 'rt'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Akses ditolak. Khusus staff PBB.' });
  }
  next();
}

module.exports = { auth, adminOnly, staffOnly, JWT_SECRET };
