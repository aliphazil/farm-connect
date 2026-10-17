import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { ProductCategory } from "@shared/constants/catalog";
import {
  ATOLLS,
  type AtollCode,
  type Island,
} from "@shared/constants/geography";
import { SAMPLE_ISLANDS } from "@shared/constants/sample-islands";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";
import { parseDoc } from "@shared/firestore-convert";
import {
  deliveryAreaSchema,
  farmerProfileSchema,
  isFarmPublic,
  isProductPublic,
  productSchema,
  type DeliveryArea,
  type DeliveryDestination,
  type FarmerProfile,
  type Product,
} from "@shared/schemas";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  applyFilters,
  paginate,
  type CatalogFilters,
  type Page,
} from "./filters";
import { storageObjectUrl } from "./images";
import { searchProductsLive } from "./search";
import imageCredits from "./sample/image-credits.json";
import {
  SAMPLE_FARMERS,
  SAMPLE_FEATURED,
  SAMPLE_LISTINGS,
  SAMPLE_NOW,
} from "./sample/data";
import type {
  CatalogImage,
  DestinationView,
  FarmerCard,
  FarmerDetail,
  ImageCredit,
  ListingCard,
  ListingDetail,
  Place,
} from "./types";

/**
 * Catalog data-access layer for the public site.
 *
 * Source is chosen by CATALOG_SOURCE:
 *   - unset / "sample": bundled sample data (pages show a sample-data notice)
 *   - "firestore": public products and farms from Firestore via the Admin SDK,
 *     cached under the "catalog" tag (farmer saves call updateTag("catalog")).
 * Only public records are ever loaded: products that are published, not
 * moderated and from a public farm; farms that are approved and visible.
 * CATALOG_SOURCE must be set at build time too, because public pages are
 * prerendered.
 */
export const isSampleCatalog = process.env.CATALOG_SOURCE !== "firestore";

/** Upper bound per snapshot; filtering happens in memory (fine at launch scale). */
const MAX_PRODUCTS = 2000;

type Snapshot = {
  products: Product[];
  farmers: FarmerProfile[];
  /** Active delivery areas of public farms (method and fee per destination). */
  deliveryAreas: DeliveryArea[];
  islands: Island[];
  featured: { productIds: string[]; farmerIds: string[] };
  now: Date;
};

const sampleSnapshot: Snapshot = {
  products: SAMPLE_LISTINGS,
  farmers: SAMPLE_FARMERS,
  deliveryAreas: [],
  islands: [...SAMPLE_ISLANDS],
  featured: {
    productIds: SAMPLE_FEATURED.listingIds,
    farmerIds: SAMPLE_FEATURED.farmerIds,
  },
  now: SAMPLE_NOW,
};

async function loadFirestoreSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheTag("catalog");
  cacheLife("minutes");

  const db = getAdminDb();
  const [productsSnap, farmersSnap, islandsSnap, featuredSnap, areasSnap] =
    await Promise.all([
      db
        .collection(COLLECTIONS.products)
        .where("status", "in", ["active", "sold_out"])
        .where("moderation", "==", "ok")
        .where("farmerVisible", "==", true)
        .limit(MAX_PRODUCTS)
        .get(),
      db
        .collection(COLLECTIONS.farmerProfiles)
        .where("approvalStatus", "==", "approved")
        .where("visible", "==", true)
        .get(),
      db.collection(COLLECTIONS.islands).where("active", "==", true).get(),
      db
        .collection(COLLECTIONS.siteSettings)
        .doc(SITE_SETTINGS_DOCS.featured)
        .get(),
      db
        .collection(COLLECTIONS.deliveryAreas)
        .where("active", "==", true)
        .get(),
    ]);

  // Skip (rather than fail on) any record that doesn't match the schema.
  const parseAll = <T>(
    docs: QueryDocumentSnapshot[],
    parse: (d: QueryDocumentSnapshot) => T,
  ) =>
    docs.flatMap((d) => {
      try {
        return [parse(d)];
      } catch {
        console.warn(`Skipping invalid catalog record ${d.ref.path}`);
        return [];
      }
    });

  return {
    products: parseAll(productsSnap.docs, (d) =>
      parseDoc(productSchema, d.id, d.data()),
    ),
    deliveryAreas: parseAll(areasSnap.docs, (d) =>
      parseDoc(deliveryAreaSchema, d.id, d.data()),
    ),
    farmers: parseAll(farmersSnap.docs, (d) =>
      parseDoc(farmerProfileSchema, d.id, d.data(), "uid"),
    ),
    islands: islandsSnap.docs.map((d) => ({
      id: d.id,
      atollCode: d.get("atollCode"),
      nameEn: d.get("nameEn"),
      nameDv: d.get("nameDv") ?? undefined,
    })),
    featured: {
      productIds: featuredSnap.get("productIds") ?? [],
      farmerIds: featuredSnap.get("farmerIds") ?? [],
    },
    now: new Date(),
  };
}

function loadSnapshot(): Promise<Snapshot> {
  return isSampleCatalog
    ? Promise.resolve(sampleSnapshot)
    : loadFirestoreSnapshot();
}

