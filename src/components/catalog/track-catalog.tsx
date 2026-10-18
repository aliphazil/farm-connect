"use client";

import { useEffect } from "react";
import type { ProductCategory } from "@shared/constants/catalog";
import type { AtollCode } from "@shared/constants/geography";
import { oncePerSession, track } from "@/services/client/analytics";

/**
 * Reports a product search (words only, used for de-duplication and never
 * stored) and the category / atoll / island filters in use. Renders nothing.
 */
export function TrackCatalog({
  q,
  noResults,
  category,
  atoll,
  island,
}: {
  q?: string;
  noResults: boolean;
  category?: ProductCategory;
  atoll?: AtollCode;
  island?: string;
}) {
  useEffect(() => {
    const words = q?.trim().slice(0, 100);
    if (words && oncePerSession(`search:${words.toLowerCase()}`))
      track({ type: "search", q: words, noResults });
    const filter = {
      ...(category ? { category } : {}),
      ...(atoll ? { atoll } : {}),
      ...(island ? { island } : {}),
    };
    if (
      Object.keys(filter).length &&
      oncePerSession(`filter:${category ?? ""}:${atoll ?? ""}:${island ?? ""}`)
    )
      track({ type: "filter", ...filter });
  }, [q, noResults, category, atoll, island]);
  return null;
}
