import "server-only";

import { AggregateField } from "firebase-admin/firestore";
import { cacheLife, cacheTag } from "next/cache";
import type { Island } from "@shared/constants/geography";
import { COLLECTIONS } from "@shared/firestore-paths";
import {
  deliveryAreaSchema,
  enquirySchema,
  isFarmPublic,
  productSchema,
  type DeliveryArea,
  type DeliveryDestination,
  type Enquiry,
  type FarmerProfile,
  type Product,
} from "@shared/schemas";
import { parseRange } from "@/features/admin/range";
import { storageObjectUrl } from "@/features/catalog/images";
import type {
  DestinationView,
  ListingDetail,
  Place,
} from "@/features/catalog/types";
import { getAdminDb } from "@/lib/firebase/admin";
import { getFarmerTotals } from "./analytics";
import { snapToModel } from "./db";

/**
 * Read services for the farmer portal (Admin SDK, server only).
 * EVERY function takes the uid of the verified session user and filters by
 * it — never pass a uid taken from the URL or the request body.
 */

const db = () => getAdminDb();

// ---------- islands (for display names) ----------

async function loadIslands(): Promise<Island[]> {
  "use cache";
  cacheTag("geography");
  cacheLife("hours");
  const snap = await db().collection(COLLECTIONS.islands).get();
  return snap.docs.map((d) => ({
    id: d.id,
    atollCode: d.get("atollCode"),
    nameEn: d.get("nameEn"),
    nameDv: d.get("nameDv") ?? undefined,
  }));
}

export async function getIslandMap(): Promise<Map<string, Island>> {
  return new Map((await loadIslands()).map((i) => [i.id, i]));
}

export function toPlace(
  islands: Map<string, Island>,
  atollCode: Place["atollCode"],
  islandId: string,
): Place {
  const island = islands.get(islandId);
  return {
    atollCode,
    islandId,
    islandEn: island?.nameEn ?? islandId,
    islandDv: island?.nameDv,
  };
}

