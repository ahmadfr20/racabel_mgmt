import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getEffectiveSchedule } from "@/lib/schedule";
import { toDateOnly } from "@/lib/utils";

// Status absensi hari ini + jadwal efektif untuk user saat ini.
export const GET = handle(async () => {
  const user = await requirePermission("attendance.checkin");
  const date = toDateOnly();
  const [record, schedule] = await Promise.all([
    prisma.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    getEffectiveSchedule(user.department?.id ?? null),
  ]);
  return ok({
    schedule,
    attendance: record
      ? {
          checkInAt: record.checkInAt,
          checkInStatus: record.checkInStatus,
          lateMinutes: record.lateMinutes,
          checkOutAt: record.checkOutAt,
          checkOutStatus: record.checkOutStatus,
          earlyMinutes: record.earlyMinutes,
          workedMinutes: record.workedMinutes,
        }
      : null,
  });
});
