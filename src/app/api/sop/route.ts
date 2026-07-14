import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = handle(async (_req: NextRequest) => {
  await requirePermission("financial.view");
  const rows = await prisma.sopPlan.findMany({
    include: {
      pic: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      department: r.department,
      picName: r.pic?.fullName ?? null,
      status: r.status,
      createdByName: r.createdBy.fullName,
      createdAt: r.createdAt,
    }))
  );
});
