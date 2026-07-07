import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { toDateOnly } from "@/lib/utils";

// GET /api/attendance?scope=all|mine&date=YYYY-MM-DD
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
  const dateStr = req.nextUrl.searchParams.get("date");

  if (scope === "all" && !user.permissions.includes("attendance.view_all")) {
    throw new AuthError("Tidak berwenang melihat absensi semua karyawan", 403);
  }

  const where: any = scope === "all" ? {} : { userId: user.id };
  if (dateStr) {
    where.date = toDateOnly(new Date(dateStr + "T00:00:00Z"));
  }

  const records = await prisma.attendance.findMany({
    where,
    include: { user: { select: { fullName: true, username: true, department: { select: { name: true } } } } },
    orderBy: [{ date: "desc" }, { checkInAt: "desc" }],
    take: 200,
  });

  return ok(
    records.map((r) => ({
      id: r.id,
      date: r.date,
      user: { fullName: r.user.fullName, username: r.user.username, department: r.user.department?.name ?? null },
      checkInAt: r.checkInAt,
      checkInStatus: r.checkInStatus,
      lateMinutes: r.lateMinutes,
      checkOutAt: r.checkOutAt,
      checkOutStatus: r.checkOutStatus,
      earlyMinutes: r.earlyMinutes,
      workedMinutes: r.workedMinutes,
    }))
  );
});
