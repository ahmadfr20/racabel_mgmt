# Dark Mode — Design Spec
**Date:** 2026-07-09  
**Status:** Approved

## Overview

Tambah fitur dark mode ke Racabel HQ Management menggunakan CSS variables. Toggle button ada di header. Preferensi disimpan di localStorage dan mengikuti system preference sebagai default.

## Architecture

### File yang dimodifikasi/dibuat
```
src/app/globals.css             — tambah CSS variables :root (light) & .dark, update component classes
src/components/ThemeProvider.tsx — client component baru: kelola tema, expose toggle via context
src/app/layout.tsx              — wrap children dengan ThemeProvider
src/components/AppShell.tsx     — tambah toggle button di header
```

Tidak ada file komponen lain yang perlu disentuh.

## CSS Variables

```css
:root {
  --bg:            #f6f7fb;
  --card:          #ffffff;
  --border:        #e2e8f0;
  --text-primary:  #0f172a;
  --text-secondary:#64748b;
  --text-muted:    #94a3b8;
  --input-bg:      #ffffff;
  --scrollbar:     #cbd5e1;
}

.dark {
  --bg:            #0f172a;
  --card:          #1e293b;
  --border:        #334155;
  --text-primary:  #f1f5f9;
  --text-secondary:#94a3b8;
  --text-muted:    #64748b;
  --input-bg:      #1e293b;
  --scrollbar:     #334155;
}
```

Warna `brand-*` (ungu) tetap sama di kedua mode.

## Component Classes Update (globals.css)

- `.card` — `bg-white` → `bg-[var(--card)] border-[var(--border)]`
- `.input` — `bg-white border-slate-300` → `bg-[var(--input-bg)] border-[var(--border)] text-[var(--text-primary)]`
- `.label` — `text-slate-700` → `text-[var(--text-secondary)]`
- `body` — background dan color pakai CSS variables

## ThemeProvider

- Client component dengan React context
- Saat mount: baca `localStorage.getItem("theme")`, fallback ke `window.matchMedia("prefers-color-scheme: dark")`
- Set/hapus class `dark` di `document.documentElement`
- Tulis ke localStorage saat toggle
- Export `useTheme()` hook: `{ theme, toggle }`

## Toggle Button

- Lokasi: header AppShell, di kiri avatar user
- Icon: `Moon` (light mode) / `Sun` (dark mode) dari lucide-react
- Style: `rounded-lg p-2 text-slate-500 hover:bg-slate-100` (sama dengan tombol menu mobile)

## State Flow

```
localStorage / prefers-color-scheme
        ↓
  ThemeProvider (mount)
        ↓
  class "dark" di <html>
        ↓
  CSS variables switch
        ↓
  Seluruh UI berubah warna
```
