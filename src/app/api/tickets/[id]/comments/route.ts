import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";

const schema = z.object({ body: z.string().min(1, "Komentar tidak boleh kosong") });

// POST /api/tickets/[id]/comments — tambah komentar/diskusi.
// Boleh oleh siapa saja yang berhak melihat tiket (pengaju, PIC, atau pengelola).
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const ticketId = Number((await ctx.params).id);
  const { body } = schema.parse(await req.json());

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AuthError("Tiket tidak ditemukan", 404);

  const canViewAll = user.permissions.includes("tickets.view_all") || user.permissions.includes("tickets.manage");
  const isParticipant = ticket.requesterId === user.id || ticket.assigneeId === user.id;
  if (!canViewAll && !isParticipant) throw new AuthError("Tidak berwenang berkomentar pada tiket ini", 403);

  const comment = await prisma.ticketComment.create({
    data: { ticketId, authorId: user.id, body },
  });
  return ok({ id: comment.id }, 201);
});
