import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CurrentUser } from "./auth";
import { currentPeriod } from "./performance";
import { toolsForUser } from "./assistantTools";
import { financialToolsForUser } from "./financialAssistantTools";

// Singleton client — dibuat lazy agar error "API key belum diatur" muncul saat
// fitur benar-benar dipakai, bukan saat aplikasi start.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY belum diatur. Tambahkan API key Anthropic ke file .env untuk memakai fitur impor keuangan AI."
    );
  }
  if (!client) client = new Anthropic();
  return client;
}

// Skema JSON yang dipaksakan ke output model (structured outputs) — mengikuti
// batasan Claude structured outputs: tipe dasar saja, additionalProperties: false,
// dan semua properti wajib ada di "required" (yang opsional dibuat nullable).
const FINANCIAL_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    currency: { type: "string" },
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          type: { type: "string", enum: ["INCOME", "EXPENSE"] },
          amount: { type: "number" },
          notes: { type: ["string", "null"] },
        },
        required: ["date", "description", "category", "type", "amount", "notes"],
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        totalIncome: { type: "number" },
        totalExpense: { type: "number" },
        notes: { type: ["string", "null"] },
      },
      required: ["totalIncome", "totalExpense", "notes"],
    },
  },
  required: ["currency", "transactions", "summary"],
} as const;

// Skema Zod untuk validasi ulang di sisi kita (defense-in-depth) + tipe TypeScript.
export const FinancialTransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  category: z.string(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number(),
  notes: z.string().nullable(),
});

export const FinancialExtractionSchema = z.object({
  currency: z.string(),
  transactions: z.array(FinancialTransactionSchema),
  summary: z.object({
    totalIncome: z.number(),
    totalExpense: z.number(),
    notes: z.string().nullable(),
  }),
});

export type FinancialExtractionResult = z.infer<typeof FinancialExtractionSchema>;

const SYSTEM_PROMPT = `Anda adalah asisten akuntansi yang mengekstrak data transaksi keuangan dari isi file spreadsheet (Excel/CSV) milik sebuah perusahaan di Indonesia.

Tugas Anda:
- Baca isi file yang diberikan (format CSV per sheet) dan identifikasi setiap baris yang merupakan transaksi keuangan (pemasukan atau pengeluaran).
- Untuk setiap transaksi, tentukan: tanggal (format YYYY-MM-DD; jika tahun tidak disebutkan, gunakan tahun berjalan; jika tanggal benar-benar tidak ada, gunakan tanggal terdekat yang tersedia di file), deskripsi singkat, kategori (contoh: Gaji, Operasional, Sewa, Marketing, Penjualan, Pembelian Stok, Utilitas, Lainnya — boleh menyimpulkan dari konteks jika tidak eksplisit), jenis (INCOME jika pemasukan/pendapatan, EXPENSE jika pengeluaran/biaya), dan nominal (selalu angka positif, tanpa simbol mata uang atau pemisah ribuan).
- Tentukan mata uang (currency) dalam kode ISO 4217. Jika tidak jelas, asumsikan IDR karena konteks perusahaan Indonesia.
- JANGAN mengarang transaksi yang tidak ada di data. Hanya ekstrak apa yang benar-benar tertulis.
- Lewati baris header, subtotal, atau catatan yang bukan transaksi individual.
- Jika ada baris yang ambigu atau tidak bisa dipastikan jenis/nominalnya, tetap sertakan interpretasi terbaik Anda dan jelaskan keraguan tersebut secara ringkas di field "notes" pada summary.
- Hitung totalIncome (jumlah semua transaksi INCOME) dan totalExpense (jumlah semua transaksi EXPENSE) berdasarkan transaksi yang Anda ekstrak.

Kembalikan hasil sesuai skema JSON yang diberikan.`;

export async function extractFinancialDataFromSpreadsheet(
  spreadsheetText: string,
  fileName: string
): Promise<FinancialExtractionResult> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: FINANCIAL_EXTRACTION_JSON_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Nama file: ${fileName}\n\nIsi file:\n\n${spreadsheetText}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Permintaan ditolak oleh sistem keamanan AI. Periksa kembali isi file yang diunggah.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Data terlalu banyak untuk diproses sekaligus. Coba pecah file menjadi beberapa bagian yang lebih kecil."
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI tidak mengembalikan hasil ekstraksi yang valid.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Gagal membaca hasil ekstraksi AI (format JSON tidak valid).");
  }

  const result = FinancialExtractionSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error("Hasil ekstraksi AI tidak sesuai format yang diharapkan.");
  }
  return result.data;
}

