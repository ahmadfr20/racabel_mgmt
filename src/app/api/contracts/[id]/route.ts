import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("contract.manage");
  const id = Number((await ctx.params).id);
  const record = await prisma.contractAgreement.findUnique({ where: { id } });
  if (!record) throw new AuthError("Perjanjian tidak ditemukan", 404);
  await prisma.contractAgreement.delete({ where: { id } });
  return ok({ success: true });
});
