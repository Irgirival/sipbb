require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { getDb } = require('./db/database');
const { seedPBB } = require('./db/seeder');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pbb', require('./routes/pbb'));
app.use('/api/admin', require('./routes/admin'));

// Public API wrapper
app.use('/api/public', (req, res, next) => {
  // Rewrite /api/public/* to appropriate routes
  const originalUrl = req.url;
  if (originalUrl.startsWith('/pbb/')) {
    req.url = originalUrl.replace('/pbb/', '/');
    require('./routes/pbb')(require('express').Router(), (err) => { if (err) console.error(err); })(req, res, next);
  } else if (originalUrl === '/settings') {
    const { query } = require('./db/database');
    const rows = query('SELECT key, value FROM village_settings');
    const obj = {};
    rows.forEach(r => obj[r.key] = r.value);
    return res.json(obj);
  } else {
    next();
  }
});

// SPA fallback for admin pages
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/admin/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Init DB and start
async function start() {
  await getDb();
  await seedPBB();
  app.listen(PORT, () => {
    console.log(`\n🏛️  SIPBB Desa Kasomalang Kulon`);
    console.log(`🌐  Server: http://localhost:${PORT}`);
    console.log(`👨‍💼  Admin: http://localhost:${PORT}/admin`);
    console.log(`📋  API:   http://localhost:${PORT}/api`);
    console.log(`\n✅  Default login: admin / admin123\n`);
  });
}

start().catch(console.error);
