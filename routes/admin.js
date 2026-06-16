const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, run, get } = require('../db/database');
const { auth, adminOnly } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `img_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ===== USERS =====
router.get('/users', auth, adminOnly, (req, res) => {
  const rows = query('SELECT id, username, role, name, rt, rw, active, created_at FROM users ORDER BY role, name');
  res.json(rows);
});

router.post('/users', auth, adminOnly, async (req, res) => {
  const { username, password, role, name, rt, rw } = req.body;
  if (!username || !password || !role || !name)
    return res.status(400).json({ error: 'Data tidak lengkap' });
  if (!['admin', 'kolektor', 'rt'].includes(role))
    return res.status(400).json({ error: 'Role tidak valid' });
  if (role === 'rt' && (!rt || !rw))
    return res.status(400).json({ error: 'RT dan RW wajib untuk role RT' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const id = run('INSERT INTO users (username, password, role, name, rt, rw) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hash, role, name, rt || null, rw || null]);
    res.json({ success: true, id });
  } catch (e) {
    res.status(400).json({ error: 'Username sudah digunakan' });
  }
});

router.put('/users/:id', auth, adminOnly, async (req, res) => {
  const { name, role, rt, rw, active, password } = req.body;
  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (role) { updates.push('role = ?'); params.push(role); }
  if (rt !== undefined) { updates.push('rt = ?'); params.push(rt || null); }
  if (rw !== undefined) { updates.push('rw = ?'); params.push(rw || null); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    updates.push('password = ?'); params.push(hash);
  }
  if (!updates.length) return res.status(400).json({ error: 'Tidak ada data yang diubah' });
  params.push(req.params.id);
  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ success: true });
});

router.delete('/users/:id', auth, adminOnly, (req, res) => {
  if (req.params.id == req.user.id)
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
  run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ===== VILLAGE SETTINGS =====
router.get('/settings', auth, adminOnly, (req, res) => {
  const rows = query('SELECT key, value FROM village_settings');
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

router.put('/settings', auth, adminOnly, (req, res) => {
  const entries = Object.entries(req.body);
  if (!entries.length) return res.status(400).json({ error: 'Tidak ada data' });
  entries.forEach(([key, value]) => {
    run(`INSERT INTO village_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
      [key, value, value]);
  });
  res.json({ success: true });
});

