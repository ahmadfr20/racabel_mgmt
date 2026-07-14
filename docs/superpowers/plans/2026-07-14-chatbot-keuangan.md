# Chatbot Keuangan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah halaman Keuangan menjadi halaman berbasis chatbot — chatbot sebagai hero element, dengan dukungan input gambar, dan tanpa card upload Excel terpisah.

**Architecture:** Hapus card drag-and-drop upload Excel dari `FinancialClient.tsx`. Perluas `FinancialAssistantChat.tsx` agar menerima dan menampilkan gambar. Tambahkan `kind: "image"` pada `FinancialAttachment` di `anthropic.ts` dan kirim sebagai `image` content block ke Claude. Route `/api/assistant/financial-chat` mendeteksi ekstensi gambar dan meneruskan sebagai base64.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, Tailwind CSS, Anthropic SDK (`@anthropic-ai/sdk`)

## Global Constraints

- Bahasa UI tetap Bahasa Indonesia
- Semua fitur existing (riwayat impor, riwayat komparasi, delete) tetap berfungsi
- File gambar yang didukung Claude: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Max file size tetap 8MB
- Permission `financial.upload` tetap diperlukan untuk lampirkan file apapun ke chat
- Tidak ada migrasi database — tidak ada perubahan schema

---

### Task 1: Tambah `kind: "image"` pada `FinancialAttachment` dan handle image block di `anthropic.ts`

**Files:**
- Modify: `src/lib/anthropic.ts` (sekitar baris 245–292)

**Interfaces:**
- Produces: `FinancialAttachment` dengan union `kind: "pdf" | "text" | "image"`, field `mimeType?: string` untuk image

- [ ] **Step 1: Update interface `FinancialAttachment`**

Cari blok berikut di `src/lib/anthropic.ts` (baris 245–249):

```typescript
export interface FinancialAttachment {
  fileName: string;
  kind: "pdf" | "text";
  data: string; // base64 untuk pdf, teks polos (CSV) untuk kind "text"
}
```

Ganti dengan:

```typescript
export interface FinancialAttachment {
  fileName: string;
  kind: "pdf" | "text" | "image";
  data: string; // base64 untuk pdf/image, teks polos untuk kind "text"
  mimeType?: string; // wajib untuk kind "image", mis. "image/png"
}
```

- [ ] **Step 2: Handle image block di `sendFinancialAssistantChat`**

Cari blok berikut (sekitar baris 283–289):

```typescript
      const blocks: Anthropic.ContentBlockParam[] =
        attachment.kind === "pdf"
          ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.data } }]
          : [{ type: "text", text: `Isi file terlampir (${attachment.fileName}):\n\n${attachment.data}` }];
```

Ganti dengan:

```typescript
      let blocks: Anthropic.ContentBlockParam[];
      if (attachment.kind === "pdf") {
        blocks = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.data } }];
      } else if (attachment.kind === "image") {
        blocks = [{ type: "image", source: { type: "base64", media_type: attachment.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: attachment.data } }];
      } else {
        blocks = [{ type: "text", text: `Isi file terlampir (${attachment.fileName}):\n\n${attachment.data}` }];
      }
```

- [ ] **Step 3: Verifikasi TypeScript tidak error**

```powershell
cd "D:\Racabel\racabeldashboard\racabel_mgmt"
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

Expected: Tidak ada error baru terkait `anthropic.ts`.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/anthropic.ts
git commit -m "feat: tambah dukungan image attachment pada FinancialAttachment"
```

---

### Task 2: Tambah deteksi dan pemrosesan gambar di API route financial-chat

**Files:**
- Modify: `src/app/api/assistant/financial-chat/route.ts`

**Interfaces:**
- Consumes: `FinancialAttachment` dengan `kind: "image"` dari Task 1
- Produces: Route yang menerima file gambar dan meneruskannya sebagai image attachment

- [ ] **Step 1: Tambah konstanta IMAGE_EXT dan mapping mime type**

Di `src/app/api/assistant/financial-chat/route.ts`, setelah baris:

```typescript
const PDF_EXT = /\.pdf$/i;
```

Tambahkan:

```typescript
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};
```

- [ ] **Step 2: Tambah branch deteksi gambar di blok file handling**

Cari blok berikut (sekitar baris 48–59):

```typescript
    if (PDF_EXT.test(file.name)) {
      attachment = { fileName: file.name, kind: "pdf", data: buffer.toString("base64") };
    } else if (SPREADSHEET_EXT.test(file.name)) {
      try {
        const text = parseSpreadsheetToText(buffer, file.name);
        attachment = { fileName: file.name, kind: "text", data: text };
      } catch (err) {
        const message = err instanceof SpreadsheetParseError ? err.message : "Gagal membaca file.";
        throw new AuthError(message, 400);
      }
    } else {
      throw new AuthError("Format file tidak didukung. Gunakan .csv, .xlsx, .xls, atau .pdf.", 400);
    }
```

Ganti dengan:

```typescript
    if (PDF_EXT.test(file.name)) {
      attachment = { fileName: file.name, kind: "pdf", data: buffer.toString("base64") };
    } else if (SPREADSHEET_EXT.test(file.name)) {
      try {
        const text = parseSpreadsheetToText(buffer, file.name);
        attachment = { fileName: file.name, kind: "text", data: text };
      } catch (err) {
        const message = err instanceof SpreadsheetParseError ? err.message : "Gagal membaca file.";
        throw new AuthError(message, 400);
      }
    } else if (IMAGE_EXT.test(file.name)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = IMAGE_MIME[ext] ?? "image/jpeg";
      attachment = { fileName: file.name, kind: "image", data: buffer.toString("base64"), mimeType };
    } else {
      throw new AuthError("Format file tidak didukung. Gunakan .csv, .xlsx, .xls, .pdf, atau gambar (jpg, png, gif, webp).", 400);
    }
```

- [ ] **Step 3: Verifikasi TypeScript tidak error**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

Expected: Tidak ada error baru.

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/assistant/financial-chat/route.ts
git commit -m "feat: tambah deteksi dan pemrosesan file gambar di financial-chat API"
```

---

### Task 3: Perbarui `FinancialAssistantChat.tsx` — input gambar, preview gambar, dan chat area lebih besar

**Files:**
- Modify: `src/components/financial/FinancialAssistantChat.tsx`

**Interfaces:**
- Consumes: Tidak ada perubahan props
- Produces: UI chatbot yang mendukung attachment gambar dengan preview inline

- [ ] **Step 1: Perbarui konstanta ACCEPT dan tambah state `pendingImageUrl`**

Cari baris:

```typescript
const ACCEPT = ".csv,.xlsx,.xls,.pdf";
```

Ganti dengan:

```typescript
const ACCEPT = ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.webp";
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
```

Setelah baris `const [fileError, setFileError] = useState("");`, tambahkan:

```typescript
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Perbarui fungsi `pickFile` agar buat object URL untuk gambar**

Cari fungsi `pickFile`:

```typescript
  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Ukuran file maksimal 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingFile(file);
  }
```

Ganti dengan:

```typescript
  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Ukuran file maksimal 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    if (IMAGE_EXT_RE.test(file.name)) {
      setPendingImageUrl(URL.createObjectURL(file));
    } else {
      setPendingImageUrl(null);
    }
    setPendingFile(file);
  }
```

- [ ] **Step 3: Bersihkan object URL saat file dibatalkan**

Cari tombol X untuk hapus pending file:

```typescript
          <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
```

Ganti dengan:

```typescript
          <button onClick={() => { if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl); setPendingImageUrl(null); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
```

Juga di fungsi `send`, setelah `const fileToSend = pendingFile;` dan `setPendingFile(null);`, tambahkan:

```typescript
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImageUrl(null);
```

- [ ] **Step 4: Tambah interface `DisplayMessage` field `attachmentImageUrl` dan set saat send**

Cari interface:

```typescript
interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  attachmentName?: string;
}
```

Ganti dengan:

```typescript
interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  attachmentName?: string;
  attachmentImageUrl?: string; // object URL untuk preview gambar (hanya sisi client)
}
```

Di fungsi `send`, cari:

```typescript
    const userMsg: DisplayMessage = { role: "user", content, attachmentName: pendingFile?.name };
```

Ganti dengan:

```typescript
    const userMsg: DisplayMessage = {
      role: "user",
      content,
      attachmentName: pendingFile?.name,
      attachmentImageUrl: pendingImageUrl ?? undefined,
    };
```

- [ ] **Step 5: Tampilkan preview gambar pada bubble pesan user**

Cari blok render attachment di dalam `messages.map`:

```typescript
              {m.attachmentName && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Paperclip className="h-3 w-3" /> {m.attachmentName}
                </span>
              )}
```

Ganti dengan:

```typescript
              {m.attachmentImageUrl ? (
                <div className="mb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.attachmentImageUrl}
                    alt={m.attachmentName ?? "gambar"}
                    className="max-h-48 max-w-xs rounded-xl object-contain border border-slate-200 dark:border-slate-600"
                  />
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Paperclip className="h-3 w-3" /> {m.attachmentName}
                  </span>
                </div>
              ) : m.attachmentName ? (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Paperclip className="h-3 w-3" /> {m.attachmentName}
                </span>
              ) : null}
```

- [ ] **Step 6: Tampilkan preview gambar pada `pendingFile` bar dan perbesar chat area**

Cari blok pending file display:

```typescript
      {pendingFile && (
        <div className="mx-5 mb-2 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {pendingFile.name}</span>
          <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
```

Ganti dengan:

```typescript
      {pendingFile && (
        <div className="mx-5 mb-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          {pendingImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pendingImageUrl}
              alt={pendingFile.name}
              className="mb-2 max-h-32 max-w-full rounded-lg object-contain"
            />
          )}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {pendingFile.name}</span>
            <button onClick={() => { if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl); setPendingImageUrl(null); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 7: Perbesar chat area dan ganti ikon Paperclip tooltip**

Cari:

```typescript
      <div className="max-h-[26rem] min-h-[12rem] space-y-3 overflow-y-auto p-5">