// ============ Asisten AI (chatbot) — PDCA, Task Log, Kinerja ============

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(user: CurrentUser, toolNames: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Anda adalah Asisten AI internal pada aplikasi "Racabel HQ Management" (sistem HR & operasional perusahaan). Anda TIDAK hanya menjawab — Anda dapat MELAKUKAN aksi di aplikasi melalui tools yang tersedia.

Konteks pengguna saat ini:
- Nama: ${user.fullName} (id: ${user.id})
- Role: ${user.role.name}${user.department ? ` · Department: ${user.department.name}` : ""}
- Tanggal hari ini: ${today}
- Periode kinerja berjalan: ${currentPeriod()}

Kemampuan Anda (tergantung hak akses pengguna). Tools yang tersedia untuk pengguna ini: ${toolNames.length ? toolNames.join(", ") : "(tidak ada — hanya bisa menjelaskan konsep)"}.
Secara umum Anda dapat: mencatat Task Log harian, mengelola PDCA (checklist mingguan: buat "Week" dengan periode tanggal, tambahkan task berisi judul + PIC ke dalamnya, dan tandai task selesai/belum), serta mencatat/menghitung kinerja (skor KPI berbobot dan estimasi tunjangan/gaji).

Format PDCA sekarang SEDERHANA (bukan lagi tahapan Plan-Do-Check-Act per item): satu "minggu" (mis. "Week 1", dengan periode tanggal opsional) berisi daftar task, tiap task punya judul, satu PIC (penanggung jawab), dan status Selesai/Belum Selesai. Alur biasa: create_pdca_week dulu (atau pakai list_pdca_weeks untuk minggu yang sudah ada), lalu add_pdca_task untuk tiap task, lalu update_pdca_task_status untuk menandai kemajuan.

Pedoman:
- Gunakan tools untuk benar-benar membuat/mengubah data ketika pengguna memintanya (mis. "catat task log saya hari ini: ...", "buatkan PDCA Week 1 dengan task ...", "nilai kinerja Budi bulan ini: produktivitas 85, ..."). Jangan hanya menjelaskan cara manualnya jika Anda bisa melakukannya.
- Untuk menugaskan PIC pada task PDCA atau mencatat kinerja karyawan LAIN, cari id-nya dulu dengan list_employees. Untuk skor kinerja, ambil id metrik dengan list_kpi_metrics terlebih dahulu.
- Bila informasi kurang (mis. judul task log belum jelas), tanyakan singkat sebelum bertindak. Jangan mengarang nilai.
- Skor kinerja MEMENGARUHI tunjangan & gaji — untuk perubahan kinerja, tegaskan ringkas apa yang akan/ sudah Anda catat, lalu tampilkan skor berbobot terbaru.
- Setelah melakukan aksi, konfirmasikan dengan ringkas & spesifik (mis. sebutkan judul, tanggal, atau id yang dibuat).
- Jika tool mengembalikan error, jelaskan masalahnya ke pengguna dengan bahasa yang mudah.
- Jawab dalam Bahasa Indonesia, singkat, jelas, dan praktis. Anda bukan pembuat keputusan final — Anda alat bantu.`;
}

const MAX_TOOL_ITERATIONS = 6;

export async function sendAssistantChat(messages: ChatMessage[], user: CurrentUser): Promise<string> {
  const anthropic = getClient();
  const { defs, map } = toolsForUser(user);
  const system = buildSystemPrompt(user, [...map.keys()]);

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools: defs,
      messages: convo,
    });

    if (response.stop_reason === "refusal") {
      return "Maaf, saya tidak dapat membantu permintaan ini karena kebijakan keamanan.";
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "Maaf, terjadi kesalahan saat menghasilkan balasan. Coba lagi.";
    }

    // Simpan giliran asisten (termasuk blok thinking & tool_use) apa adanya.
    convo.push({ role: "assistant", content: response.content });

    // Jalankan semua tool yang diminta, kembalikan seluruh hasil dalam SATU pesan user.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const tool = map.get(tu.name);
      let res;
      if (!tool) {
        res = { content: JSON.stringify({ error: `Tool ${tu.name} tidak tersedia` }), isError: true };
      } else {
        try {
          res = await tool.run(tu.input, user);
        } catch (e) {
          res = { content: JSON.stringify({ error: e instanceof Error ? e.message : "Gagal menjalankan aksi" }), isError: true };
        }
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: res.content, is_error: res.isError });
    }
    convo.push({ role: "user", content: results });
  }

  return "Maaf, permintaan ini terlalu kompleks untuk saya selesaikan sekarang. Coba pecah menjadi langkah yang lebih kecil.";
}

// ============ Asisten Keuangan AI (chat di halaman Keuangan) ============
// Bisa menyimpan transaksi & hasil komparasi ke database, dan membaca file
// Excel/CSV (teks) atau PDF (dikirim langsung sebagai dokumen ke Claude).

export interface FinancialAttachment {
  fileName: string;
  kind: "pdf" | "text" | "image";
  data: string; // base64 untuk pdf/image, teks polos untuk kind "text"
  mimeType?: string; // wajib untuk kind "image", mis. "image/png"
}

function buildFinancialSystemPrompt(user: CurrentUser, toolNames: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Anda adalah Asisten Keuangan AI pada halaman Keuangan aplikasi "Racabel HQ Management". Anda dapat MELAKUKAN aksi nyata (bukan hanya menjawab): membaca file keuangan yang diunggah, menyimpan transaksi ke database, menghitung komparasi keuangan, dan menyimpan hasil komparasi tersebut ke database.

Konteks pengguna saat ini:
- Nama: ${user.fullName} (id: ${user.id})
- Tanggal hari ini: ${today}

Tools yang tersedia untuk pengguna ini: ${toolNames.length ? toolNames.join(", ") : "(tidak ada — hanya akses lihat terbatas)"}.

Pedoman:
- Bila pengguna melampirkan file (Excel/CSV/PDF), isinya sudah disertakan dalam pesan ini. Baca dan identifikasi transaksinya (tanggal, deskripsi, kategori, jenis pemasukan/pengeluaran, nominal). Jangan mengarang data yang tidak ada di file.
- Bila pengguna meminta menyimpan transaksi (dari chat maupun dari file yang diunggah), gunakan tool save_transactions. Beri judul riwayat yang jelas (mis. nama file, atau deskripsi ringkas bila input manual).
- Bila pengguna meminta perbandingan/komparasi (mis. "bandingkan bulan ini vs bulan lalu", atau "bandingkan file yang saya unggah dengan data bulan Juni"), gunakan get_financial_totals dan/atau get_financial_import_detail/list_financial_imports untuk mengumpulkan angka kedua sisi, lalu susun analisis singkat (kenaikan/penurunan, kemungkinan penyebab). Jika pengguna minta hasilnya disimpan, panggil save_financial_comparison dengan angka & analisis tersebut.
- Nominal selalu angka positif tanpa simbol mata uang. Asumsikan IDR bila mata uang tidak disebutkan.
- Jika informasi kurang jelas (mis. kategori tidak disebutkan), buat asumsi wajar dan sebutkan secara singkat, jangan bertanya berulang-ulang untuk hal kecil.
- Setelah menyimpan data, konfirmasikan ringkas & spesifik (jumlah transaksi, total pemasukan/pengeluaran, atau id yang dibuat).
- Jika tool mengembalikan error, jelaskan ke pengguna dengan bahasa yang mudah.
- Jawab dalam Bahasa Indonesia, singkat, jelas, dan berorientasi aksi.`;
}

