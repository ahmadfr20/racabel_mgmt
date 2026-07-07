import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { LeaveClient } from "@/components/leave/LeaveClient";

export default async function LeavePage() {
  const user = (await getCurrentUser())!;
  const canRequest = can(user, "leave.request");
  const canApprove = can(user, "leave.approve");
  const canViewAll = can(user, "leave.view_all") || canApprove;
  if (!canRequest && !canViewAll) redirect("/dashboard");

  return <LeaveClient canRequest={canRequest} canApprove={canApprove} canViewAll={canViewAll} />;
}
