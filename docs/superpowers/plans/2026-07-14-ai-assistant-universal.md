# AI Assistant Universal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah halaman `/financial` menjadi AI Assistant universal yang menggabungkan tools keuangan, PDCA, task log, KPI/gaji, plus CPAS Plan dan SOP Plan afiliasi; sidebar item diganti menjadi "AI Assistant".

**Architecture:** Tambah dua model Prisma baru (CpasPlan, SopPlan), buat tool files baru, tambahkan `sendAIAssistantChat()` di anthropic.ts yang menggabungkan semua 19 tool, update route financial-chat, ganti dua komponen lama (FinancialClient + FinancialAssistantChat) dengan versi baru yang memiliki 3 tab di bawah chat (Keuangan / CPAS Plans / SOP Plans).

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma 6, MySQL, Tailwind CSS, Anthropic SDK, Zod, Lucide React

## Global Constraints

- Bahasa UI tetap Bahasa Indonesia
- Tidak ada permission key baru — gunakan `financial.view` / `financial.upload` untuk CPAS & SOP
- `npx prisma db push` (bukan migrate) untuk terapkan schema
- Max file size tetap 8MB, format file chat tetap sama
- Semua existing data (riwayat impor, komparasi) tidak terganggu
- TypeScript: tidak boleh ada error baru (`npx tsc --noEmit`)
- Commit setelah setiap task selesai

---

### Task 1: Prisma Schema — tambah CpasPlan, SopPlan, SopStatus, relasi User

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.cpasPlan` dan `prisma.sopPlan` siap dipakai di task berikutnya

- [ ] **Step 1: Tambah enum SopStatus dan model CpasPlan di schema.prisma**

Buka `prisma/schema.prisma`. Tambahkan blok berikut di akhir file (setelah model `TicketComment`):

```prisma
// ============ AI Assistant: CPAS Plan & SOP Plan ============

enum SopStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

model CpasPlan {
  id          Int      @id @default(autoincrement())
  title       String
  period      String
  content     String   @db.Text
  promo       String   @db.Text
  audience    String   @db.Text
  strategy    String   @db.Text
  pic         User?    @relation("CpasPic", fields: [picId], references: [id])
  picId       Int?
  createdBy   User     @relation("CpasCreator", fields: [createdById], references: [id], onDelete: Cascade)
  createdById Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdById])
}

model SopPlan {
  id          Int       @id @default(autoincrement())
  title       String
  description String    @db.Text
  department  String
  pic         User?     @relation("SopPic", fields: [picId], references: [id])
  picId       Int?
  status      SopStatus @default(DRAFT)
  createdBy   User      @relation("SopCreator", fields: [createdById], references: [id], onDelete: Cascade)
  createdById Int
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([createdById])
}
```

- [ ] **Step 2: Tambah 4 relasi baru di model User**

Cari bagian akhir relasi User (setelah `ticketComments`):

```prisma
  ticketComments       TicketComment[]       @relation("TicketCommentAuthor")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
```

Ganti dengan:

```prisma
  ticketComments       TicketComment[]       @relation("TicketCommentAuthor")
  cpasPicAssigned      CpasPlan[]            @relation("CpasPic")
  cpasCreated          CpasPlan[]            @relation("CpasCreator")
  sopPicAssigned       SopPlan[]             @relation("SopPic")
  sopCreated           SopPlan[]             @relation("SopCreator")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
```

- [ ] **Step 3: Jalankan prisma db push**

```powershell
cd "D:\Racabel\racabeldashboard\racabel_mgmt"
npx prisma db push
```

Expected output (kira-kira):
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": MySQL database "hrapp" at "localhost:3306"

Your database is now in sync with your Prisma schema.
```

- [ ] **Step 4: Regenerate Prisma client**

