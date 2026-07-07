# HR System — Next.js + MySQL

Aplikasi HR internal: absensi kamera, cuti, analitik kinerja, dan penggajian berbasis capaian dengan RBAC (role & authority) yang dapat dikonfigurasi.

## ✨ Fitur

- **Login berbasis role** — Admin, HR, CEO, Karyawan. Role **bisa ditambah** dan **authority-nya diatur** (per aksi).
- **Registrasi hanya oleh Admin/HR** — tidak ada self-register. Data karyawan: identitas login, nama lengkap, tanggal lahir, tanggal bergabung, role, department, gaji.
- **Department dinamis** — Warehouse, Live, Marketing (default) dan bisa ditambah.
- **Absensi kamera** — check-in/out mengambil foto webcam; status **otomatis**: Tepat Waktu / Terlambat / Pulang Cepat.
- **Setelan jam kerja** — jam masuk, jam pulang, toleransi terlambat & pulang cepat (global atau per department).
- **Cuti** — karyawan mengajukan, HR/Admin menyetujui/menolak.
- **Kinerja & gaji** — KPI dengan **pembobotan**; gaji = gaji pokok + tunjangan kinerja × skor berbobot.
- **Dashboard analitik** — kehadiran, kinerja per department, dan notifikasi pengajuan cuti.

## 🛠️ Teknologi

Next.js 15 (App Router) · TypeScript · Prisma · MySQL · Tailwind CSS · Recharts · Auth JWT (jose) · bcrypt.

## 🚀 Menjalankan

### 1. Prasyarat
- Node.js 18+ (teruji di Node 24)
- MySQL lokal (mis. **XAMPP/Laragun/WAMP** atau MySQL Server)

### 2. Siapkan database
Buat database kosong bernama `hrapp` (via phpMyAdmin atau CLI):
```sql
CREATE DATABASE hrapp;
```

### 3. Konfigurasi environment
Salin `.env.example` menjadi `.env` lalu sesuaikan `DATABASE_URL`:
```
DATABASE_URL="mysql://root:@localhost:3306/hrapp"
JWT_SECRET="ganti-dengan-secret-acak-panjang"
```
> XAMPP default: user `root` tanpa password. Jika punya password: `mysql://root:PASSWORD@localhost:3306/hrapp`.

### 4. Install & inisialisasi
```bash
npm install
npm run db:push     # buat semua tabel dari schema
npm run db:seed     # isi role, permission, department, akun awal & data demo
```

### 5. Jalankan
```bash
npm run dev
```
Buka http://localhost:3000

### 🔑 Akun demo (dari seed)
| Role     | Username | Password    |
|----------|----------|-------------|
| Admin    | admin    | admin123    |
| HR       | hr       | password123 |
| Karyawan | budi     | password123 |

> ⚠️ Absensi kamera butuh izin webcam. Browser mengizinkan `getUserMedia` di `localhost` (secure context) — aman untuk pengembangan.

## 📂 Struktur singkat
```
prisma/schema.prisma   # model data (RBAC, absensi, cuti, kinerja, gaji)
prisma/seed.ts         # data awal
src/lib/               # prisma, auth/JWT, RBAC, jadwal & penilaian absensi, kalkulasi gaji
src/middleware.ts      # proteksi rute berbasis sesi
src/app/api/           # REST API (auth, employees, roles, departments, attendance, leave, kpi, payroll, settings)
src/app/(app)/         # halaman ter-autentikasi (dashboard, absensi, cuti, karyawan, gaji, pengaturan)
src/components/        # UI, kamera, chart, dan panel per modul
```

## 🧮 Cara kerja penilaian & gaji

**Status absensi** (`src/lib/schedule.ts`):
- Tepat Waktu: check-in ≤ jam masuk + toleransi.
- Terlambat: melewati batas toleransi.
- Pulang Cepat: check-out < jam pulang − toleransi.

**Gaji** (`src/lib/performance.ts`):
```
skorBerbobot = Σ(skorKPI × bobot) / Σ(bobot)          // 0–100
tunjangan    = tunjanganKinerjaMaks × skorBerbobot / 100
totalGaji    = gajiPokok + tunjangan − potongan
```

## 🔧 Perintah lain
| Perintah              | Fungsi                                   |
|-----------------------|------------------------------------------|
| `npm run db:studio`   | Buka Prisma Studio (lihat/edit data)     |
| `npm run db:reset`    | Reset skema + seed ulang (menghapus data)|
| `npm run build`       | Build produksi                           |

## 🔒 Catatan produksi
Ganti `JWT_SECRET`, aktifkan HTTPS (cookie `secure`), batasi ukuran foto/`bodySizeLimit`, dan pertimbangkan menyimpan foto absensi ke object storage alih-alih kolom database.
