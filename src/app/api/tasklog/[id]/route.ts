import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

const updateSchema = z.object({
  date: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]).optional(),
  hours: z.coerce.number().min(0).max(24).nullable().optional(),
});

// Owner boleh ubah miliknya; manajer (tasklog.view_all) boleh ubah semua.
async function assertAccess(id: number, userId: number, canViewAll: boolean) {
  const log = await prisma.taskLog.findUnique({ where: { id } });
  if (!log) throw new AuthError("Task log tidak ditemukan", 404);
  if (log.userId !== userId && !canViewAll) throw new AuthError("Bukan task log Anda", 403);
  return log;
}

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await assertAccess(Number(id), user.id, user.permissions.includes("tasklog.view_all"));
  const data = updateSchema.parse(await req.json());

  await prisma.taskLog.update({
    where: { id: Number(id) },
    data: {
      ...(data.date ? { date: new Date(data.date) } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.hours !== undefined ? { hours: data.hours } : {}),
    },
  });
  return ok({ success: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await assertAccess(Number(id), user.id, user.permissions.includes("tasklog.view_all"));
  await prisma.taskLog.delete({ where: { id: Number(id) } });
  return ok({ success: true });
});