```powershell
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output (tidak ada error).

- [ ] **Step 6: Commit**

```powershell
git add prisma/schema.prisma
git commit -m "feat: tambah model CpasPlan dan SopPlan di schema Prisma"
```

---

### Task 2: CPAS & SOP Assistant Tools

**Files:**
- Create: `src/lib/cpasAssistantTools.ts`
- Create: `src/lib/sopAssistantTools.ts`

**Interfaces:**
- Produces:
  - `CPAS_ASSISTANT_TOOLS: AssistantTool[]` dari `cpasAssistantTools.ts`
  - `SOP_ASSISTANT_TOOLS: AssistantTool[]` dari `sopAssistantTools.ts`
  - `AssistantTool` type: `{ name, description, input_schema, available(u), run(input, user) }`

- [ ] **Step 1: Buat src/lib/cpasAssistantTools.ts**

```typescript
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
```

- [ ] **Step 2: Buat src/lib/sopAssistantTools.ts**

```typescript
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
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/cpasAssistantTools.ts src/lib/sopAssistantTools.ts
git commit -m "feat: tambah CPAS dan SOP assistant tools"
```

---

### Task 3: API Routes untuk CPAS dan SOP (GET list + DELETE)

**Files:**
- Create: `src/app/api/cpas/route.ts`
- Create: `src/app/api/cpas/[id]/route.ts`
- Create: `src/app/api/sop/route.ts`
- Create: `src/app/api/sop/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma.cpasPlan`, `prisma.sopPlan` (dari Task 1)
- Produces:
  - `GET /api/cpas` → `CpasPlan[]` dengan field: `id, title, period, content, promo, audience, strategy, picName, createdByName, createdAt`
  - `DELETE /api/cpas/[id]` → `{ ok: true }`
  - `GET /api/sop` → `SopPlan[]` dengan field: `id, title, description, department, picName, status, createdByName, createdAt`
  - `DELETE /api/sop/[id]` → `{ ok: true }`

- [ ] **Step 1: Buat src/app/api/cpas/route.ts**

```typescript
import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = handle(async (_req: NextRequest) => {
  await requirePermission("financial.view");
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
      content: r.content,
      promo: r.promo,
      audience: r.audience,
      strategy: r.strategy,
      picName: r.pic?.fullName ?? null,
      createdByName: r.createdBy.fullName,
      createdAt: r.createdAt,
    }))
  );
});
```

- [ ] **Step 2: Buat src/app/api/cpas/[id]/route.ts**

```typescript
import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth";

export const DELETE = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requirePermission("financial.upload");
  const { id } = await params;
  const record = await prisma.cpasPlan.findUnique({ where: { id: Number(id) } });
  if (!record) throw new AuthError("CPAS Plan tidak ditemukan", 404);
  await prisma.cpasPlan.delete({ where: { id: Number(id) } });
  return ok({ ok: true });
});
```

- [ ] **Step 3: Buat src/app/api/sop/route.ts**

```typescript
import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = handle(async (_req: NextRequest) => {
  await requirePermission("financial.view");
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
      description: r.description,
      department: r.department,
      picName: r.pic?.fullName ?? null,
      status: r.status,
      createdByName: r.createdBy.fullName,
      createdAt: r.createdAt,
    }))
  );
});
```

- [ ] **Step 4: Buat src/app/api/sop/[id]/route.ts**

```typescript
import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth";

export const DELETE = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requirePermission("financial.upload");
  const { id } = await params;
  const record = await prisma.sopPlan.findUnique({ where: { id: Number(id) } });
  if (!record) throw new AuthError("SOP Plan tidak ditemukan", 404);
  await prisma.sopPlan.delete({ where: { id: Number(id) } });
  return ok({ ok: true });
});
```

- [ ] **Step 5: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/cpas/ src/app/api/sop/
git commit -m "feat: tambah API routes GET dan DELETE untuk CPAS dan SOP Plans"
```

---

### Task 4: anthropic.ts — tambah sendAIAssistantChat() dan unified tools

**Files:**
- Modify: `src/lib/anthropic.ts`

**Interfaces:**
- Consumes: `CPAS_ASSISTANT_TOOLS` dari `cpasAssistantTools.ts`, `SOP_ASSISTANT_TOOLS` dari `sopAssistantTools.ts`, `ASSISTANT_TOOLS` dari `assistantTools.ts`, `FINANCIAL_ASSISTANT_TOOLS` dari `financialAssistantTools.ts`
- Produces: `sendAIAssistantChat(messages, user, attachment?)` — dipanggil oleh route di Task 5

- [ ] **Step 1: Tambah import di awal anthropic.ts**

Cari baris import di awal file `src/lib/anthropic.ts`:

```typescript
import { toolsForUser } from "./assistantTools";
import { financialToolsForUser } from "./financialAssistantTools";
```

Ganti dengan:

```typescript
import { toolsForUser, ASSISTANT_TOOLS } from "./assistantTools";
import { financialToolsForUser, FINANCIAL_ASSISTANT_TOOLS } from "./financialAssistantTools";
import { CPAS_ASSISTANT_TOOLS } from "./cpasAssistantTools";
import { SOP_ASSISTANT_TOOLS } from "./sopAssistantTools";
import type { AssistantTool } from "./financialAssistantTools";
```

- [ ] **Step 2: Tambah fungsi aiAssistantToolsForUser dan buildAIAssistantSystemPrompt di anthropic.ts**

Tambahkan blok berikut **tepat sebelum** baris `// ============ Asisten Keuangan AI (chat di halaman Keuangan) ============` (sekitar baris 241):

