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

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, 'frontend/public')));

// Admin route - serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/admin/index.html'));
});

app.get('/admin/:path*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/admin/index.html'));
});

// PBB page route
app.get('/pbb', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/public/pbb.html'));
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pbb', require('./routes/pbb'));
app.use('/api/admin', require('./routes/admin'));

// Public API wrapper for village settings and PBB public endpoints
app.use('/api/public', (req, res, next) => {
  const originalUrl = req.url;
  
  if (originalUrl.startsWith('/pbb/')) {
    // Forward to pbb routes
    const pbbRouter = require('./routes/pbb');
    req.url = originalUrl.replace('/pbb/', '/');
    return pbbRouter(req, res, next);
  } else if (originalUrl === '/settings') {
    const { query } = require('./db/database');
    try {
      const rows = query('SELECT key, value FROM village_settings');
      const obj = {};
      rows.forEach(r => obj[r.key] = r.value);
      return res.json(obj);
    } catch (e) {
      return res.json({});
    }
  } else if (originalUrl === '/berita' || originalUrl === '/pengumuman' || originalUrl === '/gallery') {
    // Return empty arrays for now
    return res.json([]);
  } else {
    next();
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Init DB and start
async function start() {
  try {
    await getDb();
    await seedPBB();
    app.listen(PORT, () => {
      console.log(`\n🏛️  SIPBB Desa Kasomalang Kulon`);
      console.log(`🌐  Server: http://localhost:${PORT}`);
      console.log(`👨‍💼  Admin: http://localhost:${PORT}/admin`);
      console.log(`📋  API:   http://localhost:${PORT}/api`);
      console.log(`\n✅  Default login: admin / admin123\n`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
  }
}

start().catch(console.error);
