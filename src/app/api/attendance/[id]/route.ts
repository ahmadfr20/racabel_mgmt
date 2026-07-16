import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// DELETE /api/attendance/[id] — hapus data absensi (khusus Admin/CEO via attendance.manage).
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("attendance.manage");
  const id = Number((await ctx.params).id);

  const record = await prisma.attendance.findUnique({ where: { id } });
  if (!record) throw new AuthError("Data absensi tidak ditemukan", 404);

  await prisma.attendance.delete({ where: { id } });
  return ok({ success: true });
});
