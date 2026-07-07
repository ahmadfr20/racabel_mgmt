import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { EmployeesClient } from "@/components/employees/EmployeesClient";

export default async function EmployeesPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "employees.view")) redirect("/dashboard");

  return (
    <EmployeesClient
      perms={{
        create: can(user, "employees.create"),
        edit: can(user, "employees.edit"),
        delete: can(user, "employees.delete"),
        payroll: can(user, "payroll.view"),
      }}
    />
  );
}
