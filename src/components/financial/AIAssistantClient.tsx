"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileSpreadsheet, GitCompareArrows, Loader2, TrendingDown, TrendingUp, Trash2, Wallet,
  FileText, BookOpen, Lock, Globe, FileDown,
} from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, PageHeader, StatCard, EmptyState } from "@/components/ui";
import { AIAssistantChat } from "@/components/financial/AIAssistantChat";
import { downloadExcel, downloadPdfTable, downloadPdfDocument } from "@/lib/exportFile";

// ─── Types ───────────────────────────────────────────────────────────────────

type Visibility = "PRIVATE" | "EVERYONE";

interface ImportSummary {
  id: number; fileName: string; status: "PROCESSING" | "COMPLETED" | "FAILED";
  currency: string; totalIncome: number; totalExpense: number;
  aiNotes: string | null; errorMessage: string | null;
  transactionCount: number; uploadedByName: string; createdAt: string;
  visibility: Visibility; isOwner: boolean;
}

interface Transaction {
  id: number; date: string; description: string; category: string;
  type: "INCOME" | "EXPENSE"; amount: number; notes: string | null;
}

interface ImportDetail {
  id: number; fileName: string; status: "PROCESSING" | "COMPLETED" | "FAILED";
  currency: string; totalIncome: number; totalExpense: number;
  aiNotes: string | null; errorMessage: string | null; createdAt: string;
  uploadedBy: { fullName: string }; transactions: Transaction[];
  visibility: Visibility; isOwner: boolean;
}

interface Comparison {
  id: number; title: string; scopeALabel: string; scopeBLabel: string;
  totalIncomeA: number; totalExpenseA: number; totalIncomeB: number; totalExpenseB: number;
  analysis: string; createdByName: string; createdAt: string;
  visibility: Visibility; isOwner: boolean;
}

interface CpasPlan {
  id: number; title: string; period: string; content: string; promo: string;
  audience: string; strategy: string; picName: string | null;
  createdByName: string; createdAt: string;
}

interface SopPlan {
  id: number; title: string; description: string; department: string;
  picName: string | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdByName: string; createdAt: string;
}

type ActiveTab = "keuangan" | "cpas" | "sop";

// ─── Main component ───────────────────────────────────────────────────────────

