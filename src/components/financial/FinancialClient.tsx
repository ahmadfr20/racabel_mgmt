"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, GitCompareArrows, Loader2, TrendingDown, TrendingUp, Trash2, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Card, PageHeader, StatCard, EmptyState } from "@/components/ui";
import { FinancialAssistantChat } from "@/components/financial/FinancialAssistantChat";

interface ImportSummary {
  id: number;
  fileName: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  currency: string;
  totalIncome: number;
  totalExpense: number;
  aiNotes: string | null;
  errorMessage: string | null;
  transactionCount: number;
  uploadedByName: string;
  createdAt: string;
}

interface Transaction {
  id: number;
  date: string;
  description: string;
  category: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  notes: string | null;
}

interface ImportDetail {
  id: number;
  fileName: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  currency: string;
  totalIncome: number;
  totalExpense: number;
  aiNotes: string | null;
  errorMessage: string | null;
  createdAt: string;
  uploadedBy: { fullName: string };
  transactions: Transaction[];
}

interface Comparison {
  id: number;
  title: string;
  scopeALabel: string;
  scopeBLabel: string;
  totalIncomeA: number;
  totalExpenseA: number;
  totalIncomeB: number;
  totalExpenseB: number;
  analysis: string;
  createdByName: string;
  createdAt: string;
}

export function FinancialClient({ canUpload }: { canUpload: boolean }) {
  const [history, setHistory] = useState<ImportSummary[]>([]);
  const [selected, setSelected] = useState<ImportDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loadingComparisons, setLoadingComparisons] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistory(await apiFetch<ImportSummary[]>("/api/financial/import"));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadComparisons = useCallback(async () => {
    setLoadingComparisons(true);
    try {
      setComparisons(await apiFetch<Comparison[]>("/api/financial/comparisons"));
    } finally {
      setLoadingComparisons(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadComparisons();
  }, [loadHistory, loadComparisons]);

  async function removeComparison(id: number) {
    if (!confirm("Hapus riwayat komparasi ini?")) return;
    await apiFetch(`/api/financial/comparisons/${id}`, { method: "DELETE" });
    await loadComparisons();
  }

  async function openDetail(id: number) {
    const detail = await apiFetch<ImportDetail>(`/api/financial/import/${id}`);
    setSelected(detail);
  }

  async function removeImport(id: number) {
    if (!confirm("Hapus riwayat impor ini beserta seluruh transaksinya?")) return;
    await apiFetch(`/api/financial/import/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    await loadHistory();
  }

  return (
    <div>
      <PageHeader
        title="Asisten Keuangan AI"
        subtitle="Chat dengan AI untuk menyimpan transaksi, membandingkan data keuangan, atau menganalisis file dan gambar."
      />

      <FinancialAssistantChat canUpload={canUpload} onDataChanged={() => { loadHistory(); loadComparisons(); }} />

      {selected && <ImportResult detail={selected} onDelete={canUpload ? () => removeImport(selected.id) : undefined} />}

      <Card className="!p-0 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Impor</h3>
        </div>
        {loadingHistory ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : history.length === 0 ? (
          <EmptyState
            title="Belum ada riwayat impor"
            subtitle="File keuangan yang diunggah akan muncul di sini."
            icon={<FileSpreadsheet className="h-10 w-10" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">File</th>
                  <th className="px-5 py-3 font-medium">Status</th>
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
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{h.transactionCount}</td>
                    <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400">{formatCurrency(h.totalIncome)}</td>
                    <td className="px-5 py-3 text-red-600 dark:text-red-400">{formatCurrency(h.totalExpense)}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(h.createdAt, true)}</td>
                    <td className="px-5 py-3 text-right">
                      {canUpload && (
                        <button
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                          onClick={(e) => { e.stopPropagation(); removeImport(h.id); }}
                        >
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
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Riwayat Komparasi Keuangan</h3>
        </div>
        {loadingComparisons ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : comparisons.length === 0 ? (
          <EmptyState
            title="Belum ada hasil komparasi"
            subtitle="Minta Asisten Keuangan AI di atas untuk membandingkan keuangan dan menyimpan hasilnya."
            icon={<GitCompareArrows className="h-10 w-10" />}
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {comparisons.map((c) => {
              const netA = c.totalIncomeA - c.totalExpenseA;
              const netB = c.totalIncomeB - c.totalExpenseB;
              return (
                <div key={c.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{c.title}</p>
                      <p className="text-xs text-slate-400">oleh {c.createdByName} · {formatDate(c.createdAt, true)}</p>
                    </div>
                    {canUpload && (
                      <button
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600"
                        onClick={() => removeComparison(c.id)}
                      >
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
    </div>
  );
}

function ImportStatusBadge({ status }: { status: ImportSummary["status"] }) {
  const map: Record<ImportSummary["status"], string> = {
    COMPLETED: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    PROCESSING: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    FAILED: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  };
  const label: Record<ImportSummary["status"], string> = {
    COMPLETED: "Berhasil",
    PROCESSING: "Diproses",
    FAILED: "Gagal",
  };
  return <span className={cn("badge", map[status])}>{label[status]}</span>;
}

function ImportResult({ detail, onDelete }: { detail: ImportDetail; onDelete?: () => void }) {
  const net = detail.totalIncome - detail.totalExpense;
  return (
    <div className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hasil Ekstraksi — {detail.fileName}</h3>
          <p className="text-xs text-slate-400">Diunggah oleh {detail.uploadedBy.fullName} · {formatDate(detail.createdAt, true)}</p>
        </div>
        {onDelete && (
          <button className="btn-ghost !py-1.5 !px-3 text-xs text-red-600" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Hapus Riwayat Ini
          </button>
        )}
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
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Tidak ada transaksi yang berhasil diekstrak dari file ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
