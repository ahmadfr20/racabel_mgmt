import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { syncNotionAll } from "@/lib/notionSync";

// POST: tarik data dari Notion (Task Management System + PDCA) dan sinkronkan satu-arah
// ke TaskLog & PdcaTask. Butuh settings.manage. Dipicu manual dari halaman Pengaturan.
export const POST = handle(async (_req: NextRequest) => {
  await requirePermission("settings.manage");
  const result = await syncNotionAll();
  return ok(result);
});
