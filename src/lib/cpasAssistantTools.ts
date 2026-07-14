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

const listCpasPlans: AssistantTool = {
  name: "list_cpas_plans",
  description:
    "Lihat daftar CPAS Plan afiliasi yang tersimpan (id, judul, periode, PIC, ringkasan isi). Gunakan untuk menemukan rencana yang sudah ada sebelum membuat yang baru.",
  input_schema: { type: "object", properties: {} },
  available: (u) => u.permissions.includes("financial.view"),
  run: async () => {
    const rows = await prisma.cpasPlan.findMany({
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
        period: r.period,
        picName: r.pic?.fullName ?? null,
        createdByName: r.createdBy.fullName,
        createdAt: r.createdAt,
      }))
    );
  },
};

const saveCpasPlan: AssistantTool = {
  name: "save_cpas_plan",
  description:
    "Simpan CPAS Plan afiliasi baru ke database. CPAS = Content (rencana konten), Promo (detail promosi), Audience (target audiens), Strategy (strategi keseluruhan). Sertakan periode (mis. 'Juli 2026') dan PIC opsional (cari id dengan list_employees).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Judul plan, mis. 'CPAS Afiliasi Juli 2026'" },
      period: { type: "string", description: "Periode, mis. 'Juli 2026'" },
      content: { type: "string", description: "Rencana konten yang akan dibuat/dipublikasikan" },
      promo: { type: "string", description: "Detail promosi (diskon, voucher, event, dll.)" },
      audience: { type: "string", description: "Deskripsi target audiens" },
      strategy: { type: "string", description: "Strategi keseluruhan program afiliasi" },
      picUserId: { type: "number", description: "Id User PIC/penanggung jawab (opsional)" },
    },
    required: ["title", "period", "content", "promo", "audience", "strategy"],
  },
  available: (u) => u.permissions.includes("financial.upload"),
  run: async (input, user) => {
    const d = z
      .object({
        title: z.string().min(1),
        period: z.string().min(1),
        content: z.string().min(1),
        promo: z.string().min(1),
        audience: z.string().min(1),
        strategy: z.string().min(1),
        picUserId: z.number().int().positive().optional(),
      })
      .parse(input);
    if (d.picUserId) {
      const pic = await prisma.user.findUnique({ where: { id: d.picUserId } });
      if (!pic) return err(`User PIC id ${d.picUserId} tidak ditemukan`);
    }
    const created = await prisma.cpasPlan.create({
      data: {
        title: d.title,
        period: d.period,
        content: d.content,
        promo: d.promo,
        audience: d.audience,
        strategy: d.strategy,
        picId: d.picUserId ?? null,
        createdById: user.id,
      },
      include: { pic: { select: { fullName: true } } },
    });
    return ok({
      message: "CPAS Plan berhasil disimpan",
      id: created.id,
      title: created.title,
      period: created.period,
      picName: created.pic?.fullName ?? null,
    });
  },
};

export const CPAS_ASSISTANT_TOOLS: AssistantTool[] = [listCpasPlans, saveCpasPlan];
