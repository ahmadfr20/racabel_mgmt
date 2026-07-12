import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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

const ASSISTANT_SYSTEM_PROMPT = `Anda adalah Asisten AI internal pada aplikasi "Racabel HQ Management" (sistem HR & operasional perusahaan). Anda membantu karyawan seputar tiga hal:

1. Task Log — pencatatan pekerjaan harian (judul, deskripsi, status: Direncanakan/Dikerjakan/Selesai, durasi jam).
2. PDCA (Plan-Do-Check-Act) — metode manajemen perbaikan berkelanjutan: Plan (rencana), Do (pelaksanaan), Check (evaluasi hasil), Act (tindak lanjut).
3. Kinerja & Penggajian — skor KPI berbobot per periode dan bagaimana itu memengaruhi tunjangan kinerja & total gaji.

Jawab singkat, jelas, dan praktis dalam Bahasa Indonesia. Anda saat ini BELUM terhubung ke data aplikasi secara langsung (belum bisa membuat, mengubah, atau membaca data spesifik milik pengguna) — jika pengguna meminta Anda melakukan aksi seperti "buatkan task log" atau "ubah status PDCA saya", jelaskan bahwa Anda belum bisa melakukannya secara langsung dan arahkan mereka ke halaman terkait (Task Log, PDCA, atau Kinerja & Gaji) di aplikasi. Anda tetap bisa menjelaskan konsep, memberi contoh, dan membantu menyusun kalimat/rencana yang bisa mereka input sendiri.`;

export async function sendAssistantChat(messages: ChatMessage[]): Promise<string> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: ASSISTANT_SYSTEM_PROMPT,
    messages,
  });

  if (response.stop_reason === "refusal") {
    return "Maaf, saya tidak dapat membantu permintaan ini karena kebijakan keamanan.";
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return "Maaf, terjadi kesalahan saat menghasilkan balasan. Coba lagi.";
  }
  return textBlock.text;
}
