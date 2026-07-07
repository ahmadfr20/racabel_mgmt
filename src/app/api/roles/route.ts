import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export const GET = handle(async () => {
  await requirePermission("roles.manage");
  const roles = await prisma.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { id: "asc" },
  });
  return ok(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissionIds: r.permissions.map((p) => p.permissionId),
    }))
  );
});

const schema = z.object({
  name: z.string().min(2, "Nama role minimal 2 karakter"),
  description: z.string().optional(),
  color: z.string().default("#6366f1"),
  permissionIds: z.array(z.number().int()).default([]),
});

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("roles.manage");
  const data = schema.parse(await req.json());
  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      color: data.color,
      permissions: { create: data.permissionIds.map((permissionId) => ({ permissionId })) },
    },
  });
  return ok({ id: role.id }, 201);
});
