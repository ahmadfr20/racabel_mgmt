import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  weight: z.coerce.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("payroll.manage");
  const id = Number((await ctx.params).id);
  const data = schema.parse(await req.json());
  await prisma.kpiMetric.update({ where: { id }, data });
  return ok({ success: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("payroll.manage");
  const id = Number((await ctx.params).id);
  await prisma.kpiMetric.delete({ where: { id } });
  return ok({ success: true });
});
