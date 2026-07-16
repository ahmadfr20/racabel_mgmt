import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { TokopediaClient } from "@/components/tokopedia/TokopediaClient";

export const dynamic = "force-dynamic";

export default async function TokopediaPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "marketplace.view")) redirect("/dashboard");
  return <TokopediaClient />;
}
