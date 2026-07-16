// Tools (function calling) untuk Asisten Keuangan AI di halaman Keuangan.
// Memungkinkan AI benar-benar MENYIMPAN data keuangan & hasil komparasi ke
// database, bukan sekadar menjawab. Setiap tool memeriksa permission
// (defense-in-depth) dan hanya diekspos bila pengguna berwenang.

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import type { CurrentUser } from "./auth";

export type ToolResult = { content: string; isError?: boolean };
export interface AssistantTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  available: (u: CurrentUser) => boolean;
  run: (input: unknown, user: CurrentUser) => Promise<ToolResult>;
}

const ok = (data: unknown): ToolResult => ({ content: JSON.stringify(data) });
const err = (message: string): ToolResult => ({ content: JSON.stringify({ error: message }), isError: true });

function parseDate(s?: string | null): Date {
  const d = s ? new Date(s) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

// ============ Tool: daftar riwayat data keuangan tersimpan ============
const listFinancialImports: AssistantTool = {
  name: "list_financial_imports",
  description:
    "Lihat daftar riwayat data keuangan tersimpan (id, nama, total pemasukan/pengeluaran, jumlah transaksi, visibilitas, tanggal dibuat). Hanya menampilkan data milik pengguna sendiri, ditambah data orang lain yang visibilitasnya 'EVERYONE'. Gunakan untuk menemukan id data yang ingin dilihat detail atau dibandingkan.",
  input_schema: { type: "object", properties: {} },
  available: (u) => u.permissions.includes("financial.view"),
  run: async (_input, user) => {
    const rows = await prisma.financialImport.findMany({
      where: { status: "COMPLETED", OR: [{ uploadedById: user.id }, { visibility: "EVERYONE" }] },
      include: { _count: { select: { transactions: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        title: r.fileName,
        totalIncome: r.totalIncome,
        totalExpense: r.totalExpense,
        transactionCount: r._count.transactions,
        visibility: r.visibility,
        isOwner: r.uploadedById === user.id,
        createdAt: r.createdAt,
      }))
    );
  },
};

// ============ Tool: detail transaksi 1 data keuangan ============
const getFinancialImportDetail: AssistantTool = {
  name: "get_financial_import_detail",
  description: "Lihat detail transaksi (tanggal, deskripsi, kategori, jenis, nominal) dari satu data keuangan berdasarkan id. Hanya bisa diakses bila milik sendiri atau visibilitasnya 'EVERYONE'.",
  input_schema: {
    type: "object",
    properties: { importId: { type: "number", description: "Id data keuangan (dari list_financial_imports)" } },
    required: ["importId"],
  },
  available: (u) => u.permissions.includes("financial.view"),
  run: async (input, user) => {
    const { importId } = z.object({ importId: z.number().int().positive() }).parse(input);
    const record = await prisma.financialImport.findUnique({
      where: { id: importId },
      include: { transactions: { orderBy: { date: "asc" } } },
    });
    if (!record) return err(`Data keuangan id ${importId} tidak ditemukan`);
    if (record.uploadedById !== user.id && record.visibility !== "EVERYONE") {
      return err(`Data keuangan id ${importId} bersifat privat milik pengguna lain, tidak dapat diakses`);
    }
    return ok({
      id: record.id,
      title: record.fileName,
      totalIncome: record.totalIncome,
      totalExpense: record.totalExpense,
      visibility: record.visibility,
      transactions: record.transactions.map((t) => ({
        date: t.date, description: t.description, category: t.category, type: t.type, amount: t.amount,
      })),
    });
  },
};

// ============ Tool: total pemasukan/pengeluaran (agregat, opsional filter tanggal/kategori) ============
const getFinancialTotals: AssistantTool = {
  name: "get_financial_totals",
  description:
    "Hitung total pemasukan & pengeluaran dari transaksi keuangan yang dapat diakses pengguna (miliknya sendiri + yang visibilitasnya 'EVERYONE'), opsional difilter rentang tanggal dan/atau kategori. Berguna untuk analisis/komparasi periode tanpa perlu tahu id data spesifik terlebih dahulu (mis. bandingkan 'bulan ini' vs 'bulan lalu').",
  input_schema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Tanggal mulai YYYY-MM-DD (opsional)" },
      to: { type: "string", description: "Tanggal akhir YYYY-MM-DD (opsional)" },
      category: { type: "string", description: "Filter kategori (opsional)" },
    },
  },
  available: (u) => u.permissions.includes("financial.view"),
  run: async (input, user) => {
    const { from, to, category } = z
      .object({ from: z.string().optional(), to: z.string().optional(), category: z.string().optional() })
      .parse(input ?? {});
    const where = {
      import: { OR: [{ uploadedById: user.id }, { visibility: "EVERYONE" as const }] },
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(category ? { category: { contains: category } } : {}),
    };
    const rows = await prisma.financialTransaction.findMany({ where, select: { type: true, amount: true, category: true } });
    const totalIncome = rows.filter((r) => r.type === "INCOME").reduce((s, r) => s + r.amount, 0);
    const totalExpense = rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + r.amount, 0);
    const byCategory = new Map<string, { income: number; expense: number }>();
    for (const r of rows) {
      const c = byCategory.get(r.category) ?? { income: 0, expense: 0 };
      if (r.type === "INCOME") c.income += r.amount; else c.expense += r.amount;
      byCategory.set(r.category, c);
    }
    return ok({
      range: { from: from ?? null, to: to ?? null, category: category ?? null },
      transactionCount: rows.length,
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      byCategory: Object.fromEntries(byCategory),
    });
  },
};

