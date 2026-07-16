import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

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

export const GET = handle(async (req: NextRequest) => {
  await requirePermission("marketplace.view");
  const { searchParams } = new URL(req.url);

  const toDate   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : new Date();
  const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const clientId     = process.env.TOKOPEDIA_CLIENT_ID;
  const clientSecret = process.env.TOKOPEDIA_CLIENT_SECRET;

  if (clientId && clientSecret) {
    // TODO: implementasi Tokopedia API saat credentials tersedia
  }

  return NextResponse.json(generateMockData(fromDate, toDate));
});
