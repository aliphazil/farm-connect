"use client";

import { useEffect } from "react";
import type { Locale } from "@shared/constants/locales";
import { logSiteEvent } from "@/services/client/interactions";

/**
 * Counts a website visit: one `page_view` event per browser session (the
 * admin dashboard's "Visits"). Renders nothing.
 */
export function TrackVisit({ locale }: { locale: Locale }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("fc:visit")) return;
      sessionStorage.setItem("fc:visit", "1");
    } catch {
      // Storage unavailable: count once per page load.
    }
    logSiteEvent({ type: "page_view", locale, path: window.location.pathname });
  }, [locale]);
  return null;
}
