"use client";

import { useEffect } from "react";
import { oncePerSession, track } from "@/services/client/analytics";

/**
 * Reports a product or farm page view. The server counts each visitor once
 * per page per day; this only avoids repeat requests. Renders nothing.
 */
export function TrackView(
  props:
    | { type: "product_view"; productId: string }
    | { type: "farmer_view"; farmerId: string },
) {
  const id = props.type === "product_view" ? props.productId : props.farmerId;
  const { type } = props;
  useEffect(() => {
    if (!oncePerSession(`${type}:${id}`)) return;
    track(
      type === "product_view"
        ? { type, productId: id }
        : { type, farmerId: id },
    );
  }, [type, id]);
  return null;
}
