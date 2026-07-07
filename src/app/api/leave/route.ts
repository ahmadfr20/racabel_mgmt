import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, requirePermission, AuthError } from "@/lib/auth";

// GET /api/leave?scope=mine|all&status=PENDING
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
  const status = req.nextUrl.searchParams.get("status");

  const canViewAll = user.permissions.includes("leave.view_all") || user.permissions.includes("leave.approve");
  if (scope === "all" && !canViewAll) throw new AuthError("Tidak berwenang melihat semua cuti", 403);

  const records = await prisma.leaveRequest.findMany({
    where: {
      ...(scope === "all" ? {} : { userId: user.id }),
      ...(status ? { status: status as any } : {}),
    },
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
    type: z.enum(["ANNUAL", "SICK", "PERMISSION", "UNPAID"]),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    reason: z.string().min(3, "Alasan minimal 3 karakter"),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), { message: "Tanggal selesai harus ≥ tanggal mulai", path: ["endDate"] });

export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("leave.request");
  const data = createSchema.parse(await req.json());
  const leave = await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
    },
  });
  return ok({ id: leave.id }, 201);
});
