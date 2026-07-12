import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { isAnthropicConfigured } from "@/lib/anthropic";

// Dipakai UI untuk menampilkan badge Aktif/Belum Aktif tanpa perlu kirim pesan dulu.
export const GET = handle(async () => {
  await requirePermission("assistant.use");
  return ok({ configured: isAnthropicConfigured() });
});
