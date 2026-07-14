import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// Hapus satu riwayat komparasi keuangan.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("financial.upload");
  const { id } = await ctx.params;
  const comparisonId = Number(id);
  if (!Number.isInteger(comparisonId)) throw new AuthError("ID tidak valid.", 400);

  await prisma.financialComparison.delete({ where: { id: comparisonId } });
  return ok({ success: true });
});
