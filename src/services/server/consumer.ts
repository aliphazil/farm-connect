import "server-only";

import type { ProductUnit } from "@shared/constants/catalog";
import type { LocalizedText } from "@shared/constants/locales";
import { COLLECTIONS } from "@shared/firestore-paths";
import {
  enquirySchema,
  farmerProfileSchema,
  favouriteSchema,
  fraudReportSchema,
  reportMessageSchema,
  type ReportMessage,
  invoiceSchema,
  paymentRecordSchema,
  productSchema,
  type Enquiry,
  type FraudReport,
  type Invoice,
  type PaymentRecord,
} from "@shared/schemas";
import { getFarmer, getListing } from "@/features/catalog/queries";
import type {
  FarmerDetail,
  ListingDetail,
  Place,
} from "@/features/catalog/types";
import { col, snapToModel } from "./db";
import { getIslandMap, toPlace } from "./farmer";

/**
 * The buyer's own records, read with the Admin SDK for the signed-in user
 * only (`uid` always comes from the verified session, never from input).
 * Every query filters on the owner field, so one buyer can never see another
 * buyer's records. Queries use equality filters only and sort in memory, so
 * they need no composite indexes.
 */

const newestFirst = <T extends { createdAt: Date }>(a: T, b: T) =>
  b.createdAt.getTime() - a.createdAt.getTime();

async function byOwner<T extends { createdAt: Date }>(
  collection: (typeof COLLECTIONS)[keyof typeof COLLECTIONS],
  field: string,
  uid: string,
  parse: (d: FirebaseFirestore.QueryDocumentSnapshot) => T | null,
): Promise<T[]> {
  const snap = await col(collection).where(field, "==", uid).get();
  return snap.docs
    .map(parse)
    .filter((x): x is T => x !== null)
    .sort(newestFirst);
}

// ---------- favourites ----------
export type SavedProduct = {
  favouriteId: string;
  productId: string;
  savedAt: Date;
  /** Null when the product is no longer public. Only public data is shown. */
  listing: ListingDetail | null;
};
export type SavedFarm = {
  favouriteId: string;
  farmerId: string;
  savedAt: Date;
  farm: FarmerDetail | null;
};

export async function listConsumerFavourites(uid: string) {
  const favs = await byOwner(COLLECTIONS.favourites, "userId", uid, (d) =>
    snapToModel(favouriteSchema, d),
  );
  const products: SavedProduct[] = [];
  const farms: SavedFarm[] = [];
  // Resolved through the public catalog, so hidden products and farms show
  // as "no longer available" rather than leaking their private details.
  await Promise.all(
    favs.map(async (f) => {
      if (f.targetType === "product")
        products.push({
          favouriteId: f.id,
          productId: f.targetId,
          savedAt: f.createdAt,
          listing: await getListing(f.targetId),
        });
      else
        farms.push({
          favouriteId: f.id,
          farmerId: f.targetId,
          savedAt: f.createdAt,
          farm: await getFarmer(f.targetId),
        });
    }),
  );
  const bySaved = (a: { savedAt: Date }, b: { savedAt: Date }) =>
    b.savedAt.getTime() - a.savedAt.getTime();
  return { products: products.sort(bySaved), farms: farms.sort(bySaved) };
}

// ---------- enquiries ----------
export type ConsumerEnquiry = Enquiry & {
  product: { title: LocalizedText; unit: ProductUnit } | null;
  farmName: LocalizedText | null;
  deliverToPlace: Place;
};

export async function listConsumerEnquiries(
  uid: string,
): Promise<ConsumerEnquiry[]> {
  const [enquiries, islands] = await Promise.all([
    byOwner(COLLECTIONS.enquiries, "consumerId", uid, (d) =>
      snapToModel(enquirySchema, d),
    ),
    getIslandMap(),
  ]);
  const productIds = [...new Set(enquiries.map((e) => e.productId))];
  const farmerIds = [...new Set(enquiries.map((e) => e.farmerId))];
  const [productSnaps, farmSnaps] = await Promise.all([
    productIds.length
      ? col(COLLECTIONS.products).firestore.getAll(
          ...productIds.map((id) => col(COLLECTIONS.products).doc(id)),
        )
      : [],
    farmerIds.length
      ? col(COLLECTIONS.farmerProfiles).firestore.getAll(
          ...farmerIds.map((id) => col(COLLECTIONS.farmerProfiles).doc(id)),
        )
      : [],
  ]);
  // Only the title/unit and farm name are passed on — the buyer already saw
  // them when enquiring. Nothing else from the farmer's records is exposed.
  const products = new Map(
    productSnaps.map((s) => [s.id, snapToModel(productSchema, s)] as const),
  );
  const farms = new Map(
    farmSnaps.map(
      (s) => [s.id, snapToModel(farmerProfileSchema, s, "uid")] as const,
    ),
  );
  return enquiries.map((e) => {
    const p = products.get(e.productId);
    return {
      ...e,
      product: p ? { title: p.title, unit: p.unit } : null,
      farmName: farms.get(e.farmerId)?.farmName ?? null,
      deliverToPlace: toPlace(
        islands,
        e.deliverTo.atollCode,
        e.deliverTo.islandId,
      ),
    };
  });
}

