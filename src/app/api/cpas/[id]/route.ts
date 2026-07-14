import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth";

export const DELETE = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requirePermission("financial.upload");
  const { id } = await params;
  const record = await prisma.cpasPlan.findUnique({ where: { id: Number(id) } });
  if (!record) throw new AuthError("CPAS Plan tidak ditemukan", 404);
  await prisma.cpasPlan.delete({ where: { id: Number(id) } });
  return ok({ ok: true });
});
