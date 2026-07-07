import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

// GET /api/attendance/[id]/photo?type=in|out
// Foto absensi hanya bisa dilihat oleh yang punya authority attendance.view_all
// (HR/CEO/Admin) atau oleh pemilik absensi itu sendiri.
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  const type = req.nextUrl.searchParams.get("type") === "out" ? "out" : "in";

  const record = await prisma.attendance.findUnique({
    where: { id },
    select: { userId: true, checkInPhoto: true, checkOutPhoto: true },
  });
  if (!record) throw new AuthError("Data absensi tidak ditemukan", 404);

  const canViewAll = user.permissions.includes("attendance.view_all");
  if (!canViewAll && record.userId !== user.id) {
    throw new AuthError("Tidak berwenang melihat foto absensi ini", 403);
  }

  const photo = type === "out" ? record.checkOutPhoto : record.checkInPhoto;
  return ok({ photo });
});
