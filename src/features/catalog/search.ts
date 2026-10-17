import "server-only";

import type { DocumentSnapshot, Query } from "firebase-admin/firestore";
import { COLLECTIONS } from "@shared/firestore-paths";
import { parseDoc } from "@shared/firestore-convert";
import { productSchema, type Product } from "@shared/schemas";
import { queryTokens } from "@shared/search";
import { getAdminDb } from "@/lib/firebase/admin";
import type { CatalogFilters } from "./filters";

/**
 * Live product search with Firestore queries (server only, Admin SDK).
 *
 * In the query (indexed):   isPublic, status (available now), category,
 *                           atoll or island, ONE array-contains (a search
 *                           word, else the delivery atoll), price range when
 *                           sorting by price, and the sort order.
 * In memory, per batch:     extra search words, delivery atoll when a search
 *                           word took the array-contains slot, "available
 *                           from" dates in the future, price range when
 *                           sorting by newest.
 * Results are paged with a cursor (the last returned product id). Each call
 * scans at most MAX_SCAN documents, so a page can come back short when most
 * candidates are filtered out in memory.
 *
 * This is prefix matching on names, not full-text search: see docs/search.md.
 */

export const PAGE_SIZE = 12;
const BATCH = 48;
const MAX_SCAN = 240;

export type LiveSearchResult = {
  products: Product[];
  /** Pass back as `after` to get the next page; null when there's no more. */
  nextCursor: string | null;
  /** Exact total, when every filter ran inside Firestore; otherwise null. */
  total: number | null;
};

export type SearchPlan = {
  primaryToken: string | null;
  arrayFilter: "token" | "delivery" | null;
  inMemory: {
    restTokens: string[];
    deliverTo: string | null;
    priceRange: boolean;
  };
};

/** Decides which filters run in Firestore and which in memory (exported for tests). */
export function planSearch(f: CatalogFilters): SearchPlan {
  const { primary, rest } = queryTokens(f.q ?? "");
  const arrayFilter = primary ? "token" : f.deliverTo ? "delivery" : null;
  const hasPrice =
    f.minPriceLaari !== undefined || f.maxPriceLaari !== undefined;
  return {
    primaryToken: primary,
    arrayFilter,
    inMemory: {
      restTokens: rest,
      deliverTo: arrayFilter === "token" && f.deliverTo ? f.deliverTo : null,
      priceRange: hasPrice && f.sort === "newest",
    },
  };
}

function buildQuery(f: CatalogFilters, plan: SearchPlan): Query {
  let q: Query = getAdminDb()
    .collection(COLLECTIONS.products)
    .where("isPublic", "==", true);
  if (f.availableNow) q = q.where("status", "==", "active");
  if (f.category) q = q.where("category", "==", f.category);
  if (f.island) q = q.where("location.islandId", "==", f.island);
  else if (f.atoll) q = q.where("location.atollCode", "==", f.atoll);
  if (plan.arrayFilter === "token")
    q = q.where("searchTokens", "array-contains", plan.primaryToken);
  if (plan.arrayFilter === "delivery")
    q = q.where("deliveryAtolls", "array-contains", f.deliverTo);

  if (f.sort === "newest") return q.orderBy("createdAt", "desc");
  if (f.minPriceLaari !== undefined)
    q = q.where("priceLaari", ">=", f.minPriceLaari);
  if (f.maxPriceLaari !== undefined)
    q = q.where("priceLaari", "<=", f.maxPriceLaari);
  return q
    .orderBy("priceLaari", f.sort === "price_asc" ? "asc" : "desc")
    .orderBy("createdAt", "desc");
}

function passesInMemory(
  p: Product,
  f: CatalogFilters,
  plan: SearchPlan,
  now: Date,
): boolean {
  const { restTokens, deliverTo, priceRange } = plan.inMemory;
  if (restTokens.some((t) => !p.searchTokens.includes(t))) return false;
  if (
    deliverTo &&
    !p.deliveryAtolls.includes(deliverTo as Product["deliveryAtolls"][number])
  )
    return false;
  if (f.availableNow && p.availableFrom && p.availableFrom > now) return false;
  if (priceRange) {
    if (f.minPriceLaari !== undefined && p.priceLaari < f.minPriceLaari)
      return false;
    if (f.maxPriceLaari !== undefined && p.priceLaari > f.maxPriceLaari)
      return false;
  }
  return true;
}

export async function searchProductsLive(
  f: CatalogFilters,
  after?: string,
  pageSize = PAGE_SIZE,
): Promise<LiveSearchResult> {
  const plan = planSearch(f);
  const base = buildQuery(f, plan);
  const now = new Date();

  let cursor: DocumentSnapshot | undefined;
  if (after) {
    const snap = await getAdminDb()
      .collection(COLLECTIONS.products)
      .doc(after)
      .get();
    if (snap.exists) cursor = snap;
  }

  const products: Product[] = [];
  let scanned = 0;
  let exhausted = false;
  let lastIncluded: string | null = null;

  while (products.length < pageSize && scanned < MAX_SCAN) {
    const page = await (cursor ? base.startAfter(cursor) : base)
      .limit(BATCH)
      .get();
    if (page.empty) {
      exhausted = true;
      break;
    }
    for (const doc of page.docs) {
      scanned++;
      cursor = doc;
      let p: Product;
      try {
        p = parseDoc(productSchema, doc.id, doc.data());
      } catch {
        continue; // skip malformed records rather than failing the page
      }
      if (!passesInMemory(p, f, plan, now)) continue;
      products.push(p);
      lastIncluded = doc.id;
      if (products.length === pageSize) break;
    }
    if (page.size < BATCH && products.length < pageSize) {
      exhausted = true;
      break;
    }
  }

  // If the page filled up, more may follow; resume after the last product shown.
  // If the scan limit was hit first, resume after the last document scanned.
  const nextCursor = exhausted
    ? null
    : products.length === pageSize
      ? lastIncluded
      : (cursor?.id ?? null);

  const exact =
    !plan.inMemory.restTokens.length &&
    !plan.inMemory.deliverTo &&
    !plan.inMemory.priceRange &&
    !f.availableNow;
  const total =
    exact && !after ? (await base.count().get()).data().count : null;

  return { products, nextCursor, total };
}
