import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, requirePermission, AuthError } from "@/lib/auth";

// GET: daftar minggu PDCA beserta task di dalamnya. Butuh pdca.view atau pdca.manage.
export const GET = handle(async (_req: NextRequest) => {
  const user = await requireUser();
  if (!user.permissions.includes("pdca.view") && !user.permissions.includes("pdca.manage")) {
    throw new AuthError("Anda tidak memiliki akses PDCA", 403);
  }
  const weeks = await prisma.pdcaWeek.findMany({
    include: {
      tasks: {
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  return ok(
    weeks.map((w) => ({
      id: w.id,
      title: w.title,
      startDate: w.startDate,
      endDate: w.endDate,
      tasks: w.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        userId: t.userId,
        userName: t.user.fullName,
      })),
    }))
  );
});

const createSchema = z.object({
  title: z.string().min(1, "Judul minggu wajib diisi"),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
});

// POST: buat minggu PDCA baru. Butuh pdca.manage.
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("pdca.manage");
  const data = createSchema.parse(await req.json());
  const week = await prisma.pdcaWeek.create({
    data: {
      title: data.title,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });
  return ok({ id: week.id }, 201);
});
