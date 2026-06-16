const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, run, get } = require('../db/database');
const { auth, adminOnly, staffOnly } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `bukti_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('File harus JPG, PNG, atau PDF'));
  }
});

// PUBLIC: Cek NOP (no auth required)
router.get('/cek', (req, res) => {
  const { nop } = req.query;
  if (!nop) return res.status(400).json({ error: 'NOP wajib diisi' });
  
  const wp = get('SELECT * FROM wajib_pajak WHERE nop = ?', [nop]);
  if (!wp) return res.status(404).json({ error: 'NOP tidak ditemukan' });
  
  const tunggakan = query('SELECT * FROM tunggakan WHERE wp_id = ? ORDER BY tahun DESC', [wp.id]);
  const lokasi = wp.rw === 'luar' ? 'Luar Desa Kasomalang Kulon' : `Kp. Kasomalang Kulon RT ${wp.rt}/RW ${wp.rw}`;
  
  res.json({
    nama: wp.nama,
    nop: wp.nop,
    lokasi,
    tunggakan
  });
});

// PUBLIC: Analytics (no auth required)
router.get('/analytics', (req, res) => {
  const totals = get(`
    SELECT
      COUNT(DISTINCT wp.id) as total_wp,
      COALESCE(SUM(CASE WHEN t.status='belum' THEN t.jumlah ELSE 0 END), 0) as total_tunggakan,
      COUNT(DISTINCT CASE WHEN COALESCE(t.status,'belum')='belum' THEN wp.id END) as belum_lunas,
      COUNT(DISTINCT CASE WHEN COALESCE(t.status,'lunas')='lunas' THEN wp.id END) as sudah_lunas
    FROM wajib_pajak wp
    LEFT JOIN tunggakan t ON t.wp_id = wp.id
  `);
  
  const yearSummary = query(`
    SELECT tahun, COUNT(DISTINCT wp.id) as jumlah_wp, SUM(t.jumlah) as total
    FROM tunggakan t
    JOIN wajib_pajak wp ON t.wp_id = wp.id
    WHERE t.status = 'belum'
    GROUP BY tahun
    ORDER BY tahun
  `);
  
  const rwSummary = query(`
    SELECT wp.rw, wp.rt, COUNT(DISTINCT wp.id) as jumlah_wp, 
           COALESCE(SUM(CASE WHEN t.status='belum' THEN t.jumlah ELSE 0 END), 0) as total_tunggakan
    FROM wajib_pajak wp
    LEFT JOIN tunggakan t ON t.wp_id = wp.id
    GROUP BY wp.rw, wp.rt
    ORDER BY wp.rw, wp.rt
  `);
  
  res.json({
    totals,
    yearSummary,
    rwSummary
  });
});

// GET wajib pajak list (filtered by RT role)
router.get('/wajib-pajak', auth, staffOnly, (req, res) => {
  const { nama, nop, rw, rt, status_tunggakan, page = 1, limit = 25 } = req.query;
  const user = req.user;

  let conditions = ['1=1'];
  let params = [];

  // RT can only see their RT
  if (user.role === 'rt') {
    conditions.push('wp.rt = ? AND wp.rw = ?');
    params.push(user.rt, user.rw);
  } else if (rw) {
    conditions.push('wp.rw = ?');
    params.push(rw);
    if (rt) { conditions.push('wp.rt = ?'); params.push(rt); }
  }

  if (nama) { conditions.push('wp.nama LIKE ?'); params.push(`%${nama}%`); }
  if (nop) { conditions.push('wp.nop LIKE ?'); params.push(`%${nop}%`); }

  const where = conditions.join(' AND ');
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = get(`SELECT COUNT(DISTINCT wp.id) as cnt FROM wajib_pajak wp WHERE ${where}`, params);
  const rows = query(`
    SELECT wp.*, 
      COALESCE(SUM(CASE WHEN t.status='belum' THEN t.jumlah ELSE 0 END), 0) as total_belum,
      COALESCE(SUM(CASE WHEN t.status='lunas' THEN t.jumlah ELSE 0 END), 0) as total_lunas,
      GROUP_CONCAT(CASE WHEN t.status='belum' THEN t.tahun END ORDER BY t.tahun) as tahun_belum
    FROM wajib_pajak wp
    LEFT JOIN tunggakan t ON t.wp_id = wp.id
    WHERE ${where}
    GROUP BY wp.id
    ORDER BY wp.rw, wp.rt, wp.nama
    LIMIT ? OFFSET ?
  `, [...params, parseInt(limit), offset]);

  res.json({ data: rows, total: total.cnt, page: parseInt(page), limit: parseInt(limit) });
});

// GET single WP detail with full tunggakan
router.get('/wajib-pajak/:id', auth, staffOnly, (req, res) => {
  const user = req.user;
  const wp = get('SELECT * FROM wajib_pajak WHERE id = ?', [req.params.id]);
  if (!wp) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (user.role === 'rt' && (wp.rt !== user.rt || wp.rw !== user.rw))
    return res.status(403).json({ error: 'Akses ditolak' });

  const tunggakan = query('SELECT * FROM tunggakan WHERE wp_id = ? ORDER BY tahun', [wp.id]);
  const pembayaran = query(`
    SELECT p.*, u.name as uploaded_by_name, u2.name as reviewed_by_name
    FROM pembayaran p
    LEFT JOIN users u ON p.uploaded_by = u.id
    LEFT JOIN users u2 ON p.reviewed_by = u2.id
    WHERE p.wp_id = ?
    ORDER BY p.created_at DESC
  `, [wp.id]);

  res.json({ ...wp, tunggakan, pembayaran });
});

// POST upload bukti pembayaran
router.post('/pembayaran', auth, staffOnly, upload.single('bukti'), (req, res) => {
  const { wp_id, tunggakan_ids, jumlah_bayar, catatan } = req.body;
  if (!wp_id || !tunggakan_ids || !jumlah_bayar)
    return res.status(400).json({ error: 'Data tidak lengkap' });

  const user = req.user;
  const wp = get('SELECT * FROM wajib_pajak WHERE id = ?', [wp_id]);
  if (!wp) return res.status(404).json({ error: 'WP tidak ditemukan' });
  if (user.role === 'rt' && (wp.rt !== user.rt || wp.rw !== user.rw))
    return res.status(403).json({ error: 'Akses ditolak' });

  // Mark tunggakan as 'proses'
  const ids = JSON.parse(tunggakan_ids);
  ids.forEach(tid => {
    run('UPDATE tunggakan SET status = ? WHERE id = ?', ['proses', tid]);
  });

  const buktiFile = req.file ? req.file.filename : null;
  const id = run(`
    INSERT INTO pembayaran (wp_id, tunggakan_ids, jumlah_bayar, bukti_file, catatan, uploaded_by, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `, [wp_id, JSON.stringify(ids), parseInt(jumlah_bayar), buktiFile, catatan || '', user.id]);

  res.json({ success: true, id, message: 'Bukti pembayaran berhasil diupload, menunggu persetujuan admin' });
});

// GET pending pembayaran (admin & kolektor)
router.get('/pembayaran', auth, (req, res) => {
  if (!['admin', 'kolektor'].includes(req.user.role))
    return res.status(403).json({ error: 'Akses ditolak' });
  const { status = 'pending', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const rows = query(`
    SELECT p.*, wp.nama, wp.nop, wp.rt, wp.rw, u.name as uploader_name
    FROM pembayaran p
    JOIN wajib_pajak wp ON p.wp_id = wp.id
    JOIN users u ON p.uploaded_by = u.id
    WHERE p.status = ?
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `, [status, parseInt(limit), offset]);
  const total = get('SELECT COUNT(*) as cnt FROM pembayaran WHERE status = ?', [status]);
  res.json({ data: rows, total: total.cnt });
});

// PUT approve/reject pembayaran (admin only)
router.put('/pembayaran/:id/review', auth, adminOnly, (req, res) => {
  const { action, rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ error: 'Action tidak valid' });

  const pembayaran = get('SELECT * FROM pembayaran WHERE id = ?', [req.params.id]);
  if (!pembayaran) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (pembayaran.status !== 'pending')
    return res.status(400).json({ error: 'Pembayaran sudah diproses' });

  const ids = JSON.parse(pembayaran.tunggakan_ids);

  if (action === 'approved') {
    ids.forEach(tid => run('UPDATE tunggakan SET status = ? WHERE id = ?', ['lunas', tid]));
    run(`UPDATE pembayaran SET status='approved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`,
      [req.user.id, req.params.id]);
  } else {
    ids.forEach(tid => run('UPDATE tunggakan SET status = ? WHERE id = ?', ['belum', tid]));
    run(`UPDATE pembayaran SET status='rejected', rejection_reason=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?`,
      [rejection_reason || 'Ditolak', req.user.id, req.params.id]);
  }

  res.json({ success: true, message: action === 'approved' ? 'Pembayaran disetujui' : 'Pembayaran ditolak' });
});

