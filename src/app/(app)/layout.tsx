import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      user={{
        fullName: user.fullName,
        username: user.username,
        photo: user.photo,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
      }}
    >
      {children}
    </AppShell>
  );
}
