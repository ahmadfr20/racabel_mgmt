import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  plan: z.string().min(1).optional(),
  doAction: z.string().optional(),
  checkResult: z.string().optional(),
  actFollowUp: z.string().optional(),
  status: z.enum(["PLAN", "DO", "CHECK", "ACT", "DONE"]).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  userId: z.coerce.number().int().positive().nullable().optional(),
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("pdca.manage");
  const { id } = await ctx.params;
  const data = updateSchema.parse(await req.json());

  await prisma.pdca.update({
    where: { id: Number(id) },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      ...(data.doAction !== undefined ? { doAction: data.doAction || null } : {}),
      ...(data.checkResult !== undefined ? { checkResult: data.checkResult || null } : {}),
      ...(data.actFollowUp !== undefined ? { actFollowUp: data.actFollowUp || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.userId !== undefined && data.userId ? { userId: data.userId } : {}),
    },
  });
  return ok({ success: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("pdca.manage");
  const { id } = await ctx.params;
  await prisma.pdca.delete({ where: { id: Number(id) } });
  return ok({ success: true });
});
