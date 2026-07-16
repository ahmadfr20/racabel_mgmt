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

export const GET = handle(async (req: NextRequest) => {
  await requirePermission("marketplace.view");
  const { searchParams } = new URL(req.url);

  const toDate   = searchParams.get("to")   ? new Date(searchParams.get("to")!)   : new Date();
  const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const partnerId  = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (partnerId && partnerKey) {
    // TODO: implementasi Shopee API saat credentials tersedia
  }

  return NextResponse.json(generateMockData(fromDate, toDate));
});
