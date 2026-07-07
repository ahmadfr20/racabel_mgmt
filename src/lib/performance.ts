import { prisma } from "./prisma";

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
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
