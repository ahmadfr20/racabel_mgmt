import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { computeSalary, currentPeriod, getWeightedScore } from "@/lib/performance";

// GET /api/payroll?period=YYYY-MM — daftar gaji terkalkulasi semua karyawan aktif.
export const GET = handle(async (req: NextRequest) => {
  await requirePermission("payroll.view");
  const period = req.nextUrl.searchParams.get("period") || currentPeriod();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { department: true, role: true },
    orderBy: { fullName: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (u) => {
      const score = await getWeightedScore(u.id, period);
      const salary = computeSalary({ baseSalary: u.baseSalary, performanceAllowance: u.performanceAllowance, score });
      return {
        userId: u.id,
        fullName: u.fullName,
        department: u.department?.name ?? null,
        role: u.role.name,
        baseSalary: u.baseSalary,
        performanceAllowance: u.performanceAllowance,
        score,
        performanceAmount: salary.performanceAmount,
        totalSalary: salary.totalSalary,
      };
    })
  );

  const totals = rows.reduce(
    (acc, r) => ({ base: acc.base + r.baseSalary, perf: acc.perf + r.performanceAmount, total: acc.total + r.totalSalary }),
    { base: 0, perf: 0, total: 0 }
  );

  return ok({ period, rows, totals });
});
