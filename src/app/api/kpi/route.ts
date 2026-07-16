import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export const GET = handle(async () => {
  await requirePermission("payroll.view");
  const metrics = await prisma.kpiMetric.findMany({
    orderBy: { id: "asc" },
    include: { assignedUser: { select: { id: true, fullName: true } } },
  });
  return ok(
    metrics.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      weight: m.weight,
      active: m.active,
      isAuto: m.isAuto,
      autoSource: m.autoSource,
      userId: m.userId,
      assignedUserName: m.assignedUser?.fullName ?? null,
    }))
  );
});

const schema = z.object({
  name: z.string().min(2, "Nama KPI minimal 2 karakter"),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100),
  userId: z.coerce.number().int().positive().optional().nullable(), // null = KPI umum
});

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("payroll.manage");
  const data = schema.parse(await req.json());
  const metric = await prisma.kpiMetric.create({
    data: { name: data.name, description: data.description, weight: data.weight, userId: data.userId || null },
  });
  return ok({ id: metric.id }, 201);
});
