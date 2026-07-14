# AI Assistant Universal — Design Spec

**Date:** 2026-07-14
**Status:** Approved

## Goal

Ubah halaman `/financial` menjadi halaman **AI Assistant universal** yang dapat membantu pengguna mengelola keuangan, PDCA, task log, kinerja & gaji, serta membuat dan menyimpan CPAS Plan dan SOP Plan afiliasi. Sidebar item "Keuangan" diganti menjadi "AI Assistant".

---

## Scope

Satu halaman (`/financial`) diperluas. Tidak ada route baru, tidak ada halaman kedua. Semua kemampuan tersedia melalui satu chat interface dengan tool-based AI.

---

## Section 1: Database

### Model Baru — `CpasPlan`

CPAS = Content, Promo, Audience, Strategy — rencana konten untuk program afiliasi.

```prisma
model CpasPlan {
  id          Int      @id @default(autoincrement())
  title       String
  period      String                        // mis. "Juli 2026"
  content     String   @db.Text            // rencana konten
  promo       String   @db.Text            // detail promosi
  audience    String   @db.Text            // deskripsi target audience
  strategy    String   @db.Text            // strategi keseluruhan
  pic         User?    @relation("CpasPic", fields: [picId], references: [id])
  picId       Int?
  createdBy   User     @relation("CpasCreator", fields: [createdById], references: [id], onDelete: Cascade)
  createdById Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdById])
}
```

### Model Baru — `SopPlan`

SOP = Standar Operasional Prosedur afiliasi.

```prisma
enum SopStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model SopPlan {
  id          Int       @id @default(autoincrement())
  title       String
  description String    @db.Text
  department  String                         // teks bebas, mis. "Affiliate Marketing"
  pic         User?     @relation("SopPic", fields: [picId], references: [id])
  picId       Int?
  status      SopStatus @default(DRAFT)
  createdBy   User      @relation("SopCreator", fields: [createdById], references: [id], onDelete: Cascade)
  createdById Int
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([createdById])
}
```

### Relasi Tambahan di Model `User`

```prisma
cpasPicAssigned  CpasPlan[] @relation("CpasPic")
cpasCreated      CpasPlan[] @relation("CpasCreator")
sopPicAssigned   SopPlan[]  @relation("SopPic")
sopCreated       SopPlan[]  @relation("SopCreator")
```

### Migrasi

Jalankan `npx prisma db push` setelah schema diperbarui. Tidak ada data existing yang terdampak.

---

## Section 2: Tools & API

### File Baru

**`src/lib/cpasAssistantTools.ts`**
- `list_cpas_plans` — daftar semua CPAS plan (50 terbaru), `available()` = `financial.view`
- `save_cpas_plan(title, period, content, promo, audience, strategy, picUserId?)` — buat CPAS plan baru, `available()` = `financial.upload`

**`src/lib/sopAssistantTools.ts`**
- `list_sop_plans` — daftar semua SOP plan (50 terbaru), `available()` = `financial.view`
- `save_sop_plan(title, description, department, picUserId?, status)` — buat SOP plan baru, status default DRAFT, `available()` = `financial.upload`

Kedua file mengikuti pola `AssistantTool` yang sama dengan `financialAssistantTools.ts` dan `assistantTools.ts`.

### API Routes Baru

**`src/app/api/cpas/route.ts`** — `GET` (list, requires `financial.view`) · tidak ada `POST` karena AI yang menyimpan via tool

**`src/app/api/cpas/[id]/route.ts`** — `DELETE` (requires `financial.upload`)

**`src/app/api/sop/route.ts`** — `GET` (list, requires `financial.view`)

**`src/app/api/sop/[id]/route.ts`** — `DELETE` (requires `financial.upload`)

### Perubahan `src/lib/anthropic.ts`

Fungsi baru `sendAIAssistantChat()` menggabungkan semua tool dari:
- `financialAssistantTools.ts` (5 tool: list imports, get detail, get totals, save transactions, save comparison)
- `assistantTools.ts` (10 tool: employees, task log CRUD, PDCA CRUD, KPI/performance)
- `cpasAssistantTools.ts` (2 tool baru)
- `sopAssistantTools.ts` (2 tool baru)

