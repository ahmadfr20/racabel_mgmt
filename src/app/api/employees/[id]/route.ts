import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// Detail lengkap 1 karyawan (termasuk foto & data pribadi) untuk form edit.
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("employees.view");
  const { id } = await ctx.params;
  const u = await prisma.user.findUnique({
    where: { id: Number(id) },
    include: { role: true, department: true },
  });
  if (!u) throw new AuthError("Karyawan tidak ditemukan", 404);
  return ok({
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    birthDate: u.birthDate,
    joinDate: u.joinDate,
    isActive: u.isActive,
    photo: u.photo,
    ktpPhoto: u.ktpPhoto,
    address: u.address,
    emergencyName: u.emergencyName,
    emergencyPhone: u.emergencyPhone,
    baseSalary: u.baseSalary,
    performanceAllowance: u.performanceAllowance,
    role: { id: u.role.id, name: u.role.name, color: u.role.color },
    department: u.department ? { id: u.department.id, name: u.department.name } : null,
  });
});

const updateSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  fullName: z.string().min(1).optional(),
  birthDate: z.string().optional().or(z.literal("")),
  joinDate: z.string().optional().or(z.literal("")),
  roleId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  baseSalary: z.coerce.number().min(0).optional(),
  performanceAllowance: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  photo: z.string().optional(),
  ktpPhoto: z.string().optional(),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("employees.edit");
  const { id } = await ctx.params;
  const data = updateSchema.parse(await req.json());

  await prisma.user.update({
    where: { id: Number(id) },
    data: {
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.birthDate !== undefined ? { birthDate: data.birthDate ? new Date(data.birthDate) : null } : {}),
      ...(data.joinDate !== undefined && data.joinDate ? { joinDate: new Date(data.joinDate) } : {}),
      ...(data.roleId !== undefined ? { roleId: data.roleId } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
      ...(data.baseSalary !== undefined ? { baseSalary: data.baseSalary } : {}),
      ...(data.performanceAllowance !== undefined ? { performanceAllowance: data.performanceAllowance } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
      ...(data.photo !== undefined ? { photo: data.photo || null } : {}),
      ...(data.ktpPhoto !== undefined ? { ktpPhoto: data.ktpPhoto || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.emergencyName !== undefined ? { emergencyName: data.emergencyName || null } : {}),
      ...(data.emergencyPhone !== undefined ? { emergencyPhone: data.emergencyPhone || null } : {}),
    },
  });
  return ok({ success: true });
});

// Nonaktifkan karyawan (soft delete agar riwayat absensi/gaji tetap ada).
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requirePermission("employees.delete");
  const { id } = await ctx.params;
  await prisma.user.update({ where: { id: Number(id) }, data: { isActive: false } });
  return ok({ success: true });
});