```typescript
// ============ AI Assistant universal (gabungan semua tool) ============

const ALL_AI_ASSISTANT_TOOLS: AssistantTool[] = [
  ...FINANCIAL_ASSISTANT_TOOLS,
  ...ASSISTANT_TOOLS,
  ...CPAS_ASSISTANT_TOOLS,
  ...SOP_ASSISTANT_TOOLS,
];

function aiAssistantToolsForUser(user: CurrentUser): { defs: Anthropic.Tool[]; map: Map<string, AssistantTool> } {
  const available = ALL_AI_ASSISTANT_TOOLS.filter((t) => t.available(user));
  return {
    defs: available.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    map: new Map(available.map((t) => [t.name, t])),
  };
}

function buildAIAssistantSystemPrompt(user: CurrentUser, toolNames: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Anda adalah AI Assistant pada aplikasi "Racabel HQ Management". Anda dapat MELAKUKAN aksi nyata melalui tools yang tersedia — bukan sekadar menjawab.

Konteks pengguna saat ini:
- Nama: ${user.fullName} (id: ${user.id})
- Role: ${user.role.name}${user.department ? ` · Department: ${user.department.name}` : ""}
- Tanggal hari ini: ${today}
- Periode kinerja berjalan: ${currentPeriod()}

Tools yang tersedia untuk pengguna ini: ${toolNames.length ? toolNames.join(", ") : "(tidak ada — hanya akses lihat terbatas)"}.

Kemampuan Anda:
1. **Keuangan**: Lihat riwayat impor, hitung total/komparasi, simpan transaksi baru, simpan komparasi. Bila ada file atau gambar terlampir (Excel/CSV/PDF/struk/nota), baca dan identifikasi transaksinya (tanggal, deskripsi, kategori, nominal).
2. **PDCA**: Buat minggu PDCA (create_pdca_week), tambah task dengan PIC (add_pdca_task), tandai status (update_pdca_task_status). Format sederhana: satu minggu berisi daftar task dengan judul + PIC + status.
3. **Task Log**: Catat aktivitas harian (create_task_log), lihat rekap (list_task_logs).
4. **Kinerja & Gaji**: Lihat metrik KPI (list_kpi_metrics), hitung estimasi gaji (get_performance_summary), catat skor kinerja (set_performance_score). PERHATIAN: skor memengaruhi tunjangan & gaji.
5. **CPAS Plan Afiliasi**: Buat rencana Content, Promo, Audience, Strategy afiliasi (save_cpas_plan), lihat daftar (list_cpas_plans).
6. **SOP Plan**: Buat Standar Operasional Prosedur afiliasi (save_sop_plan), lihat daftar (list_sop_plans).

Pedoman:
- Gunakan tools untuk benar-benar membuat/mengubah data ketika pengguna memintanya.
- Untuk PIC atau karyawan lain, cari id dulu dengan list_employees.
- Untuk skor kinerja, ambil id metrik dengan list_kpi_metrics terlebih dahulu.
- Nominal keuangan selalu angka positif tanpa simbol mata uang. Asumsikan IDR bila tidak disebutkan.
- Bila informasi kurang jelas, buat asumsi wajar dan sebutkan singkat, atau tanyakan bila benar-benar kritis.
- Setelah menyimpan data, konfirmasikan ringkas & spesifik (id, judul, atau total yang dibuat).
- Jika tool mengembalikan error, jelaskan ke pengguna dengan bahasa mudah.
- Jawab dalam Bahasa Indonesia, singkat, jelas, dan berorientasi aksi.`;
}

