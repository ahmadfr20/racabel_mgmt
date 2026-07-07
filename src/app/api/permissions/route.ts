import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const GET = handle(async () => {
  await requirePermission("roles.manage");
  const perms = await prisma.permission.findMany({ orderBy: { id: "asc" } });
  return ok(perms);
});
