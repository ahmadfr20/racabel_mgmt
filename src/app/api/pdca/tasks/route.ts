import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

const createSchema = z.object({
  weekId: z.coerce.number().int().positive(),
  title: z.string().min(1, "Judul task wajib diisi"),
  userId: z.coerce.number().int().positive(),
  status: z.enum(["BELUM_SELESAI", "SELESAI"]).default("BELUM_SELESAI"),
});

// POST: tambah task ke sebuah minggu PDCA. Butuh pdca.manage.
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("pdca.manage");
  const data = createSchema.parse(await req.json());

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
