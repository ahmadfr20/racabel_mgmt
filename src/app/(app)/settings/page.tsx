import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const user = (await getCurrentUser())!;
  const tabs = {
    roles: can(user, "roles.manage"),
    departments: can(user, "departments.manage"),
    schedule: can(user, "settings.manage"),
  };
  if (!tabs.roles && !tabs.departments && !tabs.schedule) redirect("/dashboard");
  return <SettingsClient tabs={tabs} />;
}
