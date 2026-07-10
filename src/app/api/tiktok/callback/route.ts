import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCode } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

// Callback dari TikTok setelah seller menyetujui otorisasi.
// TikTok mengirim `code` (auth_code) yang ditukar jadi access + refresh token.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code") || searchParams.get("auth_code");
  const redirect = new URL("/tiktok", req.url);

  if (!code) {
    redirect.searchParams.set("tt_error", "Tidak ada auth_code pada callback.");
    return NextResponse.redirect(redirect);
  }

  try {
    const t = await exchangeAuthCode(code);
    redirect.searchParams.set("tt_connected", t.shopName || "1");
  } catch (e) {
    redirect.searchParams.set("tt_error", e instanceof Error ? e.message : "Gagal menukar token.");
  }
  return NextResponse.redirect(redirect);
}
