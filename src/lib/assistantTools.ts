// Definisi "tools" (function calling) untuk Asisten AI agar bisa MELAKUKAN aksi
// di aplikasi (bukan sekadar menjawab): input Task Log, kelola PDCA, dan
// mencatat/menghitung kinerja. Setiap tool memeriksa permission pengguna yang
// sedang login (defense-in-depth) dan hanya diekspos bila pengguna berwenang.

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import type { CurrentUser } from "./auth";
import { currentPeriod, getWeightedScore, computeSalary } from "./performance";
import { toDateOnly } from "./utils";

export type ToolResult = { content: string; isError?: boolean };

export interface AssistantTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
  /** Apakah tool ini tersedia untuk pengguna (berdasarkan permission). */
  available: (u: CurrentUser) => boolean;
  run: (input: unknown, user: CurrentUser) => Promise<ToolResult>;
}

const ok = (data: unknown): ToolResult => ({ content: JSON.stringify(data) });
const err = (message: string): ToolResult => ({ content: JSON.stringify({ error: message }), isError: true });

// Parse "YYYY-MM-DD" -> Date (UTC midnight, konsisten utk kolom @db.Date). Null bila kosong/invalid.
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ============ Tool: daftar karyawan (untuk resolusi nama -> id) ============
const listEmployees: AssistantTool = {
  name: "list_employees",
  description:
    "Ambil daftar karyawan (id, nama, role, department). Gunakan untuk menemukan id karyawan lain saat menugaskan PIC PDCA atau mencatat kinerja karyawan tertentu.",
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "Filter opsional berdasarkan nama/username" } },
  },
  available: (u) => u.permissions.includes("employees.view"),
  run: async (input) => {
    const { query } = z.object({ query: z.string().optional() }).parse(input ?? {});
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(query ? { OR: [{ fullName: { contains: query } }, { username: { contains: query } }] } : {}),
      },
      include: { role: { select: { name: true } }, department: { select: { id: true, name: true } } },
      take: 200,
      orderBy: { fullName: "asc" },
    });
    return ok(users.map((u) => ({
      id: u.id, fullName: u.fullName, role: u.role.name,
      departmentId: u.department?.id ?? null, department: u.department?.name ?? null,
    })));
  },
};

// ============ Tool: buat Task Log harian ============
const createTaskLog: AssistantTool = {
  name: "create_task_log",
  description:
    "Catat Task Log harian untuk pengguna yang sedang login. Gunakan saat pengguna ingin mencatat pekerjaan/aktivitas harian mereka.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Judul singkat pekerjaan" },
      description: { type: "string", description: "Detail pekerjaan (opsional)" },
      date: { type: "string", description: "Tanggal YYYY-MM-DD. Kosongkan untuk hari ini." },
      status: { type: "string", enum: ["PLANNED", "IN_PROGRESS", "DONE"], description: "Default DONE" },
      hours: { type: "number", description: "Durasi jam (0-24, opsional)" },
    },
    required: ["title"],
  },
  available: (u) => u.permissions.includes("tasklog.write"),
  run: async (input, user) => {
    const data = z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        date: z.string().optional(),
        status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]).default("DONE"),
        hours: z.number().min(0).max(24).optional(),
      })
      .parse(input);
    const log = await prisma.taskLog.create({
      data: {
        userId: user.id,
        date: parseDate(data.date) ?? toDateOnly(),
        title: data.title,
        description: data.description || null,
        status: data.status as any,
        hours: data.hours ?? null,
      },
    });
    return ok({ id: log.id, message: "Task log dibuat", title: log.title, date: log.date });
  },
};

