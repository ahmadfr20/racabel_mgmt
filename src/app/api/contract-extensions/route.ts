import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

// GET /api/contract-extensions?scope=mine|all
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";

  const canViewAll = user.permissions.includes("contract.manage");
  if (scope === "all" && !canViewAll) throw new AuthError("Tidak berwenang melihat semua pengajuan", 403);

  const records = await prisma.contractExtensionRequest.findMany({
    where: scope === "all" ? {} : { userId: user.id },
    include: {
      user: { select: { fullName: true, department: { select: { name: true } } } },
      reviewedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok(records);
});

const createSchema = z
  .object({
    requestedEndDate: z.string().min(1, "Tanggal perpanjangan wajib diisi"),
    reason: z.string().min(3, "Alasan minimal 3 karakter"),
  });

// POST: karyawan (status Kontrak/Magang) mengajukan perpanjangan periode kontrak sendiri.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const data = createSchema.parse(await req.json());

  if (user.employmentStatus !== "KONTRAK" && user.employmentStatus !== "MAGANG") {
    throw new AuthError("Hanya karyawan berstatus Kontrak/Magang yang dapat mengajukan perpanjangan.", 400);
  }
  if (!user.contractEndDate) {
    throw new AuthError("Anda belum memiliki periode kontrak yang tercatat. Hubungi HR.", 400);
  }
  const requestedEndDate = new Date(data.requestedEndDate);
  if (requestedEndDate <= user.contractEndDate) {
    throw new AuthError("Tanggal perpanjangan harus setelah tanggal berakhir kontrak saat ini.", 400);
  }

  const existingPending = await prisma.contractExtensionRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
  });
  if (existingPending) throw new AuthError("Anda sudah punya pengajuan perpanjangan yang masih menunggu persetujuan.", 400);

  const request = await prisma.contractExtensionRequest.create({
    data: {
      userId: user.id,
      currentEndDate: user.contractEndDate,
      requestedEndDate,
      reason: data.reason,
    },
  });
  return ok({ id: request.id }, 201);
});