// GET analytics for staff dashboard
router.get('/analytics', auth, staffOnly, (req, res) => {
  const user = req.user;
  let wpFilter = '';
  let params = [];
  if (user.role === 'rt') {
    wpFilter = 'AND wp.rt = ? AND wp.rw = ?';
    params = [user.rt, user.rw];
  }

  const total = get(`SELECT COUNT(DISTINCT wp.id) as cnt FROM wajib_pajak wp WHERE 1=1 ${wpFilter.replace('AND','AND')}`, params);
  const belum = get(`
    SELECT COUNT(DISTINCT wp.id) as cnt, COALESCE(SUM(t.jumlah),0) as total
    FROM wajib_pajak wp JOIN tunggakan t ON t.wp_id = wp.id
    WHERE t.status='belum' ${wpFilter}
  `, params);
  const pending = get(`SELECT COUNT(*) as cnt FROM pembayaran p JOIN wajib_pajak wp ON p.wp_id = wp.id WHERE p.status='pending' ${wpFilter}`, params);

  const perTahun = query(`
    SELECT t.tahun, COUNT(DISTINCT wp.id) as jumlah_wp, SUM(t.jumlah) as total
    FROM tunggakan t JOIN wajib_pajak wp ON t.wp_id = wp.id
    WHERE t.status = 'belum' ${wpFilter}
    GROUP BY t.tahun ORDER BY t.tahun
  `, params);

  res.json({
    total_wp: total.cnt,
    wp_belum: belum.cnt,
    total_tunggakan: belum.total,
    pending_approval: pending.cnt,
    per_tahun: perTahun
  });
});

module.exports = router;
