"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isTrackablePath } from "@shared/schemas";
import { track } from "@/services/client/analytics";

/**
 * Counts a page view each time a public page is shown (including refreshes;
 * visitors and sessions are worked out on the server, so refreshing doesn't
 * make a new visitor). Admin, farmer and account pages aren't counted.
 */
export function SiteAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname && isTrackablePath(pathname))
      track({ type: "page_view", path: pathname });
  }, [pathname]);
  return null;
}
