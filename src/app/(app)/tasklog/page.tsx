import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { TaskLogClient } from "@/components/tasklog/TaskLogClient";

export const dynamic = "force-dynamic";

export default async function TaskLogPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "tasklog.write") && !can(user, "tasklog.view_all")) redirect("/dashboard");
  return (
    <TaskLogClient
      canViewAll={can(user, "tasklog.view_all")}
      canWrite={can(user, "tasklog.write")}
    />
  );
}
