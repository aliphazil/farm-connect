import "server-only";

import {
  AggregateField,
  type DocumentSnapshot,
  type Query,
} from "firebase-admin/firestore";
import { SYSTEM_ACTOR } from "@shared/constants/admin";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@shared/constants/catalog";
import { ATOLLS, type AtollCode } from "@shared/constants/geography";
import type { LocalizedText } from "@shared/constants/locales";
import type { AccountStatus, Role } from "@shared/constants/roles";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";
import { dictionaries } from "@shared/i18n";
import { queryTokens } from "@shared/search";
import { normalizeMvPhone } from "@shared/utils/phone";
import {
  adminLogSchema,
  consumerProfileSchema,
  farmerProfileSchema,
  enforcementActionSchema,
  fraudReportSchema,
  OPEN_REPORT_STATUSES,
  reportMessageSchema,
  reportNoteSchema,
  type EnforcementAction,
  type ReportMessage,
  type ReportNote,
  productSchema,
  userSchema,
  type AdminLog,
  type AdminLogAction,
  type ConsumerProfile,
  type FarmerApprovalStatus,
  type FarmerProfile,
  type FraudReport,
  type Product,
  type ProductModeration,
  type ProductStatus,
  type ReportStatus,
  type UserAccount,
} from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getTrafficTotals } from "./analytics";
import { BOOTSTRAP_ACTOR, col, snapToModel } from "./db";

/**
 * Read models for the admin portal (Admin SDK, server only). Callers must
 * have checked the admin session first. Every figure comes from a real query;
 * a figure that fails to load is null and shown as "—", never estimated.
 */

export const ADMIN_PAGE_SIZE = 20;
/** Upper bound when a name search has to scan accounts in memory. */
const NAME_SCAN_LIMIT = 500;

async function safe<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error("Admin query failed", error);
    return null;
  }
}

const count = async (q: Query) => (await q.count().get()).data().count;

async function cursorFor(
  collection: string,
  id: string | undefined,
): Promise<DocumentSnapshot | undefined> {
  if (!id) return undefined;
  const snap = await getAdminDb().collection(collection).doc(id).get();
  return snap.exists ? snap : undefined;
}

/** Runs a paged query: one extra document tells us whether there's a next page. */
async function page<T>(
  q: Query,
  collection: string,
  after: string | undefined,
  parse: (d: DocumentSnapshot) => T | null,
  size = ADMIN_PAGE_SIZE,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const cursor = await cursorFor(collection, after);
  const snap = await (cursor ? q.startAfter(cursor) : q).limit(size + 1).get();
  const docs = snap.docs.slice(0, size);
  return {
    items: docs.map(parse).filter((x): x is T => x !== null),
    nextCursor: snap.size > size ? docs[docs.length - 1].id : null,
  };
}

function tryParse<T>(fn: () => T | null): T | null {
  try {
    return fn();
  } catch {
    return null; // skip malformed records rather than failing the page
  }
}

