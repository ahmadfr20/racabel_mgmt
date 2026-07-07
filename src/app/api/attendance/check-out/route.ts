import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import { evaluateCheckOut, getEffectiveSchedule } from "@/lib/schedule";
import { toDateOnly } from "@/lib/utils";

const schema = z.object({ photo: z.string().min(10, "Foto absensi wajib diambil") });

export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("attendance.checkin");
  const { photo } = schema.parse(await req.json());

  const date = toDateOnly();
  const record = await prisma.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!record?.checkInAt) throw new AuthError("Anda belum check-in hari ini", 400);
  if (record.checkOutAt) throw new AuthError("Anda sudah melakukan check-out hari ini", 400);

  const now = new Date();
  const schedule = await getEffectiveSchedule(user.department?.id ?? null);
  const { status, earlyMinutes } = evaluateCheckOut(now, schedule);
  const workedMinutes = Math.max(0, Math.round((now.getTime() - record.checkInAt.getTime()) / 60000));

  await prisma.attendance.update({
    where: { id: record.id },
    data: { checkOutAt: now, checkOutStatus: status, checkOutPhoto: photo, earlyMinutes, workedMinutes },
  });

  return ok({ status, earlyMinutes, workedMinutes, checkOutAt: now });
});
