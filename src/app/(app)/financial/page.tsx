import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { FinancialClient } from "@/components/financial/FinancialClient";

export default async function FinancialPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "financial.view")) redirect("/dashboard");
  return <FinancialClient canUpload={can(user, "financial.upload")} />;
}