```

Ganti dengan:

```typescript
      <div className="max-h-[60vh] min-h-[20rem] space-y-3 overflow-y-auto p-5">
```

Cari title tooltip attachment:

```typescript
          <label className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-600" title="Lampirkan file Excel/CSV/PDF">
```

Ganti dengan:

```typescript
          <label className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-600" title="Lampirkan file (Excel/CSV/PDF/Gambar)">
```

- [ ] **Step 8: Verifikasi TypeScript tidak error**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

Expected: Tidak ada error.

- [ ] **Step 9: Commit**

```powershell
git add src/components/financial/FinancialAssistantChat.tsx
git commit -m "feat: tambah input gambar dan preview pada chatbot keuangan, perbesar chat area"
```

---

### Task 4: Hapus card upload Excel dan perbarui header di `FinancialClient.tsx`

**Files:**
- Modify: `src/components/financial/FinancialClient.tsx`

**Interfaces:**
- Tidak ada perubahan interface/props

- [ ] **Step 1: Perbarui PageHeader**

Cari:

```typescript
      <PageHeader
        title="Impor Data Keuangan (AI)"
        subtitle="Unggah file Excel/CSV berisi data keuangan — AI akan membaca dan mengekstraknya secara otomatis menjadi data transaksi terstruktur."
      />
```

Ganti dengan:

```typescript
      <PageHeader
        title="Asisten Keuangan AI"
        subtitle="Chat dengan AI untuk menyimpan transaksi, membandingkan data keuangan, atau menganalisis file dan gambar."
      />
```

- [ ] **Step 2: Hapus card upload Excel**

Hapus seluruh blok berikut (kondisi `canUpload` dengan Card upload, baris 141–171):

```typescript
      {canUpload && (
        <Card className="mb-6">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-6 py-10 text-center">
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Membaca &amp; mengekstrak data dengan AI... ini bisa memakan waktu hingga sekitar 1 menit.
                </p>
              </>
            ) : (
              <>
                <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">Unggah file Excel (.xlsx/.xls) atau CSV</p>
                  <p className="mt-1 text-xs text-slate-400">Maks. 5MB. Data akan dibaca &amp; dikategorikan otomatis oleh AI.</p>
                </div>
                <label className="btn-primary cursor-pointer">
                  <Sparkles className="h-4 w-4" /> Pilih File &amp; Ekstrak
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>
              </>
            )}
          </div>
          {uploadError && (
            <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{uploadError}</div>
          )}
        </Card>
      )}
```

- [ ] **Step 3: Bersihkan state dan ref yang tidak lagi digunakan**

Hapus state dan ref berikut dari function `FinancialClient`:

```typescript
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
```

Hapus juga fungsi `handleFileChange` secara keseluruhan:

```typescript
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/financial/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal memproses file");
      setSelected(data as ImportDetail);
      await loadHistory();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gagal memproses file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
```

- [ ] **Step 4: Bersihkan import yang tidak lagi digunakan**

Cari baris import:

```typescript
import { FileSpreadsheet, GitCompareArrows, Loader2, Sparkles, TrendingDown, TrendingUp, Trash2, Upload, Wallet } from "lucide-react";
```

Ganti dengan (hapus `Sparkles` dan `Upload`):

```typescript
import { FileSpreadsheet, GitCompareArrows, Loader2, TrendingDown, TrendingUp, Trash2, Wallet } from "lucide-react";
```

- [ ] **Step 5: Verifikasi TypeScript tidak error**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

Expected: Tidak ada error.

- [ ] **Step 6: Commit**

```powershell
git add src/components/financial/FinancialClient.tsx
git commit -m "feat: ubah halaman keuangan menjadi halaman chatbot, hapus card upload Excel"
```

---

### Task 5: Build dan verifikasi final

- [ ] **Step 1: Build Next.js**

```powershell
npx next build 2>&1 | Select-Object -Last 20
```

Expected: Build berhasil tanpa error. Warning TypeScript/ESLint ringan bisa diabaikan selama tidak ada build failure.

- [ ] **Step 2: Jalankan dev server dan cek manual**

```powershell
npx next dev
```

Buka `http://localhost:3000` dan navigasi ke halaman Keuangan. Verifikasi:
- Header menampilkan "Asisten Keuangan AI"
- Tidak ada card drag-and-drop upload Excel
- Chatbot langsung terlihat dengan area chat yang lebih besar
- Icon paperclip tooltip berubah
- Upload gambar (jpg/png) lewat paperclip → preview muncul di pending area
- Kirim gambar → gambar tampil sebagai bubble pesan user
- Riwayat Impor dan Riwayat Komparasi masih muncul di bawah
- Fitur hapus impor dan komparasi masih berfungsi

- [ ] **Step 3: Commit final jika ada tweak**

```powershell
git add -A
git commit -m "fix: tweak UI chatbot keuangan setelah verifikasi manual"
```