// ============ Tool: simpan transaksi keuangan baru ke database ============
const saveTransactions: AssistantTool = {
  name: "save_transactions",
  description:
    "Simpan satu atau lebih transaksi keuangan baru ke database — baik yang disebutkan pengguna langsung di chat, maupun hasil ekstraksi dari file (Excel/CSV/PDF) yang diunggah pengguna. Membuat satu entri riwayat baru dengan judul yang diberikan.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Judul/nama riwayat, mis. nama file asal atau deskripsi ringkas (\"Input manual - biaya operasional Juli\")" },
      currency: { type: "string", description: "Kode mata uang ISO 4217, default IDR" },
      notes: { type: "string", description: "Catatan ringkas (opsional), mis. ambiguitas atau asumsi yang diambil" },
      visibility: {
        type: "string",
        enum: ["PRIVATE", "EVERYONE"],
        description: "Siapa yang boleh melihat data ini. PRIVATE (default) = hanya pengguna ini sendiri. EVERYONE = semua pengguna yang punya akses lihat keuangan. Default PRIVATE kecuali pengguna secara eksplisit minta dibagikan/terlihat semua orang.",
      },
      transactions: {
        type: "array",
        description: "Daftar transaksi yang akan disimpan",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "Tanggal YYYY-MM-DD" },
            description: { type: "string", description: "Deskripsi transaksi" },
            category: { type: "string", description: "Kategori, mis. Operasional/Gaji/Penjualan" },
            type: { type: "string", enum: ["INCOME", "EXPENSE"] },
            amount: { type: "number", description: "Nominal (angka positif, tanpa simbol mata uang)" },
            notes: { type: "string", description: "Catatan opsional per transaksi" },
          },
          required: ["date", "description", "category", "type", "amount"],
        },
      },
    },
    required: ["title", "transactions"],
  },
  available: (u) => u.permissions.includes("financial.upload"),
  run: async (input, user) => {
    const d = z
      .object({
        title: z.string().min(1),
        currency: z.string().optional(),
        notes: z.string().optional(),
        visibility: z.enum(["PRIVATE", "EVERYONE"]).default("PRIVATE"),
        transactions: z
          .array(
            z.object({
              date: z.string(),
              description: z.string().min(1),
              category: z.string().min(1),
              type: z.enum(["INCOME", "EXPENSE"]),
              amount: z.number().positive(),
              notes: z.string().optional(),
            })
          )
          .min(1, "Minimal 1 transaksi"),
      })
      .parse(input);

    const totalIncome = d.transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
    const totalExpense = d.transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

    const created = await prisma.financialImport.create({
      data: {
        fileName: d.title,
        uploadedById: user.id,
        status: "COMPLETED",
        visibility: d.visibility,
        currency: d.currency || "IDR",
        totalIncome,
        totalExpense,
        aiNotes: d.notes || "Disimpan melalui Asisten Keuangan AI (chat).",
        transactions: {
          create: d.transactions.map((t) => ({
            date: parseDate(t.date),
            description: t.description,
            category: t.category,
            type: t.type,
            amount: t.amount,
            notes: t.notes || null,
          })),
        },
      },
    });
    return ok({
      message: "Transaksi keuangan berhasil disimpan",
      id: created.id,
      title: created.fileName,
      transactionCount: d.transactions.length,
      totalIncome,
      totalExpense,
      visibility: created.visibility,
    });
  },
};

