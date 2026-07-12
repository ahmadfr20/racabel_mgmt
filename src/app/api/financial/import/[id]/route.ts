import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// Detail 1 impor keuangan beserta seluruh transaksi hasil ekstraksi AI.
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("financial.view");
  const { id } = await ctx.params;
  const importId = Number(id);
  if (!Number.isInteger(importId)) throw new AuthError("ID tidak valid.", 400);

  const record = await prisma.financialImport.findUnique({
    where: { id: importId },
    include: {
      uploadedBy: { select: { fullName: true } },
      transactions: { orderBy: { date: "asc" } },
    },
  });
  if (!record) throw new AuthError("Data impor tidak ditemukan.", 404);
  return ok(record);
});

// Hapus riwayat impor (mis. hasil ekstraksi keliru) beserta transaksinya.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("financial.upload");
  const { id } = await ctx.params;
  const importId = Number(id);
  if (!Number.isInteger(importId)) throw new AuthError("ID tidak valid.", 400);

  await prisma.financialImport.delete({ where: { id: importId } });
  return ok({ success: true });
});
