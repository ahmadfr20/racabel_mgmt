import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

const EMPLOYMENT_STATUS_LABEL: Record<string, string> = {
  PEGAWAI_TETAP: "Pegawai Tetap", KONTRAK: "Kontrak", MAGANG: "Magang",
};

// GET /api/profile — data profil user yang sedang login (untuk form edit profil sendiri).
// Menyertakan field yang bisa diubah + konteks read-only (role/department/status/username).
export const GET = handle(async () => {
  const current = await requireUser();
  const u = await prisma.user.findUnique({
    where: { id: current.id },
    include: { role: true, department: true },
  });
  if (!u) throw new AuthError("Pengguna tidak ditemukan", 404);

  return ok({
    // Editable
    fullName: u.fullName,
    email: u.email,
    birthDate: u.birthDate,
    photo: u.photo,
    ktpPhoto: u.ktpPhoto,
    address: u.address,
    emergencyName: u.emergencyName,
    emergencyPhone: u.emergencyPhone,
    bankName: u.bankName,
    bankAccountNumber: u.bankAccountNumber,
    // Read-only (tidak bisa diubah lewat form ini)
    username: u.username,
    roleName: u.role.name,
    departmentName: u.department?.name ?? null,
    employmentStatus: EMPLOYMENT_STATUS_LABEL[u.employmentStatus] ?? u.employmentStatus,
  });
});

const updateSchema = z.object({
  fullName: z.string().min(1, "Nama lengkap wajib diisi").optional(),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  birthDate: z.string().nullable().optional().or(z.literal("")),
  photo: z.string().optional(),
  ktpPhoto: z.string().optional(),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter").optional().or(z.literal("")),
});

// PATCH /api/profile — user memperbarui data dirinya sendiri.
// Field yang TIDAK bisa diubah di sini (sengaja tidak diterima): role, department,
// status karyawan, gaji, tunjangan, status aktif, username.
export const PATCH = handle(async (req: NextRequest) => {
  const current = await requireUser();
  const data = updateSchema.parse(await req.json());

  const user = await prisma.user.findUnique({ where: { id: current.id } });
  if (!user) throw new AuthError("Pengguna tidak ditemukan", 404);

  // Ganti password (opsional) — wajib verifikasi password lama untuk keamanan.
  let passwordHash: string | undefined;
  if (data.newPassword) {
    if (!data.currentPassword) throw new AuthError("Masukkan password saat ini untuk mengubah password.", 400);
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) throw new AuthError("Password saat ini salah.", 400);
    passwordHash = await bcrypt.hash(data.newPassword, 10);
  }

  // Cek keunikan email bila diubah.
  if (data.email !== undefined && data.email && data.email !== user.email) {
    const taken = await prisma.user.findFirst({ where: { email: data.email, id: { not: user.id } } });
    if (taken) throw new AuthError("Email sudah digunakan pengguna lain.", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.birthDate !== undefined ? { birthDate: data.birthDate ? new Date(data.birthDate) : null } : {}),
      ...(data.photo !== undefined ? { photo: data.photo || null } : {}),
      ...(data.ktpPhoto !== undefined ? { ktpPhoto: data.ktpPhoto || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.emergencyName !== undefined ? { emergencyName: data.emergencyName || null } : {}),
      ...(data.emergencyPhone !== undefined ? { emergencyPhone: data.emergencyPhone || null } : {}),
      ...(data.bankName !== undefined ? { bankName: data.bankName || null } : {}),
      ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber || null } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  return ok({ success: true });
});
