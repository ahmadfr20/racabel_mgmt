"use client";

import { MarketplaceClient } from "@/components/marketplace/MarketplaceClient";

export function TokopediaClient() {
  return (
    <MarketplaceClient
      config={{
        name: "Tokopedia",
        apiPath: "/api/tokopedia/analytics",
        envKeyHint: "TOKOPEDIA_CLIENT_ID",
      }}
    />
  );
}
