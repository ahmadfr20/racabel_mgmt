# TikTok Shop Analytics — Design Spec
**Date:** 2026-07-09  
**Status:** Approved

## Overview

Halaman baru di Racabel HQ Management untuk menampilkan analitik penjualan produk Racabel dari TikTok Shop. API key belum tersedia, sehingga sistem menggunakan mock data otomatis sebagai fallback.

## Architecture

### File baru
```
src/app/api/tiktok/analytics/route.ts   — API route (mock/live toggle via env)
src/app/(app)/tiktok/page.tsx           — Server component page
src/components/tiktok/TikTokClient.tsx  — Client component (filter, charts, table)
```

### File yang dimodifikasi
```
src/components/Charts.tsx   — tambah LineChart & DonutChart
src/components/AppShell.tsx — tambah nav item "TikTok Shop"
```

## API Route

**Endpoint:** `GET /api/tiktok/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Behavior:**
- Jika `TIKTOK_APP_KEY` dan `TIKTOK_APP_SECRET` ada di env → hit TikTok Shop API (placeholder, implementasi saat key tersedia)
- Jika env kosong → return mock data otomatis

**Response shape:**
```ts
{
  isMock: boolean,
  summary: {
    revenue: number,
    orders: number,
    gmv: number,
    avgOrderValue: number,
  },
  trend: Array<{ date: string, revenue: number, orders: number }>,
  products: Array<{
    name: string,
    sold: number,
    revenue: number,
    views: number,
    conversionRate: number,
  }>
}
```

## UI Layout

### Filter Bar
- Tombol preset: **7H / 30H / 90H**
- Date range picker: 2 input `<input type="date">` (dari / sampai)
- State dikelola di TikTokClient, refetch saat berubah

### StatCards (4 kartu)
| Label | Tone |
|---|---|
| Total Revenue | brand |
| Total Orders | green |
| GMV | amber |
| Avg Order Value | slate |

### Chart Baris 1 (grid 3 kolom)
- **Kiri (col-span-2):** `LineChart` — tren revenue harian (x: tanggal, y: revenue Rp)
- **Kanan (col-span-1):** `BarChart` vertikal — top 5 produk by revenue

### Chart Baris 2 (grid 3 kolom)
- **Kiri (col-span-1):** `DonutChart` (PieChart) — share revenue per produk
- **Kanan (col-span-2):** Tabel produk — nama, views, terjual, revenue, conversion rate

### Banner Demo
Jika `isMock === true`, tampilkan banner kuning di bawah PageHeader:
> "Mode Demo — Data ini adalah contoh. Hubungkan API key TikTok Shop di pengaturan server untuk data nyata."

### Footer Note
Teks kecil di bawah halaman: "Data diperbarui dari TikTok Shop API · Powered by Racabel HQ"

## Mock Data

5 produk Racabel dengan nama realistis, 30 hari trend data, nilai revenue dalam Rupiah.

## Nav Item

Tambah di `AppShell.tsx` NAV array (tanpa permission guard):
```ts
{ href: "/tiktok", label: "TikTok Shop", icon: ShoppingBag, anyOf: ["dashboard.view"] }
```

Menggunakan permission `dashboard.view` (dimiliki semua user) agar tampil untuk semua.

## Constraints
- Tidak ada permission guard khusus (accessible oleh semua user yang login)
- Semua chart menggunakan `recharts` (sudah terpasang)
- Mengikuti palet warna & komponen UI yang sudah ada (Card, PageHeader, StatCard)
- Tidak ada state management eksternal — React `useState` + `useEffect` cukup
