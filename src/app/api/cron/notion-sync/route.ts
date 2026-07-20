import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { AuthError } from "@/lib/auth";
import { syncNotionAll } from "@/lib/notionSync";

// Endpoint machine-to-machine (bukan sesi/cookie) — dipanggil oleh cron job berkala
// di server via curl dengan header Authorization: Bearer <CRON_SECRET>.
// Tarik data terbaru dari Notion (Task Management System + PDCA) dan sinkronkan satu-arah.
export const POST = handle(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new AuthError("Tidak diotorisasi", 401);
  }

  const result = await syncNotionAll();
  return ok(result);
});
