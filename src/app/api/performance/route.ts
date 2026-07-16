import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { currentPeriod, syncAutoPerformanceRecords } from "@/lib/performance";

// GET /api/performance?userId=&period= — capaian KPI seorang karyawan pada periode.
export const GET = handle(async (req: NextRequest) => {
  await requirePermission("payroll.manage");
  const userId = Number(req.nextUrl.searchParams.get("userId"));
  const period = req.nextUrl.searchParams.get("period") || currentPeriod();

  await syncAutoPerformanceRecords(userId, period);

  const [metrics, records, user] = await Promise.all([
    // Metrik yang berlaku untuk user: KPI umum (userId null) + KPI khusus miliknya.
    prisma.kpiMetric.findMany({ where: { active: true, OR: [{ userId: null }, { userId }] }, orderBy: { id: "asc" } }),
    prisma.performanceRecord.findMany({ where: { userId, period } }),
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, baseSalary: true, performanceAllowance: true } }),
  ]);

  const scoreByMetric = new Map(records.map((r) => [r.metricId, r.score]));
  return ok({
    period,
    user,
    metrics: metrics.map((m) => ({
      id: m.id,
      name: m.name,
      weight: m.weight,
      score: scoreByMetric.get(m.id) ?? 0,
      isAuto: m.isAuto,
      autoSource: m.autoSource,
    })),
  });
});

const putSchema = z.object({
  userId: z.number().int(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  scores: z.array(z.object({ metricId: z.number().int(), score: z.coerce.number().min(0).max(100) })),
});

// PUT /api/performance — simpan capaian KPI manual (pembobotan dihitung dari bobot metric).
// Metrik otomatis (isAuto) diabaikan di sini — nilainya hanya diisi oleh syncAutoPerformanceRecords.
export const PUT = handle(async (req: NextRequest) => {
  await requirePermission("payroll.manage");
  const { userId, period, scores } = putSchema.parse(await req.json());

  const metricIds = scores.map((s) => s.metricId);
  const metrics = await prisma.kpiMetric.findMany({ where: { id: { in: metricIds } } });
  const autoIds = new Set(metrics.filter((m) => m.isAuto).map((m) => m.id));
  const manualScores = scores.filter((s) => !autoIds.has(s.metricId));

  await prisma.$transaction(
    manualScores.map((s) =>
      prisma.performanceRecord.upsert({
        where: { userId_metricId_period: { userId, metricId: s.metricId, period } },
        update: { score: s.score },
        create: { userId, metricId: s.metricId, period, score: s.score },
      })
    )
  );
  return ok({ success: true });
});
