# TikTok Shop Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah halaman TikTok Shop Analytics ke Racabel HQ Management dengan bar chart, line chart, donut chart, dan tabel produk — menggunakan mock data selama API key belum tersedia.

**Architecture:** API route `/api/tiktok/analytics` return mock data jika env `TIKTOK_APP_KEY`/`TIKTOK_APP_SECRET` kosong, data nyata jika terisi. Client component `TikTokClient` handle semua state filter & render chart. Nav item ditambah di AppShell untuk semua user.

**Tech Stack:** Next.js 15, React 19, recharts 2, lucide-react, Tailwind CSS, TypeScript

---

## File Map

| File | Action | Tanggung jawab |
|---|---|---|
| `src/components/Charts.tsx` | Modify | Tambah `RevenueTrendChart`, `TopProductsChart`, `RevenueDonutChart` |
| `src/app/api/tiktok/analytics/route.ts` | Create | API route dengan mock fallback |
| `src/components/tiktok/TikTokClient.tsx` | Create | Semua UI: filter, stat cards, charts, tabel |
| `src/app/(app)/tiktok/page.tsx` | Create | Server page wrapper |
| `src/components/AppShell.tsx` | Modify | Tambah nav item "TikTok Shop" |

---

### Task 1: Tambah chart components ke Charts.tsx

**Files:**
- Modify: `src/components/Charts.tsx`

- [ ] **Step 1: Buka `src/components/Charts.tsx` dan tambah import recharts yang dibutuhkan**

  Ganti baris import recharts yang sudah ada:
  ```ts
  import {
    Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
    PolarAngleAxis, PolarGrid, Pie, PieChart,
    Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  } from "recharts";
  ```

- [ ] **Step 2: Tambah `RevenueTrendChart` di akhir file (sebelum closing)**

  ```tsx
  export function RevenueTrendChart({
    data,
  }: {
    data: { date: string; revenue: number; orders: number }[];
  }) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="#94a3b8"
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="#94a3b8"
            tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [`Rp ${v.toLocaleString("id-ID")}`, "Revenue"]}
          />
          <Line dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  ```

- [ ] **Step 3: Tambah `TopProductsChart` di akhir file**

  ```tsx
  export function TopProductsChart({
    data,
  }: {
    data: { name: string; revenue: number }[];
  }) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="#94a3b8"
            tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="#64748b"
            width={120}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [`Rp ${v.toLocaleString("id-ID")}`, "Revenue"]}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  ```

- [ ] **Step 4: Tambah `RevenueDonutChart` di akhir file**

  ```tsx
  const DONUT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

  export function RevenueDonutChart({
    data,
  }: {
    data: { name: string; revenue: number }[];
  }) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [`Rp ${v.toLocaleString("id-ID")}`, "Revenue"]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  ```

- [ ] **Step 5: Verifikasi TypeScript tidak ada error**

  ```
  npx tsc --noEmit
  ```
  Expected: tidak ada error di `src/components/Charts.tsx`

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/Charts.tsx
  git commit -m "feat: add RevenueTrendChart, TopProductsChart, RevenueDonutChart"
  ```

---

### Task 2: Buat API route TikTok Analytics

**Files:**
- Create: `src/app/api/tiktok/analytics/route.ts`

- [ ] **Step 1: Buat direktori dan file route**

  Buat file `src/app/api/tiktok/analytics/route.ts` dengan konten berikut:

  ```ts
  import { NextRequest, NextResponse } from "next/server";

  type TrendPoint = { date: string; revenue: number; orders: number };
  type Product = { name: string; sold: number; revenue: number; views: number; conversionRate: number };

  interface AnalyticsResponse {
    isMock: boolean;
    summary: { revenue: number; orders: number; gmv: number; avgOrderValue: number };
    trend: TrendPoint[];
    products: Product[];
  }

  function generateMockData(from: Date, to: Date): AnalyticsResponse {
    const productNames = [
      "Racabel Serum Wajah",
      "Racabel Moisturizer",
      "Racabel Sunscreen SPF50",
      "Racabel Eye Cream",
      "Racabel Toner Essence",
    ];

    const products: Product[] = productNames.map((name, i) => {
      const sold =  [120, 85, 200, 60, 145][i];
      const views = [2400, 1700, 3800, 1200, 2900][i];
      const price = [89000, 129000, 109000, 159000, 79000][i];
      return {
        name,
        sold,
        revenue: sold * price,
        views,
        conversionRate: parseFloat(((sold / views) * 100).toFixed(1)),
      };
    });

    const trend: TrendPoint[] = [];
    const cur = new Date(from);
    while (cur <= to) {
      const orders = 20 + Math.round(Math.abs(Math.sin(cur.getDate() * 0.8)) * 20 + 5);
      trend.push({
        date: cur.toISOString().slice(0, 10),
        revenue: orders * 95000,
        orders,
      });
      cur.setDate(cur.getDate() + 1);
    }

    const totalRevenue = trend.reduce((s, t) => s + t.revenue, 0);
    const totalOrders  = trend.reduce((s, t) => s + t.orders,  0);

    return {
      isMock: true,
      summary: {
        revenue:       totalRevenue,
        orders:        totalOrders,
        gmv:           Math.round(totalRevenue * 1.08),
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      },
      trend,
      products,
    };
  }

  export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const toDate   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : new Date();
    const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const appKey    = process.env.TIKTOK_APP_KEY;
    const appSecret = process.env.TIKTOK_APP_SECRET;

    if (appKey && appSecret) {
      // TODO: implementasi TikTok Shop API saat credentials tersedia
      // Ganti blok ini dengan real API call ke TikTok Open Platform
    }

    return NextResponse.json(generateMockData(fromDate, toDate));
  }
  ```

- [ ] **Step 2: Verifikasi endpoint bisa dipanggil**

  Pastikan dev server jalan (`npm run dev`), lalu buka browser ke:
  ```
  http://localhost:3000/api/tiktok/analytics
  ```
  Expected: JSON response dengan `isMock: true`, field `summary`, `trend` (array ~30 item), `products` (5 item).

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/tiktok/analytics/route.ts
  git commit -m "feat: add TikTok Shop analytics API route with mock fallback"
  ```

