import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

// Riwayat komparasi keuangan yang dibuat & disimpan oleh Asisten Keuangan AI.
export const GET = handle(async () => {
  await requirePermission("financial.view");
  const rows = await prisma.financialComparison.findMany({
    include: { createdBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      scopeALabel: r.scopeALabel,
      scopeBLabel: r.scopeBLabel,
      totalIncomeA: r.totalIncomeA,
      totalExpenseA: r.totalExpenseA,
      totalIncomeB: r.totalIncomeB,
      totalExpenseB: r.totalExpenseB,
      analysis: r.analysis,
      createdByName: r.createdBy.fullName,
      createdAt: r.createdAt,
    }))
  );
});
