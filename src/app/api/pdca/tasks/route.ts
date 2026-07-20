import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";

const createSchema = z.object({
  weekId: z.coerce.number().int().positive(),
  title: z.string().min(1, "Judul task wajib diisi"),
  userId: z.coerce.number().int().positive(),
  status: z.enum(["BELUM_SELESAI", "SEDANG_BERJALAN", "SELESAI"]).default("BELUM_SELESAI"),
});

// POST: tambah task ke sebuah minggu PDCA. Butuh pdca.manage.
// PIC wajib berasal dari department yang sama dengan minggu ini (minggu PDCA khusus 1 department).
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("pdca.manage");
  const data = createSchema.parse(await req.json());

  const week = await prisma.pdcaWeek.findUnique({ where: { id: data.weekId } });
  if (!week) throw new AuthError("Minggu PDCA tidak ditemukan", 404);

  const pic = await prisma.user.findUnique({ where: { id: data.userId }, select: { departmentId: true } });
  if (!pic) throw new AuthError("PIC tidak ditemukan", 400);
  if (pic.departmentId !== week.departmentId) {
    throw new AuthError("PIC harus berasal dari department minggu ini.", 400);
  }

  const count = await prisma.pdcaTask.count({ where: { weekId: data.weekId } });
  const task = await prisma.pdcaTask.create({
    data: {
      weekId: data.weekId,
      title: data.title,
      userId: data.userId,
      status: data.status,
      order: count,
    },
  });
  return ok({ id: task.id }, 201);
});
