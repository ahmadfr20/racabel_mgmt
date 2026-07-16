import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/api";
import { AuthError } from "@/lib/auth";
import { deactivateExpiredContracts } from "@/lib/contracts";

// Endpoint machine-to-machine (bukan sesi/cookie) — dipanggil oleh cron job harian
// di server via curl dengan header Authorization: Bearer <CRON_SECRET>.
export const POST = handle(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    throw new AuthError("Tidak diotorisasi", 401);
  }

  const deactivatedCount = await deactivateExpiredContracts();
  return ok({ deactivatedCount });
});
