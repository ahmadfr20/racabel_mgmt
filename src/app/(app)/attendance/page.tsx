import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { AttendanceClient } from "@/components/attendance/AttendanceClient";

export default async function AttendancePage() {
  const user = (await getCurrentUser())!;
  const canCheckin = can(user, "attendance.checkin");
  const canViewAll = can(user, "attendance.view_all");
  if (!canCheckin && !canViewAll) redirect("/dashboard");

  return <AttendanceClient canCheckin={canCheckin} canViewAll={canViewAll} />;
}
