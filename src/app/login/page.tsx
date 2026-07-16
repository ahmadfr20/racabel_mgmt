"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, User } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal login");
      router.replace(params.get("next") || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal login");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Panel kiri — showcase produk ── */}
      <div className="relative hidden lg:flex flex-col overflow-hidden bg-[#08090e]">

        {/* Subtle dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Gradient vignette — top & bottom */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#08090e] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#08090e] via-[#08090e]/80 to-transparent z-10 pointer-events-none" />

        {/* Logo — top left */}
        <div className="relative z-20 flex items-center gap-3 p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_racabel.svg" className="h-9 w-9 brightness-0 invert" alt="Racabel" />
          <span className="text-sm font-semibold tracking-wide text-white/70">
            Racabel HQ Management
          </span>
        </div>

        {/* ── Product collage ── */}
        <div className="relative flex-1 flex items-center justify-center px-10">
          <div className="relative w-full" style={{ height: 380 }}>

            {/* img_1 — rings on hand, portrait, main left */}
            <div
              className="absolute left-0 top-8 w-[205px] h-[255px] rounded-3xl overflow-hidden
                         shadow-[0_24px_64px_rgba(0,0,0,0.7)] ring-1 ring-white/10
                         -rotate-2 transition-transform hover:rotate-0 hover:scale-[1.02] duration-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img_1.png" alt="Racabel rings" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>

            {/* img_2 — bracelet, portrait, right top */}
            <div
              className="absolute right-0 top-0 w-[158px] h-[198px] rounded-3xl overflow-hidden
                         shadow-[0_24px_64px_rgba(0,0,0,0.7)] ring-1 ring-white/10
                         rotate-[2deg] transition-transform hover:rotate-0 hover:scale-[1.02] duration-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img_2.png" alt="Racabel bracelet" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>

            {/* img_3 — three rings flat-lay, right bottom */}
            <div
              className="absolute right-6 bottom-0 w-[148px] h-[140px] rounded-3xl overflow-hidden
                         shadow-[0_24px_64px_rgba(0,0,0,0.7)] ring-1 ring-white/10
                         -rotate-1 transition-transform hover:rotate-0 hover:scale-[1.02] duration-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img_3.png" alt="Racabel ring collection" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Decorative connector line between cards */}
            <div className="absolute top-[120px] left-[200px] right-[158px] h-px bg-gradient-to-r from-white/0 via-white/15 to-white/0" />

            {/* Floating label chip */}
            <div className="absolute left-4 bottom-[72px] flex items-center gap-2 rounded-full bg-white/8 backdrop-blur-md border border-white/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-white/70 tracking-wide">Koleksi Terbaru</span>
            </div>
          </div>
        </div>

        {/* ── Tagline — bottom ── */}
        <div className="relative z-20 px-10 pb-10 space-y-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-white/30 uppercase">
            Racabel Jewelry
          </p>
          <h2 className="text-3xl font-bold leading-tight text-white">
            Kelola tim Anda,
            <br />
            <span className="text-white/50">dengan lebih mudah.</span>
          </h2>
          <p className="text-sm text-white/35 max-w-[280px] leading-relaxed">
            Absensi, cuti, kinerja, dan penggajian berbasis capaian — semua dalam satu dashboard.
          </p>
          <p className="pt-2 text-xs text-white/20">
            © {new Date().getFullYear()} Racabel HQ Management — Internal Use
          </p>
        </div>
      </div>

      {/* ── Panel kanan — form ── */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-fade-in">

          {/* Mobile logo (hidden on desktop) */}
          <div className="mb-8 lg:hidden flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_racabel.svg" className="h-11 w-11" alt="Racabel" />
            <span className="text-lg font-semibold dark:text-slate-100">Racabel HQ Management</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Selamat datang 👋</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Masuk untuk melanjutkan ke dashboard Anda.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Registrasi hanya dapat dilakukan oleh Admin dari dalam aplikasi.
          </p>
        </div>
      </div>
    </div>
  );
}
