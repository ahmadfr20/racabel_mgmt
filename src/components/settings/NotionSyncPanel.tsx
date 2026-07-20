"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/http";
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

function ResultSummary({ label, result }: { label: string; result: SyncResult }) {
  const skippedDetails = result.details.filter((d) => d.action === "skipped");
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="font-semibold text-slate-800">{label}</h4>
      <div className="mt-2 flex gap-4 text-sm">
        <span className="text-emerald-600">Baru: {result.created}</span>
        <span className="text-brand-600">Diperbarui: {result.updated}</span>
        <span className="text-amber-600">Dilewati: {result.skipped}</span>
      </div>
      {skippedDetails.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
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

  async function runSync() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<SyncResponse>("/api/notion/sync", { method: "POST" });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal sinkronisasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Sinkronisasi Notion</h3>
          <p className="text-sm text-slate-500">
            Tarik data dari workspace Notion Racabel (Task Management System &amp; PDCA) satu arah ke aplikasi ini.
            Perubahan di aplikasi tidak dikirim balik ke Notion. Sinkron otomatis berjalan tiap 15 menit di
            server; tombol ini untuk sinkron manual seketika.
          </p>
        </div>
        <button className="btn-primary" onClick={runSync} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Menyinkronkan..." : "Sinkron Sekarang"}
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {result && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ResultSummary label="Task Management System → Task Log" result={result.task} />
          <ResultSummary label="PDCA → Halaman PDCA" result={result.pdca} />
        </div>
      )}

      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        Pencocokan PIC dilakukan lewat email Notion vs email user di app. Item dengan PIC yang emailnya belum
        terdaftar di app, atau belum punya department, akan dilewati (lihat daftar &quot;Dilewati&quot;).
      </p>
    </Card>
  );
}
