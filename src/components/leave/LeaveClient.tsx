"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatDate, LEAVE_TYPE_LABEL, STATUS_LABEL, cn } from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Leave {
  id: number; type: keyof typeof LEAVE_TYPE_LABEL; startDate: string; endDate: string;
  reason: string; status: "PENDING" | "APPROVED" | "REJECTED"; reviewNote: string | null;
  user: { fullName: string; department: { name: string } | null };
  reviewedBy: { fullName: string } | null;
}

export function LeaveClient({ canRequest, canApprove, canViewAll }: { canRequest: boolean; canApprove: boolean; canViewAll: boolean }) {
  const [scope, setScope] = useState<"mine" | "all">(canViewAll && !canRequest ? "all" : "mine");
  const [list, setList] = useState<Leave[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setList(await apiFetch<Leave[]>(`/api/leave?scope=${scope}`));
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/leave", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ type: "ANNUAL", startDate: "", endDate: "", reason: "" });
      setScope("mine");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengajukan");
    } finally {
      setSaving(false);
    }
  }

  async function review(id: number, action: "approve" | "reject") {
    const note = action === "reject" ? prompt("Alasan penolakan (opsional):") ?? "" : "";
    try {
      await apiFetch(`/api/leave/${id}`, { method: "PATCH", body: JSON.stringify({ action, reviewNote: note }) });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memproses");
    }
  }

  async function cancel(id: number) {
    if (!confirm("Batalkan pengajuan ini?")) return;
    await apiFetch(`/api/leave/${id}`, { method: "DELETE" });
    await load();
  }

  const pendingCount = list.filter((l) => l.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        title="Cuti & Izin"
        subtitle={canApprove ? "Ajukan dan setujui pengajuan cuti karyawan." : "Ajukan cuti/izin dan pantau statusnya."}
        action={canRequest && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Ajukan Cuti</button>}
      />

      {canViewAll && canRequest && (
        <div className="mb-4 flex items-center gap-3">
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 text-sm">
            <button onClick={() => setScope("mine")} className={cn("rounded-md px-4 py-1.5 font-medium", scope === "mine" ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400")}>Pengajuan Saya</button>
            <button onClick={() => setScope("all")} className={cn("rounded-md px-4 py-1.5 font-medium", scope === "all" ? "bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm" : "text-slate-500 dark:text-slate-400")}>Semua Pengajuan</button>
          </div>
          {scope === "all" && pendingCount > 0 && <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{pendingCount} menunggu</span>}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState title="Belum ada pengajuan cuti" icon={<CalendarDays className="h-10 w-10" />} />
      ) : (
        <div className="grid gap-3">
          {list.map((l) => (
            <Card key={l.id} className="!p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{LEAVE_TYPE_LABEL[l.type]}</p>
                      <StatusBadge status={l.status} label={STATUS_LABEL[l.status]} />
                    </div>
                    {scope === "all" && <p className="text-xs text-slate-500 dark:text-slate-400">{l.user.fullName} · {l.user.department?.name ?? "—"}</p>}
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{formatDate(l.startDate)} – {formatDate(l.endDate)}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{l.reason}</p>
                    {l.reviewedBy && (
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Ditinjau oleh {l.reviewedBy.fullName}{l.reviewNote ? ` · "${l.reviewNote}"` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {canApprove && scope === "all" && l.status === "PENDING" && (
                    <>
                      <button className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 !py-2" onClick={() => review(l.id, "approve")}>
                        <Check className="h-4 w-4" /> Setujui
                      </button>
                      <button className="btn-danger !py-2" onClick={() => review(l.id, "reject")}>
                        <X className="h-4 w-4" /> Tolak
                      </button>
                    </>
                  )}
                  {scope === "mine" && l.status === "PENDING" && (
                    <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => cancel(l.id)} title="Batalkan">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Ajukan Cuti / Izin">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Jenis</label>
            <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {Object.entries(LEAVE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tanggal Mulai</label>
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Tanggal Selesai</label>
              <input type="date" className="input" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Alasan</label>
            <textarea className="input min-h-[90px]" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} required />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Mengirim..." : "Kirim Pengajuan"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
