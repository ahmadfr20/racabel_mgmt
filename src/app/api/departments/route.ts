import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, requireUser } from "@/lib/auth";

export const GET = handle(async () => {
  await requireUser();
  const depts = await prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });
  return ok(depts.map((d) => ({ id: d.id, name: d.name, description: d.description, userCount: d._count.users })));
});

const schema = z.object({
  name: z.string().min(2, "Nama department minimal 2 karakter"),
  description: z.string().optional(),
});

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("departments.manage");
  const data = schema.parse(await req.json());
  const dept = await prisma.department.create({ data });
  return ok({ id: dept.id }, 201);
});