// ---------- invoices and payments ----------
export type ConsumerInvoice = Invoice & { farmName: LocalizedText | null };

export async function listConsumerFinance(uid: string): Promise<{
  invoices: ConsumerInvoice[];
  payments: (PaymentRecord & { invoiceNumber?: string })[];
}> {
  const [allInvoices, payments] = await Promise.all([
    byOwner(COLLECTIONS.invoices, "consumerId", uid, (d) =>
      snapToModel(invoiceSchema, d),
    ),
    byOwner(COLLECTIONS.payments, "consumerId", uid, (d) =>
      snapToModel(paymentRecordSchema, d),
    ),
  ]);
  // Drafts are the farmer's work in progress, not yet issued to the buyer.
  const invoices = allInvoices.filter((i) => i.status !== "draft");
  const farmerIds = [...new Set(invoices.map((i) => i.farmerId))];
  const farmSnaps = farmerIds.length
    ? await col(COLLECTIONS.farmerProfiles).firestore.getAll(
        ...farmerIds.map((id) => col(COLLECTIONS.farmerProfiles).doc(id)),
      )
    : [];
  const farms = new Map(
    farmSnaps.map(
      (s) =>
        [
          s.id,
          snapToModel(farmerProfileSchema, s, "uid")?.farmName ?? null,
        ] as const,
    ),
  );
  const numbers = new Map(allInvoices.map((i) => [i.id, i.number]));
  return {
    invoices: invoices.map((i) => ({
      ...i,
      farmName: farms.get(i.farmerId) ?? null,
    })),
    payments: payments.map((p) => ({
      ...p,
      invoiceNumber: numbers.get(p.invoiceId),
    })),
  };
}

// ---------- reports ----------
export type ConsumerReport = FraudReport & {
  targetLabel: LocalizedText | null;
  evidenceCount: number;
  messages: Pick<ReportMessage, "id" | "author" | "body" | "createdAt">[];
};

export async function listConsumerReports(
  uid: string,
): Promise<ConsumerReport[]> {
  const reports = await byOwner(COLLECTIONS.reports, "reporterId", uid, (d) =>
    snapToModel(fraudReportSchema, d),
  );
  return Promise.all(
    reports.map(async (r) => {
      const messages = await col(COLLECTIONS.reports)
        .doc(r.id)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .limit(50)
        .get();
      return {
        ...r,
        // Admin ids and decision internals aren't for the reporter.
        handledBy: undefined,
        assigneeId: undefined,
        enforcementActionId: undefined,
        evidenceCount: r.evidencePaths?.length ?? 0,
        evidencePaths: undefined,
        messages: messages.docs
          .map((d) => snapToModel(reportMessageSchema, d))
          .filter((m): m is ReportMessage => m !== null)
          .map(({ author, body, createdAt, id }) => ({
            id,
            author,
            body,
            createdAt,
          })),
        targetLabel:
          r.targetType === "product"
            ? ((await getListing(r.targetId))?.title ?? null)
            : r.targetType === "farmer"
              ? ((await getFarmer(r.targetId))?.farmName ?? null)
              : null,
      };
    }),
  );
}

// ---------- overview ----------
export async function getConsumerOverview(uid: string) {
  const count = async (
    collection: (typeof COLLECTIONS)[keyof typeof COLLECTIONS],
    field: string,
    extra?: [string, string[]],
  ) => {
    let q: FirebaseFirestore.Query = col(collection).where(field, "==", uid);
    if (extra) q = q.where(extra[0], "in", extra[1]);
    try {
      return (await q.count().get()).data().count;
    } catch (err) {
      console.error(err);
      return null;
    }
  };
  const [favourites, openEnquiries, invoices, openReports] = await Promise.all([
    count(COLLECTIONS.favourites, "userId"),
    count(COLLECTIONS.enquiries, "consumerId", ["status", ["new", "accepted"]]),
    count(COLLECTIONS.invoices, "consumerId", [
      "status",
      ["issued", "partially_paid", "paid"],
    ]),
    count(COLLECTIONS.reports, "reporterId", ["status", ["open", "reviewing"]]),
  ]);
  return { favourites, openEnquiries, invoices, openReports };
}