/** Display names for actor ids in histories. */
async function actorNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>([
    [SYSTEM_ACTOR, "System"],
    [BOOTSTRAP_ACTOR, "Command-line script"],
  ]);
  const unknown = [...new Set(ids)].filter((id) => !names.has(id));
  if (unknown.length) {
    const snaps = await getAdminDb().getAll(
      ...unknown.map((id) => col(COLLECTIONS.users).doc(id)),
    );
    for (const s of snaps)
      names.set(s.id, (s.get("displayName") as string) ?? s.id);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DateRange = { from: Date | null; to: Date };

export type AdminStats = {
  users: {
    total: number | null;
    farmers: number | null;
    consumers: number | null;
    admins: number | null;
    newInRange: number | null;
  };
  farmersPending: number | null;
  products: {
    total: number | null;
    active: number | null;
    pendingReview: number | null;
  };
  productViews: number | null;
  visits: number | null;
  enquiries: number | null;
  contactClicks: number | null;
  reportsAwaiting: number | null;
  invoices: { count: number | null; totalLaari: number | null };
  payments: {
    count: number | null;
    totalLaari: number | null;
    verifiedLaari: number | null;
  };
  accounts: {
    suspended: number | null;
    suspensionsEnded: number | null;
    blocked: number | null;
  };
};

function inRange(q: Query, field: string, range: DateRange): Query {
  let r = q.where(field, "<=", range.to);
  if (range.from) r = r.where(field, ">=", range.from);
  return r;
}

export async function getAdminStats(range: DateRange): Promise<AdminStats> {
  const users = col(COLLECTIONS.users);
  const products = col(COLLECTIONS.products);

  const [
    total,
    farmers,
    consumers,
    admins,
    newInRange,
    farmersPending,
    productTotal,
    productActive,
    pendingReview,
    traffic,
    enquiries,
    reportsAwaiting,
    invoices,
    payments,
    verified,
    suspended,
    suspensionsEnded,
    blocked,
  ] = await Promise.all([
    safe(() => count(users)),
    safe(() => count(users.where("role", "==", "farmer"))),
    safe(() => count(users.where("role", "==", "consumer"))),
    safe(() => count(users.where("role", "==", "admin"))),
    safe(() => count(inRange(users, "createdAt", range))),
    safe(() =>
      count(
        col(COLLECTIONS.farmerProfiles).where(
          "approvalStatus",
          "==",
          "pending",
        ),
      ),
    ),
    safe(() => count(products)),
    safe(() => count(products.where("isPublic", "==", true))),
    safe(() => count(products.where("moderation", "==", "pending"))),
    // Website activity comes from the analytics counters.
    safe(() => getTrafficTotals(range)),
    safe(() => count(inRange(col(COLLECTIONS.enquiries), "createdAt", range))),
    safe(() =>
      count(
        col(COLLECTIONS.reports).where("status", "in", ["open", "reviewing"]),
      ),
    ),
    safe(async () => {
      const d = (
        await inRange(
          col(COLLECTIONS.invoices).where("status", "in", [
            "issued",
            "partially_paid",
            "paid",
          ]),
          "issuedAt",
          range,
        )
          .aggregate({
            n: AggregateField.count(),
            total: AggregateField.sum("totalLaari"),
          })
          .get()
      ).data();
      return { count: d.n, totalLaari: d.total };
    }),
    safe(async () => {
      const d = (
        await inRange(
          col(COLLECTIONS.payments).where("kind", "==", "payment"),
          "receivedAt",
          range,
        )
          .aggregate({
            n: AggregateField.count(),
            total: AggregateField.sum("effectiveLaari"),
          })
          .get()
      ).data();
      return { count: d.n, totalLaari: d.total };
    }),
    safe(
      async () =>
        (
          await inRange(
            col(COLLECTIONS.payments)
              .where("kind", "==", "payment")
              .where("verificationStatus", "==", "verified"),
            "receivedAt",
            range,
          )
            .aggregate({ total: AggregateField.sum("effectiveLaari") })
            .get()
        ).data().total,
    ),
    safe(() => count(users.where("status", "==", "suspended"))),
    safe(() =>
      count(
        users
          .where("status", "==", "suspended")
          .where("suspendedUntil", "<=", new Date()),
      ),
    ),
    safe(() => count(users.where("status", "==", "blocked"))),
  ]);

  return {
    users: { total, farmers, consumers, admins, newInRange },
    farmersPending,
    products: { total: productTotal, active: productActive, pendingReview },
    productViews: traffic?.productViews ?? null,
    visits: traffic?.sessions ?? null,
    enquiries,
    contactClicks: traffic?.contactClicks ?? null,
    reportsAwaiting,
    invoices: invoices ?? { count: null, totalLaari: null },
    payments: {
      count: payments?.count ?? null,
      totalLaari: payments?.totalLaari ?? null,
      verifiedLaari: verified,
    },
    accounts: { suspended, suspensionsEnded, blocked },
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  uid: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: Role;
  status: AccountStatus;
  restrictions: string[];
  suspendedUntil?: Date;
  createdAt: Date;
  farm?: {
    farmName: LocalizedText;
    approvalStatus: FarmerApprovalStatus;
    atollCode: AtollCode;
    islandId: string;
  };
};

export type UserFilters = {
  role: "farmer" | "consumer";
  status?: AccountStatus;
  approval?: FarmerApprovalStatus;
  q?: string;
  after?: string;
};

function toRow(user: UserAccount, farm?: FarmerProfile | null): AdminUserRow {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    restrictions: user.restrictions ?? [],
    suspendedUntil: user.suspendedUntil,
    createdAt: user.createdAt,
    farm: farm
      ? {
          farmName: farm.farmName,
          approvalStatus: farm.approvalStatus,
          atollCode: farm.location.atollCode,
          islandId: farm.location.islandId,
        }
      : undefined,
  };
}

async function withFarms(users: UserAccount[]): Promise<AdminUserRow[]> {
  const farmers = users.filter((u) => u.role === "farmer");
  const farms = farmers.length
    ? await getAdminDb().getAll(
        ...farmers.map((u) => col(COLLECTIONS.farmerProfiles).doc(u.uid)),
      )
    : [];
  const byId = new Map(
    farms.map((s) => [
      s.id,
      tryParse(() => snapToModel(farmerProfileSchema, s, "uid")),
    ]),
  );
  return users.map((u) => toRow(u, byId.get(u.uid)));
}

const parseUser = (d: DocumentSnapshot) =>
  tryParse(() => snapToModel(userSchema, d, "uid"));

export async function listUsers(f: UserFilters): Promise<{
  items: AdminUserRow[];
  nextCursor: string | null;
  /** Name search scanned only the most recent accounts. */
  scanLimited: boolean;
}> {
  const q = f.q?.trim();

  // Exact lookups first: email, phone, or account id.
  if (q) {
    const matches: UserAccount[] = [];
    if (q.includes("@")) {
      const authUser = await getAdminAuth()
        .getUserByEmail(q)
        .catch(() => null);
      if (authUser) {
        const u = parseUser(
          await col(COLLECTIONS.users).doc(authUser.uid).get(),
        );
        if (u) matches.push(u);
      }
    } else if (normalizeMvPhone(q)) {
      const snap = await col(COLLECTIONS.users)
        .where("phone", "==", normalizeMvPhone(q))
        .limit(10)
        .get();
      matches.push(...snap.docs.map(parseUser).filter((u) => u !== null));
    } else if (/^[A-Za-z0-9]{20,128}$/.test(q)) {
      const u = parseUser(await col(COLLECTIONS.users).doc(q).get());
      if (u) matches.push(u);
    }
    if (matches.length) {
      const filtered = matches.filter(
        (u) => u.role === f.role && (!f.status || u.status === f.status),
      );
      return {
        items: await withFarms(filtered),
        nextCursor: null,
        scanLimited: false,
      };
    }
  }

  // Farmers by approval status: page through farm profiles.
  if (f.role === "farmer" && f.approval && !q) {
    const fq: Query = col(COLLECTIONS.farmerProfiles)
      .where("approvalStatus", "==", f.approval)
      .orderBy("createdAt", "desc");
    const res = await page(fq, COLLECTIONS.farmerProfiles, f.after, (d) => d);
    const userSnaps = res.items.length
      ? await getAdminDb().getAll(
          ...res.items.map((d) => col(COLLECTIONS.users).doc(d.id)),
        )
      : [];
    let users = userSnaps.map(parseUser).filter((u) => u !== null);
    if (f.status) users = users.filter((u) => u.status === f.status);
    return {
      items: await withFarms(users),
      nextCursor: res.nextCursor,
      scanLimited: false,
    };
  }

  let base: Query = col(COLLECTIONS.users).where("role", "==", f.role);
  if (f.status) base = base.where("status", "==", f.status);
  base = base.orderBy("createdAt", "desc");

  if (q) {
    // Name/email contains: Firestore has no text search, so scan the most
    // recent accounts and say so when the limit is reached.
    const needle = q.toLowerCase();
    const snap = await base.limit(NAME_SCAN_LIMIT).get();
    const users = snap.docs
      .map(parseUser)
      .filter(
        (u): u is UserAccount =>
          !!u &&
          (u.displayName.toLowerCase().includes(needle) ||
            (u.email ?? "").toLowerCase().includes(needle)),
      )
      .slice(0, 100);
    let rows = await withFarms(users);
    if (f.approval)
      rows = rows.filter((r) => r.farm?.approvalStatus === f.approval);
    return {
      items: rows,
      nextCursor: null,
      scanLimited: snap.size === NAME_SCAN_LIMIT,
    };
  }

  const res = await page(base, COLLECTIONS.users, f.after, parseUser);
  return {
    items: await withFarms(res.items),
    nextCursor: res.nextCursor,
    scanLimited: false,
  };
}

export type HistoryEntry = AdminLog & { actorName: string };

export type AdminUserDetail = {
  user: UserAccount;
  auth: {
    emailVerified: boolean;
    disabled: boolean;
    lastSignIn?: string;
    adminLevel?: string;
  } | null;
  farm: FarmerProfile | null;
  consumer: ConsumerProfile | null;
  counts: {
    products: number | null;
    enquiriesSent: number | null;
    enquiriesReceived: number | null;
  };
  reportsAbout: FraudReport[];
  reportsBy: FraudReport[];
  history: HistoryEntry[];
};

async function historyFor(targetId: string): Promise<HistoryEntry[]> {
  const snap = await col(COLLECTIONS.adminLogs)
    .where("targetId", "==", targetId)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const logs = snap.docs
    .map((d) => tryParse(() => snapToModel(adminLogSchema, d)))
    .filter((l): l is AdminLog => l !== null);
  const names = await actorNames(logs.map((l) => l.actorId));
  return logs.map((l) => ({
    ...l,
    actorName: names.get(l.actorId) ?? l.actorId,
  }));
}

async function reportsWhere(field: string, value: string) {
  const snap = await col(COLLECTIONS.reports)
    .where(field, "==", value)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs
    .map((d) => tryParse(() => snapToModel(fraudReportSchema, d)))
    .filter((r): r is FraudReport => r !== null);
}

export async function getUserDetail(
  uid: string,
): Promise<AdminUserDetail | null> {
  const user = parseUser(await col(COLLECTIONS.users).doc(uid).get());
  if (!user) return null;
  const [
    authUser,
    farmSnap,
    consumerSnap,
    products,
    sent,
    received,
    about,
    by,
    history,
  ] = await Promise.all([
    getAdminAuth()
      .getUser(uid)
      .catch(() => null),
    col(COLLECTIONS.farmerProfiles).doc(uid).get(),
    col(COLLECTIONS.consumerProfiles).doc(uid).get(),
    safe(() => count(col(COLLECTIONS.products).where("farmerId", "==", uid))),
    safe(() =>
      count(col(COLLECTIONS.enquiries).where("consumerId", "==", uid)),
    ),
    safe(() => count(col(COLLECTIONS.enquiries).where("farmerId", "==", uid))),
    reportsAboutUser(uid),
    reportsWhere("reporterId", uid),
    historyFor(uid),
  ]);
  return {
    user,
    auth: authUser
      ? {
          emailVerified: authUser.emailVerified,
          disabled: authUser.disabled,
          lastSignIn: authUser.metadata.lastSignInTime || undefined,
          adminLevel:
            typeof authUser.customClaims?.adminLevel === "string"
              ? authUser.customClaims.adminLevel
              : undefined,
        }
      : null,
    farm: tryParse(() => snapToModel(farmerProfileSchema, farmSnap, "uid")),
    consumer: tryParse(() =>
      snapToModel(consumerProfileSchema, consumerSnap, "uid"),
    ),
    counts: { products, enquiriesSent: sent, enquiriesReceived: received },
    reportsAbout: about,
    reportsBy: by,
    history,
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type ProductFilters = {
  moderation?: ProductModeration;
  status?: ProductStatus;
  /** Only listings with open or in-review reports. */
  reported?: boolean;
  q?: string;
  farmerId?: string;
  after?: string;
};

export type AdminProductRow = Product & {
  farmName: LocalizedText | null;
  openReports: number;
  featured: boolean;
};

async function getFeaturedIds() {
  const snap = await col(COLLECTIONS.siteSettings)
    .doc(SITE_SETTINGS_DOCS.featured)
    .get();
  return {
    productIds: (snap.get("productIds") as string[] | undefined) ?? [],
    farmerIds: (snap.get("farmerIds") as string[] | undefined) ?? [],
  };
}

async function openReportCounts(): Promise<Map<string, number>> {
  const snap = await col(COLLECTIONS.reports)
    .where("status", "in", ["open", "reviewing"])
    .limit(1000)
    .get();
  const counts = new Map<string, number>();
  for (const d of snap.docs) {
    const id = d.get("targetId") as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

const parseProduct = (d: DocumentSnapshot) =>
  tryParse(() => snapToModel(productSchema, d));

async function decorate(products: Product[], reports: Map<string, number>) {
  const [featured, farmSnaps] = await Promise.all([
    getFeaturedIds(),
    products.length
      ? getAdminDb().getAll(
          ...[...new Set(products.map((p) => p.farmerId))].map((id) =>
            col(COLLECTIONS.farmerProfiles).doc(id),
          ),
        )
      : Promise.resolve([]),
  ]);
  const farmNames = new Map(
    farmSnaps.map((s) => [s.id, (s.get("farmName") as LocalizedText) ?? null]),
  );
  return products.map((p) => ({
    ...p,
    farmName: farmNames.get(p.farmerId) ?? null,
    openReports: reports.get(p.id) ?? 0,
    featured: featured.productIds.includes(p.id),
  }));
}

export async function listProductsAdmin(f: ProductFilters): Promise<{
  items: AdminProductRow[];
  nextCursor: string | null;
}> {
  const reports = await openReportCounts();

  if (f.reported) {
    const ids = [...reports.keys()];
    const snaps = ids.length
      ? await getAdminDb().getAll(
          ...ids.slice(0, 100).map((id) => col(COLLECTIONS.products).doc(id)),
        )
      : [];
    const products = snaps
      .map(parseProduct)
      .filter((p): p is Product => p !== null)
      .sort((a, b) => (reports.get(b.id) ?? 0) - (reports.get(a.id) ?? 0));
    return { items: await decorate(products, reports), nextCursor: null };
  }

  let q: Query = col(COLLECTIONS.products);
  if (f.farmerId) q = q.where("farmerId", "==", f.farmerId);
  if (f.moderation) q = q.where("moderation", "==", f.moderation);
  if (f.status) q = q.where("status", "==", f.status);
  const token = f.q ? queryTokens(f.q).primary : null;
  if (token) q = q.where("searchTokens", "array-contains", token);
  q = q.orderBy("createdAt", "desc");

  const res = await page(q, COLLECTIONS.products, f.after, parseProduct);
  return {
    items: await decorate(res.items, reports),
    nextCursor: res.nextCursor,
  };
}

export type AdminProductDetail = {
  product: AdminProductRow;
  farmer: { uid: string; displayName?: string; status?: string } | null;
  reports: FraudReport[];
  history: HistoryEntry[];
};

export async function getProductDetail(
  id: string,
): Promise<AdminProductDetail | null> {
  const product = parseProduct(await col(COLLECTIONS.products).doc(id).get());
  if (!product) return null;
  const [[row], userSnap, reports, history] = await Promise.all([
    decorate([product], await openReportCounts()),
    col(COLLECTIONS.users).doc(product.farmerId).get(),
    reportsWhere("targetId", id),
    historyFor(id),
  ]);
  return {
    product: row,
    farmer: userSnap.exists
      ? {
          uid: userSnap.id,
          displayName: userSnap.get("displayName"),
          status: userSnap.get("status"),
        }
      : null,
    reports,
    history,
  };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportFilters = {
  /** "awaiting" = pending, under review or awaiting information. */
  status?: ReportStatus | "awaiting";
  targetType?: FraudReport["targetType"];
  /** An admin uid, or "unassigned". */
  assignee?: string;
  after?: string;
};

export type AdminReportRow = FraudReport & {
  targetLabel: LocalizedText | string | null;
  reporterName: string;
};

export async function listReports(f: ReportFilters): Promise<{
  items: AdminReportRow[];
  nextCursor: string | null;
}> {
  let q: Query = col(COLLECTIONS.reports);
  if (f.targetType) q = q.where("targetType", "==", f.targetType);
  if (f.assignee)
    q = q.where(
      "assigneeId",
      "==",
      f.assignee === "unassigned" ? null : f.assignee,
    );
  if (f.status === "awaiting")
    q = q.where("status", "in", [...OPEN_REPORT_STATUSES]);
  else if (f.status) q = q.where("status", "==", f.status);
  q = q.orderBy("createdAt", "desc");
  const res = await page(q, COLLECTIONS.reports, f.after, (d) =>
    tryParse(() => snapToModel(fraudReportSchema, d)),
  );

  const db = getAdminDb();
  const refs = res.items.map((r) =>
    r.targetType === "product"
      ? col(COLLECTIONS.products).doc(r.targetId)
      : r.targetType === "farmer"
        ? col(COLLECTIONS.farmerProfiles).doc(r.targetId)
        : col(COLLECTIONS.users).doc(
            r.targetType === "enquiry"
              ? (r.reportedUserId ?? r.targetId)
              : r.targetId,
          ),
  );
  const [targets, names] = await Promise.all([
    refs.length ? db.getAll(...refs) : Promise.resolve([]),
    actorNames(res.items.map((r) => r.reporterId)),
  ]);
  return {
    items: res.items.map((r, i) => {
      const t = targets[i];
      const label = !t?.exists
        ? null
        : r.targetType === "product"
          ? (t.get("title") as LocalizedText)
          : r.targetType === "farmer"
            ? (t.get("farmName") as LocalizedText)
            : (t.get("displayName") as string);
      return {
        ...r,
        targetLabel: label,
        reporterName: names.get(r.reporterId) ?? r.reporterId,
      };
    }),
    nextCursor: res.nextCursor,
  };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function listAdminLogs(f: {
  action?: AdminLogAction;
  after?: string;
}): Promise<{ items: HistoryEntry[]; nextCursor: string | null }> {
  let q: Query = col(COLLECTIONS.adminLogs);
  if (f.action) q = q.where("action", "==", f.action);
  q = q.orderBy("createdAt", "desc");
  const res = await page(q, COLLECTIONS.adminLogs, f.after, (d) =>
    tryParse(() => snapToModel(adminLogSchema, d)),
  );
  const names = await actorNames(res.items.map((l) => l.actorId));
  return {
    items: res.items.map((l) => ({
      ...l,
      actorName: names.get(l.actorId) ?? l.actorId,
    })),
    nextCursor: res.nextCursor,
  };
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export type ReferenceRow = {
  id: string;
  label: { en: string; dv: string };
  defaultLabel: { en: string; dv: string };
  active: boolean;
};

async function referenceRows(
  kind: "category" | "unit",
): Promise<ReferenceRow[]> {
  const ids: readonly string[] =
    kind === "category" ? PRODUCT_CATEGORIES : PRODUCT_UNITS;
  const section = kind === "category" ? "categories" : "units";
  const snap = await col(
    kind === "category" ? COLLECTIONS.categories : COLLECTIONS.units,
  ).get();
  const docs = new Map(snap.docs.map((d) => [d.id, d]));
  return ids.map((id) => {
    const d = docs.get(id);
    const defaults = {
      en: (dictionaries.en[section] as Record<string, string>)[id],
      dv: (dictionaries.dv[section] as Record<string, string>)[id],
    };
    const label = (d?.get("label") as { en?: string; dv?: string }) ?? {};
    return {
      id,
      defaultLabel: defaults,
      label: { en: label.en || defaults.en, dv: label.dv || defaults.dv },
      active: d ? d.get("active") !== false : true,
    };
  });
}

export const listCategoriesAdmin = () => referenceRows("category");
export const listUnitsAdmin = () => referenceRows("unit");

export type IslandRow = {
  id: string;
  atollCode: AtollCode;
  nameEn: string;
  nameDv?: string;
  active: boolean;
};

export async function listIslandsAdmin(): Promise<IslandRow[]> {
  const snap = await col(COLLECTIONS.islands).get();
  const order = new Map(ATOLLS.map((a, i) => [a.code, i]));
  return snap.docs
    .map((d) => ({
      id: d.id,
      atollCode: d.get("atollCode") as AtollCode,
      nameEn: (d.get("nameEn") as string) ?? d.id,
      nameDv: (d.get("nameDv") as string | undefined) ?? undefined,
      active: d.get("active") !== false,
    }))
    .sort(
      (a, b) =>
        (order.get(a.atollCode) ?? 99) - (order.get(b.atollCode) ?? 99) ||
        a.nameEn.localeCompare(b.nameEn),
    );
}

export async function getModerationSettings() {
  const snap = await col(COLLECTIONS.siteSettings)
    .doc(SITE_SETTINGS_DOCS.moderation)
    .get();
  return {
    listingsRequireApproval: snap.get("listingsRequireApproval") === true,
    appealsEnabled: snap.get("appealsEnabled") !== false,
    allowAppealHold: snap.get("allowAppealHold") === true,
  };
}

export { getFeaturedIds };

// ---------------------------------------------------------------------------
// Report detail, enforcement and appeals
// ---------------------------------------------------------------------------

/** Reports about an account: new ones by reportedUserId, older ones by targetId. */
async function reportsAboutUser(uid: string): Promise<FraudReport[]> {
  const [a, b] = await Promise.all([
    reportsWhere("reportedUserId", uid),
    reportsWhere("targetId", uid),
  ]);
  const byId = new Map([...a, ...b].map((r) => [r.id, r]));
  return [...byId.values()].sort(
    (x, y) => y.createdAt.getTime() - x.createdAt.getTime(),
  );
}

export type AdminRef = { uid: string; name: string };

/** Administrators (for the assign menu). */
export async function listAdmins(): Promise<AdminRef[]> {
  const snap = await col(COLLECTIONS.users)
    .where("role", "==", "admin")
    .limit(50)
    .get();
  return snap.docs.map((d) => ({
    uid: d.id,
    name: (d.get("displayName") as string) ?? d.id,
  }));
}

export type AdminReportDetail = {
  report: FraudReport;
  reporter: { uid: string; name: string; role?: string; status?: string };
  reportedUser: {
    uid: string;
    name: string;
    role?: string;
    status?: string;
  } | null;
  product: { id: string; title: LocalizedText } | null;
  enquiry: {
    id: string;
    quantity: number;
    message?: string;
    status: string;
    createdAt: Date;
  } | null;
  messages: (ReportMessage & { authorName: string })[];
  notes: (ReportNote & { authorName: string })[];
  history: HistoryEntry[];
  assigneeName: string | null;
  admins: AdminRef[];
};

export async function getReportDetail(
  id: string,
): Promise<AdminReportDetail | null> {
  const ref = col(COLLECTIONS.reports).doc(id);
  const snap = await ref.get();
  const r = tryParse(() => snapToModel(fraudReportSchema, snap));
  if (!r) return null;
  const db = getAdminDb();
  const [
    userSnaps,
    productSnap,
    enquirySnap,
    msgSnap,
    noteSnap,
    history,
    admins,
  ] = await Promise.all([
    db.getAll(
      col(COLLECTIONS.users).doc(r.reporterId),
      col(COLLECTIONS.users).doc(r.reportedUserId ?? r.reporterId),
    ),
    r.productId ? col(COLLECTIONS.products).doc(r.productId).get() : null,
    r.enquiryId ? col(COLLECTIONS.enquiries).doc(r.enquiryId).get() : null,
    ref.collection("messages").orderBy("createdAt", "asc").limit(100).get(),
    ref.collection("notes").orderBy("createdAt", "desc").limit(100).get(),
    historyFor(id),
    listAdmins(),
  ]);
  const [reporterSnap, reportedSnap] = userSnaps;
  const messages = msgSnap.docs
    .map((d) => tryParse(() => snapToModel(reportMessageSchema, d)))
    .filter((m): m is ReportMessage => m !== null);
  const notes = noteSnap.docs
    .map((d) => tryParse(() => snapToModel(reportNoteSchema, d)))
    .filter((n): n is ReportNote => n !== null);
  const names = await actorNames([
    ...messages.map((m) => m.authorId),
    ...notes.map((n) => n.authorId),
    ...(r.assigneeId ? [r.assigneeId] : []),
  ]);
  const person = (s: FirebaseFirestore.DocumentSnapshot) => ({
    uid: s.id,
    name: (s.get("displayName") as string) ?? s.id,
    role: s.get("role") as string | undefined,
    status: s.get("status") as string | undefined,
  });
  return {
    report: r,
    reporter: person(reporterSnap),
    reportedUser:
      r.reportedUserId && reportedSnap.exists ? person(reportedSnap) : null,
    product: productSnap?.exists
      ? { id: productSnap.id, title: productSnap.get("title") as LocalizedText }
      : null,
    enquiry: enquirySnap?.exists
      ? {
          id: enquirySnap.id,
          quantity: enquirySnap.get("quantity"),
          message: enquirySnap.get("message"),
          status: enquirySnap.get("status"),
          createdAt: enquirySnap.get("createdAt")?.toDate?.() ?? new Date(0),
        }
      : null,
    messages: messages.map((m) => ({
      ...m,
      authorName: names.get(m.authorId) ?? m.authorId,
    })),
    notes: notes.map((n) => ({
      ...n,
      authorName: names.get(n.authorId) ?? n.authorId,
    })),
    history,
    assigneeName: r.assigneeId
      ? (names.get(r.assigneeId) ?? r.assigneeId)
      : null,
    admins,
  };
}

export type EnforcementRow = EnforcementAction & { createdByName: string };

const parseAction = (d: DocumentSnapshot) =>
  tryParse(() => snapToModel(enforcementActionSchema, d));

async function withActorNames(
  actions: EnforcementAction[],
): Promise<EnforcementRow[]> {
  const names = await actorNames(actions.map((a) => a.createdBy));
  return actions.map((a) => ({
    ...a,
    createdByName: names.get(a.createdBy) ?? a.createdBy,
  }));
}

/** An account's enforcement history (admin view, includes internal notes). */
export async function listEnforcementFor(
  uid: string,
): Promise<EnforcementRow[]> {
  const snap = await col(COLLECTIONS.enforcementActions)
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return withActorNames(
    snap.docs
      .map(parseAction)
      .filter((a): a is EnforcementAction => a !== null),
  );
}

export type AppealRow = EnforcementRow & {
  userName: string;
  userRole?: string;
};

/** Appeals waiting for a decision, oldest first. */
export async function listPendingAppeals(): Promise<AppealRow[]> {
  const snap = await col(COLLECTIONS.enforcementActions)
    .where("appeal.status", "==", "pending")
    .orderBy("appeal.submittedAt", "asc")
    .limit(100)
    .get();
  const actions = await withActorNames(
    snap.docs
      .map(parseAction)
      .filter((a): a is EnforcementAction => a !== null),
  );
  const users = actions.length
    ? await getAdminDb().getAll(
        ...[...new Set(actions.map((a) => a.userId))].map((id) =>
          col(COLLECTIONS.users).doc(id),
        ),
      )
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return actions.map((a) => ({
    ...a,
    userName: (byId.get(a.userId)?.get("displayName") as string) ?? a.userId,
    userRole: byId.get(a.userId)?.get("role") as string | undefined,
  }));
}
