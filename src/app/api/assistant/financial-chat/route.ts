import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { isAnthropicConfigured, sendAIAssistantChat, type ChatMessage, type FinancialAttachment } from "@/lib/anthropic";
import { parseSpreadsheetToText, SpreadsheetParseError } from "@/lib/spreadsheet";

const PLACEHOLDER_REPLY =
  "Asisten Keuangan AI belum aktif. Admin perlu menambahkan ANTHROPIC_API_KEY di file .env server untuk mengaktifkannya.";

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const SPREADSHEET_EXT = /\.(csv|xlsx|xls)$/i;
const PDF_EXT = /\.pdf$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

const messagesSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
  .min(1)
  .max(40);

// POST /api/assistant/financial-chat — chat AI yang bisa menyimpan transaksi &
// hasil komparasi keuangan ke database, dan menerima lampiran Excel/CSV/PDF.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser();
  if (!user.permissions.includes("financial.view") && !user.permissions.includes("financial.upload")) {
    throw new AuthError("Anda tidak memiliki akses ke Asisten Keuangan", 403);
  }

  const formData = await req.formData();
  const messagesRaw = formData.get("messages");
  if (typeof messagesRaw !== "string") throw new AuthError("Data pesan tidak valid.", 400);

  let messages: ChatMessage[];
  try {
    messages = messagesSchema.parse(JSON.parse(messagesRaw));
  } catch {
    throw new AuthError("Format pesan tidak valid.", 400);
  }

  const file = formData.get("file");
  let attachment: FinancialAttachment | undefined;
  if (file instanceof File) {
    if (!user.permissions.includes("financial.upload")) {
      throw new AuthError("Anda tidak memiliki akses mengunggah file keuangan", 403);
    }
    if (file.size > MAX_FILE_SIZE) throw new AuthError("Ukuran file maksimal 8MB.", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    if (PDF_EXT.test(file.name)) {
      attachment = { fileName: file.name, kind: "pdf", data: buffer.toString("base64") };
    } else if (SPREADSHEET_EXT.test(file.name)) {
      try {
        const text = parseSpreadsheetToText(buffer, file.name);
        attachment = { fileName: file.name, kind: "text", data: text };
      } catch (err) {
        const message = err instanceof SpreadsheetParseError ? err.message : "Gagal membaca file.";
        throw new AuthError(message, 400);
      }
    } else if (IMAGE_EXT.test(file.name)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = IMAGE_MIME[ext] ?? "image/jpeg";
      attachment = { fileName: file.name, kind: "image", data: buffer.toString("base64"), mimeType };
    } else {
      throw new AuthError("Format file tidak didukung. Gunakan .csv, .xlsx, .xls, .pdf, atau gambar (jpg, png, gif, webp).", 400);
    }
  }

  if (!isAnthropicConfigured()) {
    return ok({ reply: PLACEHOLDER_REPLY, configured: false });
  }

  const reply = await sendAIAssistantChat(messages, user, attachment);
  return ok({ reply, configured: true });
});
