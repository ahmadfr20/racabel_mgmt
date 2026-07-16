import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// GET: riwayat perjanjian kontrak/magang yang sudah dibuat.
export const GET = handle(async () => {
  await requirePermission("contract.manage");
  const rows = await prisma.contractAgreement.findMany({
    include: { user: { select: { fullName: true } }, companySigner: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      employeeName: r.user.fullName,
      employmentStatus: r.employmentStatus,
      startDate: r.startDate,
      endDate: r.endDate,
      position: r.position,
      terms: r.terms,
      companySignerName: r.companySignerName,
      companySignature: r.companySignature,
      employeeSignature: r.employeeSignature,
      signedAt: r.signedAt,
      createdAt: r.createdAt,
    }))
  );
});

const createSchema = z.object({
  userId: z.coerce.number().int().positive(),
  employmentStatus: z.enum(["MAGANG", "KONTRAK"]),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
  position: z.string().optional().or(z.literal("")),
  terms: z.string().optional().or(z.literal("")),
  companySignature: z.string().min(1, "Tanda tangan perusahaan wajib diisi"),
  employeeSignature: z.string().min(1, "Tanda tangan karyawan wajib diisi"),
});

// POST: buat & tandatangani perjanjian kontrak baru (satu sesi, 2 tanda tangan sekaligus).
// Juga menyelaraskan periode kontrak resmi pada data karyawan (User.contractStartDate/EndDate).
export const POST = handle(async (req: NextRequest) => {
  const signer = await requirePermission("contract.manage");
  const data = createSchema.parse(await req.json());

  const employee = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!employee) throw new AuthError("Karyawan tidak ditemukan", 404);
  if (employee.employmentStatus !== data.employmentStatus) {
    throw new AuthError("Status karyawan pada perjanjian harus sesuai dengan status karyawan saat ini.", 400);
  }

  const [agreement] = await prisma.$transaction([
    prisma.contractAgreement.create({
      data: {
        userId: data.userId,
        employmentStatus: data.employmentStatus,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        position: data.position || null,
        terms: data.terms || null,
        companySignerId: signer.id,
        companySignerName: signer.fullName,
        companySignature: data.companySignature,
        employeeSignature: data.employeeSignature,
      },
    }),
    prisma.user.update({
      where: { id: data.userId },
      data: { contractStartDate: new Date(data.startDate), contractEndDate: new Date(data.endDate) },
    }),
  ]);

  return ok({ id: agreement.id }, 201);
});
