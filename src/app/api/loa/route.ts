import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

// GET: riwayat Letter of Acceptance yang sudah diterbitkan.
export const GET = handle(async () => {
  await requirePermission("contract.manage");
  const rows = await prisma.letterOfAcceptance.findMany({
    include: { user: { select: { fullName: true } }, generatedBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      employeeName: r.user.fullName,
      employmentStatus: r.employmentStatus,
      acceptanceDate: r.acceptanceDate,
      generatedByName: r.generatedBy.fullName,
      signature: r.signature,
      createdAt: r.createdAt,
    }))
  );
});

const createSchema = z.object({
  userId: z.coerce.number().int().positive(),
  employmentStatus: z.enum(["MAGANG", "KONTRAK", "PEGAWAI_TETAP"]),
  acceptanceDate: z.string().min(1, "Tanggal penerimaan wajib diisi"),
  signature: z.string().min(1, "Tanda tangan wajib diisi"),
});

// POST: terbitkan Letter of Acceptance baru untuk karyawan (baru/existing) — satu tanda tangan penerbit.
export const POST = handle(async (req: NextRequest) => {
  const generator = await requirePermission("contract.manage");
  const data = createSchema.parse(await req.json());

  const employee = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!employee) throw new AuthError("Karyawan tidak ditemukan", 404);

  const loa = await prisma.letterOfAcceptance.create({
    data: {
      userId: data.userId,
      employmentStatus: data.employmentStatus,
      acceptanceDate: new Date(data.acceptanceDate),
      generatedById: generator.id,
      signature: data.signature,
    },
  });
  return ok({ id: loa.id }, 201);
});
