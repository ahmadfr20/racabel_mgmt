"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatDate, cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface Pdca {
  id: number;
  userId: number;
  userName: string;
  title: string;
  plan: string;
  doAction: string | null;
  checkResult: string | null;
  actFollowUp: string | null;
  status: "PLAN" | "DO" | "CHECK" | "ACT" | "DONE";
  startDate: string | null;
  dueDate: string | null;
}
interface Person { id: number; fullName: string }

const STATUS: Record<string, { label: string; cls: string }> = {
  PLAN:  { label: "Plan",    cls: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  DO:    { label: "Do",      cls: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  CHECK: { label: "Check",   cls: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400" },
  ACT:   { label: "Act",     cls: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" },
  DONE:  { label: "Selesai", cls: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
};

const EMPTY = {
  title: "", plan: "", doAction: "", checkResult: "", actFollowUp: "",
  status: "PLAN", startDate: "", dueDate: "", userId: "",
};

export function PdcaClient({ canManage }: { canManage: boolean }) {
  const [list, setList] = useState<Pdca[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pdca | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setList(await apiFetch<Pdca[]>("/api/pdca"));
    setLoading(false);
  }
  useEffect(() => {
    load();
    if (canManage) {
      apiFetch<Person[]>("/api/employees").then(setPeople).catch(() => setPeople([]));
    }
  }, [canManage]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(""); setOpen(true); }
  function openEdit(p: Pdca) {
    setEditing(p);
    setForm({
      title: p.title, plan: p.plan, doAction: p.doAction ?? "", checkResult: p.checkResult ?? "",
      actFollowUp: p.actFollowUp ?? "", status: p.status,
      startDate: p.startDate ? p.startDate.slice(0, 10) : "", dueDate: p.dueDate ? p.dueDate.slice(0, 10) : "",
      userId: String(p.userId),
    });
    setError(""); setOpen(true);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(""); setSaving(true);
    try {
      const payload = {
        title: form.title, plan: form.plan, doAction: form.doAction, checkResult: form.checkResult,
        actFollowUp: form.actFollowUp, status: form.status, startDate: form.startDate, dueDate: form.dueDate,
        userId: form.userId ? Number(form.userId) : null,
      };
      if (editing) await apiFetch(`/api/pdca/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await apiFetch("/api/pdca", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally { setSaving(false); }
  }

  async function remove(p: Pdca) {
    if (!confirm(`Hapus PDCA "${p.title}"?`)) return;
    await apiFetch(`/api/pdca/${p.id}`, { method: "DELETE" });
    await load();
  }

  const set = (k: string) => (ev: any) => setForm((f: any) => ({ ...f, [k]: ev.target.value }));

  return (
    <div>
      <PageHeader
        title="Manajemen PDCA"
        subtitle="Siklus perbaikan berkelanjutan: Plan → Do → Check → Act."
        action={canManage && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah PDCA
          </button>
        )}
      />

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Memuat data...</div>
      ) : list.length === 0 ? (
        <EmptyState title="Belum ada siklus PDCA" subtitle="Buat siklus perbaikan pertama Anda." icon={<RefreshCcw className="h-10 w-10" />} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{p.title}</h3>
                    <span className={cn("badge", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    PIC: {p.userName}
                    {p.dueDate && ` · Target: ${formatDate(p.dueDate)}`}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(p)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Quadrant color="blue"   label="Plan"  text={p.plan} />
                <Quadrant color="amber"  label="Do"    text={p.doAction} />
                <Quadrant color="violet" label="Check" text={p.checkResult} />
                <Quadrant color="orange" label="Act"   text={p.actFollowUp} />
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal open onClose={() => setOpen(false)} title={editing ? "Ubah PDCA" : "Tambah PDCA"} size="lg">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Judul / Tema *</label>
                <input className="input" value={form.title} onChange={set("title")} required placeholder="mis. Mengurangi keterlambatan pengiriman" />
              </div>
              {people.length > 0 && (
                <div>
                  <label className="label">Penanggung Jawab (PIC)</label>
                  <select className="input" value={form.userId} onChange={set("userId")}>
                    <option value="">— Saya sendiri —</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={set("status")}>
                  <option value="PLAN">Plan</option>
                  <option value="DO">Do</option>
                  <option value="CHECK">Check</option>
                  <option value="ACT">Act</option>
                  <option value="DONE">Selesai</option>
                </select>
              </div>
              <div>
                <label className="label">Tanggal Mulai</label>
                <input className="input" type="date" value={form.startDate} onChange={set("startDate")} />
              </div>
              <div>
                <label className="label">Target Selesai</label>
                <input className="input" type="date" value={form.dueDate} onChange={set("dueDate")} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Plan (Rencana) *</label>
                <textarea className="input min-h-[70px]" value={form.plan} onChange={set("plan")} required placeholder="Apa masalah/target & rencana tindakan?" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Do (Pelaksanaan)</label>
                <textarea className="input min-h-[70px]" value={form.doAction} onChange={set("doAction")} placeholder="Apa yang dikerjakan?" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Check (Evaluasi)</label>
                <textarea className="input min-h-[70px]" value={form.checkResult} onChange={set("checkResult")} placeholder="Hasil vs target, apa temuannya?" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Act (Tindak Lanjut)</label>
                <textarea className="input min-h-[70px]" value={form.actFollowUp} onChange={set("actFollowUp")} placeholder="Standarisasi / perbaikan lanjutan?" />
              </div>
            </div>
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Quadrant({ color, label, text }: { color: string; label: string; text: string | null }) {
  const head: Record<string, string> = {
    blue:   "text-blue-700 dark:text-blue-400",
    amber:  "text-amber-700 dark:text-amber-400",
    violet: "text-violet-700 dark:text-violet-400",
    orange: "text-orange-700 dark:text-orange-400",
  };
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
      <p className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", head[color])}>{label}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{text || <span className="text-slate-300 dark:text-slate-600">—</span>}</p>
    </div>
  );
}
