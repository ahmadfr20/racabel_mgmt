# Marketplace Analytics (Tokopedia & Shopee) — Design Spec
**Date:** 2026-07-09
**Status:** Approved

## Overview

Tambah halaman analitik Tokopedia dan Shopee ke Racabel HQ Management, dengan tampilan identik ke halaman TikTok Shop. TikTokClient direfactor menjadi thin wrapper di atas komponen generik `MarketplaceClient`.

## Architecture

### File baru
```
src/components/marketplace/MarketplaceClient.tsx   — shared generik component
src/components/tokopedia/TokopediaClient.tsx        — thin wrapper untuk Tokopedia
src/components/shopee/ShopeeClient.tsx              — thin wrapper untuk Shopee
src/app/api/tokopedia/analytics/route.ts            — API route Tokopedia (mock fallback)
src/app/api/shopee/analytics/route.ts               — API route Shopee (mock fallback)
src/app/(app)/tokopedia/page.tsx                    — halaman /tokopedia
src/app/(app)/shopee/page.tsx                       — halaman /shopee
```

### File dimodifikasi
```
src/components/tiktok/TikTokClient.tsx  — refactor: delegate ke MarketplaceClient
src/components/AppShell.tsx             — tambah 2 nav item
```

## PlatformConfig Interface

```ts
interface PlatformConfig {
  name: string       // nama tampil: "TikTok Shop" | "Tokopedia" | "Shopee"
  apiPath: string    // endpoint: "/api/tiktok/analytics" | "/api/tokopedia/analytics" | "/api/shopee/analytics"
  envKeyHint: string // nama env var untuk banner demo: "TIKTOK_APP_KEY" | "TOKOPEDIA_CLIENT_ID" | "SHOPEE_PARTNER_ID"
}
```

## MarketplaceClient

Komponen identik dengan TikTokClient saat ini, tapi menerima `config: PlatformConfig` sebagai prop. Semua logic (filter, fetch, stat cards, charts, tabel) ada di sini.

## Thin Wrappers

```tsx
// TikTokClient.tsx
export function TikTokClient() {
  return <MarketplaceClient config={{ name: "TikTok Shop", apiPath: "/api/tiktok/analytics", envKeyHint: "TIKTOK_APP_KEY" }} />;
}

// TokopediaClient.tsx
export function TokopediaClient() {
  return <MarketplaceClient config={{ name: "Tokopedia", apiPath: "/api/tokopedia/analytics", envKeyHint: "TOKOPEDIA_CLIENT_ID" }} />;
}

// ShopeeClient.tsx
export function ShopeeClient() {
  return <MarketplaceClient config={{ name: "Shopee", apiPath: "/api/shopee/analytics", envKeyHint: "SHOPEE_PARTNER_ID" }} />;
}
```

## API Routes

Sama polanya dengan TikTok: mock data dengan 5 produk Racabel, fallback otomatis jika env var kosong.

- Tokopedia env: `TOKOPEDIA_CLIENT_ID` + `TOKOPEDIA_CLIENT_SECRET`
- Shopee env: `SHOPEE_PARTNER_ID` + `SHOPEE_PARTNER_KEY`

## Nav Items (AppShell)

Tambah setelah "/tiktok", sebelum "/settings":
```ts
{ href: "/tokopedia", label: "Tokopedia", icon: Store, anyOf: ["dashboard.view"] },
{ href: "/shopee",    label: "Shopee",    icon: ShoppingCart, anyOf: ["dashboard.view"] },
```

## Constraints
- Tidak ada permission guard (semua user yang login bisa akses)
- Tampilan identik TikTok Shop — tidak ada customisasi warna per platform
- Produk mock berbeda per platform (nama produk Racabel yang realistis)
