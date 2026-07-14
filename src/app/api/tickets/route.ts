import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, requirePermission, AuthError } from "@/lib/auth";

// GET /api/tickets?scope=mine|all&status=OPEN
// scope=mine  -> tiket yang saya ajukan ATAU yang ditugaskan ke saya
// scope=all   -> semua tiket (butuh tickets.view_all / tickets.manage)
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
  const status = req.nextUrl.searchParams.get("status");

  const canViewAll = user.permissions.includes("tickets.view_all") || user.permissions.includes("tickets.manage");
  if (scope === "all" && !canViewAll) throw new AuthError("Tidak berwenang melihat semua tiket", 403);

  const rows = await prisma.ticket.findMany({
    where: {
      ...(scope === "all" ? {} : { OR: [{ requesterId: user.id }, { assigneeId: user.id }] }),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      requester: { select: { id: true, fullName: true, department: { select: { name: true } } } },
      assignee: { select: { id: true, fullName: true } },
      _count: { select: { comments: true } },
    },
    // Prioritaskan yang belum selesai & terbaru
    orderBy: [{ createdAt: "desc" }],
  });

  return ok(
    rows.map((t) => ({
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
      commentCount: t._count.comments,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  );
});

const createSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  description: z.string().min(3, "Deskripsi minimal 3 karakter"),
  category: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  // Hanya dipakai oleh pengelola (tickets.manage). Pengaju biasa mengabaikannya.
  assigneeId: z.coerce.number().int().positive().optional().nullable(),
  dueDate: z.string().optional().or(z.literal("")),
});

// POST /api/tickets — ajukan tiket baru. Butuh tickets.create.
export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("tickets.create");
  const data = createSchema.parse(await req.json());

  const canManage = user.permissions.includes("tickets.manage");

  const ticket = await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category || "Umum",
      priority: data.priority,
      requesterId: user.id,
      // PIC & due date hanya boleh diset saat membuat oleh pengelola tiket
      assigneeId: canManage ? data.assigneeId || null : null,
      dueDate: canManage && data.dueDate ? new Date(data.dueDate) : null,
    },
  });
  return ok({ id: ticket.id }, 201);
});
