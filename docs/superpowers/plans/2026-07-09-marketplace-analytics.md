# Marketplace Analytics (Tokopedia & Shopee) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah halaman analitik Tokopedia dan Shopee dengan layout identik TikTok Shop, dengan refactor TikTokClient ke shared `MarketplaceClient` agar semua platform berbagi satu komponen.

**Architecture:** `MarketplaceClient` generik menerima `PlatformConfig` prop (name, apiPath, envKeyHint). TikTokClient, TokopediaClient, dan ShopeeClient masing-masing adalah thin wrapper. Setiap platform punya API route sendiri dengan mock data produk Racabel yang berbeda dan env var fallback.

**Tech Stack:** Next.js 15, React 19, recharts 2, lucide-react, Tailwind CSS + dark mode, TypeScript

---

## File Map

| File | Action | Tanggung jawab |
|---|---|---|
| `src/components/marketplace/MarketplaceClient.tsx` | Create | Shared UI: filter, stat cards, charts, tabel — menerima PlatformConfig |
| `src/components/tiktok/TikTokClient.tsx` | Modify | Thin wrapper ke MarketplaceClient |
| `src/components/tokopedia/TokopediaClient.tsx` | Create | Thin wrapper ke MarketplaceClient |
| `src/components/shopee/ShopeeClient.tsx` | Create | Thin wrapper ke MarketplaceClient |
| `src/app/api/tokopedia/analytics/route.ts` | Create | API route Tokopedia dengan mock fallback |
| `src/app/api/shopee/analytics/route.ts` | Create | API route Shopee dengan mock fallback |
| `src/app/(app)/tokopedia/page.tsx` | Create | Halaman /tokopedia |
| `src/app/(app)/shopee/page.tsx` | Create | Halaman /shopee |
| `src/components/AppShell.tsx` | Modify | Tambah nav item Tokopedia + Shopee |

---

### Task 1: Buat MarketplaceClient.tsx

**Files:**
- Create: `src/components/marketplace/MarketplaceClient.tsx`

- [ ] **Step 1: Buat file `src/components/marketplace/MarketplaceClient.tsx`**

  ```tsx
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

    const fetchData = useCallback(async (f: string, t: string) => {
      setLoading(true);
      try {
        const res  = await fetch(`${config.apiPath}?from=${f}&to=${t}`);
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

        {/* Banner mode demo */}
        {data?.isMock && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Mode Demo</strong> — Data ini adalah contoh. Hubungkan{" "}
              <code className="rounded bg-amber-100 dark:bg-amber-900/30 px-1 font-mono text-xs">{config.envKeyHint}</code>{" "}
              di file <code className="rounded bg-amber-100 dark:bg-amber-900/30 px-1 font-mono text-xs">.env</code> untuk data nyata.
            </span>
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
            {([7, 30, 90] as Preset[]).map((p) => (
              <button
                key={p}
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
              onChange={(e) => { setPreset(null); setFrom(e.target.value); }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-400">—</span>
            <input
              type="date"
              value={to}
              min={from}
              max={toISO(new Date())}
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
                      {data.products.map((p) => (
                        <tr key={p.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
  ```

- [ ] **Step 2: Verifikasi TypeScript**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors.

---

### Task 2: Refactor TikTokClient → thin wrapper

**Files:**
- Modify: `src/components/tiktok/TikTokClient.tsx`

- [ ] **Step 1: Ganti seluruh isi `src/components/tiktok/TikTokClient.tsx`**

  ```tsx
  "use client";

  import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

  export function TikTokClient() {
    return (
      <MarketplaceClient
        config={{
          name: "TikTok Shop",
          apiPath: "/api/tiktok/analytics",
          envKeyHint: "TIKTOK_APP_KEY",
        }}
      />
    );
  }
  ```

- [ ] **Step 2: Verifikasi TypeScript + halaman /tiktok masih berjalan**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors. Buka `http://localhost:3000/tiktok` — halaman harus tetap tampil dengan data yang sama seperti sebelumnya.

---

### Task 3: Buat Tokopedia (API route + client + page)

**Files:**
- Create: `src/app/api/tokopedia/analytics/route.ts`
- Create: `src/components/tokopedia/TokopediaClient.tsx`
- Create: `src/app/(app)/tokopedia/page.tsx`

