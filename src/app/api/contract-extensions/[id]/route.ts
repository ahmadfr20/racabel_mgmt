import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, requireUser, AuthError } from "@/lib/auth";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().optional(),
});

// Setujui / tolak pengajuan perpanjangan kontrak (HR/CEO/Admin).
// Saat disetujui, User.contractEndDate juga diperbarui mengikuti tanggal yang diajukan.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const reviewer = await requirePermission("contract.manage");
  const id = Number((await ctx.params).id);
  const { action, reviewNote } = reviewSchema.parse(await req.json());

  const request = await prisma.contractExtensionRequest.findUnique({ where: { id } });
  if (!request) throw new AuthError("Pengajuan tidak ditemukan", 404);
  if (request.status !== "PENDING") throw new AuthError("Pengajuan ini sudah diproses", 400);

  await prisma.$transaction([
    prisma.contractExtensionRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    }),
    ...(action === "approve"
      ? [prisma.user.update({ where: { id: request.userId }, data: { contractEndDate: request.requestedEndDate } })]
      : []),
  ]);
  return ok({ success: true });
});

// Batalkan pengajuan sendiri (selama masih PENDING).
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  const request = await prisma.contractExtensionRequest.findUnique({ where: { id } });
  if (!request) throw new AuthError("Pengajuan tidak ditemukan", 404);
  if (request.userId !== user.id) throw new AuthError("Bukan pengajuan Anda", 403);
  if (request.status !== "PENDING") throw new AuthError("Pengajuan sudah diproses", 400);
  await prisma.contractExtensionRequest.delete({ where: { id } });
  return ok({ success: true });
});
