"use client";

import { useEffect, useState } from "react";
import { Clock, Save } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { Card } from "@/components/ui";

interface Schedule {
  id: number; departmentId: number | null; departmentName: string | null;
  checkInTime: string; checkOutTime: string; lateToleranceMin: number; earlyLeaveTolMin: number; workDays: string;
}
interface Option { id: number; name: string }

const DAYS = [
  { v: "1", l: "Sen" }, { v: "2", l: "Sel" }, { v: "3", l: "Rab" },
  { v: "4", l: "Kam" }, { v: "5", l: "Jum" }, { v: "6", l: "Sab" }, { v: "0", l: "Min" },
];

export function SchedulePanel() {
  const [depts, setDepts] = useState<Option[]>([]);
  const [target, setTarget] = useState<string>("global"); // "global" | deptId
  const [form, setForm] = useState<Omit<Schedule, "id" | "departmentName">>({
    departmentId: null, checkInTime: "08:00", checkOutTime: "17:00", lateToleranceMin: 15, earlyLeaveTolMin: 0, workDays: "1,2,3,4,5",
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [opts, sch] = await Promise.all([
      apiFetch<{ departments: Option[] }>("/api/options"),
      apiFetch<Schedule[]>("/api/settings/schedule"),
    ]);
    setDepts(opts.departments);
    setSchedules(sch);
  }
  useEffect(() => { load(); }, []);

  // Muat nilai form saat target berubah
  useEffect(() => {
    const deptId = target === "global" ? null : Number(target);
    const found = schedules.find((s) => s.departmentId === deptId);
    if (found) {
      setForm({ departmentId: deptId, checkInTime: found.checkInTime, checkOutTime: found.checkOutTime, lateToleranceMin: found.lateToleranceMin, earlyLeaveTolMin: found.earlyLeaveTolMin, workDays: found.workDays });
    } else {
      setForm((f) => ({ ...f, departmentId: deptId }));
    }
  }, [target, schedules]);

  const days = form.workDays ? form.workDays.split(",") : [];
  function toggleDay(v: string) {
    const next = days.includes(v) ? days.filter((d) => d !== v) : [...days, v];
    setForm((f) => ({ ...f, workDays: next.join(",") }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/settings/schedule", { method: "PUT", body: JSON.stringify(form) });
      setMsg("Pengaturan jam kerja tersimpan.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800">Atur Jam Masuk & Toleransi</h3>
        </div>

        <label className="label">Berlaku untuk</label>
        <select className="input mb-5" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="global">Semua (Default Global)</option>
          {depts.map((d) => <option key={d.id} value={d.id}>Department: {d.name}</option>)}
        </select>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Jam Masuk</label>
            <input type="time" className="input" value={form.checkInTime} onChange={(e) => setForm((f) => ({ ...f, checkInTime: e.target.value }))} />
          </div>
          <div>
            <label className="label">Jam Pulang</label>
            <input type="time" className="input" value={form.checkOutTime} onChange={(e) => setForm((f) => ({ ...f, checkOutTime: e.target.value }))} />
          </div>
          <div>
            <label className="label">Toleransi Terlambat (menit)</label>
            <input type="number" min={0} className="input" value={form.lateToleranceMin} onChange={(e) => setForm((f) => ({ ...f, lateToleranceMin: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Toleransi Pulang Cepat (menit)</label>
            <input type="number" min={0} className="input" value={form.earlyLeaveTolMin} onChange={(e) => setForm((f) => ({ ...f, earlyLeaveTolMin: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Hari Kerja</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDay(d.v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${days.includes(d.v) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                {d.l}
              </button>
            ))}
          </div>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{msg}</div>}

        <div className="mt-5">
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold text-slate-800">Aturan Penilaian</h3>
        <ul className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span><b>Tepat Waktu</b>: check-in ≤ jam masuk + toleransi.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span><b>Terlambat</b>: check-in melewati batas toleransi.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <span><b>Pulang Cepat</b>: check-out sebelum jam pulang − toleransi.</span>
          </li>
        </ul>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Jadwal khusus department menimpa jadwal global. Bila department tidak punya jadwal khusus, dipakai default global.
        </p>
      </Card>
    </div>
  );
}