export async function sendAIAssistantChat(
  messages: ChatMessage[],
  user: CurrentUser,
  attachment?: FinancialAttachment
): Promise<string> {
  const anthropic = getClient();
  const { defs, map } = aiAssistantToolsForUser(user);
  const system = buildAIAssistantSystemPrompt(user, [...map.keys()]);

  const lastUserIdx = messages.length - 1;
  const convo: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (attachment && i === lastUserIdx && m.role === "user") {
      let blocks: Anthropic.ContentBlockParam[];
      if (attachment.kind === "pdf") {
        blocks = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.data } }];
      } else if (attachment.kind === "image") {
        blocks = [{ type: "image", source: { type: "base64", media_type: attachment.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: attachment.data } }];
      } else {
        blocks = [{ type: "text", text: `Isi file terlampir (${attachment.fileName}):\n\n${attachment.data}` }];
      }
      if (m.content) blocks.push({ type: "text", text: m.content });
      return { role: "user", content: blocks };
    }
    return { role: m.role, content: m.content };
  });

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      tools: defs,
      messages: convo,
    });

    if (response.stop_reason === "refusal") {
      return "Maaf, saya tidak dapat membantu permintaan ini karena kebijakan keamanan.";
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "Maaf, terjadi kesalahan saat menghasilkan balasan. Coba lagi.";
    }

    convo.push({ role: "assistant", content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const tool = map.get(tu.name);
      let res;
      if (!tool) {
        res = { content: JSON.stringify({ error: `Tool ${tu.name} tidak tersedia` }), isError: true };
      } else {
        try {
          res = await tool.run(tu.input, user);
        } catch (e) {
          res = { content: JSON.stringify({ error: e instanceof Error ? e.message : "Gagal menjalankan aksi" }), isError: true };
        }
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: res.content, is_error: res.isError });
    }
    convo.push({ role: "user", content: results });
  }

  return "Maaf, permintaan ini terlalu kompleks untuk saya selesaikan sekarang. Coba pecah menjadi langkah yang lebih kecil.";
}
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/anthropic.ts
git commit -m "feat: tambah sendAIAssistantChat dengan semua 19 tool gabungan"
```

---

### Task 5: Update financial-chat route — pakai sendAIAssistantChat

**Files:**
- Modify: `src/app/api/assistant/financial-chat/route.ts`

**Interfaces:**
- Consumes: `sendAIAssistantChat` dari `anthropic.ts` (Task 4)
- Produces: Route yang memanggil `sendAIAssistantChat` bukan `sendFinancialAssistantChat`

- [ ] **Step 1: Ganti import dan pemanggilan fungsi**

Buka `src/app/api/assistant/financial-chat/route.ts`.

Cari baris import:

```typescript
import { isAnthropicConfigured, sendFinancialAssistantChat, type ChatMessage, type FinancialAttachment } from "@/lib/anthropic";
```

Ganti dengan:

```typescript
import { isAnthropicConfigured, sendAIAssistantChat, type ChatMessage, type FinancialAttachment } from "@/lib/anthropic";
```

Cari baris pemanggilan:

```typescript
  const reply = await sendFinancialAssistantChat(messages, user, attachment);
```

Ganti dengan:

```typescript
  const reply = await sendAIAssistantChat(messages, user, attachment);
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output.

- [ ] **Step 3: Commit**

```powershell
git add src/app/api/assistant/financial-chat/route.ts
git commit -m "feat: financial-chat route pakai sendAIAssistantChat (universal)"
```

---

### Task 6: Buat AIAssistantChat.tsx (menggantikan FinancialAssistantChat.tsx)

**Files:**
- Create: `src/components/financial/AIAssistantChat.tsx`
- Delete: `src/components/financial/FinancialAssistantChat.tsx`

**Interfaces:**
- Produces: `AIAssistantChat({ canUpload, onDataChanged })` — sama seperti sebelumnya, hanya suggestion chips dan subtitle yang berbeda

- [ ] **Step 1: Buat src/components/financial/AIAssistantChat.tsx**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, GitCompareArrows, Paperclip, Send, User, X, FileText, ClipboardList } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  attachmentName?: string;
  attachmentImageUrl?: string;
}

const SUGGESTIONS = [
  { icon: FileText, text: "Buat CPAS Plan afiliasi untuk bulan ini." },
  { icon: GitCompareArrows, text: "Bandingkan total pengeluaran bulan ini dengan bulan lalu, lalu simpan hasilnya." },
  { icon: ClipboardList, text: "Tambahkan task PDCA minggu ini." },
  { icon: FileText, text: "Buat SOP prosedur onboarding affiliate dan simpan sebagai Draft." },
];

