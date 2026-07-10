"use client";

import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

export function TikTokClient() {
  return (
    <MarketplaceClient
      config={{
        name: "TikTok Shop",
        apiPath: "/api/tiktok/analytics",
        envKeyHint: "TIKTOK_APP_KEY",
        connectPath: "/api/tiktok/auth",
      }}
    />
  );
}