- [ ] **Step 1: Buat `src/app/api/tokopedia/analytics/route.ts`**

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
      "Racabel Serum Vitamin C",
      "Racabel Face Wash Gentle",
      "Racabel Night Cream",
      "Racabel BB Cream SPF30",
      "Racabel Lip Balm Madu",
    ];

    const products: Product[] = productNames.map((name, i) => {
      const sold =  [95, 140, 70, 180, 110][i];
      const views = [1900, 2800, 1400, 3600, 2200][i];
      const price = [99000, 69000, 149000, 89000, 49000][i];
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
      const orders = 18 + Math.round(Math.abs(Math.cos(cur.getDate() * 0.7)) * 22 + 4);
      trend.push({
        date: cur.toISOString().slice(0, 10),
        revenue: orders * 88000,
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
        gmv:           Math.round(totalRevenue * 1.06),
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

    const clientId     = process.env.TOKOPEDIA_CLIENT_ID;
    const clientSecret = process.env.TOKOPEDIA_CLIENT_SECRET;

    if (clientId && clientSecret) {
      // TODO: implementasi Tokopedia API saat credentials tersedia
    }

    return NextResponse.json(generateMockData(fromDate, toDate));
  }
  ```

- [ ] **Step 2: Buat `src/components/tokopedia/TokopediaClient.tsx`**

  ```tsx
  "use client";

  import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

  export function TokopediaClient() {
    return (
      <MarketplaceClient
        config={{
          name: "Tokopedia",
          apiPath: "/api/tokopedia/analytics",
          envKeyHint: "TOKOPEDIA_CLIENT_ID",
        }}
      />
    );
  }
  ```

- [ ] **Step 3: Buat `src/app/(app)/tokopedia/page.tsx`**

  ```tsx
  import { TokopediaClient } from "@/components/tokopedia/TokopediaClient";

  export const dynamic = "force-dynamic";

  export default function TokopediaPage() {
    return <TokopediaClient />;
  }
  ```

- [ ] **Step 4: Verifikasi TypeScript**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors.

---

### Task 4: Buat Shopee (API route + client + page)

**Files:**
- Create: `src/app/api/shopee/analytics/route.ts`
- Create: `src/components/shopee/ShopeeClient.tsx`
- Create: `src/app/(app)/shopee/page.tsx`

- [ ] **Step 1: Buat `src/app/api/shopee/analytics/route.ts`**

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
      "Racabel Brightening Serum",
      "Racabel Acne Spot Gel",
      "Racabel Hydrating Toner",
      "Racabel Sleeping Mask",
      "Racabel Micellar Water",
    ];

    const products: Product[] = productNames.map((name, i) => {
      const sold =  [160, 75, 130, 55, 200][i];
      const views = [3200, 1500, 2600, 1100, 4000][i];
      const price = [119000, 79000, 89000, 139000, 59000][i];
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
      const orders = 25 + Math.round(Math.abs(Math.sin(cur.getDate() * 0.6 + 1)) * 18 + 6);
      trend.push({
        date: cur.toISOString().slice(0, 10),
        revenue: orders * 102000,
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
        gmv:           Math.round(totalRevenue * 1.07),
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

    const partnerId  = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;

    if (partnerId && partnerKey) {
      // TODO: implementasi Shopee API saat credentials tersedia
    }

    return NextResponse.json(generateMockData(fromDate, toDate));
  }
  ```

- [ ] **Step 2: Buat `src/components/shopee/ShopeeClient.tsx`**

  ```tsx
  "use client";

  import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

  export function ShopeeClient() {
    return (
      <MarketplaceClient
        config={{
          name: "Shopee",
          apiPath: "/api/shopee/analytics",
          envKeyHint: "SHOPEE_PARTNER_ID",
        }}
      />
    );
  }
  ```

- [ ] **Step 3: Buat `src/app/(app)/shopee/page.tsx`**

  ```tsx
  import { ShopeeClient } from "@/components/shopee/ShopeeClient";

  export const dynamic = "force-dynamic";

  export default function ShopeePage() {
    return <ShopeeClient />;
  }
  ```

- [ ] **Step 4: Verifikasi TypeScript**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors.

---

### Task 5: Update AppShell — tambah nav item Tokopedia + Shopee

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Tambah `Store` dan `ShoppingCart` ke import lucide**

  Ganti baris import lucide yang ada:
  ```tsx
  import {
    Building2, CalendarClock, CalendarDays, ChevronDown, LayoutDashboard,
    LogOut, Menu, Moon, Settings, ShieldCheck, ShoppingBag, ShoppingCart,
    Store, Sun, Users, Wallet, X,
  } from "lucide-react";
  ```

- [ ] **Step 2: Tambah 2 nav item ke array NAV setelah `/tiktok`**

  Ganti array NAV:
  ```tsx
  const NAV: NavItem[] = [
    { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard, anyOf: ["dashboard.view"] },
    { href: "/attendance", label: "Absensi",       icon: CalendarClock,   anyOf: ["attendance.checkin", "attendance.view_all"] },
    { href: "/leave",      label: "Cuti",          icon: CalendarDays,    anyOf: ["leave.request", "leave.view_all", "leave.approve"] },
    { href: "/employees",  label: "Karyawan",      icon: Users,           anyOf: ["employees.view"] },
    { href: "/payroll",    label: "Kinerja & Gaji",icon: Wallet,          anyOf: ["payroll.view", "payroll.manage"] },
    { href: "/tiktok",     label: "TikTok Shop",   icon: ShoppingBag,     anyOf: ["dashboard.view"] },
    { href: "/tokopedia",  label: "Tokopedia",     icon: Store,           anyOf: ["dashboard.view"] },
    { href: "/shopee",     label: "Shopee",        icon: ShoppingCart,    anyOf: ["dashboard.view"] },
    { href: "/settings",   label: "Pengaturan",    icon: Settings,        anyOf: ["roles.manage", "departments.manage", "settings.manage"] },
  ];
  ```

- [ ] **Step 3: Verifikasi TypeScript**

  ```
  npx tsc --noEmit
  ```
  Expected: 0 errors.

- [ ] **Step 4: Verifikasi akhir — 3 halaman marketplace berfungsi**

  Jalankan `npm run dev` dan buka:
  - `http://localhost:3000/tiktok` — harus tampil sama seperti sebelumnya
  - `http://localhost:3000/tokopedia` — tampil dengan produk Racabel Tokopedia
  - `http://localhost:3000/shopee` — tampil dengan produk Racabel Shopee
  - Sidebar harus menampilkan 3 nav item marketplace
  - Dark mode toggle harus berfungsi di semua halaman

---

## Menghubungkan API nyata (untuk nanti)

Tambahkan ke `.env` sesuai platform:

```env
# Tokopedia
TOKOPEDIA_CLIENT_ID=your_client_id
TOKOPEDIA_CLIENT_SECRET=your_client_secret

# Shopee
SHOPEE_PARTNER_ID=your_partner_id
SHOPEE_PARTNER_KEY=your_partner_key
```

Lalu implementasi blok TODO di masing-masing route.ts. Tidak ada perubahan di komponen UI.