// ---------- building views from a snapshot (memoised per snapshot) ----------

const credits = imageCredits as Record<string, ImageCredit>;

function toImage(path: string): CatalogImage {
  if (path.startsWith("sample/")) {
    const slug = path.replace(/^sample\//, "").replace(/\.jpg$/, "");
    return { src: `/${path}`, credit: credits[slug] };
  }
  return { src: storageObjectUrl(path) };
}

class Catalog {
  readonly farmerById: Map<string, FarmerProfile>;
  readonly products: Product[];
  readonly islandById: Map<string, Island>;
  readonly cardById: Map<string, ListingCard>;
  readonly searchable: (ListingCard & {
    deliveryDestinations: DeliveryDestination[];
    searchText: string;
  })[];

  constructor(readonly snap: Snapshot) {
    const farmers = snap.farmers.filter(isFarmPublic);
    this.farmerById = new Map(farmers.map((f) => [f.uid, f]));
    this.products = snap.products.filter(
      (p) => isProductPublic(p) && this.farmerById.has(p.farmerId),
    );
    this.islandById = new Map(snap.islands.map((i) => [i.id, i]));
    this.cardById = new Map(this.products.map((p) => [p.id, this.card(p)]));
    this.searchable = this.products.map((p) => {
      const farmer = this.farmerById.get(p.farmerId)!;
      return {
        ...this.card(p),
        deliveryDestinations: p.deliveryDestinations,
        searchText: [
          p.title.en,
          p.title.dv,
          p.description?.en,
          p.description?.dv,
          farmer.farmName.en,
          farmer.farmName.dv,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(),
      };
    });
  }

  place(atollCode: AtollCode, islandId: string): Place {
    const island = this.islandById.get(islandId);
    return {
      atollCode,
      islandId,
      islandEn: island?.nameEn ?? islandId,
      islandDv: island?.nameDv,
    };
  }

  destinations(
    list: DeliveryDestination[],
    farmerId: string,
  ): DestinationView[] {
    const areas = this.snap.deliveryAreas.filter(
      (a) => a.farmerId === farmerId,
    );
    return list.map((d) => {
      const area = areas.find(
        (a) =>
          a.atollCode === d.atollCode &&
          (a.islandId ?? "") === (d.islandId ?? ""),
      );
      const terms = area
        ? { method: area.method, feeLaari: area.feeLaari }
        : {};
      if (!d.islandId) return { atollCode: d.atollCode, ...terms };
      const { islandId, islandEn, islandDv } = this.place(
        d.atollCode,
        d.islandId,
      );
      return {
        atollCode: d.atollCode,
        island: { islandId, islandEn, islandDv },
        ...terms,
      };
    });
  }

  card(p: Product): ListingCard {
    const farmer = this.farmerById.get(p.farmerId)!;
    return {
      id: p.id,
      title: p.title,
      category: p.category,
      unit: p.unit,
      priceLaari: p.priceLaari,
      quantityAvailable: p.quantityAvailable,
      status: p.status,
      availableFrom: p.availableFrom,
      image: p.imagePaths[0] ? toImage(p.imagePaths[0]) : null,
      atollCode: p.location.atollCode,
      islandId: p.location.islandId,
      place: this.place(p.location.atollCode, p.location.islandId),
      farmer: {
        id: farmer.uid,
        farmName: farmer.farmName,
        verified: farmer.verified,
      },
      createdAt: p.createdAt,
    };
  }

  farmerCard(f: FarmerProfile): FarmerCard {
    const products = this.products.filter((p) => p.farmerId === f.uid);
    const cover = f.logoPath ?? products[0]?.imagePaths[0];
    return {
      id: f.uid,
      farmName: f.farmName,
      verified: f.verified,
      bio: f.bio,
      atollCode: f.location.atollCode,
      islandId: f.location.islandId,
      place: this.place(f.location.atollCode, f.location.islandId),
      listingCount: products.length,
      coverImage: cover ? toImage(cover) : null,
    };
  }

  farmerDetail(f: FarmerProfile): FarmerDetail {
    return {
      ...this.farmerCard(f),
      deliveryDestinations: this.destinations(f.deliveryDestinations, f.uid),
      pickupAvailable: f.pickupAvailable,
      // Never expose contact details for sample farms (placeholder numbers).
      contact: isSampleCatalog ? null : f.contact,
    };
  }

  detail(p: Product): ListingDetail {
    return {
      ...this.card(p),
      description: p.description,
      minOrderQuantity: p.minOrderQuantity,
      harvestDate: p.harvestDate,
      pickupAvailable: p.pickupAvailable ?? false,
      images: p.imagePaths.map(toImage),
      deliveryDestinations: this.destinations(
        p.deliveryDestinations,
        p.farmerId,
      ),
      farmer: this.farmerDetail(this.farmerById.get(p.farmerId)!),
    };
  }
}

const catalogs = new WeakMap<Snapshot, Catalog>();
async function catalog(): Promise<Catalog> {
  const snap = await loadSnapshot();
  let c = catalogs.get(snap);
  if (!c) {
    c = new Catalog(snap);
    catalogs.set(snap, c);
  }
  return c;
}

// ---------- public queries ----------

/** "Now" for availability (fixed for sample data so builds are deterministic). */
export async function catalogNow(): Promise<Date> {
  return (await loadSnapshot()).now;
}

/** Islands known to the active source, for filters and location pages. */
export async function getCatalogIslands(): Promise<Island[]> {
  return (await loadSnapshot()).islands;
}

export async function searchListings(
  filters: CatalogFilters,
): Promise<Page<ListingCard>> {
  const c = await catalog();
  const matches = applyFilters(c.searchable, filters, c.snap.now).map((entry) =>
    c.cardById.get(entry.id)!,
  );
  return paginate(matches, filters.page);
}

export type LivePage = {
  items: ListingCard[];
  nextCursor: string | null;
  total: number | null;
};

/**
 * Live, query-based search (CATALOG_SOURCE=firestore). Products come straight
 * from a Firestore query; farm names and island names come from the cached
 * directory. Products whose farm isn't in the directory yet are skipped.
 */
export async function searchListingsLive(
  filters: CatalogFilters,
  after?: string,
): Promise<LivePage> {
  const [c, result] = await Promise.all([
    catalog(),
    searchProductsLive(filters, after),
  ]);
  const items = result.products
    .filter((p) => c.farmerById.has(p.farmerId))
    .map((p) => c.card(p));
  return { items, nextCursor: result.nextCursor, total: result.total };
}

export async function getRecentListings(limit: number): Promise<ListingCard[]> {
  const c = await catalog();
  return [...c.products]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((p) => c.card(p));
}

export async function getFeaturedListings(): Promise<ListingCard[]> {
  const c = await catalog();
  const featured = c.snap.featured.productIds
    .map((id) => c.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
  // Until admins curate features, show the newest products.
  return (featured.length ? featured : c.products.slice(0, 8)).map((p) =>
    c.card(p),
  );
}

export async function getListing(id: string): Promise<ListingDetail | null> {
  const c = await catalog();
  const product = c.products.find((p) => p.id === id);
  return product ? c.detail(product) : null;
}

export async function getListingIds(): Promise<string[]> {
  return (await catalog()).products.map((p) => p.id);
}

export async function getListingsByFarmer(
  farmerId: string,
  excludeId?: string,
): Promise<ListingCard[]> {
  const c = await catalog();
  return c.products
    .filter((p) => p.farmerId === farmerId && p.id !== excludeId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((p) => c.card(p));
}

export async function listFarmers(atoll?: AtollCode): Promise<FarmerCard[]> {
  const c = await catalog();
  return [...c.farmerById.values()]
    .filter((f) => !atoll || f.location.atollCode === atoll)
    .map((f) => c.farmerCard(f))
    .sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        a.farmName.en.localeCompare(b.farmName.en),
    );
}

export async function getFeaturedFarmers(): Promise<FarmerCard[]> {
  const c = await catalog();
  const featured = c.snap.featured.farmerIds
    .map((id) => c.farmerById.get(id))
    .filter((f): f is FarmerProfile => Boolean(f));
  return (
    featured.length ? featured : [...c.farmerById.values()].slice(0, 4)
  ).map((f) => c.farmerCard(f));
}

export async function getFarmer(id: string): Promise<FarmerDetail | null> {
  const c = await catalog();
  const farmer = c.farmerById.get(id);
  return farmer ? c.farmerDetail(farmer) : null;
}

export async function getFarmerIds(): Promise<string[]> {
  return [...(await catalog()).farmerById.keys()];
}

export async function getCategoryCounts(): Promise<
  Record<ProductCategory, number>
> {
  const counts = {} as Record<ProductCategory, number>;
  for (const p of (await catalog()).products)
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  return counts;
}

export type AtollSummary = {
  code: AtollCode;
  farmCount: number;
  productCount: number;
  islands: {
    id: string;
    nameEn: string;
    nameDv?: string;
    farmCount: number;
    productCount: number;
  }[];
};

export async function getAtollSummaries(): Promise<AtollSummary[]> {
  const c = await catalog();
  const farms = [...c.farmerById.values()];
  return ATOLLS.map((atoll) => {
    const atollFarms = farms.filter((f) => f.location.atollCode === atoll.code);
    const atollProducts = c.products.filter(
      (p) => p.location.atollCode === atoll.code,
    );
    return {
      code: atoll.code,
      farmCount: atollFarms.length,
      productCount: atollProducts.length,
      islands: c.snap.islands
        .filter((i) => i.atollCode === atoll.code)
        .map((i) => ({
          id: i.id,
          nameEn: i.nameEn,
          nameDv: i.nameDv,
          farmCount: atollFarms.filter((f) => f.location.islandId === i.id)
            .length,
          productCount: atollProducts.filter(
            (p) => p.location.islandId === i.id,
          ).length,
        })),
    };
  });
}

/** Every bundled sample photo with its credit, for the credits page. */
export async function getSampleImageCredits(): Promise<
  (ImageCredit & { slug: string })[]
> {
  return Object.entries(credits).map(([slug, credit]) => ({ slug, ...credit }));
}
