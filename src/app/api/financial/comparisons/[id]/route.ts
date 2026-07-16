import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

const patchSchema = z.object({ visibility: z.enum(["PRIVATE", "EVERYONE"]) });

// Ubah visibilitas riwayat komparasi — hanya pemilik yang boleh mengubah.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission("financial.upload");
  const { id } = await ctx.params;
  const comparisonId = Number(id);
  if (!Number.isInteger(comparisonId)) throw new AuthError("ID tidak valid.", 400);
  const { visibility } = patchSchema.parse(await req.json());

  const record = await prisma.financialComparison.findUnique({ where: { id: comparisonId } });
  if (!record) throw new AuthError("Data komparasi tidak ditemukan.", 404);
  if (record.createdById !== user.id) throw new AuthError("Hanya pemilik data yang dapat mengubah visibilitasnya.", 403);

  await prisma.financialComparison.update({ where: { id: comparisonId }, data: { visibility } });
  return ok({ success: true });
});

// Hapus satu riwayat komparasi keuangan — hanya pemilik.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requirePermission("financial.upload");
  const { id } = await ctx.params;
  const comparisonId = Number(id);
  if (!Number.isInteger(comparisonId)) throw new AuthError("ID tidak valid.", 400);

  const record = await prisma.financialComparison.findUnique({ where: { id: comparisonId } });
  if (!record) throw new AuthError("Data komparasi tidak ditemukan.", 404);
  if (record.createdById !== user.id) throw new AuthError("Hanya pemilik data yang dapat menghapusnya.", 403);

  await prisma.financialComparison.delete({ where: { id: comparisonId } });
  return ok({ success: true });
});
