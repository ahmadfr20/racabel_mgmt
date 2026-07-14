import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

// GET /api/tickets/[id] — detail tiket + riwayat komentar.
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);

  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, fullName: true, department: { select: { name: true } } } },
      assignee: { select: { id: true, fullName: true } },
      comments: {
        include: { author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!t) throw new AuthError("Tiket tidak ditemukan", 404);

  const canViewAll = user.permissions.includes("tickets.view_all") || user.permissions.includes("tickets.manage");
  const isParticipant = t.requesterId === user.id || t.assigneeId === user.id;
  if (!canViewAll && !isParticipant) throw new AuthError("Tidak berwenang melihat tiket ini", 403);

  return ok({
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    requesterId: t.requesterId,
    requesterName: t.requester.fullName,
    requesterDept: t.requester.department?.name ?? null,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.fullName ?? null,
    dueDate: t.dueDate,
    resolvedAt: t.resolvedAt,
    resolutionNote: t.resolutionNote,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    comments: t.comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorId: c.authorId,
      authorName: c.author.fullName,
      createdAt: c.createdAt,
    })),
  });
});

const updateSchema = z.object({
  // Field pengelolaan (butuh tickets.manage):
  title: z.string().min(3).optional(),
  description: z.string().min(3).optional(),
  category: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  // Field alur kerja (butuh manage ATAU PIC ATAU pengaju sesuai aturan):
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  resolutionNote: z.string().optional(),
});

// PATCH /api/tickets/[id] — update tiket.
// - tickets.manage : boleh mengubah semua field.
// - PIC (assignee)  : boleh mengubah status kerja + catatan penyelesaian.
// - Pengaju         : boleh menutup (CLOSED) tiket yang sudah RESOLVED atau membuka kembali.
export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  const data = updateSchema.parse(await req.json());

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AuthError("Tiket tidak ditemukan", 404);

  const canManage = user.permissions.includes("tickets.manage");
  const isAssignee = ticket.assigneeId === user.id;
  const isRequester = ticket.requesterId === user.id;
  if (!canManage && !isAssignee && !isRequester) throw new AuthError("Tidak berwenang mengubah tiket ini", 403);

  // Field pengelolaan hanya untuk pengelola tiket.
  const wantsManageFields =
    data.title !== undefined || data.description !== undefined || data.category !== undefined ||
    data.priority !== undefined || data.assigneeId !== undefined || data.dueDate !== undefined;
  if (wantsManageFields && !canManage) throw new AuthError("Hanya pengelola tiket yang dapat mengubah detail/PIC/prioritas", 403);

  const patch: any = {};
  if (canManage) {
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.category !== undefined) patch.category = data.category || "Umum";
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.assigneeId !== undefined) patch.assigneeId = data.assigneeId;
    if (data.dueDate !== undefined) patch.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  // Perubahan status
  if (data.status !== undefined && data.status !== ticket.status) {
    const next = data.status;
    if (canManage || isAssignee) {
      // pengelola & PIC bebas memindahkan status
    } else if (isRequester) {
      // pengaju hanya boleh: menutup tiket yang sudah RESOLVED, atau membuka kembali tiket RESOLVED/CLOSED
      const allowed =
        (next === "CLOSED" && ticket.status === "RESOLVED") ||
        (next === "OPEN" && (ticket.status === "RESOLVED" || ticket.status === "CLOSED"));
      if (!allowed) throw new AuthError("Pengaju hanya dapat menutup tiket yang sudah selesai atau membukanya kembali", 403);
    }
    patch.status = next;
    if (next === "RESOLVED") patch.resolvedAt = new Date();
    if (next === "OPEN" || next === "IN_PROGRESS") patch.resolvedAt = null;
  }

  // Catatan penyelesaian (pengelola / PIC)
  if (data.resolutionNote !== undefined && (canManage || isAssignee)) {
    patch.resolutionNote = data.resolutionNote || null;
  }

  if (Object.keys(patch).length === 0) throw new AuthError("Tidak ada perubahan yang dapat diterapkan", 400);

  await prisma.ticket.update({ where: { id }, data: patch });
  return ok({ success: true });
});

// DELETE /api/tickets/[id] — hapus tiket.
// - tickets.manage : boleh menghapus tiket apa pun.
// - Pengaju        : boleh menghapus tiketnya sendiri selama masih OPEN.
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AuthError("Tiket tidak ditemukan", 404);

  const canManage = user.permissions.includes("tickets.manage");
  const isRequester = ticket.requesterId === user.id;
  if (!canManage && !(isRequester && ticket.status === "OPEN")) {
    throw new AuthError("Tidak berwenang menghapus tiket ini", 403);
  }

  await prisma.ticket.delete({ where: { id } });
  return ok({ success: true });
});
