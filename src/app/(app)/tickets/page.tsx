import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { TicketsClient } from "@/components/tickets/TicketsClient";

export default async function TicketsPage() {
  const user = (await getCurrentUser())!;
  const canCreate = can(user, "tickets.create");
  const canManage = can(user, "tickets.manage");
  const canViewAll = can(user, "tickets.view_all") || canManage;
  if (!canCreate && !canViewAll) redirect("/dashboard");

  return <TicketsClient currentUserId={user.id} canCreate={canCreate} canManage={canManage} canViewAll={canViewAll} />;
}
