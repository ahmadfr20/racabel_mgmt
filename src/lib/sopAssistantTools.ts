import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import type { CurrentUser } from "./auth";

export type ToolResult = { content: string; isError?: boolean };
export interface AssistantTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  available: (u: CurrentUser) => boolean;
  run: (input: unknown, user: CurrentUser) => Promise<ToolResult>;
}

const ok = (data: unknown): ToolResult => ({ content: JSON.stringify(data) });
const err = (message: string): ToolResult => ({ content: JSON.stringify({ error: message }), isError: true });

const listSopPlans: AssistantTool = {
  name: "list_sop_plans",
  description:
    "Lihat daftar SOP Plan afiliasi yang tersimpan (id, judul, departemen, PIC, status). Gunakan untuk konteks atau sebelum membuat SOP baru.",
  input_schema: { type: "object", properties: {} },
  available: (u) => u.permissions.includes("financial.view"),
  run: async () => {
    const rows = await prisma.sopPlan.findMany({
      include: {
        pic: { select: { fullName: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        department: r.department,
        status: r.status,
        picName: r.pic?.fullName ?? null,
        createdByName: r.createdBy.fullName,
        createdAt: r.createdAt,
      }))
    );
  },
};

const saveSopPlan: AssistantTool = {
  name: "save_sop_plan",
  description:
    "Buat dan simpan SOP (Standar Operasional Prosedur) afiliasi baru ke database. Sertakan judul, deskripsi lengkap prosedur, nama departemen terkait, PIC opsional (cari id dengan list_employees), dan status (DRAFT/ACTIVE/ARCHIVED, default DRAFT).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Judul SOP, mis. 'SOP Onboarding Affiliate Baru'" },
      description: { type: "string", description: "Isi/deskripsi lengkap SOP" },
      department: { type: "string", description: "Nama departemen terkait, mis. 'Affiliate Marketing'" },
      picUserId: { type: "number", description: "Id User PIC/penanggung jawab (opsional)" },
      status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"], description: "Status SOP, default DRAFT" },
    },
    required: ["title", "description", "department"],
  },
  available: (u) => u.permissions.includes("financial.upload"),
  run: async (input, user) => {
    const d = z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        department: z.string().min(1),
        picUserId: z.number().int().positive().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
      })
      .parse(input);
    if (d.picUserId) {
      const pic = await prisma.user.findUnique({ where: { id: d.picUserId } });
      if (!pic) return err(`User PIC id ${d.picUserId} tidak ditemukan`);
    }
    const created = await prisma.sopPlan.create({
      data: {
        title: d.title,
        description: d.description,
        department: d.department,
        picId: d.picUserId ?? null,
        status: d.status,
        createdById: user.id,
      },
      include: { pic: { select: { fullName: true } } },
    });
    return ok({
      message: "SOP Plan berhasil disimpan",
      id: created.id,
      title: created.title,
      department: created.department,
      status: created.status,
      picName: created.pic?.fullName ?? null,
    });
  },
};

export const SOP_ASSISTANT_TOOLS: AssistantTool[] = [listSopPlans, saveSopPlan];
