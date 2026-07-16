import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

// PATCH: ubah judul/department/periode minggu PDCA. Butuh pdca.manage.
// Department hanya bisa diubah selama minggu belum punya task (agar tidak menyisakan
// task dengan PIC dari department lama yang sudah tidak sesuai).
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("pdca.manage");
  const { id } = await ctx.params;
  const weekId = Number(id);
  const data = updateSchema.parse(await req.json());

  if (data.departmentId !== undefined) {
    const week = await prisma.pdcaWeek.findUnique({ where: { id: weekId }, include: { _count: { select: { tasks: true } } } });
    if (!week) throw new AuthError("Minggu PDCA tidak ditemukan", 404);
    if (week.departmentId !== data.departmentId && week._count.tasks > 0) {
      throw new AuthError("Department tidak dapat diubah karena minggu ini sudah punya task.", 400);
    }
    const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!department) throw new AuthError("Department tidak ditemukan", 400);
  }

  await prisma.pdcaWeek.update({
    where: { id: weekId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
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
