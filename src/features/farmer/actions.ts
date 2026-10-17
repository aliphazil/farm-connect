"use server";

import { updateTag } from "next/cache";
import { assertRole } from "@/lib/auth/session";

/**
 * Called after a farmer saves products, profile or delivery settings so the
 * public catalog shows the change immediately (read-your-own-writes).
 * Writes themselves go through Security Rules; this only expires a cache.
 */
export async function refreshCatalogAction() {
  await assertRole(["farmer"]);
  updateTag("catalog");
}
