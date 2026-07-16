"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bot, CalendarClock, CalendarDays, ChevronDown, ClipboardList, FileClock, FileSignature, LayoutDashboard,
  LogOut, Menu, Moon, RefreshCcw, Settings, ShieldCheck, ShoppingBag, ShoppingCart,
  Store, Sun, Ticket, UserCog, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { ProfileModal } from "@/components/profile/ProfileModal";

export interface ShellUser {
  fullName: string;
  username: string;
  photo: string | null;
  role: { name: string; color: string };
  department: { name: string } | null;
  permissions: string[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  anyOf: string[]; // tampil jika user punya salah satu permission ini
}

const NAV: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard, anyOf: ["dashboard.view"] },
  { href: "/attendance", label: "Absensi",       icon: CalendarClock,   anyOf: ["attendance.checkin", "attendance.view_all"] },
  { href: "/leave",      label: "Cuti",          icon: CalendarDays,    anyOf: ["leave.request", "leave.view_all", "leave.approve"] },
  { href: "/employees",  label: "Karyawan",      icon: Users,           anyOf: ["employees.view"] },
  { href: "/contracts",  label: "Kontrak & LoA", icon: FileSignature,   anyOf: ["contract.manage"] },
  { href: "/contract-extensions", label: "Perpanjangan Kontrak", icon: FileClock, anyOf: [] }, // [] = tampil untuk role apapun
  { href: "/tasklog",    label: "Task Log",      icon: ClipboardList,   anyOf: ["tasklog.write", "tasklog.view_all"] },
  { href: "/pdca",       label: "PDCA",          icon: RefreshCcw,      anyOf: ["pdca.view", "pdca.manage"] },
  { href: "/tickets",    label: "Ticketing",     icon: Ticket,          anyOf: ["tickets.create", "tickets.view_all", "tickets.manage"] },
  { href: "/payroll",    label: "Kinerja & Gaji",icon: Wallet,          anyOf: ["payroll.view", "payroll.manage"] },
  { href: "/financial",  label: "AI Assistant",  icon: Bot,             anyOf: [] }, // [] = tampil untuk role apapun
  { href: "/tiktok",     label: "TikTok Shop",   icon: ShoppingBag,     anyOf: ["marketplace.view"] },
  { href: "/tokopedia",  label: "Tokopedia",     icon: Store,           anyOf: ["marketplace.view"] },
  { href: "/shopee",     label: "Shopee",        icon: ShoppingCart,    anyOf: ["marketplace.view"] },
  { href: "/settings",   label: "Pengaturan",    icon: Settings,        anyOf: ["roles.manage", "departments.manage", "settings.manage"] },
];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const items = NAV.filter((n) => n.anyOf.length === 0 || n.anyOf.some((p) => user.permissions.includes(p)));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const initials = user.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 lg:flex">
        <SidebarContent items={items} pathname={pathname} />
      </aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-slate-900">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Konten */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-2">
            {/* Toggle dark/light */}
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={theme === "dark" ? "Ganti ke light mode" : "Ganti ke dark mode"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar photo={user.photo} initials={initials} />
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">{user.fullName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user.role.name}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                    <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user.fullName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        @{user.username} · {user.department?.name ?? "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <UserCog className="h-4 w-4" /> Edit Profil
                    </button>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 border-t border-slate-100 dark:border-slate-700 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="h-4 w-4" /> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {user.permissions.includes("assistant.use") && (
        <AssistantBubble canUpload={user.permissions.includes("financial.upload")} />
      )}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={() => router.refresh()} />
    </div>
  );
}

function SidebarContent({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_racabel.svg" className="h-9 w-9 dark:brightness-0 dark:invert" alt="Racabel" />
        <span className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">Racabel HQ Management</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 dark:border-slate-700 p-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Role & authority aktif
        </div>
      </div>
    </>
  );
}

function Avatar({ photo, initials }: { photo: string | null; initials: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-sm font-semibold text-brand-700 dark:text-brand-300">
      {initials}
    </div>
  );
}
