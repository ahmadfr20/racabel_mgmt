import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { PayrollClient } from "@/components/payroll/PayrollClient";

export default async function PayrollPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "payroll.view")) redirect("/dashboard");
  return <PayrollClient canManage={can(user, "payroll.manage")} />;
}
