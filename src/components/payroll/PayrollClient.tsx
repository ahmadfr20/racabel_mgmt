"use client";

import { useCallback, useEffect, useState } from "react";
import { Gauge, Pencil, Plus, SlidersHorizontal, Trash2, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { Modal } from "@/components/Modal";

interface PayrollRow {
  userId: number; fullName: string; department: string | null; role: string;
  baseSalary: number; performanceAllowance: number; score: number;
  performanceAmount: number; totalSalary: number;
}
interface Kpi { id: number; name: string; description: string | null; weight: number; active: boolean }

function periodOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d),
    });
  }
  return opts;
}

export function PayrollClient({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<"payroll" | "kpi">("payroll");
  const periods = periodOptions();
  const [period, setPeriod] = useState(periods[0].value);
  const [data, setData] = useState<{ rows: PayrollRow[]; totals: { base: number; perf: number; total: number } } | null>(null);
  const [scoreUser, setScoreUser] = useState<PayrollRow | null>(null);

  const load = useCallback(async () => {
    setData(await apiFetch(`/api/payroll?period=${period}`));
  }, [period]);
  useEffect(() => { if (tab === "payroll") load(); }, [load, tab]);

  return (
    <div>
      <PageHeader title="Kinerja & Penggajian" subtitle="Gaji dihitung dari gaji pokok + tunjangan kinerja × capaian berbobot." />

      <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setTab("payroll")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium", tab === "payroll" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500")}>
          <Wallet className="h-4 w-4" /> Penggajian
        </button>
        {canManage && (
          <button onClick={() => setTab("kpi")} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium", tab === "kpi" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500")}>
            <SlidersHorizontal className="h-4 w-4" /> KPI & Bobot
          </button>
        )}
      </div>

      {tab === "payroll" ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <select className="input !w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {periods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {data && (
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Total Gaji Pokok" value={formatCurrency(data.totals.base)} tone="slate" icon={<Wallet className="h-5 w-5" />} />
              <StatCard label="Total Tunjangan Kinerja" value={formatCurrency(data.totals.perf)} tone="amber" icon={<Gauge className="h-5 w-5" />} />
              <StatCard label="Total Pengeluaran Gaji" value={formatCurrency(data.totals.total)} tone="brand" icon={<Wallet className="h-5 w-5" />} />
            </div>
          )}

          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Karyawan</th>
                    <th className="px-5 py-3 font-medium">Gaji Pokok</th>
                    <th className="px-5 py-3 font-medium">Skor Kinerja</th>
                    <th className="px-5 py-3 font-medium">Tunjangan</th>
                    <th className="px-5 py-3 font-medium">Total Gaji</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.rows.map((r) => (
                    <tr key={r.userId} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{r.fullName}</p>
                        <p className="text-xs text-slate-400">{r.department ?? "—"} · {r.role}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatCurrency(r.baseSalary)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${r.score}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{r.score}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-amber-600">{formatCurrency(r.performanceAmount)}</td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{formatCurrency(r.totalSalary)}</td>
                      {canManage && (
                        <td className="px-5 py-3 text-right">
                          <button className="btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setScoreUser(r)}>
                            <Pencil className="h-3.5 w-3.5" /> Input Nilai
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <KpiPanel />
      )}

      {scoreUser && (
        <ScoreModal
          user={scoreUser}
          period={period}
          onClose={() => setScoreUser(null)}
          onSaved={() => { setScoreUser(null); load(); }}
        />
      )}
    </div>
  );
}

// ===== Modal input nilai KPI per karyawan =====
function ScoreModal({ user, period, onClose, onSaved }: { user: PayrollRow; period: string; onClose: () => void; onSaved: () => void }) {
  const [metrics, setMetrics] = useState<{ id: number; name: string; weight: number; score: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ metrics: any[] }>(`/api/performance?userId=${user.userId}&period=${period}`).then((d) => setMetrics(d.metrics));
  }, [user.userId, period]);

  const totalWeight = metrics.reduce((s, m) => s + m.weight, 0);
  const weighted = totalWeight ? metrics.reduce((s, m) => s + m.score * m.weight, 0) / totalWeight : 0;

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/performance", {
        method: "PUT",
        body: JSON.stringify({ userId: user.userId, period, scores: metrics.map((m) => ({ metricId: m.id, score: m.score })) }),
      });
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Input Capaian — ${user.fullName}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Periode {period}. Masukkan capaian tiap KPI (0–100).</p>
        {metrics.map((m, i) => (
          <div key={m.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{m.name}</span>
              <span className="text-xs text-slate-400">bobot {m.weight}%</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range" min={0} max={100} value={m.score}
                onChange={(e) => setMetrics((arr) => arr.map((x, j) => (j === i ? { ...x, score: Number(e.target.value) } : x)))}
                className="flex-1 accent-brand-600"
              />
              <input
                type="number" min={0} max={100} value={m.score}
                onChange={(e) => setMetrics((arr) => arr.map((x, j) => (j === i ? { ...x, score: Math.min(100, Math.max(0, Number(e.target.value))) } : x)))}
                className="input !w-20 !py-1.5 text-center"
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
          <span className="text-sm font-medium text-brand-700">Skor Berbobot</span>
          <span className="text-lg font-bold text-brand-700">{Math.round(weighted * 100) / 100}</span>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Nilai"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ===== Panel kelola KPI & bobot =====
function KpiPanel() {
  const [list, setList] = useState<Kpi[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Kpi | null>(null);
  const [form, setForm] = useState({ name: "", description: "", weight: "0" });
  const [error, setError] = useState("");

  async function load() { setList(await apiFetch<Kpi[]>("/api/kpi")); }
  useEffect(() => { load(); }, []);

  const totalWeight = list.filter((k) => k.active).reduce((s, k) => s + k.weight, 0);

  function openCreate() { setEditing(null); setForm({ name: "", description: "", weight: "0" }); setError(""); setOpen(true); }
  function openEdit(k: Kpi) { setEditing(k); setForm({ name: k.name, description: k.description ?? "", weight: String(k.weight) }); setError(""); setOpen(true); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body = JSON.stringify({ name: form.name, description: form.description, weight: Number(form.weight) });
      if (editing) await apiFetch(`/api/kpi/${editing.id}`, { method: "PATCH", body });
      else await apiFetch("/api/kpi", { method: "POST", body });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    }
  }

  async function remove(k: Kpi) {
    if (!confirm(`Hapus KPI ${k.name}?`)) return;
    await apiFetch(`/api/kpi/${k.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className={cn("badge", totalWeight === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
          Total bobot aktif: {totalWeight}%{totalWeight !== 100 ? " (idealnya 100%)" : ""}
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Tambah KPI</button>
      </div>

      <div className="grid gap-3">
        {list.map((k) => (
          <Card key={k.id} className="!p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">{k.name}</p>
                  {!k.active && <span className="badge bg-slate-100 text-slate-500">Nonaktif</span>}
                </div>
                <p className="truncate text-sm text-slate-500">{k.description || "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold text-brand-700">{k.weight}%</p>
                  <p className="text-xs text-slate-400">bobot</p>
                </div>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></button>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(k)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Ubah KPI" : "Tambah KPI"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nama KPI *</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Bobot (%)</label>
            <input type="number" min={0} max={100} className="input" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} required />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button type="submit" className="btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
