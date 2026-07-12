import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { isAnthropicConfigured, sendAssistantChat } from "@/lib/anthropic";

// API key belum diatur admin -> chatbot tetap bisa "dicoba" tapi hanya membalas placeholder ini.
const PLACEHOLDER_REPLY =
  "Fitur Asisten AI belum aktif. Admin perlu menambahkan ANTHROPIC_API_KEY di file .env server untuk mengaktifkan chatbot ini. Setelah aktif, saya bisa membantu menjawab pertanyaan seputar Task Log, PDCA, dan Kinerja.";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(40),
});

export const POST = handle(async (req: NextRequest) => {
  await requirePermission("assistant.use");
  const { messages } = bodySchema.parse(await req.json());

  if (!isAnthropicConfigured()) {
    return ok({ reply: PLACEHOLDER_REPLY, configured: false });
  }

  const reply = await sendAssistantChat(messages);
  return ok({ reply, configured: true });
});
