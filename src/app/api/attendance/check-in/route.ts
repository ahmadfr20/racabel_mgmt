import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import { evaluateCheckIn, getEffectiveSchedule } from "@/lib/schedule";
import { toDateOnly } from "@/lib/utils";

const schema = z.object({ photo: z.string().min(10, "Foto absensi wajib diambil") });

export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("attendance.checkin");
  const { photo } = schema.parse(await req.json());

  const date = toDateOnly();
  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing?.checkInAt) throw new AuthError("Anda sudah melakukan check-in hari ini", 400);

  const now = new Date();
  const schedule = await getEffectiveSchedule(user.department?.id ?? null);
  const { status, lateMinutes } = evaluateCheckIn(now, schedule);

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { checkInAt: now, checkInStatus: status, checkInPhoto: photo, lateMinutes },
    create: { userId: user.id, date, checkInAt: now, checkInStatus: status, checkInPhoto: photo, lateMinutes },
  });

  return ok({ status, lateMinutes, checkInAt: record.checkInAt }, 201);
});
