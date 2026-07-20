"use client";

import { useState } from "react";
import { Building, Clock, Plug, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { RolesPanel } from "./RolesPanel";
import { DepartmentsPanel } from "./DepartmentsPanel";
import { SchedulePanel } from "./SchedulePanel";
import { NotionSyncPanel } from "./NotionSyncPanel";

type TabKey = "roles" | "departments" | "schedule" | "notion";

export function SettingsClient({ tabs }: { tabs: Record<TabKey, boolean> }) {
  const all: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "roles", label: "Role & Authority", icon: ShieldCheck },
    { key: "departments", label: "Department", icon: Building },
    { key: "schedule", label: "Jam Kerja & Toleransi", icon: Clock },
    { key: "notion", label: "Integrasi Notion", icon: Plug },
  ];
  const available = all.filter((t) => tabs[t.key]);

  const [active, setActive] = useState<TabKey>(available[0].key);

  return (
    <div>
      <PageHeader title="Pengaturan" subtitle="Atur role & hak akses, department, serta jam kerja." />

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {available.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition",
                active === t.key ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {active === "roles" && <RolesPanel />}
      {active === "departments" && <DepartmentsPanel />}
      {active === "schedule" && <SchedulePanel />}
      {active === "notion" && <NotionSyncPanel />}
    </div>
  );
}
