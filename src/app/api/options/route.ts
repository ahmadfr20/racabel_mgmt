import { handle, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Opsi untuk dropdown form (role & department). Dapat diakses semua user login.
export const GET = handle(async () => {
  await requireUser();
  const [roles, departments] = await Promise.all([
    prisma.role.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return ok({ roles, departments });
});