// ============ Tool: simpan hasil komparasi keuangan ============
const saveFinancialComparison: AssistantTool = {
  name: "save_financial_comparison",
  description:
    "Simpan hasil analisis komparasi keuangan (mis. antar dua periode, atau antar dua data impor) ke database agar dapat dilihat kembali di halaman Keuangan. Panggil setelah Anda menghitung/menganalisis perbandingan (mis. via get_financial_totals atau get_financial_import_detail dua kali).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Judul komparasi, mis. \"Juni vs Juli 2026\"" },
      scopeALabel: { type: "string", description: "Label ruang lingkup A, mis. \"Juni 2026\" atau nama data impor" },
      scopeBLabel: { type: "string", description: "Label ruang lingkup B" },
      totalIncomeA: { type: "number" },
      totalExpenseA: { type: "number" },
      totalIncomeB: { type: "number" },
      totalExpenseB: { type: "number" },
      analysis: { type: "string", description: "Ringkasan/insight komparasi dalam Bahasa Indonesia (mis. kenaikan/penurunan, penyebab, rekomendasi)" },
      visibility: {
        type: "string",
        enum: ["PRIVATE", "EVERYONE"],
        description: "Siapa yang boleh melihat hasil komparasi ini. PRIVATE (default) = hanya pengguna ini sendiri. EVERYONE = semua pengguna yang punya akses lihat keuangan.",
      },
    },
    required: ["title", "scopeALabel", "scopeBLabel", "totalIncomeA", "totalExpenseA", "totalIncomeB", "totalExpenseB", "analysis"],
  },
  available: (u) => u.permissions.includes("financial.upload"),
  run: async (input, user) => {
    const d = z
      .object({
        title: z.string().min(1),
        scopeALabel: z.string().min(1),
        scopeBLabel: z.string().min(1),
        totalIncomeA: z.number(),
        totalExpenseA: z.number(),
        totalIncomeB: z.number(),
        totalExpenseB: z.number(),
        analysis: z.string().min(1),
        visibility: z.enum(["PRIVATE", "EVERYONE"]).default("PRIVATE"),
      })
      .parse(input);
    const created = await prisma.financialComparison.create({
      data: { ...d, createdById: user.id },
    });
    return ok({ message: "Hasil komparasi keuangan tersimpan", id: created.id, title: created.title, visibility: created.visibility });
  },
};

export const FINANCIAL_ASSISTANT_TOOLS: AssistantTool[] = [
  listFinancialImports,
  getFinancialImportDetail,
  getFinancialTotals,
  saveTransactions,
  saveFinancialComparison,
];

export function financialToolsForUser(user: CurrentUser): { defs: Anthropic.Tool[]; map: Map<string, AssistantTool> } {
  const available = FINANCIAL_ASSISTANT_TOOLS.filter((t) => t.available(user));
  return {
    defs: available.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    map: new Map(available.map((t) => [t.name, t])),
  };
}