---

### Task 3: Buat TikTokClient component

**Files:**
- Create: `src/components/tiktok/TikTokClient.tsx`

- [ ] **Step 1: Buat file `src/components/tiktok/TikTokClient.tsx`**

  ```tsx
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
              <StatCard label="Total Revenue"    value={formatRp(data.summary.revenue)}       icon={<DollarSign  className="h-5 w-5" />} tone="brand" />
              <StatCard label="Total Orders"     value={data.summary.orders}                   icon={<ShoppingBag className="h-5 w-5" />} tone="green" />
              <StatCard label="GMV"              value={formatRp(data.summary.gmv)}            icon={<TrendingUp  className="h-5 w-5" />} tone="amber" />
              <StatCard label="Avg Order Value"  value={formatRp(data.summary.avgOrderValue)}  icon={<BarChart2   className="h-5 w-5" />} tone="slate" />
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
  ```

- [ ] **Step 2: Verifikasi TypeScript**

  ```
  npx tsc --noEmit
  ```
  Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/tiktok/TikTokClient.tsx
  git commit -m "feat: add TikTokClient component with filter, stat cards, and charts"
  ```

---

### Task 4: Buat halaman `/tiktok`

**Files:**
- Create: `src/app/(app)/tiktok/page.tsx`

- [ ] **Step 1: Buat file `src/app/(app)/tiktok/page.tsx`**

  ```tsx
  import { TikTokClient } from "@/components/tiktok/TikTokClient";

  export const dynamic = "force-dynamic";

  export default function TikTokPage() {
    return <TikTokClient />;
  }
  ```

- [ ] **Step 2: Verifikasi halaman bisa dibuka**

  Buka browser ke `http://localhost:3000/tiktok` (pastikan sudah login).
  Expected: Halaman muncul dengan banner kuning "Mode Demo", 4 stat cards, dan charts.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/(app)/tiktok/page.tsx
  git commit -m "feat: add /tiktok page"
  ```

---

### Task 5: Tambah nav item TikTok Shop di AppShell

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Tambah `ShoppingBag` ke import lucide di `src/components/AppShell.tsx`**

  Ganti baris import lucide yang sudah ada:
  ```ts
  import {
    Building2, CalendarClock, CalendarDays, ChevronDown, LayoutDashboard,
    LogOut, Menu, Settings, ShieldCheck, ShoppingBag, Users, Wallet, X,
  } from "lucide-react";
  ```

- [ ] **Step 2: Tambah nav item ke array `NAV` di `AppShell.tsx`**

  Tambah setelah item `payroll`, sebelum `settings`:
  ```ts
  { href: "/tiktok", label: "TikTok Shop", icon: ShoppingBag, anyOf: ["dashboard.view"] },
  ```

  Array `NAV` lengkap setelah edit:
  ```ts
  const NAV: NavItem[] = [
    { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard, anyOf: ["dashboard.view"] },
    { href: "/attendance", label: "Absensi",       icon: CalendarClock,   anyOf: ["attendance.checkin", "attendance.view_all"] },
    { href: "/leave",      label: "Cuti",          icon: CalendarDays,    anyOf: ["leave.request", "leave.view_all", "leave.approve"] },
    { href: "/employees",  label: "Karyawan",      icon: Users,           anyOf: ["employees.view"] },
    { href: "/payroll",    label: "Kinerja & Gaji",icon: Wallet,          anyOf: ["payroll.view", "payroll.manage"] },
    { href: "/tiktok",     label: "TikTok Shop",   icon: ShoppingBag,     anyOf: ["dashboard.view"] },
    { href: "/settings",   label: "Pengaturan",    icon: Settings,        anyOf: ["roles.manage", "departments.manage", "settings.manage"] },
  ];
  ```

- [ ] **Step 3: Verifikasi nav item muncul di sidebar**

  Buka browser ke `http://localhost:3000/dashboard`.
  Expected: Item "TikTok Shop" muncul di sidebar, bisa diklik dan menuju ke `/tiktok`.

- [ ] **Step 4: Verifikasi TypeScript bersih**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/AppShell.tsx
  git commit -m "feat: add TikTok Shop nav item to sidebar"
  ```

---

## Cara menghubungkan API nyata (untuk nanti)

Ketika API key TikTok Shop sudah tersedia, tambahkan ke file `.env`:

```env
TIKTOK_APP_KEY=your_app_key_here
TIKTOK_APP_SECRET=your_app_secret_here
```

Lalu ganti blok komentar `TODO` di `src/app/api/tiktok/analytics/route.ts` dengan implementasi nyata ke TikTok Open Platform API. Tidak ada perubahan di komponen UI manapun.
