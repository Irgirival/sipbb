const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sipbb.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    initSchema();
    saveDb();
  }
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','kolektor','rt')),
      name TEXT NOT NULL,
      rt TEXT,
      rw TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS village_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wajib_pajak (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      nop TEXT UNIQUE NOT NULL,
      rt TEXT,
      rw TEXT,
      alamat TEXT,
      wp INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tunggakan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wp_id INTEGER NOT NULL,
      tahun INTEGER NOT NULL,
      jumlah INTEGER NOT NULL,
      status TEXT DEFAULT 'belum' CHECK(status IN ('belum','lunas','proses')),
      FOREIGN KEY(wp_id) REFERENCES wajib_pajak(id)
    );

    CREATE TABLE IF NOT EXISTS pembayaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wp_id INTEGER NOT NULL,
      tunggakan_ids TEXT NOT NULL,
      jumlah_bayar INTEGER NOT NULL,
      bukti_file TEXT,
      catatan TEXT,
      uploaded_by INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      rejection_reason TEXT,
      reviewed_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY(wp_id) REFERENCES wajib_pajak(id),
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL,
      isi TEXT NOT NULL,
      kategori TEXT DEFAULT 'umum',
      gambar TEXT,
      active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL,
      deskripsi TEXT,
      file TEXT NOT NULL,
      kategori TEXT DEFAULT 'kegiatan',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS village_stats (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS berita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judul TEXT NOT NULL,
      ringkasan TEXT,
      isi TEXT NOT NULL,
      gambar TEXT,
      kategori TEXT DEFAULT 'berita',
      active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Default village settings
  const defaultSettings = [
    ['desa_nama', 'Desa Kasomalang Kulon'],
    ['desa_kecamatan', 'Kecamatan Kasomalang'],
    ['desa_kabupaten', 'Kabupaten Subang'],
    ['desa_provinsi', 'Jawa Barat'],
    ['desa_kode_pos', '41284'],
    ['desa_telepon', '-'],
    ['desa_email', 'kasomalangkulon@gmail.com'],
    ['kepala_desa', 'H. AMIRUDIN, S.Pd.I'],
    ['sekretaris_desa', '-'],
    ['desa_motto', 'Sauyunan Maju Bareng'],
    ['desa_visi', 'Terwujudnya Desa Kasomalang Kulon yang Mandiri, Sejahtera, dan Berbudaya'],
    ['desa_misi', 'Meningkatkan kualitas pelayanan publik|Mengembangkan ekonomi masyarakat|Melestarikan budaya lokal|Meningkatkan infrastruktur desa'],
    ['desa_luas', '350 Ha'],
    ['desa_penduduk', '5.847'],
    ['desa_kk', '1.724'],
    ['desa_dusun', '3'],
    ['desa_rw', '7'],
    ['desa_rt', '32'],
    ['hero_tagline', 'Sauyunan Maju Bareng'],
    ['hero_subtitle', 'Portal Resmi Desa Kasomalang Kulon — Kecamatan Kasomalang, Kabupaten Subang'],
    ['pbb_tahun_mulai', '2020'],
    ['pbb_tahun_aktif', '2025'],
    ['pbb_keterangan', 'Pembayaran PBB dapat dilakukan melalui petugas pemungut di masing-masing RT atau langsung ke Kantor Desa'],
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO village_settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(([k, v]) => stmt.run([k, v]));
  stmt.free();

  // Default village stats
  const stats = [
    ['jenis_kelamin_l', '2.941'],
    ['jenis_kelamin_p', '2.906'],
    ['usia_produktif', '3.124'],
    ['pendidikan_sd', '1.842'],
    ['pendidikan_smp', '986'],
    ['pendidikan_sma', '724'],
    ['pendidikan_pt', '213'],
    ['mata_pencaharian_tani', '1.243'],
    ['mata_pencaharian_dagang', '456'],
    ['mata_pencaharian_pns', '98'],
    ['mata_pencaharian_lain', '827'],
  ];
  const stmt2 = db.prepare('INSERT OR IGNORE INTO village_stats (key, value) VALUES (?, ?)');
  stats.forEach(([k, v]) => stmt2.run([k, v]));
  stmt2.free();

  // Default admin user (password: admin123)
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password, role, name) VALUES ('admin', '${hash}', 'admin', 'Administrator Desa')`);
}

// Helper: run query
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0];
  return lastId ? lastId.values[0][0] : null;
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

module.exports = { getDb, saveDb, query, run, get };
