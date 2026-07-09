"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, BarChart2, DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { RevenueTrendChart, TopProductsChart, RevenueDonutChart } from "@/components/Charts";
import { cn } from "@/lib/utils";

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

export function TikTokClient() {
  const [preset, setPreset] = useState<Preset | null>(30);
  const [from,   setFrom]   = useState(daysAgo(30));
  const [to,     setTo]     = useState(toISO(new Date()));
  const [data,   setData]   = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/tiktok/analytics?from=${f}&to=${t}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
        title="TikTok Shop Analytics"
        subtitle="Analitik penjualan produk Racabel di TikTok Shop."
      />

      {/* Banner mode demo */}
      {data?.isMock && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Mode Demo</strong> — Data ini adalah contoh. Hubungkan{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">TIKTOK_APP_KEY</code> &{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">TIKTOK_APP_SECRET</code>{" "}
            di file <code className="rounded bg-amber-100 px-1 font-mono text-xs">.env</code> untuk data nyata.
          </span>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {([7, 30, 90] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                preset === p
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
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
            onChange={(e) => { setPreset(null); setFrom(e.target.value); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-400">—</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toISO(new Date())}
            onChange={(e) => { setPreset(null); setTo(e.target.value); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                <h3 className="font-semibold text-slate-800">Tren Revenue Harian</h3>
              </div>
              <RevenueTrendChart data={data.trend} />
            </Card>
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800">Top 5 Produk</h3>
              </div>
              <TopProductsChart data={topProducts} />
            </Card>
          </div>

          {/* Chart row 2 */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800">Share Revenue</h3>
              </div>
              <RevenueDonutChart data={topProducts.map((p) => ({ name: p.name, revenue: p.revenue }))} />
            </Card>
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-600" />
                <h3 className="font-semibold text-slate-800">Performa Produk</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="pb-3 font-medium">Produk</th>
                      <th className="pb-3 font-medium text-right">Views</th>
                      <th className="pb-3 font-medium text-right">Terjual</th>
                      <th className="pb-3 font-medium text-right">Revenue</th>
                      <th className="pb-3 font-medium text-right">Konversi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.products.map((p) => (
                      <tr key={p.name} className="hover:bg-slate-50">
                        <td className="py-3 font-medium text-slate-800">{p.name}</td>
                        <td className="py-3 text-right text-slate-600">{p.views.toLocaleString("id-ID")}</td>
                        <td className="py-3 text-right text-slate-600">{p.sold.toLocaleString("id-ID")}</td>
                        <td className="py-3 text-right font-medium text-slate-800">{formatRp(p.revenue)}</td>
                        <td className="py-3 text-right">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                              p.conversionRate >= 5
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
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

          <p className="mt-6 text-center text-xs text-slate-400">
            Data diperbarui dari TikTok Shop API · Powered by Racabel HQ
          </p>
        </>
      )}
    </div>
  );
}