// ===== VILLAGE STATS =====
router.put('/stats', auth, adminOnly, (req, res) => {
  Object.entries(req.body).forEach(([key, value]) => {
    run('INSERT INTO village_stats (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      [key, value, value]);
  });
  res.json({ success: true });
});

// ===== ANNOUNCEMENTS =====
router.get('/pengumuman', auth, adminOnly, (req, res) => {
  res.json(query('SELECT * FROM announcements ORDER BY created_at DESC'));
});

router.post('/pengumuman', auth, adminOnly, upload.single('gambar'), (req, res) => {
  const { judul, isi, kategori } = req.body;
  if (!judul || !isi) return res.status(400).json({ error: 'Judul dan isi wajib diisi' });
  const gambar = req.file ? req.file.filename : null;
  const id = run('INSERT INTO announcements (judul, isi, kategori, gambar, created_by) VALUES (?, ?, ?, ?, ?)',
    [judul, isi, kategori || 'umum', gambar, req.user.id]);
  res.json({ success: true, id });
});

router.put('/pengumuman/:id', auth, adminOnly, (req, res) => {
  const { judul, isi, kategori, active } = req.body;
  run('UPDATE announcements SET judul=?, isi=?, kategori=?, active=? WHERE id=?',
    [judul, isi, kategori, active !== undefined ? active : 1, req.params.id]);
  res.json({ success: true });
});

router.delete('/pengumuman/:id', auth, adminOnly, (req, res) => {
  run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ===== BERITA =====
router.get('/berita', auth, adminOnly, (req, res) => {
  res.json(query('SELECT * FROM berita ORDER BY created_at DESC'));
});

router.post('/berita', auth, adminOnly, upload.single('gambar'), (req, res) => {
  const { judul, ringkasan, isi, kategori } = req.body;
  if (!judul || !isi) return res.status(400).json({ error: 'Judul dan isi wajib' });
  const gambar = req.file ? req.file.filename : null;
  const id = run('INSERT INTO berita (judul, ringkasan, isi, gambar, kategori, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [judul, ringkasan || '', isi, gambar, kategori || 'berita', req.user.id]);
  res.json({ success: true, id });
});

router.put('/berita/:id', auth, adminOnly, (req, res) => {
  const { judul, ringkasan, isi, kategori, active } = req.body;
  run('UPDATE berita SET judul=?, ringkasan=?, isi=?, kategori=?, active=? WHERE id=?',
    [judul, ringkasan, isi, kategori, active !== undefined ? active : 1, req.params.id]);
  res.json({ success: true });
});

router.delete('/berita/:id', auth, adminOnly, (req, res) => {
  run('DELETE FROM berita WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ===== GALLERY =====
router.get('/gallery', auth, adminOnly, (req, res) => {
  res.json(query('SELECT * FROM gallery ORDER BY created_at DESC'));
});

router.post('/gallery', auth, adminOnly, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File wajib diupload' });
  const { judul, deskripsi, kategori } = req.body;
  const id = run('INSERT INTO gallery (judul, deskripsi, file, kategori) VALUES (?, ?, ?, ?)',
    [judul || 'Galeri', deskripsi || '', req.file.filename, kategori || 'kegiatan']);
  res.json({ success: true, id });
});

router.delete('/gallery/:id', auth, adminOnly, (req, res) => {
  const row = get('SELECT file FROM gallery WHERE id = ?', [req.params.id]);
  if (row && row.file) {
    const fp = path.join(uploadDir, row.file);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  run('DELETE FROM gallery WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ===== PBB Admin: add/update WP =====
router.post('/pbb/wajib-pajak', auth, adminOnly, (req, res) => {
  const { nama, nop, rt, rw, alamat, wp } = req.body;
  if (!nama || !nop) return res.status(400).json({ error: 'Nama dan NOP wajib' });
  try {
    const id = run('INSERT INTO wajib_pajak (nama, nop, rt, rw, alamat, wp) VALUES (?, ?, ?, ?, ?, ?)',
      [nama, nop, rt || 'luar', rw || 'luar', alamat || '', parseInt(wp) || 0]);
    res.json({ success: true, id });
  } catch {
    res.status(400).json({ error: 'NOP sudah ada' });
  }
});

router.post('/pbb/tunggakan', auth, adminOnly, (req, res) => {
  const { wp_id, tahun, jumlah } = req.body;
  const id = run('INSERT INTO tunggakan (wp_id, tahun, jumlah) VALUES (?, ?, ?)',
    [wp_id, parseInt(tahun), parseInt(jumlah)]);
  res.json({ success: true, id });
});

// Dashboard summary
router.get('/dashboard', auth, adminOnly, (req, res) => {
  const pbbStats = get(`
    SELECT 
      COUNT(DISTINCT wp.id) as total_wp,
      COALESCE(SUM(CASE WHEN t.status='belum' THEN t.jumlah ELSE 0 END), 0) as total_tunggakan,
      COUNT(CASE WHEN p.status='pending' THEN 1 END) as pending_bayar,
      COUNT(CASE WHEN p.status='approved' THEN 1 END) as approved_bayar
    FROM wajib_pajak wp
    LEFT JOIN tunggakan t ON t.wp_id = wp.id
    LEFT JOIN pembayaran p ON p.wp_id = wp.id
  `);

  const users = get('SELECT COUNT(*) as cnt FROM users WHERE active = 1');
  const berita = get('SELECT COUNT(*) as cnt FROM berita WHERE active = 1');
  const pengumuman = get('SELECT COUNT(*) as cnt FROM announcements WHERE active = 1');

  res.json({
    pbb: pbbStats,
    total_users: users.cnt,
    total_berita: berita.cnt,
    total_pengumuman: pengumuman.cnt
  });
});

module.exports = router;
