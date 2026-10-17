"use client";

import { useEffect } from "react";
import type { Locale } from "@shared/constants/locales";
import type { SiteEventType } from "@shared/schemas";
import { logSiteEvent } from "@/services/client/interactions";

/**
 * Records one usage event per page per browser session (deduplicated in
 * sessionStorage) for the farmer's dashboard. Renders nothing.
 */
export function TrackView({
  type,
  locale,
  productId,
  farmerId,
}: {
  type: Extract<SiteEventType, "product_view" | "farmer_view">;
  locale: Locale;
  productId?: string;
  farmerId: string;
}) {
  useEffect(() => {
    const key = `fc:${type}:${productId ?? farmerId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage unavailable (private mode): still count once per page load.
    }
    logSiteEvent({
      type,
      locale,
      productId,
      farmerId,
      path: window.location.pathname,
    });
  }, [type, locale, productId, farmerId]);
  return null;
}
