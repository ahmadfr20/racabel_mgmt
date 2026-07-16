import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// Detail 1 impor keuangan beserta seluruh transaksi hasil ekstraksi AI.
// Hanya bisa diakses pemilik, atau siapa pun bila visibility-nya EVERYONE.
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission("financial.view");
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
  if (record.uploadedById !== user.id && record.visibility !== "EVERYONE") {
    throw new AuthError("Data ini bersifat privat milik pengguna lain.", 403);
  }
  return ok({ ...record, isOwner: record.uploadedById === user.id });
});

const patchSchema = z.object({ visibility: z.enum(["PRIVATE", "EVERYONE"]) });

// Ubah visibilitas riwayat impor — hanya pemilik yang boleh mengubah.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission("financial.upload");
  const { id } = await ctx.params;
  const importId = Number(id);
  if (!Number.isInteger(importId)) throw new AuthError("ID tidak valid.", 400);
  const { visibility } = patchSchema.parse(await req.json());

  const record = await prisma.financialImport.findUnique({ where: { id: importId } });
  if (!record) throw new AuthError("Data impor tidak ditemukan.", 404);
  if (record.uploadedById !== user.id) throw new AuthError("Hanya pemilik data yang dapat mengubah visibilitasnya.", 403);

  await prisma.financialImport.update({ where: { id: importId }, data: { visibility } });
  return ok({ success: true });
});

// Hapus riwayat impor (mis. hasil ekstraksi keliru) beserta transaksinya — hanya pemilik.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission("financial.upload");
  const { id } = await ctx.params;
  const importId = Number(id);
  if (!Number.isInteger(importId)) throw new AuthError("ID tidak valid.", 400);

  const record = await prisma.financialImport.findUnique({ where: { id: importId } });
  if (!record) throw new AuthError("Data impor tidak ditemukan.", 404);
  if (record.uploadedById !== user.id) throw new AuthError("Hanya pemilik data yang dapat menghapusnya.", 403);

  await prisma.financialImport.delete({ where: { id: importId } });
  return ok({ success: true });
});
