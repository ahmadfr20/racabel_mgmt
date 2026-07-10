// Integrasi TikTok Shop Open Platform (API v202309).
// Menangani: OAuth token (get/refresh), penandatanganan request (HMAC-SHA256),
// pengambilan shop_cipher, dan pengambilan Order untuk analitik penjualan.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const API_BASE = "https://open-api.tiktokglobalshop.com";
const AUTH_BASE = "https://auth.tiktok-shops.com";

const APP_KEY = process.env.TIKTOK_APP_KEY || "";
const APP_SECRET = process.env.TIKTOK_APP_SECRET || "";

const TOKEN_CONFIG_KEY = "tiktok_tokens";

export function tiktokConfigured(): boolean {
  return Boolean(APP_KEY && APP_SECRET);
}

// ---------- Penyimpanan token (DB key-value) ----------

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  // epoch detik kapan access token kedaluwarsa
  accessExpireAt: number;
  shopCipher?: string;
  shopId?: string;
  shopName?: string;
  sellerName?: string;
}

export async function loadTokens(): Promise<TikTokTokens | null> {
  const row = await prisma.appConfig.findUnique({ where: { key: TOKEN_CONFIG_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as TikTokTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(t: TikTokTokens): Promise<void> {
  const value = JSON.stringify(t);
  await prisma.appConfig.upsert({
    where: { key: TOKEN_CONFIG_KEY },
    create: { key: TOKEN_CONFIG_KEY, value },
    update: { value },
  });
}

export async function clearTokens(): Promise<void> {
  await prisma.appConfig.deleteMany({ where: { key: TOKEN_CONFIG_KEY } });
}

export async function isConnected(): Promise<boolean> {
  const t = await loadTokens();
  return Boolean(t?.accessToken);
}

// ---------- OAuth ----------

export function getAuthorizeUrl(state: string): string {
  const u = new URL(`${AUTH_BASE}/oauth/authorize`);
  u.searchParams.set("app_key", APP_KEY);
  u.searchParams.set("state", state);
  return u.toString();
}

interface TokenApiData {
  access_token: string;
  refresh_token: string;
  access_token_expire_in: number; // epoch detik (absolut)
  refresh_token_expire_in?: number;
  seller_name?: string;
  open_id?: string;
}

async function callTokenApi(path: string, params: Record<string, string>): Promise<TokenApiData> {
  const u = new URL(`${AUTH_BASE}${path}`);
  u.searchParams.set("app_key", APP_KEY);
  u.searchParams.set("app_secret", APP_SECRET);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);

  const res = await fetch(u.toString(), { method: "GET", cache: "no-store" });
  const json = await res.json();
  if (json.code !== 0 || !json.data?.access_token) {
    throw new Error(`TikTok token error: ${json.message || JSON.stringify(json)}`);
  }
  return json.data as TokenApiData;
}

function toTokens(data: TokenApiData, prev?: TikTokTokens | null): TikTokTokens {
  // access_token_expire_in dari TikTok adalah epoch absolut (detik).
  const now = Math.floor(Date.now() / 1000);
  const exp = data.access_token_expire_in > now ? data.access_token_expire_in : now + data.access_token_expire_in;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessExpireAt: exp,
    sellerName: data.seller_name ?? prev?.sellerName,
    shopCipher: prev?.shopCipher,
    shopId: prev?.shopId,
    shopName: prev?.shopName,
  };
}

// Tukar auth_code (dari redirect otorisasi) menjadi access + refresh token.
export async function exchangeAuthCode(authCode: string): Promise<TikTokTokens> {
  const data = await callTokenApi("/api/v2/token/get", {
    auth_code: authCode,
    grant_type: "authorized_code",
  });
  const tokens = toTokens(data);
  // Lengkapi shop_cipher lalu simpan.
  await enrichShopCipher(tokens);
  await saveTokens(tokens);
  return tokens;
}

async function refreshTokens(prev: TikTokTokens): Promise<TikTokTokens> {
  const data = await callTokenApi("/api/v2/token/refresh", {
    refresh_token: prev.refreshToken,
    grant_type: "refresh_token",
  });
  const tokens = toTokens(data, prev);
  await saveTokens(tokens);
  return tokens;
}

// Kembalikan token yang pasti masih valid (auto-refresh bila <5 menit lagi kedaluwarsa).
export async function getValidTokens(): Promise<TikTokTokens | null> {
  let t = await loadTokens();
  if (!t) return null;
  const now = Math.floor(Date.now() / 1000);
  if (t.accessExpireAt - now < 300) {
    t = await refreshTokens(t);
  }
  if (!t.shopCipher) {
    await enrichShopCipher(t);
    await saveTokens(t);
  }
  return t;
}

// ---------- Signing & signed fetch ----------

function sign(path: string, query: Record<string, string>, body: string): string {
  const params = { ...query };
  delete params.sign;
  delete params.access_token;
  delete (params as Record<string, string>)["x-tts-access-token"];

  const sorted = Object.keys(params).sort();
  let base = path;
  for (const k of sorted) base += `${k}${params[k]}`;
  if (body) base += body;

  const wrapped = APP_SECRET + base + APP_SECRET;
  return crypto.createHmac("sha256", APP_SECRET).update(wrapped).digest("hex");
}

interface SignedRequestOpts {
  method?: "GET" | "POST";
  query?: Record<string, string>;
  body?: unknown;
  accessToken: string;
}

async function signedRequest<T = any>(path: string, opts: SignedRequestOpts): Promise<T> {
  const method = opts.method ?? "GET";
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : "";

  const query: Record<string, string> = {
    app_key: APP_KEY,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(opts.query ?? {}),
  };
  query.sign = sign(path, query, method === "GET" ? "" : bodyStr);

  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "content-type": "application/json",
      "x-tts-access-token": opts.accessToken,
    },
    body: method === "GET" ? undefined : bodyStr,
    cache: "no-store",
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`TikTok API ${path} error: ${json.message || JSON.stringify(json)}`);
  }
  return json.data as T;
}

