import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth";
import { TikTokClient } from "@/components/tiktok/TikTokClient";

export const dynamic = "force-dynamic";

export default async function TikTokPage() {
  const user = (await getCurrentUser())!;
  if (!can(user, "marketplace.view")) redirect("/dashboard");
  return <TikTokClient />;
}
