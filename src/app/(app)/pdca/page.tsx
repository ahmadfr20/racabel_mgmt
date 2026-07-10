import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { PdcaClient } from "@/components/pdca/PdcaClient";

export const dynamic = "force-dynamic";

export default async function PdcaPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "pdca.view") && !can(user, "pdca.manage")) redirect("/dashboard");
  return <PdcaClient canManage={can(user, "pdca.manage")} />;
}
