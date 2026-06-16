# SIPBB - Sistem Informasi Pajak Bumi dan Bangunan P2
## Desa Kasomalang Kulon, Kecamatan Kasomalang, Kabupaten Subang

Sistem informasi manajemen PBB (Pajak Bumi dan Bangunan) untuk Desa Kasomalang Kulon.

## 🚀 Fitur Utama

### Portal Publik
- **Beranda Desa**: Informasi profil desa, layanan, berita, dan pengumuman
- **Cek PBB Online**: Cek status tunggakan PBB berdasarkan NOP
- **Analitik Transparan**: Visualisasi data tunggakan per tahun dan wilayah

### Panel Admin
- **Dashboard**: Ringkasan statistik PBB dan aktivitas sistem
- **Manajemen Wajib Pajak**: CRUD data WP dan tunggakan
- **Verifikasi Pembayaran**: Approve/reject bukti pembayaran
- **Manajemen Pengguna**: Kelola admin, kolektor, dan RT
- **Konten**: Kelola berita, pengumuman, dan galeri
- **Pengaturan Desa**: Konfigurasi data desa dan parameter PBB

## 📁 Struktur Folder

```
/workspace/
├── server.js              # Entry point Express server
├── package.json           # Dependencies Node.js
├── .env                   # Environment variables
├── db/
│   ├── database.js        # SQLite database handler
│   └── seeder.js          # Initial data seeder
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js            # Login endpoint
│   ├── pbb.js             # PBB API (public & protected)
│   └── admin.js           # Admin-only API
├── frontend/
│   ├── public/            # Website publik
│   │   ├── index.html     # Beranda desa
│   │   └── pbb.html       # Halaman info PBB
│   └── admin/
│       └── index.html     # Single Page Admin Panel
├── pages/                 # Halaman tambahan
└── uploads/               # Folder upload bukti bayar
```

## 🛠️ Instalasi & Menjalankan

### Prasyarat
- Node.js >= 16.x
- npm atau yarn

### Langkah Instalasi

```bash
cd /workspace

# Install dependencies
npm install

# Jalankan server
npm start
```

Server akan berjalan di `http://localhost:3001`

## 🔐 Login Default

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |

## 📡 API Endpoints

### Public (Tanpa Auth)
- `GET /api/pbb/cek?nop=<NOP>` - Cek status PBB
- `GET /api/pbb/analytics` - Data analitik PBB
- `GET /api/public/settings` - Pengaturan desa

### Protected (Perlu Auth)
- `POST /api/auth/login` - Login user
- `GET /api/pbb/wajib-pajak` - List wajib pajak
- `GET /api/pbb/wajib-pajak/:id` - Detail WP
- `POST /api/pbb/pembayaran` - Upload bukti bayar
- `GET /api/pbb/pembayaran` - List pembayaran pending
- `PUT /api/pbb/pembayaran/:id/review` - Approve/reject
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - List pengguna
- `POST /api/admin/users` - Tambah pengguna
- `PUT /api/admin/users/:id` - Update pengguna
- `DELETE /api/admin/users/:id` - Hapus pengguna
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings
- `GET/POST/PUT/DELETE /api/admin/pengumuman/*` - CRUD pengumuman
- `GET/POST/PUT/DELETE /api/admin/berita/*` - CRUD berita
- `GET/POST/DELETE /api/admin/gallery/*` - CRUD galeri

## 🏗️ Teknologi

- **Backend**: Node.js + Express.js
- **Database**: SQLite (sql.js)
- **Auth**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Security**: Helmet, CORS, bcryptjs
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Fonts**: Google Fonts (Plus Jakarta Sans, Fraunces)

## 👥 Role & Permissions

| Role | Deskripsi | Akses |
|------|-----------|-------|
| **Admin** | Administrator desa | Full access ke semua fitur |
| **Kolektor** | Petugas pemungut PBB | Lihat WP, verifikasi pembayaran |
| **RT** | Ketua RT | Lihat WP di RT-nya, upload bukti bayar |

## 📊 Database Schema

### Tables
- `users` - User accounts (admin, kolektor, RT)
- `wajib_pajak` - Data wajib pajak
- `tunggakan` - Tagihan tahunan per WP
- `pembayaran` - Bukti pembayaran yang diupload
- `village_settings` - Pengaturan desa
- `village_stats` - Statistik desa
- `announcements` - Pengumuman
- `berita` - Berita
- `gallery` - Galeri foto

## 🎨 Desain UI

Sistem ini menggunakan desain modern dengan:
- Warna utama: Hijau (#1a4731) dan Emas (#c9a84c)
- Font: Plus Jakarta Sans untuk body, Fraunces untuk heading
- Responsive design untuk mobile dan desktop
- Animasi smooth dan micro-interactions

## 📝 License

MIT License - Desa Kasomalang Kulon