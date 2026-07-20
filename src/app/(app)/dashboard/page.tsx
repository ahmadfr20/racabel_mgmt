import Link from "next/link";
import {
  AlertTriangle, CalendarClock, CalendarDays, Clock, Ticket, TrendingUp, UserCheck, Users,
} from "lucide-react";
import { TicketStatus } from "@prisma/client";
import { getCurrentUser, can } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentPeriod, getWeightedScore } from "@/lib/performance";
import { cn, toDateOnly, formatDate, isTicketOverdue, LEAVE_TYPE_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/lib/utils";
import { Card, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { AttendanceTrendChart, KpiRadarChart, PerformanceByDeptChart } from "@/components/Charts";

export const dynamic = "force-dynamic";

function dayLabel(d: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(d);
}
const dkey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const isManager = can(user, "attendance.view_all");
  const canSeeLeaves = can(user, "leave.view_all") || can(user, "leave.approve");
  const canSeeAllTickets = can(user, "tickets.view_all") || can(user, "tickets.manage");
  const canSeeTickets = canSeeAllTickets || can(user, "tickets.create");
  const period = currentPeriod();
  const today = toDateOnly();

  // ===== Tren kehadiran 7 hari terakhir =====
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 6);
  const attFilter = isManager ? {} : { userId: user.id };
  const recentAtt = await prisma.attendance.findMany({
    where: { date: { gte: from }, ...attFilter },
    select: { date: true, checkInStatus: true },
  });
  const trend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(from);
    d.setUTCDate(from.getUTCDate() + i);
    const key = dkey(d);
    const dayRecords = recentAtt.filter((a) => dkey(a.date) === key);
    return {
      day: dayLabel(d),
      tepat: dayRecords.filter((a) => a.checkInStatus === "ON_TIME").length,
      terlambat: dayRecords.filter((a) => a.checkInStatus === "LATE").length,
    };
  });

  // ===== Statistik hari ini =====
  const todayAtt = await prisma.attendance.findMany({
    where: { date: today, ...attFilter },
    select: { checkInStatus: true, checkOutStatus: true },
  });
  const hadir = todayAtt.filter((a) => a.checkInStatus).length;
  const terlambat = todayAtt.filter((a) => a.checkInStatus === "LATE").length;

  const totalEmployees = isManager ? await prisma.user.count({ where: { isActive: true } }) : 1;
  const pendingLeaveCount = canSeeLeaves
    ? await prisma.leaveRequest.count({ where: { status: "PENDING" } })
    : await prisma.leaveRequest.count({ where: { status: "PENDING", userId: user.id } });

  // ===== Pengajuan cuti terbaru (untuk approver) / milik sendiri =====
  const leaves = await prisma.leaveRequest.findMany({
    where: canSeeLeaves ? { status: "PENDING" } : { userId: user.id },
    include: { user: { select: { fullName: true, department: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // ===== Tiket yang belum selesai (OPEN / IN_PROGRESS) =====
  const ticketWhere = {
    status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
    ...(canSeeAllTickets ? {} : { OR: [{ requesterId: user.id }, { assigneeId: user.id }] }),
  };
  const unsolvedCount = canSeeTickets ? await prisma.ticket.count({ where: ticketWhere }) : 0;
  const unsolvedTickets = canSeeTickets
    ? await prisma.ticket.findMany({
        where: ticketWhere,
        include: {
          requester: { select: { fullName: true } },
          assignee: { select: { fullName: true } },
        },
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        take: 5,
      })
    : [];
  const overdueCount = unsolvedTickets.filter((t) => isTicketOverdue(t.dueDate, t.status)).length;

  // ===== Analitik kinerja =====
  let deptPerformance: { name: string; score: number }[] = [];
  let personalRadar: { metric: string; score: number }[] = [];
  let myScore = 0;

  if (isManager) {
    const depts = await prisma.department.findMany({ include: { users: { where: { isActive: true }, select: { id: true } } } });
    for (const d of depts) {
      if (d.users.length === 0) continue;
      const scores = await Promise.all(d.users.map((u) => getWeightedScore(u.id, period)));
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      deptPerformance.push({ name: d.name, score: Math.round(avg) });
    }
  } else {
    const records = await prisma.performanceRecord.findMany({
      where: { userId: user.id, period },
      include: { metric: true },
    });
    personalRadar = records.map((r) => ({ metric: r.metric.name, score: r.score }));
    myScore = await getWeightedScore(user.id, period);
  }

  return (
    <div>
      <PageHeader
        title={`Halo, ${user.fullName.split(" ")[0]} 👋`}
        subtitle={isManager ? "Ringkasan performa & kehadiran tim Anda." : "Ringkasan kehadiran & kinerja Anda."}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isManager ? (
          <StatCard label="Total Karyawan" value={totalEmployees} icon={<Users className="h-5 w-5" />} tone="brand" />
        ) : (
          <StatCard label="Skor Kinerja" value={`${myScore}`} hint="periode berjalan" icon={<TrendingUp className="h-5 w-5" />} tone="brand" />
        )}
        <StatCard label={isManager ? "Hadir Hari Ini" : "Kehadiran"} value={hadir} icon={<UserCheck className="h-5 w-5" />} tone="green" />
        <StatCard label="Terlambat Hari Ini" value={terlambat} icon={<Clock className="h-5 w-5" />} tone="amber" />
        {canSeeTickets ? (
          <StatCard label="Tiket Belum Selesai" value={unsolvedCount} hint={overdueCount > 0 ? `${overdueCount} overdue` : undefined} icon={<Ticket className="h-5 w-5" />} tone={unsolvedCount > 0 ? "red" : "slate"} />
        ) : (
          <StatCard label="Cuti Menunggu" value={pendingLeaveCount} icon={<CalendarDays className="h-5 w-5" />} tone={pendingLeaveCount > 0 ? "red" : "slate"} />
        )}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Tren Kehadiran (7 hari)</h3>
          </div>
          <AttendanceTrendChart data={trend} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{isManager ? "Kinerja per Department" : "Capaian KPI Anda"}</h3>
          </div>
          {isManager ? (
            deptPerformance.length ? <PerformanceByDeptChart data={deptPerformance} /> : <NoData />
          ) : personalRadar.length ? (
            <KpiRadarChart data={personalRadar} />
          ) : (
            <NoData />
          )}
        </Card>
      </div>

      {/* Pengajuan cuti & tiket belum selesai */}
      <div className={cn("mt-6 grid gap-4", canSeeTickets && "lg:grid-cols-2")}>
        {/* Cuti */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">
              {canSeeLeaves ? "Pengajuan Cuti Menunggu Persetujuan" : "Pengajuan Cuti Saya"}
            </h3>
            <Link href="/leave" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Lihat semua →
            </Link>
          </div>
          {leaves.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Tidak ada pengajuan cuti.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {leaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {canSeeLeaves ? l.user.fullName : LEAVE_TYPE_LABEL[l.type]}
                      {canSeeLeaves && <span className="ml-2 text-xs text-slate-400">{l.user.department?.name}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {LEAVE_TYPE_LABEL[l.type]} · {formatDate(l.startDate)} – {formatDate(l.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={l.status} label={l.status === "PENDING" ? "Menunggu" : l.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tiket belum selesai */}
        {canSeeTickets && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                Tiket Belum Selesai
                {unsolvedCount > 0 && <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{unsolvedCount}</span>}
              </h3>
              <Link href="/tickets" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Lihat semua →
              </Link>
            </div>
            {unsolvedTickets.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Tidak ada tiket yang belum selesai. 🎉</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {unsolvedTickets.map((t) => {
                  const overdue = isTicketOverdue(t.dueDate, t.status);
                  return (
                    <Link key={t.id} href="/tickets" className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.title}</p>
                          {overdue && <span className="badge shrink-0 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"><AlertTriangle className="mr-1 h-3 w-3" /> Overdue</span>}
                        </div>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {canSeeAllTickets ? `${t.requester.fullName} · ` : ""}
                          PIC: {t.assignee?.fullName ?? "belum ditugaskan"}
                          {t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={cn("badge", t.priority === "URGENT" ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400" : t.priority === "HIGH" ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300")}>
                          {TICKET_PRIORITY_LABEL[t.priority]}
                        </span>
                        <StatusBadge status={t.status} label={TICKET_STATUS_LABEL[t.status]} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function NoData() {
  return <div className="grid h-[260px] place-items-center text-sm text-slate-400">Belum ada data.</div>;
}
