import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { ShopeeClient } from "@/components/shopee/ShopeeClient";

export const dynamic = "force-dynamic";

export default async function ShopeePage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "marketplace.view")) redirect("/dashboard");
  return <ShopeeClient />;
}
