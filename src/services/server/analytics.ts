import "server-only";

import { createHash } from "node:crypto";
import {
  FieldValue,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
} from "firebase-admin/firestore";
import type { LocalizedText } from "@shared/constants/locales";
import type { Role } from "@shared/constants/roles";
import { COLLECTIONS } from "@shared/firestore-paths";
import { emptyHll, hllAdd, hllEstimate, hllFrom, hllMerge } from "@shared/hll";
import {
  ANALYTICS_MAX_DAYS,
  ANALYTICS_SHARDS,
  DAILY_COUNTERS,
  DAILY_TALLIES,
  MARK_TTL_DAYS,
  type AnalyticsBatch,
  type AnalyticsEvent,
  type DailyCounter,
  type DailyTally,
} from "@shared/schemas";
import { maldivesDay, maldivesDayBoundary } from "@shared/utils/date";
import { getAdminDb } from "@/lib/firebase/admin";
import { col } from "./db";

/**
 * Marketplace analytics (definitions in shared/schemas/analytics.ts).
 *
 * Ingestion: the browser posts small batches to /api/events. Each event is
 * validated against real records (a product view must name a public
 * product; its farmer, category and island come from the product, never from
 * the browser), deduplicated with a short-lived marker, and added to daily
 * counters. Raw events and visitor ids are never stored: markers are keyed by
 * a one-way hash and expire after a few days.
 *
 * Storage per Maldives day:
 * - analyticsDaily/{day}/shards/{0..4}: counters and per-key tallies. Writes
 *   go to a random shard so busy days don't hit one document's write limit.
 * - analyticsDaily/{day}/hll/{0..4}: HyperLogLog registers for unique visitors
 *   across ranges (no identifiers, see shared/hll.ts).
 * - analyticsProductDaily/{day}_{productId}, analyticsFarmerDaily/{day}_{farmerId}:
 *   per-listing and per-farm counters for the farmer's own analytics.
 *
 * Dashboards read a fixed number of documents per day (independent of
 * traffic) plus the source records (enquiries, registrations, invoices,
 * payments, reports) for the period.
 */

const db = () => getAdminDb();
const DAY_MS = 24 * 60 * 60 * 1000;

const sha = (value: string) => createHash("sha256").update(value).digest();
const markKey = (...parts: string[]) =>
  sha(`fc-analytics|${parts.join("|")}`).toString("base64url");

const shardRef = (day: string, shard: number) =>
  col(COLLECTIONS.analyticsDaily)
    .doc(day)
    .collection("shards")
    .doc(String(shard));
const hllRef = (day: string, shard: number) =>
  col(COLLECTIONS.analyticsDaily).doc(day).collection("hll").doc(String(shard));
const productDailyRef = (day: string, productId: string) =>
  col(COLLECTIONS.analyticsProductDaily).doc(`${day}_${productId}`);
const farmerDailyRef = (day: string, farmerId: string) =>
  col(COLLECTIONS.analyticsFarmerDaily).doc(`${day}_${farmerId}`);
const markRef = (key: string) => col(COLLECTIONS.analyticsMarks).doc(key);

const randomShard = () => Math.floor(Math.random() * ANALYTICS_SHARDS);
const inc = (n = 1) => FieldValue.increment(n);

// ---------------------------------------------------------------------------
// Reference lookups (cached briefly in memory)
// ---------------------------------------------------------------------------

type ProductMeta = {
  farmerId: string;
  category: string;
  islandId?: string;
};

function memo<T>(ttlMs: number, max: number, load: (id: string) => Promise<T>) {
  const cache = new Map<string, { at: number; value: T }>();
  const fn = async (id: string): Promise<T> => {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = await load(id);
    if (cache.size >= max) cache.delete(cache.keys().next().value!);
    cache.set(id, { at: Date.now(), value });
    return value;
  };
  fn.clear = () => cache.clear();
  return fn;
}

