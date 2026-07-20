import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
  PageObjectResponse as NotionPage,
} from "@notionhq/client/build/src/api-endpoints";

export const notion = new Client({ auth: process.env.NOTION_API_KEY });

export const NOTION_TASK_DB_ID = process.env.NOTION_TASK_DB_ID || "";
export const NOTION_PDCA_DB_ID = process.env.NOTION_PDCA_DB_ID || "";

// Sejak API Notion versi 2025-09-03, query tidak lagi langsung ke database melainkan ke
// "data source" di bawahnya (database bisa punya >1 data source; kasus umum cuma 1).
async function firstDataSourceId(databaseId: string): Promise<string> {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const first = "data_sources" in db ? db.data_sources[0] : undefined;
  if (!first) throw new Error(`Database Notion ${databaseId} tidak punya data source`);
  return first.id;
}

// Ambil semua halaman (rows) dari sebuah database Notion, menangani pagination otomatis.
export async function queryAllPages(databaseId: string): Promise<PageObjectResponse[]> {
  const dataSourceId = await firstDataSourceId(databaseId);
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const r of res.results as (PageObjectResponse | PartialPageObjectResponse)[]) {
      if ("properties" in r) pages.push(r as NotionPage);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

type NotionProperty = PageObjectResponse["properties"][string];

export function propTitle(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "title") return "";
  return prop.title.map((t) => t.plain_text).join("");
}

export function propRichText(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((t) => t.plain_text).join("");
}

// Kembalikan daftar email dari properti "people". User tanpa email Notion (mis. belum konfirmasi) dilewati.
export function propPeopleEmails(prop: NotionProperty | undefined): string[] {
  if (!prop || prop.type !== "people") return [];
  return prop.people
    .map((p) => ("person" in p ? p.person?.email : undefined))
    .filter((e): e is string => !!e);
}

export function propStatusName(prop: NotionProperty | undefined): string | null {
  if (!prop) return null;
  if (prop.type === "status") return prop.status?.name ?? null;
  if (prop.type === "select") return prop.select?.name ?? null;
  return null;
}

export function propDateStart(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== "date") return null;
  return prop.date?.start ?? null;
}

// Untuk properti date yang berupa rentang (start -> end), ambil end bila ada (mis. "Deadline" range),
// jatuh ke start bila tidak ada end.
export function propDateEnd(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== "date") return null;
  return prop.date?.end ?? prop.date?.start ?? null;
}
