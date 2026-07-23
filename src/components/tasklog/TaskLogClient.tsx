"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileDown, FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatDate, cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { downloadExcel, downloadPdfTable } from "@/lib/exportFile";

interface TaskLog {
  id: number;
  userId: number;
  userName: string;
  departmentId: number | null;
  departmentName: string | null;
  date: string;
  title: string;
  description: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "DONE";
  hours: number | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PLANNED:     { label: "Direncanakan", cls: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
  IN_PROGRESS: { label: "Dikerjakan",   cls: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  DONE:        { label: "Selesai",      cls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const EMPTY = { date: todayISO(), title: "", description: "", status: "DONE", hours: "" };

export function TaskLogClient({ canViewAll, canWrite }: { canViewAll: boolean; canWrite: boolean }) {
  const [list, setList] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskLog | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setList(await apiFetch<TaskLog[]>("/api/tasklog"));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Opsi filter karyawan & department diturunkan dari data yang termuat (untuk manajer).
  const people = useMemo(() => {
    const m = new Map<number, string>();
    list.forEach((l) => m.set(l.userId, l.userName));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [list]);

  const departments = useMemo(() => {
    const m = new Map<number, string>();
    list.forEach((l) => { if (l.departmentId) m.set(l.departmentId, l.departmentName!); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);

  const filtered = useMemo(
    () =>
      list.filter((l) => {
        if (userFilter && String(l.userId) !== userFilter) return false;
        if (deptFilter && String(l.departmentId) !== deptFilter) return false;
        if (statusFilter && l.status !== statusFilter) return false;
        const d = l.date.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }),
    [list, userFilter, deptFilter, statusFilter, dateFrom, dateTo]
  );

  // Ekspor mengikuti data yang sedang ditampilkan (hasil filter aktif).
  function exportExcel() {
    downloadExcel("task-log-harian", [{
      name: "Task Log",
      rows: filtered.map((t) => ({
        Tanggal: formatDate(t.date),
        ...(canViewAll ? { Karyawan: t.userName, Department: t.departmentName ?? "—" } : {}),
        Tugas: t.title,
        Deskripsi: t.description ?? "",
        Status: STATUS[t.status].label,
        Jam: t.hours ?? "",
      })),
    }]);
  }

  function exportPdf() {
    const head = ["Tanggal", ...(canViewAll ? ["Karyawan", "Department"] : []), "Tugas", "Status", "Jam"];
    downloadPdfTable({
      filename: "task-log-harian",
      title: "Task Log Harian",
      subtitle: [
        userFilter && `Karyawan: ${people.find((p) => String(p.id) === userFilter)?.name ?? ""}`,
        deptFilter && `Department: ${departments.find((d) => String(d.id) === deptFilter)?.name ?? ""}`,
        statusFilter && `Status: ${STATUS[statusFilter as keyof typeof STATUS].label}`,
        dateFrom && `Dari: ${formatDate(dateFrom)}`,
        dateTo && `Sampai: ${formatDate(dateTo)}`,
      ].filter(Boolean).join(" · ") || undefined,
      head,
      body: filtered.map((t) => [
        formatDate(t.date),
        ...(canViewAll ? [t.userName, t.departmentName ?? "—"] : []),
        t.title,
        STATUS[t.status].label,
        t.hours != null ? `${t.hours}j` : "—",
      ]),
    });
  }

  function openCreate() { setEditing(null); setForm({ ...EMPTY, date: todayISO() }); setError(""); setOpen(true); }
  function openEdit(t: TaskLog) {
    setEditing(t);
    setForm({ date: t.date.slice(0, 10), title: t.title, description: t.description ?? "", status: t.status, hours: t.hours != null ? String(t.hours) : "" });
    setError(""); setOpen(true);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(""); setSaving(true);
    try {
      const payload = {
        date: form.date, title: form.title, description: form.description,
        status: form.status, hours: form.hours === "" ? null : Number(form.hours),
      };
      if (editing) await apiFetch(`/api/tasklog/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiFetch("/api/tasklog", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally { setSaving(false); }
  }

  async function remove(t: TaskLog) {
    if (!confirm(`Hapus task "${t.title}"?`)) return;
    await apiFetch(`/api/tasklog/${t.id}`, { method: "DELETE" });
    await load();
  }

  const set = (k: string) => (ev: any) => setForm((f: any) => ({ ...f, [k]: ev.target.value }));

  return (
    <div>
      <PageHeader
        title="Task Log Harian"
        subtitle="Catat pekerjaan harian Anda. Manajer dapat memantau seluruh tim."
        action={
          <div className="flex items-center gap-2">
            {list.length > 0 && (
              <>
                <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={exportExcel}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </button>
                <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={exportPdf}>
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </button>
              </>
            )}
            {canWrite && (
              <button className="btn-primary" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Tambah Task
              </button>
            )}
          </div>
        }
      />

      <Card className="mb-4 !p-3">
        <div className="flex flex-wrap items-end gap-3">
          {canViewAll && people.length > 0 && (
            <div>
              <label className="label">Karyawan</label>
              <select className="input !w-auto" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                <option value="">Semua karyawan</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {canViewAll && departments.length > 0 && (
            <div>
              <label className="label">Department</label>
              <select className="input !w-auto" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">Semua department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Status</label>
            <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua status</option>
              <option value="PLANNED">Direncanakan</option>
              <option value="IN_PROGRESS">Dikerjakan</option>
              <option value="DONE">Selesai</option>
            </select>
          </div>
          <div>
            <label className="label">Dari tanggal</label>
            <input className="input !w-auto" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Sampai tanggal</label>
            <input className="input !w-auto" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(userFilter || deptFilter || statusFilter || dateFrom || dateTo) && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setUserFilter(""); setDeptFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); }}
            >
              Reset Filter
            </button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
      ) : filtered.length === 0 ? (
        list.length > 0 ? (
          <EmptyState title="Tidak ada task log yang cocok" subtitle="Coba ubah atau reset filter." icon={<ClipboardList className="h-10 w-10" />} />
        ) : (
          <EmptyState title="Belum ada task log" subtitle="Tambahkan catatan pekerjaan harian Anda." icon={<ClipboardList className="h-10 w-10" />} />
        )
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  {canViewAll && <th className="px-5 py-3 font-medium">Karyawan</th>}
                  <th className="px-5 py-3 font-medium">Tugas</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Jam</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 align-top">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(t.date)}</td>
                    {canViewAll && <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.userName}</td>}
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{t.title}</p>
                      {t.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{t.description}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("badge", STATUS[t.status].cls)}>{STATUS[t.status].label}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">{t.hours != null ? `${t.hours}j` : "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600" title="Ubah">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(t)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Ubah Task Log" : "Tambah Task Log"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal *</label>
              <input className="input" type="date" value={form.date} onChange={set("date")} required />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={set("status")}>
                <option value="PLANNED">Direncanakan</option>
                <option value="IN_PROGRESS">Dikerjakan</option>
                <option value="DONE">Selesai</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Judul Tugas *</label>
            <input className="input" value={form.title} onChange={set("title")} required placeholder="mis. Menyelesaikan laporan stok" />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea className="input min-h-[80px]" value={form.description} onChange={set("description")} placeholder="Rincian pekerjaan (opsional)" />
          </div>
          <div>
            <label className="label">Durasi (jam)</label>
            <input className="input" type="number" min={0} max={24} step={0.5} value={form.hours} onChange={set("hours")} placeholder="opsional" />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