const productMeta = memo<ProductMeta | null>(60_000, 5000, async (id) => {
  const snap = await col(COLLECTIONS.products).doc(id).get();
  if (!snap.exists || snap.get("isPublic") !== true) return null;
  return {
    farmerId: snap.get("farmerId") as string,
    category: snap.get("category") as string,
    islandId: snap.get("location.islandId") as string | undefined,
  };
});

const farmerIsPublic = memo<boolean>(60_000, 5000, async (id) => {
  const snap = await col(COLLECTIONS.farmerProfiles).doc(id).get();
  return (
    snap.exists &&
    snap.get("approvalStatus") === "approved" &&
    snap.get("visible") === true
  );
});

const islandExists = memo<boolean>(10 * 60_000, 2000, async (id) => {
  const snap = await col(COLLECTIONS.islands).doc(id).get();
  return snap.exists;
});

/** For tests: forget cached lookups. */
export function clearAnalyticsCaches() {
  productMeta.clear();
  farmerIsPublic.clear();
  islandExists.clear();
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

export type Viewer = { uid: string; role: Role | null } | null;

export type IngestResult = {
  counted: number;
  duplicates: number;
  ignored: number;
};

type EntityIncrements = Partial<
  Record<
    | "productViews"
    | "profileViews"
    | "contactClicks"
    | "contactCall"
    | "contactWhatsapp"
    | "contactViber",
    number
  >
>;

type Plan = {
  /** Duplicate marker; the whole write is skipped if it already exists. */
  mark?: string;
  counters: Partial<Record<DailyCounter, number>>;
  tallies?: [DailyTally, string][];
  product?: { id: string; farmerId: string; add: EntityIncrements };
  farmer?: { id: string; add: EntityIncrements };
};

const CHANNEL_COUNTER = {
  call: "contactCall",
  whatsapp: "contactWhatsapp",
  viber: "contactViber",
} as const;

async function plan(
  event: AnalyticsEvent,
  day: string,
  visitor: string,
  viewer: Viewer,
): Promise<Plan[] | null> {
  const own = (farmerId: string) => viewer?.uid === farmerId;
  switch (event.type) {
    case "page_view":
      return [{ counters: { pageViews: 1 } }];
    case "product_view": {
      const meta = await productMeta(event.productId);
      if (!meta || own(meta.farmerId)) return null;
      return [
        {
          mark: markKey("pv", day, visitor, event.productId),
          counters: { productViews: 1 },
          tallies: [
            ["productViews", event.productId],
            ["categoryViews", meta.category],
            ...(meta.islandId
              ? [["islandViews", meta.islandId] as [DailyTally, string]]
              : []),
          ],
          product: {
            id: event.productId,
            farmerId: meta.farmerId,
            add: { productViews: 1 },
          },
          farmer: { id: meta.farmerId, add: { productViews: 1 } },
        },
      ];
    }
    case "farmer_view": {
      if (own(event.farmerId) || !(await farmerIsPublic(event.farmerId)))
        return null;
      return [
        {
          mark: markKey("fv", day, visitor, event.farmerId),
          counters: { farmerViews: 1 },
          tallies: [["farmerViews", event.farmerId]],
          farmer: { id: event.farmerId, add: { profileViews: 1 } },
        },
      ];
    }
    case "search": {
      const words = event.q.toLowerCase().replace(/\s+/g, " ").trim();
      return [
        {
          mark: markKey("sq", day, visitor, words),
          counters: {
            searches: 1,
            ...(event.noResults ? { searchesNoResults: 1 } : {}),
          },
        },
      ];
    }
    case "filter": {
      const plans: Plan[] = [];
      if (event.category)
        plans.push({
          mark: markKey("fc", day, visitor, event.category),
          counters: { filterUses: 1 },
          tallies: [["categoryFilters", event.category]],
        });
      if (event.atoll)
        plans.push({
          mark: markKey("fa", day, visitor, event.atoll),
          counters: { filterUses: 1 },
          tallies: [["atollFilters", event.atoll]],
        });
      if (event.island && (await islandExists(event.island)))
        plans.push({
          mark: markKey("fi", day, visitor, event.island),
          counters: { filterUses: 1 },
          tallies: [["islandFilters", event.island]],
        });
      return plans.length ? plans : null;
    }
    case "contact_click": {
      const channel = CHANNEL_COUNTER[event.channel];
      const add: EntityIncrements = { contactClicks: 1, [channel]: 1 };
      if (event.productId) {
        const meta = await productMeta(event.productId);
        if (!meta || own(meta.farmerId)) return null;
        if (event.farmerId && event.farmerId !== meta.farmerId) return null;
        return [
          {
            mark: markKey("cc", day, visitor, event.productId, event.channel),
            counters: { contactClicks: 1, [channel]: 1 },
            tallies: [["productClicks", event.productId]],
            product: { id: event.productId, farmerId: meta.farmerId, add },
            farmer: { id: meta.farmerId, add },
          },
        ];
      }
      if (
        !event.farmerId ||
        own(event.farmerId) ||
        !(await farmerIsPublic(event.farmerId))
      )
        return null;
      return [
        {
          mark: markKey("cf", day, visitor, event.farmerId, event.channel),
          counters: { contactClicks: 1, [channel]: 1 },
          farmer: { id: event.farmerId, add },
        },
      ];
    }
  }
}

function expireAt(now: Date) {
  return new Date(now.getTime() + MARK_TTL_DAYS * DAY_MS);
}

function isAlreadyExists(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

/** Applies one plan atomically. False if it was a duplicate. */
async function commit(plan: Plan, day: string, now: Date): Promise<boolean> {
  const batch = db().batch();
  if (plan.mark) batch.create(markRef(plan.mark), { expireAt: expireAt(now) });

  const counts = Object.fromEntries(
    Object.entries(plan.counters).map(([k, n]) => [k, inc(n)]),
  );
  const tallies: Record<string, Record<string, FieldValue>> = {};
  for (const [tally, key] of plan.tallies ?? [])
    (tallies[tally] ??= {})[key] = inc();
  batch.set(
    shardRef(day, randomShard()),
    { day, counts, ...(plan.tallies ? { tallies } : {}) },
    { merge: true },
  );

  const entity = (add: EntityIncrements) =>
    Object.fromEntries(Object.entries(add).map(([k, n]) => [k, inc(n)]));
  if (plan.product)
    batch.set(
      productDailyRef(day, plan.product.id),
      {
        day,
        productId: plan.product.id,
        farmerId: plan.product.farmerId,
        ...entity(plan.product.add),
      },
      { merge: true },
    );
  if (plan.farmer)
    batch.set(
      farmerDailyRef(day, plan.farmer.id),
      { day, farmerId: plan.farmer.id, ...entity(plan.farmer.add) },
      { merge: true },
    );

  try {
    await batch.commit();
    return true;
  } catch (error) {
    if (isAlreadyExists(error)) return false;
    throw error;
  }
}

/** First time this visitor is seen today: count them and update the sketch. */
async function countVisitor(day: string, visitor: string, now: Date) {
  const mark = markRef(markKey("vd", day, visitor));
  const shard = randomShard();
  return db().runTransaction(async (tx) => {
    const [seen, sketch] = await Promise.all([
      tx.get(mark),
      tx.get(hllRef(day, shard)),
    ]);
    if (seen.exists) return false;
    const registers = hllFrom(sketch.get("r"));
    // Day-independent hash so the same browser on two days counts once in
    // a range; only a register maximum is kept, never the hash itself.
    const changed = hllAdd(registers, sha(`fc-visitor|${visitor}`));
    tx.create(mark, { expireAt: expireAt(now) });
    tx.set(
      shardRef(day, shard),
      { day, counts: { visitors: inc() } },
      { merge: true },
    );
    if (changed) tx.set(hllRef(day, shard), { r: Buffer.from(registers) });
    return true;
  });
}

/**
 * Records a validated batch from one browser. Admins' own browsing isn't
 * counted, and farmers' views and clicks on their own listings aren't either.
 */
export async function recordEvents(
  batch: AnalyticsBatch,
  { now, viewer }: { now: Date; viewer: Viewer },
): Promise<IngestResult> {
  const result: IngestResult = { counted: 0, duplicates: 0, ignored: 0 };
  if (viewer?.role === "admin") {
    result.ignored = batch.events.length;
    return result;
  }
  const day = maldivesDay(now);

  if (batch.newDay) await countVisitor(day, batch.v, now);
  if (batch.newSession)
    await commit(
      { mark: markKey("se", batch.s), counters: { sessions: 1 } },
      day,
      now,
    );

  for (const event of batch.events) {
    const plans = await plan(event, day, batch.v, viewer);
    if (!plans) {
      result.ignored++;
      continue;
    }
    let counted = false;
    for (const p of plans) if (await commit(p, day, now)) counted = true;
    if (counted) result.counted++;
    else result.duplicates++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export type DayRange = { from: Date; to: Date };

/** Maldives days from `from` to `to` inclusive (capped at ANALYTICS_MAX_DAYS). */
export function daysInRange({ from, to }: DayRange): string[] {
  const days: string[] = [];
  const last = maldivesDay(to);
  let cursor = maldivesDayBoundary(maldivesDay(from), "start")!;
  while (days.length < ANALYTICS_MAX_DAYS) {
    const day = maldivesDay(cursor);
    days.push(day);
    if (day >= last) break;
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return days;
}

type Counters = Record<DailyCounter, number>;
type Tallies = Record<DailyTally, Record<string, number>>;

const zeroCounters = (): Counters =>
  Object.fromEntries(DAILY_COUNTERS.map((c) => [c, 0])) as Counters;
const emptyTallies = (): Tallies =>
  Object.fromEntries(DAILY_TALLIES.map((t) => [t, {}])) as Tallies;

async function getAllChunked(refs: DocumentReference[]) {
  const out: DocumentSnapshot[] = [];
  for (let i = 0; i < refs.length; i += 300)
    out.push(...(await db().getAll(...refs.slice(i, i + 300))));
  return out;
}

/** Counters per day, tallies and the merged visitor sketch for a range. */
async function readDays(days: string[]) {
  const shardRefs = days.flatMap((day) =>
    Array.from({ length: ANALYTICS_SHARDS }, (_, n) => shardRef(day, n)),
  );
  const sketchRefs = days.flatMap((day) =>
    Array.from({ length: ANALYTICS_SHARDS }, (_, n) => hllRef(day, n)),
  );
  const [shards, sketches] = await Promise.all([
    getAllChunked(shardRefs),
    getAllChunked(sketchRefs),
  ]);

  const perDay = new Map(days.map((d) => [d, zeroCounters()]));
  const tallies = emptyTallies();
  for (const snap of shards) {
    if (!snap.exists) continue;
    const day = snap.get("day") as string;
    const target = perDay.get(day);
    if (!target) continue;
    const counts = (snap.get("counts") ?? {}) as Record<string, number>;
    for (const c of DAILY_COUNTERS) target[c] += Number(counts[c] ?? 0);
    const t = (snap.get("tallies") ?? {}) as Record<
      string,
      Record<string, number>
    >;
    for (const name of DAILY_TALLIES)
      for (const [key, n] of Object.entries(t[name] ?? {}))
        tallies[name][key] = (tallies[name][key] ?? 0) + Number(n);
  }
  const registers = emptyHll();
  for (const snap of sketches)
    if (snap.exists) hllMerge(registers, hllFrom(snap.get("r")));

  const totals = zeroCounters();
  for (const c of perDay.values())
    for (const k of DAILY_COUNTERS) totals[k] += c[k];
  return { perDay, totals, tallies, registers, docsRead: shards.length * 2 };
}

const top = (tally: Record<string, number>, n = 10) =>
  Object.entries(tally)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);

function inRange(q: Query, field: string, { from, to }: DayRange) {
  return q.where(field, ">=", from).where(field, "<=", to);
}

const dayOf = (value: unknown) =>
  value && typeof (value as { toDate?: unknown }).toDate === "function"
    ? maldivesDay((value as { toDate: () => Date }).toDate())
    : null;

async function safe<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error("Analytics figure failed", error);
    return null;
  }
}

export type SeriesPoint = {
  day: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  productViews: number;
  contactClicks: number;
  enquiries: number;
  farmers: number;
  consumers: number;
  reportsOpened: number;
  reportsClosed: number;
};

export type NamedCount = {
  id: string;
  name: LocalizedText | null;
  views: number;
  clicks?: number;
  filterUses?: number;
  enquiries?: number;
};

export type SiteAnalytics = {
  days: string[];
  /** Exact for a single day; a HyperLogLog estimate across several days. */
  uniqueVisitors: { value: number; exact: boolean };
  totals: Counters;
  series: SeriesPoint[];
  topProducts: NamedCount[];
  categories: NamedCount[];
  islands: NamedCount[];
  atollFilters: { id: string; count: number }[];
  enquiries: number | null;
  registrations: { farmers: number; consumers: number } | null;
  activeFarmers: { withListings: number; withEnquiries: number | null } | null;
  reports: {
    opened: number;
    closed: number;
    openNow: number | null;
    byReason: { id: string; count: number }[];
    enforcement: { id: string; count: number }[];
  } | null;
  invoices: { count: number; totalLaari: number; cancelled: number } | null;
  payments: {
    count: number;
    totalLaari: number;
    verifiedLaari: number;
    pendingLaari: number;
    rejectedLaari: number;
    refundsLaari: number;
    reversalsLaari: number;
  } | null;
  docsRead: number;
};

export async function getSiteAnalytics(
  range: DayRange,
): Promise<SiteAnalytics> {
  const days = daysInRange(range);
  const window = {
    from: maldivesDayBoundary(days[0], "start")!,
    to: maldivesDayBoundary(days[days.length - 1], "end")!,
  };
  const [
    read,
    enquiryDocs,
    userDocs,
    publicFarmers,
    reportData,
    invoiceDocs,
    paymentDocs,
  ] = await Promise.all([
    readDays(days),
    safe(
      async () =>
        (
          await inRange(col(COLLECTIONS.enquiries), "createdAt", window)
            .select("createdAt", "productId", "farmerId")
            .get()
        ).docs,
    ),
    safe(
      async () =>
        (
          await inRange(col(COLLECTIONS.users), "createdAt", window)
            .select("createdAt", "role")
            .get()
        ).docs,
    ),
    safe(async () => {
      const snap = await col(COLLECTIONS.products)
        .where("isPublic", "==", true)
        .select("farmerId")
        .get();
      return new Set(snap.docs.map((d) => d.get("farmerId") as string)).size;
    }),
    safe(async () => {
      const [opened, closed, openNow, enforcement] = await Promise.all([
        inRange(col(COLLECTIONS.reports), "createdAt", window)
          .select("createdAt", "reason")
          .get(),
        inRange(col(COLLECTIONS.reports), "closedAt", window)
          .select("closedAt")
          .get(),
        col(COLLECTIONS.reports)
          .where("status", "in", ["open", "reviewing", "awaiting_info"])
          .count()
          .get(),
        inRange(col(COLLECTIONS.enforcementActions), "createdAt", window)
          .select("type")
          .get(),
      ]);
      return {
        opened: opened.docs,
        closed: closed.docs,
        openNow: openNow.data().count,
        enforcement: enforcement.docs,
      };
    }),
    safe(
      async () =>
        (
          await inRange(col(COLLECTIONS.invoices), "issuedAt", window)
            .select("status", "totalLaari")
            .get()
        ).docs,
    ),
    safe(
      async () =>
        (
          await inRange(col(COLLECTIONS.payments), "createdAt", window)
            .select(
              "kind",
              "amountLaari",
              "effectiveLaari",
              "verificationStatus",
            )
            .get()
        ).docs,
    ),
  ]);

  const series: SeriesPoint[] = days.map((day) => {
    const c = read.perDay.get(day)!;
    return {
      day,
      visitors: c.visitors,
      sessions: c.sessions,
      pageViews: c.pageViews,
      productViews: c.productViews,
      contactClicks: c.contactClicks,
      enquiries: 0,
      farmers: 0,
      consumers: 0,
      reportsOpened: 0,
      reportsClosed: 0,
    };
  });
  const byDay = new Map(series.map((p) => [p.day, p]));
  const bump = (day: string | null, key: keyof Omit<SeriesPoint, "day">) => {
    const p = day ? byDay.get(day) : undefined;
    if (p) p[key]++;
  };

  const enquiriesByProduct: Record<string, number> = {};
  for (const d of enquiryDocs ?? []) {
    bump(dayOf(d.get("createdAt")), "enquiries");
    const pid = d.get("productId") as string | undefined;
    if (pid) enquiriesByProduct[pid] = (enquiriesByProduct[pid] ?? 0) + 1;
  }
  let farmers = 0;
  let consumers = 0;
  for (const d of userDocs ?? []) {
    const role = d.get("role");
    if (role === "farmer") {
      farmers++;
      bump(dayOf(d.get("createdAt")), "farmers");
    } else if (role === "consumer") {
      consumers++;
      bump(dayOf(d.get("createdAt")), "consumers");
    }
  }
  const byReason: Record<string, number> = {};
  for (const d of reportData?.opened ?? []) {
    bump(dayOf(d.get("createdAt")), "reportsOpened");
    const r = d.get("reason") as string;
    byReason[r] = (byReason[r] ?? 0) + 1;
  }
  for (const d of reportData?.closed ?? [])
    bump(dayOf(d.get("closedAt")), "reportsClosed");
  const enforcement: Record<string, number> = {};
  for (const d of reportData?.enforcement ?? []) {
    const t = d.get("type") as string;
    enforcement[t] = (enforcement[t] ?? 0) + 1;
  }

  // Names for the top products and islands.
  const topProductIds = top(read.tallies.productViews).map(([id]) => id);
  const islandIds = [
    ...new Set([
      ...top(read.tallies.islandViews).map(([id]) => id),
      ...top(read.tallies.islandFilters).map(([id]) => id),
    ]),
  ];
  const [productSnaps, islandSnaps] = await Promise.all([
    topProductIds.length
      ? db().getAll(
          ...topProductIds.map((id) => col(COLLECTIONS.products).doc(id)),
        )
      : Promise.resolve([]),
    islandIds.length
      ? db().getAll(...islandIds.map((id) => col(COLLECTIONS.islands).doc(id)))
      : Promise.resolve([]),
  ]);
  const productName = new Map(
    productSnaps.map((s) => [s.id, (s.get("title") as LocalizedText) ?? null]),
  );
  const islandName = new Map(
    islandSnaps.map((s) => [
      s.id,
      s.exists
        ? ({
            en: s.get("nameEn") as string,
            dv: (s.get("nameDv") as string) ?? "",
          } as LocalizedText)
        : null,
    ]),
  );

  const categoryIds = new Set([
    ...Object.keys(read.tallies.categoryViews),
    ...Object.keys(read.tallies.categoryFilters),
  ]);

  let invoices: SiteAnalytics["invoices"] = null;
  if (invoiceDocs) {
    invoices = { count: 0, totalLaari: 0, cancelled: 0 };
    for (const d of invoiceDocs) {
      const status = d.get("status");
      if (status === "cancelled") invoices.cancelled++;
      else if (status !== "draft") {
        invoices.count++;
        invoices.totalLaari += Number(d.get("totalLaari") ?? 0);
      }
    }
  }
  let payments: SiteAnalytics["payments"] = null;
  if (paymentDocs) {
    payments = {
      count: 0,
      totalLaari: 0,
      verifiedLaari: 0,
      pendingLaari: 0,
      rejectedLaari: 0,
      refundsLaari: 0,
      reversalsLaari: 0,
    };
    for (const d of paymentDocs) {
      const kind = d.get("kind") ?? "payment";
      const amount = Number(d.get("amountLaari") ?? 0);
      if (kind === "refund") payments.refundsLaari += amount;
      else if (kind === "reversal") payments.reversalsLaari += amount;
      else {
        payments.count++;
        payments.totalLaari += amount;
        const v = d.get("verificationStatus");
        if (v === "verified") payments.verifiedLaari += amount;
        else if (v === "rejected") payments.rejectedLaari += amount;
        else if (v === "pending_verification") payments.pendingLaari += amount;
      }
    }
  }

  return {
    days,
    uniqueVisitors:
      days.length === 1
        ? { value: read.totals.visitors, exact: true }
        : { value: hllEstimate(read.registers), exact: false },
    totals: read.totals,
    series,
    topProducts: topProductIds.map((id) => ({
      id,
      name: productName.get(id) ?? null,
      views: read.tallies.productViews[id] ?? 0,
      clicks: read.tallies.productClicks[id] ?? 0,
      enquiries: enquiriesByProduct[id] ?? 0,
    })),
    categories: [...categoryIds]
      .map((id) => ({
        id,
        name: null,
        views: read.tallies.categoryViews[id] ?? 0,
        filterUses: read.tallies.categoryFilters[id] ?? 0,
      }))
      .sort((a, b) => b.views - a.views || b.filterUses - a.filterUses),
    islands: islandIds
      .map((id) => ({
        id,
        name: islandName.get(id) ?? null,
        views: read.tallies.islandViews[id] ?? 0,
        filterUses: read.tallies.islandFilters[id] ?? 0,
      }))
      .sort((a, b) => b.views - a.views || b.filterUses - a.filterUses),
    atollFilters: top(read.tallies.atollFilters).map(([id, count]) => ({
      id,
      count,
    })),
    enquiries: enquiryDocs ? enquiryDocs.length : null,
    registrations: userDocs ? { farmers, consumers } : null,
    activeFarmers:
      publicFarmers === null
        ? null
        : {
            withListings: publicFarmers,
            withEnquiries: enquiryDocs
              ? new Set(enquiryDocs.map((d) => d.get("farmerId"))).size
              : null,
          },
    reports: reportData
      ? {
          opened: reportData.opened.length,
          closed: reportData.closed.length,
          openNow: reportData.openNow,
          byReason: top(byReason, 20).map(([id, count]) => ({ id, count })),
          enforcement: top(enforcement, 20).map(([id, count]) => ({
            id,
            count,
          })),
        }
      : null,
    invoices,
    payments,
    docsRead: read.docsRead,
  };
}

// ---------------------------------------------------------------------------
// Farmer analytics (own listings only)
// ---------------------------------------------------------------------------

export type FarmerSeriesPoint = {
  day: string;
  productViews: number;
  profileViews: number;
  contactClicks: number;
  enquiries: number;
};

export type FarmerAnalytics = {
  days: string[];
  totals: {
    productViews: number;
    profileViews: number;
    contactClicks: number;
    contactCall: number;
    contactWhatsapp: number;
    contactViber: number;
    enquiries: number | null;
  };
  series: FarmerSeriesPoint[];
  products: {
    id: string;
    name: LocalizedText | null;
    views: number;
    clicks: number;
    enquiries: number;
  }[];
};

/**
 * Figures for one farmer. Every read is filtered by `uid`, which callers
 * take from the verified session — never from the request.
 */
export async function getFarmerAnalytics(
  uid: string,
  range: DayRange,
): Promise<FarmerAnalytics> {
  const days = daysInRange(range);
  const window = {
    from: maldivesDayBoundary(days[0], "start")!,
    to: maldivesDayBoundary(days[days.length - 1], "end")!,
  };
  const [farmerDays, productDays, enquiryDocs, productSnap] = await Promise.all(
    [
      getAllChunked(days.map((d) => farmerDailyRef(d, uid))),
      col(COLLECTIONS.analyticsProductDaily)
        .where("farmerId", "==", uid)
        .where("day", ">=", days[0])
        .where("day", "<=", days[days.length - 1])
        .get(),
      safe(
        async () =>
          (
            await inRange(
              col(COLLECTIONS.enquiries).where("farmerId", "==", uid),
              "createdAt",
              window,
            )
              .select("createdAt", "productId")
              .get()
          ).docs,
      ),
      col(COLLECTIONS.products)
        .where("farmerId", "==", uid)
        .select("title")
        .get(),
    ],
  );

  const series: FarmerSeriesPoint[] = days.map((day) => ({
    day,
    productViews: 0,
    profileViews: 0,
    contactClicks: 0,
    enquiries: 0,
  }));
  const byDay = new Map(series.map((p) => [p.day, p]));
  const totals = {
    productViews: 0,
    profileViews: 0,
    contactClicks: 0,
    contactCall: 0,
    contactWhatsapp: 0,
    contactViber: 0,
    enquiries: enquiryDocs ? enquiryDocs.length : null,
  };
  for (const snap of farmerDays) {
    if (!snap.exists || snap.get("farmerId") !== uid) continue;
    const point = byDay.get(snap.get("day") as string);
    const n = (k: string) => Number(snap.get(k) ?? 0);
    if (point) {
      point.productViews += n("productViews");
      point.profileViews += n("profileViews");
      point.contactClicks += n("contactClicks");
    }
    totals.productViews += n("productViews");
    totals.profileViews += n("profileViews");
    totals.contactClicks += n("contactClicks");
    totals.contactCall += n("contactCall");
    totals.contactWhatsapp += n("contactWhatsapp");
    totals.contactViber += n("contactViber");
  }

  const perProduct = new Map<
    string,
    { views: number; clicks: number; enquiries: number }
  >();
  const entry = (id: string) => {
    let e = perProduct.get(id);
    if (!e) perProduct.set(id, (e = { views: 0, clicks: 0, enquiries: 0 }));
    return e;
  };
  for (const d of productDays.docs) {
    const e = entry(d.get("productId") as string);
    e.views += Number(d.get("productViews") ?? 0);
    e.clicks += Number(d.get("contactClicks") ?? 0);
  }
  for (const d of enquiryDocs ?? []) {
    const point = byDay.get(dayOf(d.get("createdAt")) ?? "");
    if (point) point.enquiries++;
    const pid = d.get("productId") as string | undefined;
    if (pid) entry(pid).enquiries++;
  }
  const names = new Map(
    productSnap.docs.map((d) => [d.id, d.get("title") as LocalizedText]),
  );

  return {
    days,
    totals,
    series,
    products: [...perProduct.entries()]
      // Only this farmer's own listings (product daily docs are filtered by
      // farmerId already; enquiries too). Unknown ids are deleted listings.
      .map(([id, e]) => ({ id, name: names.get(id) ?? null, ...e }))
      .sort(
        (a, b) =>
          b.views - a.views || b.enquiries - a.enquiries || b.clicks - a.clicks,
      ),
  };
}

/**
 * Website totals for the admin dashboard. Open-ended or very long periods
 * cover the last ANALYTICS_MAX_DAYS days.
 */
export async function getTrafficTotals({
  from,
  to,
}: {
  from: Date | null;
  to: Date;
}) {
  const earliest = new Date(to.getTime() - (ANALYTICS_MAX_DAYS - 1) * DAY_MS);
  const days = daysInRange({
    from: from && from > earliest ? from : earliest,
    to,
  });
  return (await readDays(days)).totals;
}

/** Totals for a farmer over a period (dashboard summary). */
export async function getFarmerTotals(uid: string, range: DayRange) {
  const days = daysInRange(range);
  const snaps = await getAllChunked(days.map((d) => farmerDailyRef(d, uid)));
  let views = 0;
  let profileViews = 0;
  let clicks = 0;
  for (const s of snaps) {
    if (!s.exists) continue;
    views += Number(s.get("productViews") ?? 0);
    profileViews += Number(s.get("profileViews") ?? 0);
    clicks += Number(s.get("contactClicks") ?? 0);
  }
  return { views, profileViews, clicks };
}