// Ambil shop_cipher (wajib untuk endpoint ber-scope toko).
async function enrichShopCipher(t: TikTokTokens): Promise<void> {
  try {
    const data = await signedRequest<{ shops: { id: string; name: string; cipher: string }[] }>(
      "/authorization/202309/shops",
      { accessToken: t.accessToken }
    );
    const shop = data.shops?.[0];
    if (shop) {
      t.shopCipher = shop.cipher;
      t.shopId = shop.id;
      t.shopName = shop.name;
    }
  } catch (e) {
    console.error("[tiktok] gagal ambil shop cipher:", e);
  }
}

// ---------- Analitik penjualan dari Order API ----------

export interface AnalyticsResponse {
  isMock: boolean;
  connected?: boolean;
  shopName?: string;
  summary: { revenue: number; orders: number; gmv: number; avgOrderValue: number };
  trend: { date: string; revenue: number; orders: number }[];
  products: { name: string; sold: number; revenue: number; views: number; conversionRate: number }[];
}

interface TikTokOrderLineItem {
  product_name?: string;
  sku_name?: string;
  sale_price?: string;
  original_price?: string;
  currency?: string;
}
interface TikTokOrder {
  id: string;
  status?: string;
  create_time: number; // epoch detik
  payment?: { total_amount?: string; currency?: string };
  line_items?: TikTokOrderLineItem[];
}

// Ambil semua order dalam rentang [from, to] (paginasi) lalu agregasi.
export async function fetchSalesAnalytics(from: Date, to: Date): Promise<AnalyticsResponse | null> {
  const t = await getValidTokens();
  if (!t || !t.shopCipher) return null;

  const createGe = Math.floor(from.getTime() / 1000);
  const createLt = Math.floor(to.getTime() / 1000) + 24 * 3600; // inklusif hari "to"

  const orders: TikTokOrder[] = [];
  let pageToken = "";
  // Batasi maksimal 20 halaman (2000 order) agar aman.
  for (let i = 0; i < 20; i++) {
    const query: Record<string, string> = {
      shop_cipher: t.shopCipher,
      page_size: "100",
    };
    if (pageToken) query.page_token = pageToken;

    const data = await signedRequest<{ orders?: TikTokOrder[]; next_page_token?: string }>(
      "/order/202309/orders/search",
      {
        method: "POST",
        query,
        body: { create_time_ge: createGe, create_time_lt: createLt },
        accessToken: t.accessToken,
      }
    );
    if (data.orders?.length) orders.push(...data.orders);
    pageToken = data.next_page_token || "";
    if (!pageToken) break;
  }

  // Agregasi
  const trendMap = new Map<string, { revenue: number; orders: number }>();
  const prodMap = new Map<string, { sold: number; revenue: number }>();
  let totalRevenue = 0;

  for (const o of orders) {
    const dateKey = new Date(o.create_time * 1000).toISOString().slice(0, 10);
    const amount = Number(o.payment?.total_amount ?? 0);
    totalRevenue += amount;

    const day = trendMap.get(dateKey) ?? { revenue: 0, orders: 0 };
    day.revenue += amount;
    day.orders += 1;
    trendMap.set(dateKey, day);

    for (const li of o.line_items ?? []) {
      const name = li.product_name || li.sku_name || "Produk";
      const price = Number(li.sale_price ?? li.original_price ?? 0);
      const p = prodMap.get(name) ?? { sold: 0, revenue: 0 };
      p.sold += 1;
      p.revenue += price;
      prodMap.set(name, p);
    }
  }

  const trend = Array.from(trendMap.entries())
    .map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const products = Array.from(prodMap.entries())
    .map(([name, v]) => ({ name, sold: v.sold, revenue: v.revenue, views: 0, conversionRate: 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalOrders = orders.length;

  return {
    isMock: false,
    connected: true,
    shopName: t.shopName,
    summary: {
      revenue: totalRevenue,
      orders: totalOrders,
      gmv: totalRevenue,
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    },
    trend,
    products,
  };
}
