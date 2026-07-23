import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { AuthError } from "@/lib/auth";
import { runScheduledSyncIfDue } from "@/lib/notionSync";

// Endpoint machine-to-machine (bukan sesi/cookie) — di-ping tiap 5 menit oleh crontab di
// server via curl dengan header Authorization: Bearer <CRON_SECRET>. Tick sesering itu murah:
// sinkron ke Notion beneran cuma dijalankan kalau sudah lewat interval yang diatur user
// (lihat Settings > Integrasi Notion), jadi interval bisa diubah tanpa sentuh crontab lagi.
export const POST = handle(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new AuthError("Tidak diotorisasi", 401);
  }

  const outcome = await runScheduledSyncIfDue();
  return ok(outcome);
});
