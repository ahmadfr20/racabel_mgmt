import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { AIAssistantClient } from "@/components/financial/AIAssistantClient";

export default async function AIAssistantPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "financial.view")) redirect("/dashboard");
  return <AIAssistantClient canUpload={can(user, "financial.upload")} />;
}
