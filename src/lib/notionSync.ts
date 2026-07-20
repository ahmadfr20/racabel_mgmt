import { prisma } from "@/lib/prisma";
import { TaskStatus, PdcaTaskStatus } from "@prisma/client";
import {
  NOTION_TASK_DB_ID,
  NOTION_PDCA_DB_ID,
  queryAllPages,
  propTitle,
  propRichText,
  propPeopleEmails,
  propStatusName,
  propDateStart,
  propDateEnd,
} from "@/lib/notion";

interface SyncItemResult {
  notionPageId: string;
  title: string;
  action: "created" | "updated" | "skipped";
  reason?: string;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  details: SyncItemResult[];
}

function mapTaskStatus(notionStatus: string | null): TaskStatus {
  if (notionStatus === "Done") return "DONE";
  if (notionStatus === "In progress") return "IN_PROGRESS";
  return "PLANNED";
}

function mapPdcaStatus(notionStatus: string | null): PdcaTaskStatus {
  if (notionStatus === "Done") return "SELESAI";
  if (notionStatus === "In progress") return "SEDANG_BERJALAN";
  return "BELUM_SELESAI";
}

async function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email }, select: { id: true, departmentId: true } });
}

// Senin (00:00 UTC) dari minggu ISO yang memuat tanggal `dateStr` ("yyyy-MM-dd").
function isoWeekMondayUTC(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7; // Minggu(0) -> 7
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d;
}

function addDaysUTC(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Cari (atau buat) PdcaWeek untuk department & deadline tertentu.
// Tanpa deadline -> masuk 1 bucket "Tanpa Deadline (Notion)" per department.
async function findOrCreateWeek(departmentId: number, deadline: string | null) {
  if (!deadline) {
    const title = "Tanpa Deadline (Notion)";
    const existing = await prisma.pdcaWeek.findFirst({ where: { departmentId, title } });
    if (existing) return existing;
    return prisma.pdcaWeek.create({ data: { title, departmentId } });
  }

  const monday = isoWeekMondayUTC(deadline);
  const sunday = addDaysUTC(monday, 6);
  const existing = await prisma.pdcaWeek.findFirst({ where: { departmentId, startDate: monday } });
  if (existing) return existing;
  return prisma.pdcaWeek.create({
    data: {
      title: `Minggu ${isoDate(monday)} s/d ${isoDate(sunday)} (Notion)`,
      departmentId,
      startDate: monday,
      endDate: sunday,
    },
  });
}

export async function syncNotionTasks(): Promise<SyncResult> {
  if (!NOTION_TASK_DB_ID) throw new Error("NOTION_TASK_DB_ID belum diset di .env");
  const pages = await queryAllPages(NOTION_TASK_DB_ID);
  const details: SyncItemResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const page of pages) {
    const title = propTitle(page.properties["Task Name"]);
    if (!title) {
      skipped++;
      details.push({ notionPageId: page.id, title: "(tanpa judul)", action: "skipped", reason: "Task Name kosong" });
      continue;
    }

    const email = propPeopleEmails(page.properties["Assigned To"])[0];
    if (!email) {
      skipped++;
      details.push({ notionPageId: page.id, title, action: "skipped", reason: "Kolom 'Assigned To' kosong" });
      continue;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      skipped++;
      details.push({ notionPageId: page.id, title, action: "skipped", reason: `Email ${email} tidak terdaftar sebagai user di app` });
      continue;
    }

    const due = propDateStart(page.properties["Due Date"]);
    const status = mapTaskStatus(propStatusName(page.properties["Status"]));
    const data = {
      userId: user.id,
      date: due ? new Date(due) : new Date(page.created_time),
      title,
      description: `Disinkron dari Notion (Task Management System): ${page.url}`,
      status,
    };

    const existing = await prisma.taskLog.findUnique({ where: { notionPageId: page.id } });
    if (existing) {
      await prisma.taskLog.update({ where: { id: existing.id }, data });
      updated++;
      details.push({ notionPageId: page.id, title, action: "updated" });
    } else {
      await prisma.taskLog.create({ data: { ...data, notionPageId: page.id } });
      created++;
      details.push({ notionPageId: page.id, title, action: "created" });
    }
  }

  return { created, updated, skipped, details };
}

export async function syncNotionPdca(): Promise<SyncResult> {
  if (!NOTION_PDCA_DB_ID) throw new Error("NOTION_PDCA_DB_ID belum diset di .env");
  const pages = await queryAllPages(NOTION_PDCA_DB_ID);
  const details: SyncItemResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const page of pages) {
    const title = propTitle(page.properties["Plan"]);
    if (!title) {
      skipped++;
      details.push({ notionPageId: page.id, title: "(tanpa judul)", action: "skipped", reason: "Plan kosong" });
      continue;
    }

    const doEmail = propPeopleEmails(page.properties["Do"])[0];
    if (!doEmail) {
      skipped++;
      details.push({ notionPageId: page.id, title, action: "skipped", reason: "Kolom 'Do' (PIC) kosong" });
      continue;
    }

    const doUser = await findUserByEmail(doEmail);
    if (!doUser) {
      skipped++;
      details.push({ notionPageId: page.id, title, action: "skipped", reason: `Email ${doEmail} tidak terdaftar sebagai user di app` });
      continue;
    }
    if (!doUser.departmentId) {
      skipped++;
      details.push({ notionPageId: page.id, title, action: "skipped", reason: `User ${doEmail} belum punya department di app` });
      continue;
    }

    const checkEmail = propPeopleEmails(page.properties["Check"])[0];
    const checkUser = checkEmail ? await findUserByEmail(checkEmail) : null;

    const deadline = propDateEnd(page.properties["Deadline"]);
    const week = await findOrCreateWeek(doUser.departmentId, deadline);
    const status = mapPdcaStatus(propStatusName(page.properties["Status"]));

    const data = {
      weekId: week.id,
      title,
      userId: doUser.id,
      checkUserId: checkUser?.id ?? null,
      act: propRichText(page.properties["Act"]) || null,
      deadline: deadline ? new Date(deadline) : null,
      status,
    };

    const existing = await prisma.pdcaTask.findUnique({ where: { notionPageId: page.id } });
    if (existing) {
      await prisma.pdcaTask.update({ where: { id: existing.id }, data });
      updated++;
      details.push({ notionPageId: page.id, title, action: "updated" });
    } else {
      const order = await prisma.pdcaTask.count({ where: { weekId: week.id } });
      await prisma.pdcaTask.create({ data: { ...data, order, notionPageId: page.id } });
      created++;
      details.push({ notionPageId: page.id, title, action: "created" });
    }
  }

  return { created, updated, skipped, details };
}

export async function syncNotionAll() {
  const task = await syncNotionTasks();
  const pdca = await syncNotionPdca();
  return { task, pdca };
}