export function AIAssistantClient({ canUpload }: { canUpload: boolean }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("keuangan");

  // Keuangan
  const [history, setHistory] = useState<ImportSummary[]>([]);
  const [selected, setSelected] = useState<ImportDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loadingComparisons, setLoadingComparisons] = useState(true);

  // CPAS
  const [cpasList, setCpasList] = useState<CpasPlan[]>([]);
  const [loadingCpas, setLoadingCpas] = useState(true);

  // SOP
  const [sopList, setSopList] = useState<SopPlan[]>([]);
  const [loadingSop, setLoadingSop] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try { setHistory(await apiFetch<ImportSummary[]>("/api/financial/import")); }
    finally { setLoadingHistory(false); }
  }, []);

  const loadComparisons = useCallback(async () => {
    setLoadingComparisons(true);
    try { setComparisons(await apiFetch<Comparison[]>("/api/financial/comparisons")); }
    finally { setLoadingComparisons(false); }
  }, []);

  const loadCpas = useCallback(async () => {
    setLoadingCpas(true);
    try { setCpasList(await apiFetch<CpasPlan[]>("/api/cpas")); }
    finally { setLoadingCpas(false); }
  }, []);

  const loadSop = useCallback(async () => {
    setLoadingSop(true);
    try { setSopList(await apiFetch<SopPlan[]>("/api/sop")); }
    finally { setLoadingSop(false); }
  }, []);

  useEffect(() => {
    loadHistory();
    loadComparisons();
    loadCpas();
    loadSop();
  }, [loadHistory, loadComparisons, loadCpas, loadSop]);

  async function removeImport(id: number) {
    if (!confirm("Hapus riwayat impor ini beserta seluruh transaksinya?")) return;
    await apiFetch(`/api/financial/import/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await loadHistory();
  }

  async function removeComparison(id: number) {
    if (!confirm("Hapus riwayat komparasi ini?")) return;
    await apiFetch(`/api/financial/comparisons/${id}`, { method: "DELETE" });
    await loadComparisons();
  }

  async function toggleImportVisibility(h: { id: number; visibility: Visibility }) {
    const next: Visibility = h.visibility === "PRIVATE" ? "EVERYONE" : "PRIVATE";
    await apiFetch(`/api/financial/import/${h.id}`, { method: "PATCH", body: JSON.stringify({ visibility: next }) });
    await loadHistory();
    if (selected?.id === h.id) await openDetail(h.id);
  }

  async function toggleComparisonVisibility(c: { id: number; visibility: Visibility }) {
    const next: Visibility = c.visibility === "PRIVATE" ? "EVERYONE" : "PRIVATE";
    await apiFetch(`/api/financial/comparisons/${c.id}`, { method: "PATCH", body: JSON.stringify({ visibility: next }) });
    await loadComparisons();
  }

  async function removeCpas(id: number) {
    if (!confirm("Hapus CPAS Plan ini?")) return;
    await apiFetch(`/api/cpas/${id}`, { method: "DELETE" });
    await loadCpas();
  }

  async function removeSop(id: number) {
    if (!confirm("Hapus SOP Plan ini?")) return;
    await apiFetch(`/api/sop/${id}`, { method: "DELETE" });
    await loadSop();
  }

  async function openDetail(id: number) {
    const detail = await apiFetch<ImportDetail>(`/api/financial/import/${id}`);
    setSelected(detail);
  }

  function handleDataChanged() {
    loadHistory();
    loadComparisons();
    loadCpas();
    loadSop();
  }

  // ── Ekspor Excel/PDF ──────────────────────────────────────────────────────

  function exportImportHistory(fmt: "excel" | "pdf") {
    const visLabel = (v: Visibility) => (v === "PRIVATE" ? "Privat" : "Semua orang");
    if (fmt === "excel") {
      downloadExcel("riwayat-impor-keuangan", [{
        name: "Riwayat Impor",
        rows: history.map((h) => ({
          File: h.fileName, Status: h.status, Visibilitas: visLabel(h.visibility),
          Transaksi: h.transactionCount, Pemasukan: h.totalIncome, Pengeluaran: h.totalExpense,
          "Diunggah oleh": h.uploadedByName, Tanggal: formatDate(h.createdAt, true),
        })),
      }]);
    } else {
      downloadPdfTable({
        filename: "riwayat-impor-keuangan",
        title: "Riwayat Impor Keuangan",
        head: ["File", "Status", "Visibilitas", "Transaksi", "Pemasukan", "Pengeluaran", "Diunggah oleh", "Tanggal"],
        body: history.map((h) => [
          h.fileName, h.status, visLabel(h.visibility), h.transactionCount,
          formatCurrency(h.totalIncome), formatCurrency(h.totalExpense), h.uploadedByName, formatDate(h.createdAt, true),
        ]),
      });
    }
  }

  function exportImportDetail(detail: ImportDetail, fmt: "excel" | "pdf") {
    const fname = `hasil-ekstraksi-${detail.fileName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    if (fmt === "excel") {
      downloadExcel(fname, [{
        name: "Transaksi",
        rows: detail.transactions.map((t) => ({
          Tanggal: formatDate(t.date), Deskripsi: t.description, Kategori: t.category,
          Jenis: t.type === "INCOME" ? "Pemasukan" : "Pengeluaran", Nominal: t.amount, Catatan: t.notes ?? "",
        })),
      }]);
    } else {
      downloadPdfTable({
        filename: fname,
        title: `Hasil Ekstraksi — ${detail.fileName}`,
        subtitle: `Total Pemasukan ${formatCurrency(detail.totalIncome)} · Total Pengeluaran ${formatCurrency(detail.totalExpense)}`,
        head: ["Tanggal", "Deskripsi", "Kategori", "Jenis", "Nominal", "Catatan"],
        body: detail.transactions.map((t) => [
          formatDate(t.date), t.description, t.category, t.type === "INCOME" ? "Pemasukan" : "Pengeluaran",
          formatCurrency(t.amount), t.notes ?? "",
        ]),
      });
    }
  }

  function exportComparisons(fmt: "excel" | "pdf") {
    if (fmt === "excel") {
      downloadExcel("riwayat-komparasi-keuangan", [{
        name: "Komparasi",
        rows: comparisons.map((c) => ({
          Judul: c.title,
          "Ruang Lingkup A": c.scopeALabel, "Pemasukan A": c.totalIncomeA, "Pengeluaran A": c.totalExpenseA, "Net A": c.totalIncomeA - c.totalExpenseA,
          "Ruang Lingkup B": c.scopeBLabel, "Pemasukan B": c.totalIncomeB, "Pengeluaran B": c.totalExpenseB, "Net B": c.totalIncomeB - c.totalExpenseB,
          Analisis: c.analysis, "Dibuat oleh": c.createdByName, Tanggal: formatDate(c.createdAt, true),
        })),
      }]);
    } else {
      downloadPdfTable({
        filename: "riwayat-komparasi-keuangan",
        title: "Riwayat Komparasi Keuangan",
        head: ["Judul", "Lingkup A", "Net A", "Lingkup B", "Net B", "Analisis", "Dibuat oleh", "Tanggal"],
        body: comparisons.map((c) => [
          c.title, c.scopeALabel, formatCurrency(c.totalIncomeA - c.totalExpenseA),
          c.scopeBLabel, formatCurrency(c.totalIncomeB - c.totalExpenseB),
          c.analysis, c.createdByName, formatDate(c.createdAt, true),
        ]),
      });
    }
  }

  function exportCpasPdf() {
    downloadPdfDocument("cpas-plans", "CPAS Plans Afiliasi", cpasList.map((c) => ({
      title: c.title,
      meta: `${c.period} · oleh ${c.createdByName}${c.picName ? ` · PIC: ${c.picName}` : ""} · ${formatDate(c.createdAt, true)}`,
      blocks: [
        { label: "Content", text: c.content },
        { label: "Promo", text: c.promo },
        { label: "Audience", text: c.audience },
        { label: "Strategy", text: c.strategy },
      ],
    })));
  }

  function exportSopPdf() {
    downloadPdfDocument("sop-plans", "SOP Plans Afiliasi", sopList.map((s) => ({
      title: s.title,
      meta: `${s.department}${s.picName ? ` · PIC: ${s.picName}` : ""} · ${s.status} · oleh ${s.createdByName} · ${formatDate(s.createdAt, true)}`,
      blocks: [{ label: "Deskripsi", text: s.description }],
    })));
  }

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        subtitle="Chat dengan AI untuk mengelola keuangan, PDCA, task log, kinerja & gaji, serta membuat CPAS Plan dan SOP afiliasi."
      />

      <AIAssistantChat canUpload={canUpload} onDataChanged={handleDataChanged} />

      {selected && (
        <ImportResult
          detail={selected}
          onDelete={canUpload && selected.isOwner ? () => removeImport(selected.id) : undefined}
          onToggleVisibility={() => toggleImportVisibility(selected)}
          onExportExcel={() => exportImportDetail(selected, "excel")}
          onExportPdf={() => exportImportDetail(selected, "pdf")}
        />
      )}

      {/* ── Tab bar ── */}
      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(["keuangan", "cpas", "sop"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {tab === "keuangan" ? "Keuangan" : tab === "cpas" ? "CPAS Plans" : "SOP Plans"}
          </button>
        ))}
      </div>

      {/* ── Tab: Keuangan ── */}
      {activeTab === "keuangan" && (
        <>
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Impor</h3>
              {history.length > 0 && (
                <ExportButtons onExcel={() => exportImportHistory("excel")} onPdf={() => exportImportHistory("pdf")} />
              )}
            </div>
            {loadingHistory ? (
              <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : history.length === 0 ? (
              <EmptyState title="Belum ada riwayat impor" subtitle="File keuangan yang diunggah akan muncul di sini." icon={<FileSpreadsheet className="h-10 w-10" />} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-3 font-medium">File</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Visibilitas</th>
                      <th className="px-5 py-3 font-medium">Transaksi</th>
                      <th className="px-5 py-3 font-medium">Pemasukan</th>
                      <th className="px-5 py-3 font-medium">Pengeluaran</th>
                      <th className="px-5 py-3 font-medium">Diunggah</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {history.map((h) => (
                      <tr key={h.id} className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40" onClick={() => h.status === "COMPLETED" && openDetail(h.id)}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{h.fileName}</p>
                          <p className="text-xs text-slate-400">oleh {h.uploadedByName}</p>
                        </td>
                        <td className="px-5 py-3"><ImportStatusBadge status={h.status} /></td>
                        <td className="px-5 py-3"><VisibilityBadge visibility={h.visibility} isOwner={h.isOwner} onToggle={() => toggleImportVisibility(h)} /></td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{h.transactionCount}</td>
                        <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400">{formatCurrency(h.totalIncome)}</td>
                        <td className="px-5 py-3 text-red-600 dark:text-red-400">{formatCurrency(h.totalExpense)}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(h.createdAt, true)}</td>
                        <td className="px-5 py-3 text-right">
                          {canUpload && h.isOwner && (
                            <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={(e) => { e.stopPropagation(); removeImport(h.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="!p-0 overflow-hidden mt-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Komparasi Keuangan</h3>
              {comparisons.length > 0 && (
                <ExportButtons onExcel={() => exportComparisons("excel")} onPdf={() => exportComparisons("pdf")} />
              )}
            </div>
            {loadingComparisons ? (
              <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : comparisons.length === 0 ? (
              <EmptyState title="Belum ada hasil komparasi" subtitle="Minta AI Assistant untuk membandingkan keuangan dan menyimpan hasilnya." icon={<GitCompareArrows className="h-10 w-10" />} />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {comparisons.map((c) => {
                  const netA = c.totalIncomeA - c.totalExpenseA;
                  const netB = c.totalIncomeB - c.totalExpenseB;
                  return (
                    <div key={c.id} className="p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{c.title}</p>
                            <VisibilityBadge visibility={c.visibility} isOwner={c.isOwner} onToggle={() => toggleComparisonVisibility(c)} />
                          </div>
                          <p className="text-xs text-slate-400">oleh {c.createdByName} · {formatDate(c.createdAt, true)}</p>
                        </div>
                        {canUpload && c.isOwner && (
                          <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={() => removeComparison(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.scopeALabel}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Pemasukan: {formatCurrency(c.totalIncomeA)}</p>
                          <p className="text-xs text-red-600 dark:text-red-400">Pengeluaran: {formatCurrency(c.totalExpenseA)}</p>
                          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Net: {formatCurrency(netA)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.scopeBLabel}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Pemasukan: {formatCurrency(c.totalIncomeB)}</p>
                          <p className="text-xs text-red-600 dark:text-red-400">Pengeluaran: {formatCurrency(c.totalExpenseB)}</p>
                          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Net: {formatCurrency(netB)}</p>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{c.analysis}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Tab: CPAS Plans ── */}
      {activeTab === "cpas" && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">CPAS Plans Afiliasi</h3>
            {cpasList.length > 0 && <ExportButtons onPdf={exportCpasPdf} />}
          </div>
          {loadingCpas ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : cpasList.length === 0 ? (
            <EmptyState title="Belum ada CPAS Plan" subtitle="Minta AI Assistant untuk membuat CPAS Plan afiliasi." icon={<FileText className="h-10 w-10" />} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {cpasList.map((c) => (
                <div key={c.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{c.title}</p>
                      <p className="text-xs text-slate-400">
                        {c.period} · oleh {c.createdByName}{c.picName ? ` · PIC: ${c.picName}` : ""}
                        {" · "}{formatDate(c.createdAt, true)}
                      </p>
                    </div>
                    {canUpload && (
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={() => removeCpas(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["content", "promo", "audience", "strategy"] as const).map((field) => (
                      <div key={field} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {field === "content" ? "Content" : field === "promo" ? "Promo" : field === "audience" ? "Audience" : "Strategy"}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{c[field]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: SOP Plans ── */}
      {activeTab === "sop" && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">SOP Plans Afiliasi</h3>
            {sopList.length > 0 && <ExportButtons onPdf={exportSopPdf} />}
          </div>
          {loadingSop ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : sopList.length === 0 ? (
            <EmptyState title="Belum ada SOP Plan" subtitle="Minta AI Assistant untuk membuat SOP prosedur afiliasi." icon={<BookOpen className="h-10 w-10" />} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {sopList.map((s) => (
                <div key={s.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
                        <SopStatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-slate-400">
                        {s.department}{s.picName ? ` · PIC: ${s.picName}` : ""} · oleh {s.createdByName} · {formatDate(s.createdAt, true)}
                      </p>
                    </div>
                    {canUpload && (
                      <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600" onClick={() => removeSop(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{s.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ImportStatusBadge({ status }: { status: ImportSummary["status"] }) {
  const map: Record<ImportSummary["status"], string> = {
    COMPLETED: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    PROCESSING: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    FAILED: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  };
  const label: Record<ImportSummary["status"], string> = { COMPLETED: "Berhasil", PROCESSING: "Diproses", FAILED: "Gagal" };
  return <span className={cn("badge", map[status])}>{label[status]}</span>;
}

// Badge visibilitas — klik untuk toggle bila pengguna adalah pemiliknya.
function VisibilityBadge({ visibility, isOwner, onToggle }: { visibility: Visibility; isOwner: boolean; onToggle?: () => void }) {
  const isPrivate = visibility === "PRIVATE";
  const badge = (
    <span
      className={cn(
        "badge inline-flex items-center gap-1",
        isPrivate ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400" : "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
      )}
    >
      {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
      {isPrivate ? "Privat" : "Semua orang"}
    </span>
  );
  if (!isOwner || !onToggle) return badge;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={isPrivate ? "Klik untuk buat terlihat semua orang" : "Klik untuk buat privat (hanya Anda)"}
      className="transition-opacity hover:opacity-70"
    >
      {badge}
    </button>
  );
}

// Tombol ekspor Excel/PDF — dipakai di header tiap section riwayat.
function ExportButtons({ onExcel, onPdf }: { onExcel?: () => void; onPdf: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {onExcel && (
        <button onClick={onExcel} className="btn-ghost !py-1.5 !px-3 text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </button>
      )}
      <button onClick={onPdf} className="btn-ghost !py-1.5 !px-3 text-xs">
        <FileDown className="h-3.5 w-3.5" /> PDF
      </button>
    </div>
  );
}

function SopStatusBadge({ status }: { status: SopPlan["status"] }) {
  const map: Record<SopPlan["status"], string> = {
    DRAFT: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    ACTIVE: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    ARCHIVED: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  };
  const label: Record<SopPlan["status"], string> = { DRAFT: "Draft", ACTIVE: "Aktif", ARCHIVED: "Diarsipkan" };
  return <span className={cn("badge", map[status])}>{label[status]}</span>;
}

function ImportResult({
  detail, onDelete, onToggleVisibility, onExportExcel, onExportPdf,
}: {
  detail: ImportDetail; onDelete?: () => void; onToggleVisibility: () => void;
  onExportExcel: () => void; onExportPdf: () => void;
}) {
  const net = detail.totalIncome - detail.totalExpense;
  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hasil Ekstraksi — {detail.fileName}</h3>
            <VisibilityBadge visibility={detail.visibility} isOwner={detail.isOwner} onToggle={onToggleVisibility} />
          </div>
          <p className="text-xs text-slate-400">Diunggah oleh {detail.uploadedBy.fullName} · {formatDate(detail.createdAt, true)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons onExcel={onExportExcel} onPdf={onExportPdf} />
          {onDelete && (
            <button className="btn-ghost !py-1.5 !px-3 text-xs text-red-600" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Hapus Riwayat Ini
            </button>
          )}
        </div>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatCurrency(detail.totalIncome)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Total Pengeluaran" value={formatCurrency(detail.totalExpense)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard label="Selisih (Net)" value={formatCurrency(net)} tone={net >= 0 ? "brand" : "amber"} icon={<Wallet className="h-5 w-5" />} />
      </div>
      {detail.aiNotes && (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <span className="font-medium">Catatan AI: </span>{detail.aiNotes}
        </div>
      )}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Deskripsi</th>
                <th className="px-5 py-3 font-medium">Kategori</th>
                <th className="px-5 py-3 font-medium">Jenis</th>
                <th className="px-5 py-3 font-medium text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {detail.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{formatDate(t.date)}</td>
                  <td className="px-5 py-3">
                    <p className="text-slate-800 dark:text-slate-100">{t.description}</p>
                    {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{t.category}</td>
                  <td className="px-5 py-3">
                    <span className={cn("badge", t.type === "INCOME" ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
                      {t.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                    </span>
                  </td>
                  <td className={cn("px-5 py-3 text-right font-medium", t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {t.type === "INCOME" ? "+" : "-"}{formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {detail.transactions.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Tidak ada transaksi yang berhasil diekstrak.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
