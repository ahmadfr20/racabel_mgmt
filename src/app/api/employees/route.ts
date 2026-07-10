import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

export const GET = handle(async (req: NextRequest) => {
  await requirePermission("employees.view");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const deptId = req.nextUrl.searchParams.get("department");

  const users = await prisma.user.findMany({
    where: {
      ...(q ? { OR: [{ fullName: { contains: q } }, { username: { contains: q } }] } : {}),
      ...(deptId ? { departmentId: Number(deptId) } : {}),
    },
    include: { role: true, department: true },
    orderBy: { createdAt: "desc" },
  });

  return ok(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      birthDate: u.birthDate,
      joinDate: u.joinDate,
      isActive: u.isActive,
      photo: u.photo,
      baseSalary: u.baseSalary,
      performanceAllowance: u.performanceAllowance,
      role: { id: u.role.id, name: u.role.name, color: u.role.color },
      department: u.department ? { id: u.department.id, name: u.department.name } : null,
    }))
  );
});

const createSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  birthDate: z.string().optional().or(z.literal("")),
  joinDate: z.string().optional().or(z.literal("")),
  roleId: z.coerce.number().int().positive("Role wajib dipilih"),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  baseSalary: z.coerce.number().min(0).default(0),
  performanceAllowance: z.coerce.number().min(0).default(0),
  photo: z.string().optional().or(z.literal("")),
  ktpPhoto: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  emergencyName: z.string().optional().or(z.literal("")),
  emergencyPhone: z.string().optional().or(z.literal("")),
});

// Registrasi karyawan baru — hanya untuk yang punya authority employees.create (mis. Admin/HR).
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("employees.create");
  const data = createSchema.parse(await req.json());

  const exists = await prisma.user.findUnique({ where: { username: data.username } });
  if (exists) throw new AuthError("Username sudah digunakan", 400);

  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash: await bcrypt.hash(data.password, 10),
      email: data.email || null,
      fullName: data.fullName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
      roleId: data.roleId,
      departmentId: data.departmentId || null,
      baseSalary: data.baseSalary,
      performanceAllowance: data.performanceAllowance,
      photo: data.photo || null,
      ktpPhoto: data.ktpPhoto || null,
      address: data.address || null,
      emergencyName: data.emergencyName || null,
      emergencyPhone: data.emergencyPhone || null,
    },
  });
  return ok({ id: user.id }, 201);
});
