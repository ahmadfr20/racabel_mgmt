import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card p-5", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  tone?: "brand" | "green" | "amber" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400",
    green: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    red:   "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    slate: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
        </div>
        {icon && <div className={cn("grid h-11 w-11 place-items-center rounded-xl", tones[tone])}>{icon}</div>}
      </div>
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  ON_TIME:     "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  LATE:        "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  EARLY_LEAVE: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  APPROVED:    "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  PENDING:     "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  REJECTED:    "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={cn("badge", BADGE_TONES[status] ?? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400")}>
      {label}
    </span>
  );
}

export function EmptyState({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 py-14 text-center">
      {icon && <div className="mb-3 text-slate-300 dark:text-slate-600">{icon}</div>}
      <p className="font-medium text-slate-600 dark:text-slate-400">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{subtitle}</p>}
    </div>
  );
}
