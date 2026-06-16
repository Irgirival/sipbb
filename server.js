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
app.use(express.static(path.join(__dirname, '../frontend/public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/public', require('./routes/public'));
app.use('/api/pbb', require('./routes/pbb'));
app.use('/api/admin', require('./routes/admin'));

// SPA fallback for admin pages
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
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
