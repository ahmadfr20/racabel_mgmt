import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import { parseSpreadsheetToText, SpreadsheetParseError } from "@/lib/spreadsheet";
import { extractFinancialDataFromSpreadsheet } from "@/lib/anthropic";

const ALLOWED_EXT = /\.(csv|xlsx|xls)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Riwayat impor keuangan (ringkas, tanpa detail transaksi per baris).
export const GET = handle(async () => {
  await requirePermission("financial.view");
  const imports = await prisma.financialImport.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { fullName: true } },
      _count: { select: { transactions: true } },
    },
  });
  return ok(
    imports.map((i) => ({
      id: i.id,
      fileName: i.fileName,
      status: i.status,
      currency: i.currency,
      totalIncome: i.totalIncome,
      totalExpense: i.totalExpense,
      aiNotes: i.aiNotes,
      errorMessage: i.errorMessage,
      transactionCount: i._count.transactions,
      uploadedByName: i.uploadedBy.fullName,
      createdAt: i.createdAt,
    }))
  );
});

// Upload file Excel/CSV -> parse -> ekstrak via AI -> simpan sebagai FinancialImport.
export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("financial.upload");

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AuthError("File tidak ditemukan pada permintaan.", 400);
  }
  if (!ALLOWED_EXT.test(file.name)) {
    throw new AuthError("Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls.", 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AuthError("Ukuran file maksimal 5MB.", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let spreadsheetText: string;
  try {
    spreadsheetText = parseSpreadsheetToText(buffer, file.name);
  } catch (err) {
    const message = err instanceof SpreadsheetParseError ? err.message : "Gagal membaca file.";
    throw new AuthError(message, 400);
  }

  try {
    const extraction = await extractFinancialDataFromSpreadsheet(spreadsheetText, file.name);

    const created = await prisma.financialImport.create({
      data: {
        fileName: file.name,
        uploadedById: user.id,
        status: "COMPLETED",
        currency: extraction.currency || "IDR",
        totalIncome: extraction.summary.totalIncome,
        totalExpense: extraction.summary.totalExpense,
        aiNotes: extraction.summary.notes,
        transactions: {
          create: extraction.transactions.map((t) => ({
            date: toDateOrToday(t.date),
            description: t.description,
            category: t.category,
            type: t.type,
            amount: t.amount,
            notes: t.notes,
          })),
        },
      },
      include: {
        transactions: { orderBy: { date: "asc" } },
        uploadedBy: { select: { fullName: true } },
      },
    });

    return ok(created, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengekstrak data keuangan.";
    await prisma.financialImport.create({
      data: {
        fileName: file.name,
        uploadedById: user.id,
        status: "FAILED",
        errorMessage: message,
      },
    });
    throw new AuthError(message, 400);
  }
});

function toDateOrToday(value: string): Date {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