export function toDestinations(
  islands: Map<string, Island>,
  list: DeliveryDestination[],
  areas: DeliveryArea[] = [],
): DestinationView[] {
  return list.map((d) => {
    const area = areas.find(
      (a) =>
        a.active &&
        a.atollCode === d.atollCode &&
        (a.islandId ?? "") === (d.islandId ?? ""),
    );
    const terms = area ? { method: area.method, feeLaari: area.feeLaari } : {};
    if (!d.islandId) return { atollCode: d.atollCode, ...terms };
    const { islandId, islandEn, islandDv } = toPlace(
      islands,
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

// ---------- products ----------

export async function listFarmerProducts(uid: string): Promise<Product[]> {
  const snap = await db()
    .collection(COLLECTIONS.products)
    .where("farmerId", "==", uid)
    .get();
  return snap.docs
    .map((d) => snapToModel(productSchema, d)!)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** The farmer's own product, or null (also when it belongs to someone else). */
export async function getFarmerProduct(
  uid: string,
  productId: string,
): Promise<Product | null> {
  const product = snapToModel(
    productSchema,
    await db().collection(COLLECTIONS.products).doc(productId).get(),
  );
  return product && product.farmerId === uid ? product : null;
}

/** Why a product isn't visible to buyers, or null if it is. */
export function notPublicReason(
  product: Pick<Product, "status" | "moderation">,
  farm: Pick<FarmerProfile, "approvalStatus" | "visible">,
): "removed" | "rejected" | "pending" | "draft" | "paused" | "farm" | null {
  if (product.moderation === "removed") return "removed";
  if (product.moderation === "rejected") return "rejected";
  if (product.moderation === "pending") return "pending";
  if (product.status === "draft") return "draft";
  if (product.status === "paused") return "paused";
  if (!isFarmPublic(farm)) return "farm";
  return null;
}

/** Builds the buyer-facing view of the farmer's own product for preview. */
export async function buildProductPreview(
  product: Product,
  farm: FarmerProfile,
): Promise<ListingDetail> {
  const [islands, areas] = await Promise.all([
    getIslandMap(),
    listFarmerDeliveryAreas(farm.uid),
  ]);
  const place = toPlace(
    islands,
    product.location.atollCode,
    product.location.islandId,
  );
  const farmPlace = toPlace(
    islands,
    farm.location.atollCode,
    farm.location.islandId,
  );
  const image = (path: string) => ({ src: storageObjectUrl(path) });
  return {
    id: product.id,
    title: product.title,
    category: product.category,
    unit: product.unit,
    priceLaari: product.priceLaari,
    quantityAvailable: product.quantityAvailable,
    status: product.status,
    availableFrom: product.availableFrom,
    image: product.imagePaths[0] ? image(product.imagePaths[0]) : null,
    atollCode: product.location.atollCode,
    islandId: product.location.islandId,
    place,
    createdAt: product.createdAt,
    description: product.description,
    minOrderQuantity: product.minOrderQuantity,
    harvestDate: product.harvestDate,
    pickupAvailable: product.pickupAvailable ?? false,
    images: product.imagePaths.map(image),
    deliveryDestinations: toDestinations(
      islands,
      product.deliveryDestinations,
      areas,
    ),
    farmer: {
      id: farm.uid,
      farmName: farm.farmName,
      verified: farm.verified,
      bio: farm.bio,
      atollCode: farm.location.atollCode,
      islandId: farm.location.islandId,
      place: farmPlace,
      listingCount: 0,
      coverImage: farm.logoPath ? image(farm.logoPath) : null,
      deliveryDestinations: toDestinations(
        islands,
        farm.deliveryDestinations,
        areas,
      ),
      pickupAvailable: farm.pickupAvailable,
      contact: farm.contact,
    },
  };
}

// ---------- enquiries & delivery ----------

export type FarmerEnquiry = Enquiry & {
  product: Pick<Product, "id" | "title" | "unit"> | null;
  deliverToPlace: Place;
};

export async function listFarmerEnquiries(
  uid: string,
): Promise<FarmerEnquiry[]> {
  const [snap, islands, products] = await Promise.all([
    db().collection(COLLECTIONS.enquiries).where("farmerId", "==", uid).get(),
    getIslandMap(),
    listFarmerProducts(uid),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  return snap.docs
    .map((d) => snapToModel(enquirySchema, d)!)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((e) => {
      const p = productById.get(e.productId);
      return {
        ...e,
        product: p ? { id: p.id, title: p.title, unit: p.unit } : null,
        deliverToPlace: toPlace(
          islands,
          e.deliverTo.atollCode,
          e.deliverTo.islandId,
        ),
      };
    });
}

export async function listFarmerDeliveryAreas(
  uid: string,
): Promise<DeliveryArea[]> {
  const snap = await db()
    .collection(COLLECTIONS.deliveryAreas)
    .where("farmerId", "==", uid)
    .get();
  return snap.docs
    .map((d) => snapToModel(deliveryAreaSchema, d)!)
    .sort(
      (a, b) =>
        a.atollCode.localeCompare(b.atollCode) ||
        (a.islandId ?? "").localeCompare(b.islandId ?? ""),
    );
}

// ---------- dashboard ----------

export type FarmerDashboard = {
  products: {
    published: number;
    draft: number;
    paused: number;
    soldOut: number;
    removed: number;
  };
  views: number | null;
  contactClicks: number | null;
  newEnquiries: number | null;
  invoicedLaari: number | null;
  paymentsLaari: number | null;
  outstandingLaari: number | null;
};

async function safe<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error("Dashboard figure failed", error);
    return null;
  }
}

/** Real figures from the farmer's own records. Null = couldn't be loaded. */
export async function getFarmerDashboard(
  uid: string,
): Promise<FarmerDashboard> {
  // Views and contact clicks over the last 30 days (src/services/server/analytics.ts).
  const range = parseRange({ range: "30d" }, new Date());
  const [products, traffic, newEnquiries, invoices, payments] =
    await Promise.all([
      listFarmerProducts(uid),
      safe(() => getFarmerTotals(uid, { from: range.from!, to: range.to })),
      safe(
        async () =>
          (
            await db()
              .collection(COLLECTIONS.enquiries)
              .where("farmerId", "==", uid)
              .where("status", "==", "new")
              .count()
              .get()
          ).data().count,
      ),
      safe(async () =>
        (
          await db()
            .collection(COLLECTIONS.invoices)
            .where("farmerId", "==", uid)
            .where("status", "in", ["issued", "partially_paid", "paid"])
            .aggregate({
              total: AggregateField.sum("totalLaari"),
              paid: AggregateField.sum("paidLaari"),
            })
            .get()
        ).data(),
      ),
      safe(
        async () =>
          (
            await db()
              .collection(COLLECTIONS.payments)
              .where("farmerId", "==", uid)
              .aggregate({ total: AggregateField.sum("effectiveLaari") })
              .get()
          ).data().total,
      ),
    ]);

  const counts = { published: 0, draft: 0, paused: 0, soldOut: 0, removed: 0 };
  for (const p of products) {
    // Removed, rejected or awaiting review: not published.
    if (p.moderation !== "ok") counts.removed++;
    else if (p.status === "active") counts.published++;
    else if (p.status === "draft") counts.draft++;
    else if (p.status === "paused") counts.paused++;
    else counts.soldOut++;
  }

  return {
    products: counts,
    views: traffic?.views ?? null,
    contactClicks: traffic?.clicks ?? null,
    newEnquiries,
    invoicedLaari: invoices ? (invoices.total ?? 0) : null,
    paymentsLaari: payments === null ? null : (payments ?? 0),
    outstandingLaari: invoices
      ? Math.max(0, (invoices.total ?? 0) - (invoices.paid ?? 0))
      : null,
  };
}
