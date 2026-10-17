import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@shared/constants/catalog";
import {
  ATOLL_CODES,
  type AtollCode,
  type Island,
} from "@shared/constants/geography";
import { parseMVR } from "@shared/utils/money";
import type { Availability, ListingCard } from "./types";

/**
 * Catalog search filters, parsed leniently from URL search params: anything
 * invalid is ignored rather than causing an error page.
 */
export const SORTS = ["newest", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];

export type CatalogFilters = {
  q?: string;
  category?: ProductCategory;
  atoll?: AtollCode;
  island?: string;
  minPriceLaari?: number;
  maxPriceLaari?: number;
  availableNow?: boolean;
  deliverTo?: AtollCode;
  sort: Sort;
  page: number;
};

export const PAGE_SIZE = 12;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * `islands` are the records of the active catalog source; an island filter is
 * only kept if it's one of them (and in the chosen atoll, if any).
 */
export function parseCatalogFilters(
  params: RawParams,
  islands: readonly Island[] = [],
): CatalogFilters {
  const atoll = oneOf(first(params.atoll), ATOLL_CODES);
  const islandId = first(params.island);
  const island = islandId ? islands.find((i) => i.id === islandId) : undefined;
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  const min = first(params.min);
  const max = first(params.max);

  return {
    q: first(params.q)?.slice(0, 80),
    category: oneOf(first(params.category), PRODUCT_CATEGORIES),
    atoll: atoll ?? island?.atollCode,
    // An island only counts if it belongs to the chosen atoll (or no atoll was chosen).
    island:
      island && (!atoll || island.atollCode === atoll) ? island.id : undefined,
    minPriceLaari: min ? (parseMVR(min) ?? undefined) : undefined,
    maxPriceLaari: max ? (parseMVR(max) ?? undefined) : undefined,
    availableNow: first(params.available) === "1" || undefined,
    deliverTo: oneOf(first(params.deliver), ATOLL_CODES),
    sort: oneOf(first(params.sort), SORTS) ?? "newest",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Serialises filters back to a query string (for pagination links). */
export function filtersToSearchParams(
  filters: Partial<CatalogFilters>,
  overrides: Partial<CatalogFilters> = {},
): URLSearchParams {
  const f = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.category) params.set("category", f.category);
  if (f.atoll) params.set("atoll", f.atoll);
  if (f.island) params.set("island", f.island);
  if (f.minPriceLaari !== undefined)
    params.set("min", String(f.minPriceLaari / 100));
  if (f.maxPriceLaari !== undefined)
    params.set("max", String(f.maxPriceLaari / 100));
  if (f.availableNow) params.set("available", "1");
  if (f.deliverTo) params.set("deliver", f.deliverTo);
  if (f.sort && f.sort !== "newest") params.set("sort", f.sort);
  if (f.page && f.page > 1) params.set("page", String(f.page));
  return params;
}

export function hasActiveFilters(f: CatalogFilters): boolean {
  return Boolean(
    f.q ||
    f.category ||
    f.atoll ||
    f.island ||
    f.minPriceLaari !== undefined ||
    f.maxPriceLaari !== undefined ||
    f.availableNow ||
    f.deliverTo,
  );
}

export function availabilityOf(
  listing: Pick<ListingCard, "status" | "quantityAvailable" | "availableFrom">,
  now: Date,
): Availability {
  if (listing.status === "sold_out" || listing.quantityAvailable <= 0)
    return { kind: "sold_out" };
  if (listing.availableFrom && listing.availableFrom > now) {
    return { kind: "upcoming", from: listing.availableFrom };
  }
  return { kind: "available", quantity: listing.quantityAvailable };
}

type Searchable = ListingCard & {
  deliveryDestinations: { atollCode: string }[];
  searchText: string;
};

export function applyFilters<T extends Searchable>(
  listings: readonly T[],
  f: CatalogFilters,
  now: Date,
): T[] {
  const q = f.q?.toLocaleLowerCase();
  const result = listings.filter((l) => {
    if (q && !l.searchText.includes(q)) return false;
    if (f.category && l.category !== f.category) return false;
    if (f.atoll && l.atollCode !== f.atoll) return false;
    if (f.island && l.islandId !== f.island) return false;
    if (f.minPriceLaari !== undefined && l.priceLaari < f.minPriceLaari)
      return false;
    if (f.maxPriceLaari !== undefined && l.priceLaari > f.maxPriceLaari)
      return false;
    if (f.availableNow && availabilityOf(l, now).kind !== "available")
      return false;
    if (
      f.deliverTo &&
      l.atollCode !== f.deliverTo &&
      !l.deliveryDestinations.some((d) => d.atollCode === f.deliverTo)
    ) {
      return false;
    }
    return true;
  });

  const byNewest = (a: T, b: T) =>
    b.createdAt.getTime() - a.createdAt.getTime();
  const sorters: Record<Sort, (a: T, b: T) => number> = {
    newest: byNewest,
    price_asc: (a, b) => a.priceLaari - b.priceLaari || byNewest(a, b),
    price_desc: (a, b) => b.priceLaari - a.priceLaari || byNewest(a, b),
  };
  return result.sort(sorters[f.sort]);
}

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
};

export function paginate<T>(
  items: readonly T[],
  page: number,
  size = PAGE_SIZE,
): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pageCount);
  return {
    items: items.slice((current - 1) * size, current * size),
    total: items.length,
    page: current,
    pageCount,
  };
}
