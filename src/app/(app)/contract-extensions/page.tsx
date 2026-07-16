import { getCurrentUser, can } from "@/lib/auth";
import { ContractExtensionClient } from "@/components/contracts/ContractExtensionClient";

// Terbuka untuk semua role login (pengaju & penyetuju sama-sama perlu mengakses).
export default async function ContractExtensionPage() {
  const user = (await getCurrentUser())!;
  const canRequest = user.employmentStatus === "KONTRAK" || user.employmentStatus === "MAGANG";
  const canApprove = can(user, "contract.manage");

  return <ContractExtensionClient canRequest={canRequest} canApprove={canApprove} />;
}
