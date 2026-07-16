import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  weight: z.coerce.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

// Metrik otomatis (isAuto) hanya boleh diubah bobot & status aktifnya — nama/deskripsi/sumber
// terkait perhitungan otomatis dan tidak boleh diubah lewat form manual.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("payroll.manage");
  const id = Number((await ctx.params).id);
  const data = schema.parse(await req.json());

  const metric = await prisma.kpiMetric.findUnique({ where: { id } });
  if (!metric) throw new AuthError("KPI tidak ditemukan", 404);

  const patch = metric.isAuto ? { weight: data.weight, active: data.active } : data;
  await prisma.kpiMetric.update({ where: { id }, data: patch });
  return ok({ success: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("payroll.manage");
  const id = Number((await ctx.params).id);

  const metric = await prisma.kpiMetric.findUnique({ where: { id } });
  if (!metric) throw new AuthError("KPI tidak ditemukan", 404);
  if (metric.isAuto) throw new AuthError("Metrik otomatis tidak dapat dihapus, hanya bobot yang dapat diubah.", 400);

  await prisma.kpiMetric.delete({ where: { id } });
  return ok({ success: true });
});
