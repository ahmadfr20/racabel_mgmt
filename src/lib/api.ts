import { NextResponse } from "next/server";
import { AuthError } from "./auth";

// Bungkus route handler agar error tertangani rapi & konsisten.
export function handle<T extends (...args: any[]) => Promise<Response>>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      console.error("[API ERROR]", err);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }) as T;
}

export function ok(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}