// ============ Tool: lihat Task Log ============
const listTaskLogs: AssistantTool = {
  name: "list_task_logs",
  description: "Lihat Task Log terbaru (milik sendiri; manajer dgn tasklog.view_all melihat semua). Untuk konteks/rekap.",
  input_schema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Tanggal mulai YYYY-MM-DD (opsional)" },
      to: { type: "string", description: "Tanggal akhir YYYY-MM-DD (opsional)" },
    },
  },
  available: (u) => u.permissions.includes("tasklog.write") || u.permissions.includes("tasklog.view_all"),
  run: async (input, user) => {
    const { from, to } = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(input ?? {});
    const canViewAll = user.permissions.includes("tasklog.view_all");
    const logs = await prisma.taskLog.findMany({
      where: {
        ...(canViewAll ? {} : { userId: user.id }),
        ...(from || to
          ? { date: { ...(parseDate(from) ? { gte: parseDate(from)! } : {}), ...(parseDate(to) ? { lte: parseDate(to)! } : {}) } }
          : {}),
      },
      include: { user: { select: { fullName: true } } },
      orderBy: [{ date: "desc" }],
      take: 50,
    });
    return ok(logs.map((l) => ({ id: l.id, date: l.date, title: l.title, status: l.status, hours: l.hours, user: l.user.fullName })));
  },
};

