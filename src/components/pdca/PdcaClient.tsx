"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Check, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatDate, cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface PdcaTaskItem {
  id: number;
  title: string;
  status: "BELUM_SELESAI" | "SELESAI";
  userId: number;
  userName: string;
}
interface PdcaWeekItem {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
  departmentId: number;
  departmentName: string;
  tasks: PdcaTaskItem[];
}
interface Person { id: number; fullName: string; department: { id: number; name: string } | null }
interface DeptOption { id: number; name: string }

const WEEK_EMPTY = { title: "", departmentId: "", startDate: "", endDate: "" };
const TASK_EMPTY = { title: "", userId: "", status: "BELUM_SELESAI" as "BELUM_SELESAI" | "SELESAI" };

export function PdcaClient({ canManage, currentUserId }: { canManage: boolean; currentUserId: number }) {
  const [weeks, setWeeks] = useState<PdcaWeekItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [filterDepartment, setFilterDepartment] = useState("");

  const [weekModalOpen, setWeekModalOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState<PdcaWeekItem | null>(null);
  const [weekForm, setWeekForm] = useState(WEEK_EMPTY);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeWeekId, setActiveWeekId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<PdcaTaskItem | null>(null);
  const [taskForm, setTaskForm] = useState(TASK_EMPTY);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filterDepartment ? `?department=${filterDepartment}` : "";
      setWeeks(await apiFetch<PdcaWeekItem[]>(`/api/pdca/weeks${qs}`));
    } finally {
      setLoading(false);
    }
  }, [filterDepartment]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch<{ departments: DeptOption[] }>("/api/options").then((o) => setDepartments(o.departments)).catch(() => setDepartments([]));
    if (canManage) apiFetch<Person[]>("/api/employees").then(setPeople).catch(() => setPeople([]));
  }, [canManage]);

  // ===== Minggu PDCA =====
  function openCreateWeek() {
    setEditingWeek(null);
    setWeekForm(WEEK_EMPTY);
    setError("");
    setWeekModalOpen(true);
  }
  function openEditWeek(w: PdcaWeekItem) {
    setEditingWeek(w);
    setWeekForm({
      title: w.title, departmentId: String(w.departmentId),
      startDate: w.startDate?.slice(0, 10) ?? "", endDate: w.endDate?.slice(0, 10) ?? "",
    });
    setError("");
    setWeekModalOpen(true);
  }
  async function submitWeek(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const payload = {
        title: weekForm.title,
        departmentId: Number(weekForm.departmentId),
        startDate: weekForm.startDate || null,
        endDate: weekForm.endDate || null,
      };
      if (editingWeek) await apiFetch(`/api/pdca/weeks/${editingWeek.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiFetch("/api/pdca/weeks", { method: "POST", body: JSON.stringify(payload) });
      setWeekModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan minggu");
    } finally {
      setSaving(false);
    }
  }
  async function removeWeek(w: PdcaWeekItem) {
    if (!confirm(`Hapus "${w.title}" beserta seluruh task di dalamnya?`)) return;
    await apiFetch(`/api/pdca/weeks/${w.id}`, { method: "DELETE" });
    await load();
  }

  // ===== Task PDCA =====
  function openCreateTask(weekId: number) {
    setActiveWeekId(weekId);
    setEditingTask(null);
    setTaskForm({ ...TASK_EMPTY, userId: String(currentUserId) });
    setError("");
    setTaskModalOpen(true);
  }
  function openEditTask(weekId: number, t: PdcaTaskItem) {
    setActiveWeekId(weekId);
    setEditingTask(t);
    setTaskForm({ title: t.title, userId: String(t.userId), status: t.status });
    setError("");
    setTaskModalOpen(true);
  }
  async function submitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWeekId) return;
    setError(""); setSaving(true);
    try {
      const payload = {
        weekId: activeWeekId,
        title: taskForm.title,
        userId: taskForm.userId ? Number(taskForm.userId) : currentUserId,
        status: taskForm.status,
      };
      if (editingTask) await apiFetch(`/api/pdca/tasks/${editingTask.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiFetch("/api/pdca/tasks", { method: "POST", body: JSON.stringify(payload) });
      setTaskModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan task");
    } finally {
      setSaving(false);
    }
  }
  async function removeTask(t: PdcaTaskItem) {
    if (!confirm(`Hapus task "${t.title}"?`)) return;
    await apiFetch(`/api/pdca/tasks/${t.id}`, { method: "DELETE" });
    await load();
  }
  async function toggleStatus(t: PdcaTaskItem) {
    const next = t.status === "SELESAI" ? "BELUM_SELESAI" : "SELESAI";
    // Optimistic update agar terasa responsif.
    setWeeks((cur) => cur.map((w) => ({ ...w, tasks: w.tasks.map((x) => (x.id === t.id ? { ...x, status: next } : x)) })));
    try {
      await apiFetch(`/api/pdca/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    } catch (err) {
      await load();
      alert(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  }

  function periodLabel(w: PdcaWeekItem) {
    if (w.startDate && w.endDate) return `${formatDate(w.startDate)} – ${formatDate(w.endDate)}`;
    if (w.startDate) return `Mulai ${formatDate(w.startDate)}`;
    if (w.endDate) return `Sampai ${formatDate(w.endDate)}`;
    return "Periode belum diatur";
  }

  const activeWeek = weeks.find((w) => w.id === activeWeekId);
  const picOptions = activeWeek ? people.filter((p) => p.department?.id === activeWeek.departmentId) : people;

  return (
    <div>
      <PageHeader
        title="Manajemen PDCA"
        subtitle="Checklist mingguan per department: daftar task, PIC, dan status penyelesaian."
        action={canManage && (
          <button className="btn-primary" onClick={openCreateWeek}>
            <Plus className="h-4 w-4" /> Tambah Minggu
          </button>
        )}
      />

      <Card className="mb-4 !p-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Filter Department</label>
          <select className="input !w-auto" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="">Semua Department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
      ) : weeks.length === 0 ? (
        <EmptyState title="Belum ada minggu PDCA" subtitle="Buat minggu pertama untuk mulai mencatat task." icon={<CalendarRange className="h-10 w-10" />} />
      ) : (
        <div className="grid gap-4">
          {weeks.map((w) => {
            const done = w.tasks.filter((t) => t.status === "SELESAI").length;
            const total = w.tasks.length;
            return (
              <Card key={w.id} className="!p-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">{w.title}</h3>
                      <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">{w.departmentName}</span>
                      {total > 0 && (
                        <span className={cn(
                          "badge",
                          done === total ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        )}>
                          {done}/{total} selesai
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarRange className="h-3.5 w-3.5" /> {periodLabel(w)}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openCreateTask(w.id)} className="btn-ghost !py-1.5 !px-3 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Tugas
                      </button>
                      <button onClick={() => openEditWeek(w)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => removeWeek(w)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>

                {w.tasks.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-400">Belum ada task di minggu ini.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {w.tasks.map((t) => {
                      const canToggle = canManage || t.userId === currentUserId;
                      const isDone = t.status === "SELESAI";
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              onClick={() => canToggle && toggleStatus(t)}
                              disabled={!canToggle}
                              className={cn(
                                "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
                                isDone
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 dark:border-slate-600 text-transparent",
                                canToggle ? "cursor-pointer hover:border-brand-400" : "cursor-not-allowed opacity-60"
                              )}
                              title={canToggle ? (isDone ? "Tandai belum selesai" : "Tandai selesai") : "Hanya PIC atau pengelola yang dapat mengubah status"}
                            >
                              {isDone ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
                            </button>
                            <div className="min-w-0">
                              <p className={cn("truncate text-sm font-medium", isDone ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100")}>
                                {t.title}
                              </p>
                              <p className="text-xs text-slate-400">PIC: {t.userName}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={cn("badge", isDone ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                              {isDone ? "Selesai" : "Belum"}
                            </span>
                            {canManage && (
                              <>
                                <button onClick={() => openEditTask(w.id, t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => removeTask(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal minggu */}
      <Modal open={weekModalOpen} onClose={() => setWeekModalOpen(false)} title={editingWeek ? "Ubah Minggu PDCA" : "Tambah Minggu PDCA"}>
        <form onSubmit={submitWeek} className="space-y-4">
          <div>
            <label className="label">Judul Minggu *</label>
            <input className="input" value={weekForm.title} onChange={(e) => setWeekForm((f) => ({ ...f, title: e.target.value }))} required placeholder="mis. Week 1" />
          </div>
          <div>
            <label className="label">Department *</label>
            <select
              className="input"
              value={weekForm.departmentId}
              onChange={(e) => setWeekForm((f) => ({ ...f, departmentId: e.target.value }))}
              disabled={!!editingWeek && editingWeek.tasks.length > 0}
              required
            >
              <option value="">Pilih department...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {editingWeek && editingWeek.tasks.length > 0 && (
              <p className="mt-1 text-xs text-slate-400">Department tidak dapat diubah karena minggu ini sudah punya task.</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Mulai</label>
              <input className="input" type="date" value={weekForm.startDate} onChange={(e) => setWeekForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tanggal Selesai</label>
              <input className="input" type="date" value={weekForm.endDate} onChange={(e) => setWeekForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setWeekModalOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal task */}
      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title={editingTask ? "Ubah Task" : "Tambah Task"}>
        <form onSubmit={submitTask} className="space-y-4">
          <div>
            <label className="label">Judul Task *</label>
            <input className="input" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} required placeholder="mis. Analisa Winning Content" />
          </div>
          <div>
            <label className="label">PIC (Penanggung Jawab) *</label>
            <select className="input" value={taskForm.userId} onChange={(e) => setTaskForm((f) => ({ ...f, userId: e.target.value }))} required>
              {picOptions.length === 0 && <option value="">Belum ada karyawan di department ini</option>}
              {picOptions.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
            {activeWeek && (
              <p className="mt-1 text-xs text-slate-400">Hanya menampilkan karyawan department {activeWeek.departmentName}.</p>
            )}
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={taskForm.status} onChange={(e) => setTaskForm((f) => ({ ...f, status: e.target.value as "BELUM_SELESAI" | "SELESAI" }))}>
              <option value="BELUM_SELESAI">Belum Selesai</option>
              <option value="SELESAI">Selesai</option>
            </select>
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setTaskModalOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
