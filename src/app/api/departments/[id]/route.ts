import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("departments.manage");
  const id = Number((await ctx.params).id);
  const data = schema.parse(await req.json());
  await prisma.department.update({ where: { id }, data });
  return ok({ success: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("departments.manage");
  const id = Number((await ctx.params).id);
  const dept = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!dept) throw new AuthError("Department tidak ditemukan", 404);
  if (dept._count.users > 0) throw new AuthError("Masih ada karyawan di department ini", 400);
  await prisma.department.delete({ where: { id } });
  return ok({ success: true });
});
