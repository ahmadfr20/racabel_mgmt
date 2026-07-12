import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { AssistantClient } from "@/components/assistant/AssistantClient";

export default async function AssistantPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "assistant.use")) redirect("/dashboard");
  return <AssistantClient />;
}
