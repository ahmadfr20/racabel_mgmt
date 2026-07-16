import { prisma } from "./prisma";

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Rentang tanggal (awal-akhir bulan) dari periode "YYYY-MM".
function getPeriodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

// Hitung skor otomatis (0-100) untuk satu sumber data pada periode tertentu.
// Mengembalikan null jika tidak ada data sama sekali pada periode tsb (metrik dilewati,
// bukan dianggap 0, agar tidak menjatuhkan rata-rata berbobot tanpa dasar data).
export async function computeAutoScore(
  userId: number,
  period: string,
  source: "TASKLOG" | "PDCA" | "TICKET" | "ATTENDANCE"
): Promise<number | null> {
  const { start, end } = getPeriodRange(period);

  if (source === "TASKLOG") {
    const logs = await prisma.taskLog.findMany({ where: { userId, date: { gte: start, lte: end } } });
    if (logs.length === 0) return null;
    const done = logs.filter((l) => l.status === "DONE").length;
    return Math.round((done / logs.length) * 10000) / 100;
  }

  if (source === "PDCA") {
    const tasks = await prisma.pdcaTask.findMany({
      where: {
        userId,
        week: { OR: [{ startDate: { gte: start, lte: end } }, { startDate: null, createdAt: { gte: start, lte: end } }] },
      },
    });
    if (tasks.length === 0) return null;
    const done = tasks.filter((t) => t.status === "SELESAI").length;
    return Math.round((done / tasks.length) * 10000) / 100;
  }

  if (source === "TICKET") {
    const tickets = await prisma.ticket.findMany({ where: { assigneeId: userId, createdAt: { gte: start, lte: end } } });
    if (tickets.length === 0) return null;
    const resolved = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    return Math.round((resolved / tickets.length) * 10000) / 100;
  }

  // ATTENDANCE: rata-rata ketepatan waktu check-in & check-out.
  const records = await prisma.attendance.findMany({ where: { userId, date: { gte: start, lte: end } } });
  if (records.length === 0) return null;
  const checkIns = records.filter((r) => r.checkInStatus !== null);
  const checkOuts = records.filter((r) => r.checkOutAt !== null);
  const events = checkIns.length + checkOuts.length;
  if (events === 0) return null;
  const onTime =
    checkIns.filter((r) => r.checkInStatus === "ON_TIME").length +
    checkOuts.filter((r) => r.checkOutStatus === "ON_TIME").length;
  return Math.round((onTime / events) * 10000) / 100;
}

// Sinkronkan PerformanceRecord untuk semua KpiMetric otomatis (isAuto) yang berlaku
// bagi seorang user pada suatu periode, berdasarkan data aktual (task log/PDCA/tiket/absensi).
export async function syncAutoPerformanceRecords(userId: number, period: string): Promise<void> {
  const autoMetrics = await prisma.kpiMetric.findMany({
    where: { isAuto: true, active: true, OR: [{ userId: null }, { userId }] },
  });
  if (autoMetrics.length === 0) return;

  await Promise.all(
    autoMetrics.map(async (metric) => {
      if (!metric.autoSource) return;
      const score = await computeAutoScore(userId, period, metric.autoSource);
      if (score === null) return;
      await prisma.performanceRecord.upsert({
        where: { userId_metricId_period: { userId, metricId: metric.id, period } },
        update: { score },
        create: { userId, metricId: metric.id, period, score },
      });
    })
  );
}

// Skor kinerja berbobot (0-100) untuk seorang user pada suatu periode.
// weightedScore = Σ(score_i × weight_i) / Σ(weight_i)
export async function getWeightedScore(userId: number, period: string): Promise<number> {
  const records = await prisma.performanceRecord.findMany({
    where: { userId, period },
    include: { metric: true },
  });
  const active = records.filter((r) => r.metric.active && r.metric.weight > 0);
  const totalWeight = active.reduce((s, r) => s + r.metric.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = active.reduce((s, r) => s + r.score * r.metric.weight, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}

// Kalkulasi komponen gaji dari capaian kinerja.
// total = gaji pokok + (tunjangan kinerja × skor%) − potongan
export function computeSalary(opts: {
  baseSalary: number;
  performanceAllowance: number;
  score: number; // 0-100
  deductions?: number;
}) {
  const { baseSalary, performanceAllowance, score, deductions = 0 } = opts;
  const performanceAmount = Math.round((performanceAllowance * score) / 100);
  const totalSalary = Math.max(0, baseSalary + performanceAmount - deductions);
  return { baseSalary, performanceAmount, deductions, totalSalary, score };
}
