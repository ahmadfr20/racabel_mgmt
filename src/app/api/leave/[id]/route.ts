import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, requireUser, AuthError } from "@/lib/auth";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().optional(),
});

// Setujui / tolak pengajuan cuti (HR/Admin).
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const reviewer = await requirePermission("leave.approve");
  const id = Number((await ctx.params).id);
  const { action, reviewNote } = reviewSchema.parse(await req.json());

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) throw new AuthError("Pengajuan tidak ditemukan", 404);
  if (leave.status !== "PENDING") throw new AuthError("Pengajuan ini sudah diproses", 400);

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reviewedById: reviewer.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    },
  });
  return ok({ success: true });
});

// Batalkan pengajuan sendiri (selama masih PENDING).
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) throw new AuthError("Pengajuan tidak ditemukan", 404);
  if (leave.userId !== user.id) throw new AuthError("Bukan pengajuan Anda", 403);
  if (leave.status !== "PENDING") throw new AuthError("Pengajuan sudah diproses", 400);
  await prisma.leaveRequest.delete({ where: { id } });
  return ok({ success: true });
});
