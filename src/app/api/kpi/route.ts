import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export const GET = handle(async () => {
  await requirePermission("payroll.view");
  const metrics = await prisma.kpiMetric.findMany({ orderBy: { id: "asc" } });
  return ok(metrics);
});

const schema = z.object({
  name: z.string().min(2, "Nama KPI minimal 2 karakter"),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100),
});

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("payroll.manage");
  const data = schema.parse(await req.json());
  const metric = await prisma.kpiMetric.create({ data });
  return ok({ id: metric.id }, 201);
});
