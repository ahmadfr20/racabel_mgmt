"use client";

import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

export function ShopeeClient() {
  return (
    <MarketplaceClient
      config={{
        name: "Shopee",
        apiPath: "/api/shopee/analytics",
        envKeyHint: "SHOPEE_PARTNER_ID",
      }}
    />
  );
}
