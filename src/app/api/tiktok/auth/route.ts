import { NextResponse } from "next/server";
import { getAuthorizeUrl, tiktokConfigured } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

// Mulai proses otorisasi: redirect admin ke halaman izin TikTok Shop.
export async function GET() {
  if (!tiktokConfigured()) {
    return NextResponse.json(
      { error: "TIKTOK_APP_KEY / TIKTOK_APP_SECRET belum diset di server." },
      { status: 400 }
    );
  }
  const state = Math.random().toString(36).slice(2);
  return NextResponse.redirect(getAuthorizeUrl(state));
}
