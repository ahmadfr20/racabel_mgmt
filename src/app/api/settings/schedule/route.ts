import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export const GET = handle(async () => {
  await requirePermission("settings.manage");
  const schedules = await prisma.workSchedule.findMany({ include: { department: true } });
  return ok(
    schedules.map((s) => ({
      id: s.id,
      departmentId: s.departmentId,
      departmentName: s.department?.name ?? null,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime,
      lateToleranceMin: s.lateToleranceMin,
      earlyLeaveTolMin: s.earlyLeaveTolMin,
      workDays: s.workDays,
    }))
  );
});

const schema = z.object({
  departmentId: z.number().int().nullable(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm"),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm"),
  lateToleranceMin: z.coerce.number().int().min(0).max(240),
  earlyLeaveTolMin: z.coerce.number().int().min(0).max(240),
  workDays: z.string().default("1,2,3,4,5"),
});

// Simpan / perbarui jam masuk & toleransi (global bila departmentId null, atau per department).
export const PUT = handle(async (req: NextRequest) => {
  await requirePermission("settings.manage");
  const data = schema.parse(await req.json());

  const existing = data.departmentId
    ? await prisma.workSchedule.findUnique({ where: { departmentId: data.departmentId } })
    : await prisma.workSchedule.findFirst({ where: { departmentId: null } });

  if (existing) {
    await prisma.workSchedule.update({ where: { id: existing.id }, data });
  } else {
    await prisma.workSchedule.create({ data });
  }
  return ok({ success: true });
});
