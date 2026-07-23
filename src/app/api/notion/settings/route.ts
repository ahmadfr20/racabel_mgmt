import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import {
  getSyncIntervalMinutes,
  setSyncIntervalMinutes,
  getLastAutoSyncedAt,
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES,
} from "@/lib/notionSync";

// GET: interval sinkron otomatis saat ini + kapan terakhir jalan. Butuh settings.manage.
export const GET = handle(async () => {
  await requirePermission("settings.manage");
  const [intervalMinutes, lastSyncedAt] = await Promise.all([getSyncIntervalMinutes(), getLastAutoSyncedAt()]);
  return ok({ intervalMinutes, lastSyncedAt });
});

const updateSchema = z.object({
  intervalMinutes: z.coerce.number().int().min(MIN_INTERVAL_MINUTES).max(MAX_INTERVAL_MINUTES),
});

// PUT: ubah interval sinkron otomatis (dalam menit, 5 - 1440). Butuh settings.manage.
export const PUT = handle(async (req: NextRequest) => {
  await requirePermission("settings.manage");
  const data = updateSchema.parse(await req.json());
  await setSyncIntervalMinutes(data.intervalMinutes);
  return ok({ intervalMinutes: data.intervalMinutes });
});
