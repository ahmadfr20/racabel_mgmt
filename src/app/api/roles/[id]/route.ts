import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  permissionIds: z.array(z.number().int()).optional(),
});

// Ubah role & atur authority-nya.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("roles.manage");
  const roleId = Number((await ctx.params).id);
  const data = schema.parse(await req.json());

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: roleId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.color ? { color: data.color } : {}),
      },
    });
    if (data.permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (data.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    }
  });
  return ok({ success: true });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("roles.manage");
  const roleId = Number((await ctx.params).id);
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) throw new AuthError("Role tidak ditemukan", 404);
  if (role.isSystem) throw new AuthError("Role bawaan tidak dapat dihapus", 400);
  if (role._count.users > 0) throw new AuthError("Masih ada karyawan dengan role ini", 400);

  await prisma.role.delete({ where: { id: roleId } });
  return ok({ success: true });
});
