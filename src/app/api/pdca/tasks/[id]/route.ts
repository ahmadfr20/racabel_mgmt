import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  userId: z.coerce.number().int().positive().optional(),
  status: z.enum(["BELUM_SELESAI", "SELESAI"]).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

// PATCH: ubah task. Pengelola (pdca.manage) bebas mengubah semua field.
// PIC (penanggung jawab task) boleh menandai status selesai/belum miliknya sendiri
// tanpa perlu authority pdca.manage.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  const data = updateSchema.parse(await req.json());

  const task = await prisma.pdcaTask.findUnique({ where: { id } });
  if (!task) throw new AuthError("Task tidak ditemukan", 404);

  const canManage = user.permissions.includes("pdca.manage");
  const onlyStatusChanged = Object.keys(data).every((k) => k === "status");

  if (!canManage) {
    if (task.userId !== user.id || !onlyStatusChanged) {
      throw new AuthError("Anda hanya dapat menandai status task yang menjadi tanggung jawab Anda", 403);
    }
  }

  if (data.userId !== undefined) {
    const week = await prisma.pdcaWeek.findUnique({ where: { id: task.weekId } });
    const pic = await prisma.user.findUnique({ where: { id: data.userId }, select: { departmentId: true } });
    if (!pic) throw new AuthError("PIC tidak ditemukan", 400);
    if (!week || pic.departmentId !== week.departmentId) {
      throw new AuthError("PIC harus berasal dari department minggu ini.", 400);
    }
  }

  await prisma.pdcaTask.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.userId !== undefined ? { userId: data.userId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
  });
  return ok({ success: true });
});

// DELETE: hapus task. Butuh pdca.manage.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (!user.permissions.includes("pdca.manage")) throw new AuthError("Anda tidak memiliki akses", 403);
  const id = Number((await ctx.params).id);
  await prisma.pdcaTask.delete({ where: { id } });
  return ok({ success: true });
});