export async function sendFinancialAssistantChat(
  messages: ChatMessage[],
  user: CurrentUser,
  attachment?: FinancialAttachment
): Promise<string> {
  const anthropic = getClient();
  const { defs, map } = financialToolsForUser(user);
  const system = buildFinancialSystemPrompt(user, [...map.keys()]);

  const lastUserIdx = messages.length - 1;
  const convo: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (attachment && i === lastUserIdx && m.role === "user") {
      let blocks: Anthropic.ContentBlockParam[];
      if (attachment.kind === "pdf") {
        blocks = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.data } }];
      } else if (attachment.kind === "image") {
        blocks = [{ type: "image", source: { type: "base64", media_type: attachment.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: attachment.data } }];
      } else {
        blocks = [{ type: "text", text: `Isi file terlampir (${attachment.fileName}):\n\n${attachment.data}` }];
      }
      if (m.content) blocks.push({ type: "text", text: m.content });
      return { role: "user", content: blocks };
    }
    return { role: m.role, content: m.content };
  });

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools: defs,
      messages: convo,
    });

    if (response.stop_reason === "refusal") {
      return "Maaf, saya tidak dapat membantu permintaan ini karena kebijakan keamanan.";
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "Maaf, terjadi kesalahan saat menghasilkan balasan. Coba lagi.";
    }

    convo.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const tool = map.get(tu.name);
      let res;
      if (!tool) {
        res = { content: JSON.stringify({ error: `Tool ${tu.name} tidak tersedia` }), isError: true };
      } else {
        try {
          res = await tool.run(tu.input, user);
        } catch (e) {
          res = { content: JSON.stringify({ error: e instanceof Error ? e.message : "Gagal menjalankan aksi" }), isError: true };
        }
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: res.content, is_error: res.isError });
    }
    convo.push({ role: "user", content: results });
  }

  return "Maaf, permintaan ini terlalu kompleks untuk saya selesaikan sekarang. Coba pecah menjadi langkah yang lebih kecil.";
}
