import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, requirePermission, AuthError } from "@/lib/auth";

// GET: daftar siklus PDCA (semua). Butuh pdca.view.
export const GET = handle(async (_req: NextRequest) => {
  const user = await requireUser();
  if (!user.permissions.includes("pdca.view") && !user.permissions.includes("pdca.manage")) {
    throw new AuthError("Anda tidak memiliki akses PDCA", 403);
  }
  const rows = await prisma.pdca.findMany({
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
  });
  return ok(
    rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.fullName,
      title: p.title,
      plan: p.plan,
      doAction: p.doAction,
      checkResult: p.checkResult,
      actFollowUp: p.actFollowUp,
      status: p.status,
      startDate: p.startDate,
      dueDate: p.dueDate,
    }))
  );
});

const createSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  plan: z.string().min(1, "Rencana (Plan) wajib diisi"),
  doAction: z.string().optional().or(z.literal("")),
  checkResult: z.string().optional().or(z.literal("")),
  actFollowUp: z.string().optional().or(z.literal("")),
  status: z.enum(["PLAN", "DO", "CHECK", "ACT", "DONE"]).default("PLAN"),
  startDate: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  userId: z.coerce.number().int().positive().optional().nullable(),
});

// POST: buat siklus PDCA. Butuh pdca.manage.
export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("pdca.manage");
  const data = createSchema.parse(await req.json());

  const p = await prisma.pdca.create({
    data: {
      userId: data.userId || user.id,
      title: data.title,
      plan: data.plan,
      doAction: data.doAction || null,
      checkResult: data.checkResult || null,
      actFollowUp: data.actFollowUp || null,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  return ok({ id: p.id }, 201);
});
