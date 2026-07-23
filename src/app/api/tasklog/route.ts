import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

// GET: daftar task log. Manajer (tasklog.view_all) bisa lihat semua / filter userId.
// Karyawan biasa hanya lihat miliknya sendiri.
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const canViewAll = user.permissions.includes("tasklog.view_all");
  if (!canViewAll && !user.permissions.includes("tasklog.write")) {
    throw new AuthError("Anda tidak memiliki akses Task Log", 403);
  }

  const sp = req.nextUrl.searchParams;
  const qUser = sp.get("userId");
  const from = sp.get("from");
  const to = sp.get("to");

  const targetUserId = canViewAll ? (qUser ? Number(qUser) : undefined) : user.id;

  const logs = await prisma.taskLog.findMany({
    where: {
      ...(targetUserId ? { userId: targetUserId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { user: { select: { id: true, fullName: true, department: { select: { id: true, name: true } } } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  return ok(
    logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      userName: l.user.fullName,
      departmentId: l.user.department?.id ?? null,
      departmentName: l.user.department?.name ?? null,
      date: l.date,
      title: l.title,
      description: l.description,
      status: l.status,
      hours: l.hours,
    }))
  );
});

const createSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  title: z.string().min(1, "Judul tugas wajib diisi"),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]).default("DONE"),
  hours: z.coerce.number().min(0).max(24).optional().nullable(),
});

// POST: input task log harian milik sendiri.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  if (!user.permissions.includes("tasklog.write")) {
    throw new AuthError("Anda tidak memiliki akses input Task Log", 403);
  }
  const data = createSchema.parse(await req.json());

  const log = await prisma.taskLog.create({
    data: {
      userId: user.id,
      date: new Date(data.date),
      title: data.title,
      description: data.description || null,
      status: data.status,
      hours: data.hours ?? null,
    },
  });
  return ok({ id: log.id }, 201);
});
