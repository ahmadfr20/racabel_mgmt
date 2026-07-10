"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, BarChart2, DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { RevenueTrendChart, TopProductsChart, RevenueDonutChart } from "@/components/Charts";
import { cn } from "@/lib/utils";

export interface PlatformConfig {
  name: string;
  apiPath: string;
  envKeyHint: string;
  // Jika platform pakai OAuth (mis. TikTok Shop), isi endpoint mulai-otorisasi
  // agar muncul tombol "Hubungkan Akun" alih-alih sekadar petunjuk .env.
  connectPath?: string;
}

type TrendPoint = { date: string; revenue: number; orders: number };
type Product    = { name: string; sold: number; revenue: number; views: number; conversionRate: number };

interface AnalyticsData {
  isMock: boolean;
  summary: { revenue: number; orders: number; gmv: number; avgOrderValue: number };
  trend:    TrendPoint[];
  products: Product[];
}

type Preset = 7 | 30 | 90;

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

function formatRp(v: number) {
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000)     return `Rp ${(v / 1_000).toFixed(0)}rb`;
  return `Rp ${v}`;
}

export function MarketplaceClient({ config }: { config: PlatformConfig }) {
  const [preset,  setPreset]  = useState<Preset | null>(30);
  const [from,    setFrom]    = useState(daysAgo(30));
  const [to,      setTo]      = useState(toISO(new Date()));
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice,  setNotice]  = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Tangkap hasil callback OAuth (?tt_connected / ?tt_error) lalu bersihkan URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("tt_connected");
    const e = sp.get("tt_error");
    if (c) setNotice({ type: "ok", msg: `Berhasil terhubung${c !== "1" ? ` ke ${c}` : ""}.` });
    else if (e) setNotice({ type: "err", msg: e });
    if (c || e) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const fetchData = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`${config.apiPath}?from=${f}&to=${t}`);
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [config.apiPath]);

  useEffect(() => {
    fetchData(from, to);
  }, [from, to, fetchData]);

  function applyPreset(p: Preset) {
    setPreset(p);
    setFrom(daysAgo(p));
    setTo(toISO(new Date()));
  }

  const topProducts = data?.products.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader
        title={`${config.name} Analytics`}
        subtitle={`Analitik penjualan produk Racabel di ${config.name}.`}
      />

      {/* Notifikasi hasil koneksi OAuth */}
      {notice && (
        <div
          className={cn(
            "mb-4 rounded-xl border px-4 py-3 text-sm",
            notice.type === "ok"
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
              : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
          )}
        >
          {notice.type === "ok" ? "✓ " : "⚠ "}
          {notice.msg}
        </div>
      )}

      {/* Banner mode demo */}
      {data?.isMock && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {config.connectPath ? (
            <>
              <span className="flex-1">
                <strong>Mode Demo</strong> — Data ini contoh. Hubungkan akun {config.name} Anda untuk menampilkan penjualan nyata.
              </span>
              <a
                href={config.connectPath}
                className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                Hubungkan Akun {config.name}
              </a>
            </>
          ) : (
            <span>
              <strong>Mode Demo</strong> — Data ini adalah contoh. Hubungkan{" "}
              <code className="rounded bg-amber-100 dark:bg-amber-900/30 px-1 font-mono text-xs">{config.envKeyHint}</code>{" "}
              di file <code className="rounded bg-amber-100 dark:bg-amber-900/30 px-1 font-mono text-xs">.env</code> untuk data nyata.
            </span>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
          {([7, 30, 90] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`${p} hari terakhir`}
              aria-pressed={preset === p}
              onClick={() => applyPreset(p)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                preset === p
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              )}
            >
              {p}H
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            aria-label="Tanggal mulai"
            onChange={(e) => { setPreset(null); setFrom(e.target.value); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-400">—</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toISO(new Date())}
            aria-label="Tanggal akhir"
            onChange={(e) => { setPreset(null); setTo(e.target.value); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid h-64 place-items-center text-sm text-slate-400">Memuat data...</div>
      ) : !data ? (
        <div className="grid h-64 place-items-center text-sm text-slate-400">Gagal memuat data.</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Revenue"   value={formatRp(data.summary.revenue)}      icon={<DollarSign  className="h-5 w-5" />} tone="brand" />
            <StatCard label="Total Orders"    value={data.summary.orders}                  icon={<ShoppingBag className="h-5 w-5" />} tone="green" />
            <StatCard label="GMV"             value={formatRp(data.summary.gmv)}           icon={<TrendingUp  className="h-5 w-5" />} tone="amber" />
            <StatCard label="Avg Order Value" value={formatRp(data.summary.avgOrderValue)} icon={<BarChart2   className="h-5 w-5" />} tone="slate" />
          </div>

          {/* Chart row 1 */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Tren Revenue Harian</h3>
              </div>
              <RevenueTrendChart data={data.trend} />
            </Card>
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Top 5 Produk</h3>
              </div>
              <TopProductsChart data={topProducts} />
            </Card>
          </div>

          {/* Chart row 2 */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Share Revenue</h3>
              </div>
              <RevenueDonutChart data={topProducts.map((p) => ({ name: p.name, revenue: p.revenue }))} />
            </Card>
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Performa Produk</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="pb-3 font-medium">Produk</th>
                      <th className="pb-3 font-medium text-right">Views</th>
                      <th className="pb-3 font-medium text-right">Terjual</th>
                      <th className="pb-3 font-medium text-right">Revenue</th>
                      <th className="pb-3 font-medium text-right">Konversi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {data.products.map((p, i) => (
                      <tr key={`${p.name}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 font-medium text-slate-800 dark:text-slate-100">{p.name}</td>
                        <td className="py-3 text-right text-slate-600 dark:text-slate-400">{p.views.toLocaleString("id-ID")}</td>
                        <td className="py-3 text-right text-slate-600 dark:text-slate-400">{p.sold.toLocaleString("id-ID")}</td>
                        <td className="py-3 text-right font-medium text-slate-800 dark:text-slate-100">{formatRp(p.revenue)}</td>
                        <td className="py-3 text-right">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                              p.conversionRate >= 5
                                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            )}
                          >
                            {p.conversionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Data diperbarui dari {config.name} API · Powered by Racabel HQ
          </p>
        </>
      )}
    </div>
  );
}