Total maksimum 19 tool — setiap tool tetap dikontrol `available()` berdasarkan permission user.

System prompt baru `buildAIAssistantSystemPrompt()` mencakup semua kemampuan:
- Keuangan (impor, transaksi, komparasi)
- PDCA (minggu & task)
- Task Log harian
- KPI & penggajian
- CPAS Plan afiliasi
- SOP Plan afiliasi

### Perubahan `src/app/api/assistant/financial-chat/route.ts`

Ganti panggilan `sendFinancialAssistantChat()` → `sendAIAssistantChat()`. Permission gate tetap `financial.view` atau `financial.upload`.

---

## Section 3: UI

### Sidebar (`src/components/AppShell.tsx`)

| Field | Nilai Lama | Nilai Baru |
|---|---|---|
| Label | `"Keuangan"` | `"AI Assistant"` |
| Icon | `FileSpreadsheet` | `Bot` |
| href | `/financial` | `/financial` (tidak berubah) |
| permissions | `financial.view`, `financial.upload` | tetap sama |

### Page (`src/app/(app)/financial/page.tsx`)

Tidak ada perubahan permission. Ganti `FinancialClient` → `AIAssistantClient`.

### Rename Komponen

| File Lama | File Baru |
|---|---|
| `src/components/financial/FinancialClient.tsx` | `src/components/financial/AIAssistantClient.tsx` |
| `src/components/financial/FinancialAssistantChat.tsx` | `src/components/financial/AIAssistantChat.tsx` |

Nama fungsi di dalam file ikut diperbarui.

### `AIAssistantClient.tsx`

- **Header:** title `"AI Assistant"`, subtitle `"Chat dengan AI untuk mengelola keuangan, PDCA, task log, kinerja & gaji, serta membuat CPAS Plan dan SOP afiliasi."`
- **Chat:** komponen `AIAssistantChat` (lihat di bawah)
- **Bawah chat:** 3 tab:

  **Tab "Keuangan"** — konten sama persis seperti sebelumnya:
  - Riwayat Impor (tabel: file, status, transaksi, pemasukan, pengeluaran, diunggah)
  - Riwayat Komparasi Keuangan (card per komparasi)
  - `ImportResult` tetap muncul saat import di-klik

  **Tab "CPAS Plans"** — list card per plan:
  - Title + periode + PIC name
  - 4 blok isi: Content / Promo / Audience / Strategy (expandable atau selalu tampil)
  - Tombol hapus (hanya `canUpload`)

  **Tab "SOP Plans"** — list card per SOP:
  - Title + department + PIC name + status badge (Draft/Active/Archived)
  - Description (whitespace-pre-wrap)
  - Tombol hapus (hanya `canUpload`)

### `AIAssistantChat.tsx`

Sama persis dengan `FinancialAssistantChat.tsx` yang sudah ada (file upload gambar, preview, area besar) — hanya perubahan:

- Nama komponen: `AIAssistantChat`
- Subtitle header: `"Kelola keuangan, PDCA, task log, kinerja, serta buat CPAS Plan & SOP afiliasi."`
- **Suggestion chips** (4 chip):
  1. `"Buat CPAS Plan afiliasi untuk bulan ini."`
  2. `"Bandingkan total pengeluaran bulan ini dengan bulan lalu, lalu simpan hasilnya."`
  3. `"Tambahkan task PDCA minggu ini."`
  4. `"Buat SOP prosedur onboarding affiliate dan simpan sebagai Draft."`

---

## Constraints

- Bahasa UI tetap Bahasa Indonesia
- Permission system tidak berubah — tidak ada permission key baru
- Max file size tetap 8MB, format file tetap sama
- Tidak ada perubahan pada halaman lain (PDCA, TaskLog, Payroll tetap ada)
- `canUpload` = user punya `financial.upload` (sama seperti sebelumnya)
- Existing data (riwayat impor, komparasi) tidak terganggu
- `npx prisma db push` (bukan migration) untuk terapkan schema baru
