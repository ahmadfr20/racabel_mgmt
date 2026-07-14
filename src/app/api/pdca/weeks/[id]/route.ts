import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

// PATCH: ubah judul/periode minggu PDCA. Butuh pdca.manage.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("pdca.manage");
  const { id } = await ctx.params;
  const data = updateSchema.parse(await req.json());

  await prisma.pdcaWeek.update({
    where: { id: Number(id) },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
    },
  });
  return ok({ success: true });
});

// DELETE: hapus minggu PDCA beserta seluruh task di dalamnya. Butuh pdca.manage.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("pdca.manage");
  const { id } = await ctx.params;
  await prisma.pdcaWeek.delete({ where: { id: Number(id) } });
  return ok({ success: true });
});
