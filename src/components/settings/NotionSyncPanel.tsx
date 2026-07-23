"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Save, Clock } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui";

interface SyncItemResult {
  notionPageId: string;
  title: string;
  action: "created" | "updated" | "skipped";
  reason?: string;
}
interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  details: SyncItemResult[];
}
interface SyncResponse {
  task: SyncResult;
  pdca: SyncResult;
}
interface IntervalSettings {
  intervalMinutes: number;
  lastSyncedAt: string | null;
}

const INTERVAL_OPTIONS = [
  { value: 15, label: "Setiap 15 menit" },
  { value: 30, label: "Setiap 30 menit" },
  { value: 60, label: "Setiap 1 jam" },
  { value: 120, label: "Setiap 2 jam" },
  { value: 240, label: "Setiap 4 jam" },
  { value: 360, label: "Setiap 6 jam" },
  { value: 720, label: "Setiap 12 jam" },
  { value: 1440, label: "Setiap 24 jam" },
];

function intervalLabel(minutes: number) {
  const found = INTERVAL_OPTIONS.find((o) => o.value === minutes);
  if (found) return found.label;
  return minutes % 60 === 0 ? `Setiap ${minutes / 60} jam` : `Setiap ${minutes} menit`;
}

function ResultSummary({ label, result }: { label: string; result: SyncResult }) {
  const skippedDetails = result.details.filter((d) => d.action === "skipped");
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h4 className="font-semibold text-slate-800 dark:text-slate-100">{label}</h4>
      <div className="mt-2 flex gap-4 text-sm">
        <span className="text-emerald-600 dark:text-emerald-400">Baru: {result.created}</span>
        <span className="text-brand-600 dark:text-brand-400">Diperbarui: {result.updated}</span>
        <span className="text-amber-600 dark:text-amber-400">Dilewati: {result.skipped}</span>
      </div>
      {skippedDetails.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          {skippedDetails.map((d) => (
            <li key={d.notionPageId}>
              <b>{d.title}</b> — {d.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NotionSyncPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResponse | null>(null);

  const [settings, setSettings] = useState<IntervalSettings | null>(null);
  const [intervalDraft, setIntervalDraft] = useState(60);
  const [savingInterval, setSavingInterval] = useState(false);
  const [intervalMsg, setIntervalMsg] = useState("");

  async function loadSettings() {
    try {
      const s = await apiFetch<IntervalSettings>("/api/notion/settings");
      setSettings(s);
      setIntervalDraft(s.intervalMinutes);
    } catch {
      // biarkan default 60 menit kalau gagal dimuat (mis. belum ada authority)
    }
  }
  useEffect(() => { loadSettings(); }, []);

  async function saveInterval() {
    setSavingInterval(true);
    setIntervalMsg("");
    try {
      await apiFetch("/api/notion/settings", { method: "PUT", body: JSON.stringify({ intervalMinutes: intervalDraft }) });
      setIntervalMsg("Interval sinkron otomatis tersimpan.");
      await loadSettings();
    } catch (err) {
      setIntervalMsg(err instanceof Error ? err.message : "Gagal menyimpan interval");
    } finally {
      setSavingInterval(false);
    }
  }

  async function runSync() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<SyncResponse>("/api/notion/sync", { method: "POST" });
      setResult(res);
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal sinkronisasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Jadwal Sinkron Otomatis</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Interval</label>
            <select className="input !w-auto" value={intervalDraft} onChange={(e) => setIntervalDraft(Number(e.target.value))}>
              {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={saveInterval} disabled={savingInterval}>
            <Save className="h-4 w-4" /> {savingInterval ? "Menyimpan..." : "Simpan Interval"}
          </button>
        </div>
        {intervalMsg && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{intervalMsg}</p>}
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {settings?.lastSyncedAt
            ? `Sinkron otomatis terakhir jalan: ${formatDate(settings.lastSyncedAt, true)}.`
            : "Sinkron otomatis belum pernah jalan."}
        </p>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sinkronisasi Notion</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tarik data dari workspace Notion Racabel (Task Management System &amp; PDCA) satu arah ke aplikasi ini.
              Perubahan di aplikasi tidak dikirim balik ke Notion. Sinkron otomatis berjalan {intervalLabel(settings?.intervalMinutes ?? 60).toLowerCase()};
              tombol ini untuk sinkron manual seketika.
            </p>
          </div>
          <button className="btn-primary shrink-0" onClick={runSync} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Menyinkronkan..." : "Sinkron Sekarang"}
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

        {result && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ResultSummary label="Task Management System → Task Log" result={result.task} />
            <ResultSummary label="PDCA → Halaman PDCA" result={result.pdca} />
          </div>
        )}

        <p className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-500 dark:text-slate-400">
          Pencocokan PIC dilakukan lewat email Notion vs email user di app. Item dengan PIC yang emailnya belum
          terdaftar di app, atau belum punya department, akan dilewati (lihat daftar &quot;Dilewati&quot;).
        </p>
      </Card>
    </div>
  );
}