// ============ Tool: lihat minggu & task PDCA ============
const listPdcaWeeks: AssistantTool = {
  name: "list_pdca_weeks",
  description:
    "Lihat daftar minggu PDCA beserta task di dalamnya (judul, department minggu, PIC, status selesai/belum). Gunakan untuk konteks atau menemukan id minggu/task sebelum menambah/mengubah.",
  input_schema: { type: "object", properties: {} },
  available: (u) => u.permissions.includes("pdca.view") || u.permissions.includes("pdca.manage"),
  run: async () => {
    const weeks = await prisma.pdcaWeek.findMany({
      include: {
        department: { select: { id: true, name: true } },
        tasks: {
          include: { user: { select: { fullName: true } } },
          orderBy: [{ order: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      take: 30,
    });
    return ok(
      weeks.map((w) => ({
        weekId: w.id,
        title: w.title,
        startDate: w.startDate,
        endDate: w.endDate,
        departmentId: w.department.id,
        department: w.department.name,
        tasks: w.tasks.map((t) => ({ taskId: t.id, title: t.title, status: t.status, pic: t.user.fullName, picUserId: t.userId })),
      }))
    );
  },
};

// ============ Tool: buat minggu PDCA baru ============
const createPdcaWeek: AssistantTool = {
  name: "create_pdca_week",
  description:
    "Buat minggu PDCA baru (mis. \"Week 1\") untuk SATU department tertentu, dengan periode tanggal opsional, sebagai wadah untuk task-task di minggu tersebut. Setiap minggu PDCA khusus untuk satu department — task & PIC di dalamnya harus dari department yang sama. Gunakan list_employees untuk melihat departmentId tiap orang (semua orang di department yang sama berbagi departmentId yang sama). Setelah dibuat, tambahkan task dengan add_pdca_task.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Judul minggu, mis. \"Week 1\"" },
      departmentId: { type: "number", description: "Id department pemilik minggu PDCA ini (wajib)" },
      startDate: { type: "string", description: "Tanggal mulai periode YYYY-MM-DD (opsional)" },
      endDate: { type: "string", description: "Tanggal akhir periode YYYY-MM-DD (opsional)" },
    },
    required: ["title", "departmentId"],
  },
  available: (u) => u.permissions.includes("pdca.manage"),
  run: async (input) => {
    const d = z
      .object({
        title: z.string().min(1),
        departmentId: z.number().int().positive(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .parse(input);
    const department = await prisma.department.findUnique({ where: { id: d.departmentId } });
    if (!department) return err(`Department id ${d.departmentId} tidak ditemukan`);
    const week = await prisma.pdcaWeek.create({
      data: { title: d.title, departmentId: d.departmentId, startDate: parseDate(d.startDate), endDate: parseDate(d.endDate) },
    });
    return ok({ weekId: week.id, message: "Minggu PDCA dibuat", title: week.title, department: department.name });
  },
};

// ============ Tool: tambah task ke minggu PDCA ============
const addPdcaTask: AssistantTool = {
  name: "add_pdca_task",
  description:
    "Tambahkan task/checklist item ke sebuah minggu PDCA (gunakan list_pdca_weeks untuk menemukan weekId, dan list_employees untuk menemukan id PIC bila bukan diri sendiri). PIC WAJIB berasal dari department yang sama dengan minggu tsb — tool akan menolak bila tidak sesuai.",
  input_schema: {
    type: "object",
    properties: {
      weekId: { type: "number", description: "Id minggu PDCA tujuan" },
      title: { type: "string", description: "Judul task" },
      userId: { type: "number", description: "Id PIC (penanggung jawab); default diri sendiri bila tidak diisi. Harus berasal dari department minggu ini." },
      status: { type: "string", enum: ["BELUM_SELESAI", "SELESAI"], description: "Default BELUM_SELESAI" },
    },
    required: ["weekId", "title"],
  },
  available: (u) => u.permissions.includes("pdca.manage"),
  run: async (input, user) => {
    const d = z
      .object({
        weekId: z.number().int().positive(),
        title: z.string().min(1),
        userId: z.number().int().positive().optional(),
        status: z.enum(["BELUM_SELESAI", "SELESAI"]).default("BELUM_SELESAI"),
      })
      .parse(input);
    const week = await prisma.pdcaWeek.findUnique({ where: { id: d.weekId } });
    if (!week) return err(`Minggu PDCA id ${d.weekId} tidak ditemukan`);
    const picUserId = d.userId ?? user.id;
    const pic = await prisma.user.findUnique({ where: { id: picUserId }, select: { departmentId: true } });
    if (!pic) return err(`PIC id ${picUserId} tidak ditemukan`);
    if (pic.departmentId !== week.departmentId) {
      return err("PIC harus berasal dari department minggu ini. Cek department PIC via list_employees.");
    }
    const count = await prisma.pdcaTask.count({ where: { weekId: d.weekId } });
    const task = await prisma.pdcaTask.create({
      data: { weekId: d.weekId, title: d.title, userId: picUserId, status: d.status, order: count },
    });
    return ok({ taskId: task.id, message: "Task ditambahkan", title: task.title, week: week.title });
  },
};

// ============ Tool: ubah status task PDCA (selesai/belum) ============
const updatePdcaTaskStatus: AssistantTool = {
  name: "update_pdca_task_status",
  description:
    "Tandai sebuah task PDCA sebagai selesai atau belum selesai. Gunakan list_pdca_weeks untuk menemukan taskId. Pengelola PDCA bisa menandai task siapa saja; pengguna biasa hanya bisa menandai task yang PIC-nya adalah dirinya sendiri.",
  input_schema: {
    type: "object",
    properties: {
      taskId: { type: "number", description: "Id task" },
      status: { type: "string", enum: ["BELUM_SELESAI", "SELESAI"] },
    },
    required: ["taskId", "status"],
  },
  available: (u) => u.permissions.includes("pdca.view") || u.permissions.includes("pdca.manage"),
  run: async (input, user) => {
    const d = z.object({ taskId: z.number().int().positive(), status: z.enum(["BELUM_SELESAI", "SELESAI"]) }).parse(input);
    const task = await prisma.pdcaTask.findUnique({ where: { id: d.taskId } });
    if (!task) return err(`Task id ${d.taskId} tidak ditemukan`);
    const canManage = user.permissions.includes("pdca.manage");
    if (!canManage && task.userId !== user.id) {
      return err("Anda hanya dapat menandai status task yang menjadi tanggung jawab Anda sendiri");
    }
    await prisma.pdcaTask.update({ where: { id: d.taskId }, data: { status: d.status } });
    return ok({ taskId: d.taskId, message: "Status task diperbarui", status: d.status });
  },
};

// ============ Tool: lihat metrik KPI ============
const listKpiMetrics: AssistantTool = {
  name: "list_kpi_metrics",
  description: "Lihat daftar metrik KPI (id, nama, bobot). Diperlukan sebelum mencatat skor kinerja (set_performance_score).",
  input_schema: { type: "object", properties: {} },
  available: (u) => u.permissions.includes("payroll.view") || u.permissions.includes("payroll.manage"),
  run: async () => {
    const metrics = await prisma.kpiMetric.findMany({ where: { active: true }, orderBy: { id: "asc" } });
    return ok(metrics.map((m) => ({ id: m.id, name: m.name, weight: m.weight, scopeUserId: m.userId })));
  },
};

// ============ Tool: ringkasan & perhitungan kinerja ============
const getPerformanceSummary: AssistantTool = {
  name: "get_performance_summary",
  description:
    "Hitung ringkasan kinerja seorang karyawan pada suatu periode: skor per-metrik, skor berbobot (0-100), dan estimasi komponen gaji berdasarkan capaian. Default: diri sendiri & periode berjalan.",
  input_schema: {
    type: "object",
    properties: {
      userId: { type: "number", description: "Id karyawan (opsional, default diri sendiri)" },
      period: { type: "string", description: "Periode YYYY-MM (opsional, default bulan berjalan)" },
    },
  },
  // Diri sendiri boleh; kinerja orang lain butuh payroll.view/manage.
  available: () => true,
  run: async (input, user) => {
    const { userId, period } = z
      .object({ userId: z.number().int().positive().optional(), period: z.string().optional() })
      .parse(input ?? {});
    const targetId = userId ?? user.id;
    const per = period || currentPeriod();
    if (targetId !== user.id && !user.permissions.includes("payroll.view") && !user.permissions.includes("payroll.manage")) {
      return err("Tidak berwenang melihat kinerja karyawan lain");
    }
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return err(`Karyawan id ${targetId} tidak ditemukan`);
    const records = await prisma.performanceRecord.findMany({ where: { userId: targetId, period: per }, include: { metric: true } });
    const weighted = await getWeightedScore(targetId, per);
    const salary = computeSalary({
      baseSalary: target.baseSalary,
      performanceAllowance: target.performanceAllowance,
      score: weighted,
    });
    return ok({
      user: target.fullName,
      period: per,
      metrics: records.map((r) => ({ metric: r.metric.name, weight: r.metric.weight, score: r.score })),
      weightedScore: weighted,
      salary: {
        baseSalary: salary.baseSalary,
        performanceAmount: salary.performanceAmount,
        totalSalary: salary.totalSalary,
      },
    });
  },
};

// ============ Tool: catat/ubah skor kinerja (mempengaruhi tunjangan) ============
const setPerformanceScore: AssistantTool = {
  name: "set_performance_score",
  description:
    "Catat/ubah skor capaian (0-100) sebuah metrik KPI untuk seorang karyawan pada suatu periode. PENTING: skor ini memengaruhi tunjangan kinerja & gaji. Pastikan metrik (list_kpi_metrics) dan karyawan (list_employees) benar. Default periode = bulan berjalan.",
  input_schema: {
    type: "object",
    properties: {
      userId: { type: "number", description: "Id karyawan" },
      metricId: { type: "number", description: "Id metrik KPI (dari list_kpi_metrics)" },
      score: { type: "number", description: "Capaian 0-100" },
      period: { type: "string", description: "Periode YYYY-MM (opsional, default bulan berjalan)" },
    },
    required: ["userId", "metricId", "score"],
  },
  available: (u) => u.permissions.includes("payroll.manage"),
  run: async (input) => {
    const d = z
      .object({
        userId: z.number().int().positive(),
        metricId: z.number().int().positive(),
        score: z.number().min(0).max(100),
        period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      })
      .parse(input);
    const per = d.period || currentPeriod();
    const metric = await prisma.kpiMetric.findUnique({ where: { id: d.metricId } });
    if (!metric) return err(`Metrik id ${d.metricId} tidak ditemukan`);
    const target = await prisma.user.findUnique({ where: { id: d.userId } });
    if (!target) return err(`Karyawan id ${d.userId} tidak ditemukan`);
    await prisma.performanceRecord.upsert({
      where: { userId_metricId_period: { userId: d.userId, metricId: d.metricId, period: per } },
      update: { score: d.score },
      create: { userId: d.userId, metricId: d.metricId, period: per, score: d.score },
    });
    const weighted = await getWeightedScore(d.userId, per);
    return ok({
      message: "Skor kinerja tersimpan",
      user: target.fullName,
      metric: metric.name,
      period: per,
      score: d.score,
      newWeightedScore: weighted,
    });
  },
};

export const ASSISTANT_TOOLS: AssistantTool[] = [
  listEmployees,
  createTaskLog,
  listTaskLogs,
  listPdcaWeeks,
  createPdcaWeek,
  addPdcaTask,
  updatePdcaTaskStatus,
  listKpiMetrics,
  getPerformanceSummary,
  setPerformanceScore,
];
