import { getCurrentUser, can } from "@/lib/auth";
import { AIAssistantClient } from "@/components/financial/AIAssistantClient";

// Halaman AI Assistant terbuka untuk role apapun (semua user yang login) —
// hanya kemampuan lampirkan file (financial.upload) yang tetap dibatasi.
export default async function AIAssistantPage() {
  const user = (await getCurrentUser())!;
  return <AIAssistantClient canUpload={can(user, "financial.upload")} />;
}