const ACCEPT = ".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.webp";
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export function AIAssistantChat({ canUpload, onDataChanged }: { canUpload: boolean; onDataChanged: () => void }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (statusLoaded) return;
    apiFetch<{ configured: boolean }>("/api/assistant/status")
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(null))
      .finally(() => setStatusLoaded(true));
  }, [statusLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Ukuran file maksimal 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    if (IMAGE_EXT_RE.test(file.name)) {
      setPendingImageUrl(URL.createObjectURL(file));
    } else {
      setPendingImageUrl(null);
    }
    setPendingFile(file);
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (sending) return;
    if (!text && !pendingFile) return;

    const content = text || `Tolong baca dan identifikasi isi file "${pendingFile?.name}" ini.`;
    const userMsg: DisplayMessage = {
      role: "user",
      content,
      attachmentName: pendingFile?.name,
      attachmentImageUrl: pendingImageUrl ?? undefined,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    const fileToSend = pendingFile;
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl);
    setPendingImageUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("messages", JSON.stringify(next.map(({ role, content }) => ({ role, content }))));
      if (fileToSend) formData.append("file", fileToSend);

      const res = await fetch("/api/assistant/financial-chat", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Terjadi kesalahan");

      setConfigured(data.configured);
      setMessages((cur) => [...cur, { role: "assistant", content: data.reply }]);
      onDataChanged();
    } catch (err) {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mb-6 !p-0 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
          <Bot className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">AI Assistant</p>
          <p className="text-xs text-slate-400">Kelola keuangan, PDCA, task log, kinerja, serta buat CPAS Plan &amp; SOP afiliasi.</p>
        </div>
      </div>

      {configured === false && (
        <div className="border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 px-5 py-2 text-xs text-amber-700 dark:text-amber-400">
          Belum aktif — admin perlu mengatur ANTHROPIC_API_KEY di server.
        </div>
      )}

      <div className="max-h-[60vh] min-h-[20rem] space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Contoh perintah yang bisa Anda coba:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-left text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" /> {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex items-start gap-2", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}
            >
              {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>
            <div className={cn("max-w-[80%]", m.role === "user" && "flex flex-col items-end")}>
              {m.attachmentImageUrl ? (
                <div className="mb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.attachmentImageUrl}
                    alt={m.attachmentName ?? "gambar"}
                    className="max-h-48 max-w-xs rounded-xl object-contain border border-slate-200 dark:border-slate-600"
                  />
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Paperclip className="h-3 w-3" /> {m.attachmentName}
                  </span>
                </div>
              ) : m.attachmentName ? (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Paperclip className="h-3 w-3" /> {m.attachmentName}
                </span>
              ) : null}
              <div
                className={cn(
                  "whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                )}
              >
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-start gap-2">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <Bot className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-700 px-3 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "-0.3s" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "-0.15s" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {fileError && <div className="px-5 pb-2 text-xs text-red-600 dark:text-red-400">{fileError}</div>}
      {pendingFile && (
        <div className="mx-5 mb-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          {pendingImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pendingImageUrl} alt={pendingFile.name} className="mb-2 max-h-32 max-w-full rounded-lg object-contain" />
          )}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> {pendingFile.name}</span>
            <button
              onClick={() => { if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl); setPendingImageUrl(null); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 p-4"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        {canUpload && (
          <label className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-600" title="Lampirkan file (Excel/CSV/PDF/Gambar)">
            <Paperclip className="h-4.5 w-4.5" />
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={pickFile} />
          </label>
        )}
        <input
          className="input flex-1 !py-2 text-sm"
          placeholder="Tulis perintah, mis. buat CPAS Plan, input task PDCA, atau bandingkan keuangan..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" className="btn-primary !px-3 !py-2" disabled={sending || (!input.trim() && !pendingFile)}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 2: Hapus file lama**

```powershell
Remove-Item "D:\Racabel\racabeldashboard\racabel_mgmt\src\components\financial\FinancialAssistantChat.tsx"
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output (file lama sudah tidak diimport oleh siapapun setelah Task 7 & 8 selesai — jika ada error sementara karena FinancialClient.tsx masih mengimport file lama, itu akan selesai di Task 7).

- [ ] **Step 4: Commit**

```powershell
git add src/components/financial/AIAssistantChat.tsx
git rm src/components/financial/FinancialAssistantChat.tsx
git commit -m "feat: buat AIAssistantChat dengan 4 suggestion chips universal"
```

---

### Task 7: Buat AIAssistantClient.tsx dengan 3 tab (Keuangan / CPAS Plans / SOP Plans)

**Files:**
- Create: `src/components/financial/AIAssistantClient.tsx`
- Delete: `src/components/financial/FinancialClient.tsx`

**Interfaces:**
- Consumes:
  - `AIAssistantChat` dari `./AIAssistantChat`
  - `GET /api/cpas` → `CpasPlan[]`: `{ id, title, period, content, promo, audience, strategy, picName, createdByName, createdAt }`
  - `GET /api/sop` → `SopPlan[]`: `{ id, title, description, department, picName, status, createdByName, createdAt }`
  - `DELETE /api/cpas/[id]` dan `DELETE /api/sop/[id]`
  - Existing: `GET /api/financial/import`, `GET /api/financial/comparisons`, `DELETE /api/financial/import/[id]`, `DELETE /api/financial/comparisons/[id]`
- Produces: `AIAssistantClient({ canUpload })` — dipakai di page.tsx

- [ ] **Step 1: Buat src/components/financial/AIAssistantClient.tsx**

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileSpreadsheet, GitCompareArrows, Loader2, TrendingDown, TrendingUp, Trash2, Wallet,
  FileText, BookOpen,
} from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, PageHeader, StatCard, EmptyState } from "@/components/ui";
import { AIAssistantChat } from "@/components/financial/AIAssistantChat";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportSummary {
  id: number; fileName: string; status: "PROCESSING" | "COMPLETED" | "FAILED";
  currency: string; totalIncome: number; totalExpense: number;
  aiNotes: string | null; errorMessage: string | null;
  transactionCount: number; uploadedByName: string; createdAt: string;
}

interface Transaction {
  id: number; date: string; description: string; category: string;
  type: "INCOME" | "EXPENSE"; amount: number; notes: string | null;
}

interface ImportDetail {
  id: number; fileName: string; status: "PROCESSING" | "COMPLETED" | "FAILED";
  currency: string; totalIncome: number; totalExpense: number;
  aiNotes: string | null; errorMessage: string | null; createdAt: string;
  uploadedBy: { fullName: string }; transactions: Transaction[];
}

interface Comparison {
  id: number; title: string; scopeALabel: string; scopeBLabel: string;
  totalIncomeA: number; totalExpenseA: number; totalIncomeB: number; totalExpenseB: number;
  analysis: string; createdByName: string; createdAt: string;
}

interface CpasPlan {
  id: number; title: string; period: string; content: string; promo: string;
  audience: string; strategy: string; picName: string | null;
  createdByName: string; createdAt: string;
}

interface SopPlan {
  id: number; title: string; description: string; department: string;
  picName: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdByName: string; createdAt: string;
}

type ActiveTab = "keuangan" | "cpas" | "sop";

// ─── Main component ───────────────────────────────────────────────────────────

export function AIAssistantClient({ canUpload }: { canUpload: boolean }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("keuangan");

  // Keuangan
  const [history, setHistory] = useState<ImportSummary[]>([]);
  const [selected, setSelected] = useState<ImportDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loadingComparisons, setLoadingComparisons] = useState(true);

  // CPAS
  const [cpasList, setCpasList] = useState<CpasPlan[]>([]);
  const [loadingCpas, setLoadingCpas] = useState(true);

  // SOP
  const [sopList, setSopList] = useState<SopPlan[]>([]);
  const [loadingSop, setLoadingSop] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try { setHistory(await apiFetch<ImportSummary[]>("/api/financial/import")); }
    finally { setLoadingHistory(false); }
  }, []);

  const loadComparisons = useCallback(async () => {
    setLoadingComparisons(true);
    try { setComparisons(await apiFetch<Comparison[]>("/api/financial/comparisons")); }
    finally { setLoadingComparisons(false); }
  }, []);

  const loadCpas = useCallback(async () => {
    setLoadingCpas(true);
    try { setCpasList(await apiFetch<CpasPlan[]>("/api/cpas")); }
    finally { setLoadingCpas(false); }
  }, []);

  const loadSop = useCallback(async () => {
    setLoadingSop(true);
    try { setSopList(await apiFetch<SopPlan[]>("/api/sop")); }
    finally { setLoadingSop(false); }
  }, []);

  useEffect(() => {
    loadHistory();
    loadComparisons();
    loadCpas();
    loadSop();
  }, [loadHistory, loadComparisons, loadCpas, loadSop]);

  async function removeImport(id: number) {
    if (!confirm("Hapus riwayat impor ini beserta seluruh transaksinya?")) return;
    await apiFetch(`/api/financial/import/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await loadHistory();
  }

  async function removeComparison(id: number) {
    if (!confirm("Hapus riwayat komparasi ini?")) return;
    await apiFetch(`/api/financial/comparisons/${id}`, { method: "DELETE" });
    await loadComparisons();
  }

  async function removeCpas(id: number) {
    if (!confirm("Hapus CPAS Plan ini?")) return;
    await apiFetch(`/api/cpas/${id}`, { method: "DELETE" });
    await loadCpas();
  }

  async function removeSop(id: number) {
    if (!confirm("Hapus SOP Plan ini?")) return;
    await apiFetch(`/api/sop/${id}`, { method: "DELETE" });
    await loadSop();
  }

  async function openDetail(id: number) {
    const detail = await apiFetch<ImportDetail>(`/api/financial/import/${id}`);
    setSelected(detail);
  }

  function handleDataChanged() {
    loadHistory();
    loadComparisons();
    loadCpas();
    loadSop();
  }

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        subtitle="Chat dengan AI untuk mengelola keuangan, PDCA, task log, kinerja & gaji, serta membuat CPAS Plan dan SOP afiliasi."
      />

      <AIAssistantChat canUpload={canUpload} onDataChanged={handleDataChanged} />

      {selected && (
        <ImportResult
          detail={selected}
          onDelete={canUpload ? () => removeImport(selected.id) : undefined}
        />
      )}

      {/* ── Tab bar ── */}
      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(["keuangan", "cpas", "sop"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {tab === "keuangan" ? "Keuangan" : tab === "cpas" ? "CPAS Plans" : "SOP Plans"}
          </button>
        ))}
      </div>

      {/* ── Tab: Keuangan ── */}
      {activeTab === "keuangan" && (
        <>
          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Impor</h3>
            </div>
            {loadingHistory ? (
              <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : history.length === 0 ? (
              <EmptyState title="Belum ada riwayat impor" subtitle="File keuangan yang diunggah akan muncul di sini." icon={<FileSpreadsheet className="h-10 w-10" />} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-3 font-medium">File</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Transaksi</th>
                      <th className="px-5 py-3 font-medium">Pemasukan</th>
                      <th className="px-5 py-3 font-medium">Pengeluaran</th>
                      <th className="px-5 py-3 font-medium">Diunggah</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {history.map((h) => (
                      <tr key={h.id} className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40" onClick={() => h.status === "COMPLETED" && openDetail(h.id)}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{h.fileName}</p>
                          <p className="text-xs text-slate-400">oleh {h.uploadedByName}</p>
                        </td>
                        <td className="px-5 py-3"><ImportStatusBadge status={h.status} /></td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{h.transactionCount}</td>
                        <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400">{formatCurrency(h.totalIncome)}</td>
                        <td className="px-5 py-3 text-red-600 dark:text-red-400">{formatCurrency(h.totalExpense)}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(h.createdAt, true)}</td>
                        <td className="px-5 py-3 text-right">
                          {canUpload && (
                            <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={(e) => { e.stopPropagation(); removeImport(h.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="!p-0 overflow-hidden mt-6">
            <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Komparasi Keuangan</h3>
            </div>
            {loadingComparisons ? (
              <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : comparisons.length === 0 ? (
              <EmptyState title="Belum ada hasil komparasi" subtitle="Minta AI Assistant untuk membandingkan keuangan dan menyimpan hasilnya." icon={<GitCompareArrows className="h-10 w-10" />} />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {comparisons.map((c) => {
                  const netA = c.totalIncomeA - c.totalExpenseA;
                  const netB = c.totalIncomeB - c.totalExpenseB;
                  return (
                    <div key={c.id} className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{c.title}</p>
                          <p className="text-xs text-slate-400">oleh {c.createdByName} · {formatDate(c.createdAt, true)}</p>
                        </div>
                        {canUpload && (
                          <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={() => removeComparison(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.scopeALabel}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Pemasukan: {formatCurrency(c.totalIncomeA)}</p>
                          <p className="text-xs text-red-600 dark:text-red-400">Pengeluaran: {formatCurrency(c.totalExpenseA)}</p>
                          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Net: {formatCurrency(netA)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.scopeBLabel}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Pemasukan: {formatCurrency(c.totalIncomeB)}</p>
                          <p className="text-xs text-red-600 dark:text-red-400">Pengeluaran: {formatCurrency(c.totalExpenseB)}</p>
                          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Net: {formatCurrency(netB)}</p>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{c.analysis}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Tab: CPAS Plans ── */}
      {activeTab === "cpas" && (
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">CPAS Plans Afiliasi</h3>
          </div>
          {loadingCpas ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : cpasList.length === 0 ? (
            <EmptyState title="Belum ada CPAS Plan" subtitle="Minta AI Assistant untuk membuat CPAS Plan afiliasi." icon={<FileText className="h-10 w-10" />} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {cpasList.map((c) => (
                <div key={c.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{c.title}</p>
                      <p className="text-xs text-slate-400">
                        {c.period} · oleh {c.createdByName}{c.picName ? ` · PIC: ${c.picName}` : ""}
                        {" · "}{formatDate(c.createdAt, true)}
                      </p>
                    </div>
                    {canUpload && (
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={() => removeCpas(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["content", "promo", "audience", "strategy"] as const).map((field) => (
                      <div key={field} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {field === "content" ? "Content" : field === "promo" ? "Promo" : field === "audience" ? "Audience" : "Strategy"}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{c[field]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: SOP Plans ── */}
      {activeTab === "sop" && (
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">SOP Plans Afiliasi</h3>
          </div>
          {loadingSop ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : sopList.length === 0 ? (
            <EmptyState title="Belum ada SOP Plan" subtitle="Minta AI Assistant untuk membuat SOP prosedur afiliasi." icon={<BookOpen className="h-10 w-10" />} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {sopList.map((s) => (
                <div key={s.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                        <SopStatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-slate-400">
                        {s.department}{s.picName ? ` · PIC: ${s.picName}` : ""} · oleh {s.createdByName} · {formatDate(s.createdAt, true)}
                      </p>
                    </div>
                    {canUpload && (
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={() => removeSop(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{s.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ImportStatusBadge({ status }: { status: ImportSummary["status"] }) {
  const map: Record<ImportSummary["status"], string> = {
    COMPLETED: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    PROCESSING: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    FAILED: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  };
  const label: Record<ImportSummary["status"], string> = { COMPLETED: "Berhasil", PROCESSING: "Diproses", FAILED: "Gagal" };
  return <span className={cn("badge", map[status])}>{label[status]}</span>;
}

function SopStatusBadge({ status }: { status: SopPlan["status"] }) {
  const map: Record<SopPlan["status"], string> = {
    DRAFT: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    ACTIVE: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    ARCHIVED: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  };
  const label: Record<SopPlan["status"], string> = { DRAFT: "Draft", ACTIVE: "Aktif", ARCHIVED: "Diarsipkan" };
  return <span className={cn("badge", map[status])}>{label[status]}</span>;
}

function ImportResult({ detail, onDelete }: { detail: ImportDetail; onDelete?: () => void }) {
  const net = detail.totalIncome - detail.totalExpense;
  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hasil Ekstraksi — {detail.fileName}</h3>
          <p className="text-xs text-slate-400">Diunggah oleh {detail.uploadedBy.fullName} · {formatDate(detail.createdAt, true)}</p>
        </div>
        {onDelete && (
          <button className="btn-ghost !py-1.5 !px-3 text-xs text-red-600" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Hapus Riwayat Ini
          </button>
        )}
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatCurrency(detail.totalIncome)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Total Pengeluaran" value={formatCurrency(detail.totalExpense)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard label="Selisih (Net)" value={formatCurrency(net)} tone={net >= 0 ? "brand" : "amber"} icon={<Wallet className="h-5 w-5" />} />
      </div>
      {detail.aiNotes && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <span className="font-medium">Catatan AI: </span>{detail.aiNotes}
        </div>
      )}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Deskripsi</th>
                <th className="px-5 py-3 font-medium">Kategori</th>
                <th className="px-5 py-3 font-medium">Jenis</th>
                <th className="px-5 py-3 font-medium text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {detail.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(t.date)}</td>
                  <td className="px-5 py-3">
                    <p className="text-slate-800 dark:text-slate-100">{t.description}</p>
                    {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.category}</td>
                  <td className="px-5 py-3">
                    <span className={cn("badge", t.type === "INCOME" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
                      {t.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                    </span>
                  </td>
                  <td className={cn("px-5 py-3 text-right font-medium", t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {t.type === "INCOME" ? "+" : "-"}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {detail.transactions.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Tidak ada transaksi yang berhasil diekstrak.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Hapus FinancialClient.tsx lama**

```powershell
Remove-Item "D:\Racabel\racabeldashboard\racabel_mgmt\src\components\financial\FinancialClient.tsx"
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: tidak ada output (setelah Task 8 page.tsx diperbarui, semua import akan resolve).

- [ ] **Step 4: Commit**

```powershell
git add src/components/financial/AIAssistantClient.tsx
git rm src/components/financial/FinancialClient.tsx
git commit -m "feat: buat AIAssistantClient dengan 3 tab (Keuangan, CPAS Plans, SOP Plans)"
```

---

### Task 8: Update page.tsx, AppShell sidebar, dan TypeScript + build final

**Files:**
- Modify: `src/app/(app)/financial/page.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `AIAssistantClient` dari `src/components/financial/AIAssistantClient.tsx`

- [ ] **Step 1: Update src/app/(app)/financial/page.tsx**

Ganti seluruh isi file dengan:

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { AIAssistantClient } from "@/components/financial/AIAssistantClient";

export default async function AIAssistantPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "financial.view")) redirect("/dashboard");
  return <AIAssistantClient canUpload={can(user, "financial.upload")} />;
}
```

- [ ] **Step 2: Update AppShell.tsx — ganti sidebar item Keuangan**

Buka `src/components/AppShell.tsx`.

Cari baris import icons di atas:

```typescript
import {
  CalendarClock, CalendarDays, ChevronDown, ClipboardList, FileSpreadsheet, LayoutDashboard,
  LogOut, Menu, Moon, RefreshCcw, Settings, ShieldCheck, ShoppingBag, ShoppingCart,
  Store, Sun, Ticket, Users, Wallet, X,
} from "lucide-react";
```

Ganti dengan (tambahkan `Bot`, hapus `FileSpreadsheet`):

```typescript
import {
  Bot, CalendarClock, CalendarDays, ChevronDown, ClipboardList, LayoutDashboard,
  LogOut, Menu, Moon, RefreshCcw, Settings, ShieldCheck, ShoppingBag, ShoppingCart,
  Store, Sun, Ticket, Users, Wallet, X,
} from "lucide-react";
```

Cari item NAV untuk Keuangan:

```typescript
  { href: "/financial",  label: "Keuangan",      icon: FileSpreadsheet, anyOf: ["financial.view", "financial.upload"] },
```

Ganti dengan:

```typescript
  { href: "/financial",  label: "AI Assistant",  icon: Bot,             anyOf: ["financial.view", "financial.upload"] },
```

- [ ] **Step 3: TypeScript check final**

```powershell
npx tsc --noEmit 2>&1 | Select-String "error" | Select-Object -First 20
```

Expected: tidak ada output.

- [ ] **Step 4: Build Next.js**

```powershell
npx next build 2>&1 | Select-Object -Last 20
```

Expected: build berhasil, tidak ada error. Warning minor bisa diabaikan.

- [ ] **Step 5: Commit**

```powershell
git add src/app/(app)/financial/page.tsx src/components/AppShell.tsx
git commit -m "feat: update sidebar 'AI Assistant' dan page.tsx pakai AIAssistantClient"
```
