import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("contract.manage");
  const id = Number((await ctx.params).id);
  const record = await prisma.letterOfAcceptance.findUnique({ where: { id } });
  if (!record) throw new AuthError("LoA tidak ditemukan", 404);
  await prisma.letterOfAcceptance.delete({ where: { id } });
  return ok({ success: true });
});
