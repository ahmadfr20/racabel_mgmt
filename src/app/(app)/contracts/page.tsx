import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { ContractsClient } from "@/components/contracts/ContractsClient";

export default async function ContractsPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "contract.manage")) redirect("/dashboard");
  return <ContractsClient currentUserName={user.fullName} />;
}
